import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { generateResumeSchema, generateCoverLetterSchema, type JobRequirements } from '@nab/shared';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { CurrentUser, type JwtUser } from '../../common/decorators/current-user.decorator.js';
import { GenerationService } from './generation.service.js';

/**
 * Motor de IA (Fase 3): extracción de requisitos de vacante, generación de CV
 * personalizado (con verificación anti-alucinación y score ATS) y de cartas de
 * presentación. Cada generación consume un crédito vía CreditLedger. La
 * orquestación (llamada a Claude + guardar + cobrar, atómico) vive en
 * `GenerationService` — este controller solo valida input y delega.
 */
@ApiTags('ai')
@Controller('ai')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AiController {
  constructor(private readonly generation: GenerationService) {}

  @Post('jobs/:id/requirements')
  @ApiOperation({ summary: 'Extrae (y cachea) los requisitos de una vacante' })
  async requirements(@Param('id') id: string): Promise<JobRequirements> {
    const job = await this.generation.getJob(id);
    return this.generation.requirementsFor(job);
  }

  @Post('resumes')
  @ApiOperation({ summary: 'Genera un CV personalizado para una vacante (consume 1 crédito)' })
  async generateResume(@CurrentUser() user: JwtUser, @Body() body: unknown) {
    const { jobId } = generateResumeSchema.parse(body);
    return this.generation.generateAndSaveResume(user.userId, jobId);
  }

  @Post('cover-letters')
  @ApiOperation({ summary: 'Genera una carta de presentación (consume 1 crédito)' })
  async generateCoverLetter(@CurrentUser() user: JwtUser, @Body() body: unknown) {
    const { jobId, tone } = generateCoverLetterSchema.parse(body);
    return this.generation.generateAndSaveCoverLetter(user.userId, jobId, tone);
  }
}
