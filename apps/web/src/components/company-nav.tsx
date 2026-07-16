'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@nab/ui';
import { useUnreadStore } from '@/stores/unread';

const NAV = [
  { href: '/empresa', label: 'Inicio', icon: '🏠' },
  { href: '/empresa/vacantes', label: 'Vacantes', icon: '📢' },
  { href: '/empresa/mensajes', label: 'Mensajes', icon: '💬', showUnread: true },
  { href: '/empresa/configuracion', label: 'Configuración', icon: '⚙️' },
];

function UnreadDot() {
  const count = useUnreadStore((s) => s.count);
  if (count === 0) return null;
  return (
    <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1 font-mono text-[10px] font-medium text-white">
      {count > 9 ? '9+' : count}
    </span>
  );
}

/** Navegación del portal de empresa — mismo patrón visual que DashboardNav. */
export function CompanyNav() {
  const pathname = usePathname();

  const isActive = (href: string) => (href === '/empresa' ? pathname === href : pathname?.startsWith(href));

  return (
    <>
      <aside className="hidden w-60 shrink-0 border-r border-border bg-surface/40 md:block">
        <nav className="sticky top-16 flex flex-col gap-1 p-4">
          {NAV.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-sm px-3 py-2 text-sm transition-colors',
                  active
                    ? 'bg-primary-soft font-medium text-primary'
                    : 'text-muted hover:bg-surface-2 hover:text-foreground',
                )}
              >
                <span>{item.icon}</span>
                {item.label}
                {item.showUnread && <UnreadDot />}
              </Link>
            );
          })}
        </nav>
      </aside>

      <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-surface md:hidden">
        {NAV.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'relative flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px]',
                active ? 'text-primary' : 'text-muted',
              )}
            >
              <span className="text-lg">{item.icon}</span>
              {item.label}
              {item.showUnread && (
                <span className="absolute right-1/4 top-1">
                  <UnreadDot />
                </span>
              )}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
