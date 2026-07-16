'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Button } from '@nab/ui';
import { detachTechTestAction } from '@/app/actions/tech-tests';

export function DetachTestButton({ jobId }: { jobId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function detach() {
    setError(null);
    startTransition(async () => {
      const result = await detachTechTestAction(jobId);
      if (result.error) setError(result.error);
      else router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <Button variant="danger" onClick={detach} disabled={pending}>
        {pending ? 'Quitando…' : 'Quitar de la vacante'}
      </Button>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
