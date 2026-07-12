import {
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { PLANS, type AuthUser, type AuthTokens } from '@nab/shared';
import type { RegisterInput, LoginInput } from '@nab/shared';
import { PrismaService } from '../../prisma/prisma.service.js';
import { TokenService } from './token.service.js';
import { VerificationService } from './verification.service.js';
import { EmailProducer } from '../../queues/email.producer.js';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
    private readonly verification: VerificationService,
    private readonly email: EmailProducer,
  ) {}

  /** Da de alta un usuario, le otorga los créditos gratis y envía verificación. */
  async register(input: RegisterInput): Promise<{ user: AuthUser; tokens: AuthTokens }> {
    const email = input.email.toLowerCase().trim();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new ConflictException('Ya existe una cuenta con ese correo');

    const passwordHash = await argon2.hash(input.password);
    const freeCredits = PLANS.FREE.credits;

    // Crea usuario + registro en el ledger de créditos en una transacción.
    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email,
          name: input.name ?? null,
          passwordHash,
          plan: 'FREE',
          creditsRemaining: freeCredits,
        },
      });
      await tx.creditLedger.create({
        data: {
          userId: created.id,
          delta: freeCredits,
          reason: 'SUBSCRIPTION_GRANT',
          refId: 'signup',
        },
      });
      return created;
    });

    await this.sendVerificationEmail(user.id, user.email);

    const tokens = await this.tokens.issuePair(user.id, user.email);
    return { user: await this.toAuthUser(user.id), tokens };
  }

  async login(input: LoginInput): Promise<{ user: AuthUser; tokens: AuthTokens }> {
    const email = input.email.toLowerCase().trim();
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Correo o contraseña incorrectos');
    }
    const valid = await argon2.verify(user.passwordHash, input.password);
    if (!valid) throw new UnauthorizedException('Correo o contraseña incorrectos');

    const tokens = await this.tokens.issuePair(user.id, user.email);
    return { user: await this.toAuthUser(user.id), tokens };
  }

  async refresh(refreshToken: string): Promise<AuthTokens> {
    const pair = await this.tokens.rotate(refreshToken);
    if (!pair) throw new UnauthorizedException('Sesión expirada, inicia sesión de nuevo');
    return pair;
  }

  async logout(refreshToken: string): Promise<void> {
    await this.tokens.revoke(refreshToken);
  }

  async sendVerificationEmail(userId: string, email: string): Promise<void> {
    const token = await this.verification.create(userId, 'EMAIL_VERIFY');
    await this.email.enqueueVerification(email, token);
  }

  async verifyEmail(token: string): Promise<void> {
    const userId = await this.verification.consume(token, 'EMAIL_VERIFY');
    if (!userId) throw new UnauthorizedException('El enlace de verificación no es válido o expiró');
    await this.prisma.user.update({
      where: { id: userId },
      data: { emailVerifiedAt: new Date() },
    });
  }

  /** No revela si el correo existe (evita enumeración de usuarios). */
  async forgotPassword(rawEmail: string): Promise<void> {
    const email = rawEmail.toLowerCase().trim();
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      this.logger.log(`Solicitud de reset para correo inexistente: ${email}`);
      return;
    }
    const token = await this.verification.create(user.id, 'PASSWORD_RESET');
    await this.email.enqueuePasswordReset(email, token);
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const userId = await this.verification.consume(token, 'PASSWORD_RESET');
    if (!userId) throw new UnauthorizedException('El enlace de reseteo no es válido o expiró');
    const passwordHash = await argon2.hash(newPassword);
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash } });
    // Cierra todas las sesiones activas por seguridad.
    await this.tokens.revokeAll(userId);
  }

  /** Proyecta un usuario a su forma pública para el frontend. */
  async toAuthUser(userId: string): Promise<AuthUser> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: { profile: { select: { id: true } } },
    });
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      plan: user.plan,
      creditsRemaining: user.creditsRemaining,
      emailVerified: user.emailVerifiedAt !== null,
      onboarded: user.profile !== null,
    };
  }
}
