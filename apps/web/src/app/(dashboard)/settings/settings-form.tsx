'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { Button } from '@nab/ui';
import { changePasswordAction, type AccountState } from '@/app/actions/account';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Guardando…' : 'Cambiar contraseña'}
    </Button>
  );
}

export function ChangePasswordForm() {
  const [state, action] = useActionState<AccountState, FormData>(changePasswordAction, {});

  return (
    <form action={action} className="space-y-4">
      {state.error && (
        <p className="rounded-sm bg-red-100 px-3 py-2 text-sm text-danger dark:bg-red-950/40">
          {state.error}
        </p>
      )}
      {state.ok && (
        <p className="rounded-sm bg-primary-soft px-3 py-2 text-sm text-primary">
          Contraseña actualizada. Se cerraron las otras sesiones.
        </p>
      )}
      <div>
        <label className="mb-1 block text-sm text-foreground" htmlFor="currentPassword">
          Contraseña actual
        </label>
        <input
          id="currentPassword"
          name="currentPassword"
          type="password"
          required
          className="h-11 w-full max-w-sm rounded-sm border border-border bg-bg px-3 text-foreground outline-none focus:border-primary"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm text-foreground" htmlFor="newPassword">
          Nueva contraseña
        </label>
        <input
          id="newPassword"
          name="newPassword"
          type="password"
          required
          minLength={8}
          className="h-11 w-full max-w-sm rounded-sm border border-border bg-bg px-3 text-foreground outline-none focus:border-primary"
        />
      </div>
      <SubmitButton />
    </form>
  );
}
