import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { VerificationService } from './verification.service.js';

function hash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function createFakePrisma() {
  type Record = {
    id: string;
    userId: string;
    type: string;
    tokenHash: string;
    expiresAt: Date;
    usedAt: Date | null;
  };
  const tokens: Record[] = [];
  let nextId = 0;

  const prisma: any = {
    verificationToken: {
      deleteMany: vi.fn(async ({ where }: any) => {
        const before = tokens.length;
        for (let i = tokens.length - 1; i >= 0; i--) {
          const t = tokens[i]!;
          if (t.userId === where.userId && t.type === where.type && t.usedAt === null) {
            tokens.splice(i, 1);
          }
        }
        return { count: before - tokens.length };
      }),
      create: vi.fn(async ({ data }: any) => {
        const record: Record = { id: String(nextId++), usedAt: null, ...data };
        tokens.push(record);
        return record;
      }),
      findUnique: vi.fn(async ({ where }: any) => tokens.find((t) => t.tokenHash === where.tokenHash) ?? null),
      update: vi.fn(async ({ where, data }: any) => {
        const record = tokens.find((t) => t.id === where.id);
        if (!record) throw new Error('No encontrado');
        Object.assign(record, data);
        return record;
      }),
    },
  };

  return { prisma, tokens };
}

describe('VerificationService', () => {
  const userId = 'user-1';

  it('create guarda solo el hash del token, nunca el token en claro', async () => {
    const { prisma, tokens } = createFakePrisma();
    const service = new VerificationService(prisma);

    const token = await service.create(userId, 'EMAIL_VERIFY');

    expect(tokens).toHaveLength(1);
    expect(tokens[0]!.tokenHash).toBe(hash(token));
    expect(tokens[0]!.tokenHash).not.toBe(token);
  });

  it('consume con un token válido devuelve el userId y lo marca usado', async () => {
    const { prisma, tokens } = createFakePrisma();
    const service = new VerificationService(prisma);
    const token = await service.create(userId, 'EMAIL_VERIFY');

    const result = await service.consume(token, 'EMAIL_VERIFY');

    expect(result).toBe(userId);
    expect(tokens[0]!.usedAt).not.toBeNull();
  });

  it('consume el mismo token dos veces: la segunda vez rechaza (ya usado)', async () => {
    const { prisma } = createFakePrisma();
    const service = new VerificationService(prisma);
    const token = await service.create(userId, 'EMAIL_VERIFY');

    await service.consume(token, 'EMAIL_VERIFY');
    const second = await service.consume(token, 'EMAIL_VERIFY');

    expect(second).toBeNull();
  });

  it('consume con el tipo equivocado rechaza aunque el token sea válido', async () => {
    const { prisma } = createFakePrisma();
    const service = new VerificationService(prisma);
    const token = await service.create(userId, 'EMAIL_VERIFY');

    expect(await service.consume(token, 'PASSWORD_RESET')).toBeNull();
  });

  it('consume con un token expirado rechaza', async () => {
    const { prisma, tokens } = createFakePrisma();
    const service = new VerificationService(prisma);
    const token = await service.create(userId, 'PASSWORD_RESET');
    tokens[0]!.expiresAt = new Date(Date.now() - 1000);

    expect(await service.consume(token, 'PASSWORD_RESET')).toBeNull();
  });

  it('create invalida los tokens sin usar previos del mismo tipo (solo el último enlace funciona)', async () => {
    const { prisma } = createFakePrisma();
    const service = new VerificationService(prisma);
    const oldToken = await service.create(userId, 'PASSWORD_RESET');
    const newToken = await service.create(userId, 'PASSWORD_RESET');

    expect(await service.consume(oldToken, 'PASSWORD_RESET')).toBeNull();
    expect(await service.consume(newToken, 'PASSWORD_RESET')).toBe(userId);
  });
});
