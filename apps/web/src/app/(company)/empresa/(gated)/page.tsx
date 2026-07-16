import type { Metadata } from 'next';
import Link from 'next/link';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@nab/ui';
import { getCurrentUser } from '@/lib/session';

export const metadata: Metadata = { title: 'Empresa · Nab' };

export default async function CompanyHomePage() {
  const user = await getCurrentUser();
  const companyName = user?.recruiterCompany?.name ?? 'tu empresa';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl text-foreground">Hola, {companyName} 👋</h1>
        <p className="text-sm text-muted">Publica vacantes, crea pruebas técnicas con IA y da seguimiento a tus candidatos.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Empieza por publicar tu primera vacante</CardTitle>
          <CardDescription>
            Los candidatos de Nab la verán en su feed y podrán aplicar directamente.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/empresa/vacantes/nueva">
            <Button>Publicar vacante</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
