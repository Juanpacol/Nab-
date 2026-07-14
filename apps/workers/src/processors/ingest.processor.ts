import { Worker, Queue } from 'bullmq';
import * as Sentry from '@sentry/node';
import { prisma, type JobSourceProvider } from '@nab/database';
import { QUEUE_NAMES } from '@nab/shared';
import { connection } from '../redis.js';
import { logger } from '../logger.js';
import { buildAdapters } from '../adapters/index.js';

const embeddingsQueue = new Queue(QUEUE_NAMES.EMBEDDINGS, {
  connection,
  // Ver nota en apps/api/src/queues/queues.module.ts: reintentos + límite de
  // retención para no perder jobs por fallos transitorios ni agotar la cuota
  // de memoria de Redis en el free tier.
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5_000 },
    removeOnComplete: { count: 500 },
    removeOnFail: { count: 500 },
  },
});

/**
 * Ingesta de vacantes (Fase 2). Ejecuta los adapters configurados, normaliza y
 * hace upsert con dedupe por (source, externalId), luego encola el cálculo de
 * embeddings. Programado cada 6h (ver main.ts) y disparable manualmente.
 */
export function startIngestWorker(): Worker {
  const worker = new Worker(
    QUEUE_NAMES.JOB_INGEST,
    async () => {
      const adapters = buildAdapters();
      const syncStartedAt = new Date();
      logger.info({ adapters: adapters.map((a) => a.provider) }, 'Ingesta: iniciando');

      let upserted = 0;
      // Proveedores que devolvieron al menos una vacante en esta corrida; solo
      // para ellos expiramos las vacantes no vistas (así un adapter que falla y
      // devuelve [] no desactiva todo su catálogo).
      const seenProviders = new Set<JobSourceProvider>();
      for (const adapter of adapters) {
        const jobs = await adapter.fetchJobs();
        for (const j of jobs) {
          seenProviders.add(j.source as JobSourceProvider);
          const saved = await prisma.job.upsert({
            where: {
              source_externalId: {
                source: j.source as JobSourceProvider,
                externalId: j.externalId,
              },
            },
            create: {
              source: j.source as JobSourceProvider,
              externalId: j.externalId,
              title: j.title,
              company: j.company,
              companyLogoUrl: j.companyLogoUrl ?? null,
              location: j.location ?? null,
              remote: j.remote,
              description: j.description,
              salaryMin: j.salaryMin ?? null,
              salaryMax: j.salaryMax ?? null,
              currency: j.currency ?? 'USD',
              atsType: j.atsType ?? null,
              applyUrl: j.applyUrl,
              postedAt: j.postedAt ?? null,
              isActive: true,
            },
            update: {
              title: j.title,
              location: j.location ?? null,
              remote: j.remote,
              description: j.description,
              salaryMin: j.salaryMin ?? null,
              salaryMax: j.salaryMax ?? null,
              applyUrl: j.applyUrl,
              isActive: true,
            },
            select: { id: true },
          });
          await embeddingsQueue.add('embed-job', { jobId: saved.id });
          upserted++;
        }
      }

      // Expiración: desactiva vacantes que su fuente ya no devuelve (no vistas en
      // esta corrida) y las que tienen expiresAt en el pasado.
      const staleFromSync = seenProviders.size
        ? await prisma.job.updateMany({
            where: {
              isActive: true,
              source: { in: [...seenProviders] },
              updatedAt: { lt: syncStartedAt },
            },
            data: { isActive: false },
          })
        : { count: 0 };
      const expiredByDate = await prisma.job.updateMany({
        where: { isActive: true, expiresAt: { lt: syncStartedAt } },
        data: { isActive: false },
      });
      const deactivated = staleFromSync.count + expiredByDate.count;

      logger.info({ upserted, deactivated }, 'Ingesta: completada');
      return { upserted, deactivated };
    },
    { connection },
  );

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err: err.message }, 'Ingesta falló');
    Sentry.captureException(err);
  });
  return worker;
}
