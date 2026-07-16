import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@nab/database';
import { toCandidateQuestion, type SaveTestAnswersInput, type TechQuestion } from '@nab/shared';
import { PrismaService } from '../../prisma/prisma.service.js';
import { RealtimeGateway } from '../realtime/realtime.gateway.js';

// Select explícito: el candidato solo debe ver el estado de SU submission,
// nunca campos de evaluación (aiScoresJson/aiSummary/etc. llegan en una fase
// posterior a este mismo modelo — sin este select, start() los expondría
// por accidente el día que existan, ver nab-tenant-guard).
const SUBMISSION_SELECT = {
  id: true,
  techTestId: true,
  applicationId: true,
  status: true,
  answersJson: true,
  startedAt: true,
  submittedAt: true,
  timeSpentSeconds: true,
} satisfies Prisma.TestSubmissionSelect;

@Injectable()
export class TestTakingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeGateway,
  ) {}

  /**
   * Valida ownership del candidato (Application.userId) y que la vacante
   * requiera + tenga lista una prueba técnica. Único punto de entrada de
   * todo el módulo — ningún método toca TechTest/TestSubmission sin pasar
   * por aquí primero (anti-IDOR).
   */
  private async loadContext(userId: string, applicationId: string) {
    const application = await this.prisma.application.findFirst({
      where: { id: applicationId, userId },
      select: { id: true, job: { select: { id: true, techTestId: true, companyId: true } } },
    });
    if (!application) throw new NotFoundException('Aplicación no encontrada');
    if (!application.job.techTestId) throw new NotFoundException('Esta vacante no requiere una prueba técnica');

    // Select EXPLÍCITO sin rubricJson — el candidato nunca debe recibir la
    // rúbrica ni las claves de evaluación (ver nab-tenant-guard, invariante 5).
    const techTest = await this.prisma.techTest.findUnique({
      where: { id: application.job.techTestId },
      select: { id: true, title: true, status: true, timeLimitMinutes: true, questionsJson: true },
    });
    if (!techTest || techTest.status !== 'READY') throw new NotFoundException('La prueba no está disponible');

    return {
      applicationId: application.id,
      jobId: application.job.id,
      companyId: application.job.companyId!,
      techTest,
    };
  }

  /** Preguntas sanitizadas (sin claves/guías del evaluador) + estado de la submission si ya empezó. */
  async getTest(userId: string, applicationId: string) {
    const { applicationId: appId, techTest } = await this.loadContext(userId, applicationId);
    const submission = await this.prisma.testSubmission.findUnique({
      where: { applicationId: appId },
      select: { status: true, answersJson: true, startedAt: true, submittedAt: true },
    });

    const questions = (techTest.questionsJson as TechQuestion[]).map(toCandidateQuestion);
    return {
      techTestId: techTest.id,
      title: techTest.title,
      timeLimitMinutes: techTest.timeLimitMinutes,
      questions,
      submission,
    };
  }

  /** Idempotente: si ya existe una submission, la devuelve tal cual (no reinicia el cronómetro). */
  async start(userId: string, applicationId: string) {
    const { applicationId: appId, jobId, techTest } = await this.loadContext(userId, applicationId);
    const existing = await this.prisma.testSubmission.findUnique({
      where: { applicationId: appId },
      select: SUBMISSION_SELECT,
    });
    if (existing) return existing;

    return this.prisma.testSubmission.create({
      data: { techTestId: techTest.id, applicationId: appId, userId, jobId, status: 'IN_PROGRESS' },
      select: SUBMISSION_SELECT,
    });
  }

  /** Autosave — rechaza si ya se envió o si venció el tiempo (defensa server-side; el cliente también corta solo). */
  async saveAnswers(userId: string, applicationId: string, input: SaveTestAnswersInput) {
    const { applicationId: appId, techTest } = await this.loadContext(userId, applicationId);
    const submission = await this.prisma.testSubmission.findFirst({ where: { applicationId: appId, userId } });
    if (!submission) throw new NotFoundException('Todavía no iniciaste la prueba');
    if (submission.status !== 'IN_PROGRESS') throw new ConflictException('La prueba ya fue enviada');
    if (techTest.timeLimitMinutes) {
      const deadline = submission.startedAt.getTime() + techTest.timeLimitMinutes * 60_000;
      if (Date.now() > deadline) throw new ConflictException('Se acabó el tiempo para responder');
    }

    return this.prisma.testSubmission.update({
      where: { id: submission.id },
      data: { answersJson: input.answers },
      select: { id: true, answersJson: true },
    });
  }

  /**
   * Marca SUBMITTED vía updateMany condicional (idempotente: un doble click
   * o reintento de red no falla, simplemente no hace nada la segunda vez —
   * mismo patrón que ApplicationsService.updateStatus/apply).
   */
  async submit(userId: string, applicationId: string) {
    const { applicationId: appId, jobId, companyId } = await this.loadContext(userId, applicationId);
    const submission = await this.prisma.testSubmission.findFirst({ where: { applicationId: appId, userId } });
    if (!submission) throw new NotFoundException('Todavía no iniciaste la prueba');
    if (submission.status !== 'IN_PROGRESS') {
      return { id: submission.id, status: submission.status };
    }

    const timeSpentSeconds = Math.max(0, Math.floor((Date.now() - submission.startedAt.getTime()) / 1000));
    const result = await this.prisma.testSubmission.updateMany({
      where: { id: submission.id, status: 'IN_PROGRESS' },
      data: { status: 'SUBMITTED', submittedAt: new Date(), timeSpentSeconds },
    });
    if (result.count === 0) {
      // Perdió la carrera contra otro request idéntico — idempotente, no falla.
      const current = await this.prisma.testSubmission.findUniqueOrThrow({ where: { id: submission.id } });
      return { id: current.id, status: current.status };
    }

    this.realtime.emitToCompany(companyId, 'submission.received', {
      applicationId: appId,
      jobId,
      submissionId: submission.id,
    });
    return { id: submission.id, status: 'SUBMITTED' as const };
  }
}
