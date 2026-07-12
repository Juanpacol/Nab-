'use client';

import { useState, useTransition } from 'react';
import { Button } from '@nab/ui';
import { saveJobAction } from '@/app/actions/jobs';

/** Botón para guardar una vacante; muestra el estado tras guardar. */
export function SaveJobButton({ jobId, size = 'sm' }: { jobId: string; size?: 'sm' | 'md' }) {
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const res = await saveJobAction(jobId);
      if (res.saved) setSaved(true);
    });
  }

  return (
    <Button
      variant={saved ? 'secondary' : 'outline'}
      size={size}
      disabled={pending || saved}
      onClick={handleClick}
    >
      {saved ? '✓ Guardada' : pending ? 'Guardando…' : 'Guardar'}
    </Button>
  );
}
