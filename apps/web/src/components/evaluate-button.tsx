'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Button } from '@nab/ui';
import { triggerEvaluationAction } from '@/app/actions/candidates';

export function EvaluateButton({
  companyId,
  jobId,
  submissionId,
}: {
  companyId: string;
  jobId: string;
  submissionId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function trigger() {
    setError(null);
    startTransition(async () => {
      const result = await triggerEvaluationAction(companyId, jobId, submissionId);
      if (result.error) setError(result.error);
      else router.refresh();
    });
  }

  return (
    <div>
      <Button onClick={trigger} disabled={pending}>
        {pending ? 'Iniciando…' : 'Evaluar con IA'}
      </Button>
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}
