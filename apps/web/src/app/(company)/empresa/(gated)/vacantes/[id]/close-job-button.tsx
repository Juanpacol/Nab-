'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Button } from '@nab/ui';
import { toggleCompanyJobActiveAction } from '@/app/actions/company-jobs';

export function CloseJobButton({
  companyId,
  jobId,
  isActive,
}: {
  companyId: string;
  jobId: string;
  isActive: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle() {
    setError(null);
    startTransition(async () => {
      const result = await toggleCompanyJobActiveAction(companyId, jobId, !isActive);
      if (result.error) setError(result.error);
      else router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button variant={isActive ? 'danger' : 'secondary'} onClick={toggle} disabled={pending}>
        {pending ? 'Guardando…' : isActive ? 'Cerrar vacante' : 'Reabrir vacante'}
      </Button>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
