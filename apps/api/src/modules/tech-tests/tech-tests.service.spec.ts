import { describe, expect, it, vi } from 'vitest';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { CreditsService } from '../billing/credits.service.js';
import { TechTestsService } from './tech-tests.service.js';

function createFakePrisma() {
  const tests = new Map<string, any>();
  const jobs = new Map<string, any>();
  const users = new Map<string, { id: string; creditsRemaining: number }>();
  const ledger: { userId: string; delta: number; reason: string; refId: string | null }[] = [];
  let nextId = 1;

  const client: any = {
    techTest: {
      create: vi.fn(async ({ data }: any) => {
        // Imita los @default(...) de Prisma que el fake no aplica solo.
        const test = { version: 1, status: 'GENERATING', id: `test-${nextId++}`, ...data, createdAt: new Date(), updatedAt: new Date() };
        tests.set(test.id, test);
        return test;
      }),
      findFirst: vi.fn(async ({ where }: any) => {
        const t = tests.get(where.id);
        return t && t.companyId === where.companyId ? t : null;
      }),
      findMany: vi.fn(async ({ where }: any) => [...tests.values()].filter((t) => t.companyId === where.companyId)),
      update: vi.fn(async ({ where, data }: any) => {
        const t = tests.get(where.id);
        const updated = { ...t, ...data };
        tests.set(where.id, updated);
        return updated;
      }),
    },
    job: {
      findFirst: vi.fn(async ({ where }: any) => {
        const j = jobs.get(where.id);
        return j && j.companyId === where.companyId ? j : null;
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const j = jobs.get(where.id);
        const updated = { ...j, ...data };
        jobs.set(where.id, updated);
        return updated;
      }),
    },
    user: {
      findUnique: vi.fn(async ({ where }: any) => users.get(where.id) ?? null),
      findUniqueOrThrow: vi.fn(async ({ where }: any) => {
        const u = users.get(where.id);
        if (!u) throw new Error('not found');
        return u;
      }),
      updateMany: vi.fn(async ({ where, data }: any) => {
        const u = users.get(where.id);
        if (!u) return { count: 0 };
        if (where.creditsRemaining?.gte != null && u.creditsRemaining < where.creditsRemaining.gte) return { count: 0 };
        if (data.creditsRemaining.decrement != null) u.creditsRemaining -= data.creditsRemaining.decrement;
        return { count: 1 };
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const u = users.get(where.id)!;
        if (data.creditsRemaining.increment != null) u.creditsRemaining += data.creditsRemaining.increment;
        return { creditsRemaining: u.creditsRemaining };
      }),
    },
    creditLedger: {
      create: vi.fn(async ({ data }: any) => {
        ledger.push(data);
        return data;
      }),
    },
    $transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) => {
      const snapshot = { tests: new Map(tests), users: new Map([...users].map(([k, v]) => [k, { ...v }])) };
      try {
        return await callback(client);
      } catch (err) {
        tests.clear();
        for (const [k, v] of snapshot.tests) tests.set(k, v);
        users.clear();
        for (const [k, v] of snapshot.users) users.set(k, v);
        throw err;
      }
    }),
  };

  return { client, tests, jobs, users, ledger };
}

function buildService(fake: ReturnType<typeof createFakePrisma>) {
  const credits = new CreditsService(fake.client);
  const queue = { add: vi.fn().mockResolvedValue(undefined) };
  const service = new TechTestsService(fake.client, credits, queue as any);
  return { service, queue };
}

const input = { roleTitle: 'Backend Engineer', spec: 'Buscamos experiencia con Node.js.', keySkills: [] as string[] };

