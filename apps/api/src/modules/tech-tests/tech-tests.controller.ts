import { Body, Controller, Param, Patch, Post, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { generateTechTestSchema, updateTechTestSchema } from '@nab/shared';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { CurrentUser, type JwtUser } from '../../common/decorators/current-user.decorator.js';
import { CompanyMemberGuard } from '../companies/company-member.guard.js';
import { CurrentCompany, type CompanyMembership } from '../companies/current-company.decorator.js';
import { TechTestsService } from './tech-tests.service.js';

/** Pruebas técnicas generadas por IA (lado empresa). companyId siempre de @CurrentCompany(). */
@ApiTags('tech-tests')
@Controller('companies')
@UseGuards(JwtAuthGuard, CompanyMemberGuard)
@ApiBearerAuth()
export class TechTestsController {
  constructor(private readonly techTests: TechTestsService) {}

  @Post(':companyId/tests')
  @ApiOperation({ summary: 'Genera una prueba técnica con IA (cobra créditos, corre asíncrono)' })
  create(
    @CurrentCompany() membership: CompanyMembership,
    @CurrentUser() user: JwtUser,
    @Body() body: unknown,
  ) {
    const input = generateTechTestSchema.parse(body);
    return this.techTests.create(membership.companyId, user.userId, input);
  }

  @Get(':companyId/tests')
  @ApiOperation({ summary: 'Lista las pruebas técnicas de la empresa' })
  list(@CurrentCompany() membership: CompanyMembership) {
    return this.techTests.list(membership.companyId);
  }

  @Get(':companyId/tests/:testId')
  @ApiOperation({ summary: 'Detalle de una prueba (incluye rúbrica y claves — solo empresa)' })
  getById(@CurrentCompany() membership: CompanyMembership, @Param('testId') testId: string) {
    return this.techTests.getById(membership.companyId, testId);
  }

  @Post(':companyId/tests/:testId/regenerate')
  @ApiOperation({ summary: 'Regenera la prueba como una nueva versión (cobra créditos de nuevo)' })
  regenerate(
    @CurrentCompany() membership: CompanyMembership,
    @CurrentUser() user: JwtUser,
    @Param('testId') testId: string,
  ) {
    return this.techTests.regenerate(membership.companyId, user.userId, testId);
  }

  @Patch(':companyId/tests/:testId')
  @ApiOperation({ summary: 'Edita manualmente una prueba READY (título, tiempo, preguntas, rúbrica)' })
  update(
    @CurrentCompany() membership: CompanyMembership,
    @Param('testId') testId: string,
    @Body() body: unknown,
  ) {
    const input = updateTechTestSchema.parse(body);
    return this.techTests.update(membership.companyId, testId, input);
  }

  @Patch(':companyId/tests/:testId/archive')
  @ApiOperation({ summary: 'Archiva la prueba' })
  archive(@CurrentCompany() membership: CompanyMembership, @Param('testId') testId: string) {
    return this.techTests.archive(membership.companyId, testId);
  }
}
