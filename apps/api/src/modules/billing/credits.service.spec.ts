import { describe, expect, it, vi } from 'vitest';
import { HttpException } from '@nestjs/common';
import { Prisma } from '@nab/database';
import { CreditsService } from './credits.service.js';

/**
 * Prisma en memoria que imita la semántica usada por CreditsService, incluyendo
 * la restricción única `(userId, reason, refId)` de CreditLedger (migración
 * credit_ledger_unique_ref): `creditLedger.create` lanza el mismo error P2002
 * que Postgres si ya existe un asiento con esa clave, para poder probar la
 * idempotencia real ante escrituras concurrentes (no solo un chequeo previo).
 */
function createFakePrisma(userId: string, initialCredits: number) {
  let creditsRemaining = initialCredits;
  let nextId = 0;
  const ledger: { id: string; userId: string; delta: number; reason: string; refId: string | null }[] = [];

  const client: any = {
    user: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) =>
        where.id === userId ? { creditsRemaining } : null,
      ),
      findUniqueOrThrow: vi.fn(async ({ where }: { where: { id: string } }) => {
        if (where.id !== userId) throw new Error('Usuario no encontrado');
        return { creditsRemaining };
      }),
      update: vi.fn(async ({ data }: { data: { creditsRemaining: { decrement?: number; increment?: number } } }) => {
        if (data.creditsRemaining.decrement != null) creditsRemaining -= data.creditsRemaining.decrement;
        if (data.creditsRemaining.increment != null) creditsRemaining += data.creditsRemaining.increment;
        return { creditsRemaining };
      }),
      // Imita el UPDATE condicional atómico de Postgres: solo descuenta (y
      // reporta count: 1) si la fila todavía cumple el WHERE en el momento de
      // escribir, igual que `consumeWithClient` espera de Prisma/Postgres.
      updateMany: vi.fn(
        async ({
          where,
          data,
        }: {
          where: { id: string; creditsRemaining?: { gte: number } };
          data: { creditsRemaining: { decrement?: number; increment?: number } };
        }) => {
          if (where.id !== userId) return { count: 0 };
          if (where.creditsRemaining?.gte != null && creditsRemaining < where.creditsRemaining.gte) {
            return { count: 0 };
          }
          if (data.creditsRemaining.decrement != null) creditsRemaining -= data.creditsRemaining.decrement;
          if (data.creditsRemaining.increment != null) creditsRemaining += data.creditsRemaining.increment;
          return { count: 1 };
        },
      ),
    },
    creditLedger: {
      create: vi.fn(async ({ data }: { data: { userId: string; delta: number; reason: string; refId: string | null } }) => {
        if (
          data.refId != null &&
          ledger.some((e) => e.userId === data.userId && e.reason === data.reason && e.refId === data.refId)
        ) {
          throw new Prisma.PrismaClientKnownRequestError(
            'Unique constraint failed on the fields: (`userId`,`reason`,`refId`)',
            { code: 'P2002', clientVersion: '5.22.0' },
          );
        }
        const entry = { id: String(nextId++), ...data };
        ledger.push(entry);
        return entry;
      }),
      findFirst: vi.fn(
        async ({ where }: { where: { userId: string; reason: string; refId: string } }) =>
          ledger.find((e) => e.userId === where.userId && e.reason === where.reason && e.refId === where.refId) ??
          null,
      ),
      aggregate: vi.fn(async ({ where }: { where: { userId: string } }) => ({
        _sum: { delta: ledger.filter((e) => e.userId === where.userId).reduce((sum, e) => sum + e.delta, 0) },
      })),
    },
    $transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) => callback(client)),
  };

  return { client, ledger, getCredits: () => creditsRemaining };
}

describe('CreditsService', () => {
  const userId = 'user-1';

  describe('consume', () => {
    it('descuenta el saldo y registra un asiento negativo en el ledger', async () => {
      const fake = createFakePrisma(userId, 10);
      const service = new CreditsService(fake.client);

      const balance = await service.consume(userId, 3, 'APPLICATION');

      expect(balance).toBe(7);
      expect(fake.getCredits()).toBe(7);
      expect(fake.ledger).toEqual([expect.objectContaining({ userId, delta: -3, reason: 'APPLICATION' })]);
    });

    it('rechaza con 402 y no descuenta si el saldo es insuficiente', async () => {
      const fake = createFakePrisma(userId, 2);
      const service = new CreditsService(fake.client);

      await expect(service.consume(userId, 3, 'APPLICATION')).rejects.toThrow(HttpException);
      expect(fake.getCredits()).toBe(2);
      expect(fake.ledger).toHaveLength(0);
    });

    it('no permite que el saldo quede negativo aunque se llame justo en el límite', async () => {
      const fake = createFakePrisma(userId, 1);
      const service = new CreditsService(fake.client);

      await expect(service.consume(userId, 2, 'APPLICATION')).rejects.toThrow(HttpException);
      expect(fake.getCredits()).toBe(1);
    });
  });

  describe('grant', () => {
    it('otorga créditos e incrementa el saldo', async () => {
      const fake = createFakePrisma(userId, 0);
      const service = new CreditsService(fake.client);

      const balance = await service.grant(userId, 80, 'SUBSCRIPTION_GRANT', 'sub_123');

      expect(balance).toBe(80);
      expect(fake.ledger).toHaveLength(1);
    });

    it('es idempotente por refId: dos llamadas con el mismo (userId, reason, refId) acreditan una sola vez', async () => {
      const fake = createFakePrisma(userId, 0);
      const service = new CreditsService(fake.client);

      const first = await service.grant(userId, 80, 'SUBSCRIPTION_GRANT', 'invoice_abc');
      const second = await service.grant(userId, 80, 'SUBSCRIPTION_GRANT', 'invoice_abc');

      expect(first).toBe(80);
      expect(second).toBe(80);
      expect(fake.ledger).toHaveLength(1);
    });

    it('reintentos de webhook (mismo refId) no duplican crédito incluso repetidos varias veces', async () => {
      const fake = createFakePrisma(userId, 0);
      const service = new CreditsService(fake.client);

      await Promise.all(
        Array.from({ length: 5 }, () => service.grant(userId, 80, 'SUBSCRIPTION_GRANT', 'invoice_retry')),
      );

      expect(fake.getCredits()).toBe(80);
      expect(fake.ledger).toHaveLength(1);
    });

    it('sin refId, cada llamada otorga créditos de forma independiente (no hay clave de idempotencia)', async () => {
      const fake = createFakePrisma(userId, 0);
      const service = new CreditsService(fake.client);

      await service.grant(userId, 5, 'ADMIN');
      await service.grant(userId, 5, 'ADMIN');

      expect(fake.getCredits()).toBe(10);
      expect(fake.ledger).toHaveLength(2);
    });
  });

  describe('ledgerBalance', () => {
    it('suma los deltas del ledger como fuente de verdad', async () => {
      const fake = createFakePrisma(userId, 10);
      const service = new CreditsService(fake.client);

      await service.consume(userId, 3, 'APPLICATION');
      await service.grant(userId, 20, 'SUBSCRIPTION_GRANT', 'sub_1');

      expect(await service.ledgerBalance(userId)).toBe(-3 + 20);
    });
  });
});
