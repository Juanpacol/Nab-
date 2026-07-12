import { createHash, randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service.js';

const ACCESS_TTL = '15m';
const REFRESH_TTL_DAYS = 7;

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

/**
 * Emite y rota tokens. El access token es un JWT firmado (HS256) con el
 * mismo secreto que verifica la web. El refresh token es un secreto opaco:
 * se entrega en claro al cliente y se guarda hasheado (SHA-256) para permitir
 * revocación y rotación.
 */
@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  private hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  async issuePair(userId: string, email: string): Promise<TokenPair> {
    const accessToken = await this.jwt.signAsync(
      { sub: userId, email },
      { expiresIn: ACCESS_TTL },
    );

    const refreshToken = randomBytes(48).toString('base64url');
    const expiresAt = new Date(Date.now() + REFRESH_TTL_DAYS * 86_400_000);
    await this.prisma.refreshToken.create({
      data: { userId, tokenHash: this.hash(refreshToken), expiresAt },
    });

    return { accessToken, refreshToken };
  }

  /** Valida un refresh token, lo revoca (rotación) y emite un par nuevo. */
  async rotate(refreshToken: string): Promise<TokenPair | null> {
    const tokenHash = this.hash(refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: { select: { id: true, email: true } } },
    });

    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      return null;
    }

    // Rotación: revoca el token usado y emite uno nuevo.
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    return this.issuePair(stored.user.id, stored.user.email);
  }

  /** Revoca un refresh token concreto (logout). */
  async revoke(refreshToken: string): Promise<void> {
    const tokenHash = this.hash(refreshToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /** Revoca todos los refresh tokens de un usuario (ej. tras cambiar contraseña). */
  async revokeAll(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
