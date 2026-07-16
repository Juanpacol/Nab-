import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { CompanyMemberRole } from '@nab/database';

/** Membresía verificada que CompanyMemberGuard adjunta a request.companyMembership. */
export interface CompanyMembership {
  companyId: string;
  role: CompanyMemberRole;
}

/** Inyecta la membresía de empresa ya verificada por CompanyMemberGuard. */
export const CurrentCompany = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): CompanyMembership => {
    const request = ctx.switchToHttp().getRequest();
    return request.companyMembership as CompanyMembership;
  },
);
