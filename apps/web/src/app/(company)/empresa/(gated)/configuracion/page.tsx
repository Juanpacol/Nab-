import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getCompany } from '@/lib/companies';
import { getAccessToken, getCurrentUser } from '@/lib/session';
import { CompanySettingsForm } from './company-settings-form';

export const metadata: Metadata = { title: 'Configuración de la empresa · Nab' };

export default async function CompanySettingsPage() {
  const user = await getCurrentUser();
  if (!user?.recruiterCompany) redirect('/empresa/onboarding');
  const access = await getAccessToken();
  if (!access) redirect('/login');

  const company = await getCompany(user.recruiterCompany.id, access);

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h1 className="font-display text-2xl text-foreground">Configuración</h1>
        <p className="text-sm text-muted">Datos públicos de {company.name} visibles para los candidatos.</p>
      </div>
      <CompanySettingsForm company={company} canEdit={user.recruiterCompany.role === 'OWNER'} />
    </div>
  );
}
