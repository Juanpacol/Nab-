import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import type { Prisma } from '@nab/database';
import { QUEUE_NAMES, toPgVector, type JobSearchInput } from '@nab/shared';
import { PrismaService } from '../../prisma/prisma.service.js';
import { embedQuery } from './embed.js';

const JOB_CARD_SELECT = {
  id: true,
  title: true,
  company: true,
  companyLogoUrl: true,
  location: true,
  remote: true,
  salaryMin: true,
  salaryMax: true,
  currency: true,
  postedAt: true,
  techTestId: true,
} satisfies Prisma.JobSelect;

@Injectable()
export class JobsService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(QUEUE_NAMES.JOB_INGEST) private readonly ingestQueue: Queue,
  ) {}

  /** Búsqueda con filtros y paginación por cursor; o búsqueda semántica top-N. */
  async search(input: JobSearchInput) {
    if (input.semantic && input.query) {
      return this.semanticSearch(input);
    }
    return this.filteredSearch(input);
  }

  private async filteredSearch(input: JobSearchInput) {
    const where: Prisma.JobWhereInput = { isActive: true };
    if (input.query) {
      where.OR = [
        { title: { contains: input.query, mode: 'insensitive' } },
        { company: { contains: input.query, mode: 'insensitive' } },
        { description: { contains: input.query, mode: 'insensitive' } },
      ];
    }
    if (input.location) where.location = { contains: input.location, mode: 'insensitive' };
    if (input.remote !== undefined) where.remote = input.remote;
    if (input.salaryMin !== undefined) where.salaryMax = { gte: input.salaryMin };

    const take = input.limit + 1; // +1 para saber si hay más
    const jobs = await this.prisma.job.findMany({
      where,
      orderBy: [{ postedAt: 'desc' }, { id: 'desc' }],
      take,
      ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
      select: JOB_CARD_SELECT,
    });

    const hasMore = jobs.length > input.limit;
    const data = hasMore ? jobs.slice(0, input.limit) : jobs;
    return { data, nextCursor: hasMore ? data[data.length - 1]?.id ?? null : null };
  }

  /** Búsqueda semántica: ordena por distancia coseno del embedding (pgvector). */
  private async semanticSearch(input: JobSearchInput) {
    const vec = toPgVector(await embedQuery(input.query!));
    const data = await this.rankByEmbedding(vec, input.limit);
    return { data, nextCursor: null };
  }

  /**
   * Feed "Para ti" (Fase 3): matching perfil↔vacante por similitud coseno.
   * Construye un embedding del perfil (headline, resumen, skills, roles) y
   * devuelve las vacantes activas más cercanas.
   */
  async forYou(userId: string, limit = 20) {
    const profile = await this.prisma.profile.findUnique({
      where: { userId },
      select: { headline: true, summary: true, skills: true, desiredRoles: true },
    });
    if (!profile) return { data: [], nextCursor: null };

    const text = [
      profile.headline ?? '',
      profile.summary ?? '',
      profile.skills.join(' '),
      profile.desiredRoles.join(' '),
    ]
      .filter(Boolean)
      .join('. ')
      .trim();
    if (!text) return { data: [], nextCursor: null };

    const vec = toPgVector(await embedQuery(text));
    return { data: await this.rankByEmbedding(vec, limit), nextCursor: null };
  }

  /** Vacantes activas ordenadas por cercanía coseno a un vector (pgvector/HNSW). */
  private rankByEmbedding(vec: string, limit: number) {
    return this.prisma.$queryRawUnsafe<
      Array<{
        id: string;
        title: string;
        company: string;
        location: string | null;
        remote: boolean;
        salaryMin: number | null;
        salaryMax: number | null;
        currency: string | null;
        postedAt: Date | null;
        // Expuesto para que AutoApplyService pueda excluir vacantes COMPANY del
        // agente automático (requieren tomar una prueba técnica) sin ocultarlas
        // de la búsqueda/feed manual, que sí debe incluirlas.
        source: string;
        techTestId: string | null;
        score: number;
      }>
    >(
      `SELECT id, title, company, location, remote,
              "salaryMin", "salaryMax", currency, "postedAt", source, "techTestId",
              1 - (embedding <=> $1::vector) AS score
       FROM "Job"
       WHERE "isActive" = true AND embedding IS NOT NULL
       ORDER BY embedding <=> $1::vector
       LIMIT $2`,
      vec,
      limit,
    );
  }

  async getById(id: string) {
    return this.prisma.job.findUnique({ where: { id } });
  }

  /** Guarda una vacante para el usuario (Application con estado SAVED). */
  async save(userId: string, jobId: string) {
    return this.prisma.application.upsert({
      where: { userId_jobId: { userId, jobId } },
      create: {
        userId,
        jobId,
        status: 'SAVED',
        method: 'EXTERNAL',
        events: { create: { eventType: 'saved', payload: { source: 'catalog' } } },
      },
      update: {},
      select: { id: true, status: true },
    });
  }

  /** Dispara una sincronización de vacantes (dev/admin). */
  async triggerSync() {
    await this.ingestQueue.add('sync-all', {});
    return { status: 'queued' };
  }
}
