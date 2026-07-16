import { BadRequestException, Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { comparisonAnalyzeSchema } from '@nab/shared';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { CurrentUser, type JwtUser } from '../../common/decorators/current-user.decorator.js';
import { CompanyMemberGuard } from '../companies/company-member.guard.js';
import { CurrentCompany, type CompanyMembership } from '../companies/current-company.decorator.js';
import { CompanyDashboardService } from './company-dashboard.service.js';

function parseCompareIds(applicationIds?: string): string[] {
  const ids = [
    ...new Set(
      (applicationIds ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  ];
  if (ids.length < 2) throw new BadRequestException('Selecciona al menos 2 candidatos para comparar');
  if (ids.length > 4) throw new BadRequestException('Máximo 4 candidatos por comparación');
  return ids;
}

/** Métricas y comparativa (lado empresa). companyId siempre de @CurrentCompany(). */
@ApiTags('company-dashboard')
@Controller('companies')
@UseGuards(JwtAuthGuard, CompanyMemberGuard)
@ApiBearerAuth()
export class CompanyDashboardController {
  constructor(private readonly dashboard: CompanyDashboardService) {}

  @Get(':companyId/metrics')
  @ApiOperation({ summary: 'Overview: vacantes activas, aplicantes totales, pass rate global' })
  companyMetrics(@CurrentCompany() membership: CompanyMembership) {
    return this.dashboard.companyMetrics(membership.companyId);
  }

  @Get(':companyId/jobs/:jobId/metrics')
  @ApiOperation({ summary: 'Funnel + pass rate de una vacante específica' })
  jobMetrics(@CurrentCompany() membership: CompanyMembership, @Param('jobId') jobId: string) {
    return this.dashboard.jobMetrics(membership.companyId, jobId);
  }

  @Get(':companyId/jobs/:jobId/applicants-trend')
  @ApiOperation({ summary: 'Serie diaria de aplicantes de los últimos 30 días' })
  applicantsTrend(@CurrentCompany() membership: CompanyMembership, @Param('jobId') jobId: string) {
    return this.dashboard.applicantsTrend(membership.companyId, jobId);
  }

  @Get(':companyId/jobs/:jobId/score-distribution')
  @ApiOperation({ summary: 'Distribución de scores finales en bins de 10 puntos + passScore vigente' })
  scoreDistribution(@CurrentCompany() membership: CompanyMembership, @Param('jobId') jobId: string) {
    return this.dashboard.scoreDistribution(membership.companyId, jobId);
  }

  @Get(':companyId/jobs/:jobId/compare')
  @ApiOperation({ summary: 'Comparativa de 2-4 candidatos (matriz criterio×candidato, sin IA)' })
  compare(
    @CurrentCompany() membership: CompanyMembership,
    @Param('jobId') jobId: string,
    @Query('applicationIds') applicationIds?: string,
  ) {
    return this.dashboard.compareCandidates(membership.companyId, jobId, parseCompareIds(applicationIds));
  }

  @Post(':companyId/jobs/:jobId/compare/analyze')
  @ApiOperation({ summary: 'Análisis comparativo con IA (cobra créditos) — solo sobre datos ya evaluados' })
  analyzeComparison(
    @CurrentCompany() membership: CompanyMembership,
    @CurrentUser() user: JwtUser,
    @Param('jobId') jobId: string,
    @Query('applicationIds') applicationIds: string | undefined,
    @Body() body: unknown,
  ) {
    const { idempotencyKey } = comparisonAnalyzeSchema.parse(body);
    return this.dashboard.generateComparisonAnalysis(
      membership.companyId,
      jobId,
      parseCompareIds(applicationIds),
      user.userId,
      idempotencyKey,
    );
  }
}
