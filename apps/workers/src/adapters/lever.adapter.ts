import type { NormalizedJob } from '@nab/shared';
import { logger } from '../logger.js';
import type { JobAdapter } from './types.js';

interface LeverPosting {
  id: string;
  text: string;
  createdAt?: number;
  categories?: { location?: string; commitment?: string };
  descriptionPlain?: string;
  hostedUrl: string;
  workplaceType?: string;
}

/**
 * Lever Postings API (pública y gratuita por empresa).
 * https://api.lever.co/v0/postings/{company}?mode=json
 */
export class LeverAdapter implements JobAdapter {
  readonly provider = 'LEVER';

  constructor(private readonly companies: string[]) {}

  async fetchJobs(): Promise<NormalizedJob[]> {
    const all: NormalizedJob[] = [];
    for (const company of this.companies) {
      try {
        const res = await fetch(`https://api.lever.co/v0/postings/${company}?mode=json`);
        if (!res.ok) {
          logger.warn({ company, status: res.status }, 'Lever: respuesta no OK');
          continue;
        }
        const postings = (await res.json()) as LeverPosting[];
        for (const p of postings) {
          const location = p.categories?.location ?? null;
          all.push({
            source: 'LEVER',
            externalId: p.id,
            title: p.text,
            company,
            location,
            remote:
              p.workplaceType === 'remote' || /remote|remoto/i.test(location ?? ''),
            description: p.descriptionPlain ?? '',
            atsType: 'lever',
            applyUrl: p.hostedUrl,
            postedAt: p.createdAt ? new Date(p.createdAt) : null,
            currency: 'USD',
          });
        }
        logger.info({ company, count: postings.length }, 'Lever: vacantes obtenidas');
      } catch (err) {
        logger.error({ company, err: String(err) }, 'Lever: error de red');
      }
    }
    return all;
  }
}
