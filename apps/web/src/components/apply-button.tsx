'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { Button } from '@nab/ui';
import { applyAction } from '@/app/actions/applications';

/** Aplicación interna (vacantes source=COMPANY, sin applyUrl externo) desde el detalle de la vacante. */
export function ApplyButton({ jobId }: { jobId: string }) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ error?: string; alreadyApplied?: boolean; testApplicationId?: string } | null>(
    null,
  );

  function apply() {
    startTransition(async () => {
      const res = await applyAction(jobId);
      if (res.error) {
        setResult({ error: res.error });
      } else {
        setResult({
          alreadyApplied: res.alreadyApplied,
          testApplicationId: res.requiresTest && res.applicationId ? res.applicationId : undefined,
        });
      }
    });
  }

  if (result?.alreadyApplied) {
    return <p className="text-sm text-muted">Ya aplicaste a esta vacante.</p>;
  }

  if (result?.testApplicationId) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm text-primary">¡Aplicaste! Esta vacante incluye una prueba técnica.</p>
        <Link href={`/applications/${result.testApplicationId}/prueba`}>
          <Button>Realizar prueba ahora</Button>
        </Link>
      </div>
    );
  }

  const applied = Boolean(result) && !result?.error;
  return (
    <div className="flex flex-col gap-1">
      <Button onClick={apply} disabled={pending || applied}>
        {pending ? 'Aplicando…' : applied ? 'Aplicaste ✓' : 'Aplicar (asistido)'}
      </Button>
      {result?.error && <p className="text-xs text-danger">{result.error}</p>}
    </div>
  );
}
