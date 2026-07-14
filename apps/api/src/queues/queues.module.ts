import { Global, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { URL } from 'node:url';
import { QUEUE_NAMES } from '@nab/shared';
import { EmailProducer } from './email.producer.js';

const redisUrl = new URL(process.env.REDIS_URL ?? 'redis://localhost:6379');

/**
 * Registra las colas BullMQ para que la API pueda encolar trabajos.
 * Los consumidores viven en apps/workers.
 */
@Global()
@Module({
  imports: [
    BullModule.forRoot({
      connection: {
        host: redisUrl.hostname,
        port: Number(redisUrl.port || 6379),
        password: redisUrl.password || undefined,
      },
      // Sin esto, un job que falla por un error transitorio (timeout de red,
      // deadlock de DB) se pierde para siempre — BullMQ no reintenta por
      // defecto. removeOnComplete/removeOnFail acotan el crecimiento de Redis
      // (relevante en el free tier de Upstash, con cuota de memoria/comandos).
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5_000 },
        removeOnComplete: { count: 500 },
        removeOnFail: { count: 500 },
      },
    }),
    BullModule.registerQueue(
      { name: QUEUE_NAMES.EMAIL },
      { name: QUEUE_NAMES.AI_GENERATION },
      { name: QUEUE_NAMES.JOB_INGEST },
      { name: QUEUE_NAMES.EMBEDDINGS },
    ),
  ],
  providers: [EmailProducer],
  exports: [BullModule, EmailProducer],
})
export class QueuesModule {}
