import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { QUEUE_NAMES } from '@nab/shared';
import { ApplicationsModule } from '../applications/applications.module.js';
import { JobsModule } from '../jobs/jobs.module.js';
import { AutoApplyService } from './auto-apply.service.js';
import { AutoApplyProcessor } from './auto-apply.processor.js';
import { AutoApplyScheduler } from './auto-apply.scheduler.js';

/**
 * Única cola que consume `apps/api` en vez de `apps/workers` — ver el
 * comentario en `QUEUE_NAMES.AUTO_APPLY` (packages/shared/src/constants.ts).
 * Necesita inyectar `ApplicationsService`/`JobsService`/`GenerationService`
 * (este último vía `AiModule`, que es `@Global()`) directamente, sin duplicar
 * su lógica: `apps/workers` no es una app NestJS y no tiene ese DI.
 */
@Module({
  imports: [ApplicationsModule, JobsModule, BullModule.registerQueue({ name: QUEUE_NAMES.AUTO_APPLY })],
  providers: [AutoApplyService, AutoApplyProcessor, AutoApplyScheduler],
})
export class AutoApplyModule {}
