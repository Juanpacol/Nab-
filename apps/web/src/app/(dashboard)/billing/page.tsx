import type { Metadata } from 'next';
import { PLANS, PAID_PLANS, type PlanId } from '@nab/shared';
import { Badge, Card, cn } from '@nab/ui';
import { apiFetch } from '@/lib/api';
import { getAccessToken, getCurrentUser } from '@/lib/session';
import { UpgradeButton, ManageBillingButton } from '@/components/billing-actions';

export const metadata: Metadata = { title: 'Facturación' };

interface Subscription {
  plan: string;
  status: string;
  currentPeriodEnd: string | null;
  stripeCustomerId: string | null;
}

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const user = await getCurrentUser();
  const access = await getAccessToken();

  let subscription: Subscription | null = null;
  try {
    const res = await apiFetch<{ subscription: Subscription | null }>('/billing/subscription', {
      accessToken: access ?? undefined,
    });
    subscription = res.subscription;
  } catch {
    subscription = null;
  }

  const currentPlan = (user?.plan as PlanId) ?? 'FREE';
  const plan = PLANS[currentPlan];
  const credits = user?.creditsRemaining ?? 0;
  const usagePct = plan.credits > 0 ? Math.min(100, Math.round((credits / plan.credits) * 100)) : 0;

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <h1 className="font-display text-3xl text-foreground">Plan y facturación</h1>
        <p className="mt-1 text-muted">
          Tu plan actual es <span className="font-medium text-primary">{plan.name}</span>.
        </p>
      </div>

      {sp.checkout === 'success' && (
        <Card className="border-success/40 bg-primary-soft/40 p-4 text-sm text-foreground">
          ✓ ¡Listo! Tu suscripción se está activando — puede tardar unos segundos en reflejarse.
        </Card>
      )}
      {sp.checkout === 'cancelled' && (
        <Card className="p-4 text-sm text-muted">El pago se canceló. No se realizó ningún cargo.</Card>
      )}

      {/* Medidor de créditos */}
      <Card className="p-6">
        <div className="flex items-center justify-between">
          <p className="font-medium text-foreground">Créditos disponibles</p>
          <span className="font-mono text-sm text-muted">
            {credits}
            {plan.credits > 0 ? ` / ${plan.credits}` : ''}
          </span>
        </div>
        {plan.credits > 0 && (
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-2">
            <div className="h-full rounded-full bg-primary" style={{ width: `${usagePct}%` }} />
          </div>
        )}
        {subscription?.currentPeriodEnd && (
          <p className="mt-3 text-xs text-muted">
            Próxima renovación:{' '}
            {new Date(subscription.currentPeriodEnd).toLocaleDateString('es', { dateStyle: 'long' })}
          </p>
        )}
        {subscription?.stripeCustomerId && (
          <div className="mt-4">
            <ManageBillingButton />
          </div>
        )}
      </Card>

      {/* Planes */}
      <div className="grid gap-4 md:grid-cols-3">
        {PAID_PLANS.map((id) => {
          const p = PLANS[id];
          const isCurrent = id === currentPlan;
          return (
            <Card key={id} className={cn('flex flex-col p-6', p.highlighted && 'border-primary')}>
              <div className="flex items-center justify-between">
                <h2 className="font-display text-xl text-foreground">{p.name}</h2>
                {p.highlighted && <Badge variant="primary">Popular</Badge>}
              </div>
              <p className="mt-2 font-mono text-2xl text-foreground">${p.priceMonthly}/mes</p>
              <p className="mt-1 text-sm text-muted">{p.credits} aplicaciones/mes</p>
              <ul className="mt-4 flex-1 space-y-2">
                {p.features.map((f) => (
                  <li key={f} className="flex gap-2 text-xs text-muted">
                    <span className="text-primary">✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              <div className="mt-6">
                {isCurrent ? (
                  <Badge className="w-full justify-center py-2">Plan actual</Badge>
                ) : (
                  <UpgradeButton
                    planId={id}
                    label={`Cambiar a ${p.name}`}
                    variant={p.highlighted ? 'primary' : 'outline'}
                  />
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
