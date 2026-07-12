import type { Metadata } from 'next';
import { Card, CardContent, CardHeader, CardTitle } from '@nab/ui';
import { getCurrentUser } from '@/lib/session';
import { ChangePasswordForm } from './settings-form';

export const metadata: Metadata = { title: 'Ajustes' };

export default async function SettingsPage() {
  const user = await getCurrentUser();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="font-display text-3xl text-foreground">Ajustes de cuenta</h1>

      <Card>
        <CardHeader>
          <CardTitle>Cuenta</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p className="text-muted">
            Correo: <span className="text-foreground">{user?.email}</span>
          </p>
          <p className="text-muted">
            Estado del correo:{' '}
            <span className={user?.emailVerified ? 'text-success' : 'text-warning'}>
              {user?.emailVerified ? 'Verificado' : 'Sin verificar'}
            </span>
          </p>
          <p className="text-muted">
            Plan: <span className="text-foreground">{user?.plan}</span>
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Seguridad</CardTitle>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm />
        </CardContent>
      </Card>
    </div>
  );
}
