import { GreenhouseAdapter } from './greenhouse.adapter.js';
import { LeverAdapter } from './lever.adapter.js';
import { AdzunaAdapter } from './adzuna.adapter.js';
import { JSearchAdapter } from './jsearch.adapter.js';
import { MockAdapter } from './mock.adapter.js';
import type { JobAdapter } from './types.js';

function list(env: string | undefined): string[] {
  return (env ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Construye los adapters según la configuración de entorno. Si no hay ninguna
 * fuente real configurada, usa el adapter mock (ideal para desarrollo local).
 */
export function buildAdapters(): JobAdapter[] {
  const adapters: JobAdapter[] = [];

  const ghBoards = list(process.env.GREENHOUSE_BOARDS);
  if (ghBoards.length) adapters.push(new GreenhouseAdapter(ghBoards));

  const leverCompanies = list(process.env.LEVER_BOARDS);
  if (leverCompanies.length) adapters.push(new LeverAdapter(leverCompanies));

  if (process.env.ADZUNA_APP_ID && process.env.ADZUNA_APP_KEY) {
    adapters.push(new AdzunaAdapter(process.env.ADZUNA_APP_ID, process.env.ADZUNA_APP_KEY));
  }

  if (process.env.JSEARCH_RAPIDAPI_KEY) {
    adapters.push(new JSearchAdapter(process.env.JSEARCH_RAPIDAPI_KEY));
  }

  if (adapters.length === 0) adapters.push(new MockAdapter());

  return adapters;
}

export type { JobAdapter };
