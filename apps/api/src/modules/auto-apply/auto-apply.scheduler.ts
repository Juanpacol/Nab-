import { Injectable, type OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { QUEUE_NAMES } from '@nab/shared';

/**
 * Programa la barrida periódica del agente de auto-aplicación cada 6h. Mismo
 * patrón que `scheduleIngest()` en apps/workers/src/main.ts: BullMQ dedupea
 * los jobs repetibles por `jobId`, así que volver a agregarlo en cada arranque
 * del proceso no crea corridas duplicadas.
 */
@Injectable()
export class AutoApplyScheduler implements OnModuleInit {
  constructor(@InjectQueue(QUEUE_NAMES.AUTO_APPLY) private readonly queue: Queue) {}

  async onModuleInit(): Promise<void> {
    await this.queue.add(
      'sweep',
      {},
      { repeat: { every: 6 * 60 * 60 * 1000 }, jobId: 'auto-apply-sweep' },
    );
  }
}
