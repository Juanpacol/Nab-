import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@nab/database';
import { CREDIT_COSTS, type JobRequirements, jobRequirementsSchema, type CoverLetterTone } from '@nab/shared';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CreditsService } from '../billing/credits.service.js';
import { AiService, type JobContext, type ProfileContext } from './ai.service.js';

/**
 * Orquesta generación de IA + persistencia + cobro de crédito, siempre de
 * forma atómica: la llamada a Claude corre FUERA de la transacción (es una
 * llamada de red lenta, no hay que tener una conexión de DB abierta durante
 * eso), pero el `create` del registro y el cobro del crédito van juntos en
 * `$transaction` vía `CreditsService.consumeWithClient` — mismo patrón que
 * `ApplicationsService.apply()`. Antes, `AiController` hacía el `create` y el
 * `consume()` como pasos separados: si el cobro fallaba después de crear el
 * registro, quedaba un CV/carta ya generado y guardado sin haberse cobrado
 * nunca. Usado tanto por `AiController` (generación manual) como por
 * `AutoApplyService` (generación automática) — una sola implementación.
 */
@Injectable()
export class GenerationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
    private readonly credits: CreditsService,
  ) {}

  async generateAndSaveResume(userId: string, jobId: string) {
    const profile = await this.getProfile(userId);
    const job = await this.getJob(jobId);
    await this.credits.assertBalance(userId, CREDIT_COSTS.RESUME_GENERATION);

    const requirements = await this.requirementsFor(job);
    const { resume, ats } = await this.ai.generateResume(profile, toJobContext(job), requirements, userId);

    const { created, creditsRemaining } = await this.prisma.$transaction(async (tx) => {
      const created = await tx.resume.create({
        data: {
          userId,
          title: `CV — ${job.title}`,
          contentJson: resume as unknown as Prisma.InputJsonValue,
          jobId: job.id,
          atsScore: ats.score,
          model: this.ai.generationModel,
        },
      });
      const creditsRemaining = await this.credits.consumeWithClient(
        tx,
        userId,
        CREDIT_COSTS.RESUME_GENERATION,
        'GENERATION',
        created.id,
      );
      return { created, creditsRemaining };
    });

    return { resume: created, ats, creditsRemaining };
  }

  async generateAndSaveCoverLetter(userId: string, jobId: string, tone: CoverLetterTone) {
    const profile = await this.getProfile(userId);
    const job = await this.getJob(jobId);
    await this.credits.assertBalance(userId, CREDIT_COSTS.COVER_LETTER_GENERATION);

    const content = await this.ai.generateCoverLetter(profile, toJobContext(job), tone, userId);

    const { created, creditsRemaining } = await this.prisma.$transaction(async (tx) => {
      const created = await tx.coverLetter.create({
        data: { userId, jobId: job.id, content, tone, model: this.ai.generationModel },
      });
      const creditsRemaining = await this.credits.consumeWithClient(
        tx,
        userId,
        CREDIT_COSTS.COVER_LETTER_GENERATION,
        'GENERATION',
        created.id,
      );
      return { created, creditsRemaining };
    });

    return { coverLetter: created, creditsRemaining };
  }

  /** Devuelve los requisitos cacheados de la vacante o los extrae y los cachea. */
  async requirementsFor(job: {
    id: string;
    title: string;
    company: string;
    location: string | null;
    description: string;
    requirementsJson: unknown;
  }): Promise<JobRequirements> {
    const cached = jobRequirementsSchema.safeParse(job.requirementsJson);
    if (cached.success) return cached.data;

    const requirements = await this.ai.extractJobRequirements(toJobContext(job));
    await this.prisma.job.update({
      where: { id: job.id },
      data: { requirementsJson: requirements as unknown as Prisma.InputJsonValue },
    });
    return requirements;
  }

  async getProfile(userId: string): Promise<ProfileContext> {
    const profile = await this.prisma.profile.findUnique({ where: { userId } });
    if (!profile) {
      throw new BadRequestException('Completa tu perfil antes de generar con IA');
    }
    return profile;
  }

  async getJob(id: string) {
    const job = await this.prisma.job.findUnique({ where: { id } });
    if (!job) throw new NotFoundException('Vacante no encontrada');
    return job;
  }
}

function toJobContext(job: {
  title: string;
  company: string;
  location: string | null;
  description: string;
}): JobContext {
  return {
    title: job.title,
    company: job.company,
    location: job.location,
    description: job.description,
  };
}
