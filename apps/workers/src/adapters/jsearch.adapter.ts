import type { NormalizedJob } from '@nab/shared';
import { logger } from '../logger.js';
import type { JobAdapter } from './types.js';

interface JSearchJob {
  job_id: string;
  job_title: string;
  employer_name?: string;
  employer_logo?: string;
  job_city?: string;
  job_country?: string;
  job_is_remote?: boolean;
  job_description: string;
  job_min_salary?: number;
  job_max_salary?: number;
  job_apply_link: string;
  job_posted_at_datetime_utc?: string;
}

/**
 * JSearch (RapidAPI / OpenWeb Ninja) — Google for Jobs. Requiere JSEARCH_RAPIDAPI_KEY.
 * Sin clave, el adapter se salta silenciosamente.
 */
export class JSearchAdapter implements JobAdapter {
  readonly provider = 'JSEARCH';

  constructor(
    private readonly apiKey: string,
    private readonly query = 'software engineer',
  ) {}

  async fetchJobs(): Promise<NormalizedJob[]> {
    try {
      const url = `https://jsearch.p.rapidapi.com/search?query=${encodeURIComponent(this.query)}&page=1&num_pages=1`;
      const res = await fetch(url, {
        headers: {
          'X-RapidAPI-Key': this.apiKey,
          'X-RapidAPI-Host': 'jsearch.p.rapidapi.com',
        },
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) {
        logger.warn({ status: res.status }, 'JSearch: respuesta no OK');
        return [];
      }
      const data = (await res.json()) as { data?: JSearchJob[] };
      return (data.data ?? []).map((j) => ({
        source: 'JSEARCH' as const,
        externalId: j.job_id,
        title: j.job_title,
        company: j.employer_name ?? 'Empresa',
        companyLogoUrl: j.employer_logo ?? null,
        location: [j.job_city, j.job_country].filter(Boolean).join(', ') || null,
        remote: Boolean(j.job_is_remote),
        description: j.job_description,
        salaryMin: j.job_min_salary ?? null,
        salaryMax: j.job_max_salary ?? null,
        currency: 'USD',
        applyUrl: j.job_apply_link,
        postedAt: j.job_posted_at_datetime_utc ? new Date(j.job_posted_at_datetime_utc) : null,
      }));
    } catch (err) {
      logger.error({ err: String(err) }, 'JSearch: error de red');
      return [];
    }
  }
}
