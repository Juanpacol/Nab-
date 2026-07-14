import { Module } from '@nestjs/common';
import { ApplicationsController } from './applications.controller.js';
import { ApplicationsService } from './applications.service.js';

/**
 * Aplicaciones y seguimiento (Fase 4): crear aplicación (descuenta crédito),
 * kanban de estados, eventos/timeline, notas y métricas. Consumo de créditos
 * vía CreditLedger (CreditsService global de billing).
 */
@Module({
  controllers: [ApplicationsController],
  providers: [ApplicationsService],
  exports: [ApplicationsService],
})
export class ApplicationsModule {}
