import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  type OnGatewayConnection,
  type OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';

/**
 * Gateway de tiempo real (Fase 7): sincroniza web y móvil sobre el mismo
 * backend. Cada socket se autentica con el mismo access token JWT (Bearer)
 * que la API REST y se une a una sala privada `user:{userId}`.
 *
 * Eventos emitidos: `application.status_changed` (kanban/tracking).
 */
@WebSocketGateway({
  namespace: 'realtime',
  cors: { origin: (process.env.CORS_ORIGINS ?? 'http://localhost:3000').split(','), credentials: true },
})
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(private readonly jwt: JwtService) {}

  async handleConnection(client: Socket): Promise<void> {
    const token = this.extractToken(client);
    if (!token) {
      client.disconnect();
      return;
    }

    try {
      const payload = await this.jwt.verifyAsync<{ sub: string }>(token);
      client.data.userId = payload.sub;
      await client.join(this.room(payload.sub));
      this.logger.log(`Socket conectado: user=${payload.sub}`);
    } catch {
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket): void {
    if (client.data.userId) this.logger.log(`Socket desconectado: user=${client.data.userId}`);
  }

  /** Emite un evento a todas las sesiones (web/móvil) de un usuario. */
  emitToUser(userId: string, event: string, payload: unknown): void {
    this.server?.to(this.room(userId)).emit(event, payload);
  }

  private room(userId: string): string {
    return `user:${userId}`;
  }

  private extractToken(client: Socket): string | undefined {
    const auth = client.handshake.auth?.token as string | undefined;
    if (auth) return auth;
    const header = client.handshake.headers.authorization;
    if (header?.startsWith('Bearer ')) return header.slice(7);
    return undefined;
  }
}
