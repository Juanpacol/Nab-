import { describe, expect, it, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { CompanyDashboardService } from './company-dashboard.service.js';

function createService(fake: { client: any }) {
  const credits = {
    consumeWithClient: vi.fn(async () => 0),
    assertBalance: vi.fn(async () => {}),
    consume: vi.fn(async () => 0),
    grant: vi.fn(async () => 0),
  } as any;
  const comparisonGeneration = {
    generate: vi.fn(async () => ({ byCriterion: [], tradeoffs: [], caveats: [], candidateLegend: [] })),
  } as any;
  return new CompanyDashboardService(fake.client, credits, comparisonGeneration);
}

function createServiceWithMocks(fake: { client: any }, credits: any, comparisonGeneration: any) {
  return new CompanyDashboardService(fake.client, credits, comparisonGeneration);
}

function createFakePrisma() {
  const jobs = new Map<string, any>();
  const applications = new Map<string, any>();
  const submissions = new Map<string, any>(); // key: jobId (1 por simplicidad en estos tests)
  const evaluations = new Map<string, any>(); // key: applicationId

  const client: any = {
    job: {
      count: vi.fn(async ({ where }: any) => {
        return [...jobs.values()].filter(
          (j) => j.companyId === where.companyId && (where.isActive === undefined || j.isActive === where.isActive),
        ).length;
      }),
      findFirst: vi.fn(async ({ where }: any) => {
        const j = jobs.get(where.id);
        return j && j.companyId === where.companyId ? j : null;
      }),
    },
    application: {
      count: vi.fn(async ({ where }: any) => {
        const companyId = where.job?.companyId;
        return [...applications.values()].filter((a) => {
          const job = jobs.get(a.jobId);
          return job?.companyId === companyId;
        }).length;
      }),
      groupBy: vi.fn(async ({ where }: any) => {
        const matches = [...applications.values()].filter((a) => a.jobId === where.jobId);
        const counts = new Map<string, number>();
        for (const a of matches) counts.set(a.status, (counts.get(a.status) ?? 0) + 1);
        return [...counts.entries()].map(([status, count]) => ({ status, _count: { _all: count } }));
      }),
      findMany: vi.fn(async ({ where }: any) => {
        if (where.id?.in) {
          const ids: string[] = where.id.in;
          return [...applications.values()].filter((a) => ids.includes(a.id) && a.jobId === where.jobId);
        }
        return [...applications.values()].filter(
          (a) => a.jobId === where.jobId && (!where.createdAt?.gte || a.createdAt >= where.createdAt.gte),
        );
      }),
    },
    testSubmission: {
      count: vi.fn(async ({ where }: any) => {
        if (where.techTest?.companyId) {
          return [...submissions.values()].filter((s) => {
            const job = jobs.get(s.jobId);
            return job?.companyId === where.techTest.companyId && s.status === where.status;
          }).length;
        }
        return [...submissions.values()].filter((s) => s.jobId === where.jobId && s.status === where.status).length;
      }),
      groupBy: vi.fn(async ({ where }: any) => {
        const matches = [...submissions.values()].filter((s) => s.jobId === where.jobId);
        const counts = new Map<string, number>();
        for (const s of matches) counts.set(s.status, (counts.get(s.status) ?? 0) + 1);
        return [...counts.entries()].map(([status, count]) => ({ status, _count: { _all: count } }));
      }),
    },
    candidateEvaluation: {
      count: vi.fn(async ({ where }: any) => {
        if (where.submission?.techTest?.companyId) {
          return [...evaluations.values()].filter((e) => {
            const app = applications.get(e.applicationId);
            const job = jobs.get(app?.jobId);
            return job?.companyId === where.submission.techTest.companyId && e.passed === where.passed;
          }).length;
        }
        return [...evaluations.values()].filter((e) => {
          const app = applications.get(e.applicationId);
          return app?.jobId === where.submission.jobId && e.passed === where.passed;
        }).length;
      }),
      findMany: vi.fn(async ({ where }: any) => {
        return [...evaluations.values()].filter((e) => {
          const app = applications.get(e.applicationId);
          return app?.jobId === where.submission.jobId && e.finalScore != null;
        });
      }),
    },
  };
  client.$transaction = vi.fn((cb: any) => cb(client));

  return { client, jobs, applications, submissions, evaluations };
}

describe('CompanyDashboardService.companyMetrics', () => {
  it('agrega vacantes activas/totales, aplicantes y pass rate de toda la empresa', async () => {
    const fake = createFakePrisma();
    fake.jobs.set('job-1', { id: 'job-1', companyId: 'company-1', isActive: true });
    fake.jobs.set('job-2', { id: 'job-2', companyId: 'company-1', isActive: false });
    fake.applications.set('app-1', { id: 'app-1', jobId: 'job-1', status: 'APPLIED' });
    fake.applications.set('app-2', { id: 'app-2', jobId: 'job-1', status: 'APPLIED' });
    fake.submissions.set('sub-1', { id: 'sub-1', jobId: 'job-1', status: 'EVALUATED' });
    fake.applications.set('app-1', { id: 'app-1', jobId: 'job-1', status: 'APPLIED' });
    fake.evaluations.set('eval-1', { applicationId: 'app-1', passed: true });
    const service = createService(fake);

    const metrics = await service.companyMetrics('company-1');

    expect(metrics.activeJobs).toBe(1);
    expect(metrics.totalJobs).toBe(2);
    expect(metrics.totalApplicants).toBe(2);
    expect(metrics.evaluatedCount).toBe(1);
    expect(metrics.passRate).toBe(100);
  });

  it('passRate es null (no 0/0) cuando nadie ha sido evaluado todavía', async () => {
    const fake = createFakePrisma();
    fake.jobs.set('job-1', { id: 'job-1', companyId: 'company-1', isActive: true });
    const service = createService(fake);

    const metrics = await service.companyMetrics('company-1');

    expect(metrics.passRate).toBeNull();
  });
});

describe('CompanyDashboardService.jobMetrics', () => {
  it('arma el funnel de aplicantes y el estado de las pruebas', async () => {
    const fake = createFakePrisma();
    fake.jobs.set('job-1', { id: 'job-1', companyId: 'company-1' });
    fake.applications.set('app-1', { id: 'app-1', jobId: 'job-1', status: 'APPLIED' });
    fake.applications.set('app-2', { id: 'app-2', jobId: 'job-1', status: 'INTERVIEW' });
    fake.submissions.set('sub-1', { id: 'sub-1', jobId: 'job-1', status: 'SUBMITTED' });
    const service = createService(fake);

    const metrics = await service.jobMetrics('company-1', 'job-1');

    expect(metrics.totalApplicants).toBe(2);
    expect(metrics.byStatus).toEqual({ APPLIED: 1, INTERVIEW: 1 });
    expect(metrics.testFunnel).toEqual({ SUBMITTED: 1 });
  });

  it('lanza NotFoundException si la vacante pertenece a OTRA empresa (IDOR)', async () => {
    const fake = createFakePrisma();
    fake.jobs.set('job-1', { id: 'job-1', companyId: 'otra-empresa' });
    const service = createService(fake);

    await expect(service.jobMetrics('company-1', 'job-1')).rejects.toThrow(NotFoundException);
  });
});

describe('CompanyDashboardService.compareCandidates', () => {
  it('devuelve los candidatos con su evaluación cuando todos pertenecen a la vacante', async () => {
    const fake = createFakePrisma();
    fake.jobs.set('job-1', { id: 'job-1', companyId: 'company-1' });
    fake.applications.set('app-1', { id: 'app-1', jobId: 'job-1', user: { id: 'u1' }, testSubmission: null });
    fake.applications.set('app-2', { id: 'app-2', jobId: 'job-1', user: { id: 'u2' }, testSubmission: null });
    const service = createService(fake);

    const result = await service.compareCandidates('company-1', 'job-1', ['app-1', 'app-2']);

    expect(result.candidates).toHaveLength(2);
  });

  it('rechaza si alguna aplicación pertenece a OTRA vacante (IDOR)', async () => {
    const fake = createFakePrisma();
    fake.jobs.set('job-1', { id: 'job-1', companyId: 'company-1' });
    fake.applications.set('app-1', { id: 'app-1', jobId: 'job-1' });
    fake.applications.set('app-2', { id: 'app-2', jobId: 'OTRA-VACANTE' });
    const service = createService(fake);

    await expect(service.compareCandidates('company-1', 'job-1', ['app-1', 'app-2'])).rejects.toThrow(
      NotFoundException,
    );
  });

  it('lanza NotFoundException si la vacante pertenece a OTRA empresa (IDOR)', async () => {
    const fake = createFakePrisma();
    fake.jobs.set('job-1', { id: 'job-1', companyId: 'otra-empresa' });
    const service = createService(fake);

    await expect(service.compareCandidates('company-1', 'job-1', ['app-1', 'app-2'])).rejects.toThrow(
      NotFoundException,
    );
  });

  it('rechaza (fail-closed) si un id de aplicación se repite en vez de aportar un candidato distinto', async () => {
    const fake = createFakePrisma();
    fake.jobs.set('job-1', { id: 'job-1', companyId: 'company-1' });
    fake.applications.set('app-1', { id: 'app-1', jobId: 'job-1' });
    const service = createService(fake);

    // La DB matchea 'app-1' una sola vez sin importar cuántas veces se repita
    // en el IN — el mismatch de longitud (1 fila vs 2 ids pedidos) rechaza en
    // vez de devolver un candidato "duplicado" silenciosamente.
    await expect(service.compareCandidates('company-1', 'job-1', ['app-1', 'app-1'])).rejects.toThrow(
      NotFoundException,
    );
  });
});

describe('CompanyDashboardService.applicantsTrend', () => {
  it('devuelve 30 puntos (uno por día) con conteos en 0 donde no hubo aplicantes', async () => {
    const fake = createFakePrisma();
    fake.jobs.set('job-1', { id: 'job-1', companyId: 'company-1' });
    const today = new Date().toISOString().slice(0, 10);
    fake.applications.set('app-1', { id: 'app-1', jobId: 'job-1', createdAt: new Date(`${today}T10:00:00Z`) });
    const service = createService(fake);

    const trend = await service.applicantsTrend('company-1', 'job-1');

    expect(trend.points).toHaveLength(30);
    expect(trend.points.at(-1)?.date).toBe(today);
    expect(trend.points.at(-1)?.count).toBe(1);
    expect(trend.points[0]?.count).toBe(0);
  });

  it('lanza NotFoundException si la vacante pertenece a OTRA empresa (IDOR)', async () => {
    const fake = createFakePrisma();
    fake.jobs.set('job-1', { id: 'job-1', companyId: 'otra-empresa' });
    const service = createService(fake);

    await expect(service.applicantsTrend('company-1', 'job-1')).rejects.toThrow(NotFoundException);
  });
});

describe('CompanyDashboardService.scoreDistribution', () => {
  it('agrupa los finalScore en bins de 10 puntos y expone el passScore vigente', async () => {
    const fake = createFakePrisma();
    fake.jobs.set('job-1', { id: 'job-1', companyId: 'company-1', techTest: { passScore: 60 } });
    fake.applications.set('app-1', { id: 'app-1', jobId: 'job-1' });
    fake.applications.set('app-2', { id: 'app-2', jobId: 'job-1' });
    fake.evaluations.set('eval-1', { applicationId: 'app-1', finalScore: 45 });
    fake.evaluations.set('eval-2', { applicationId: 'app-2', finalScore: 72 });
    const service = createService(fake);

    const dist = await service.scoreDistribution('company-1', 'job-1');

    expect(dist.passScore).toBe(60);
    expect(dist.bins).toHaveLength(10);
    expect(dist.bins.find((b) => b.binStart === 40)?.count).toBe(1);
    expect(dist.bins.find((b) => b.binStart === 70)?.count).toBe(1);
  });

  it('lanza NotFoundException si la vacante pertenece a OTRA empresa (IDOR)', async () => {
    const fake = createFakePrisma();
    fake.jobs.set('job-1', { id: 'job-1', companyId: 'otra-empresa' });
    const service = createService(fake);

    await expect(service.scoreDistribution('company-1', 'job-1')).rejects.toThrow(NotFoundException);
  });
});

describe('CompanyDashboardService.generateComparisonAnalysis', () => {
  function setupEvaluatedCandidates(fake: ReturnType<typeof createFakePrisma>, overrides: Partial<{ injectionSuspected: boolean }> = {}) {
    fake.jobs.set('job-1', {
      id: 'job-1',
      companyId: 'company-1',
      techTest: { rubricJson: { criteria: [{ id: 'c1', name: 'Fundamentos' }], passThreshold: 60 } },
    });
    fake.applications.set('app-1', {
      id: 'app-1',
      jobId: 'job-1',
      testSubmission: {
        evaluation: {
          aiScoresJson: [{ criterionId: 'c1', score: 5 }],
          overrideScoresJson: null,
          aiSummary: 'Resumen A',
          injectionSuspected: overrides.injectionSuspected ?? false,
        },
      },
    });
    fake.applications.set('app-2', {
      id: 'app-2',
      jobId: 'job-1',
      testSubmission: {
        evaluation: {
          aiScoresJson: [{ criterionId: 'c1', score: 3 }],
          overrideScoresJson: null,
          aiSummary: 'Resumen B',
          injectionSuspected: false,
        },
      },
    });
  }

  it('valida saldo, llama al generador, y cobra DESPUÉS del resultado (nunca antes)', async () => {
    const fake = createFakePrisma();
    setupEvaluatedCandidates(fake);
    const callOrder: string[] = [];
    const credits = {
      assertBalance: vi.fn(async () => {
        callOrder.push('assertBalance');
      }),
      consume: vi.fn(async () => {
        callOrder.push('consume');
        return 0;
      }),
      grant: vi.fn(async () => 0),
    };
    const comparisonGeneration = {
      generate: vi.fn(async (..._args: unknown[]) => {
        callOrder.push('generate');
        return { byCriterion: [], tradeoffs: [], caveats: [], candidateLegend: [] };
      }),
    };
    const service = createServiceWithMocks(fake, credits, comparisonGeneration);

    await service.generateComparisonAnalysis('company-1', 'job-1', ['app-1', 'app-2'], 'user-1', 'idem-key-1');

    expect(callOrder).toEqual(['assertBalance', 'generate', 'consume']);
    expect(credits.consume).toHaveBeenCalledWith('user-1', 1, 'COMPARISON', 'compare:idem-key-1');
    expect(comparisonGeneration.generate).toHaveBeenCalledTimes(1);
    const [criteria, candidates] = comparisonGeneration.generate.mock.calls[0]!;
    expect(criteria).toEqual([{ id: 'c1', name: 'Fundamentos' }]);
    expect(candidates).toEqual([
      { candidateRef: 'A', applicationId: 'app-1', perCriterionScores: [{ criterionId: 'c1', score: 5 }], summary: 'Resumen A' },
      { candidateRef: 'B', applicationId: 'app-2', perCriterionScores: [{ criterionId: 'c1', score: 3 }], summary: 'Resumen B' },
    ]);
    expect(credits.grant).not.toHaveBeenCalled();
  });

  it('NO cobra si la generación con IA falla (el cobro va después, no antes-con-reembolso)', async () => {
    const fake = createFakePrisma();
    setupEvaluatedCandidates(fake);
    const credits = {
      assertBalance: vi.fn(async () => {}),
      consume: vi.fn(async () => 0),
      grant: vi.fn(async () => 0),
    };
    const comparisonGeneration = { generate: vi.fn(async () => { throw new Error('la IA falló'); }) };
    const service = createServiceWithMocks(fake, credits, comparisonGeneration);

    await expect(
      service.generateComparisonAnalysis('company-1', 'job-1', ['app-1', 'app-2'], 'user-1', 'idem-key-1'),
    ).rejects.toThrow('la IA falló');

    expect(credits.consume).not.toHaveBeenCalled();
    expect(credits.grant).not.toHaveBeenCalled();
  });

  it('rechaza (sin validar saldo ni cobrar) si algún candidato aún no tiene evaluación', async () => {
    const fake = createFakePrisma();
    setupEvaluatedCandidates(fake);
    fake.applications.set('app-2', { id: 'app-2', jobId: 'job-1', testSubmission: { evaluation: null } });
    const credits = { assertBalance: vi.fn(async () => {}), consume: vi.fn(async () => 0), grant: vi.fn(async () => 0) };
    const comparisonGeneration = { generate: vi.fn() };
    const service = createServiceWithMocks(fake, credits, comparisonGeneration);

    await expect(
      service.generateComparisonAnalysis('company-1', 'job-1', ['app-1', 'app-2'], 'user-1', 'idem-key-1'),
    ).rejects.toThrow(/evaluación completada/);
    expect(credits.assertBalance).not.toHaveBeenCalled();
    expect(credits.consume).not.toHaveBeenCalled();
  });

  it('rechaza (sin validar saldo ni cobrar) si alguna evaluación está marcada como sospechosa de inyección', async () => {
    const fake = createFakePrisma();
    setupEvaluatedCandidates(fake, { injectionSuspected: true });
    const credits = { assertBalance: vi.fn(async () => {}), consume: vi.fn(async () => 0), grant: vi.fn(async () => 0) };
    const comparisonGeneration = { generate: vi.fn() };
    const service = createServiceWithMocks(fake, credits, comparisonGeneration);

    await expect(
      service.generateComparisonAnalysis('company-1', 'job-1', ['app-1', 'app-2'], 'user-1', 'idem-key-1'),
    ).rejects.toThrow(/sospechosas de manipulación/);
    expect(credits.assertBalance).not.toHaveBeenCalled();
    expect(credits.consume).not.toHaveBeenCalled();
  });

  it('lanza NotFoundException si la vacante pertenece a OTRA empresa (IDOR)', async () => {
    const fake = createFakePrisma();
    fake.jobs.set('job-1', { id: 'job-1', companyId: 'otra-empresa' });
    const service = createService(fake);

    await expect(
      service.generateComparisonAnalysis('company-1', 'job-1', ['app-1', 'app-2'], 'user-1', 'idem-key-1'),
    ).rejects.toThrow(NotFoundException);
  });

  it('rechaza si la vacante no tiene prueba técnica adjunta', async () => {
    const fake = createFakePrisma();
    fake.jobs.set('job-1', { id: 'job-1', companyId: 'company-1', techTest: null });
    const service = createService(fake);

    await expect(
      service.generateComparisonAnalysis('company-1', 'job-1', ['app-1', 'app-2'], 'user-1', 'idem-key-1'),
    ).rejects.toThrow(/prueba técnica/);
  });
});
