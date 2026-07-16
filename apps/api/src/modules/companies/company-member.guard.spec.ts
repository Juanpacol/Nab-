import { describe, expect, it, vi } from 'vitest';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { CompanyMemberGuard } from './company-member.guard.js';

function fakeContext(params: Record<string, string>, userId: string): ExecutionContext {
  const request: any = { params, user: { userId, email: 'u@nab.app' } };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => ({}) as any,
    getClass: () => ({}) as any,
  } as unknown as ExecutionContext;
}

function fakePrisma(memberships: { companyId: string; userId: string; role: string }[]) {
  return {
    companyMember: {
      findFirst: vi.fn(async ({ where }: any) => {
        return (
          memberships.find((m) => m.companyId === where.companyId && m.userId === where.userId) ?? null
        );
      }),
    },
  } as any;
}

describe('CompanyMemberGuard', () => {
  it('lanza NotFoundException (no ForbiddenException) si el usuario no es miembro de la empresa', async () => {
    const prisma = fakePrisma([]);
    const reflector = { getAllAndOverride: vi.fn().mockReturnValue(undefined) } as any;
    const guard = new CompanyMemberGuard(prisma, reflector);
    const ctx = fakeContext({ companyId: 'company-1' }, 'user-1');

    await expect(guard.canActivate(ctx)).rejects.toThrow(NotFoundException);
  });

  it('permite el paso y adjunta companyMembership si el usuario es miembro', async () => {
    const prisma = fakePrisma([{ companyId: 'company-1', userId: 'user-1', role: 'RECRUITER' }]);
    const reflector = { getAllAndOverride: vi.fn().mockReturnValue(undefined) } as any;
    const guard = new CompanyMemberGuard(prisma, reflector);
    const ctx = fakeContext({ companyId: 'company-1' }, 'user-1');
    const request = ctx.switchToHttp().getRequest<any>();

    const result = await guard.canActivate(ctx);

    expect(result).toBe(true);
    expect(request.companyMembership).toEqual({ companyId: 'company-1', role: 'RECRUITER' });
  });

  it('lanza ForbiddenException si el rol no cumple @RequireCompanyRole', async () => {
    const prisma = fakePrisma([{ companyId: 'company-1', userId: 'user-1', role: 'RECRUITER' }]);
    const reflector = { getAllAndOverride: vi.fn().mockReturnValue('OWNER') } as any;
    const guard = new CompanyMemberGuard(prisma, reflector);
    const ctx = fakeContext({ companyId: 'company-1' }, 'user-1');

    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  it('permite el paso si el rol requerido coincide', async () => {
    const prisma = fakePrisma([{ companyId: 'company-1', userId: 'user-1', role: 'OWNER' }]);
    const reflector = { getAllAndOverride: vi.fn().mockReturnValue('OWNER') } as any;
    const guard = new CompanyMemberGuard(prisma, reflector);
    const ctx = fakeContext({ companyId: 'company-1' }, 'user-1');

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('lanza NotFoundException si un miembro de OTRA empresa intenta acceder (IDOR)', async () => {
    const prisma = fakePrisma([{ companyId: 'company-2', userId: 'user-1', role: 'OWNER' }]);
    const reflector = { getAllAndOverride: vi.fn().mockReturnValue(undefined) } as any;
    const guard = new CompanyMemberGuard(prisma, reflector);
    const ctx = fakeContext({ companyId: 'company-1' }, 'user-1');

    await expect(guard.canActivate(ctx)).rejects.toThrow(NotFoundException);
  });
});
