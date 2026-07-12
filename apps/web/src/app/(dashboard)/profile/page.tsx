import Link from 'next/link';
import type { Metadata } from 'next';
import { Button, Card, CardContent, CardHeader, CardTitle } from '@nab/ui';
import { apiFetch } from '@/lib/api';
import { getAccessToken, getCurrentUser } from '@/lib/session';

export const metadata: Metadata = { title: 'Perfil' };

interface ProfileResponse {
  headline: string | null;
  summary: string | null;
  skills: string[];
  locations: string[];
  desiredRoles: string[];
  salaryMin: number | null;
  salaryMax: number | null;
  remotePreference: string;
}

const REMOTE_LABELS: Record<string, string> = {
  ANY: 'Cualquier modalidad',
  REMOTE: 'Remoto',
  HYBRID: 'Híbrido',
  ONSITE: 'Presencial',
};

export default async function ProfilePage() {
  const [user, access] = await Promise.all([getCurrentUser(), getAccessToken()]);
  let profile: ProfileResponse | null = null;
  if (access) {
    try {
      profile = await apiFetch<ProfileResponse | null>('/users/me/profile', {
        accessToken: access,
      });
    } catch {
      profile = null;
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl text-foreground">Tu perfil</h1>
          <p className="mt-1 text-sm text-muted">{user?.email}</p>
        </div>
        <Link href="/onboarding">
          <Button variant="outline">Editar</Button>
        </Link>
      </div>

      {!profile ? (
        <Card className="p-8 text-center">
          <p className="text-4xl">📝</p>
          <p className="mt-3 font-display text-xl text-foreground">Aún no tienes perfil</p>
          <p className="mt-1 text-sm text-muted">
            Complétalo para que Nab personalice tus vacantes.
          </p>
          <Link href="/onboarding" className="mt-4 inline-block">
            <Button>Completar perfil</Button>
          </Link>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Información profesional</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Row label="Titular" value={profile.headline ?? '—'} />
            {profile.summary && <Row label="Resumen" value={profile.summary} />}
            <div>
              <p className="font-mono text-xs uppercase tracking-wide text-muted">Habilidades</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {profile.skills.length ? (
                  profile.skills.map((s) => (
                    <span
                      key={s}
                      className="rounded-sm bg-surface-2 px-2 py-1 font-mono text-xs text-muted"
                    >
                      {s}
                    </span>
                  ))
                ) : (
                  <span className="text-sm text-muted">—</span>
                )}
              </div>
            </div>
            <Row
              label="Roles deseados"
              value={profile.desiredRoles.join(', ') || '—'}
            />
            <Row
              label="Preferencias"
              value={`${REMOTE_LABELS[profile.remotePreference] ?? profile.remotePreference}${
                profile.locations.length ? ' · ' + profile.locations.join(', ') : ''
              }`}
            />
          </CardContent>
        </Card>
      )}

      <div className="text-center">
        <Link href="/billing" className="text-sm text-primary hover:underline">
          Gestionar plan y facturación →
        </Link>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-mono text-xs uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 text-foreground">{value}</p>
    </div>
  );
}
