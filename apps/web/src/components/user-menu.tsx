'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { logoutAction } from '@/app/actions/auth';

/** Avatar + menú desplegable con ajustes y cerrar sesión. */
export function UserMenu({ name, email }: { name: string | null; email: string }) {
  const [open, setOpen] = useState(false);
  const initial = (name ?? email).charAt(0).toUpperCase();
  const menuRef = useRef<HTMLDivElement>(null);

  // Sin esto, un usuario de teclado podía abrir el menú pero no cerrarlo sin
  // hacer clic fuera (no hay forma de hacerlo solo con teclado).
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', onKeyDown);
    menuRef.current?.querySelector<HTMLElement>('a, button')?.focus();
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Cuenta"
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-soft font-medium text-primary"
      >
        {initial}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            ref={menuRef}
            role="menu"
            className="absolute right-0 z-50 mt-2 w-52 rounded border border-border bg-surface p-1 shadow-lifted"
          >
            <div className="px-3 py-2">
              <p className="truncate text-sm font-medium text-foreground">{name ?? 'Tu cuenta'}</p>
              <p className="truncate text-xs text-muted">{email}</p>
            </div>
            <div className="my-1 h-px bg-border" />
            <Link
              href="/profile"
              role="menuitem"
              className="block rounded-sm px-3 py-2 text-sm text-foreground hover:bg-surface-2"
              onClick={() => setOpen(false)}
            >
              Perfil
            </Link>
            <Link
              href="/settings"
              role="menuitem"
              className="block rounded-sm px-3 py-2 text-sm text-foreground hover:bg-surface-2"
              onClick={() => setOpen(false)}
            >
              Ajustes
            </Link>
            <form action={logoutAction}>
              <button
                type="submit"
                role="menuitem"
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
