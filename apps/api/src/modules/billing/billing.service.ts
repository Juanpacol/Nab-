import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import Stripe from 'stripe';
import { PLANS, PAID_PLANS, type PlanId } from '@nab/shared';
import type { Plan } from '@nab/database';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CreditsService } from './credits.service.js';

const WEB_URL = process.env.WEB_PUBLIC_URL ?? 'http://localhost:3000';

/**
 * Facturación (Fase 6): Stripe Checkout (suscripción), Customer Portal y
 * webhooks. Sin STRIPE_SECRET_KEY opera "deshabilitado" (503 claro en checkout/
 * portal) — no hay un "modo mock" con sentido para pagos reales, a diferencia
 * de la IA o los adapters de vacantes.
 */
@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);
  private readonly stripe: Stripe | null;
  readonly enabled: boolean;

  /** Mapa priceId de Stripe → PlanId, construido desde las env vars configuradas. */
  private readonly priceToPlan = new Map<string, PlanId>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly credits: CreditsService,
  ) {
    const apiKey = process.env.STRIPE_SECRET_KEY;
    this.enabled = Boolean(apiKey);
    this.stripe = apiKey ? new Stripe(apiKey) : null;
    if (!this.enabled) {
      this.logger.warn('STRIPE_SECRET_KEY no configurada — facturación deshabilitada.');
    }
    for (const id of PAID_PLANS) {
      const priceId = process.env[PLANS[id].stripePriceEnv!];
      if (priceId) this.priceToPlan.set(priceId, id);
    }
  }

  private assertEnabled(): Stripe {
    if (!this.stripe) {
      throw new ServiceUnavailableException(
        'Stripe no está configurado en este entorno (falta STRIPE_SECRET_KEY).',
      );
    }
    return this.stripe;
  }

  /** Suscripción actual del usuario (o null si sigue en FREE sin registro en Stripe). */
  async getSubscription(userId: string) {
    return this.prisma.subscription.findUnique({ where: { userId } });
  }

  /** Crea (o reutiliza) el customer de Stripe y una Checkout Session de suscripción. */
  async createCheckoutSession(userId: string, planId: PlanId): Promise<{ url: string }> {
    const stripe = this.assertEnabled();
    if (!PAID_PLANS.includes(planId)) throw new BadRequestException('Plan inválido');

    const priceId = process.env[PLANS[planId].stripePriceEnv!];
    if (!priceId) throw new ServiceUnavailableException(`No hay price de Stripe configurado para ${planId}`);

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { email: true },
    });
    const existing = await this.prisma.subscription.findUnique({
      where: { userId },
      select: { stripeCustomerId: true },
    });

    const customerId =
      existing?.stripeCustomerId ??
      (await stripe.customers.create({ email: user.email, metadata: { userId } })).id;

    if (!existing) {
      await this.prisma.subscription.upsert({
        where: { userId },
        create: { userId, stripeCustomerId: customerId, plan: 'FREE', creditsPerCycle: 0 },
        update: { stripeCustomerId: customerId },
      });
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      client_reference_id: userId,
      metadata: { userId, planId },
      subscription_data: { metadata: { userId, planId } },
      success_url: `${WEB_URL}/billing?checkout=success`,
      cancel_url: `${WEB_URL}/billing?checkout=cancelled`,
    });

    if (!session.url) throw new ServiceUnavailableException('Stripe no devolvió una URL de checkout');
    return { url: session.url };
  }

  /** Sesión del Customer Portal (gestionar/cancelar/cambiar de plan). */
  async createPortalSession(userId: string): Promise<{ url: string }> {
    const stripe = this.assertEnabled();
    const sub = await this.prisma.subscription.findUnique({
      where: { userId },
      select: { stripeCustomerId: true },
    });
    if (!sub?.stripeCustomerId) {
      throw new BadRequestException('Aún no tienes una suscripción para gestionar');
    }
    const session = await stripe.billingPortal.sessions.create({
      customer: sub.stripeCustomerId,
      return_url: `${WEB_URL}/billing`,
    });
    return { url: session.url };
  }

  /** Verifica la firma del webhook y despacha el evento. */
  async handleWebhook(rawBody: Buffer, signature: string): Promise<void> {
    const stripe = this.assertEnabled();
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) throw new ServiceUnavailableException('STRIPE_WEBHOOK_SECRET no configurado');

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(rawBody, signature, secret);
    } catch (err) {
      throw new BadRequestException(`Firma de webhook inválida: ${String(err)}`);
    }
    this.logger.log(`Webhook Stripe: ${event.type}`);

    switch (event.type) {
      case 'checkout.session.completed':
        await this.onCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case 'invoice.paid':
        await this.onInvoicePaid(event.data.object as Stripe.Invoice);
        break;
      case 'customer.subscription.updated':
        await this.onSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;
      case 'customer.subscription.deleted':
        await this.onSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;
      default:
        break;
    }
  }

  private async onCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
    const userId = session.metadata?.userId ?? session.client_reference_id;
    const planId = session.metadata?.planId as PlanId | undefined;
    if (!userId || !planId || !session.subscription || !session.customer) return;

    const stripe = this.assertEnabled();
    const subscriptionId =
      typeof session.subscription === 'string' ? session.subscription : session.subscription.id;
    const customerId = typeof session.customer === 'string' ? session.customer : session.customer.id;
    const stripeSub = await stripe.subscriptions.retrieve(subscriptionId);

    await this.syncSubscription(userId, planId, customerId, stripeSub);
    await this.credits.grant(userId, PLANS[planId].credits, 'SUBSCRIPTION_GRANT', subscriptionId);
  }

  /** Renovación de ciclo: solo otorga créditos en facturas de renovación (no en la de alta). */
  private async onInvoicePaid(invoice: Stripe.Invoice): Promise<void> {
    if (invoice.billing_reason !== 'subscription_cycle') return;
    const subscriptionId = invoice.parent?.subscription_details?.subscription;
    if (!subscriptionId) return;
    const subId = typeof subscriptionId === 'string' ? subscriptionId : subscriptionId.id;

    const record = await this.prisma.subscription.findUnique({
      where: { stripeSubscriptionId: subId },
      select: { userId: true, plan: true },
    });
    if (!record || record.plan === 'FREE') return;

    await this.credits.grant(
      record.userId,
      PLANS[record.plan as PlanId].credits,
      'SUBSCRIPTION_GRANT',
      invoice.id ? `${invoice.id}` : undefined,
    );
    await this.prisma.subscription.update({
      where: { stripeSubscriptionId: subId },
      data: { status: 'ACTIVE' },
    });
  }

  private async onSubscriptionUpdated(sub: Stripe.Subscription): Promise<void> {
    const userId = sub.metadata?.userId ?? (await this.findUserIdByCustomer(sub.customer));
    if (!userId) return;
    const priceId = sub.items.data[0]?.price.id;
    const planId = (priceId && this.priceToPlan.get(priceId)) || (sub.metadata?.planId as PlanId | undefined);
    if (!planId) return;

    const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
    await this.syncSubscription(userId, planId, customerId, sub);
  }

  private async onSubscriptionDeleted(sub: Stripe.Subscription): Promise<void> {
    const userId = sub.metadata?.userId ?? (await this.findUserIdByCustomer(sub.customer));
    if (!userId) return;

    await this.prisma.$transaction([
      this.prisma.subscription.update({
        where: { userId },
        data: { status: 'CANCELED' },
      }),
      this.prisma.user.update({ where: { id: userId }, data: { plan: 'FREE' } }),
    ]);
  }

  private async findUserIdByCustomer(customer: string | Stripe.Customer | Stripe.DeletedCustomer): Promise<string | null> {
    const customerId = typeof customer === 'string' ? customer : customer.id;
    const sub = await this.prisma.subscription.findFirst({
      where: { stripeCustomerId: customerId },
      select: { userId: true },
    });
    return sub?.userId ?? null;
  }

  private async syncSubscription(
    userId: string,
    planId: PlanId,
    customerId: string,
    stripeSub: Stripe.Subscription,
  ): Promise<void> {
    const currentPeriodEnd = stripeSub.items.data[0]?.current_period_end;
    const status = mapStripeStatus(stripeSub.status);

    await this.prisma.$transaction([
      this.prisma.subscription.upsert({
        where: { userId },
        create: {
          userId,
          stripeCustomerId: customerId,
          stripeSubscriptionId: stripeSub.id,
          plan: planId as Plan,
          creditsPerCycle: PLANS[planId].credits,
          status,
          currentPeriodEnd: currentPeriodEnd ? new Date(currentPeriodEnd * 1000) : null,
        },
        update: {
          stripeCustomerId: customerId,
          stripeSubscriptionId: stripeSub.id,
          plan: planId as Plan,
          creditsPerCycle: PLANS[planId].credits,
          status,
          currentPeriodEnd: currentPeriodEnd ? new Date(currentPeriodEnd * 1000) : null,
        },
      }),
      this.prisma.user.update({ where: { id: userId }, data: { plan: planId as Plan } }),
    ]);
  }
}

function mapStripeStatus(status: Stripe.Subscription.Status): 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'INCOMPLETE' | 'TRIALING' {
  switch (status) {
    case 'active':
      return 'ACTIVE';
    case 'past_due':
      return 'PAST_DUE';
    case 'trialing':
      return 'TRIALING';
    case 'canceled':
    case 'unpaid':
      return 'CANCELED';
    default:
      return 'INCOMPLETE';
  }
}
