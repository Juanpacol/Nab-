import { describe, expect, it, vi } from 'vitest';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { CreditsService } from '../billing/credits.service.js';
import { EvaluationsService } from './evaluations.service.js';

function createFakePrisma() {
  const submissions = new Map<string, any>();
  const evaluations = new Map<string, any>(); // key: submissionId
  const techTests = new Map<string, any>();
  const users = new Map<string, { id: string; creditsRemaining: number }>();
  const ledger: { userId: string; delta: number; reason: string; refId: string | null }[] = [];

  const client: any = {
    testSubmission: {
      findFirst: vi.fn(async ({ where }: any) => {
        const s = submissions.get(where.id);
        if (!s) return null;
        if (where.techTest?.companyId && s.companyId !== where.techTest.companyId) return null;
        return s;
      }),
      updateMany: vi.fn(async ({ where, data }: any) => {
        const s = submissions.get(where.id);
        if (!s) return { count: 0 };
        if (where.status?.in && !where.status.in.includes(s.status)) return { count: 0 };
        Object.assign(s, data);
        return { count: 1 };
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const s = submissions.get(where.id);
        Object.assign(s, data);
        return s;
      }),
    },
    candidateEvaluation: {
      findFirst: vi.fn(async ({ where }: any) => {
        const e = evaluations.get(where.id) ?? [...evaluations.values()].find((x) => x.id === where.id);
        if (!e) return null;
        const submission = submissions.get(e.submissionId);
        const techTest = techTests.get(submission.techTestId);
        if (where.submission?.techTest?.companyId && techTest.companyId !== where.submission.techTest.companyId) {
          return null;
        }
        return { id: e.id, submission: { techTest: { rubricJson: techTest.rubricJson } } };
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const e = evaluations.get(where.id) ?? [...evaluations.values()].find((x) => x.id === where.id);
        Object.assign(e, data);
        return e;
      }),
    },
    user: {
      findUnique: vi.fn(async ({ where }: any) => users.get(where.id) ?? null),
      findUniqueOrThrow: vi.fn(async ({ where }: any) => {
        const u = users.get(where.id);
        if (!u) throw new Error('not found');
        return u;
      }),
      updateMany: vi.fn(async ({ where, data }: any) => {
        const u = users.get(where.id);
        if (!u) return { count: 0 };
        if (where.creditsRemaining?.gte != null && u.creditsRemaining < where.creditsRemaining.gte) return { count: 0 };
        if (data.creditsRemaining.decrement != null) u.creditsRemaining -= data.creditsRemaining.decrement;
        return { count: 1 };
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const u = users.get(where.id)!;
        if (data.creditsRemaining.increment != null) u.creditsRemaining += data.creditsRemaining.increment;
        return { creditsRemaining: u.creditsRemaining };
      }),
    },
    creditLedger: {
      create: vi.fn(async ({ data }: any) => {
        ledger.push(data);
        return data;
      }),
    },
    $transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) => {
      const snapshot = {
        submissions: new Map([...submissions].map(([k, v]) => [k, { ...v }])),
        users: new Map([...users].map(([k, v]) => [k, { ...v }])),
      };
      try {
        return await callback(client);
      } catch (err) {
        submissions.clear();
        for (const [k, v] of snapshot.submissions) submissions.set(k, v);
        users.clear();
        for (const [k, v] of snapshot.users) users.set(k, v);
        throw err;
      }
    }),
  };

  return { client, submissions, evaluations, techTests, users, ledger };
}

function buildService(fake: ReturnType<typeof createFakePrisma>) {
  const credits = new CreditsService(fake.client);
  const queue = { add: vi.fn().mockResolvedValue(undefined) };
  const service = new EvaluationsService(fake.client, credits, queue as any);
  return { service, queue };
}

const companyId = 'company-1';

