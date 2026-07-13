import './instrument.js';
import { Queue } from 'bullmq';
import { QUEUE_NAMES } from '@nab/shared';
import { connection } from './redis.js';
import { logger } from './logger.js';
import { validateEnv } from './env.validation.js';
import { startEmailWorker } from './processors/email.processor.js';
import { startCvParseWorker } from './processors/cv-parse.processor.js';
import { startIngestWorker } from './processors/ingest.processor.js';
import { startEmbeddingsWorker } from './processors/embeddings.processor.js';

/**
 * Proceso de workers de Nab. Registra las colas, arranca los procesadores y
 * programa la ingesta periódica de vacantes.
 */

// Falla rápido con un mensaje claro si faltan secretos/config de producción,
// en vez de arrancar con defaults de desarrollo o en modo mock silencioso.
validateEnv(process.env);

const jobIngestQueue = new Queue(QUEUE_NAMES.JOB_INGEST, { connection });

export const queues = {
  jobIngest: jobIngestQueue,
  embeddings: new Queue(QUEUE_NAMES.EMBEDDINGS, { connection }),
  aiGeneration: new Queue(QUEUE_NAMES.AI_GENERATION, { connection }),
  email: new Queue(QUEUE_NAMES.EMAIL, { connection }),
};

const workers = [
  startEmailWorker(),
  startCvParseWorker(),
  startIngestWorker(),
  startEmbeddingsWorker(),
];

async function scheduleIngest() {
  // Ingesta recurrente cada 6 horas (idempotente por clave de repetición).
  await jobIngestQueue.add(
    'sync-all',
    {},
    { repeat: { every: 6 * 60 * 60 * 1000 }, jobId: 'ingest-recurrente' },
  );
  // En desarrollo, una ejecución inmediata para poblar el catálogo.
  if (process.env.NODE_ENV !== 'production' || process.env.INGEST_ON_START === 'true') {
    await jobIngestQueue.add('sync-all', {});
  }
}

void scheduleIngest();

logger.info('⚙️  Workers de Nab iniciados: email, cv-parse, ingest, embeddings');

async function shutdown() {
  logger.info('Cerrando workers…');
  await Promise.all(workers.map((w) => w.close()));
  process.exit(0);
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
