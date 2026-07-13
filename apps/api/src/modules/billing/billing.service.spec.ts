import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';

/**
 * Se mockea el SDK de Stripe en el límite del módulo: estos tests verifican
 * NUESTRA lógica de despacho de eventos (qué hacemos con cada tipo de evento,
 * cómo reaccionamos a una firma inválida), no la criptografía de Stripe, que
 * ya está probada por Stripe mismo.
 */
const stripeMocks = vi.hoisted(() => ({
  constructEvent: vi.fn(),
  subscriptionsRetrieve: vi.fn(),
}));

vi.mock('stripe', () => ({
  default: vi.fn().mockImplementation(() => ({
    webhooks: { constructEvent: stripeMocks.constructEvent },
    subscriptions: { retrieve: stripeMocks.subscriptionsRetrieve },
    customers: { create: vi.fn() },
    checkout: { sessions: { create: vi.fn() } },
    billingPortal: { sessions: { create: vi.fn() } },
  })),
}));

// vi.mock se hoistea sobre este import estático, así que BillingService ya ve
// el Stripe mockeado de arriba.
import { BillingService } from './billing.service.js';

function createFakeDeps() {
  const subscriptions = new Map<string, any>();
  const users = new Map<string, { id: string; email: string; plan: string }>();

  const prisma: any = {
    subscription: {
      findUnique: vi.fn(async ({ where }: any) => {
        if (where.userId) return subscriptions.get(where.userId) ?? null;
        if (where.stripeSubscriptionId) {
          return [...subscriptions.values()].find((s) => s.stripeSubscriptionId === where.stripeSubscriptionId) ?? null;
        }
        return null;
      }),
      upsert: vi.fn(async ({ where, create, update }: any) => {
        const existing = subscriptions.get(where.userId);
        const record = existing ? { ...existing, ...update } : { userId: where.userId, ...create };
        subscriptions.set(where.userId, record);
        return record;
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const record = where.userId
          ? subscriptions.get(where.userId)
          : [...subscriptions.values()].find((s) => s.stripeSubscriptionId === where.stripeSubscriptionId);
        if (!record) throw new Error('Subscription not found');
        Object.assign(record, data);
        return record;
      }),
    },
    user: {
      findUnique: vi.fn(async ({ where }: any) => users.get(where.id) ?? null),
      findUniqueOrThrow: vi.fn(async ({ where }: any) => {
        const u = users.get(where.id);
        if (!u) throw new Error('Usuario no encontrado');
        return u;
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const u = users.get(where.id);
        if (u) Object.assign(u, data);
        return u;
      }),
    },
    $transaction: vi.fn(async (ops: any[]) => Promise.all(ops)),
  };

  const credits = { grant: vi.fn().mockResolvedValue(200) };
  const email = { enqueuePaymentFailed: vi.fn().mockResolvedValue(undefined) };

  return { prisma, credits, email, subscriptions, users };
}

