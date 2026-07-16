import { randomUUID } from 'node:crypto';
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import type { ApplicationStatus, Prisma } from '@nab/database';
import { QUEUE_NAMES, type CreateCompanyJobInput, type UpdateCompanyJobInput } from '@nab/shared';
import { PrismaService } from '../../prisma/prisma.service.js';
import { RealtimeGateway } from '../realtime/realtime.gateway.js';

const APPLICANT_SELECT = {
  id: true,
  status: true,
  matchScore: true,
  submittedAt: true,
  createdAt: true,
  user: { select: { id: true, name: true, email: true, avatarUrl: true } },
  // Estado de prueba/evaluación para la tabla de candidatos — nunca incluye
  // rubricJson/respuestas, solo lo mínimo para pintar un badge de estado.
  testSubmission: {
    select: {
      id: true,
      status: true,
      evaluation: { select: { finalScore: true, passed: true } },
    },
  },
} satisfies Prisma.ApplicationSelect;

@Injectable()
export class CompanyJobsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeGateway,
    @InjectQueue(QUEUE_NAMES.EMBEDDINGS) private readonly embeddingsQueue: Queue,
  ) {}

  /**
   * Crea una vacante propia de la empresa. `externalId` se fija igual al `id`
   * del propio Job: no hay un id externo natural (a diferencia de las
   * vacantes ingeridas de un proveedor) y así se satisface trivialmente
   * `@@unique([source, externalId])` sin lógica de dedupe extra.
   */
  async create(companyId: string, input: CreateCompanyJobInput) {
    const company = await this.prisma.company.findUniqueOrThrow({
      where: { id: companyId },
      select: { name: true, logoUrl: true },
    });

    const id = randomUUID();
    const job = await this.prisma.job.create({
      data: {
        id,
        source: 'COMPANY',
        externalId: id,
        companyId,
        title: input.title,
        company: company.name,
        companyLogoUrl: company.logoUrl,
        location: input.location ?? null,
        remote: input.remote,
        description: input.description,
        salaryMin: input.salaryMin ?? null,
        salaryMax: input.salaryMax ?? null,
        currency: input.currency,
        applyUrl: null,
        postedAt: new Date(),
        isActive: true,
      },
    });

    await this.embeddingsQueue.add('embed-job', { jobId: job.id });
    return job;
  }

  async list(companyId: string) {
    return this.prisma.job.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { applications: true } } },
    });
  }

  async getById(companyId: string, jobId: string) {
    const job = await this.prisma.job.findFirst({
      where: { id: jobId, companyId },
      include: { _count: { select: { applications: true } } },
    });
    if (!job) throw new NotFoundException('Vacante no encontrada');
    return job;
  }

  async update(companyId: string, jobId: string, input: UpdateCompanyJobInput) {
    await this.assertOwned(companyId, jobId);
    const job = await this.prisma.job.update({
      where: { id: jobId },
      data: input,
    });

    // El texto que alimenta el embedding cambió: re-encolamos para que el
    // matching semántico (feed "para ti", búsqueda) refleje la edición.
    if (input.title !== undefined || input.description !== undefined || input.location !== undefined) {
      await this.embeddingsQueue.add('embed-job', { jobId: job.id });
    }
    return job;
  }

  /** Aplicantes de la vacante, con datos mínimos del candidato. */
  async listApplicants(companyId: string, jobId: string, status?: ApplicationStatus) {
    await this.assertOwned(companyId, jobId);
    return this.prisma.application.findMany({
      where: { jobId, ...(status ? { status } : {}) },
      orderBy: { createdAt: 'desc' },
      select: APPLICANT_SELECT,
    });
  }

  /** RH mueve el funnel de una aplicación; el candidato lo ve vía realtime. */
  async updateApplicantStatus(companyId: string, applicationId: string, status: ApplicationStatus) {
    const application = await this.prisma.application.findFirst({
      where: { id: applicationId, job: { companyId } },
      select: { id: true, userId: true, job: { select: { title: true, company: true } } },
    });
    if (!application) throw new NotFoundException('Aplicación no encontrada');

    const updated = await this.prisma.application.update({
      where: { id: applicationId },
      data: {
        status,
        events: { create: { eventType: 'status_changed', payload: { status, by: 'company' } } },
      },
      select: { id: true, status: true },
    });

    this.realtime.emitToUser(application.userId, 'application.status_changed', {
      applicationId: application.id,
      status: updated.status,
      jobTitle: application.job.title,
      company: application.job.company,
    });
    return updated;
  }

  /** Confirma que la vacante pertenece a la empresa antes de operar sobre ella (anti-IDOR). */
  private async assertOwned(companyId: string, jobId: string): Promise<void> {
    const found = await this.prisma.job.findFirst({ where: { id: jobId, companyId }, select: { id: true } });
    if (!found) throw new NotFoundException('Vacante no encontrada');
  }
}
