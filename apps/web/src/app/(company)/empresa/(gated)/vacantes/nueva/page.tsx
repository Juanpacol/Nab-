import type { Metadata } from 'next';
import { CompanyJobForm } from '../company-job-form';

export const metadata: Metadata = { title: 'Publicar vacante · Nab' };

export default function NewCompanyJobPage() {
  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="font-display text-2xl text-foreground">Publicar vacante</h1>
        <p className="text-sm text-muted">Los candidatos de Nab la verán en su feed y podrán aplicar directamente.</p>
      </div>
      <CompanyJobForm mode="create" />
    </div>
  );
}
