import { describe, expect, it, vi } from 'vitest';
import { HttpException, HttpStatus } from '@nestjs/common';
import { AutoApplyService } from './auto-apply.service.js';

/**
 * AutoApplyService orquesta (decide QUÉ y CUÁNTAS vacantes intentar) pero
 * delega TODA la lógica de dinero a colaboradores ya probados por su cuenta
 * (GenerationService, ApplicationsService) — por eso aquí van mockeados como
 * cajas negras, no reimplementados. Estos tests verifican la orquestación:
 * filtro de score, tope diario, dedupe, y que un error no tumbe la corrida.
 */
function makeJob(
  id: string,
  score: number,
  overrides: Partial<{ title: string; company: string; source: string }> = {},
) {
  return {
    id,
    title: overrides.title ?? `Job ${id}`,
    company: overrides.company ?? 'Acme',
    source: overrides.source ?? 'MOCK',
    score,
  };
}

function createFakePrisma() {
  const applications = new Map<string, { submittedAt: Date | null }>();
  const users = new Map<string, { expoPushToken: string | null }>();

  const client: any = {
    profile: { findMany: vi.fn() },
    application: {
      count: vi.fn().mockResolvedValue(0),
      findUnique: vi.fn(async ({ where }: any) => applications.get(where.userId_jobId.jobId) ?? null),
    },
    user: {
      findUnique: vi.fn(async ({ where }: any) => users.get(where.id) ?? { expoPushToken: null }),
    },
  };

  return { client, applications, users };
}

function buildService(fake: ReturnType<typeof createFakePrisma>, matches: ReturnType<typeof makeJob>[]) {
  const jobs = { forYou: vi.fn().mockResolvedValue({ data: matches, nextCursor: null }) };
  const applications = { apply: vi.fn().mockResolvedValue({ alreadyApplied: false }) };
  const generation = {
    generateAndSaveResume: vi.fn().mockImplementation(async (_userId: string, jobId: string) => ({
      resume: { id: `resume-${jobId}` },
      ats: { score: 80 },
      creditsRemaining: 3,
    })),
  };
  const push = { send: vi.fn().mockResolvedValue(undefined) };

  const service = new AutoApplyService(fake.client, jobs as any, applications as any, generation as any, push as any);
  return { service, jobs, applications, generation, push };
}

