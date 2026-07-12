'use client';

import { useState, useTransition } from 'react';
import { Button } from '@nab/ui';
import type { PlanId } from '@nab/shared';
import { createCheckoutAction, createPortalAction } from '@/app/actions/billing';

/** Botón de checkout para un plan de pago (Fase 6): crea la sesión y redirige a Stripe. */
export function UpgradeButton({
  planId,
  label,
  variant = 'primary',
}: {
  planId: PlanId;
  label: string;
  variant?: 'primary' | 'outline' | 'secondary';
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onClick() {
    setError(null);
    start(async () => {
      const res = await createCheckoutAction(planId);
      if (res.url) window.location.href = res.url;
      else setError(res.error ?? 'No se pudo iniciar el pago.');
    });
  }

  return (
    <div className="w-full">
      <Button variant={variant} className="w-full" onClick={onClick} disabled={pending}>
        {pending ? 'Redirigiendo…' : label}
      </Button>
      {error && <p className="mt-2 text-xs text-danger">{error}</p>}
    </div>
  );
}

/** Botón al Customer Portal de Stripe (gestionar/cancelar/cambiar de plan). */
export function ManageBillingButton() {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onClick() {
    setError(null);
    start(async () => {
      const res = await createPortalAction();
      if (res.url) window.location.href = res.url;
      else setError(res.error ?? 'No se pudo abrir el portal de facturación.');
    });
  }

  return (
    <div>
      <Button variant="outline" onClick={onClick} disabled={pending}>
        {pending ? 'Abriendo…' : 'Gestionar suscripción'}
      </Button>
      {error && <p className="mt-2 text-xs text-danger">{error}</p>}
    </div>
  );
}
