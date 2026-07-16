import { describe, expect, it, vi } from 'vitest';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { CompaniesService } from './companies.service.js';

/**
 * Prisma en memoria para Company/CompanyMember/User, con `$transaction` que
 * revierte mutaciones si el callback lanza (mismo patrón que
 * applications.service.spec.ts) — necesario para probar que `create()` deja
 * al creador como OWNER atómicamente y que `removeMember()` revierte el
 * delete si dejaría la empresa sin ningún OWNER.
 */
function createFakePrisma() {
  const companies = new Map<string, any>();
  const members = new Map<string, any>(); // key: `${companyId}:${userId}`
  const users = new Map<string, { id: string; email: string }>();
  let nextCompanyId = 1;
  let nextMemberId = 1;

  const client: any = {
    company: {
      findUnique: vi.fn(async ({ where }: any) => {
        if (where.id) return companies.get(where.id) ?? null;
        if (where.slug) return [...companies.values()].find((c) => c.slug === where.slug) ?? null;
        return null;
      }),
      create: vi.fn(async ({ data }: any) => {
        const company = { id: `company-${nextCompanyId++}`, ...data };
        companies.set(company.id, company);
        return company;
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const existing = companies.get(where.id);
        const updated = { ...existing, ...data };
        companies.set(where.id, updated);
        return updated;
      }),
    },
    companyMember: {
      findUnique: vi.fn(async ({ where }: any) => {
        const key = `${where.companyId_userId.companyId}:${where.companyId_userId.userId}`;
        return members.get(key) ?? null;
      }),
      findFirst: vi.fn(async ({ where }: any) => {
        return (
          [...members.values()].find((m) => m.companyId === where.companyId && m.userId === where.userId) ?? null
        );
      }),
      findMany: vi.fn(async ({ where, select }: any) => {
        const matches = where?.userId
          ? [...members.values()].filter((m) => m.userId === where.userId)
          : where?.companyId
            ? [...members.values()].filter((m) => m.companyId === where.companyId)
            : [...members.values()];
        if (!select?.company) return matches;
        return matches.map((m) => ({ ...m, company: companies.get(m.companyId) }));
      }),
      create: vi.fn(async ({ data }: any) => {
        const member = { id: `member-${nextMemberId++}`, ...data };
        members.set(`${data.companyId}:${data.userId}`, member);
        return member;
      }),
      delete: vi.fn(async ({ where }: any) => {
        const entry = [...members.entries()].find(([, m]) => m.id === where.id);
        if (!entry) throw new Error('not found');
        members.delete(entry[0]);
        return entry[1];
      }),
      count: vi.fn(async ({ where }: any) => {
        return [...members.values()].filter((m) => m.companyId === where.companyId && m.role === where.role).length;
      }),
    },
    user: {
      findUnique: vi.fn(async ({ where }: any) => {
        if (where.email) return [...users.values()].find((u) => u.email === where.email) ?? null;
        return users.get(where.id) ?? null;
      }),
    },
    $transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) => {
      const snapshot = {
        companies: new Map(companies),
        members: new Map(members),
      };
      try {
        return await callback(client);
      } catch (err) {
        companies.clear();
        for (const [k, v] of snapshot.companies) companies.set(k, v);
        members.clear();
        for (const [k, v] of snapshot.members) members.set(k, v);
        throw err;
      }
    }),
  };

  return { client, companies, members, users };
}

