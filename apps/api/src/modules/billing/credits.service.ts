import { HttpException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import type { CreditReason } from '@nab/database';
import { PrismaService } from '../../prisma/prisma.service.js';

/**
 * Gestión de créditos (Fase 3). Regla de oro del plan: los créditos SIEMPRE se
 * mueven vía CreditLedger (auditable); `User.creditsRemaining` es un caché
 * denormalizado que se actualiza en la MISMA transacción que el asiento.
 */
@Injectable()
export class CreditsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Lanza 402 si el usuario no tiene saldo suficiente (chequeo previo barato). */
  async assertBalance(userId: string, amount: number): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { creditsRemaining: true },
    });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    if (user.creditsRemaining < amount) {
      throw new HttpException('Créditos insuficientes', HttpStatus.PAYMENT_REQUIRED);
    }
  }

  /**
   * Consume créditos de forma transaccional: verifica saldo, registra el asiento
   * negativo en el ledger y decrementa el caché. Devuelve el saldo resultante.
   */
  async consume(
    userId: string,
    amount: number,
    reason: CreditReason,
    refId?: string,
  ): Promise<number> {
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { creditsRemaining: true },
      });
      if (!user) throw new NotFoundException('Usuario no encontrado');
      if (user.creditsRemaining < amount) {
        throw new HttpException('Créditos insuficientes', HttpStatus.PAYMENT_REQUIRED);
      }

      await tx.creditLedger.create({
        data: { userId, delta: -amount, reason, refId: refId ?? null },
      });
      const updated = await tx.user.update({
        where: { id: userId },
        data: { creditsRemaining: { decrement: amount } },
        select: { creditsRemaining: true },
      });
      return updated.creditsRemaining;
    });
  }

  /** Saldo real derivado del ledger (fuente de verdad), para reconciliar el caché. */
  async ledgerBalance(userId: string): Promise<number> {
    const agg = await this.prisma.creditLedger.aggregate({
      where: { userId },
      _sum: { delta: true },
    });
    return agg._sum.delta ?? 0;
  }
}
