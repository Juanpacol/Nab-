'use client';

import { useState, useTransition } from 'react';
import { Button } from '@nab/ui';
import { updateNotesAction } from '@/app/actions/applications';

/** Editor de notas de una aplicación (Fase 4), con guardado explícito. */
export function NotesEditor({ id, initial }: { id: string; initial: string }) {
  const [notes, setNotes] = useState(initial);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();

  function save() {
    setSaved(false);
    start(async () => {
      const res = await updateNotesAction(id, notes);
      if (!res.error) setSaved(true);
    });
  }

  return (
    <div className="space-y-2">
      <textarea
        value={notes}
        onChange={(e) => {
          setNotes(e.target.value);
          setSaved(false);
        }}
        rows={4}
        placeholder="Notas: contactos, fechas de entrevista, seguimiento…"
        className="w-full rounded-md border border-border bg-bg p-3 text-sm text-foreground outline-none focus:border-primary"
      />
      <div className="flex items-center gap-3">
        <Button size="sm" variant="outline" onClick={save} disabled={pending}>
          {pending ? 'Guardando…' : 'Guardar notas'}
        </Button>
        {saved && <span className="text-xs text-success">Guardado ✓</span>}
      </div>
    </div>
  );
}
