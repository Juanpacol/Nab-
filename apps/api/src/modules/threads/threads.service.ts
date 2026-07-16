import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@nab/database';
import { PrismaService } from '../../prisma/prisma.service.js';
import { RealtimeGateway } from '../realtime/realtime.gateway.js';
import { PushService } from '../notifications/push.service.js';

const MESSAGE_SELECT = {
  id: true,
  senderUserId: true,
  fromCompany: true,
  content: true,
  readAt: true,
  createdAt: true,
} as const;

@Injectable()
export class ThreadsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeGateway,
    private readonly push: PushService,
  ) {}

  // ---------- Lado candidato ----------

  /** Lazy-create: solo existe para aplicaciones a vacantes propias de empresa (source COMPANY). */
  private async getOrCreateThreadForApplication(applicationId: string, userId: string) {
    const application = await this.prisma.application.findFirst({
      where: { id: applicationId, userId },
      select: { id: true, job: { select: { source: true, companyId: true } } },
    });
    if (!application) throw new NotFoundException('Aplicación no encontrada');
    if (application.job.source !== 'COMPANY' || !application.job.companyId) {
      throw new BadRequestException('Esta vacante no tiene chat disponible');
    }

    const existing = await this.prisma.applicationThread.findUnique({ where: { applicationId } });
    if (existing) return existing;

    // TOCTOU: dos requests concurrentes (doble-tap) pueden pasar el
    // findUnique a la vez y ambas intentar crear — la segunda choca con
    // @unique([applicationId]); en vez de propagar el 500, se relee el hilo
    // que la otra request ya creó.
    try {
      return await this.prisma.applicationThread.create({
        data: { applicationId, companyId: application.job.companyId, candidateUserId: userId },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        return this.prisma.applicationThread.findUniqueOrThrow({ where: { applicationId } });
      }
      throw err;
    }
  }

  async getThreadForCandidate(applicationId: string, userId: string) {
    const thread = await this.getOrCreateThreadForApplication(applicationId, userId);
    return { id: thread.id, applicationId: thread.applicationId, createdAt: thread.createdAt };
  }

  async listMessagesForCandidate(applicationId: string, userId: string) {
    const thread = await this.getOrCreateThreadForApplication(applicationId, userId);
    return this.prisma.threadMessage.findMany({
      where: { threadId: thread.id },
      select: MESSAGE_SELECT,
      orderBy: { createdAt: 'asc' },
    });
  }

  async sendMessageAsCandidate(applicationId: string, userId: string, content: string) {
    const thread = await this.getOrCreateThreadForApplication(applicationId, userId);
    const message = await this.prisma.threadMessage.create({
      data: { threadId: thread.id, senderUserId: userId, fromCompany: false, content },
      select: MESSAGE_SELECT,
    });
    // Bump manual: crear un ThreadMessage no toca la fila padre, así que
    // @updatedAt de ApplicationThread no avanza solo — sin esto,
    // listThreadsForCompany (orderBy updatedAt) no reflejaría actividad reciente.
    await this.prisma.applicationThread.update({ where: { id: thread.id }, data: { updatedAt: new Date() } });

    this.realtime.emitToCompany(thread.companyId, 'thread.message', {
      threadId: thread.id,
      applicationId: thread.applicationId,
      message,
    });
    return message;
  }

  async markReadForCandidate(applicationId: string, userId: string): Promise<void> {
    const thread = await this.getOrCreateThreadForApplication(applicationId, userId);
    await this.prisma.threadMessage.updateMany({
      where: { threadId: thread.id, fromCompany: true, readAt: null },
      data: { readAt: new Date() },
    });
  }

  // ---------- Lado empresa ----------

  async listThreadsForCompany(companyId: string, jobId?: string) {
    const threads = await this.prisma.applicationThread.findMany({
      where: { companyId, ...(jobId ? { application: { jobId } } : {}) },
      select: {
        id: true,
        applicationId: true,
        createdAt: true,
        candidateUser: { select: { id: true, name: true, email: true, avatarUrl: true } },
        application: { select: { jobId: true, job: { select: { title: true } } } },
        messages: {
          select: MESSAGE_SELECT,
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        _count: { select: { messages: { where: { fromCompany: false, readAt: null } } } },
      },
      orderBy: { updatedAt: 'desc' },
    });
    return threads.map((t) => ({
      id: t.id,
      applicationId: t.applicationId,
      jobId: t.application.jobId,
      jobTitle: t.application.job.title,
      candidate: t.candidateUser,
      lastMessage: t.messages[0] ?? null,
      unreadCount: t._count.messages,
    }));
  }

  private async assertCompanyThread(companyId: string, threadId: string) {
    const thread = await this.prisma.applicationThread.findFirst({ where: { id: threadId, companyId } });
    if (!thread) throw new NotFoundException('Conversación no encontrada');
    return thread;
  }

  async listMessagesForCompany(companyId: string, threadId: string) {
    await this.assertCompanyThread(companyId, threadId);
    return this.prisma.threadMessage.findMany({
      where: { threadId },
      select: MESSAGE_SELECT,
      orderBy: { createdAt: 'asc' },
    });
  }

  async sendMessageAsCompany(companyId: string, threadId: string, senderUserId: string, content: string) {
    const thread = await this.assertCompanyThread(companyId, threadId);
    const message = await this.prisma.threadMessage.create({
      data: { threadId, senderUserId, fromCompany: true, content },
      select: MESSAGE_SELECT,
    });
    await this.prisma.applicationThread.update({ where: { id: thread.id }, data: { updatedAt: new Date() } });

    this.realtime.emitToUser(thread.candidateUserId, 'thread.message', {
      threadId: thread.id,
      applicationId: thread.applicationId,
      message,
    });

    const online = await this.realtime.isUserOnline(thread.candidateUserId);
    if (!online) {
      const candidate = await this.prisma.user.findUnique({
        where: { id: thread.candidateUserId },
        select: { expoPushToken: true, name: true },
      });
      if (candidate?.expoPushToken) {
        await this.push.send(candidate.expoPushToken, 'Nuevo mensaje', content.slice(0, 120), {
          type: 'thread.message',
          applicationId: thread.applicationId,
        });
      }
    }

    return message;
  }

  async markReadForCompany(companyId: string, threadId: string): Promise<void> {
    await this.assertCompanyThread(companyId, threadId);
    await this.prisma.threadMessage.updateMany({
      where: { threadId, fromCompany: false, readAt: null },
      data: { readAt: new Date() },
    });
  }

  // ---------- No leídos (badges de navegación) ----------

  async unreadCountForCandidate(userId: string): Promise<number> {
    return this.prisma.threadMessage.count({
      where: { fromCompany: true, readAt: null, thread: { candidateUserId: userId } },
    });
  }

  async unreadCountForCompany(companyId: string): Promise<number> {
    return this.prisma.threadMessage.count({
      where: { fromCompany: false, readAt: null, thread: { companyId } },
    });
  }
}
