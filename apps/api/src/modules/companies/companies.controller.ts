import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { addCompanyMemberSchema, createCompanySchema, updateCompanySchema } from '@nab/shared';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { CurrentUser, type JwtUser } from '../../common/decorators/current-user.decorator.js';
import { CompanyMemberGuard } from './company-member.guard.js';
import { RequireCompanyRole } from './company-role.decorator.js';
import { CurrentCompany, type CompanyMembership } from './current-company.decorator.js';
import { CompaniesService } from './companies.service.js';

/**
 * Empresas (lado B2B): alta, datos, y gestión de miembros. Las rutas con
 * `:companyId` pasan por CompanyMemberGuard — companyId SIEMPRE se resuelve
 * desde la membresía verificada del usuario (@CurrentCompany()), nunca del body.
 */
@ApiTags('companies')
@Controller('companies')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CompaniesController {
  constructor(private readonly companies: CompaniesService) {}

  @Post()
  @ApiOperation({ summary: 'Crea una empresa; el creador queda como dueño (OWNER)' })
  create(@CurrentUser() user: JwtUser, @Body() body: unknown) {
    const input = createCompanySchema.parse(body);
    return this.companies.create(user.userId, input);
  }

  @Get('mine')
  @ApiOperation({ summary: 'Empresas de las que el usuario es miembro' })
  listMine(@CurrentUser() user: JwtUser) {
    return this.companies.listMine(user.userId);
  }

  @Get(':companyId')
  @UseGuards(CompanyMemberGuard)
  @ApiOperation({ summary: 'Detalle de la empresa' })
  getById(@CurrentCompany() membership: CompanyMembership) {
    return this.companies.getById(membership.companyId);
  }

  @Patch(':companyId')
  @UseGuards(CompanyMemberGuard)
  @RequireCompanyRole('OWNER')
  @ApiOperation({ summary: 'Actualiza los datos de la empresa (solo OWNER)' })
  update(@CurrentCompany() membership: CompanyMembership, @Body() body: unknown) {
    const input = updateCompanySchema.parse(body);
    return this.companies.update(membership.companyId, input);
  }

  @Get(':companyId/members')
  @UseGuards(CompanyMemberGuard)
  @ApiOperation({ summary: 'Lista los miembros de la empresa' })
  listMembers(@CurrentCompany() membership: CompanyMembership) {
    return this.companies.listMembers(membership.companyId);
  }

  @Post(':companyId/members')
  @UseGuards(CompanyMemberGuard)
  @RequireCompanyRole('OWNER')
  @ApiOperation({ summary: 'Agrega un miembro por correo (solo OWNER)' })
  addMember(@CurrentCompany() membership: CompanyMembership, @Body() body: unknown) {
    const input = addCompanyMemberSchema.parse(body);
    return this.companies.addMember(membership.companyId, input);
  }

  @Delete(':companyId/members/:userId')
  @UseGuards(CompanyMemberGuard)
  @RequireCompanyRole('OWNER')
  @ApiOperation({ summary: 'Elimina un miembro (solo OWNER; protege al último dueño)' })
  removeMember(@CurrentCompany() membership: CompanyMembership, @Param('userId') userId: string) {
    return this.companies.removeMember(membership.companyId, userId);
  }
}
