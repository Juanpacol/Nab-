import type { Metadata } from 'next';
import { Card, CardContent, CardHeader, CardTitle } from '@nab/ui';
import { apiFetch } from '@/lib/api';
import { getAccessToken, getCurrentUser } from '@/lib/session';
import { ChangePasswordForm } from './settings-form';
import { AutoApplyForm } from './auto-apply-form';

export const metadata: Metadata = { title: 'Ajustes' };

interface ProfileAutoApply {
  autoApplyEnabled: boolean;
  autoApplyMinScore: number;
  autoApplyMaxPerDay: number;
}

export default async function SettingsPage() {
  const [user, access] = await Promise.all([getCurrentUser(), getAccessToken()]);
  let autoApply: ProfileAutoApply | null = null;
  if (access) {
    try {
      autoApply = await apiFetch<ProfileAutoApply | null>('/users/me/profile', { accessToken: access });
    } catch {
      autoApply = null;
    }
  }

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
          <CardTitle>Agente de auto-aplicación</CardTitle>
        </CardHeader>
        <CardContent>
          {autoApply ? (
            <AutoApplyForm initial={autoApply} />
          ) : (
            <p className="text-sm text-muted">
              Completa tu perfil primero (en <span className="text-foreground">/onboarding</span>) para poder
              activar la auto-aplicación.
            </p>
          )}
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
