import { describe, expect, it, vi } from 'vitest';
import { CompanyAiProcessor } from './company-ai.processor.js';

function fakeJob(overrides: Partial<{ name: string; data: any; attemptsMade: number; attempts: number }> = {}) {
  return {
    name: overrides.name ?? 'generate-test',
    data: overrides.data ?? { testId: 'test-1' },
    attemptsMade: overrides.attemptsMade ?? 1,
    opts: { attempts: overrides.attempts ?? 3 },
  } as any;
}

function buildProcessor() {
  const generation = { generate: vi.fn().mockResolvedValue(undefined) };
  const evaluationGeneration = { evaluate: vi.fn().mockResolvedValue(undefined) };
  const credits = { grant: vi.fn().mockResolvedValue(10) };
  const tests = new Map<string, any>();
  const submissions = new Map<string, any>();
  const prisma = {
    techTest: {
      findUniqueOrThrow: vi.fn(async ({ where }: any) => {
        const t = tests.get(where.id);
        if (!t) throw new Error('not found');
        return t;
      }),
      findUnique: vi.fn(async ({ where }: any) => tests.get(where.id) ?? null),
      update: vi.fn(async ({ where, data }: any) => {
        const t = tests.get(where.id);
        const updated = { ...t, ...data };
        tests.set(where.id, updated);
        return updated;
      }),
    },
    testSubmission: {
      findUniqueOrThrow: vi.fn(async ({ where }: any) => {
        const s = submissions.get(where.id);
        if (!s) throw new Error('not found');
        return s;
      }),
      findUnique: vi.fn(async ({ where }: any) => submissions.get(where.id) ?? null),
      update: vi.fn(async ({ where, data }: any) => {
        const s = submissions.get(where.id);
        const updated = { ...s, ...data };
        submissions.set(where.id, updated);
        return updated;
      }),
    },
  };
  const realtime = { emitToCompany: vi.fn() };
  const processor = new CompanyAiProcessor(
    generation as any,
    evaluationGeneration as any,
    credits as any,
    prisma as any,
    realtime as any,
  );
  return { processor, generation, evaluationGeneration, credits, prisma, realtime, tests, submissions };
}

describe('CompanyAiProcessor.process — generate-test', () => {
  it('genera la prueba y emite test.ready', async () => {
    const { processor, generation, realtime, tests } = buildProcessor();
    tests.set('test-1', { companyId: 'company-1', status: 'GENERATING' });

    await processor.process(fakeJob());

    expect(generation.generate).toHaveBeenCalledWith('test-1');
    expect(realtime.emitToCompany).toHaveBeenCalledWith('company-1', 'test.ready', { testId: 'test-1' });
  });
});

describe('CompanyAiProcessor.process — evaluate-submission', () => {
  it('evalúa la submission y emite submission.evaluated', async () => {
    const { processor, evaluationGeneration, realtime, submissions } = buildProcessor();
    submissions.set('sub-1', { applicationId: 'app-1', techTest: { companyId: 'company-1' } });

    await processor.process(fakeJob({ name: 'evaluate-submission', data: { submissionId: 'sub-1', attempt: 1, userId: 'user-1' } }));

    expect(evaluationGeneration.evaluate).toHaveBeenCalledWith('sub-1');
    expect(realtime.emitToCompany).toHaveBeenCalledWith(
      'company-1',
      'submission.evaluated',
      expect.objectContaining({ submissionId: 'sub-1', applicationId: 'app-1' }),
    );
  });
});

describe('CompanyAiProcessor.onFailed — generate-test', () => {
  it('NO reembolsa si todavía quedan reintentos', async () => {
    const { processor, credits, prisma } = buildProcessor();

    await processor.onFailed(fakeJob({ attemptsMade: 1, attempts: 3 }), new Error('timeout de red'));

    expect(credits.grant).not.toHaveBeenCalled();
    expect(prisma.techTest.update).not.toHaveBeenCalled();
  });

  it('reembolsa y marca FAILED cuando se agotan los reintentos', async () => {
    const { processor, credits, realtime, tests } = buildProcessor();
    tests.set('test-1', { companyId: 'company-1', createdByUserId: 'user-1', status: 'GENERATING' });

    await processor.onFailed(fakeJob({ attemptsMade: 3, attempts: 3 }), new Error('salida de IA inválida'));

    expect(credits.grant).toHaveBeenCalledWith('user-1', 5, 'REFUND', 'techtest:test-1');
    expect(tests.get('test-1')?.status).toBe('FAILED');
    expect(realtime.emitToCompany).toHaveBeenCalledWith(
      'company-1',
      'test.failed',
      expect.objectContaining({ testId: 'test-1' }),
    );
  });

  it('NO reembolsa dos veces si el test ya no está en GENERATING', async () => {
    const { processor, credits, tests } = buildProcessor();
    tests.set('test-1', { companyId: 'company-1', createdByUserId: 'user-1', status: 'FAILED' });

    await processor.onFailed(fakeJob({ attemptsMade: 3, attempts: 3 }), new Error('x'));

    expect(credits.grant).not.toHaveBeenCalled();
  });
});

describe('CompanyAiProcessor.onFailed — evaluate-submission', () => {
  const job = (overrides = {}) =>
    fakeJob({
      name: 'evaluate-submission',
      data: { submissionId: 'sub-1', attempt: 2, userId: 'user-1' },
      ...overrides,
    });

  it('NO reembolsa si todavía quedan reintentos', async () => {
    const { processor, credits } = buildProcessor();

    await processor.onFailed(job({ attemptsMade: 1, attempts: 3 }), new Error('timeout'));

    expect(credits.grant).not.toHaveBeenCalled();
  });

  it('reembolsa con el refId del intento correcto y marca EVALUATION_FAILED', async () => {
    const { processor, credits, realtime, submissions } = buildProcessor();
    submissions.set('sub-1', { status: 'EVALUATING', techTest: { companyId: 'company-1' } });

    await processor.onFailed(job({ attemptsMade: 3, attempts: 3 }), new Error('salida de IA inválida'));

    expect(credits.grant).toHaveBeenCalledWith('user-1', 2, 'REFUND', 'sub-1#2');
    expect(submissions.get('sub-1')?.status).toBe('EVALUATION_FAILED');
    expect(realtime.emitToCompany).toHaveBeenCalledWith(
      'company-1',
      'evaluation.failed',
      expect.objectContaining({ submissionId: 'sub-1' }),
    );
  });

  it('NO reembolsa dos veces si la submission ya no está EVALUATING', async () => {
    const { processor, credits, submissions } = buildProcessor();
    submissions.set('sub-1', { status: 'EVALUATED', techTest: { companyId: 'company-1' } });

    await processor.onFailed(job({ attemptsMade: 3, attempts: 3 }), new Error('x'));

    expect(credits.grant).not.toHaveBeenCalled();
  });
});

describe('CompanyAiProcessor.onFailed — casos límite', () => {
  it('ignora job undefined', async () => {
    const { processor, credits } = buildProcessor();
    await processor.onFailed(undefined, new Error('x'));
    expect(credits.grant).not.toHaveBeenCalled();
  });
});
