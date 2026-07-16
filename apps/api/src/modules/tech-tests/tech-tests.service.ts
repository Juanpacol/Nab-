import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { CREDIT_COSTS, QUEUE_NAMES, type GenerateTechTestInput, type UpdateTechTestInput } from '@nab/shared';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CreditsService } from '../billing/credits.service.js';

function composeRoleSpec(input: GenerateTechTestInput): string {
  const lines: string[] = [];
  if (input.seniority) lines.push(`Seniority objetivo: ${input.seniority}.`);
  if (input.keySkills.length) lines.push(`Skills clave a evaluar: ${input.keySkills.join(', ')}.`);
  if (input.targetDurationMinutes) lines.push(`Duración objetivo: ${input.targetDurationMinutes} minutos.`);
  lines.push(input.spec);
  return lines.join('\n');
}

const TEST_SUMMARY_SELECT = {
  id: true,
  title: true,
  version: true,
  parentId: true,
  status: true,
  generationError: true,
  timeLimitMinutes: true,
  passScore: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class TechTestsService {
  private readonly logger = new Logger(TechTestsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly credits: CreditsService,
    @InjectQueue(QUEUE_NAMES.COMPANY_AI) private readonly queue: Queue,
  ) {}

  /**
   * Cobra el crédito y crea el registro GENERATING en la MISMA transacción,
   * luego encola — patrón de `GenerationService`/`ApplicationsService.apply`.
   * El `jobId` de BullMQ es estable (`gen-{testId}`; BullMQ no permite `:` en
   * ids personalizados) para que un reintento de este endpoint no encole el
   * mismo trabajo dos veces.
   */
  async create(companyId: string, userId: string, input: GenerateTechTestInput) {
    const test = await this.prisma.$transaction(async (tx) => {
      const created = await tx.techTest.create({
        data: {
          companyId,
          createdByUserId: userId,
          title: input.roleTitle,
          roleSpec: composeRoleSpec(input),
          status: 'GENERATING',
        },
        select: TEST_SUMMARY_SELECT,
      });
      await this.credits.consumeWithClient(tx, userId, CREDIT_COSTS.TEST_GENERATION, 'TEST_GENERATION', created.id);
      return created;
    });

    await this.enqueueGeneration(test, userId);
    return test;
  }

  async list(companyId: string) {
    return this.prisma.techTest.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      select: TEST_SUMMARY_SELECT,
    });
  }

  /** Detalle completo (incluye rúbrica y claves) — SOLO para la empresa, nunca para el candidato. */
  async getById(companyId: string, testId: string) {
    const test = await this.prisma.techTest.findFirst({ where: { id: testId, companyId } });
    if (!test) throw new NotFoundException('Prueba no encontrada');
    return test;
  }

  /**
   * Regenera: crea una versión NUEVA (fila nueva, `version+1`, `parentId` a
   * la anterior) y cobra de nuevo — nunca sobrescribe una versión que ya
   * pudiera tener submissions evaluadas contra ella.
   */
  async regenerate(companyId: string, userId: string, testId: string) {
    const previous = await this.prisma.techTest.findFirst({
      where: { id: testId, companyId },
      select: { id: true, title: true, roleSpec: true, version: true, timeLimitMinutes: true, passScore: true },
    });
    if (!previous) throw new NotFoundException('Prueba no encontrada');

    const test = await this.prisma.$transaction(async (tx) => {
      const created = await tx.techTest.create({
        data: {
          companyId,
          createdByUserId: userId,
          title: previous.title,
          roleSpec: previous.roleSpec,
          version: previous.version + 1,
          parentId: previous.id,
          timeLimitMinutes: previous.timeLimitMinutes,
          passScore: previous.passScore,
          status: 'GENERATING',
        },
        select: TEST_SUMMARY_SELECT,
      });
      await this.credits.consumeWithClient(tx, userId, CREDIT_COSTS.TEST_GENERATION, 'TEST_GENERATION', created.id);
      return created;
    });

    await this.enqueueGeneration(test, userId);
    return test;
  }

  /**
   * Encola la generación; si falla (blip de Redis/Upstash entre el commit
   * del cobro y este punto — el primer flujo de crédito async del repo, ver
   * nab-money-guard), no deja el TechTest colgado en GENERATING para
   * siempre con el crédito ya cobrado: lo marca FAILED y reembolsa aquí
   * mismo, con el MISMO refId (`techtest:{id}`) que usa el processor ante un
   * fallo definitivo — `credits.grant` es idempotente por refId, así que
   * ambos caminos nunca podrían reembolsar dos veces aunque coincidieran.
   */
  private async enqueueGeneration(test: { id: string }, userId: string): Promise<void> {
    try {
      await this.queue.add('generate-test', { testId: test.id }, { jobId: `gen-${test.id}` });
    } catch (err) {
      this.logger.error(`No se pudo encolar la generación de ${test.id}: ${String(err)}`);
      await this.prisma.techTest.update({
        where: { id: test.id },
        data: { status: 'FAILED', generationError: 'No se pudo encolar la generación (fallo de infraestructura)' },
      });
      await this.credits.grant(userId, CREDIT_COSTS.TEST_GENERATION, 'REFUND', `techtest:${test.id}`);
    }
  }

  /**
   * Edición manual del wizard (título, tiempo, umbral, preguntas, rúbrica) —
   * solo sobre una prueba READY. El editor siempre manda el árbol completo
   * de `questions`/`rubric` que ya tenía cargado (no un patch anidado
   * parcial), así que un `update` simplemente reemplaza esos campos tal cual
   * llegan — ya pasaron por `updateTechTestSchema` en el controller.
   */
  async update(companyId: string, testId: string, input: UpdateTechTestInput) {
    const test = await this.prisma.techTest.findFirst({ where: { id: testId, companyId }, select: { id: true, status: true } });
    if (!test) throw new NotFoundException('Prueba no encontrada');
    if (test.status !== 'READY') throw new ConflictException('Solo se puede editar una prueba lista (READY)');

    return this.prisma.techTest.update({
      where: { id: testId },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.timeLimitMinutes !== undefined ? { timeLimitMinutes: input.timeLimitMinutes } : {}),
        ...(input.passScore !== undefined ? { passScore: input.passScore } : {}),
        ...(input.questions !== undefined ? { questionsJson: input.questions } : {}),
        ...(input.rubric !== undefined ? { rubricJson: input.rubric } : {}),
      },
    });
  }

  /** Archiva una prueba (deja de poder adjuntarse a nuevas vacantes). */
  async archive(companyId: string, testId: string) {
    const test = await this.prisma.techTest.findFirst({ where: { id: testId, companyId }, select: { id: true } });
    if (!test) throw new NotFoundException('Prueba no encontrada');
    return this.prisma.techTest.update({ where: { id: testId }, data: { status: 'ARCHIVED' }, select: TEST_SUMMARY_SELECT });
  }

  /**
   * Adjunta la prueba a una vacante de la misma empresa — exige que esté
   * READY (una prueba GENERATING/FAILED no puede tomarse todavía).
   */
  async attachToJob(companyId: string, jobId: string, testId: string) {
    const [job, test] = await Promise.all([
      this.prisma.job.findFirst({ where: { id: jobId, companyId }, select: { id: true } }),
      this.prisma.techTest.findFirst({ where: { id: testId, companyId }, select: { id: true, status: true } }),
    ]);
    if (!job) throw new NotFoundException('Vacante no encontrada');
    if (!test) throw new NotFoundException('Prueba no encontrada');
    if (test.status !== 'READY') throw new ConflictException('La prueba todavía no está lista');

    return this.prisma.job.update({ where: { id: jobId }, data: { techTestId: testId }, select: { id: true, techTestId: true } });
  }

  async detachFromJob(companyId: string, jobId: string) {
    const job = await this.prisma.job.findFirst({ where: { id: jobId, companyId }, select: { id: true } });
    if (!job) throw new NotFoundException('Vacante no encontrada');
    return this.prisma.job.update({ where: { id: jobId }, data: { techTestId: null }, select: { id: true, techTestId: true } });
  }
}
