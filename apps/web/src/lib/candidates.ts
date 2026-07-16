import type { CriterionEvaluation, RubricCriterion, TechQuestion } from '@nab/shared';
import { apiFetch } from './api';

export type { CriterionEvaluation, RubricCriterion, TechQuestion };

export interface Applicant {
  id: string;
  status: string;
  matchScore: number | null;
  submittedAt: string | null;
  createdAt: string;
  user: { id: string; name: string; email: string; avatarUrl: string | null };
  testSubmission: {
    id: string;
    status: string;
    evaluation: { finalScore: number | null; passed: boolean | null } | null;
  } | null;
}

export interface CandidateEvaluation {
  id: string;
  aiScoresJson: CriterionEvaluation[] | null;
  aiSummary: string | null;
  aiStrengths: string[] | null;
  aiWeaknesses: string[] | null;
  aiHighlights: string[] | null;
  aiTotalScore: number | null;
  aiModel: string | null;
  evaluatedAt: string | null;
  injectionSuspected: boolean;
  overrideScoresJson: { criterionId: string; score: number; note?: string }[] | null;
  overrideTotalScore: number | null;
  overrideNotes: string | null;
  overriddenByUserId: string | null;
  overriddenAt: string | null;
  finalScore: number | null;
  passed: boolean | null;
}

export interface SubmissionDetail {
  id: string;
  status: string;
  answersJson: { questionId: string; answer: string }[] | null;
  startedAt: string;
  submittedAt: string | null;
  timeSpentSeconds: number | null;
  user: { id: string; name: string; email: string; avatarUrl: string | null };
  techTest: { id: string; title: string; questionsJson: TechQuestion[]; rubricJson: { criteria: RubricCriterion[]; passThreshold: number } };
  evaluation: CandidateEvaluation | null;
}

export async function listApplicants(
  companyId: string,
  jobId: string,
  accessToken: string,
  status?: string,
): Promise<Applicant[]> {
  const qs = status ? `?status=${encodeURIComponent(status)}` : '';
  return apiFetch<Applicant[]>(`/companies/${companyId}/jobs/${jobId}/applicants${qs}`, { accessToken });
}

export async function getSubmissionDetail(
  companyId: string,
  submissionId: string,
  accessToken: string,
): Promise<SubmissionDetail> {
  return apiFetch<SubmissionDetail>(`/companies/${companyId}/submissions/${submissionId}`, { accessToken });
}
