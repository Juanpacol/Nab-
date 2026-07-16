import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CREDIT_COSTS, type CriterionEvaluation, type Rubric } from '@nab/shared';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CreditsService } from '../billing/credits.service.js';
import { ComparisonGenerationService, type ComparisonCandidateInput } from './comparison-generation.service.js';

const CANDIDATE_REFS = ['A', 'B', 'C', 'D'] as const;

@Injectable()
export class CompanyDashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly credits: CreditsService,
    private readonly comparisonGeneration: ComparisonGenerationService,
  ) {}

  /**
   * Overview de toda la empresa. On-demand con Prisma count/groupBy — sin
   * materializar (ver plan: revisar solo si una empresa supera ~50k
   * aplicantes, los índices existentes lo resuelven en sub-10ms hoy).
   */
  async companyMetrics(companyId: string) {
    const [activeJobs, totalJobs, totalApplicants, evaluatedCount, passedCount] = await Promise.all([
      this.prisma.job.count({ where: { companyId, isActive: true } }),
      this.prisma.job.count({ where: { companyId } }),
      this.prisma.application.count({ where: { job: { companyId } } }),
      this.prisma.testSubmission.count({ where: { techTest: { companyId }, status: 'EVALUATED' } }),
      this.prisma.candidateEvaluation.count({ where: { submission: { techTest: { companyId } }, passed: true } }),
    ]);

    return {
      activeJobs,
      totalJobs,
      totalApplicants,
      evaluatedCount,
      passRate: evaluatedCount > 0 ? Math.round((passedCount / evaluatedCount) * 100) : null,
    };
  }

  /** Funnel de aplicantes + estado de pruebas + pass-rate de una vacante. */
  async jobMetrics(companyId: string, jobId: string) {
    const job = await this.prisma.job.findFirst({ where: { id: jobId, companyId }, select: { id: true } });
    if (!job) throw new NotFoundException('Vacante no encontrada');

    const [applicationsByStatus, submissionsByStatus, evaluatedCount, passedCount] = await Promise.all([
      this.prisma.application.groupBy({ by: ['status'], where: { jobId }, _count: { _all: true } }),
      this.prisma.testSubmission.groupBy({ by: ['status'], where: { jobId }, _count: { _all: true } }),
      this.prisma.testSubmission.count({ where: { jobId, status: 'EVALUATED' } }),
      this.prisma.candidateEvaluation.count({ where: { submission: { jobId }, passed: true } }),
    ]);

    const byStatus: Record<string, number> = {};
    for (const g of applicationsByStatus) byStatus[g.status] = g._count._all;
    const testFunnel: Record<string, number> = {};
    for (const g of submissionsByStatus) testFunnel[g.status] = g._count._all;

    const totalApplicants = Object.values(byStatus).reduce((sum, n) => sum + n, 0);

    return {
      jobId,
      totalApplicants,
      byStatus,
      testFunnel,
      evaluatedCount,
      passRate: evaluatedCount > 0 ? Math.round((passedCount / evaluatedCount) * 100) : null,
    };
  }

  /**
   * Comparativa "solo datos" (sin llamada IA — eso queda como botón
   * adicional fuera de v1): matriz criterio×candidato desde lo ya
   * persistido. Anti-IDOR: exige que TODAS las applicationIds pertenezcan a
   * la MISMA vacante (y por tanto a esta empresa) — si alguna no matchea,
   * `applications.length` queda corto y se rechaza la comparación entera en
   * vez de devolver un subconjunto silencioso que podría confundirse con
   * "todos los candidatos pedidos".
   */
  async compareCandidates(companyId: string, jobId: string, applicationIds: string[]) {
    const job = await this.prisma.job.findFirst({ where: { id: jobId, companyId }, select: { id: true } });
    if (!job) throw new NotFoundException('Vacante no encontrada');

    const applications = await this.prisma.application.findMany({
      where: { id: { in: applicationIds }, jobId },
      select: {
        id: true,
        user: { select: { id: true, name: true, email: true, avatarUrl: true } },
        testSubmission: {
          select: {
            status: true,
            evaluation: {
              select: {
                aiScoresJson: true,
                aiSummary: true,
                aiStrengths: true,
                aiWeaknesses: true,
                aiHighlights: true,
                finalScore: true,
                passed: true,
                overriddenAt: true,
              },
            },
          },
        },
      },
    });

    if (applications.length !== applicationIds.length) {
      throw new NotFoundException('Alguna aplicación seleccionada no pertenece a esta vacante');
    }

    return { jobId, candidates: applications };
  }

  /**
   * Serie diaria de aplicantes (últimos 30 días). Volumen esperado por
   * vacante es bajo (decenas/cientos) — se trae todo y se agrupa por día en
   * JS en vez de `date_trunc` en SQL, igual que el resto del módulo evita
   * materializar vistas hasta que el volumen lo justifique.
   */
  async applicantsTrend(companyId: string, jobId: string) {
    const job = await this.prisma.job.findFirst({ where: { id: jobId, companyId }, select: { id: true } });
    if (!job) throw new NotFoundException('Vacante no encontrada');

    const since = new Date();
    since.setDate(since.getDate() - 30);
    const applications = await this.prisma.application.findMany({
      where: { jobId, createdAt: { gte: since } },
      select: { createdAt: true },
    });

    const byDay = new Map<string, number>();
    for (const a of applications) {
      const day = a.createdAt.toISOString().slice(0, 10);
      byDay.set(day, (byDay.get(day) ?? 0) + 1);
    }

    const points: { date: string; count: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const day = d.toISOString().slice(0, 10);
      points.push({ date: day, count: byDay.get(day) ?? 0 });
    }

    return { jobId, points };
  }

  /**
   * Distribución de scores finales de evaluación en bins de 10 puntos
   * (0-9 ... 90-100), más el `passScore` vigente de la prueba adjunta para
   * que el frontend dibuje la línea de referencia de aprobación.
   */
  async scoreDistribution(companyId: string, jobId: string) {
    const job = await this.prisma.job.findFirst({
      where: { id: jobId, companyId },
      select: { id: true, techTest: { select: { passScore: true } } },
    });
    if (!job) throw new NotFoundException('Vacante no encontrada');

    const evaluations = await this.prisma.candidateEvaluation.findMany({
      where: { submission: { jobId }, finalScore: { not: null } },
      select: { finalScore: true },
    });

    const bins = Array.from({ length: 10 }, (_, i) => ({ binStart: i * 10, count: 0 }));
    for (const e of evaluations) {
      const score = Math.max(0, Math.min(100, e.finalScore ?? 0));
      const binIndex = Math.min(9, Math.floor(score / 10));
      bins[binIndex]!.count += 1;
    }

    return { jobId, passScore: job.techTest?.passScore ?? null, bins };
  }

  /**
   * Análisis comparativo con IA (botón "Generar análisis IA" sobre la
   * comparativa de datos). No hay un recurso persistido de "comparación" con
   * su propio id (es efímera, nunca se guarda) — mismo patrón que
   * GenerationService.generateAndSaveResume: `assertBalance` (chequeo barato,
   * no autoritativo) → llamar a la IA → cobrar recién con el resultado en
   * mano. Así se evita la ventana de "crédito cobrado pero el proceso murió
   * antes del try/catch de reembolso" que tendría cobrar-antes-y-reembolsar.
   * `idempotencyKey` la genera el cliente una vez por click explícito (no en
   * reintentos automáticos) y se usa como refId — sin ella, un doble-submit
   * o un retry de red cobraría dos veces por el mismo click percibido (no
   * hay un id de recurso persistido del que colgar la idempotencia, a
   * diferencia de generar-prueba/evaluar).
   */
  async generateComparisonAnalysis(
    companyId: string,
    jobId: string,
    applicationIds: string[],
    userId: string,
    idempotencyKey: string,
  ) {
    const job = await this.prisma.job.findFirst({
      where: { id: jobId, companyId },
      select: { techTest: { select: { rubricJson: true } } },
    });
    if (!job) throw new NotFoundException('Vacante no encontrada');
    if (!job.techTest) throw new BadRequestException('Esta vacante no tiene una prueba técnica adjunta');
    const rubric = job.techTest.rubricJson as Rubric;

    const applications = await this.prisma.application.findMany({
      where: { id: { in: applicationIds }, jobId },
      select: {
        id: true,
        testSubmission: {
          select: {
            evaluation: {
              select: { aiScoresJson: true, overrideScoresJson: true, aiSummary: true, injectionSuspected: true },
            },
          },
        },
      },
      orderBy: { id: 'asc' },
    });
    if (applications.length !== applicationIds.length) {
      throw new NotFoundException('Alguna aplicación seleccionada no pertenece a esta vacante');
    }

    const missingEvaluation = applications.some((a) => !a.testSubmission?.evaluation);
    if (missingEvaluation) {
      throw new BadRequestException('Todos los candidatos seleccionados deben tener una evaluación completada');
    }
    const flagged = applications.some((a) => a.testSubmission!.evaluation!.injectionSuspected);
    if (flagged) {
      throw new BadRequestException(
        'Una o más evaluaciones seleccionadas están marcadas como sospechosas de manipulación — revísalas individualmente antes de comparar',
      );
    }

    const candidates: ComparisonCandidateInput[] = applications.map((a, i) => {
      const evaluation = a.testSubmission!.evaluation!;
      const aiScores = (evaluation.aiScoresJson as CriterionEvaluation[] | null) ?? [];
      const overrideScores = (evaluation.overrideScoresJson as { criterionId: string; score: number }[] | null) ?? [];
      const overrideById = new Map(overrideScores.map((s) => [s.criterionId, s.score]));
      return {
        candidateRef: CANDIDATE_REFS[i]!,
        applicationId: a.id,
        perCriterionScores: aiScores.map((s) => ({
          criterionId: s.criterionId,
          score: overrideById.get(s.criterionId) ?? s.score,
        })),
        summary: evaluation.aiSummary,
      };
    });

    await this.credits.assertBalance(userId, CREDIT_COSTS.COMPARISON);

    const result = await this.comparisonGeneration.generate(rubric.criteria, candidates);

    await this.credits.consume(userId, CREDIT_COSTS.COMPARISON, 'COMPARISON', `compare:${idempotencyKey}`);
    return result;
  }
}
