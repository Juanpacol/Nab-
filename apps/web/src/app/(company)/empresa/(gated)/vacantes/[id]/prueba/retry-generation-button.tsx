'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Button } from '@nab/ui';
import { regenerateTechTestAction } from '@/app/actions/tech-tests';

export function RetryGenerationButton({ testId }: { testId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function retry() {
    setError(null);
    startTransition(async () => {
      const result = await regenerateTechTestAction(testId);
      if (result.error) setError(result.error);
      else router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <Button onClick={retry} disabled={pending}>
        {pending ? 'Reintentando…' : 'Reintentar generación'}
      </Button>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
