import Link from 'next/link';
import { PLANS, PAID_PLANS } from '@nab/shared';
import { Button, Card, cn } from '@nab/ui';
import { Reveal } from '../reveal';

export function Pricing() {
  return (
    <section id="pricing" className="bg-surface/40 py-24">
      <div className="mx-auto max-w-6xl px-4">
        <Reveal>
          <div className="mx-auto max-w-2xl text-center">
            <p className="font-mono text-xs uppercase tracking-widest text-primary">Precios</p>
            <h2 className="mt-3 text-balance font-display text-4xl text-foreground">
              Elige cuántas oportunidades quieres perseguir
            </h2>
            <p className="mt-4 text-muted">
              Créditos mensuales de aplicaciones. Cancela cuando quieras.
            </p>
          </div>
        </Reveal>
        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {PAID_PLANS.map((id, i) => {
            const plan = PLANS[id];
            return (
              <Reveal key={id} delay={i * 0.08}>
                <Card
                  className={cn(
                    'relative flex h-full flex-col p-8',
                    plan.highlighted && 'border-primary shadow-lifted',
                  )}
                >
                  {plan.highlighted && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-1 font-mono text-xs text-primary-fg">
                      Más popular
                    </span>
                  )}
                  <h3 className="font-display text-2xl text-foreground">{plan.name}</h3>
                  <div className="mt-4 flex items-baseline gap-1">
                    <span className="font-display text-4xl text-foreground">
                      ${plan.priceMonthly}
                    </span>
                    <span className="text-muted">/mes</span>
                  </div>
                  <p className="mt-1 font-mono text-sm text-primary">
                    {plan.credits} aplicaciones/mes
                  </p>
                  <ul className="mt-6 flex-1 space-y-3">
                    {plan.features.map((f) => (
                      <li key={f} className="flex gap-2 text-sm text-foreground">
                        <span className="text-primary">✓</span>
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Link href="/register" className="mt-8">
                    <Button variant={plan.highlighted ? 'primary' : 'outline'} className="w-full">
                      Elegir {plan.name}
                    </Button>
                  </Link>
                </Card>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
