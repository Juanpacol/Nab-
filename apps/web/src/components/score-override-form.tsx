'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { Badge, Button, Input, Textarea } from '@nab/ui';
import { overrideEvaluationAction, type OverrideFormState } from '@/app/actions/candidates';
import type { CandidateEvaluation } from '@/lib/candidates';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} variant="outline">
      {pending ? 'Guardando…' : 'Guardar ajuste'}
    </Button>
  );
}

export function ScoreOverrideForm({
  companyId,
  jobId,
  applicationId,
  evaluation,
}: {
  companyId: string;
  jobId: string;
  applicationId: string;
  evaluation: CandidateEvaluation;
}) {
  const action = overrideEvaluationAction.bind(null, companyId, jobId, applicationId, evaluation.id);
  const [state, formAction] = useActionState<OverrideFormState, FormData>(action, {});

  const wasOverridden = evaluation.overrideTotalScore != null;

  return (
    <div className="rounded-lg border border-border p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="font-mono text-xs uppercase tracking-wide text-muted">Ajuste de RH</p>
        {wasOverridden && <Badge variant="primary">Ajustado por RH</Badge>}
      </div>

      {evaluation.aiTotalScore != null && (
        <p className="mb-3 text-sm text-muted">
          Score de la IA:{' '}
          <span className={wasOverridden ? 'line-through' : 'font-semibold text-foreground'}>
            {evaluation.aiTotalScore}
          </span>
          {wasOverridden && <span className="ml-2 font-semibold text-foreground">→ {evaluation.overrideTotalScore}</span>}
        </p>
      )}

      <form action={formAction} className="space-y-3">
        {state.error && (
          <p className="rounded-sm bg-red-100 px-3 py-2 text-sm text-danger dark:bg-red-950/40">{state.error}</p>
        )}
        {state.ok && <p className="text-sm text-success">Ajuste guardado.</p>}
        <div>
          <label className="mb-1 block text-sm text-foreground" htmlFor="totalScore">
            Score final (0-100)
          </label>
          <Input
            id="totalScore"
            name="totalScore"
            type="number"
            min={0}
            max={100}
            defaultValue={evaluation.overrideTotalScore ?? evaluation.aiTotalScore ?? undefined}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-foreground" htmlFor="notes">
            Notas de RH
          </label>
          <Textarea
            id="notes"
            name="notes"
            rows={3}
            defaultValue={evaluation.overrideNotes ?? ''}
            placeholder="Contexto adicional, decisión final, siguientes pasos…"
          />
        </div>
        <SubmitButton />
      </form>
    </div>
  );
}
