import { Module } from '@nestjs/common';
import { JobsController } from './jobs.controller.js';

/**
 * Vacantes (Fase 2): catálogo, búsqueda con filtros y búsqueda semántica
 * (pgvector), ingesta vía adapters (Greenhouse, Lever, Adzuna, JSearch).
 */
@Module({
  controllers: [JobsController],
})
export class JobsModule {}
