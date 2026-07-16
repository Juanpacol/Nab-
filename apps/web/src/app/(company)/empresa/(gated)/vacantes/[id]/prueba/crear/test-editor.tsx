'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@nab/ui';
import type { TechQuestion } from '@nab/shared';
import { attachTechTestAction, regenerateTechTestAction, updateTechTestAction } from '@/app/actions/tech-tests';
import type { TechTestDetail } from '@/lib/tech-tests';
import { QuestionEditorCard } from './question-editor-card';
import { RubricPanel } from './rubric-panel';

interface TestEditorProps {
  jobId: string;
  test: TechTestDetail;
  onRegenerate: (testId: string) => void;
}

/** Layout de dos paneles: preguntas editables a la izquierda, rúbrica (solo lectura) sticky a la derecha. */
export function TestEditor({ jobId, test, onRegenerate }: TestEditorProps) {
  const router = useRouter();
  const [questions, setQuestions] = useState<TechQuestion[]>(test.questionsJson ?? []);
  const [saving, startSaving] = useTransition();
  const [attaching, startAttaching] = useTransition();
  const [regenerating, startRegenerating] = useTransition();
  const [message, setMessage] = useState<{ type: 'error' | 'ok'; text: string } | null>(null);

  function updateQuestion(index: number, updated: TechQuestion) {
    setQuestions((qs) => qs.map((q, i) => (i === index ? updated : q)));
  }

  function save() {
    setMessage(null);
    startSaving(async () => {
      const result = await updateTechTestAction(test.id, { questions });
      setMessage(
        result.error ? { type: 'error', text: result.error } : { type: 'ok', text: 'Cambios guardados.' },
      );
    });
  }

  function attach() {
    setMessage(null);
    startAttaching(async () => {
      const result = await attachTechTestAction(jobId, test.id);
      if (result?.error) setMessage({ type: 'error', text: result.error });
      // Sin error: attachTechTestAction ya hizo redirect(), no queda nada más por hacer aquí.
    });
  }

  function regenerate() {
    setMessage(null);
    startRegenerating(async () => {
      const result = await regenerateTechTestAction(test.id);
      if (result.error) {
        setMessage({ type: 'error', text: result.error });
        return;
      }
      if (result.testId) onRegenerate(result.testId);
    });
  }

  return (
    <div className="space-y-4">
      {message && (
        <p
          className={
            message.type === 'error'
              ? 'rounded-sm bg-red-100 px-3 py-2 text-sm text-danger dark:bg-red-950/40'
              : 'rounded-sm bg-primary-soft px-3 py-2 text-sm text-primary'
          }
        >
          {message.text}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button onClick={save} disabled={saving}>
          {saving ? 'Guardando…' : 'Guardar cambios'}
        </Button>
        <Button variant="outline" onClick={regenerate} disabled={regenerating}>
          {regenerating ? 'Regenerando…' : 'Regenerar con IA (nueva versión)'}
        </Button>
        <Button variant="secondary" onClick={attach} disabled={attaching}>
          {attaching ? 'Adjuntando…' : 'Adjuntar a esta vacante'}
        </Button>
        <Button variant="ghost" onClick={() => router.push(`/empresa/vacantes/${jobId}`)}>
          Cancelar
        </Button>
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
        <div className="space-y-4">
          {questions.map((q, i) => (
            <QuestionEditorCard key={q.id} question={q} index={i} onChange={(updated) => updateQuestion(i, updated)} />
          ))}
        </div>
        <div className="lg:sticky lg:top-20 lg:self-start">
          {test.rubricJson && <RubricPanel rubric={test.rubricJson} />}
        </div>
      </div>
    </div>
  );
}
