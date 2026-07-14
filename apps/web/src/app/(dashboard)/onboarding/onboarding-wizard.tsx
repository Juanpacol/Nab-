'use client';

import { useActionState, useEffect, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import { Button, Card } from '@nab/ui';
import { saveProfileAction, type ProfileState } from '@/app/actions/profile';

type Step = 'cv' | 'form';

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Guardando…' : 'Guardar y continuar'}
    </Button>
  );
}

export function OnboardingWizard({
  initial,
}: {
  initial: {
    headline: string;
    summary: string;
    skills: string;
    locations: string;
    desiredRoles: string;
    remotePreference: string;
  };
}) {
  const [step, setStep] = useState<Step>('cv');
  const [cvStatus, setCvStatus] = useState<'idle' | 'uploading' | 'done' | 'error'>('idle');
  const router = useRouter();
  const [state, action] = useActionState<ProfileState, FormData>(saveProfileAction, {});

  // Navegar es un side-effect: hacerlo en el cuerpo del render (en vez de en
  // un efecto) corre en cada render mientras `state.ok` sea true, lo cual
  // React puede advertir o manejar de forma inconsistente (doble navegación).
  useEffect(() => {
    if (state.ok) router.push('/dashboard');
  }, [state.ok, router]);

  async function handleCv(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCvStatus('uploading');
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch('/api/resume', { method: 'POST', body: fd });
    setCvStatus(res.ok ? 'done' : 'error');
  }

  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-6 flex items-center gap-2 font-mono text-xs text-muted">
        <span className={step === 'cv' ? 'text-primary' : ''}>1. Tu CV</span>
        <span>→</span>
        <span className={step === 'form' ? 'text-primary' : ''}>2. Tu perfil</span>
      </div>

      {step === 'cv' ? (
        <Card className="p-8">
          <h1 className="font-display text-2xl text-foreground">Empecemos por tu CV</h1>
          <p className="mt-2 text-sm text-muted">
            Sube tu CV en PDF y la IA extraerá tu experiencia para prellenar tu perfil. También
            puedes saltarte este paso y llenarlo a mano.
          </p>

          <label className="mt-6 flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-border py-10 text-center hover:border-primary">
            <span className="text-3xl">📄</span>
            <span className="mt-2 text-sm text-foreground">
              {cvStatus === 'uploading'
                ? 'Subiendo y procesando…'
                : cvStatus === 'done'
                  ? '✓ CV recibido — lo estamos procesando'
                  : cvStatus === 'error'
                    ? 'Hubo un error, intenta de nuevo'
                    : 'Haz clic para subir tu CV (PDF)'}
            </span>
            <input type="file" accept="application/pdf" className="hidden" onChange={handleCv} />
          </label>

          <div className="mt-6 flex justify-between">
            <Button variant="ghost" onClick={() => setStep('form')}>
              Saltar por ahora
            </Button>
            <Button onClick={() => setStep('form')}>Continuar</Button>
          </div>
        </Card>
      ) : (
        <Card className="p-8">
          <h1 className="font-display text-2xl text-foreground">Cuéntanos sobre ti</h1>
          <p className="mt-2 text-sm text-muted">
            Esto ayuda a Nab a encontrar y personalizar las mejores vacantes para ti.
          </p>

          <form action={action} className="mt-6 space-y-4">
            {state.error && (
              <p className="rounded-sm bg-red-100 px-3 py-2 text-sm text-danger dark:bg-red-950/40">
                {state.error}
              </p>
            )}
            <Field name="headline" label="Titular profesional" defaultValue={initial.headline} placeholder="Ingeniero Full Stack" />
            <Field name="skills" label="Habilidades (separadas por coma)" defaultValue={initial.skills} placeholder="React, Node.js, PostgreSQL" />
            <Field name="desiredRoles" label="Roles que buscas (coma)" defaultValue={initial.desiredRoles} placeholder="Frontend, Full Stack" />
            <Field name="locations" label="Ubicaciones (coma)" defaultValue={initial.locations} placeholder="Remoto, Ciudad de México" />
            <div>
              <label className="mb-1 block text-sm text-foreground" htmlFor="remotePreference">
                Preferencia de modalidad
              </label>
              <select
                id="remotePreference"
                name="remotePreference"
                defaultValue={initial.remotePreference}
                className="h-11 w-full rounded-sm border border-border bg-bg px-3 text-foreground outline-none focus:border-primary"
              >
                <option value="ANY">Cualquiera</option>
                <option value="REMOTE">Remoto</option>
                <option value="HYBRID">Híbrido</option>
                <option value="ONSITE">Presencial</option>
              </select>
            </div>
            <div className="flex justify-between pt-2">
              <Button type="button" variant="ghost" onClick={() => setStep('cv')}>
                Atrás
              </Button>
              <SaveButton />
            </div>
          </form>
        </Card>
      )}
    </div>
  );
}

function Field({
  name,
  label,
  defaultValue,
  placeholder,
}: {
  name: string;
  label: string;
  defaultValue?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm text-foreground" htmlFor={name}>
        {label}
      </label>
      <input
        id={name}
        name={name}
        type="text"
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="h-11 w-full rounded-sm border border-border bg-bg px-3 text-foreground outline-none focus:border-primary"
      />
    </div>
  );
}
