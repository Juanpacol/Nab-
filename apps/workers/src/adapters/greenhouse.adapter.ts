import type { NormalizedJob } from '@nab/shared';
import { logger } from '../logger.js';
import type { JobAdapter } from './types.js';

interface GhJob {
  id: number;
  title: string;
  updated_at: string;
  location?: { name?: string };
  content?: string;
  absolute_url: string;
}

/**
 * Greenhouse Job Board API (pública y gratuita por empresa).
 * https://boards-api.greenhouse.io/v1/boards/{board}/jobs?content=true
 */
export class GreenhouseAdapter implements JobAdapter {
  readonly provider = 'GREENHOUSE';

  constructor(private readonly boards: string[]) {}

  async fetchJobs(): Promise<NormalizedJob[]> {
    const all: NormalizedJob[] = [];
    for (const board of this.boards) {
      try {
        const res = await fetch(
          `https://boards-api.greenhouse.io/v1/boards/${board}/jobs?content=true`,
        );
        if (!res.ok) {
          logger.warn({ board, status: res.status }, 'Greenhouse: respuesta no OK');
          continue;
        }
        const data = (await res.json()) as { jobs?: GhJob[] };
        for (const j of data.jobs ?? []) {
          const location = j.location?.name ?? null;
          all.push({
            source: 'GREENHOUSE',
            externalId: String(j.id),
            title: j.title,
            company: board,
            location,
            remote: /remote|remoto/i.test(location ?? ''),
            description: stripHtml(j.content ?? ''),
            atsType: 'greenhouse',
            applyUrl: j.absolute_url,
            postedAt: j.updated_at ? new Date(j.updated_at) : null,
            currency: 'USD',
          });
        }
        logger.info({ board, count: data.jobs?.length ?? 0 }, 'Greenhouse: vacantes obtenidas');
      } catch (err) {
        logger.error({ board, err: String(err) }, 'Greenhouse: error de red');
      }
    }
    return all;
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
