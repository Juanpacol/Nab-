import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import {
  applicationStatusSchema,
  attachTechTestSchema,
  createCompanyJobSchema,
  updateApplicantStatusSchema,
  updateCompanyJobSchema,
} from '@nab/shared';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { CompanyMemberGuard } from '../companies/company-member.guard.js';
import { CurrentCompany, type CompanyMembership } from '../companies/current-company.decorator.js';
import { TechTestsService } from '../tech-tests/tech-tests.service.js';
import { CompanyJobsService } from './company-jobs.service.js';

/**
 * Vacantes propias de una empresa y su funnel de aplicantes. Todas las rutas
 * pasan por CompanyMemberGuard — companyId siempre viene de @CurrentCompany().
 */
@ApiTags('company-jobs')
@Controller('companies')
@UseGuards(JwtAuthGuard, CompanyMemberGuard)
@ApiBearerAuth()
export class CompanyJobsController {
  constructor(
    private readonly companyJobs: CompanyJobsService,
    private readonly techTests: TechTestsService,
  ) {}

  @Post(':companyId/jobs')
  @ApiOperation({ summary: 'Publica una vacante propia de la empresa' })
  create(@CurrentCompany() membership: CompanyMembership, @Body() body: unknown) {
    const input = createCompanyJobSchema.parse(body);
    return this.companyJobs.create(membership.companyId, input);
  }

  @Get(':companyId/jobs')
  @ApiOperation({ summary: 'Lista las vacantes de la empresa' })
  list(@CurrentCompany() membership: CompanyMembership) {
    return this.companyJobs.list(membership.companyId);
  }

  @Get(':companyId/jobs/:jobId')
  @ApiOperation({ summary: 'Detalle de una vacante de la empresa' })
  getById(@CurrentCompany() membership: CompanyMembership, @Param('jobId') jobId: string) {
    return this.companyJobs.getById(membership.companyId, jobId);
  }

  @Patch(':companyId/jobs/:jobId')
  @ApiOperation({ summary: 'Edita o cierra una vacante (isActive: false)' })
  update(
    @CurrentCompany() membership: CompanyMembership,
    @Param('jobId') jobId: string,
    @Body() body: unknown,
  ) {
    const input = updateCompanyJobSchema.parse(body);
    return this.companyJobs.update(membership.companyId, jobId, input);
  }

  @Put(':companyId/jobs/:jobId/test')
  @ApiOperation({ summary: 'Adjunta una prueba técnica READY a la vacante' })
  attachTest(
    @CurrentCompany() membership: CompanyMembership,
    @Param('jobId') jobId: string,
    @Body() body: unknown,
  ) {
    const { techTestId } = attachTechTestSchema.parse(body);
    return this.techTests.attachToJob(membership.companyId, jobId, techTestId);
  }

  @Delete(':companyId/jobs/:jobId/test')
  @ApiOperation({ summary: 'Quita la prueba técnica de la vacante' })
  detachTest(@CurrentCompany() membership: CompanyMembership, @Param('jobId') jobId: string) {
    return this.techTests.detachFromJob(membership.companyId, jobId);
  }

  @Get(':companyId/jobs/:jobId/applicants')
  @ApiOperation({ summary: 'Lista los aplicantes de una vacante' })
  listApplicants(
    @CurrentCompany() membership: CompanyMembership,
    @Param('jobId') jobId: string,
    @Query('status') status?: string,
  ) {
    const parsedStatus = status ? applicationStatusSchema.parse(status) : undefined;
    return this.companyJobs.listApplicants(membership.companyId, jobId, parsedStatus);
  }

  @Patch(':companyId/applications/:applicationId/status')
  @ApiOperation({ summary: 'Mueve el funnel de una aplicación (RH)' })
  updateApplicantStatus(
    @CurrentCompany() membership: CompanyMembership,
    @Param('applicationId') applicationId: string,
    @Body() body: unknown,
  ) {
    const { status } = updateApplicantStatusSchema.parse(body);
    return this.companyJobs.updateApplicantStatus(membership.companyId, applicationId, status);
  }
}
