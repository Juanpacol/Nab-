import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { overrideEvaluationSchema } from '@nab/shared';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { CurrentUser, type JwtUser } from '../../common/decorators/current-user.decorator.js';
import { CompanyMemberGuard } from '../companies/company-member.guard.js';
import { CurrentCompany, type CompanyMembership } from '../companies/current-company.decorator.js';
import { EvaluationsService } from './evaluations.service.js';

/** Evaluación de submissions con IA (lado empresa). companyId siempre de @CurrentCompany(). */
@ApiTags('evaluations')
@Controller('companies')
@UseGuards(JwtAuthGuard, CompanyMemberGuard)
@ApiBearerAuth()
export class EvaluationsController {
  constructor(private readonly evaluations: EvaluationsService) {}

  @Post(':companyId/submissions/:submissionId/evaluate')
  @ApiOperation({ summary: 'Evalúa una submission con IA (cobra créditos, corre asíncrono)' })
  evaluate(
    @CurrentCompany() membership: CompanyMembership,
    @CurrentUser() user: JwtUser,
    @Param('submissionId') submissionId: string,
  ) {
    return this.evaluations.evaluate(membership.companyId, submissionId, user.userId);
  }

  @Get(':companyId/submissions/:submissionId')
  @ApiOperation({ summary: 'Detalle de una submission: respuestas + evaluación (IA + overrides de RH)' })
  getBySubmissionId(@CurrentCompany() membership: CompanyMembership, @Param('submissionId') submissionId: string) {
    return this.evaluations.getBySubmissionId(membership.companyId, submissionId);
  }

  @Patch(':companyId/evaluations/:evaluationId/override')
  @ApiOperation({ summary: 'RH ajusta puntajes/notas — nunca toca los campos de la IA' })
  override(
    @CurrentCompany() membership: CompanyMembership,
    @CurrentUser() user: JwtUser,
    @Param('evaluationId') evaluationId: string,
    @Body() body: unknown,
  ) {
    const input = overrideEvaluationSchema.parse(body);
    return this.evaluations.override(membership.companyId, evaluationId, user.userId, input);
  }
}
