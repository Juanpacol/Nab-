import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Badge } from '@nab/ui';
import { Logo } from '@/components/logo';
import { ThemeToggle } from '@/components/theme-toggle';
import { DashboardNav } from '@/components/dashboard-nav';
import { UserMenu } from '@/components/user-menu';
import { SupportWidget } from '@/components/support-widget';
import { RealtimeToaster } from '@/components/realtime-toaster';
import { getCurrentUser } from '@/lib/session';

/** Shell del panel: topbar con créditos reales + nav lateral/inferior. */
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-50 border-b border-border bg-bg/80 backdrop-blur-md">
        <div className="flex h-16 items-center justify-between px-4">
          <Link href="/dashboard">
            <Logo />
          </Link>
          <div className="flex items-center gap-3">
            <Badge variant="primary">⚡ {user.creditsRemaining} créditos</Badge>
            <ThemeToggle />
            <UserMenu name={user.name} email={user.email} />
          </div>
        </div>
      </header>
      <div className="mx-auto flex max-w-6xl">
        <DashboardNav />
        <main className="min-h-[calc(100vh-4rem)] flex-1 px-4 pb-24 pt-6 md:pb-6">{children}</main>
      </div>
      <SupportWidget />
      <RealtimeToaster />
    </div>
  );
}
