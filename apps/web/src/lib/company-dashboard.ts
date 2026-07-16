import { apiFetch } from './api';

export interface CompanyMetrics {
  activeJobs: number;
  totalJobs: number;
  totalApplicants: number;
  evaluatedCount: number;
  passRate: number | null;
}

export interface JobMetrics {
  jobId: string;
  totalApplicants: number;
  byStatus: Record<string, number>;
  testFunnel: Record<string, number>;
  evaluatedCount: number;
  passRate: number | null;
}

export interface ApplicantsTrendPoint {
  date: string;
  count: number;
}

export interface ApplicantsTrend {
  jobId: string;
  points: ApplicantsTrendPoint[];
}

export interface ScoreDistributionBin {
  binStart: number;
  count: number;
}

export interface ScoreDistribution {
  jobId: string;
  passScore: number | null;
  bins: ScoreDistributionBin[];
}

export async function getCompanyMetrics(companyId: string, accessToken: string): Promise<CompanyMetrics> {
  return apiFetch<CompanyMetrics>(`/companies/${companyId}/metrics`, { accessToken });
}

export async function getJobMetrics(companyId: string, jobId: string, accessToken: string): Promise<JobMetrics> {
  return apiFetch<JobMetrics>(`/companies/${companyId}/jobs/${jobId}/metrics`, { accessToken });
}

export async function getApplicantsTrend(
  companyId: string,
  jobId: string,
  accessToken: string,
): Promise<ApplicantsTrend> {
  return apiFetch<ApplicantsTrend>(`/companies/${companyId}/jobs/${jobId}/applicants-trend`, { accessToken });
}

export async function getScoreDistribution(
  companyId: string,
  jobId: string,
  accessToken: string,
): Promise<ScoreDistribution> {
  return apiFetch<ScoreDistribution>(`/companies/${companyId}/jobs/${jobId}/score-distribution`, { accessToken });
}
