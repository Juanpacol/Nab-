'use client';

import { useEffect, useRef, useState } from 'react';
import { Progress } from '@nab/ui';
import { useRealtime } from '@/lib/socket';
import type { TechTestDetail } from '@/lib/tech-tests';

const STEPS = [
  'Analizando la especificación',
  'Generando preguntas',
  'Construyendo la rúbrica',
  'Verificando referencias',
];

interface WizardStepGeneratingProps {
  testId: string;
  onReady: (test: TechTestDetail) => void;
  onFailed: (error: string) => void;
}

/**
 * Señal primaria: evento realtime `test.ready`/`test.failed`. Fallback:
 * polling cada 4s contra el proxy `/api/company/tests/[id]` por si el
 * socket se desconectó — la generación tarda hasta ~90s y no queremos que
 * una desconexión deje al usuario esperando para siempre. El avance de
 * pasos es heurístico (el backend no emite progreso granular todavía);
 * nunca se muestra como si fuera la señal real de "terminó".
 */
export function WizardStepGenerating({ testId, onReady, onFailed }: WizardStepGeneratingProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const settledRef = useRef(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setStepIndex((i) => Math.min(i + 1, STEPS.length - 1));
    }, 6000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    async function checkStatus() {
      if (settledRef.current) return;
      try {
        const res = await fetch(`/api/company/tests/${testId}`);
        if (!res.ok) return;
        const test = (await res.json()) as TechTestDetail;
        if (test.status === 'READY') {
          settledRef.current = true;
          onReady(test);
        } else if (test.status === 'FAILED') {
          settledRef.current = true;
          onFailed(test.generationError ?? 'La generación falló.');
        }
      } catch {
        // silencioso — el próximo poll o el evento realtime lo resuelven
      }
    }

    const poll = setInterval(() => void checkStatus(), 4000);
    return () => clearInterval(poll);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [testId]);

  useRealtime('test.ready', (payload) => {
    const p = payload as { testId?: string };
    if (p.testId === testId && !settledRef.current) {
      fetch(`/api/company/tests/${testId}`)
        .then((res) => res.json())
        .then((test: TechTestDetail) => {
          settledRef.current = true;
          onReady(test);
        })
        .catch(() => {});
    }
  });

  useRealtime('test.failed', (payload) => {
    const p = payload as { testId?: string; error?: string };
    if (p.testId === testId && !settledRef.current) {
      settledRef.current = true;
      onFailed(p.error ?? 'La generación falló.');
    }
  });

  return (
    <div className="mx-auto max-w-md space-y-6 py-12 text-center">
      <div className="text-4xl">🤖</div>
      <div>
        <p className="font-display text-lg text-foreground">Generando tu prueba técnica…</p>
        <p className="text-sm text-muted">Puedes salir de esta pantalla — te avisaremos cuando esté lista.</p>
      </div>
      <div className="space-y-2 text-left">
        {STEPS.map((step, i) => (
          <div key={step} className="flex items-center gap-2 text-sm">
            <span className={i <= stepIndex ? 'text-primary' : 'text-muted'}>
              {i < stepIndex ? '✓' : i === stepIndex ? '◐' : '○'}
            </span>
            <span className={i <= stepIndex ? 'text-foreground' : 'text-muted'}>{step}</span>
          </div>
        ))}
      </div>
      <Progress value={((stepIndex + 1) / STEPS.length) * 100} />
    </div>
  );
}
