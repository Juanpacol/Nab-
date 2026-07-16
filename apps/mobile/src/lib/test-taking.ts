import type { CandidateQuestion } from '@nab/shared';
import { apiFetch } from './api';

export interface CandidateSubmissionState {
  status: 'IN_PROGRESS' | 'SUBMITTED' | 'EVALUATING' | 'EVALUATED' | 'EVALUATION_FAILED';
  answersJson: { questionId: string; answer: string }[] | null;
  startedAt: string;
  submittedAt: string | null;
}

export interface CandidateTestView {
  techTestId: string;
  title: string;
  timeLimitMinutes: number | null;
  questions: CandidateQuestion[];
  submission: CandidateSubmissionState | null;
}

export async function getApplicationTest(applicationId: string): Promise<CandidateTestView> {
  return apiFetch<CandidateTestView>(`/applications/${applicationId}/test`);
}

/** Idempotente — se llama al montar el runner, no reinicia el cronómetro si ya había empezado. */
export async function startTest(applicationId: string): Promise<void> {
  await apiFetch(`/applications/${applicationId}/test/start`, { method: 'POST' });
}

/** Autosave — se llama con debounce desde el runner. */
export async function saveTestAnswers(
  applicationId: string,
  answers: { questionId: string; answer: string }[],
): Promise<void> {
  await apiFetch(`/applications/${applicationId}/test/answers`, {
    method: 'PUT',
    body: JSON.stringify({ answers }),
  });
}

export async function submitTest(applicationId: string): Promise<{ id: string; status: string }> {
  return apiFetch<{ id: string; status: string }>(`/applications/${applicationId}/test/submit`, { method: 'POST' });
}
