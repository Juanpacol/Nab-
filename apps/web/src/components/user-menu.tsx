'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@nab/ui';
import type { RecruiterCompanySummary } from '@nab/shared';
import { logoutAction } from '@/app/actions/auth';
import { switchModeAction } from '@/app/actions/company';
import { disconnectRealtime } from '@/lib/socket';

interface UserMenuProps {
  name: string | null;
  email: string;
  /** Si el usuario es recruiter de alguna empresa, habilita el switch candidato↔empresa. */
  recruiterCompany?: RecruiterCompanySummary | null;
}

/** Avatar + menú desplegable con ajustes, switch candidato↔empresa y cerrar sesión. */
export function UserMenu({ name, email, recruiterCompany }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const initial = (name ?? email).charAt(0).toUpperCase();
  const menuRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const inCompanyMode = pathname?.startsWith('/empresa') ?? false;

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
      <Button
        onClick={() => setOpen((v) => !v)}
        aria-label="Cuenta"
        aria-haspopup="menu"
        aria-expanded={open}
        variant="ghost"
        size="icon"
        className="rounded-full bg-primary-soft font-medium text-primary hover:bg-primary-soft"
      >
        {initial}
      </Button>
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
            {recruiterCompany && (
              <>
                <div className="my-1 h-px bg-border" />
                <Button
                  type="button"
                  role="menuitem"
                  variant="ghost"
                  onClick={() => {
                    setOpen(false);
                    void switchModeAction(inCompanyMode ? 'candidate' : 'company');
                  }}
                  className="h-auto w-full justify-start rounded-sm px-3 py-2 text-left text-sm text-foreground"
                >
                  {inCompanyMode ? 'Modo candidato' : `Modo empresa · ${recruiterCompany.name}`}
                </Button>
              </>
            )}
            <form action={logoutAction}>
              <Button
                type="submit"
                role="menuitem"
                variant="ghost"
                onClick={() => disconnectRealtime()}
                className="h-auto w-full justify-start rounded-sm px-3 py-2 text-left text-sm text-danger"
              >
                Cerrar sesión
              </Button>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
