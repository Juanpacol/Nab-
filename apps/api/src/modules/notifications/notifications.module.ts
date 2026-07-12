import { Global, Module } from '@nestjs/common';
import { PushService } from './push.service.js';

/**
 * Notificaciones push (Fase 7): expone `PushService` globalmente, igual que
 * `CreditsService`/`RealtimeGateway`, para que cualquier servicio de dominio
 * (aplicaciones, chat, etc.) pueda notificar a un usuario sin acoplarse.
 */
@Global()
@Module({
  providers: [PushService],
  exports: [PushService],
})
export class NotificationsModule {}
