import { describe, expect, it, vi } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ThreadsService } from './threads.service.js';

function createFakePrisma() {
  const applications = new Map<string, any>();
  const threads = new Map<string, any>(); // key: id
  const threadByApplicationId = new Map<string, string>();
  const messages = new Map<string, any>(); // key: id
  const users = new Map<string, any>();
  let nextId = 1;

  const client: any = {
    application: {
      findFirst: vi.fn(async ({ where }: any) => {
        const a = applications.get(where.id);
        if (!a || a.userId !== where.userId) return null;
        return a;
      }),
    },
    applicationThread: {
      findUnique: vi.fn(async ({ where }: any) => {
        const id = threadByApplicationId.get(where.applicationId);
        return id ? threads.get(id) : null;
      }),
      create: vi.fn(async ({ data }: any) => {
        const id = `thread-${nextId++}`;
        const thread = { id, ...data, updatedAt: new Date(), createdAt: new Date() };
        threads.set(id, thread);
        threadByApplicationId.set(data.applicationId, id);
        return thread;
      }),
      findFirst: vi.fn(async ({ where }: any) => {
        const t = threads.get(where.id);
        return t && t.companyId === where.companyId ? t : null;
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const t = threads.get(where.id);
        Object.assign(t, data);
        return t;
      }),
      findMany: vi.fn(async ({ where }: any) => {
        return [...threads.values()]
          .filter((t) => {
            if (t.companyId !== where.companyId) return false;
            if (where.application?.jobId) {
              const app = applications.get(t.applicationId);
              if (app?.jobId !== where.application.jobId) return false;
            }
            return true;
          })
          .map((t) => {
            const app = applications.get(t.applicationId);
            const threadMessages = [...messages.values()]
              .filter((m) => m.threadId === t.id)
              .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
            return {
              id: t.id,
              applicationId: t.applicationId,
              createdAt: t.createdAt,
              candidateUser: { id: t.candidateUserId, name: 'Candidato', email: 'c@test.com', avatarUrl: null },
              application: { jobId: app?.jobId, job: { title: 'Vacante de prueba' } },
              messages: threadMessages.slice(0, 1),
              _count: { messages: threadMessages.filter((m) => !m.fromCompany && m.readAt === null).length },
            };
          });
      }),
    },
    threadMessage: {
      create: vi.fn(async ({ data }: any) => {
        const id = `msg-${nextId++}`;
        const msg = { id, ...data, readAt: data.readAt ?? null, createdAt: new Date() };
        messages.set(id, msg);
        return msg;
      }),
      findMany: vi.fn(async ({ where }: any) => {
        return [...messages.values()].filter((m) => m.threadId === where.threadId);
      }),
      updateMany: vi.fn(async ({ where, data }: any) => {
        let count = 0;
        for (const m of messages.values()) {
          if (m.threadId !== where.threadId) continue;
          if (where.fromCompany !== undefined && m.fromCompany !== where.fromCompany) continue;
          if (where.readAt === null && m.readAt !== null) continue;
          Object.assign(m, data);
          count++;
        }
        return { count };
      }),
      count: vi.fn(async ({ where }: any) => {
        return [...messages.values()].filter((m) => {
          if (m.fromCompany !== where.fromCompany) return false;
          if (where.readAt === null && m.readAt !== null) return false;
          const t = threads.get(m.threadId);
          if (where.thread?.candidateUserId && t?.candidateUserId !== where.thread.candidateUserId) return false;
          if (where.thread?.companyId && t?.companyId !== where.thread.companyId) return false;
          return true;
        }).length;
      }),
    },
    user: {
      findUnique: vi.fn(async ({ where }: any) => users.get(where.id) ?? null),
    },
  };

  return { client, applications, threads, messages, users };
}

function createService(fake: { client: any }, overrides: { realtime?: any; push?: any } = {}) {
  const realtime = overrides.realtime ?? {
    emitToCompany: vi.fn(),
    emitToUser: vi.fn(),
    isUserOnline: vi.fn(async () => true),
  };
  const push = overrides.push ?? { send: vi.fn() };
  return { service: new ThreadsService(fake.client, realtime, push), realtime, push };
}

