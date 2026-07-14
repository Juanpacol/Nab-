import { describe, expect, it, vi } from 'vitest';
import { HttpException, BadRequestException, NotFoundException } from '@nestjs/common';
import { CreditsService } from '../billing/credits.service.js';
import { GenerationService } from './generation.service.js';

/**
 * Mismo patrón de Prisma fake que credits.service.spec.ts/applications.service.spec.ts,
 * con rollback real de `$transaction` para poder probar la atomicidad: antes de este
 * servicio, AiController hacía `create()` y `credits.consume()` como pasos separados
 * (mismo bug de clase que ya se había corregido en ApplicationsService.apply()).
 */
function createFakePrisma() {
  const users = new Map<string, { id: string; creditsRemaining: number }>();
  const profiles = new Map<string, { userId: string; headline: string; skills: string[] }>();
  const jobs = new Map<string, any>();
  const resumes = new Map<string, any>();
  const coverLetters = new Map<string, any>();
  const ledger: { userId: string; delta: number; reason: string; refId: string | null }[] = [];
  let nextId = 0;

  const client: any = {
    profile: {
      findUnique: vi.fn(async ({ where }: any) => profiles.get(where.userId) ?? null),
    },
    job: {
      findUnique: vi.fn(async ({ where }: any) => jobs.get(where.id) ?? null),
      update: vi.fn(async ({ where, data }: any) => {
        const job = jobs.get(where.id);
        Object.assign(job, data);
        return job;
      }),
    },
    resume: {
      create: vi.fn(async ({ data }: any) => {
        const created = { id: `resume-${nextId++}`, ...data };
        resumes.set(created.id, created);
        return created;
      }),
    },
    coverLetter: {
      create: vi.fn(async ({ data }: any) => {
        const created = { id: `cover-${nextId++}`, ...data };
        coverLetters.set(created.id, created);
        return created;
      }),
    },
    user: {
      findUnique: vi.fn(async ({ where }: any) => users.get(where.id) ?? null),
      findUniqueOrThrow: vi.fn(async ({ where }: any) => {
        const u = users.get(where.id);
        if (!u) throw new Error('Usuario no encontrado');
        return u;
      }),
      updateMany: vi.fn(async ({ where, data }: any) => {
        const u = users.get(where.id);
        if (!u) return { count: 0 };
        if (where.creditsRemaining?.gte != null && u.creditsRemaining < where.creditsRemaining.gte) {
          return { count: 0 };
        }
        if (data.creditsRemaining.decrement != null) u.creditsRemaining -= data.creditsRemaining.decrement;
        return { count: 1 };
      }),
    },
    creditLedger: {
      create: vi.fn(async ({ data }: any) => {
        ledger.push(data);
        return data;
      }),
    },
    $transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) => {
      const snapshot = { resumes: new Map(resumes), coverLetters: new Map(coverLetters), ledgerLength: ledger.length };
      try {
        return await callback(client);
      } catch (err) {
        resumes.clear();
        for (const [k, v] of snapshot.resumes) resumes.set(k, v);
        coverLetters.clear();
        for (const [k, v] of snapshot.coverLetters) coverLetters.set(k, v);
        ledger.length = snapshot.ledgerLength;
        throw err;
      }
    }),
  };

  return { client, users, profiles, jobs, resumes, coverLetters, ledger };
}

function fakeAi() {
  return {
    generationModel: 'claude-sonnet-5',
    generateResume: vi.fn().mockResolvedValue({
      resume: { headline: 'h', summary: 's', skills: [], experience: [], education: [] },
      ats: { score: 80 },
    }),
    generateCoverLetter: vi.fn().mockResolvedValue('Estimado equipo...'),
    extractJobRequirements: vi.fn().mockResolvedValue({
      requiredSkills: [],
      niceToHaveSkills: [],
      seniority: 'mid',
      atsKeywords: [],
      summary: 'req',
    }),
  };
}

describe('GenerationService', () => {
  const userId = 'user-1';
  const jobId = 'job-1';

  function setup(credits = 5) {
    const fake = createFakePrisma();
    fake.jobs.set(jobId, {
      id: jobId,
      title: 'Backend Engineer',
      company: 'Acme',
      location: null,
      description: 'desc',
      requirementsJson: null,
    });
    fake.profiles.set(userId, { userId, headline: 'Dev', skills: ['TypeScript'] });
    fake.users.set(userId, { id: userId, creditsRemaining: credits });
    const ai = fakeAi();
    const service = new GenerationService(fake.client, ai as any, new CreditsService(fake.client));
    return { fake, ai, service };
  }

  describe('generateAndSaveResume', () => {
    it('genera, guarda y cobra 1 crédito, todo junto', async () => {
      const { fake, service } = setup();

      const result = await service.generateAndSaveResume(userId, jobId);

      expect(fake.users.get(userId)?.creditsRemaining).toBe(4);
      expect(fake.ledger).toHaveLength(1);
      expect(fake.resumes.get(result.resume.id)).toBeDefined();
    });

    it('sin saldo, no queda un Resume huérfano sin cobrar (atomicidad)', async () => {
      const { fake, service } = setup(0);

      await expect(service.generateAndSaveResume(userId, jobId)).rejects.toThrow(HttpException);

      expect(fake.resumes.size).toBe(0);
      expect(fake.ledger).toHaveLength(0);
    });

    it('lanza BadRequestException si el usuario no completó su perfil', async () => {
      const { fake, service } = setup();
      fake.profiles.delete(userId);

      await expect(service.generateAndSaveResume(userId, jobId)).rejects.toThrow(BadRequestException);
    });

    it('lanza NotFoundException si la vacante no existe', async () => {
      const { service } = setup();

      await expect(service.generateAndSaveResume(userId, 'no-existe')).rejects.toThrow(NotFoundException);
    });

    it('cachea los requisitos extraídos en el Job para no volver a llamar a la IA', async () => {
      const { fake, ai, service } = setup();

      await service.generateAndSaveResume(userId, jobId);

      expect(ai.extractJobRequirements).toHaveBeenCalledTimes(1);
      expect(fake.jobs.get(jobId).requirementsJson).toBeDefined();
    });
  });

  describe('generateAndSaveCoverLetter', () => {
    it('genera, guarda y cobra 1 crédito, todo junto', async () => {
      const { fake, service } = setup();

      const result = await service.generateAndSaveCoverLetter(userId, jobId, 'professional');

      expect(fake.users.get(userId)?.creditsRemaining).toBe(4);
      expect(fake.coverLetters.get(result.coverLetter.id)).toBeDefined();
    });

    it('sin saldo, no queda una CoverLetter huérfana sin cobrar (atomicidad)', async () => {
      const { fake, service } = setup(0);

      await expect(service.generateAndSaveCoverLetter(userId, jobId, 'professional')).rejects.toThrow(HttpException);

      expect(fake.coverLetters.size).toBe(0);
    });
  });
});
