import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  type OnGatewayConnection,
  type OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { PrismaService } from '../../prisma/prisma.service.js';

/**
 * Gateway de tiempo real (Fase 7): sincroniza web y móvil sobre el mismo
 * backend. Cada socket se autentica con el mismo access token JWT (Bearer)
 * que la API REST y se une a una sala privada `user:{userId}`; si el usuario
 * es miembro de alguna empresa (lado B2B), también se une a `company:{id}`
 * por cada membresía — así RH recibe eventos del lado empresa en el mismo
 * socket que usa como candidato.
 *
 * Limitación v1 aceptada: una membresía creada DESPUÉS de conectar el socket
 * no une al cliente a esa sala hasta que reconecte (no hay refresh de salas
 * en caliente).
 *
 * Eventos emitidos: `application.status_changed` (kanban/tracking, a
 * user:{id}); `applicant.new`, `test.ready`, `test.failed`,
 * `submission.received`, `submission.evaluated`, `evaluation.failed`,
 * `thread.message` (lado empresa, a company:{id} — fases siguientes).
 */
@WebSocketGateway({
  namespace: 'realtime',
  cors: { origin: (process.env.CORS_ORIGINS ?? 'http://localhost:3000').split(','), credentials: true },
})
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    const token = this.extractToken(client);
    if (!token) {
      client.disconnect();
      return;
    }

    try {
      const payload = await this.jwt.verifyAsync<{ sub: string }>(token);
      client.data.userId = payload.sub;
      await client.join(this.userRoom(payload.sub));

      const memberships = await this.prisma.companyMember.findMany({
        where: { userId: payload.sub },
        select: { companyId: true },
      });
      await Promise.all(memberships.map((m) => client.join(this.companyRoom(m.companyId))));

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
    this.server?.to(this.userRoom(userId)).emit(event, payload);
  }

  /** Emite un evento a todos los miembros conectados de una empresa (lado RH). */
  emitToCompany(companyId: string, event: string, payload: unknown): void {
    this.server?.to(this.companyRoom(companyId)).emit(event, payload);
  }

  /** true si el usuario tiene al menos un socket conectado ahora mismo (web o móvil). */
  async isUserOnline(userId: string): Promise<boolean> {
    if (!this.server) return false;
    const sockets = await this.server.in(this.userRoom(userId)).fetchSockets();
    return sockets.length > 0;
  }

  private userRoom(userId: string): string {
    return `user:${userId}`;
  }

  private companyRoom(companyId: string): string {
    return `company:${companyId}`;
  }

  private extractToken(client: Socket): string | undefined {
    const auth = client.handshake.auth?.token as string | undefined;
    if (auth) return auth;
    const header = client.handshake.headers.authorization;
    if (header?.startsWith('Bearer ')) return header.slice(7);
    return undefined;
  }
}
