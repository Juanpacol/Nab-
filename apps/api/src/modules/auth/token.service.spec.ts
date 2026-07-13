import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { JwtService } from '@nestjs/jwt';
import { TokenService } from './token.service.js';

function hash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Prisma en memoria para RefreshToken, suficiente para probar rotación/revocación. */
function createFakePrisma(user: { id: string; email: string }) {
  type Record = {
    id: string;
    userId: string;
    tokenHash: string;
    expiresAt: Date;
    revokedAt: Date | null;
  };
  const tokens: Record[] = [];
  let nextId = 0;

  const prisma: any = {
    refreshToken: {
      create: vi.fn(async ({ data }: any) => {
        const record: Record = { id: String(nextId++), revokedAt: null, ...data };
        tokens.push(record);
        return record;
      }),
      findUnique: vi.fn(async ({ where }: any) => {
        const record = tokens.find((t) => t.tokenHash === where.tokenHash);
        return record ? { ...record, user } : null;
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const record = tokens.find((t) => t.id === where.id);
        if (!record) throw new Error('No encontrado');
        Object.assign(record, data);
        return record;
      }),
      updateMany: vi.fn(async ({ where, data }: any) => {
        let count = 0;
        for (const t of tokens) {
          const matchesToken = where.tokenHash ? t.tokenHash === where.tokenHash : true;
          const matchesUser = where.userId ? t.userId === where.userId : true;
          const matchesRevoked = where.revokedAt === null ? t.revokedAt === null : true;
          if (matchesToken && matchesUser && matchesRevoked) {
            Object.assign(t, data);
            count++;
          }
        }
        return { count };
      }),
    },
  };

  return { prisma, tokens };
}

describe('TokenService', () => {
  const user = { id: 'user-1', email: 'ana@example.com' };
  const jwt = new JwtService({ secret: 'test-secret-not-for-prod' });

  it('issuePair crea un refresh token guardado como hash (no en claro)', async () => {
    const { prisma, tokens } = createFakePrisma(user);
    const service = new TokenService(jwt, prisma);

    const pair = await service.issuePair(user.id, user.email);

    expect(pair.accessToken).toBeTruthy();
    expect(pair.refreshToken).toBeTruthy();
    expect(tokens).toHaveLength(1);
    expect(tokens[0]!.tokenHash).toBe(hash(pair.refreshToken));
    expect(tokens[0]!.tokenHash).not.toBe(pair.refreshToken);
  });

  it('rotate con un token válido lo revoca y emite un par nuevo', async () => {
    const { prisma, tokens } = createFakePrisma(user);
    const service = new TokenService(jwt, prisma);
    const first = await service.issuePair(user.id, user.email);

    const rotated = await service.rotate(first.refreshToken);

    expect(rotated).not.toBeNull();
    expect(rotated!.refreshToken).not.toBe(first.refreshToken);
    expect(tokens.find((t) => t.tokenHash === hash(first.refreshToken))?.revokedAt).not.toBeNull();
  });

  it('rotate con el mismo token usado dos veces falla la segunda vez (el viejo queda inválido)', async () => {
    const { prisma } = createFakePrisma(user);
    const service = new TokenService(jwt, prisma);
    const first = await service.issuePair(user.id, user.email);

    await service.rotate(first.refreshToken);
    const secondAttempt = await service.rotate(first.refreshToken);

    expect(secondAttempt).toBeNull();
  });

  it('rotate con un token expirado devuelve null y no lo revoca', async () => {
    const { prisma, tokens } = createFakePrisma(user);
    const service = new TokenService(jwt, prisma);
    const first = await service.issuePair(user.id, user.email);
    tokens[0]!.expiresAt = new Date(Date.now() - 1000);

    const result = await service.rotate(first.refreshToken);

    expect(result).toBeNull();
    expect(tokens[0]!.revokedAt).toBeNull();
  });

  it('rotate con un token desconocido devuelve null', async () => {
    const { prisma } = createFakePrisma(user);
    const service = new TokenService(jwt, prisma);

    expect(await service.rotate('token-que-nunca-existio')).toBeNull();
  });

  it('revokeAll revoca todos los refresh tokens activos del usuario', async () => {
    const { prisma, tokens } = createFakePrisma(user);
    const service = new TokenService(jwt, prisma);
    await service.issuePair(user.id, user.email);
    await service.issuePair(user.id, user.email);

    await service.revokeAll(user.id);

    expect(tokens.every((t) => t.revokedAt !== null)).toBe(true);
  });
});
