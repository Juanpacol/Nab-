import { HttpException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type CreditReason } from '@nab/database';
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
    return this.prisma.$transaction((tx) => this.consumeWithClient(tx, userId, amount, reason, refId));
  }

  /**
   * Igual que `consume`, pero opera dentro de una transacción ya abierta por el
   * llamador (p.ej. `ApplicationsService.apply`, que necesita que el cambio de
   * estado de la Application y el cobro de crédito confirmen o reviertan juntos).
   *
   * El chequeo de saldo va DENTRO del `UPDATE` (`creditsRemaining: { gte: amount }`)
   * en vez de leer-y-luego-escribir: así Postgres serializa filas concurrentes que
   * compiten por el mismo saldo (dos requests gastando crédito a la vez no pueden
   * ambas pasar la validación con el mismo saldo leído, como sí podía pasar antes
   * con un SELECT seguido de un UPDATE separados).
   */
  async consumeWithClient(
    tx: Prisma.TransactionClient,
    userId: string,
    amount: number,
    reason: CreditReason,
    refId?: string,
  ): Promise<number> {
    const result = await tx.user.updateMany({
      where: { id: userId, creditsRemaining: { gte: amount } },
      data: { creditsRemaining: { decrement: amount } },
    });
    if (result.count === 0) {
      const exists = await tx.user.findUnique({ where: { id: userId }, select: { id: true } });
      if (!exists) throw new NotFoundException('Usuario no encontrado');
      throw new HttpException('Créditos insuficientes', HttpStatus.PAYMENT_REQUIRED);
    }

    await tx.creditLedger.create({
      data: { userId, delta: -amount, reason, refId: refId ?? null },
    });
    const updated = await tx.user.findUniqueOrThrow({
      where: { id: userId },
      select: { creditsRemaining: true },
    });
    return updated.creditsRemaining;
  }

  /**
   * Otorga créditos de forma transaccional (alta por suscripción/renovación):
   * registra el asiento positivo en el ledger e incrementa el caché.
   *
   * Idempotente por `refId` a nivel de base de datos (constraint único
   * `(userId, reason, refId)`, ver migración credit_ledger_unique_ref): un
   * chequeo previo con `findFirst` no basta, porque dos transacciones
   * concurrentes (p.ej. Stripe reintregando el mismo webhook en paralelo)
   * pueden pasar ambas la lectura antes de que cualquiera confirme la
   * escritura. Si la escritura choca con la restricción única, el crédito ya
   * fue otorgado por otra llamada: se devuelve el saldo actual sin duplicar.
   */
  async grant(userId: string, amount: number, reason: CreditReason, refId?: string): Promise<number> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.creditLedger.create({ data: { userId, delta: amount, reason, refId: refId ?? null } });
        const updated = await tx.user.update({
          where: { id: userId },
          data: { creditsRemaining: { increment: amount } },
          select: { creditsRemaining: true },
        });
        return updated.creditsRemaining;
      });
    } catch (err) {
      if (refId && err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        const current = await this.prisma.user.findUniqueOrThrow({
          where: { id: userId },
          select: { creditsRemaining: true },
        });
        return current.creditsRemaining;
      }
      throw err;
    }
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
