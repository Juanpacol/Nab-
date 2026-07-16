import type { CandidateQuestion } from '@nab/shared';
import { apiFetch } from './api';
import { getAccessToken } from './session';

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
  const access = await getAccessToken();
  return apiFetch<CandidateTestView>(`/applications/${applicationId}/test`, { accessToken: access ?? undefined });
}
