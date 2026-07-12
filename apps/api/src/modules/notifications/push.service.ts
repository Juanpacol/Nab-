import { Injectable, Logger } from '@nestjs/common';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

/**
 * Envío de notificaciones push (Fase 7, app móvil) vía Expo Push API. No
 * requiere credenciales propias de APNs/FCM: Expo intermedia con su propia
 * infraestructura para apps gestionadas — solo se necesita el "Expo push
 * token" del dispositivo, registrado por el cliente en `User.expoPushToken`.
 */
@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);

  async send(expoPushToken: string, title: string, body: string, data?: Record<string, unknown>): Promise<void> {
    if (!expoPushToken.startsWith('ExponentPushToken')) {
      this.logger.warn('Token push con formato inesperado; se envía de todas formas');
    }
    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ to: expoPushToken, title, body, data, sound: 'default' }),
      });
      const json = (await res.json()) as { data?: { status: string; message?: string } };
      if (json.data?.status === 'error') {
        this.logger.warn(`Push no entregado: ${json.data.message}`);
      }
    } catch (err) {
      this.logger.error(`Fallo enviando push: ${String(err)}`);
    }
  }
}
