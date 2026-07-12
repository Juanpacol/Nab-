import type { Metadata } from 'next';
import { PLANS, PAID_PLANS } from '@nab/shared';
import { Button, Card, cn } from '@nab/ui';

export const metadata: Metadata = { title: 'Facturación' };

export default function BillingPage() {
  const currentPlan = 'PRO';

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <h1 className="font-display text-3xl text-foreground">Plan y facturación</h1>
        <p className="mt-1 text-muted">
          Tu plan actual es <span className="font-medium text-primary">{PLANS[currentPlan].name}</span>.
        </p>
      </div>

      {/* Medidor de créditos */}
      <Card className="p-6">
        <div className="flex items-center justify-between">
          <p className="font-medium text-foreground">Créditos este ciclo</p>
          <span className="font-mono text-sm text-muted">142 / 200</span>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-2">
          <div className="h-full rounded-full bg-primary" style={{ width: '71%' }} />
        </div>
      </Card>

      {/* Planes (Stripe Checkout en Fase 6) */}
      <div className="grid gap-4 md:grid-cols-3">
        {PAID_PLANS.map((id) => {
          const plan = PLANS[id];
          const isCurrent = id === currentPlan;
          return (
            <Card
              key={id}
              className={cn('flex flex-col p-6', plan.highlighted && 'border-primary')}
            >
              <h2 className="font-display text-xl text-foreground">{plan.name}</h2>
              <p className="mt-2 font-mono text-2xl text-foreground">${plan.priceMonthly}/mes</p>
              <p className="mt-1 text-sm text-muted">{plan.credits} aplicaciones</p>
              <Button
                className="mt-6 w-full"
                variant={isCurrent ? 'secondary' : 'primary'}
                disabled={isCurrent}
              >
                {isCurrent ? 'Plan actual' : `Cambiar a ${plan.name}`}
              </Button>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