describe('ThreadsService — lado candidato', () => {
  it('crea el hilo (lazy) en el primer acceso a una aplicación COMPANY', async () => {
    const fake = createFakePrisma();
    fake.applications.set('app-1', { id: 'app-1', userId: 'user-1', jobId: 'job-1', job: { source: 'COMPANY', companyId: 'company-1' } });
    const { service } = createService(fake);

    const thread = await service.getThreadForCandidate('app-1', 'user-1');

    expect(thread.applicationId).toBe('app-1');
    expect(fake.threads.get(thread.id)?.companyId).toBe('company-1');
    expect(fake.threads.get(thread.id)?.candidateUserId).toBe('user-1');
  });

  it('reutiliza el mismo hilo en accesos posteriores (no duplica)', async () => {
    const fake = createFakePrisma();
    fake.applications.set('app-1', { id: 'app-1', userId: 'user-1', jobId: 'job-1', job: { source: 'COMPANY', companyId: 'company-1' } });
    const { service } = createService(fake);

    const t1 = await service.getThreadForCandidate('app-1', 'user-1');
    const t2 = await service.getThreadForCandidate('app-1', 'user-1');

    expect(t1.id).toBe(t2.id);
    expect(fake.threads.size).toBe(1);
  });

  it('rechaza (BadRequest) si la vacante no es de tipo COMPANY', async () => {
    const fake = createFakePrisma();
    fake.applications.set('app-1', { id: 'app-1', userId: 'user-1', jobId: 'job-1', job: { source: 'GREENHOUSE', companyId: null } });
    const { service } = createService(fake);

    await expect(service.getThreadForCandidate('app-1', 'user-1')).rejects.toThrow(BadRequestException);
  });

  it('lanza NotFoundException si la aplicación no pertenece al usuario (IDOR)', async () => {
    const fake = createFakePrisma();
    fake.applications.set('app-1', { id: 'app-1', userId: 'OTRO-usuario', jobId: 'job-1', job: { source: 'COMPANY', companyId: 'company-1' } });
    const { service } = createService(fake);

    await expect(service.getThreadForCandidate('app-1', 'user-1')).rejects.toThrow(NotFoundException);
  });

  it('enviar un mensaje adelanta updatedAt del hilo (para que la lista de RH ordene por actividad reciente)', async () => {
    const fake = createFakePrisma();
    fake.applications.set('app-1', { id: 'app-1', userId: 'user-1', jobId: 'job-1', job: { source: 'COMPANY', companyId: 'company-1' } });
    const { service } = createService(fake);
    const thread = await service.getThreadForCandidate('app-1', 'user-1');
    const createdAt = fake.threads.get(thread.id)!.updatedAt;
    await new Promise((r) => setTimeout(r, 5));

    await service.sendMessageAsCandidate('app-1', 'user-1', 'mensaje');

    expect(fake.threads.get(thread.id)!.updatedAt.getTime()).toBeGreaterThan(createdAt.getTime());
  });

  it('sendMessageAsCandidate emite thread.message a la sala de la empresa, no a un usuario', async () => {
    const fake = createFakePrisma();
    fake.applications.set('app-1', { id: 'app-1', userId: 'user-1', jobId: 'job-1', job: { source: 'COMPANY', companyId: 'company-1' } });
    const { service, realtime } = createService(fake);

    const message = await service.sendMessageAsCandidate('app-1', 'user-1', 'Hola, tengo una duda');

    expect(message.fromCompany).toBe(false);
    expect(message.senderUserId).toBe('user-1');
    expect(realtime.emitToCompany).toHaveBeenCalledWith(
      'company-1',
      'thread.message',
      expect.objectContaining({ applicationId: 'app-1' }),
    );
  });

  it('markReadForCandidate solo marca leídos los mensajes DEL LADO EMPRESA', async () => {
    const fake = createFakePrisma();
    fake.applications.set('app-1', { id: 'app-1', userId: 'user-1', jobId: 'job-1', job: { source: 'COMPANY', companyId: 'company-1' } });
    const { service } = createService(fake);
    await service.sendMessageAsCandidate('app-1', 'user-1', 'mensaje del candidato');
    const threadId = [...fake.threads.keys()][0]!;
    fake.messages.set('msg-rh-1', { id: 'msg-rh-1', threadId, senderUserId: 'rh-1', fromCompany: true, content: 'hola', readAt: null, createdAt: new Date() });

    await service.markReadForCandidate('app-1', 'user-1');

    const candidateMsg = [...fake.messages.values()].find((m) => !m.fromCompany);
    const rhMsg = fake.messages.get('msg-rh-1');
    expect(rhMsg?.readAt).not.toBeNull();
    expect(candidateMsg?.readAt).toBeNull(); // el propio mensaje del candidato no se autolee
  });
});

