'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Button } from '@nab/ui';
import { saveAutoApplySettingsAction, type AutoApplyState } from '@/app/actions/auto-apply';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Guardando…' : 'Guardar'}
    </Button>
  );
}

export function AutoApplyForm({
  initial,
}: {
  initial: { autoApplyEnabled: boolean; autoApplyMinScore: number; autoApplyMaxPerDay: number };
}) {
  const [state, action] = useActionState<AutoApplyState, FormData>(saveAutoApplySettingsAction, {});
  const [enabled, setEnabled] = useState(initial.autoApplyEnabled);

  return (
    <form action={action} className="space-y-4">
      {state.error && (
        <p className="rounded-sm bg-red-100 px-3 py-2 text-sm text-danger dark:bg-red-950/40">{state.error}</p>
      )}
      {state.ok && (
        <p className="rounded-sm bg-primary-soft px-3 py-2 text-sm text-primary">Configuración guardada.</p>
      )}

      <label className="flex items-center gap-2 text-sm text-foreground">
        <input
          type="checkbox"
          name="autoApplyEnabled"
          defaultChecked={initial.autoApplyEnabled}
          onChange={(e) => setEnabled(e.target.checked)}
          className="h-4 w-4 rounded-sm border-border accent-primary"
        />
        Activar auto-aplicación
      </label>
      <p className="text-sm text-muted">
        Nab genera un CV y aplica por ti a las vacantes con mejor match, sin que tengas que hacerlo a mano.
        Cada aplicación automática cuesta <strong>2 créditos</strong> (1 por el CV + 1 por aplicar).
      </p>

      {/* Nota: los inputs NUNCA llevan `disabled` — un input disabled no viaja en
          el FormData al enviar, y si el usuario apaga el toggle y guarda, el
          servidor recibiría `autoApplyMaxPerDay` vacío y rechazaría el form
          entero por validación. Solo se atenúan visualmente. */}
      <div className={enabled ? undefined : 'opacity-50'}>
        <div>
          <label className="mb-1 block text-sm text-foreground" htmlFor="autoApplyMinScore">
            Match mínimo para aplicar (%)
          </label>
          <input
            id="autoApplyMinScore"
            name="autoApplyMinScore"
            type="number"
            min={0}
            max={100}
            defaultValue={initial.autoApplyMinScore}
            className="h-11 w-32 rounded-sm border border-border bg-bg px-3 text-foreground outline-none focus:border-primary"
          />
        </div>
        <div className="mt-4">
          <label className="mb-1 block text-sm text-foreground" htmlFor="autoApplyMaxPerDay">
            Máximo de aplicaciones por día
          </label>
          <input
            id="autoApplyMaxPerDay"
            name="autoApplyMaxPerDay"
            type="number"
            min={1}
            max={10}
            defaultValue={initial.autoApplyMaxPerDay}
            className="h-11 w-32 rounded-sm border border-border bg-bg px-3 text-foreground outline-none focus:border-primary"
          />
        </div>
      </div>

      <SubmitButton />
    </form>
  );
}
