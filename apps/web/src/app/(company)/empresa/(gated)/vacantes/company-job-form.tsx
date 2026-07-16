'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { Button, Input, Select, Textarea } from '@nab/ui';
import { createCompanyJobAction, updateCompanyJobAction, type CompanyJobFormState } from '@/app/actions/company-jobs';
import type { CompanyJob } from '@/lib/company-jobs';

const CURRENCIES = ['USD', 'EUR', 'MXN', 'COP', 'ARS'];

function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? pendingLabel : label}
    </Button>
  );
}

interface CompanyJobFormProps {
  mode: 'create' | 'edit';
  companyId?: string;
  job?: CompanyJob;
}

export function CompanyJobForm({ mode, companyId, job }: CompanyJobFormProps) {
  const action =
    mode === 'edit' && companyId && job
      ? updateCompanyJobAction.bind(null, companyId, job.id)
      : createCompanyJobAction;
  const [state, formAction] = useActionState<CompanyJobFormState, FormData>(action, {});

  return (
    <form action={formAction} className="space-y-4">
      {state.error && (
        <p className="rounded-sm bg-red-100 px-3 py-2 text-sm text-danger dark:bg-red-950/40">{state.error}</p>
      )}
      <div>
        <label className="mb-1 block text-sm text-foreground" htmlFor="title">
          Título del puesto
        </label>
        <Input id="title" name="title" required defaultValue={job?.title} placeholder="Ingeniero Backend Senior" />
      </div>
      <div className="flex items-center gap-2">
        <input
          id="remote"
          name="remote"
          type="checkbox"
          defaultChecked={job?.remote ?? false}
          className="h-4 w-4 rounded-sm border-border accent-primary"
        />
        <label className="text-sm text-foreground" htmlFor="remote">
          Es remota
        </label>
      </div>
      <div>
        <label className="mb-1 block text-sm text-foreground" htmlFor="location">
          Ubicación (opcional)
        </label>
        <Input id="location" name="location" defaultValue={job?.location ?? ''} placeholder="CDMX, México" />
      </div>
      <div>
        <label className="mb-1 block text-sm text-foreground" htmlFor="description">
          Descripción
        </label>
        <Textarea
          id="description"
          name="description"
          required
          rows={8}
          minLength={20}
          defaultValue={job?.description}
          placeholder="Responsabilidades, requisitos, beneficios…"
        />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="mb-1 block text-sm text-foreground" htmlFor="salaryMin">
            Salario mín.
          </label>
          <Input id="salaryMin" name="salaryMin" type="number" min={0} defaultValue={job?.salaryMin ?? ''} />
        </div>
        <div>
          <label className="mb-1 block text-sm text-foreground" htmlFor="salaryMax">
            Salario máx.
          </label>
          <Input id="salaryMax" name="salaryMax" type="number" min={0} defaultValue={job?.salaryMax ?? ''} />
        </div>
        <div>
          <label className="mb-1 block text-sm text-foreground" htmlFor="currency">
            Moneda
          </label>
          <Select id="currency" name="currency" defaultValue={job?.currency ?? 'USD'}>
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <SubmitButton
        label={mode === 'create' ? 'Publicar vacante' : 'Guardar cambios'}
        pendingLabel={mode === 'create' ? 'Publicando…' : 'Guardando…'}
      />
    </form>
  );
}
