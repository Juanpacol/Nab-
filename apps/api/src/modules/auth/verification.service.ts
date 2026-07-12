import { createHash, randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { VerificationTokenType } from '@nab/database';
import { PrismaService } from '../../prisma/prisma.service.js';

const TTL_HOURS = 24;

/**
 * Genera y valida tokens de un solo uso para verificar email y resetear
 * contraseña. Se entrega el token en claro (para el enlace del email) y se
 * guarda solo su hash.
 */
@Injectable()
export class VerificationService {
  constructor(private readonly prisma: PrismaService) {}

  private hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  /** Crea un token nuevo, invalidando los anteriores del mismo tipo. */
  async create(userId: string, type: VerificationTokenType): Promise<string> {
    await this.prisma.verificationToken.deleteMany({ where: { userId, type, usedAt: null } });
    const token = randomBytes(32).toString('base64url');
    await this.prisma.verificationToken.create({
      data: {
        userId,
        type,
        tokenHash: this.hash(token),
        expiresAt: new Date(Date.now() + TTL_HOURS * 3_600_000),
      },
    });
    return token;
  }

  /** Consume un token: devuelve el userId si es válido, o null. */
  async consume(token: string, type: VerificationTokenType): Promise<string | null> {
    const stored = await this.prisma.verificationToken.findUnique({
      where: { tokenHash: this.hash(token) },
    });
    if (!stored || stored.type !== type || stored.usedAt || stored.expiresAt < new Date()) {
      return null;
    }
    await this.prisma.verificationToken.update({
      where: { id: stored.id },
      data: { usedAt: new Date() },
    });
    return stored.userId;
  }
}
