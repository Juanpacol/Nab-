import type { CriterionEvaluation } from './candidates';
import { apiFetch } from './api';

export interface ComparisonCandidate {
  id: string;
  user: { id: string; name: string; email: string; avatarUrl: string | null };
  testSubmission: {
    status: string;
    evaluation: {
      aiScoresJson: CriterionEvaluation[] | null;
      aiSummary: string | null;
      finalScore: number | null;
      passed: boolean | null;
      overriddenAt: string | null;
    } | null;
  } | null;
}

export interface DataComparison {
  jobId: string;
  candidates: ComparisonCandidate[];
}

export interface ComparisonScoreEntry {
  candidateRef: 'A' | 'B' | 'C' | 'D';
  score: number;
}

export interface ComparisonCriterionResult {
  criterionId: string;
  scores: ComparisonScoreEntry[];
  tied: boolean;
  analysis: string;
}

export interface AiComparison {
  byCriterion: ComparisonCriterionResult[];
  tradeoffs: string[];
  caveats: string[];
  candidateLegend: { candidateRef: 'A' | 'B' | 'C' | 'D'; applicationId: string }[];
}

function idsQuery(applicationIds: string[]): string {
  return `?applicationIds=${applicationIds.map(encodeURIComponent).join(',')}`;
}

export async function getDataComparison(
  companyId: string,
  jobId: string,
  applicationIds: string[],
  accessToken: string,
): Promise<DataComparison> {
  return apiFetch<DataComparison>(`/companies/${companyId}/jobs/${jobId}/compare${idsQuery(applicationIds)}`, {
    accessToken,
  });
}

export async function generateAiComparison(
  companyId: string,
  jobId: string,
  applicationIds: string[],
  idempotencyKey: string,
  accessToken: string,
): Promise<AiComparison> {
  return apiFetch<AiComparison>(`/companies/${companyId}/jobs/${jobId}/compare/analyze${idsQuery(applicationIds)}`, {
    method: 'POST',
    accessToken,
    body: JSON.stringify({ idempotencyKey }),
  });
}
