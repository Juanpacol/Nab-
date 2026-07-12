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
