import type { NormalizedJob } from '@nab/shared';
import { logger } from '../logger.js';
import type { JobAdapter } from './types.js';

interface AdzunaResult {
  id: string;
  title: string;
  company?: { display_name?: string };
  location?: { display_name?: string };
  description: string;
  salary_min?: number;
  salary_max?: number;
  redirect_url: string;
  created?: string;
}

/**
 * Adzuna API (agregador). Requiere ADZUNA_APP_ID + ADZUNA_APP_KEY.
 * Sin credenciales, el adapter se salta silenciosamente.
 */
export class AdzunaAdapter implements JobAdapter {
  readonly provider = 'ADZUNA';

  constructor(
    private readonly appId: string,
    private readonly appKey: string,
    private readonly country = 'us',
  ) {}

  async fetchJobs(): Promise<NormalizedJob[]> {
    try {
      const url = `https://api.adzuna.com/v1/api/jobs/${this.country}/search/1?app_id=${this.appId}&app_key=${this.appKey}&results_per_page=50&content-type=application/json`;
      const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
      if (!res.ok) {
        logger.warn({ status: res.status }, 'Adzuna: respuesta no OK');
        return [];
      }
      const data = (await res.json()) as { results?: AdzunaResult[] };
      return (data.results ?? []).map((r) => ({
        source: 'ADZUNA' as const,
        externalId: r.id,
        title: r.title,
        company: r.company?.display_name ?? 'Empresa',
        location: r.location?.display_name ?? null,
        remote: /remote|remoto/i.test(r.location?.display_name ?? ''),
        description: r.description,
        salaryMin: r.salary_min ? Math.round(r.salary_min) : null,
        salaryMax: r.salary_max ? Math.round(r.salary_max) : null,
        currency: 'USD',
        applyUrl: r.redirect_url,
        postedAt: r.created ? new Date(r.created) : null,
      }));
    } catch (err) {
      logger.error({ err: String(err) }, 'Adzuna: error de red');
      return [];
    }
  }
}
