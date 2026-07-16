import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { Badge, Button, Card } from '@nab/ui';
import { APPLICATION_STATUS_LABELS } from '@nab/shared';
import { getApplication, type ApplicationDetail } from '@/lib/applications';
import { getCurrentUser } from '@/lib/session';
import { NotesEditor } from '@/components/notes-editor';
import { TestStatusCard } from '@/components/test-status-card';
import { ApplicationChatCard } from '@/components/application-chat-card';

export const metadata: Metadata = { title: 'Aplicación' };

const EVENT_LABELS: Record<string, string> = {
  applied: 'Aplicaste (asistido)',
  status_changed: 'Cambio de estado',
  saved: 'Guardada',
  note: 'Nota actualizada',
};

function eventText(e: ApplicationDetail['events'][number]): string {
  const label = EVENT_LABELS[e.eventType] ?? e.eventType;
  const status = (e.payload as { status?: string } | null)?.status;
  return status ? `${label} → ${APPLICATION_STATUS_LABELS[status] ?? status}` : label;
}

export default async function ApplicationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  let app: ApplicationDetail;
  try {
    app = await getApplication(id);
  } catch {
    notFound();
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link href="/applications" className="text-sm text-primary hover:underline">
        ← Volver al seguimiento
      </Link>

      <Card className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl text-foreground">{app.job.title}</h1>
            <p className="mt-1 text-muted">
              {app.job.company}
              {app.job.location ? ` · ${app.job.location}` : ''}
            </p>
          </div>
          <Badge variant="primary">{APPLICATION_STATUS_LABELS[app.status] ?? app.status}</Badge>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {app.job.applyUrl && (
            <a href={app.job.applyUrl} target="_blank" rel="noreferrer">
              <Button size="sm">Abrir vacante</Button>
            </a>
          )}
          {app.resume && (
            <span className="self-center text-xs text-muted">
              CV adjunto{app.resume.atsScore != null ? ` · ATS ${app.resume.atsScore}%` : ''}
            </span>
          )}
        </div>
      </Card>

      {app.job.techTestId && (
        <Card className="p-6">
          <h2 className="font-display text-lg text-foreground">Prueba técnica</h2>
          <div className="mt-3">
            <TestStatusCard applicationId={app.id} submission={app.testSubmission} />
          </div>
        </Card>
      )}

      {!app.job.applyUrl && (
        <Card className="p-6">
          <h2 className="font-display text-lg text-foreground">Chat con {app.job.company}</h2>
          <div className="mt-3">
            <ApplicationChatCard applicationId={app.id} currentUserId={user.id} companyName={app.job.company} />
          </div>
        </Card>
      )}

      <Card className="p-6">
        <h2 className="font-display text-lg text-foreground">Notas</h2>
        <div className="mt-3">
          <NotesEditor id={app.id} initial={app.notes ?? ''} />
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="font-display text-lg text-foreground">Historial</h2>
        <ol className="mt-4 space-y-4">
          {app.events.map((e) => (
            <li key={e.id} className="flex gap-3">
              <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
              <div>
                <p className="text-sm text-foreground">{eventText(e)}</p>
                <p className="text-xs text-muted">
                  {new Date(e.createdAt).toLocaleString('es', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </Card>
    </div>
  );
}
