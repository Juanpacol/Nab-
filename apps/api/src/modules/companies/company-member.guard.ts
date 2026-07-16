import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { CompanyMemberRole } from '@nab/database';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { JwtUser } from '../../common/decorators/current-user.decorator.js';
import { REQUIRE_COMPANY_ROLE } from './company-role.decorator.js';
import type { CompanyMembership } from './current-company.decorator.js';

/**
 * Verifica que el usuario autenticado (adjuntado por JwtAuthGuard, que debe
 * ejecutarse ANTES en @UseGuards) sea miembro de la empresa del path param
 * `companyId`, y adjunta la membresía a request.companyMembership para que
 * @CurrentCompany() la inyecte en el handler.
 *
 * Devuelve 404 (no 403) cuando el usuario no es miembro: confirmar "existe
 * pero no tienes acceso" revelaría la existencia de la empresa a un usuario
 * ajeno (ver .claude/agents/nab-tenant-guard.md, invariante 3). El controller
 * NUNCA debe leer companyId de otro lado que no sea @CurrentCompany() tras
 * este guard — leerlo del body permitiría a cualquier usuario autenticado
 * apuntar a una empresa ajena.
 */
@Injectable()
export class CompanyMemberGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user: JwtUser; companyMembership?: CompanyMembership }>();
    const companyId = request.params.companyId;
    if (!companyId || typeof companyId !== 'string') throw new NotFoundException('Empresa no encontrada');

    const membership = await this.prisma.companyMember.findFirst({
      where: { companyId, userId: request.user.userId },
      select: { role: true },
    });
    if (!membership) throw new NotFoundException('Empresa no encontrada');

    const requiredRole = this.reflector.getAllAndOverride<CompanyMemberRole | undefined>(
      REQUIRE_COMPANY_ROLE,
      [context.getHandler(), context.getClass()],
    );
    if (requiredRole && membership.role !== requiredRole) {
      throw new ForbiddenException('No tienes permiso para esta acción');
    }

    request.companyMembership = { companyId, role: membership.role };
    return true;
  }
}
