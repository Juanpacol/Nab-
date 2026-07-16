import { Logger } from '@nestjs/common';
import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { CREDIT_COSTS, QUEUE_NAMES } from '@nab/shared';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CreditsService } from '../billing/credits.service.js';
import { RealtimeGateway } from '../realtime/realtime.gateway.js';
import { TechTestGenerationService } from './tech-test-generation.service.js';
import { EvaluationGenerationService } from './evaluation-generation.service.js';

interface GenerateTestJobData {
  testId: string;
}

interface EvaluateSubmissionJobData {
  submissionId: string;
  attempt: number;
  userId: string;
}

/**
 * Consume la cola `company-ai` (patrón AUTO_APPLY: la consume la API, no
 * workers, porque necesita CreditsService + RealtimeGateway). Concurrency
 * baja: cada job es una llamada IA de 30-90s, no queremos ahogar la API.
 * Dos tipos de job: `generate-test` (pruebas técnicas) y
 * `evaluate-submission` (evaluación de respuestas del candidato).
 *
 * Reintentos: BullMQ reintenta automáticamente si `process()` lanza (hasta
 * `defaultJobOptions.attempts`, heredado del registro global de la cola).
 * El reembolso + estado FAILED SOLO ocurre en `@OnWorkerEvent('failed')`
 * cuando `attemptsMade` ya agotó los intentos — un fallo transitorio a
 * mitad de los reintentos no debe cobrar/reembolsar de más.
 */
@Processor(QUEUE_NAMES.COMPANY_AI, { concurrency: 2 })
export class CompanyAiProcessor extends WorkerHost {
  private readonly logger = new Logger(CompanyAiProcessor.name);

  constructor(
    private readonly generation: TechTestGenerationService,
    private readonly evaluationGeneration: EvaluationGenerationService,
    private readonly credits: CreditsService,
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeGateway,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    if (job.name === 'generate-test') {
      await this.processGenerateTest(job as Job<GenerateTestJobData>);
    } else if (job.name === 'evaluate-submission') {
      await this.processEvaluateSubmission(job as Job<EvaluateSubmissionJobData>);
    }
  }

  private async processGenerateTest(job: Job<GenerateTestJobData>): Promise<void> {
    const { testId } = job.data;
    await this.generation.generate(testId);

    const test = await this.prisma.techTest.findUniqueOrThrow({
      where: { id: testId },
      select: { companyId: true },
    });
    this.realtime.emitToCompany(test.companyId, 'test.ready', { testId });
  }

  private async processEvaluateSubmission(job: Job<EvaluateSubmissionJobData>): Promise<void> {
    const { submissionId } = job.data;
    await this.evaluationGeneration.evaluate(submissionId);

    const submission = await this.prisma.testSubmission.findUniqueOrThrow({
      where: { id: submissionId },
      select: { applicationId: true, techTest: { select: { companyId: true } } },
    });
    this.realtime.emitToCompany(submission.techTest.companyId, 'submission.evaluated', {
      submissionId,
      applicationId: submission.applicationId,
    });
  }

  /**
   * `failed` se dispara en CADA intento fallido, no solo en el último — de
   * ahí el chequeo de `attemptsMade` contra el máximo antes de dar por
   * perdido el trabajo.
   */
  @OnWorkerEvent('failed')
  async onFailed(job: Job<GenerateTestJobData | EvaluateSubmissionJobData> | undefined, err: Error): Promise<void> {
    if (!job) return;
    if (job.name === 'generate-test') {
      await this.onGenerateTestFailed(job as Job<GenerateTestJobData>, err);
    } else if (job.name === 'evaluate-submission') {
      await this.onEvaluateSubmissionFailed(job as Job<EvaluateSubmissionJobData>, err);
    }
  }

  private async onGenerateTestFailed(job: Job<GenerateTestJobData>, err: Error): Promise<void> {
    const maxAttempts = job.opts.attempts ?? 1;
    if (job.attemptsMade < maxAttempts) {
      this.logger.warn(`Intento ${job.attemptsMade}/${maxAttempts} falló para test ${job.data.testId}, reintentando`);
      return;
    }

    const { testId } = job.data;
    const test = await this.prisma.techTest.findUnique({
      where: { id: testId },
      select: { companyId: true, createdByUserId: true, status: true },
    });
    // Si ya no está GENERATING, otro worker/reintento ya resolvió este job
    // (éxito o fallo) — no dupliques el reembolso.
    if (!test || test.status !== 'GENERATING') return;

    await this.prisma.techTest.update({
      where: { id: testId },
      data: { status: 'FAILED', generationError: err.message.slice(0, 2000) },
    });
    await this.credits.grant(test.createdByUserId, CREDIT_COSTS.TEST_GENERATION, 'REFUND', `techtest:${testId}`);
    this.realtime.emitToCompany(test.companyId, 'test.failed', { testId, error: err.message });
  }

  private async onEvaluateSubmissionFailed(job: Job<EvaluateSubmissionJobData>, err: Error): Promise<void> {
    const maxAttempts = job.opts.attempts ?? 1;
    if (job.attemptsMade < maxAttempts) {
      this.logger.warn(
        `Intento ${job.attemptsMade}/${maxAttempts} falló para submission ${job.data.submissionId}, reintentando`,
      );
      return;
    }

    const { submissionId, attempt, userId } = job.data;
    const submission = await this.prisma.testSubmission.findUnique({
      where: { id: submissionId },
      select: { status: true, techTest: { select: { companyId: true } } },
    });
    // Si ya no está EVALUATING, otro worker/reintento ya lo resolvió — no dupliques el reembolso.
    if (!submission || submission.status !== 'EVALUATING') return;

    await this.prisma.testSubmission.update({ where: { id: submissionId }, data: { status: 'EVALUATION_FAILED' } });
    await this.credits.grant(userId, CREDIT_COSTS.EVALUATION, 'REFUND', `${submissionId}#${attempt}`);
    this.realtime.emitToCompany(submission.techTest.companyId, 'evaluation.failed', {
      submissionId,
      error: err.message,
    });
  }
}
