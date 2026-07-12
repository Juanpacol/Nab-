import Link from 'next/link';
import { Badge } from '@nab/ui';
import { Logo } from '@/components/logo';
import { ThemeToggle } from '@/components/theme-toggle';
import { DashboardNav } from '@/components/dashboard-nav';

/** Shell del panel: topbar con medidor de créditos + nav lateral/inferior. */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-50 border-b border-border bg-bg/80 backdrop-blur-md">
        <div className="flex h-16 items-center justify-between px-4">
          <Link href="/dashboard">
            <Logo />
          </Link>
          <div className="flex items-center gap-3">
            {/* Medidor de créditos (se conecta en Fase 6) */}
            <Badge variant="primary">⚡ 200 créditos</Badge>
            <ThemeToggle />
            <div className="h-9 w-9 rounded-full bg-surface-2" aria-label="Cuenta" />
          </div>
        </div>
      </header>
      <div className="mx-auto flex max-w-6xl">
        <DashboardNav />
        <main className="min-h-[calc(100vh-4rem)] flex-1 px-4 pb-24 pt-6 md:pb-6">{children}</main>
      </div>
    </div>
  );
}
