'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { Button, Input, Textarea } from '@nab/ui';
import { updateCompanyAction, type CompanyFormState } from '@/app/actions/company';
import type { Company } from '@/lib/companies';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Guardando…' : 'Guardar cambios'}
    </Button>
  );
}

export function CompanySettingsForm({ company, canEdit }: { company: Company; canEdit: boolean }) {
  const boundAction = updateCompanyAction.bind(null, company.id);
  const [state, action] = useActionState<CompanyFormState, FormData>(boundAction, {});

  return (
    <form action={action} className="space-y-4">
      {state.error && (
        <p className="rounded-sm bg-red-100 px-3 py-2 text-sm text-danger dark:bg-red-950/40">{state.error}</p>
      )}
      {state.ok && (
        <p className="rounded-sm bg-primary-soft px-3 py-2 text-sm text-primary">Cambios guardados.</p>
      )}
      {!canEdit && (
        <p className="rounded-sm bg-surface-2 px-3 py-2 text-sm text-muted">
          Solo el dueño de la empresa puede editar estos datos.
        </p>
      )}
      <div>
        <label className="mb-1 block text-sm text-foreground" htmlFor="name">
          Nombre
        </label>
        <Input id="name" name="name" defaultValue={company.name} disabled={!canEdit} required />
      </div>
      <div>
        <label className="mb-1 block text-sm text-foreground" htmlFor="website">
          Sitio web
        </label>
        <Input id="website" name="website" type="url" defaultValue={company.website ?? ''} disabled={!canEdit} />
      </div>
      <div>
        <label className="mb-1 block text-sm text-foreground" htmlFor="description">
          Descripción
        </label>
        <Textarea
          id="description"
          name="description"
          rows={4}
          defaultValue={company.description ?? ''}
          disabled={!canEdit}
        />
      </div>
      {canEdit && <SubmitButton />}
    </form>
  );
}
