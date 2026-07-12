import { Global, Module } from '@nestjs/common';
import { CreditsService } from './credits.service.js';

/**
 * Facturación (Fase 6): Stripe Checkout, webhooks, Customer Portal y planes.
 *
 * Ya en Fase 3 expone `CreditsService` (global) para el consumo transaccional
 * de créditos vía CreditLedger, usado por el motor de IA al generar CV/cartas.
 */
@Global()
@Module({
  providers: [CreditsService],
  exports: [CreditsService],
})
export class BillingModule {}
