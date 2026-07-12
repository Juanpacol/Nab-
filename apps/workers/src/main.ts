import { Worker, Queue } from 'bullmq';
import { QUEUE_NAMES } from '@nab/shared';
import { connection } from './redis.js';
import { logger } from './logger.js';

/**
 * Proceso de workers. En Fase 0 registra las colas y un worker de prueba
 * que valida la conexión Redis/BullMQ. Cada fase añade sus procesadores:
 *  - JOB_INGEST   (Fase 2): sincroniza vacantes desde los adapters
 *  - EMBEDDINGS   (Fase 2): genera embeddings y los guarda en pgvector
 *  - AI_GENERATION(Fase 3): CV/carta con Claude + render a PDF
 *  - EMAIL        (Fase 1): verificación, reset, resúmenes semanales
 */

// Instanciar colas (los productores viven en la API).
export const queues = {
  jobIngest: new Queue(QUEUE_NAMES.JOB_INGEST, { connection }),
  embeddings: new Queue(QUEUE_NAMES.EMBEDDINGS, { connection }),
  aiGeneration: new Queue(QUEUE_NAMES.AI_GENERATION, { connection }),
  email: new Queue(QUEUE_NAMES.EMAIL, { connection }),
};

// Worker de prueba (placeholder). Se reemplaza por procesadores reales por fase.
const healthWorker = new Worker(
  QUEUE_NAMES.EMAIL,
  async (job) => {
    logger.info({ jobId: job.id, name: job.name }, 'Procesando trabajo (placeholder)');
    return { ok: true };
  },
  { connection },
);

healthWorker.on('completed', (job) => logger.info({ jobId: job.id }, 'Trabajo completado'));
healthWorker.on('failed', (job, err) =>
  logger.error({ jobId: job?.id, err: err.message }, 'Trabajo fallido'),
);

logger.info('⚙️  Workers de Nab iniciados. Colas registradas: %o', Object.values(QUEUE_NAMES));

// Cierre ordenado
async function shutdown() {
  logger.info('Cerrando workers…');
  await healthWorker.close();
  process.exit(0);
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
