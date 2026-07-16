import type { Rubric, TechQuestion } from '@nab/shared';
import { apiFetch } from './api';

export type TechTestStatus = 'GENERATING' | 'READY' | 'FAILED' | 'ARCHIVED';

export interface TechTestSummary {
  id: string;
  title: string;
  version: number;
  parentId: string | null;
  status: TechTestStatus;
  generationError: string | null;
  timeLimitMinutes: number | null;
  passScore: number;
  createdAt: string;
  updatedAt: string;
}

export interface TechTestDetail extends TechTestSummary {
  companyId: string;
  createdByUserId: string;
  roleSpec: string;
  model: string | null;
  questionsJson: TechQuestion[] | null;
  rubricJson: Rubric | null;
}

export async function getTechTest(companyId: string, testId: string, accessToken: string): Promise<TechTestDetail> {
  return apiFetch<TechTestDetail>(`/companies/${companyId}/tests/${testId}`, { accessToken });
}
