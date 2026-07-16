import { describe, expect, it, vi } from 'vitest';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { TestTakingService } from './test-taking.service.js';

const READY_QUESTIONS = [
  {
    id: 'q1',
    type: 'multiple_choice',
    prompt: '¿Cuál es correcta?',
    skillTags: ['x'],
    estimatedMinutes: 5,
    options: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }],
    correctOptionId: 'a',
    explanation: 'Porque sí, secreto del evaluador.',
  },
  {
    id: 'q2',
    type: 'open_text',
    prompt: 'Explica algo.',
    skillTags: ['y'],
    estimatedMinutes: 10,
    expectedPoints: ['Punto secreto del evaluador'],
  },
  {
    id: 'q3',
    type: 'code',
    prompt: 'Resuelve esto.',
    skillTags: ['z'],
    estimatedMinutes: 15,
    language: 'typescript',
    starterCode: 'function solve() {}',
    expectedApproach: 'Enfoque secreto del evaluador.',
  },
];

function createFakePrisma() {
  const applications = new Map<string, any>();
  const techTests = new Map<string, any>();
  const submissions = new Map<string, any>(); // key: applicationId
  let nextId = 1;

  const client: any = {
    application: {
      findFirst: vi.fn(async ({ where }: any) => {
        const app = applications.get(where.id);
        if (!app || app.userId !== where.userId) return null;
        return { id: app.id, job: app.job };
      }),
    },
    techTest: {
      findUnique: vi.fn(async ({ where }: any) => techTests.get(where.id) ?? null),
    },
    testSubmission: {
      findUnique: vi.fn(async ({ where }: any) => submissions.get(where.applicationId) ?? null),
      findFirst: vi.fn(async ({ where }: any) => {
        const s = [...submissions.values()].find((x) => x.applicationId === where.applicationId);
        return s && s.userId === where.userId ? s : null;
      }),
      findUniqueOrThrow: vi.fn(async ({ where }: any) => {
        const s = [...submissions.values()].find((x) => x.id === where.id);
        if (!s) throw new Error('not found');
        return s;
      }),
      create: vi.fn(async ({ data }: any) => {
        const s = { id: `sub-${nextId++}`, startedAt: new Date(), submittedAt: null, answersJson: null, ...data };
        submissions.set(data.applicationId, s);
        return s;
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const entry = [...submissions.entries()].find(([, s]) => s.id === where.id)!;
        const updated = { ...entry[1], ...data };
        submissions.set(entry[0], updated);
        return updated;
      }),
      updateMany: vi.fn(async ({ where, data }: any) => {
        const entry = [...submissions.entries()].find(([, s]) => s.id === where.id);
        if (!entry || entry[1].status !== where.status) return { count: 0 };
        submissions.set(entry[0], { ...entry[1], ...data });
        return { count: 1 };
      }),
    },
  };

  return { client, applications, techTests, submissions };
}

function buildService(fake: ReturnType<typeof createFakePrisma>) {
  const realtime = { emitToCompany: vi.fn() };
  const service = new TestTakingService(fake.client, realtime as any);
  return { service, realtime };
}

function setupReady(fake: ReturnType<typeof createFakePrisma>, opts: { timeLimitMinutes?: number | null } = {}) {
  fake.applications.set('app-1', {
    id: 'app-1',
    userId: 'candidate-1',
    job: { id: 'job-1', techTestId: 'test-1', companyId: 'company-1' },
  });
  fake.techTests.set('test-1', {
    id: 'test-1',
    title: 'Prueba Backend',
    status: 'READY',
    timeLimitMinutes: opts.timeLimitMinutes ?? null,
    questionsJson: READY_QUESTIONS,
  });
}

describe('TestTakingService.getTest', () => {
  it('NUNCA incluye correctOptionId, explanation, expectedPoints, expectedApproach ni rubricJson', async () => {
    const fake = createFakePrisma();
    setupReady(fake);
    const { service } = buildService(fake);

    const result = await service.getTest('candidate-1', 'app-1');
    const serialized = JSON.stringify(result);

    expect(serialized).not.toContain('correctOptionId');
    expect(serialized).not.toContain('explanation');
    expect(serialized).not.toContain('expectedPoints');
    expect(serialized).not.toContain('expectedApproach');
    expect(serialized).not.toContain('rubricJson');
    expect(serialized).not.toContain('secreto del evaluador');
    // Confirma que sí llegó contenido real (no es un false-positive por objeto vacío).
    expect(result.questions).toHaveLength(3);
    expect(result.questions[0]).toMatchObject({ id: 'q1', type: 'multiple_choice' });
  });

  it('el select de techTest.findUnique nunca pide rubricJson (defensa incluso si alguien rompe toCandidateQuestion)', async () => {
    const fake = createFakePrisma();
    setupReady(fake);
    const { service } = buildService(fake);

    await service.getTest('candidate-1', 'app-1');

    const call = fake.client.techTest.findUnique.mock.calls[0][0];
    expect(call.select).not.toHaveProperty('rubricJson');
  });

  it('lanza NotFoundException si la aplicación pertenece a OTRO usuario (IDOR)', async () => {
    const fake = createFakePrisma();
    setupReady(fake);
    const { service } = buildService(fake);

    await expect(service.getTest('otro-usuario', 'app-1')).rejects.toThrow(NotFoundException);
  });

  it('lanza NotFoundException si la vacante no requiere prueba técnica', async () => {
    const fake = createFakePrisma();
    fake.applications.set('app-2', { id: 'app-2', userId: 'candidate-1', job: { id: 'job-2', techTestId: null } });
    const { service } = buildService(fake);

    await expect(service.getTest('candidate-1', 'app-2')).rejects.toThrow(NotFoundException);
  });

  it('lanza NotFoundException si la prueba todavía no está READY', async () => {
    const fake = createFakePrisma();
    setupReady(fake);
    fake.techTests.get('test-1')!.status = 'GENERATING';
    const { service } = buildService(fake);

    await expect(service.getTest('candidate-1', 'app-1')).rejects.toThrow(NotFoundException);
  });
});

