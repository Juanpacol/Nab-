import {
  BadRequestException,
  Body,
  Controller,
  NotFoundException,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import type { Prisma } from '@nab/database';
import {
  CREDIT_COSTS,
  generateResumeSchema,
  generateCoverLetterSchema,
  jobRequirementsSchema,
  type JobRequirements,
} from '@nab/shared';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { CurrentUser, type JwtUser } from '../../common/decorators/current-user.decorator.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CreditsService } from '../billing/credits.service.js';
import { AiService, type JobContext, type ProfileContext } from './ai.service.js';

/**
 * Motor de IA (Fase 3): extracción de requisitos de vacante, generación de CV
 * personalizado (con verificación anti-alucinación y score ATS) y de cartas de
 * presentación. Cada generación consume un crédito vía CreditLedger.
 */
@ApiTags('ai')
@Controller('ai')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AiController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
    private readonly credits: CreditsService,
  ) {}

  @Post('jobs/:id/requirements')
  @ApiOperation({ summary: 'Extrae (y cachea) los requisitos de una vacante' })
  async requirements(@Param('id') id: string): Promise<JobRequirements> {
    const job = await this.getJob(id);
    return this.requirementsFor(job);
  }

  @Post('resumes')
  @ApiOperation({ summary: 'Genera un CV personalizado para una vacante (consume 1 crédito)' })
  async generateResume(@CurrentUser() user: JwtUser, @Body() body: unknown) {
    const { jobId } = generateResumeSchema.parse(body);
    const profile = await this.getProfile(user.userId);
    const job = await this.getJob(jobId);
    await this.credits.assertBalance(user.userId, CREDIT_COSTS.RESUME_GENERATION);

    const requirements = await this.requirementsFor(job);
    const { resume, ats } = await this.ai.generateResume(
      profile,
      toJobContext(job),
      requirements,
      user.userId,
    );

    const created = await this.prisma.resume.create({
      data: {
        userId: user.userId,
        title: `CV — ${job.title}`,
        contentJson: resume as unknown as Prisma.InputJsonValue,
        jobId: job.id,
        atsScore: ats.score,
        model: this.ai.generationModel,
      },
    });
    const remaining = await this.credits.consume(
      user.userId,
      CREDIT_COSTS.RESUME_GENERATION,
      'GENERATION',
      created.id,
    );

    return { resume: created, ats, creditsRemaining: remaining };
  }

  @Post('cover-letters')
  @ApiOperation({ summary: 'Genera una carta de presentación (consume 1 crédito)' })
  async generateCoverLetter(@CurrentUser() user: JwtUser, @Body() body: unknown) {
    const { jobId, tone } = generateCoverLetterSchema.parse(body);
    const profile = await this.getProfile(user.userId);
    const job = await this.getJob(jobId);
    await this.credits.assertBalance(user.userId, CREDIT_COSTS.COVER_LETTER_GENERATION);

    const content = await this.ai.generateCoverLetter(
      profile,
      toJobContext(job),
      tone,
      user.userId,
    );

    const created = await this.prisma.coverLetter.create({
      data: { userId: user.userId, jobId: job.id, content, tone, model: this.ai.generationModel },
    });
    const remaining = await this.credits.consume(
      user.userId,
      CREDIT_COSTS.COVER_LETTER_GENERATION,
      'GENERATION',
      created.id,
    );

    return { coverLetter: created, creditsRemaining: remaining };
  }

  // --- Helpers ---

  private async getProfile(userId: string): Promise<ProfileContext> {
    const profile = await this.prisma.profile.findUnique({ where: { userId } });
    if (!profile) {
      throw new BadRequestException('Completa tu perfil antes de generar con IA');
    }
    return profile;
  }

  private async getJob(id: string) {
    const job = await this.prisma.job.findUnique({ where: { id } });
    if (!job) throw new NotFoundException('Vacante no encontrada');
    return job;
  }

  /** Devuelve los requisitos cacheados de la vacante o los extrae y los cachea. */
  private async requirementsFor(job: {
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
