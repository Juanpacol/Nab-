import { Global, Module } from '@nestjs/common';
import { RealtimeGateway } from './realtime.gateway.js';

/**
 * Tiempo real (Fase 7): expone `RealtimeGateway` globalmente para que
 * cualquier servicio (aplicaciones, chat, etc.) pueda emitir eventos a un
 * usuario sin acoplarse a un módulo específico — mismo patrón que
 * `CreditsService` en `BillingModule`.
 */
@Global()
@Module({
  providers: [RealtimeGateway],
  exports: [RealtimeGateway],
})
export class RealtimeModule {}
