import { Injectable, UnauthorizedException } from '@nestjs/common';
import * as argon2 from 'argon2';
import type { Prisma } from '@nab/database';
import type { ProfileInput, UpdateAccountInput } from '@nab/shared';
import { PrismaService } from '../../prisma/prisma.service.js';
import { TokenService } from '../auth/token.service.js';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
  ) {}

  /** Perfil profesional del usuario (o null si aún no lo creó). */
  async getProfile(userId: string) {
    return this.prisma.profile.findUnique({ where: { userId } });
  }

  /** Crea o actualiza el perfil (upsert). Los campos JSON van tipados. */
  async upsertProfile(userId: string, input: ProfileInput) {
    const data = {
      headline: input.headline,
      summary: input.summary,
      skills: input.skills,
      experienceJson: input.experience as unknown as Prisma.InputJsonValue,
      educationJson: input.education as unknown as Prisma.InputJsonValue,
      locations: input.locations,
      desiredRoles: input.desiredRoles,
      salaryMin: input.salaryMin ?? null,
      salaryMax: input.salaryMax ?? null,
      remotePreference: input.remotePreference,
    };
    return this.prisma.profile.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
    });
  }

  async updateAccount(userId: string, input: UpdateAccountInput) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { name: input.name, avatarUrl: input.avatarUrl },
      select: { id: true, name: true, avatarUrl: true },
    });
  }

  /** Cambia la contraseña verificando la actual y cierra otras sesiones. */
  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.passwordHash) {
      throw new UnauthorizedException('Esta cuenta no usa contraseña');
    }
    const valid = await argon2.verify(user.passwordHash, currentPassword);
    if (!valid) throw new UnauthorizedException('La contraseña actual no es correcta');

    const passwordHash = await argon2.hash(newPassword);
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash } });
    await this.tokens.revokeAll(userId);
  }

  /** Registra (o limpia) el token de Expo Notifications del dispositivo móvil. */
  async setPushToken(userId: string, token: string): Promise<void> {
    await this.prisma.user.update({ where: { id: userId }, data: { expoPushToken: token } });
  }

  /** Saldo de créditos calculado desde el ledger (fuente de verdad). */
  async getCreditBalance(userId: string): Promise<number> {
    const result = await this.prisma.creditLedger.aggregate({
      where: { userId },
      _sum: { delta: true },
    });
    return result._sum.delta ?? 0;
  }
}
