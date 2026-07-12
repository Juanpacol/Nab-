import { Queue } from 'bullmq';
import { QUEUE_NAMES } from '@nab/shared';
import { connection } from './redis.js';
import { logger } from './logger.js';
import { startEmailWorker } from './processors/email.processor.js';
import { startCvParseWorker } from './processors/cv-parse.processor.js';

/**
 * Proceso de workers de Nab. Registra las colas y arranca los procesadores.
 * Fases futuras añaden: ingesta de vacantes (Fase 2), embeddings (Fase 2),
 * generación de CV/carta (Fase 3), resúmenes semanales (Fase 4).
 */

// Colas registradas (los productores viven en la API).
export const queues = {
  jobIngest: new Queue(QUEUE_NAMES.JOB_INGEST, { connection }),
  embeddings: new Queue(QUEUE_NAMES.EMBEDDINGS, { connection }),
  aiGeneration: new Queue(QUEUE_NAMES.AI_GENERATION, { connection }),
  email: new Queue(QUEUE_NAMES.EMAIL, { connection }),
};

const workers = [startEmailWorker(), startCvParseWorker()];

logger.info('⚙️  Workers de Nab iniciados: email, cv-parse');

async function shutdown() {
  logger.info('Cerrando workers…');
  await Promise.all(workers.map((w) => w.close()));
  process.exit(0);
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
