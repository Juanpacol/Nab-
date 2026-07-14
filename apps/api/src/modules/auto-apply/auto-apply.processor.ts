import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { QUEUE_NAMES } from '@nab/shared';
import { AutoApplyService } from './auto-apply.service.js';

/** Consumidor de la barrida periódica — ver AutoApplyService.runSweep(). */
@Processor(QUEUE_NAMES.AUTO_APPLY)
export class AutoApplyProcessor extends WorkerHost {
  constructor(private readonly autoApply: AutoApplyService) {
    super();
  }

  async process(_job: Job): Promise<void> {
    await this.autoApply.runSweep();
  }
}
