'use client';

import Link from 'next/link';
import { Button } from '@nab/ui';

export function CompareBar({ jobId, selectedIds }: { jobId: string; selectedIds: string[] }) {
  if (selectedIds.length === 0) return null;

  const inRange = selectedIds.length >= 2 && selectedIds.length <= 4;

  return (
    <div className="fixed inset-x-0 bottom-16 z-40 flex justify-center px-4 md:bottom-6">
      <div className="flex items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3 shadow-lifted">
        <span className="text-sm text-foreground">
          {selectedIds.length} candidato{selectedIds.length === 1 ? '' : 's'} seleccionado
          {selectedIds.length === 1 ? '' : 's'}
        </span>
        {inRange ? (
          <Link href={`/empresa/vacantes/${jobId}/candidatos/comparar?ids=${selectedIds.join(',')}`}>
            <Button>Comparar</Button>
          </Link>
        ) : (
          <span className="text-xs text-muted">Selecciona entre 2 y 4 para comparar</span>
        )}
      </div>
    </div>
  );
}
