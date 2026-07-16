import { describe, expect, it, vi } from 'vitest';
import { NotFoundException, HttpException } from '@nestjs/common';
import { CreditsService } from '../billing/credits.service.js';
import { ApplicationsService } from './applications.service.js';

/**
 * Prisma en memoria compartido por ApplicationsService y el CreditsService
 * REAL (no un mock de CreditsService): así estos tests ejercitan la
 * transacción de verdad entre "marcar la Application como enviada" y "cobrar
 * el crédito" (ver `apply()`), no solo la lógica de cada servicio aislado.
 */
function createFakePrisma() {
  const jobs = new Map<string, any>();
  const applications = new Map<string, any>();
  const resumes = new Map<string, { id: string; userId: string }>();
  const coverLetters = new Map<string, { id: string; userId: string }>();
  const users = new Map<string, { id: string; creditsRemaining: number }>();
  const ledger: { userId: string; delta: number; reason: string; refId: string | null }[] = [];

  const client: any = {
    job: {
      findUnique: vi.fn(async ({ where }: any) => jobs.get(where.id) ?? null),
    },
    application: {
      findUnique: vi.fn(async ({ where }: any) => applications.get(where.userId_jobId.jobId) ?? null),
      upsert: vi.fn(async ({ where, create, update }: any) => {
        const key = where.userId_jobId.jobId;
        const existing = applications.get(key);
        const record = existing
          ? { ...existing, ...update, id: existing.id }
          : { ...create, id: `app-${applications.size + 1}` };
        applications.set(key, record);
        return { id: record.id };
      }),
    },
    resume: {
      findFirst: vi.fn(async ({ where }: any) => {
        const r = resumes.get(where.id);
        return r && r.userId === where.userId ? r : null;
      }),
    },
    coverLetter: {
      findFirst: vi.fn(async ({ where }: any) => {
        const c = coverLetters.get(where.id);
        return c && c.userId === where.userId ? c : null;
      }),
    },
    user: {
      findUnique: vi.fn(async ({ where }: any) => users.get(where.id) ?? null),
      findUniqueOrThrow: vi.fn(async ({ where }: any) => {
        const u = users.get(where.id);
        if (!u) throw new Error('Usuario no encontrado');
        return u;
      }),
      updateMany: vi.fn(async ({ where, data }: any) => {
        const u = users.get(where.id);
        if (!u) return { count: 0 };
        if (where.creditsRemaining?.gte != null && u.creditsRemaining < where.creditsRemaining.gte) {
          return { count: 0 };
        }
        if (data.creditsRemaining.decrement != null) u.creditsRemaining -= data.creditsRemaining.decrement;
        return { count: 1 };
      }),
    },
    creditLedger: {
      create: vi.fn(async ({ data }: any) => {
        ledger.push(data);
        return data;
      }),
    },
    // Simula el rollback real de Postgres: si el callback lanza, se descartan
    // las mutaciones que haya hecho (el upsert de Application incluido). Sin
    // esto, el fake no distingue "los pasos corrieron en una transacción" de
    // "corrieron uno tras otro" — que es justo lo que estos tests verifican.
    $transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) => {
      const snapshot = {
        applications: new Map(applications),
        users: new Map([...users].map(([k, v]) => [k, { ...v }])),
        ledgerLength: ledger.length,
      };
      try {
        return await callback(client);
      } catch (err) {
        applications.clear();
        for (const [k, v] of snapshot.applications) applications.set(k, v);
        users.clear();
        for (const [k, v] of snapshot.users) users.set(k, v);
        ledger.length = snapshot.ledgerLength;
        throw err;
      }
    }),
  };

  return { client, jobs, applications, resumes, coverLetters, users, ledger };
}

function buildService(fake: ReturnType<typeof createFakePrisma>) {
  const credits = new CreditsService(fake.client);
  const realtime = { emitToUser: vi.fn(), emitToCompany: vi.fn() };
  const push = { send: vi.fn() };
  return new ApplicationsService(fake.client, credits, realtime as any, push as any);
}

/** Como buildService, pero además devuelve el mock de realtime para inspeccionar emitToCompany. */
function buildServiceWithRealtime(fake: ReturnType<typeof createFakePrisma>) {
  const credits = new CreditsService(fake.client);
  const realtime = { emitToUser: vi.fn(), emitToCompany: vi.fn() };
  const push = { send: vi.fn() };
  const service = new ApplicationsService(fake.client, credits, realtime as any, push as any);
  return { service, realtime };
}

