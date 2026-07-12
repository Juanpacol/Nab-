'use client';

import { useState } from 'react';
import Link from 'next/link';
import { logoutAction } from '@/app/actions/auth';

/** Avatar + menú desplegable con ajustes y cerrar sesión. */
export function UserMenu({ name, email }: { name: string | null; email: string }) {
  const [open, setOpen] = useState(false);
  const initial = (name ?? email).charAt(0).toUpperCase();

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Cuenta"
        className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-soft font-medium text-primary"
      >
        {initial}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-50 mt-2 w-52 rounded border border-border bg-surface p-1 shadow-lifted">
            <div className="px-3 py-2">
              <p className="truncate text-sm font-medium text-foreground">{name ?? 'Tu cuenta'}</p>
              <p className="truncate text-xs text-muted">{email}</p>
            </div>
            <div className="my-1 h-px bg-border" />
            <Link
              href="/profile"
              className="block rounded-sm px-3 py-2 text-sm text-foreground hover:bg-surface-2"
              onClick={() => setOpen(false)}
            >
              Perfil
            </Link>
            <Link
              href="/settings"
              className="block rounded-sm px-3 py-2 text-sm text-foreground hover:bg-surface-2"
              onClick={() => setOpen(false)}
            >
              Ajustes
            </Link>
            <form action={logoutAction}>
              <button
                type="submit"
                className="w-full rounded-sm px-3 py-2 text-left text-sm text-danger hover:bg-surface-2"
              >
                Cerrar sesión
              </button>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
