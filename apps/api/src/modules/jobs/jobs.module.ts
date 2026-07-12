import { Module } from '@nestjs/common';
import { JobsController } from './jobs.controller.js';
import { JobsService } from './jobs.service.js';

/**
 * Vacantes (Fase 2): catálogo, búsqueda con filtros y búsqueda semántica
 * (pgvector), guardar vacante, y disparo de la ingesta (adapters en workers).
 */
@Module({
  controllers: [JobsController],
  providers: [JobsService],
})
export class JobsModule {}