describe('BillingService.handleWebhook', () => {
  beforeEach(() => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_fake';
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_fake';
    process.env.STRIPE_PRICE_PRO = 'price_pro_123';
    stripeMocks.constructEvent.mockReset();
    stripeMocks.subscriptionsRetrieve.mockReset();
  });

  it('rechaza con 400 y no acredita nada si la firma del webhook es inválida', async () => {
    const deps = createFakeDeps();
    const service = new BillingService(deps.prisma, deps.credits as any, deps.email as any);
    stripeMocks.constructEvent.mockImplementation(() => {
      throw new Error('signature mismatch');
    });

    await expect(service.handleWebhook(Buffer.from('{}'), 'bad-signature')).rejects.toThrow(BadRequestException);
    expect(deps.credits.grant).not.toHaveBeenCalled();
  });

  it('checkout.session.completed acredita el plan correcto y sincroniza la suscripción', async () => {
    const deps = createFakeDeps();
    deps.users.set('user-1', { id: 'user-1', email: 'ana@example.com', plan: 'FREE' });
    const service = new BillingService(deps.prisma, deps.credits as any, deps.email as any);

    stripeMocks.constructEvent.mockReturnValue({
      type: 'checkout.session.completed',
      data: {
        object: {
          metadata: { userId: 'user-1', planId: 'PRO' },
          client_reference_id: 'user-1',
          subscription: 'sub_123',
          customer: 'cus_123',
        },
      },
    });
    stripeMocks.subscriptionsRetrieve.mockResolvedValue({
      id: 'sub_123',
      status: 'active',
      items: { data: [{ current_period_end: 1_800_000_000, price: { id: 'price_pro_123' } }] },
    });

    await service.handleWebhook(Buffer.from('{}'), 'sig');

    expect(deps.credits.grant).toHaveBeenCalledWith('user-1', 200, 'SUBSCRIPTION_GRANT', 'sub_123');
    expect(deps.subscriptions.get('user-1')).toMatchObject({ plan: 'PRO', status: 'ACTIVE' });
    expect(deps.users.get('user-1')).toMatchObject({ plan: 'PRO' });
  });

  it('invoice.paid de renovación de ciclo otorga créditos con el id de la factura como refId', async () => {
    const deps = createFakeDeps();
    deps.users.set('user-1', { id: 'user-1', email: 'ana@example.com', plan: 'PRO' });
    deps.subscriptions.set('user-1', {
      userId: 'user-1',
      stripeSubscriptionId: 'sub_123',
      plan: 'PRO',
      status: 'ACTIVE',
    });
    const service = new BillingService(deps.prisma, deps.credits as any, deps.email as any);

    stripeMocks.constructEvent.mockReturnValue({
      type: 'invoice.paid',
      data: {
        object: {
          id: 'in_renewal_1',
          billing_reason: 'subscription_cycle',
          parent: { subscription_details: { subscription: 'sub_123' } },
        },
      },
    });

    await service.handleWebhook(Buffer.from('{}'), 'sig');

    expect(deps.credits.grant).toHaveBeenCalledWith('user-1', 200, 'SUBSCRIPTION_GRANT', 'in_renewal_1');
  });

  it('invoice.paid de la factura inicial (no renovación) no otorga créditos otra vez', async () => {
    const deps = createFakeDeps();
    const service = new BillingService(deps.prisma, deps.credits as any, deps.email as any);

    stripeMocks.constructEvent.mockReturnValue({
      type: 'invoice.paid',
      data: {
        object: {
          id: 'in_initial_1',
          billing_reason: 'subscription_create',
          parent: { subscription_details: { subscription: 'sub_123' } },
        },
      },
    });

    await service.handleWebhook(Buffer.from('{}'), 'sig');

    expect(deps.credits.grant).not.toHaveBeenCalled();
  });

  it('invoice.payment_failed marca la suscripción PAST_DUE y avisa por email, sin tocar créditos', async () => {
    const deps = createFakeDeps();
    deps.users.set('user-1', { id: 'user-1', email: 'ana@example.com', plan: 'PRO' });
    deps.subscriptions.set('user-1', {
      userId: 'user-1',
      stripeSubscriptionId: 'sub_123',
      plan: 'PRO',
      status: 'ACTIVE',
    });
    const service = new BillingService(deps.prisma, deps.credits as any, deps.email as any);

    stripeMocks.constructEvent.mockReturnValue({
      type: 'invoice.payment_failed',
      data: {
        object: {
          id: 'in_failed_1',
          parent: { subscription_details: { subscription: 'sub_123' } },
        },
      },
    });

    await service.handleWebhook(Buffer.from('{}'), 'sig');

    expect(deps.subscriptions.get('user-1')).toMatchObject({ status: 'PAST_DUE' });
    expect(deps.email.enqueuePaymentFailed).toHaveBeenCalledWith('ana@example.com');
    expect(deps.credits.grant).not.toHaveBeenCalled();
  });

  it('customer.subscription.deleted degrada el plan del usuario a FREE', async () => {
    const deps = createFakeDeps();
    deps.users.set('user-1', { id: 'user-1', email: 'ana@example.com', plan: 'PRO' });
    deps.subscriptions.set('user-1', {
      userId: 'user-1',
      stripeCustomerId: 'cus_123',
      stripeSubscriptionId: 'sub_123',
      plan: 'PRO',
      status: 'ACTIVE',
    });
    const service = new BillingService(deps.prisma, deps.credits as any, deps.email as any);

    stripeMocks.constructEvent.mockReturnValue({
      type: 'customer.subscription.deleted',
      data: {
        object: { id: 'sub_123', customer: 'cus_123', metadata: { userId: 'user-1' } },
      },
    });

    await service.handleWebhook(Buffer.from('{}'), 'sig');

    expect(deps.users.get('user-1')).toMatchObject({ plan: 'FREE' });
    expect(deps.subscriptions.get('user-1')).toMatchObject({ status: 'CANCELED' });
  });
});
