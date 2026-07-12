import type { NormalizedJob } from '@nab/shared';

/** Un adapter obtiene vacantes de una fuente y las normaliza al modelo Job. */
export interface JobAdapter {
  readonly provider: string;
  /** Devuelve las vacantes normalizadas. Nunca lanza: ante error, log + []. */
  fetchJobs(): Promise<NormalizedJob[]>;
}
