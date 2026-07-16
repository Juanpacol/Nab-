'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Progress } from '@nab/ui';
import { saveTestAnswersAction, startTestAction, submitTestAction } from '@/app/actions/test-taking';
import type { CandidateTestView } from '@/lib/test-taking';
import { TestTimer } from './test-timer';
import { QuestionRenderer } from './question-renderer';

interface TestRunnerProps {
  applicationId: string;
  test: CandidateTestView;
}

function loadLocalAnswers(storageKey: string): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(storageKey);
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

/**
 * Una pregunta por pantalla + autosave con debounce + espejo en
 * localStorage (recuperación ante crash) + cronómetro server-truth +
 * confirmación antes de enviar. `startTestAction` es idempotente: llamarlo
 * de nuevo al re-montar (recarga de página) no reinicia el cronómetro.
 */
export function TestRunner({ applicationId, test }: TestRunnerProps) {
  const router = useRouter();
  const storageKey = `nab_test_${test.techTestId}`;

  const [startedAt] = useState(() => test.submission?.startedAt ?? new Date().toISOString());
  const [answers, setAnswers] = useState<Record<string, string>>(() => {
    const fromServer = Object.fromEntries(
      (test.submission?.answersJson ?? []).map((a) => [a.questionId, a.answer]),
    );
    return Object.keys(fromServer).length > 0 ? fromServer : loadLocalAnswers(storageKey);
  });
  const [index, setIndex] = useState(0);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const startedOnce = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (startedOnce.current) return;
    startedOnce.current = true;
    void startTestAction(applicationId);
  }, [applicationId]);

  const scheduleSave = useCallback(
    (next: Record<string, string>) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        const payload = Object.entries(next).map(([questionId, answer]) => ({ questionId, answer }));
        void saveTestAnswersAction(applicationId, payload);
      }, 2500);
    },
    [applicationId],
  );

  function setAnswer(questionId: string, value: string) {
    setAnswers((prev) => {
      const next = { ...prev, [questionId]: value };
      if (typeof window !== 'undefined') window.localStorage.setItem(storageKey, JSON.stringify(next));
      scheduleSave(next);
      return next;
    });
  }

  useEffect(
    () => () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    },
    [],
  );

  const question = test.questions[index];
  const answeredCount = test.questions.filter((q) => (answers[q.id] ?? '').trim().length > 0).length;
  const unanswered = test.questions.filter((q) => !(answers[q.id] ?? '').trim().length);

  async function doSubmit() {
    setSubmitting(true);
    setError(null);
    const result = await submitTestAction(applicationId);
    if (result.error) {
      setError(result.error);
      setSubmitting(false);
      return;
    }
    if (typeof window !== 'undefined') window.localStorage.removeItem(storageKey);
    router.push(`/applications/${applicationId}`);
  }

  function handleTimeUp() {
    setConfirmOpen(false);
    if (!submitting) void doSubmit();
  }

  if (!question) return null;

  return (
    <div className="space-y-6 py-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-xl text-foreground">{test.title}</h1>
          <p className="text-sm text-muted">
            Pregunta {index + 1} de {test.questions.length}
          </p>
        </div>
        {test.timeLimitMinutes && (
          <TestTimer startedAt={startedAt} timeLimitMinutes={test.timeLimitMinutes} onExpire={handleTimeUp} />
        )}
      </div>

      <Progress value={(answeredCount / test.questions.length) * 100} />

      <div className="flex flex-wrap justify-center gap-1.5">
        {test.questions.map((q, i) => (
          <button
            key={q.id}
            type="button"
            onClick={() => setIndex(i)}
            aria-label={`Ir a la pregunta ${i + 1}`}
            className={`h-2.5 w-2.5 rounded-full transition-colors ${
              i === index ? 'bg-primary' : (answers[q.id] ?? '').trim() ? 'bg-primary/40' : 'bg-surface-2'
            }`}
          />
        ))}
      </div>

      <QuestionRenderer
        question={question}
        value={answers[question.id] ?? ''}
        onChange={(v) => setAnswer(question.id, v)}
      />

      {error && (
        <p className="rounded-sm bg-red-100 px-3 py-2 text-sm text-danger dark:bg-red-950/40">{error}</p>
      )}

      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={() => setIndex((i) => Math.max(0, i - 1))} disabled={index === 0}>
          ← Anterior
        </Button>
        {index < test.questions.length - 1 ? (
          <Button onClick={() => setIndex((i) => Math.min(test.questions.length - 1, i + 1))}>Siguiente →</Button>
        ) : (
          <Button onClick={() => setConfirmOpen(true)}>Finalizar prueba</Button>
        )}
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Enviar la prueba?</DialogTitle>
          </DialogHeader>
          {unanswered.length > 0 ? (
            <p className="text-sm text-muted">
              Tienes {unanswered.length} pregunta{unanswered.length > 1 ? 's' : ''} sin responder. Una vez
              enviada, no podrás editar tus respuestas.
            </p>
          ) : (
            <p className="text-sm text-muted">Una vez enviada, no podrás editar tus respuestas.</p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Seguir respondiendo
            </Button>
            <Button onClick={doSubmit} disabled={submitting}>
              {submitting ? 'Enviando…' : 'Enviar prueba'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
