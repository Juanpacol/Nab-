import { apiFetch } from './api';

export interface JobCard {
  id: string;
  title: string;
  company: string;
  companyLogoUrl: string | null;
  location: string | null;
  remote: boolean;
  salaryMin: number | null;
  salaryMax: number | null;
  currency: string | null;
  postedAt: string | null;
  score?: number;
  techTestId?: string | null;
}

export interface JobDetail extends JobCard {
  description: string;
  applyUrl: string | null;
  atsType: string | null;
}

export interface JobSearchResult {
  data: JobCard[];
  nextCursor: string | null;
}

export interface JobFilters {
  query?: string;
  location?: string;
  remote?: boolean;
  salaryMin?: number;
  semantic?: boolean;
  cursor?: string;
  limit?: number;
}

/** Busca vacantes en la API (server-side). */
export async function searchJobs(filters: JobFilters): Promise<JobSearchResult> {
  const params = new URLSearchParams();
  if (filters.query) params.set('query', filters.query);
  if (filters.location) params.set('location', filters.location);
  if (filters.remote !== undefined) params.set('remote', String(filters.remote));
  if (filters.salaryMin) params.set('salaryMin', String(filters.salaryMin));
  if (filters.semantic) params.set('semantic', 'true');
  if (filters.cursor) params.set('cursor', filters.cursor);
  if (filters.limit) params.set('limit', String(filters.limit));

  return apiFetch<JobSearchResult>(`/jobs?${params.toString()}`);
}

export async function getJob(id: string): Promise<JobDetail> {
  return apiFetch<JobDetail>(`/jobs/${id}`);
}

/** Formatea el rango salarial de una vacante. */
export function formatSalary(job: {
  salaryMin: number | null;
  salaryMax: number | null;
  currency: string | null;
}): string | null {
  if (!job.salaryMin && !job.salaryMax) return null;
  const cur = job.currency ?? 'USD';
  const fmt = (n: number) => `$${Math.round(n / 1000)}k`;
  if (job.salaryMin && job.salaryMax) return `${fmt(job.salaryMin)}–${fmt(job.salaryMax)} ${cur}`;
  return `${fmt((job.salaryMin ?? job.salaryMax)!)} ${cur}`;
}