describe('AutoApplyService.runSweep', () => {
  const userId = 'user-1';

  it('solo aplica a vacantes con score >= autoApplyMinScore', async () => {
    const fake = createFakePrisma();
    fake.client.profile.findMany.mockResolvedValue([
      { userId, autoApplyMinScore: 85, autoApplyMaxPerDay: 5 },
    ]);
    const matches = [makeJob('a', 0.9), makeJob('b', 0.5), makeJob('c', 0.86)];
    const { service, applications } = buildService(fake, matches);

    await service.runSweep();

    const appliedJobIds = applications.apply.mock.calls.map((c: any[]) => c[1].jobId);
    expect(appliedJobIds.sort()).toEqual(['a', 'c']);
  });

  it('respeta el tope diario, incluso con más candidatos disponibles', async () => {
    const fake = createFakePrisma();
    fake.client.profile.findMany.mockResolvedValue([
      { userId, autoApplyMinScore: 50, autoApplyMaxPerDay: 2 },
    ]);
    const matches = [makeJob('a', 0.9), makeJob('b', 0.8), makeJob('c', 0.7)];
    const { service, applications } = buildService(fake, matches);

    await service.runSweep();

    expect(applications.apply).toHaveBeenCalledTimes(2);
  });

  it('descuenta del tope diario lo ya aplicado hoy por el agente', async () => {
    const fake = createFakePrisma();
    fake.client.profile.findMany.mockResolvedValue([
      { userId, autoApplyMinScore: 50, autoApplyMaxPerDay: 2 },
    ]);
    fake.client.application.count.mockResolvedValue(2); // ya alcanzó el tope hoy
    const { service, applications, jobs } = buildService(fake, [makeJob('a', 0.9)]);

    await service.runSweep();

    expect(jobs.forYou).not.toHaveBeenCalled();
    expect(applications.apply).not.toHaveBeenCalled();
  });

  it('no re-aplica a una vacante ya aplicada (manual o de una corrida previa)', async () => {
    const fake = createFakePrisma();
    fake.client.profile.findMany.mockResolvedValue([
      { userId, autoApplyMinScore: 50, autoApplyMaxPerDay: 5 },
    ]);
    fake.applications.set('a', { submittedAt: new Date() });
    const { service, applications } = buildService(fake, [makeJob('a', 0.9), makeJob('b', 0.9)]);

    await service.runSweep();

    expect(applications.apply).toHaveBeenCalledTimes(1);
    expect(applications.apply.mock.calls[0]![1].jobId).toBe('b');
  });

  it('un 402 (sin saldo) corta el loop de ESE usuario, sin seguir intentando más vacantes', async () => {
    const fake = createFakePrisma();
    fake.client.profile.findMany.mockResolvedValue([
      { userId, autoApplyMinScore: 50, autoApplyMaxPerDay: 5 },
    ]);
    const { service, generation, applications } = buildService(fake, [makeJob('a', 0.9), makeJob('b', 0.9)]);
    generation.generateAndSaveResume.mockRejectedValueOnce(
      new HttpException('Créditos insuficientes', HttpStatus.PAYMENT_REQUIRED),
    );

    await service.runSweep();

    expect(applications.apply).not.toHaveBeenCalled();
  });

  it('un error no-402 en un job (ej. fallo de IA) no detiene los siguientes candidatos', async () => {
    const fake = createFakePrisma();
    fake.client.profile.findMany.mockResolvedValue([
      { userId, autoApplyMinScore: 50, autoApplyMaxPerDay: 5 },
    ]);
    const { service, generation, applications } = buildService(fake, [makeJob('a', 0.9), makeJob('b', 0.9)]);
    generation.generateAndSaveResume.mockRejectedValueOnce(new Error('timeout de red'));

    await service.runSweep();

    expect(applications.apply).toHaveBeenCalledTimes(1);
    expect(applications.apply.mock.calls[0]![1].jobId).toBe('b');
  });

  it('un usuario que falla no detiene la corrida de los demás', async () => {
    const fake = createFakePrisma();
    fake.client.profile.findMany.mockResolvedValue([
      { userId: 'user-broken', autoApplyMinScore: 50, autoApplyMaxPerDay: 5 },
      { userId: 'user-2', autoApplyMinScore: 50, autoApplyMaxPerDay: 5 },
    ]);
    // El primer usuario revienta en la propia consulta de aplicaciones de hoy.
    fake.client.application.count
      .mockRejectedValueOnce(new Error('DB caída'))
      .mockResolvedValue(0);
    const { service, applications } = buildService(fake, [makeJob('a', 0.9)]);

    await service.runSweep();

    expect(applications.apply).toHaveBeenCalledTimes(1);
    expect(applications.apply.mock.calls[0]![0]).toBe('user-2');
  });

  it('excluye vacantes source=COMPANY (pueden requerir una prueba técnica que el agente no puede rendir)', async () => {
    const fake = createFakePrisma();
    fake.client.profile.findMany.mockResolvedValue([
      { userId, autoApplyMinScore: 50, autoApplyMaxPerDay: 5 },
    ]);
    const matches = [makeJob('a', 0.9, { source: 'COMPANY' }), makeJob('b', 0.9)];
    const { service, applications } = buildService(fake, matches);

    await service.runSweep();

    expect(applications.apply).toHaveBeenCalledTimes(1);
    expect(applications.apply.mock.calls[0]![1].jobId).toBe('b');
  });

  it('marca la aplicación con opts.auto: true', async () => {
    const fake = createFakePrisma();
    fake.client.profile.findMany.mockResolvedValue([
      { userId, autoApplyMinScore: 50, autoApplyMaxPerDay: 5 },
    ]);
    const { service, applications } = buildService(fake, [makeJob('a', 0.9)]);

    await service.runSweep();

    expect(applications.apply).toHaveBeenCalledWith(userId, { jobId: 'a', resumeId: 'resume-a' }, { auto: true });
  });
});