describe('ThreadsService — lado empresa', () => {
  async function seedThread(fake: ReturnType<typeof createFakePrisma>) {
    fake.applications.set('app-1', { id: 'app-1', userId: 'user-1', jobId: 'job-1', job: { source: 'COMPANY', companyId: 'company-1' } });
    const { service } = createService(fake);
    await service.getThreadForCandidate('app-1', 'user-1');
    return [...fake.threads.keys()][0]!;
  }

  it('lanza NotFoundException si el hilo pertenece a OTRA empresa (IDOR)', async () => {
    const fake = createFakePrisma();
    const threadId = await seedThread(fake);
    const { service } = createService(fake);

    await expect(service.listMessagesForCompany('OTRA-empresa', threadId)).rejects.toThrow(NotFoundException);
  });

  it('sendMessageAsCompany emite a user:{candidateId} y NO envía push si el candidato está online', async () => {
    const fake = createFakePrisma();
    const threadId = await seedThread(fake);
    const push = { send: vi.fn() };
    const realtime = { emitToCompany: vi.fn(), emitToUser: vi.fn(), isUserOnline: vi.fn(async () => true) };
    const { service } = createService(fake, { realtime, push });

    const message = await service.sendMessageAsCompany('company-1', threadId, 'rh-1', 'Hola, vimos tu aplicación');

    expect(message.fromCompany).toBe(true);
    expect(realtime.emitToUser).toHaveBeenCalledWith('user-1', 'thread.message', expect.anything());
    expect(push.send).not.toHaveBeenCalled();
  });

  it('sendMessageAsCompany envía push si el candidato está OFFLINE y tiene expoPushToken', async () => {
    const fake = createFakePrisma();
    const threadId = await seedThread(fake);
    fake.users.set('user-1', { id: 'user-1', expoPushToken: 'ExponentPushToken[xxx]', name: 'Candidato' });
    const push = { send: vi.fn() };
    const realtime = { emitToCompany: vi.fn(), emitToUser: vi.fn(), isUserOnline: vi.fn(async () => false) };
    const { service } = createService(fake, { realtime, push });

    await service.sendMessageAsCompany('company-1', threadId, 'rh-1', 'Hola, vimos tu aplicación');

    expect(push.send).toHaveBeenCalledWith('ExponentPushToken[xxx]', 'Nuevo mensaje', expect.any(String), expect.anything());
  });

  it('sendMessageAsCompany NO envía push si el candidato está offline pero no tiene expoPushToken', async () => {
    const fake = createFakePrisma();
    const threadId = await seedThread(fake);
    fake.users.set('user-1', { id: 'user-1', expoPushToken: null, name: 'Candidato' });
    const push = { send: vi.fn() };
    const realtime = { emitToCompany: vi.fn(), emitToUser: vi.fn(), isUserOnline: vi.fn(async () => false) };
    const { service } = createService(fake, { realtime, push });

    await service.sendMessageAsCompany('company-1', threadId, 'rh-1', 'Hola');

    expect(push.send).not.toHaveBeenCalled();
  });

  it('listThreadsForCompany filtra por jobId cuando se pasa', async () => {
    const fake = createFakePrisma();
    const threadId1 = await seedThread(fake);
    fake.applications.set('app-2', { id: 'app-2', userId: 'user-2', jobId: 'job-2', job: { source: 'COMPANY', companyId: 'company-1' } });
    const { service: svc2 } = createService(fake);
    await svc2.getThreadForCandidate('app-2', 'user-2');
    const { service } = createService(fake);

    const filtered = await service.listThreadsForCompany('company-1', 'job-1');

    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.id).toBe(threadId1);
  });
});

describe('ThreadsService — conteo de no leídos', () => {
  it('unreadCountForCandidate solo cuenta mensajes DEL LADO EMPRESA sin leer, del propio candidato', async () => {
    const fake = createFakePrisma();
    fake.applications.set('app-1', { id: 'app-1', userId: 'user-1', jobId: 'job-1', job: { source: 'COMPANY', companyId: 'company-1' } });
    fake.applications.set('app-2', { id: 'app-2', userId: 'user-2', jobId: 'job-1', job: { source: 'COMPANY', companyId: 'company-1' } });
    const { service } = createService(fake);
    const threadId1 = (await service.getThreadForCandidate('app-1', 'user-1')).id;
    const threadId2 = (await service.getThreadForCandidate('app-2', 'user-2')).id;
    fake.messages.set('m1', { id: 'm1', threadId: threadId1, senderUserId: 'rh-1', fromCompany: true, content: 'x', readAt: null, createdAt: new Date() });
    fake.messages.set('m2', { id: 'm2', threadId: threadId1, senderUserId: 'user-1', fromCompany: false, content: 'y', readAt: null, createdAt: new Date() });
    fake.messages.set('m3', { id: 'm3', threadId: threadId2, senderUserId: 'rh-1', fromCompany: true, content: 'z', readAt: null, createdAt: new Date() });

    const count = await service.unreadCountForCandidate('user-1');

    expect(count).toBe(1); // solo m1 — m2 es propio, m3 es de otro candidato
  });

  it('unreadCountForCompany solo cuenta mensajes DEL LADO CANDIDATO sin leer, de la propia empresa', async () => {
    const fake = createFakePrisma();
    fake.applications.set('app-1', { id: 'app-1', userId: 'user-1', jobId: 'job-1', job: { source: 'COMPANY', companyId: 'company-1' } });
    const { service } = createService(fake);
    const threadId = (await service.getThreadForCandidate('app-1', 'user-1')).id;
    fake.messages.set('m1', { id: 'm1', threadId, senderUserId: 'user-1', fromCompany: false, content: 'x', readAt: null, createdAt: new Date() });
    fake.messages.set('m2', { id: 'm2', threadId, senderUserId: 'rh-1', fromCompany: true, content: 'y', readAt: null, createdAt: new Date() });

    const count = await service.unreadCountForCompany('company-1');

    expect(count).toBe(1); // solo m1
  });
});
