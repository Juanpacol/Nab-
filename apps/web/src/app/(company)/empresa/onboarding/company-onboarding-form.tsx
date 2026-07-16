'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Textarea } from '@nab/ui';
import { createCompanyAction, type CompanyFormState } from '@/app/actions/company';

const COMBINING_DIACRITICS = /[̀-ͯ]/g;

function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(COMBINING_DIACRITICS, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? 'Creando…' : 'Crear empresa'}
    </Button>
  );
}

export function CompanyOnboardingForm() {
  const [state, action] = useActionState<CompanyFormState, FormData>(createCompanyAction, {});
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Crea tu empresa en Nab</CardTitle>
        <CardDescription>
          Publica vacantes, genera pruebas técnicas con IA y da seguimiento a tus candidatos.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-4">
          {state.error && (
            <p className="rounded-sm bg-red-100 px-3 py-2 text-sm text-danger dark:bg-red-950/40">
              {state.error}
            </p>
          )}
          <div>
            <label className="mb-1 block text-sm text-foreground" htmlFor="name">
              Nombre de la empresa
            </label>
            <Input
              id="name"
              name="name"
              required
              value={name}
              onChange={(e) => {
                const value = e.target.value;
                setName(value);
                if (!slugTouched) setSlug(slugify(value));
              }}
              placeholder="Acme Inc."
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-foreground" htmlFor="slug">
              Identificador único
            </label>
            <Input
              id="slug"
              name="slug"
              required
              value={slug}
              onChange={(e) => {
                setSlugTouched(true);
                setSlug(slugify(e.target.value));
              }}
              placeholder="acme"
            />
            <p className="mt-1 text-xs text-muted">Solo minúsculas, números y guiones.</p>
          </div>
          <div>
            <label className="mb-1 block text-sm text-foreground" htmlFor="website">
              Sitio web (opcional)
            </label>
            <Input id="website" name="website" type="url" placeholder="https://acme.com" />
          </div>
          <div>
            <label className="mb-1 block text-sm text-foreground" htmlFor="description">
              Descripción (opcional)
            </label>
            <Textarea id="description" name="description" rows={3} placeholder="A qué se dedica la empresa…" />
          </div>
          <SubmitButton />
        </form>
      </CardContent>
    </Card>
  );
}
