import { apiFetch } from './api';
import { getAccessToken } from './session';

export interface JobSummary {
  id: string;
  title: string;
  company: string;
  companyLogoUrl: string | null;
  location: string | null;
  applyUrl: string;
}

export interface ApplicationCard {
  id: string;
  status: string;
  matchScore: number | null;
  submittedAt: string | null;
  updatedAt: string;
  job: JobSummary;
}

export interface ApplicationEvent {
  id: string;
  eventType: string;
  payload: unknown;
  createdAt: string;
}

export interface ApplicationDetail extends ApplicationCard {
  method: string;
  notes: string | null;
  createdAt: string;
  resume: { id: string; title: string; atsScore: number | null } | null;
  coverLetter: { id: string; tone: string } | null;
  events: ApplicationEvent[];
}

export interface Metrics {
  byStatus: Record<string, number>;
  appliedThisWeek: number;
  applied: number;
  responseRate: number;
  activity: Record<string, number>;
}

/** Lista de aplicaciones del usuario (server-side, kanban). */
export async function listApplications(): Promise<ApplicationCard[]> {
  const access = await getAccessToken();
  return apiFetch<ApplicationCard[]>('/applications', { accessToken: access ?? undefined });
}

export async function getApplicationMetrics(): Promise<Metrics> {
  const access = await getAccessToken();
  return apiFetch<Metrics>('/applications/metrics', { accessToken: access ?? undefined });
}

export async function getApplication(id: string): Promise<ApplicationDetail> {
  const access = await getAccessToken();
  return apiFetch<ApplicationDetail>(`/applications/${id}`, { accessToken: access ?? undefined });
}