describe('TechTestsService', () => {
  describe('create', () => {
    it('cobra el crédito y crea GENERATING en la misma transacción, luego encola con jobId estable', async () => {
      const fake = createFakePrisma();
      fake.users.set('user-1', { id: 'user-1', creditsRemaining: 10 });
      const { service, queue } = buildService(fake);

      const test = await service.create('company-1', 'user-1', input);

      expect(test.status).toBe('GENERATING');
      expect(fake.users.get('user-1')?.creditsRemaining).toBe(5);
      expect(fake.ledger).toEqual([
        expect.objectContaining({ userId: 'user-1', delta: -5, reason: 'TEST_GENERATION', refId: test.id }),
      ]);
      expect(queue.add).toHaveBeenCalledWith('generate-test', { testId: test.id }, { jobId: `gen-${test.id}` });
    });

    it('sin crédito suficiente, no crea el registro ni encola (atomicidad)', async () => {
      const fake = createFakePrisma();
      fake.users.set('user-1', { id: 'user-1', creditsRemaining: 2 });
      const { service, queue } = buildService(fake);

      await expect(service.create('company-1', 'user-1', input)).rejects.toThrow();
      expect(fake.tests.size).toBe(0);
      expect(queue.add).not.toHaveBeenCalled();
    });

    it('si encolar falla DESPUÉS de cobrar (blip de Redis), reembolsa y marca FAILED en el mismo request', async () => {
      const fake = createFakePrisma();
      fake.users.set('user-1', { id: 'user-1', creditsRemaining: 10 });
      const credits = new CreditsService(fake.client);
      const queue = { add: vi.fn().mockRejectedValue(new Error('Redis no disponible')) };
      const service = new TechTestsService(fake.client, credits, queue as any);

      const test = await service.create('company-1', 'user-1', input);

      expect(fake.tests.get(test.id)?.status).toBe('FAILED');
      // Cobró 5 al crear y los recuperó al reembolsar: vuelve a 10.
      expect(fake.users.get('user-1')?.creditsRemaining).toBe(10);
      expect(fake.ledger).toEqual([
        expect.objectContaining({ delta: -5, reason: 'TEST_GENERATION', refId: test.id }),
        expect.objectContaining({ delta: 5, reason: 'REFUND', refId: `techtest:${test.id}` }),
      ]);
    });
  });

  describe('regenerate', () => {
    it('crea una versión nueva con parentId y cobra de nuevo', async () => {
      const fake = createFakePrisma();
      fake.users.set('user-1', { id: 'user-1', creditsRemaining: 10 });
      const { service } = buildService(fake);
      const first = await service.create('company-1', 'user-1', input);

      const second = await service.regenerate('company-1', 'user-1', first.id);

      expect(second.version).toBe(2);
      expect(fake.tests.get(second.id)?.parentId).toBe(first.id);
      expect(fake.users.get('user-1')?.creditsRemaining).toBe(0); // 10 - 5 - 5
      expect(fake.ledger).toHaveLength(2);
    });

    it('lanza NotFoundException si la prueba pertenece a OTRA empresa (IDOR)', async () => {
      const fake = createFakePrisma();
      fake.users.set('user-1', { id: 'user-1', creditsRemaining: 10 });
      const { service } = buildService(fake);
      const test = await service.create('company-1', 'user-1', input);

      await expect(service.regenerate('otra-empresa', 'user-1', test.id)).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('edita título/preguntas/rúbrica de una prueba READY', async () => {
      const fake = createFakePrisma();
      fake.users.set('user-1', { id: 'user-1', creditsRemaining: 10 });
      const { service } = buildService(fake);
      const test = await service.create('company-1', 'user-1', input);
      fake.tests.get(test.id)!.status = 'READY';

      const updated = await service.update('company-1', test.id, { title: 'Nuevo título' });

      expect(updated.title).toBe('Nuevo título');
    });

    it('rechaza editar una prueba que todavía está GENERATING', async () => {
      const fake = createFakePrisma();
      fake.users.set('user-1', { id: 'user-1', creditsRemaining: 10 });
      const { service } = buildService(fake);
      const test = await service.create('company-1', 'user-1', input);

      await expect(service.update('company-1', test.id, { title: 'x' })).rejects.toThrow(ConflictException);
    });

    it('lanza NotFoundException si la prueba pertenece a OTRA empresa (IDOR)', async () => {
      const fake = createFakePrisma();
      fake.users.set('user-1', { id: 'user-1', creditsRemaining: 10 });
      const { service } = buildService(fake);
      const test = await service.create('company-1', 'user-1', input);
      fake.tests.get(test.id)!.status = 'READY';

      await expect(service.update('otra-empresa', test.id, { title: 'x' })).rejects.toThrow(NotFoundException);
    });
  });

  describe('attachToJob', () => {
    it('adjunta una prueba READY a una vacante de la misma empresa', async () => {
      const fake = createFakePrisma();
      fake.jobs.set('job-1', { id: 'job-1', companyId: 'company-1', techTestId: null });
      fake.users.set('user-1', { id: 'user-1', creditsRemaining: 10 });
      const { service } = buildService(fake);
      const test = await service.create('company-1', 'user-1', input);
      fake.tests.get(test.id)!.status = 'READY';

      const result = await service.attachToJob('company-1', 'job-1', test.id);

      expect(result.techTestId).toBe(test.id);
    });

    it('rechaza adjuntar una prueba que todavía está GENERATING', async () => {
      const fake = createFakePrisma();
      fake.jobs.set('job-1', { id: 'job-1', companyId: 'company-1', techTestId: null });
      fake.users.set('user-1', { id: 'user-1', creditsRemaining: 10 });
      const { service } = buildService(fake);
      const test = await service.create('company-1', 'user-1', input);

      await expect(service.attachToJob('company-1', 'job-1', test.id)).rejects.toThrow(ConflictException);
    });

    it('lanza NotFoundException si la vacante pertenece a OTRA empresa (IDOR)', async () => {
      const fake = createFakePrisma();
      fake.jobs.set('job-1', { id: 'job-1', companyId: 'otra-empresa', techTestId: null });
      fake.users.set('user-1', { id: 'user-1', creditsRemaining: 10 });
      const { service } = buildService(fake);
      const test = await service.create('company-1', 'user-1', input);
      fake.tests.get(test.id)!.status = 'READY';

      await expect(service.attachToJob('company-1', 'job-1', test.id)).rejects.toThrow(NotFoundException);
    });

    it('lanza NotFoundException si la prueba pertenece a OTRA empresa (IDOR)', async () => {
      const fake = createFakePrisma();
      fake.jobs.set('job-1', { id: 'job-1', companyId: 'company-1', techTestId: null });
      fake.users.set('user-1', { id: 'user-1', creditsRemaining: 10 });
      const { service } = buildService(fake);
      const test = await service.create('otra-empresa', 'user-1', input);
      fake.tests.get(test.id)!.status = 'READY';

      await expect(service.attachToJob('company-1', 'job-1', test.id)).rejects.toThrow(NotFoundException);
    });
  });
});
