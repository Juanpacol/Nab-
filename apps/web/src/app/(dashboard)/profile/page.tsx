import Link from 'next/link';
import type { Metadata } from 'next';
import { Button, Card, CardContent, CardHeader, CardTitle } from '@nab/ui';

export const metadata: Metadata = { title: 'Perfil' };

const SKILLS = ['TypeScript', 'React', 'Node.js', 'PostgreSQL', 'AWS', 'Next.js'];

export default function ProfilePage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl text-foreground">Tu perfil</h1>
        <Button variant="outline">Editar</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Información profesional</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="font-mono text-xs uppercase tracking-wide text-muted">Titular</p>
            <p className="mt-1 text-foreground">Ingeniero Full Stack · React &amp; Node</p>
          </div>
          <div>
            <p className="font-mono text-xs uppercase tracking-wide text-muted">Habilidades</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {SKILLS.map((s) => (
                <span
                  key={s}
                  className="rounded-sm bg-surface-2 px-2 py-1 font-mono text-xs text-muted"
                >
                  {s}
                </span>
              ))}
            </div>
          </div>
          <div>
            <p className="font-mono text-xs uppercase tracking-wide text-muted">Preferencias</p>
            <p className="mt-1 text-sm text-foreground">Remoto · US$60k–110k · LATAM</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>CV base</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted">
            Sube tu CV y Nab extraerá tu experiencia con IA para prellenar tu perfil (Fase 1).
          </p>
          <Button className="mt-4" variant="outline">
            Subir CV (PDF)
          </Button>
        </CardContent>
      </Card>

      <div className="text-center">
        <Link href="/billing" className="text-sm text-primary hover:underline">
          Gestionar plan y facturación →
        </Link>
      </div>
    </div>
  );
}