describe('EvaluationsService.evaluate', () => {
  it('cobra el crédito y transiciona a EVALUATING en la misma transacción, luego encola', async () => {
    const fake = createFakePrisma();
    fake.submissions.set('sub-1', { id: 'sub-1', companyId, status: 'SUBMITTED', evaluationAttempt: 0 });
    fake.users.set('user-1', { id: 'user-1', creditsRemaining: 10 });
    const { service, queue } = buildService(fake);

    const result = await service.evaluate(companyId, 'sub-1', 'user-1');

    expect(result.status).toBe('EVALUATING');
    expect(result.attempt).toBe(1);
    expect(fake.submissions.get('sub-1')?.status).toBe('EVALUATING');
    expect(fake.users.get('user-1')?.creditsRemaining).toBe(8);
    expect(fake.ledger).toEqual([
      expect.objectContaining({ userId: 'user-1', delta: -2, reason: 'EVALUATION', refId: 'sub-1#1' }),
    ]);
    expect(queue.add).toHaveBeenCalledWith(
      'evaluate-submission',
      { submissionId: 'sub-1', attempt: 1, userId: 'user-1' },
      { jobId: 'eval-sub-1-1' },
    );
  });

  it('doble evaluate (ya EVALUATING) → 409, sin cobrar de más', async () => {
    const fake = createFakePrisma();
    fake.submissions.set('sub-1', { id: 'sub-1', companyId, status: 'SUBMITTED', evaluationAttempt: 0 });
    fake.users.set('user-1', { id: 'user-1', creditsRemaining: 10 });
    const { service } = buildService(fake);

    await service.evaluate(companyId, 'sub-1', 'user-1');
    await expect(service.evaluate(companyId, 'sub-1', 'user-1')).rejects.toThrow(ConflictException);

    // Solo se cobró una vez (el primer evaluate).
    expect(fake.users.get('user-1')?.creditsRemaining).toBe(8);
    expect(fake.ledger).toHaveLength(1);
  });

  it('evaluar una submission ya EVALUATED → 409, sin cobrar', async () => {
    const fake = createFakePrisma();
    fake.submissions.set('sub-1', { id: 'sub-1', companyId, status: 'EVALUATED', evaluationAttempt: 1 });
    fake.users.set('user-1', { id: 'user-1', creditsRemaining: 10 });
    const { service } = buildService(fake);

    await expect(service.evaluate(companyId, 'sub-1', 'user-1')).rejects.toThrow(ConflictException);
    expect(fake.users.get('user-1')?.creditsRemaining).toBe(10);
  });

  it('reintentar tras EVALUATION_FAILED SÍ permite evaluar de nuevo, con refId de intento nuevo', async () => {
    const fake = createFakePrisma();
    fake.submissions.set('sub-1', { id: 'sub-1', companyId, status: 'EVALUATION_FAILED', evaluationAttempt: 1 });
    fake.users.set('user-1', { id: 'user-1', creditsRemaining: 10 });
    const { service } = buildService(fake);

    const result = await service.evaluate(companyId, 'sub-1', 'user-1');

    expect(result.attempt).toBe(2);
    expect(fake.ledger[0]?.refId).toBe('sub-1#2');
  });

  it('lanza NotFoundException si la submission pertenece a OTRA empresa (IDOR)', async () => {
    const fake = createFakePrisma();
    fake.submissions.set('sub-1', { id: 'sub-1', companyId: 'otra-empresa', status: 'SUBMITTED', evaluationAttempt: 0 });
    fake.users.set('user-1', { id: 'user-1', creditsRemaining: 10 });
    const { service } = buildService(fake);

    await expect(service.evaluate(companyId, 'sub-1', 'user-1')).rejects.toThrow(NotFoundException);
  });
});

describe('EvaluationsService.override', () => {
  it('escribe SOLO campos override* y recalcula finalScore/passed — nunca toca aiXxx', async () => {
    const fake = createFakePrisma();
    fake.techTests.set('test-1', { companyId, rubricJson: { passThreshold: 70 } });
    fake.submissions.set('sub-1', { id: 'sub-1', companyId, techTestId: 'test-1', status: 'EVALUATED' });
    fake.evaluations.set('sub-1', {
      id: 'eval-1',
      submissionId: 'sub-1',
      aiTotalScore: 50,
      aiSummary: 'Resumen original de la IA',
      finalScore: 50,
      passed: false,
    });
    const { service } = buildService(fake);

    const updated = await service.override(companyId, 'eval-1', 'rh-user-1', { totalScore: 80, notes: 'Ajustado tras revisión manual.' });

    expect(updated.overrideTotalScore).toBe(80);
    expect(updated.overrideNotes).toBe('Ajustado tras revisión manual.');
    expect(updated.finalScore).toBe(80);
    expect(updated.passed).toBe(true); // 80 >= passThreshold(70)
    expect(updated.overriddenByUserId).toBe('rh-user-1');
    // Los campos de la IA quedan intactos.
    expect(updated.aiTotalScore).toBe(50);
    expect(updated.aiSummary).toBe('Resumen original de la IA');
  });

  it('lanza NotFoundException si la evaluación pertenece a OTRA empresa (IDOR)', async () => {
    const fake = createFakePrisma();
    fake.techTests.set('test-1', { companyId: 'otra-empresa', rubricJson: { passThreshold: 60 } });
    fake.submissions.set('sub-1', { id: 'sub-1', companyId: 'otra-empresa', techTestId: 'test-1', status: 'EVALUATED' });
    fake.evaluations.set('sub-1', { id: 'eval-1', submissionId: 'sub-1', finalScore: 50, passed: false });
    const { service } = buildService(fake);

    await expect(service.override(companyId, 'eval-1', 'rh-user-1', { totalScore: 80 })).rejects.toThrow(
      NotFoundException,
    );
  });
});