describe('CompaniesService', () => {
  describe('create', () => {
    it('crea la empresa y deja al creador como OWNER en la misma transacción', async () => {
      const fake = createFakePrisma();
      const service = new CompaniesService(fake.client);

      const company = await service.create('user-1', { name: 'Acme', slug: 'acme' });

      expect(company.slug).toBe('acme');
      const membership = fake.members.get(`${company.id}:user-1`);
      expect(membership).toMatchObject({ role: 'OWNER', userId: 'user-1' });
    });

    it('rechaza un slug ya en uso', async () => {
      const fake = createFakePrisma();
      const service = new CompaniesService(fake.client);
      await service.create('user-1', { name: 'Acme', slug: 'acme' });

      await expect(service.create('user-2', { name: 'Acme Clone', slug: 'acme' })).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('addMember', () => {
    it('agrega un miembro existente por correo', async () => {
      const fake = createFakePrisma();
      fake.users.set('user-2', { id: 'user-2', email: 'rh@acme.com' });
      const service = new CompaniesService(fake.client);
      const company = await service.create('user-1', { name: 'Acme', slug: 'acme' });

      const member = await service.addMember(company.id, { email: 'rh@acme.com', role: 'RECRUITER' });

      expect(member.role).toBe('RECRUITER');
      expect(fake.members.get(`${company.id}:user-2`)).toBeDefined();
    });

    it('lanza NotFoundException si el correo no corresponde a ningún usuario', async () => {
      const fake = createFakePrisma();
      const service = new CompaniesService(fake.client);
      const company = await service.create('user-1', { name: 'Acme', slug: 'acme' });

      await expect(
        service.addMember(company.id, { email: 'nadie@nab.app', role: 'RECRUITER' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('rechaza agregar dos veces al mismo usuario', async () => {
      const fake = createFakePrisma();
      fake.users.set('user-2', { id: 'user-2', email: 'rh@acme.com' });
      const service = new CompaniesService(fake.client);
      const company = await service.create('user-1', { name: 'Acme', slug: 'acme' });
      await service.addMember(company.id, { email: 'rh@acme.com', role: 'RECRUITER' });

      await expect(service.addMember(company.id, { email: 'rh@acme.com', role: 'RECRUITER' })).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('removeMember', () => {
    it('elimina un RECRUITER sin restricciones', async () => {
      const fake = createFakePrisma();
      fake.users.set('user-2', { id: 'user-2', email: 'rh@acme.com' });
      const service = new CompaniesService(fake.client);
      const company = await service.create('user-1', { name: 'Acme', slug: 'acme' });
      await service.addMember(company.id, { email: 'rh@acme.com', role: 'RECRUITER' });

      await service.removeMember(company.id, 'user-2');

      expect(fake.members.get(`${company.id}:user-2`)).toBeUndefined();
    });

    it('protege al último OWNER: rechaza y revierte el delete', async () => {
      const fake = createFakePrisma();
      const service = new CompaniesService(fake.client);
      const company = await service.create('user-1', { name: 'Acme', slug: 'acme' });

      await expect(service.removeMember(company.id, 'user-1')).rejects.toThrow(ConflictException);
      // La transacción debe haber revertido el delete: el OWNER sigue ahí.
      expect(fake.members.get(`${company.id}:user-1`)).toMatchObject({ role: 'OWNER' });
    });

    it('permite eliminar un OWNER si queda al menos otro OWNER', async () => {
      const fake = createFakePrisma();
      fake.users.set('user-2', { id: 'user-2', email: 'owner2@acme.com' });
      const service = new CompaniesService(fake.client);
      const company = await service.create('user-1', { name: 'Acme', slug: 'acme' });
      await service.addMember(company.id, { email: 'owner2@acme.com', role: 'OWNER' });

      await service.removeMember(company.id, 'user-1');

      expect(fake.members.get(`${company.id}:user-1`)).toBeUndefined();
      expect(fake.members.get(`${company.id}:user-2`)).toMatchObject({ role: 'OWNER' });
    });

    it('lanza NotFoundException si el miembro no existe', async () => {
      const fake = createFakePrisma();
      const service = new CompaniesService(fake.client);
      const company = await service.create('user-1', { name: 'Acme', slug: 'acme' });

      await expect(service.removeMember(company.id, 'no-existe')).rejects.toThrow(NotFoundException);
    });
  });

  describe('listMine', () => {
    it('lista las empresas del usuario con su rol', async () => {
      const fake = createFakePrisma();
      const service = new CompaniesService(fake.client);
      const company = await service.create('user-1', { name: 'Acme', slug: 'acme' });

      const mine = await service.listMine('user-1');

      expect(mine).toEqual([expect.objectContaining({ id: company.id, role: 'OWNER' })]);
    });
  });
});
