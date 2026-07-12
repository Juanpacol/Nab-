/**
 * Tipos y utilidades del dominio de vacantes, compartidos entre los adapters
 * de ingesta (workers) y la API/UI.
 */

export type JobProvider = 'GREENHOUSE' | 'LEVER' | 'ADZUNA' | 'JSEARCH' | 'MOCK';

/** Forma normalizada a la que todos los adapters convierten sus vacantes. */
export interface NormalizedJob {
  source: JobProvider;
  externalId: string;
  title: string;
  company: string;
  companyLogoUrl?: string | null;
  location?: string | null;
  remote: boolean;
  description: string;
  salaryMin?: number | null;
  salaryMax?: number | null;
  currency?: string | null;
  atsType?: string | null;
  applyUrl: string;
  postedAt?: Date | null;
}

/** Texto canónico de una vacante para generar su embedding. */
export function jobEmbeddingText(job: {
  title: string;
  company: string;
  location?: string | null;
  description: string;
}): string {
  return [job.title, job.company, job.location ?? '', job.description]
    .filter(Boolean)
    .join('. ')
    .slice(0, 8000);
}
