import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/session';
import { CompanyOnboardingForm } from './company-onboarding-form';

export const metadata: Metadata = { title: 'Crea tu empresa · Nab' };

export default async function CompanyOnboardingPage() {
  const user = await getCurrentUser();
  // Ya tiene empresa: no hay nada que crear, lo mandamos a su home de RH.
  if (user?.recruiterCompany) redirect('/empresa');

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-4 py-12">
      <CompanyOnboardingForm />
    </div>
  );
}
