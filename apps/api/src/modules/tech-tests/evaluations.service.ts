import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { CREDIT_COSTS, QUEUE_NAMES, type OverrideEvaluationInput, type Rubric } from '@nab/shared';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CreditsService } from '../billing/credits.service.js';

@Injectable()
export class EvaluationsService {
  private readonly logger = new Logger(EvaluationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly credits: CreditsService,
    @InjectQueue(QUEUE_NAMES.COMPANY_AI) private readonly queue: Queue,
  ) {}

  /**
   * Transición atómica SUBMITTED|EVALUATION_FAILED → EVALUATING + cobro,
   * misma transacción (patrón `consumeWithClient`). Un doble click o un
   * segundo intento mientras ya está EVALUATING/EVALUATED choca con el
   * `updateMany` condicional → 409, sin cobrar de más.
   */
  async evaluate(companyId: string, submissionId: string, userId: string) {
    const submission = await this.prisma.testSubmission.findFirst({
      where: { id: submissionId, techTest: { companyId } },
      select: { id: true, evaluationAttempt: true },
    });
    if (!submission) throw new NotFoundException('Submission no encontrada');

    const attempt = submission.evaluationAttempt + 1;
    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.testSubmission.updateMany({
        where: { id: submissionId, status: { in: ['SUBMITTED', 'EVALUATION_FAILED'] } },
        data: { status: 'EVALUATING', evaluationAttempt: attempt },
      });
      if (updated.count === 0) {
        throw new ConflictException('La submission ya está siendo evaluada o ya fue evaluada');
      }
      await this.credits.consumeWithClient(tx, userId, CREDIT_COSTS.EVALUATION, 'EVALUATION', `${submissionId}#${attempt}`);
    });

    await this.enqueueEvaluation(submissionId, attempt, userId);
    return { submissionId, status: 'EVALUATING' as const, attempt };
  }

  /** Mismo patrón defensivo que TechTestsService.enqueueGeneration — ver ese comentario. */
  private async enqueueEvaluation(submissionId: string, attempt: number, userId: string): Promise<void> {
    try {
      await this.queue.add(
        'evaluate-submission',
        { submissionId, attempt, userId },
        { jobId: `eval-${submissionId}-${attempt}` },
      );
    } catch (err) {
      this.logger.error(`No se pudo encolar la evaluación de ${submissionId}: ${String(err)}`);
      await this.prisma.testSubmission.update({ where: { id: submissionId }, data: { status: 'EVALUATION_FAILED' } });
      await this.credits.grant(userId, CREDIT_COSTS.EVALUATION, 'REFUND', `${submissionId}#${attempt}`);
    }
  }

  async getBySubmissionId(companyId: string, submissionId: string) {
    const submission = await this.prisma.testSubmission.findFirst({
      where: { id: submissionId, techTest: { companyId } },
      select: {
        id: true,
        status: true,
        answersJson: true,
        startedAt: true,
        submittedAt: true,
        timeSpentSeconds: true,
        user: { select: { id: true, name: true, email: true, avatarUrl: true } },
        techTest: { select: { id: true, title: true, questionsJson: true, rubricJson: true } },
        evaluation: true,
      },
    });
    if (!submission) throw new NotFoundException('Submission no encontrada');
    return submission;
  }

  /**
   * Solo toca campos `override*` — nunca `aiScoresJson`/`aiSummary`/etc.
   * (auditoría: qué dijo la IA vs. qué decidió RH quedan siempre separados).
   */
  async override(companyId: string, evaluationId: string, userId: string, input: OverrideEvaluationInput) {
    const evaluation = await this.prisma.candidateEvaluation.findFirst({
      where: { id: evaluationId, submission: { techTest: { companyId } } },
      select: { id: true, submission: { select: { techTest: { select: { rubricJson: true } } } } },
    });
    if (!evaluation) throw new NotFoundException('Evaluación no encontrada');

    const rubric = evaluation.submission.techTest.rubricJson as Rubric | null;
    const passThreshold = rubric?.passThreshold ?? 60;

    return this.prisma.candidateEvaluation.update({
      where: { id: evaluationId },
      data: {
        ...(input.scores !== undefined ? { overrideScoresJson: input.scores } : {}),
        ...(input.notes !== undefined ? { overrideNotes: input.notes } : {}),
        ...(input.totalScore !== undefined
          ? { overrideTotalScore: input.totalScore, finalScore: input.totalScore, passed: input.totalScore >= passThreshold }
          : {}),
        overriddenByUserId: userId,
        overriddenAt: new Date(),
      },
    });
  }
}
