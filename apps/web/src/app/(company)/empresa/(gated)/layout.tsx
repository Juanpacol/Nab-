import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Badge } from '@nab/ui';
import { Logo } from '@/components/logo';
import { ThemeToggle } from '@/components/theme-toggle';
import { CompanyNav } from '@/components/company-nav';
import { UserMenu } from '@/components/user-menu';
import { ChatUnreadListener } from '@/components/chat-unread-listener';
import { getCurrentUser, getAccessToken } from '@/lib/session';
import { getCompanyUnreadCount } from '@/lib/threads';

/** Shell del panel de empresa: topbar + nav. Exige que el usuario ya tenga una empresa. */
export default async function CompanyGatedLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (!user.recruiterCompany) redirect('/empresa/onboarding');
  const access = await getAccessToken();
  const unreadCount = access
    ? await getCompanyUnreadCount(user.recruiterCompany.id, access).catch(() => 0)
    : 0;

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-50 border-b border-border bg-bg/80 backdrop-blur-md">
        <div className="flex h-16 items-center justify-between px-4">
          <Link href="/empresa" className="flex items-center gap-2">
            <Logo />
            <Badge variant="neutral">Empresa</Badge>
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-muted sm:inline">{user.recruiterCompany.name}</span>
            <ThemeToggle />
            <UserMenu name={user.name} email={user.email} recruiterCompany={user.recruiterCompany} />
          </div>
        </div>
      </header>
      <div className="mx-auto flex max-w-6xl">
        <CompanyNav />
        <main className="min-h-[calc(100vh-4rem)] flex-1 px-4 pb-24 pt-6 md:pb-6">{children}</main>
      </div>
      <ChatUnreadListener side="company" initialCount={unreadCount} />
    </div>
  );
}
