import { SetMetadata } from '@nestjs/common';
import type { CompanyMemberRole } from '@nab/database';

export const REQUIRE_COMPANY_ROLE = 'requireCompanyRole';

/** Exige que la membresía de la empresa actual tenga exactamente este rol. */
export const RequireCompanyRole = (role: CompanyMemberRole) =>
  SetMetadata(REQUIRE_COMPANY_ROLE, role);
