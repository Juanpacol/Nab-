'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { Button } from '@nab/ui';
import { registerAction, type AuthState } from '@/app/actions/auth';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button className="w-full" type="submit" disabled={pending}>
      {pending ? 'Creando cuenta…' : 'Crear cuenta'}
    </Button>
  );
}

export function RegisterForm() {
  const [state, action] = useActionState<AuthState, FormData>(registerAction, {});

  return (
    <form action={action} className="mt-6 space-y-4">
      {state.error && (
        <p className="rounded-sm bg-red-100 px-3 py-2 text-sm text-danger dark:bg-red-950/40">
          {state.error}
        </p>
      )}
      <div>
        <label className="mb-1 block text-sm text-foreground" htmlFor="name">
          Nombre
        </label>
        <input
          id="name"
          name="name"
          type="text"
          className="h-11 w-full rounded-sm border border-border bg-bg px-3 text-foreground outline-none focus:border-primary"
        />
      </div>
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
          minLength={8}
          className="h-11 w-full rounded-sm border border-border bg-bg px-3 text-foreground outline-none focus:border-primary"
        />
      </div>
      <SubmitButton />
    </form>
  );
}
