'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { Button } from '@nab/ui';
import { loginAction, type AuthState } from '@/app/actions/auth';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button className="w-full" type="submit" disabled={pending}>
      {pending ? 'Entrando…' : 'Entrar'}
    </Button>
  );
}

export function LoginForm() {
  const [state, action] = useActionState<AuthState, FormData>(loginAction, {});

  return (
    <form action={action} className="mt-6 space-y-4">
      {state.error && (
        <p className="rounded-sm bg-red-100 px-3 py-2 text-sm text-danger dark:bg-red-950/40">
          {state.error}
        </p>
      )}
      <div>
        <label className="mb-1 block text-sm text-foreground" htmlFor="email">
          Correo
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          placeholder="tu@correo.com"
          className="h-11 w-full rounded-sm border border-border bg-bg px-3 text-foreground outline-none focus:border-primary"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm text-foreground" htmlFor="password">
          Contraseña
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          className="h-11 w-full rounded-sm border border-border bg-bg px-3 text-foreground outline-none focus:border-primary"
        />
      </div>
      <SubmitButton />
    </form>
  );
}
