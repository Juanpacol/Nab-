'use client';

import { useReducer } from 'react';
import type { TechTestDetail } from '@/lib/tech-tests';
import { WizardStepSpec } from './wizard-step-spec';
import { WizardStepGenerating } from './wizard-step-generating';
import { TestEditor } from './test-editor';

type WizardState =
  | { step: 'spec' }
  | { step: 'generating'; testId: string }
  | { step: 'failed'; error: string }
  | { step: 'editing'; test: TechTestDetail };

type WizardAction =
  | { type: 'GENERATION_STARTED'; testId: string }
  | { type: 'GENERATION_READY'; test: TechTestDetail }
  | { type: 'GENERATION_FAILED'; error: string }
  | { type: 'RESTART' };

function reducer(_state: WizardState, action: WizardAction): WizardState {
  switch (action.type) {
    case 'GENERATION_STARTED':
      return { step: 'generating', testId: action.testId };
    case 'GENERATION_READY':
      return { step: 'editing', test: action.test };
    case 'GENERATION_FAILED':
      return { step: 'failed', error: action.error };
    case 'RESTART':
      return { step: 'spec' };
  }
}

interface TestWizardProps {
  jobId: string;
  defaultRoleTitle: string;
  defaultSpec: string;
  initialTest: TechTestDetail | null;
}

/**
 * Máquina de estados spec → generating → editing, refresh-safe: si se llega
 * con `?edit={id}` de una prueba ya READY (ver crear/page.tsx), arranca
 * directo en 'editing' sin pasar por spec/generating.
 */
export function TestWizard({ jobId, defaultRoleTitle, defaultSpec, initialTest }: TestWizardProps) {
  const [state, dispatch] = useReducer(
    reducer,
    initialTest ? { step: 'editing', test: initialTest } : { step: 'spec' },
  );

  if (state.step === 'spec') {
    return (
      <WizardStepSpec
        defaultRoleTitle={defaultRoleTitle}
        defaultSpec={defaultSpec}
        onStarted={(testId) => dispatch({ type: 'GENERATION_STARTED', testId })}
      />
    );
  }

  if (state.step === 'generating') {
    return (
      <WizardStepGenerating
        testId={state.testId}
        onReady={(test) => dispatch({ type: 'GENERATION_READY', test })}
        onFailed={(error) => dispatch({ type: 'GENERATION_FAILED', error })}
      />
    );
  }

  if (state.step === 'failed') {
    return (
      <div className="max-w-md space-y-4">
        <p className="rounded-sm bg-red-100 px-3 py-2 text-sm text-danger dark:bg-red-950/40">{state.error}</p>
        <button
          type="button"
          className="text-sm text-primary underline"
          onClick={() => dispatch({ type: 'RESTART' })}
        >
          Intentar de nuevo
        </button>
      </div>
    );
  }

  return (
    <TestEditor
      jobId={jobId}
      test={state.test}
      onRegenerate={(testId) => dispatch({ type: 'GENERATION_STARTED', testId })}
    />
  );
}
