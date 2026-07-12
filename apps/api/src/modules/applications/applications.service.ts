import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma, ApplicationStatus } from '@nab/database';
import { CREDIT_COSTS, type CreateApplicationInput } from '@nab/shared';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CreditsService } from '../billing/credits.service.js';
import { RealtimeGateway } from '../realtime/realtime.gateway.js';
import { PushService } from '../notifications/push.service.js';

const STATUS_PUSH_TEXT: Partial<Record<ApplicationStatus, string>> = {
  INTERVIEW: '¡Tienes una entrevista programada!',
  OFFER: '¡Recibiste una oferta! 🎉',
};

const JOB_SUMMARY = {
  id: true,
  title: true,
  company: true,
  companyLogoUrl: true,
  location: true,
  applyUrl: true,
} satisfies Prisma.JobSelect;

@Injectable()
export class ApplicationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly credits: CreditsService,
    private readonly realtime: RealtimeGateway,
    private readonly push: PushService,
  ) {}

  /**
   * Aplicación asistida (Fase 4): descuenta 1 crédito, deja la Application en
   * APPLIED con `submittedAt`, adjunta CV/carta si se pasan y registra el evento.
   * No automatiza formularios de terceros: devuelve `applyUrl` para abrir el sitio.
   * Idempotente: si ya se aplicó, no vuelve a cobrar.
   */
  async apply(userId: string, input: CreateApplicationInput) {
    const job = await this.prisma.job.findUnique({
      where: { id: input.jobId },
      select: { id: true, applyUrl: true },
    });
    if (!job) throw new NotFoundException('Vacante no encontrada');

    const existing = await this.prisma.application.findUnique({
      where: { userId_jobId: { userId, jobId: input.jobId } },
      select: { id: true, submittedAt: true },
    });
    if (existing?.submittedAt) {
      return { application: existing, applyUrl: job.applyUrl, alreadyApplied: true };
    }

    await this.credits.assertBalance(userId, CREDIT_COSTS.APPLICATION);

    const application = await this.prisma.application.upsert({
      where: { userId_jobId: { userId, jobId: input.jobId } },
      create: {
        userId,
        jobId: input.jobId,
        status: 'APPLIED',
        method: 'EXTERNAL',
        resumeId: input.resumeId ?? null,
        coverLetterId: input.coverLetterId ?? null,
        submittedAt: new Date(),
        events: { create: { eventType: 'applied', payload: { method: 'assisted' } } },
      },
      update: {
        status: 'APPLIED',
        submittedAt: new Date(),
        resumeId: input.resumeId ?? undefined,
        coverLetterId: input.coverLetterId ?? undefined,
        events: { create: { eventType: 'applied', payload: { method: 'assisted' } } },
      },
      select: { id: true },
    });

    await this.credits.consume(userId, CREDIT_COSTS.APPLICATION, 'APPLICATION', application.id);
    this.realtime.emitToUser(userId, 'application.status_changed', {
      applicationId: application.id,
      status: 'APPLIED',
    });
    return { application, applyUrl: job.applyUrl, alreadyApplied: false };
  }

  /** Lista todas las aplicaciones del usuario con datos de la vacante (para el kanban). */
  async list(userId: string) {
    return this.prisma.application.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        status: true,
        matchScore: true,
        submittedAt: true,
        updatedAt: true,
        job: { select: JOB_SUMMARY },
      },
    });
  }

  /** Detalle con timeline de eventos, para la vista de una aplicación. */
  async getById(userId: string, id: string) {
    const app = await this.prisma.application.findFirst({
      where: { id, userId },
      select: {
        id: true,
        status: true,
        method: true,
        notes: true,
        matchScore: true,
        submittedAt: true,
        createdAt: true,
        job: { select: JOB_SUMMARY },
        resume: { select: { id: true, title: true, atsScore: true } },
        coverLetter: { select: { id: true, tone: true } },
        events: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!app) throw new NotFoundException('Aplicación no encontrada');
    return app;
  }

  /** Cambia el estado (kanban) y registra el evento; fija submittedAt al aplicar. */
  async updateStatus(userId: string, id: string, status: ApplicationStatus, notes?: string) {
    await this.assertOwned(userId, id);
    const updated = await this.prisma.application.update({
      where: { id },
      data: {
        status,
        ...(status === 'APPLIED' ? { submittedAt: new Date() } : {}),
        ...(notes !== undefined ? { notes } : {}),
        events: {
          create: { eventType: 'status_changed', payload: { status, ...(notes ? { notes } : {}) } },
        },
      },
      select: {
        id: true,
        status: true,
        submittedAt: true,
        job: { select: { title: true, company: true } },
        user: { select: { expoPushToken: true } },
      },
    });
    this.realtime.emitToUser(userId, 'application.status_changed', {
      applicationId: id,
      status: updated.status,
    });

    const pushText = STATUS_PUSH_TEXT[updated.status];
    if (pushText && updated.user.expoPushToken) {
      void this.push.send(
        updated.user.expoPushToken,
        pushText,
        `${updated.job.title} en ${updated.job.company}`,
        { applicationId: id },
      );
    }

    return { id: updated.id, status: updated.status, submittedAt: updated.submittedAt };
  }

  /** Actualiza las notas de una aplicación. */
  async updateNotes(userId: string, id: string, notes: string) {
    await this.assertOwned(userId, id);
    return this.prisma.application.update({
      where: { id },
      data: { notes, events: { create: { eventType: 'note', payload: {} } } },
      select: { id: true, notes: true },
    });
  }

  /** Métricas del dashboard: por estado, aplicaciones de la semana, tasa de respuesta. */
  async metrics(userId: string) {
    const grouped = await this.prisma.application.groupBy({
      by: ['status'],
      where: { userId },
      _count: { _all: true },
    });
    const byStatus: Record<string, number> = {};
    for (const g of grouped) byStatus[g.status] = g._count._all;

    const weekAgo = new Date(Date.now() - 7 * 86_400_000);
    const appliedThisWeek = await this.prisma.application.count({
      where: { userId, submittedAt: { gte: weekAgo } },
    });

    const applied = await this.prisma.application.count({
      where: { userId, submittedAt: { not: null } },
    });
    const responses = (byStatus.INTERVIEW ?? 0) + (byStatus.OFFER ?? 0) + (byStatus.REJECTED ?? 0);
    const responseRate = applied > 0 ? Math.round((responses / applied) * 100) : 0;

    // Actividad de los últimos 14 días (aplicaciones enviadas por día).
    const recent = await this.prisma.application.findMany({
      where: { userId, submittedAt: { gte: new Date(Date.now() - 14 * 86_400_000) } },
      select: { submittedAt: true },
    });
    const activity: Record<string, number> = {};
    for (const a of recent) {
      if (!a.submittedAt) continue;
      const day = a.submittedAt.toISOString().slice(0, 10);
      activity[day] = (activity[day] ?? 0) + 1;
    }

    return { byStatus, appliedThisWeek, applied, responseRate, activity };
  }

  private async assertOwned(userId: string, id: string): Promise<void> {
    const found = await this.prisma.application.findFirst({
      where: { id, userId },
      select: { id: true },
    });
    if (!found) throw new NotFoundException('Aplicación no encontrada');
  }
}
