import { describe, expect, it, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { CompanyJobsService } from './company-jobs.service.js';

function createFakePrisma() {
  const companies = new Map<string, { id: string; name: string; logoUrl: string | null }>();
  const jobs = new Map<string, any>();
  const applications = new Map<string, any>();

  const client: any = {
    company: {
      findUniqueOrThrow: vi.fn(async ({ where }: any) => {
        const c = companies.get(where.id);
        if (!c) throw new Error('not found');
        return c;
      }),
    },
    job: {
      create: vi.fn(async ({ data }: any) => {
        const job = { ...data, isActive: data.isActive ?? true, createdAt: new Date() };
        jobs.set(job.id, job);
        return job;
      }),
      findMany: vi.fn(async ({ where }: any) =>
        [...jobs.values()].filter((j) => j.companyId === where.companyId),
      ),
      findFirst: vi.fn(async ({ where }: any) => {
        const job = jobs.get(where.id);
        return job && job.companyId === where.companyId ? job : null;
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const job = jobs.get(where.id);
        const updated = { ...job, ...data };
        jobs.set(where.id, updated);
        return updated;
      }),
    },
    application: {
      findMany: vi.fn(async ({ where }: any) =>
        [...applications.values()].filter(
          (a) => a.jobId === where.jobId && (!where.status || a.status === where.status),
        ),
      ),
      findFirst: vi.fn(async ({ where }: any) => {
        const app = applications.get(where.id);
        if (!app) return null;
        const job = jobs.get(app.jobId);
        if (!job || job.companyId !== where.job.companyId) return null;
        return { ...app, job: { title: job.title, company: job.company } };
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const app = applications.get(where.id);
        const updated = { ...app, status: data.status };
        applications.set(where.id, updated);
        return { id: updated.id, status: updated.status };
      }),
    },
  };

  return { client, companies, jobs, applications };
}

function buildService(fake: ReturnType<typeof createFakePrisma>) {
  const realtime = { emitToUser: vi.fn() };
  const queue = { add: vi.fn().mockResolvedValue(undefined) };
  const service = new CompanyJobsService(fake.client, realtime as any, queue as any);
  return { service, realtime, queue };
}

describe('CompanyJobsService', () => {
  const companyId = 'company-1';

  describe('create', () => {
    it('crea la vacante con source=COMPANY, externalId=id, y encola el embedding', async () => {
      const fake = createFakePrisma();
      fake.companies.set(companyId, { id: companyId, name: 'Acme', logoUrl: null });
      const { service, queue } = buildService(fake);

      const job = await service.create(companyId, {
        title: 'Backend Engineer',
        remote: true,
        description: 'Descripción larga de la vacante para pasar la validación mínima.',
        currency: 'USD',
      });

      expect(job.source).toBe('COMPANY');
      expect(job.externalId).toBe(job.id);
      expect(job.companyId).toBe(companyId);
      expect(job.applyUrl).toBeNull();
      expect(queue.add).toHaveBeenCalledWith('embed-job', { jobId: job.id });
    });
  });

  describe('getById / update (IDOR)', () => {
    it('lanza NotFoundException si la vacante pertenece a OTRA empresa', async () => {
      const fake = createFakePrisma();
      fake.companies.set(companyId, { id: companyId, name: 'Acme', logoUrl: null });
      const { service } = buildService(fake);
      const job = await service.create(companyId, {
        title: 'Backend Engineer',
        remote: true,
        description: 'Descripción larga de la vacante para pasar la validación mínima.',
        currency: 'USD',
      });

      await expect(service.getById('otra-empresa', job.id)).rejects.toThrow(NotFoundException);
      await expect(
        service.update('otra-empresa', job.id, { title: 'Hackeado' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('re-encola el embedding si cambia el título/descripción/ubicación', async () => {
      const fake = createFakePrisma();
      fake.companies.set(companyId, { id: companyId, name: 'Acme', logoUrl: null });
      const { service, queue } = buildService(fake);
      const job = await service.create(companyId, {
        title: 'Backend Engineer',
        remote: true,
        description: 'Descripción larga de la vacante para pasar la validación mínima.',
        currency: 'USD',
      });
      queue.add.mockClear();

      await service.update(companyId, job.id, { title: 'Senior Backend Engineer' });

      expect(queue.add).toHaveBeenCalledWith('embed-job', { jobId: job.id });
    });

    it('NO re-encola el embedding si solo cambia isActive', async () => {
      const fake = createFakePrisma();
      fake.companies.set(companyId, { id: companyId, name: 'Acme', logoUrl: null });
      const { service, queue } = buildService(fake);
      const job = await service.create(companyId, {
        title: 'Backend Engineer',
        remote: true,
        description: 'Descripción larga de la vacante para pasar la validación mínima.',
        currency: 'USD',
      });
      queue.add.mockClear();

      await service.update(companyId, job.id, { isActive: false });

      expect(queue.add).not.toHaveBeenCalled();
    });
  });

  describe('updateApplicantStatus', () => {
    it('actualiza el estado y notifica al candidato por realtime', async () => {
      const fake = createFakePrisma();
      fake.companies.set(companyId, { id: companyId, name: 'Acme', logoUrl: null });
      const { service, realtime } = buildService(fake);
      const job = await service.create(companyId, {
        title: 'Backend Engineer',
        remote: true,
        description: 'Descripción larga de la vacante para pasar la validación mínima.',
        currency: 'USD',
      });
      fake.applications.set('app-1', { id: 'app-1', jobId: job.id, userId: 'candidate-1', status: 'APPLIED' });

      const result = await service.updateApplicantStatus(companyId, 'app-1', 'INTERVIEW');

      expect(result.status).toBe('INTERVIEW');
      expect(realtime.emitToUser).toHaveBeenCalledWith(
        'candidate-1',
        'application.status_changed',
        expect.objectContaining({ applicationId: 'app-1', status: 'INTERVIEW' }),
      );
    });

    it('lanza NotFoundException si la aplicación pertenece a una vacante de OTRA empresa (IDOR)', async () => {
      const fake = createFakePrisma();
      fake.companies.set(companyId, { id: companyId, name: 'Acme', logoUrl: null });
      const { service } = buildService(fake);
      const job = await service.create(companyId, {
        title: 'Backend Engineer',
        remote: true,
        description: 'Descripción larga de la vacante para pasar la validación mínima.',
        currency: 'USD',
      });
      fake.applications.set('app-1', { id: 'app-1', jobId: job.id, userId: 'candidate-1', status: 'APPLIED' });

      await expect(
        service.updateApplicantStatus('otra-empresa', 'app-1', 'INTERVIEW'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
