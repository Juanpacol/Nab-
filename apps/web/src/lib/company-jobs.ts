import { apiFetch } from './api';

export interface CompanyJob {
  id: string;
  title: string;
  company: string;
  location: string | null;
  remote: boolean;
  description: string;
  salaryMin: number | null;
  salaryMax: number | null;
  currency: string | null;
  isActive: boolean;
  techTestId: string | null;
  createdAt: string;
  updatedAt: string;
  _count: { applications: number };
}

export async function listCompanyJobs(companyId: string, accessToken: string): Promise<CompanyJob[]> {
  return apiFetch<CompanyJob[]>(`/companies/${companyId}/jobs`, { accessToken });
}

export async function getCompanyJob(companyId: string, jobId: string, accessToken: string): Promise<CompanyJob> {
  return apiFetch<CompanyJob>(`/companies/${companyId}/jobs/${jobId}`, { accessToken });
}
