'use client';

import { useActionState, useEffect } from 'react';
import { useFormStatus } from 'react-dom';
import { Button, Input, Select, Textarea } from '@nab/ui';
import { createTechTestAction, type TestGenerationState } from '@/app/actions/tech-tests';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Iniciando…' : 'Generar prueba con IA'}
    </Button>
  );
}

export function WizardStepSpec({
  defaultRoleTitle,
  defaultSpec,
  onStarted,
}: {
  defaultRoleTitle: string;
  defaultSpec: string;
  onStarted: (testId: string) => void;
}) {
  const [state, action] = useActionState<TestGenerationState, FormData>(createTechTestAction, {});

  useEffect(() => {
    if (state.testId) onStarted(state.testId);
  }, [state.testId, onStarted]);

  return (
    <form action={action} className="max-w-2xl space-y-4">
      {state.error && (
        <p className="rounded-sm bg-red-100 px-3 py-2 text-sm text-danger dark:bg-red-950/40">{state.error}</p>
      )}
      <div>
        <label className="mb-1 block text-sm text-foreground" htmlFor="roleTitle">
          Título del rol
        </label>
        <Input id="roleTitle" name="roleTitle" required defaultValue={defaultRoleTitle} />
      </div>
      <div>
        <label className="mb-1 block text-sm text-foreground" htmlFor="spec">
          Especificación del rol
        </label>
        <Textarea
          id="spec"
          name="spec"
          required
          minLength={30}
          rows={10}
          defaultValue={defaultSpec}
          placeholder="Describe responsabilidades, tecnologías y seniority esperado…"
        />
        <p className="mt-1 text-xs text-muted">
          La IA cita frases textuales de aquí en la rúbrica — mientras más específico, mejores referencias.
        </p>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="mb-1 block text-sm text-foreground" htmlFor="seniority">
            Seniority
          </label>
          <Select id="seniority" name="seniority" defaultValue="">
            <option value="">Automático</option>
            <option value="junior">Junior</option>
            <option value="mid">Mid</option>
            <option value="senior">Senior</option>
            <option value="lead">Lead</option>
          </Select>
        </div>
        <div>
          <label className="mb-1 block text-sm text-foreground" htmlFor="targetDurationMinutes">
            Duración (min)
          </label>
          <Input id="targetDurationMinutes" name="targetDurationMinutes" type="number" min={15} max={240} placeholder="60" />
        </div>
        <div>
          <label className="mb-1 block text-sm text-foreground" htmlFor="keySkills">
            Skills clave
          </label>
          <Input id="keySkills" name="keySkills" placeholder="Node.js, PostgreSQL" />
        </div>
      </div>
      <SubmitButton />
    </form>
  );
}
