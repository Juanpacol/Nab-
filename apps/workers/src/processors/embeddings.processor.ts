import { Worker } from 'bullmq';
import { prisma } from '@nab/database';
import { QUEUE_NAMES, jobEmbeddingText, toPgVector } from '@nab/shared';
import { connection } from '../redis.js';
import { logger } from '../logger.js';
import { embedText } from '../embeddings.js';

/**
 * Calcula el embedding de una vacante y lo guarda en la columna pgvector.
 * El embedding no se puede escribir vía Prisma (tipo Unsupported), así que
 * usamos SQL crudo con el literal de pgvector.
 */
export function startEmbeddingsWorker(): Worker {
  const worker = new Worker(
    QUEUE_NAMES.EMBEDDINGS,
    async (job) => {
      const { jobId } = job.data as { jobId: string };
      const record = await prisma.job.findUnique({
        where: { id: jobId },
        select: { title: true, company: true, location: true, description: true },
      });
      if (!record) return;

      const vec = await embedText(jobEmbeddingText(record));
      await prisma.$executeRawUnsafe(
        `UPDATE "Job" SET embedding = $1::vector WHERE id = $2`,
        toPgVector(vec),
        jobId,
      );
      return { ok: true };
    },
    { connection, concurrency: 4 },
  );

  worker.on('failed', (job, err) =>
    logger.error({ jobId: job?.id, err: err.message }, 'Embedding falló'),
  );
  return worker;
}