describe('TestTakingService.start', () => {
  it('crea la submission IN_PROGRESS', async () => {
    const fake = createFakePrisma();
    setupReady(fake);
    const { service } = buildService(fake);

    const submission = await service.start('candidate-1', 'app-1');

    expect(submission.status).toBe('IN_PROGRESS');
    expect(fake.submissions.get('app-1')).toBeDefined();
  });

  it('es idempotente: una segunda llamada no reinicia el cronómetro', async () => {
    const fake = createFakePrisma();
    setupReady(fake);
    const { service } = buildService(fake);

    const first = await service.start('candidate-1', 'app-1');
    const second = await service.start('candidate-1', 'app-1');

    expect(second.id).toBe(first.id);
    expect(second.startedAt).toEqual(first.startedAt);
    expect(fake.client.testSubmission.create).toHaveBeenCalledTimes(1);
  });
});

describe('TestTakingService.saveAnswers', () => {
  it('guarda las respuestas mientras está IN_PROGRESS', async () => {
    const fake = createFakePrisma();
    setupReady(fake);
    const { service } = buildService(fake);
    await service.start('candidate-1', 'app-1');

    const result = await service.saveAnswers('candidate-1', 'app-1', {
      answers: [{ questionId: 'q1', answer: 'a' }],
    });

    expect(result.answersJson).toEqual([{ questionId: 'q1', answer: 'a' }]);
  });

  it('rechaza si ya se venció el tiempo límite', async () => {
    const fake = createFakePrisma();
    setupReady(fake, { timeLimitMinutes: 30 });
    const { service } = buildService(fake);
    await service.start('candidate-1', 'app-1');
    // Retrocede el reloj de inicio para simular que ya pasó el tiempo.
    fake.submissions.get('app-1')!.startedAt = new Date(Date.now() - 31 * 60_000);

    await expect(
      service.saveAnswers('candidate-1', 'app-1', { answers: [{ questionId: 'q1', answer: 'a' }] }),
    ).rejects.toThrow(ConflictException);
  });

  it('rechaza si la prueba ya fue enviada', async () => {
    const fake = createFakePrisma();
    setupReady(fake);
    const { service } = buildService(fake);
    await service.start('candidate-1', 'app-1');
    await service.submit('candidate-1', 'app-1');

    await expect(
      service.saveAnswers('candidate-1', 'app-1', { answers: [{ questionId: 'q1', answer: 'a' }] }),
    ).rejects.toThrow(ConflictException);
  });
});

describe('TestTakingService.submit', () => {
  it('marca SUBMITTED y notifica a la empresa por realtime', async () => {
    const fake = createFakePrisma();
    setupReady(fake);
    const { service, realtime } = buildService(fake);
    await service.start('candidate-1', 'app-1');

    const result = await service.submit('candidate-1', 'app-1');

    expect(result.status).toBe('SUBMITTED');
    expect(fake.submissions.get('app-1')?.status).toBe('SUBMITTED');
    expect(fake.submissions.get('app-1')?.submittedAt).toBeInstanceOf(Date);
    expect(realtime.emitToCompany).toHaveBeenCalledWith(
      'company-1',
      'submission.received',
      expect.objectContaining({ applicationId: 'app-1' }),
    );
  });

  it('un doble submit (doble click) es idempotente: no falla ni reemite el evento', async () => {
    const fake = createFakePrisma();
    setupReady(fake);
    const { service, realtime } = buildService(fake);
    await service.start('candidate-1', 'app-1');

    await service.submit('candidate-1', 'app-1');
    const second = await service.submit('candidate-1', 'app-1');

    expect(second.status).toBe('SUBMITTED');
    expect(realtime.emitToCompany).toHaveBeenCalledTimes(1);
  });

  it('lanza NotFoundException si nunca se inició la prueba', async () => {
    const fake = createFakePrisma();
    setupReady(fake);
    const { service } = buildService(fake);

    await expect(service.submit('candidate-1', 'app-1')).rejects.toThrow(NotFoundException);
  });
});
