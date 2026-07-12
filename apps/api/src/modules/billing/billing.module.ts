import { Global, Module } from '@nestjs/common';
import { CreditsService } from './credits.service.js';
import { BillingService } from './billing.service.js';
import { BillingController } from './billing.controller.js';

/**
 * Facturación (Fase 6): Stripe Checkout, Customer Portal y webhooks.
 *
 * `CreditsService` es global desde Fase 3 (consumo/otorgamiento transaccional
 * de créditos vía CreditLedger), usado tanto por el motor de IA como por los
 * webhooks de Stripe al otorgar créditos por ciclo.
 */
@Global()
@Module({
  controllers: [BillingController],
  providers: [CreditsService, BillingService],
  exports: [CreditsService],
})
export class BillingModule {}