describe('ApplicationsService.apply', () => {
  const userId = 'user-1';
  const jobId = 'job-1';

  it('cobra el crédito y marca la aplicación como enviada', async () => {
    const fake = createFakePrisma();
    fake.jobs.set(jobId, { id: jobId, applyUrl: 'https://empresa.example/apply' });
    fake.users.set(userId, { id: userId, creditsRemaining: 5 });
    const service = buildService(fake);

    const result = await service.apply(userId, { jobId });

    expect(result.alreadyApplied).toBe(false);
    expect(fake.users.get(userId)?.creditsRemaining).toBe(4);
    expect(fake.ledger).toHaveLength(1);
    expect(fake.applications.get(jobId)).toMatchObject({ status: 'APPLIED', userId, jobId });
  });

  it('es idempotente: si ya se aplicó, no vuelve a cobrar', async () => {
    const fake = createFakePrisma();
    fake.jobs.set(jobId, { id: jobId, applyUrl: 'https://empresa.example/apply' });
    fake.users.set(userId, { id: userId, creditsRemaining: 5 });
    const service = buildService(fake);

    await service.apply(userId, { jobId });
    const second = await service.apply(userId, { jobId });

    expect(second.alreadyApplied).toBe(true);
    expect(fake.users.get(userId)?.creditsRemaining).toBe(4);
    expect(fake.ledger).toHaveLength(1);
  });

  it('rechaza si el resumeId no pertenece al usuario (IDOR)', async () => {
    const fake = createFakePrisma();
    fake.jobs.set(jobId, { id: jobId, applyUrl: 'https://empresa.example/apply' });
    fake.users.set(userId, { id: userId, creditsRemaining: 5 });
    fake.resumes.set('resume-ajeno', { id: 'resume-ajeno', userId: 'otro-usuario' });
    const service = buildService(fake);

    await expect(service.apply(userId, { jobId, resumeId: 'resume-ajeno' })).rejects.toThrow(NotFoundException);
    expect(fake.applications.get(jobId)).toBeUndefined();
    expect(fake.users.get(userId)?.creditsRemaining).toBe(5);
  });

  it('rechaza si el coverLetterId no pertenece al usuario (IDOR)', async () => {
    const fake = createFakePrisma();
    fake.jobs.set(jobId, { id: jobId, applyUrl: 'https://empresa.example/apply' });
    fake.users.set(userId, { id: userId, creditsRemaining: 5 });
    fake.coverLetters.set('cover-ajena', { id: 'cover-ajena', userId: 'otro-usuario' });
    const service = buildService(fake);

    await expect(service.apply(userId, { jobId, coverLetterId: 'cover-ajena' })).rejects.toThrow(NotFoundException);
    expect(fake.applications.get(jobId)).toBeUndefined();
  });

  it('acepta CV/carta que sí pertenecen al usuario', async () => {
    const fake = createFakePrisma();
    fake.jobs.set(jobId, { id: jobId, applyUrl: 'https://empresa.example/apply' });
    fake.users.set(userId, { id: userId, creditsRemaining: 5 });
    fake.resumes.set('resume-propio', { id: 'resume-propio', userId });
    const service = buildService(fake);

    const result = await service.apply(userId, { jobId, resumeId: 'resume-propio' });

    expect(result.alreadyApplied).toBe(false);
    expect(fake.applications.get(jobId)).toMatchObject({ resumeId: 'resume-propio' });
  });

  it('sin crédito suficiente, no deja la Application marcada como enviada (atomicidad)', async () => {
    const fake = createFakePrisma();
    fake.jobs.set(jobId, { id: jobId, applyUrl: 'https://empresa.example/apply' });
    fake.users.set(userId, { id: userId, creditsRemaining: 0 });
    const service = buildService(fake);

    await expect(service.apply(userId, { jobId })).rejects.toThrow(HttpException);
    expect(fake.applications.get(jobId)).toBeUndefined();
  });

  it('si el cobro falla DENTRO de la transacción (saldo cambia tras el chequeo previo), revierte también el upsert de la Application', async () => {
    const fake = createFakePrisma();
    fake.jobs.set(jobId, { id: jobId, applyUrl: 'https://empresa.example/apply' });
    // El saldo real es 0 (lo que verá el UPDATE atómico dentro de la
    // transacción), pero el chequeo previo barato (`assertBalance`, un SELECT
    // aparte antes de abrir la transacción) lee un valor desactualizado —
    // simula la ventana de una carrera. Antes del fix (upsert + consume en
    // pasos separados, no en una transacción), esto habría dejado la
    // Application marcada como APPLIED sin haberse cobrado nunca.
    fake.users.set(userId, { id: userId, creditsRemaining: 0 });
    fake.client.user.findUnique.mockResolvedValueOnce({ creditsRemaining: 5 });
    const service = buildService(fake);

    await expect(service.apply(userId, { jobId })).rejects.toThrow(HttpException);
    expect(fake.applications.get(jobId)).toBeUndefined();
  });

  it('opts.auto marca autoApplied:true en el registro (usado por AutoApplyService)', async () => {
    const fake = createFakePrisma();
    fake.jobs.set(jobId, { id: jobId, applyUrl: 'https://empresa.example/apply' });
    fake.users.set(userId, { id: userId, creditsRemaining: 5 });
    const service = buildService(fake);

    await service.apply(userId, { jobId }, { auto: true });

    expect(fake.applications.get(jobId)).toMatchObject({ autoApplied: true });
  });

  it('sin opts.auto (aplicación manual), autoApplied queda en false', async () => {
    const fake = createFakePrisma();
    fake.jobs.set(jobId, { id: jobId, applyUrl: 'https://empresa.example/apply' });
    fake.users.set(userId, { id: userId, creditsRemaining: 5 });
    const service = buildService(fake);

    await service.apply(userId, { jobId });

    expect(fake.applications.get(jobId)).toMatchObject({ autoApplied: false });
  });

  it('lanza NotFoundException si la vacante no existe', async () => {
    const fake = createFakePrisma();
    fake.users.set(userId, { id: userId, creditsRemaining: 5 });
    const service = buildService(fake);

    await expect(service.apply(userId, { jobId: 'no-existe' })).rejects.toThrow(NotFoundException);
  });

  describe('vacantes source=COMPANY (aplicación interna)', () => {
    it('cobra el crédito igual, deja applyUrl null, method MANUAL y notifica a la empresa', async () => {
      const fake = createFakePrisma();
      fake.jobs.set(jobId, {
        id: jobId,
        applyUrl: null,
        source: 'COMPANY',
        companyId: 'company-1',
        techTestId: null,
        title: 'Backend Engineer',
        company: 'Acme',
      });
      fake.users.set(userId, { id: userId, creditsRemaining: 5 });
      const { service, realtime } = buildServiceWithRealtime(fake);

      const result = await service.apply(userId, { jobId });

      expect(result.applyUrl).toBeNull();
      expect(result.requiresTest).toBe(false);
      expect(fake.users.get(userId)?.creditsRemaining).toBe(4);
      expect(fake.applications.get(jobId)).toMatchObject({ method: 'MANUAL', status: 'APPLIED' });
      expect(realtime.emitToCompany).toHaveBeenCalledWith(
        'company-1',
        'applicant.new',
        expect.objectContaining({ jobId }),
      );
    });

    it('requiresTest es true cuando la vacante tiene una prueba técnica adjunta', async () => {
      const fake = createFakePrisma();
      fake.jobs.set(jobId, {
        id: jobId,
        applyUrl: null,
        source: 'COMPANY',
        companyId: 'company-1',
        techTestId: 'test-1',
        title: 'Backend Engineer',
        company: 'Acme',
      });
      fake.users.set(userId, { id: userId, creditsRemaining: 5 });
      const { service } = buildServiceWithRealtime(fake);

      const result = await service.apply(userId, { jobId });

      expect(result.requiresTest).toBe(true);
    });

    it('una vacante externa (no COMPANY) sigue con method EXTERNAL y no notifica a ninguna empresa', async () => {
      const fake = createFakePrisma();
      fake.jobs.set(jobId, { id: jobId, applyUrl: 'https://empresa.example/apply' });
      fake.users.set(userId, { id: userId, creditsRemaining: 5 });
      const { service, realtime } = buildServiceWithRealtime(fake);

      const result = await service.apply(userId, { jobId });

      expect(result.requiresTest).toBe(false);
      expect(fake.applications.get(jobId)).toMatchObject({ method: 'EXTERNAL' });
      expect(realtime.emitToCompany).not.toHaveBeenCalled();
    });
  });
});
