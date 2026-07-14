import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AdzunaAdapter } from './adzuna.adapter.js';
import { GreenhouseAdapter } from './greenhouse.adapter.js';
import { LeverAdapter } from './lever.adapter.js';
import { JSearchAdapter } from './jsearch.adapter.js';

/**
 * Los 4 adapters comparten un contrato clave: "nunca lanzan" (ver
 * JobAdapter.fetchJobs en types.ts) — un proveedor caído no debe tumbar la
 * ingesta de los demás. Estos tests verifican ese contrato con `fetch`
 * mockeado, sin llamadas de red reales.
 */
describe('Adapters de ingesta', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('AdzunaAdapter', () => {
    it('normaliza los resultados y pasa un timeout explícito', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [
            {
              id: '1',
              title: 'Backend Engineer',
              company: { display_name: 'Acme' },
              location: { display_name: 'Remoto' },
              description: 'desc',
              redirect_url: 'https://acme.example/1',
              created: '2026-01-01T00:00:00Z',
            },
          ],
        }),
      });

      const jobs = await new AdzunaAdapter('app-id', 'app-key').fetchJobs();

      expect(jobs).toEqual([
        expect.objectContaining({ source: 'ADZUNA', externalId: '1', title: 'Backend Engineer', company: 'Acme' }),
      ]);
      const [, opts] = fetchMock.mock.calls[0]!;
      expect(opts.signal).toBeInstanceOf(AbortSignal);
    });

    it('devuelve [] (no lanza) si la respuesta no es OK', async () => {
      fetchMock.mockResolvedValueOnce({ ok: false, status: 500 });
      await expect(new AdzunaAdapter('id', 'key').fetchJobs()).resolves.toEqual([]);
    });

    it('devuelve [] (no lanza) si fetch rechaza (timeout/red)', async () => {
      fetchMock.mockRejectedValueOnce(new Error('timeout'));
      await expect(new AdzunaAdapter('id', 'key').fetchJobs()).resolves.toEqual([]);
    });
  });

  describe('GreenhouseAdapter', () => {
    it('recorre todos los boards configurados y sigue si uno falla', async () => {
      fetchMock
        .mockRejectedValueOnce(new Error('board caído'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            jobs: [
              {
                id: 42,
                title: 'Data Analyst',
                updated_at: '2026-01-01T00:00:00Z',
                location: { name: 'Remoto' },
                content: '<p>Hola <b>mundo</b></p>',
                absolute_url: 'https://boards.greenhouse.io/acme/42',
              },
            ],
          }),
        });

      const jobs = await new GreenhouseAdapter(['board-roto', 'board-ok']).fetchJobs();

      expect(jobs).toHaveLength(1);
      expect(jobs[0]).toMatchObject({ source: 'GREENHOUSE', externalId: '42', description: 'Hola mundo' });
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
  });

  describe('LeverAdapter', () => {
    it('normaliza postings y detecta remoto por workplaceType', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => [
          {
            id: 'p1',
            text: 'Ingeniero de Producto',
            categories: { location: 'CDMX' },
            descriptionPlain: 'desc',
            hostedUrl: 'https://jobs.lever.co/acme/p1',
            workplaceType: 'remote',
          },
        ],
      });

      const jobs = await new LeverAdapter(['acme']).fetchJobs();

      expect(jobs).toEqual([expect.objectContaining({ source: 'LEVER', externalId: 'p1', remote: true })]);
    });
  });

  describe('JSearchAdapter', () => {
    it('envía la API key en los headers y normaliza el resultado', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            {
              job_id: 'j1',
              job_title: 'QA Engineer',
              employer_name: 'Acme',
              job_city: 'Bogotá',
              job_country: 'CO',
              job_is_remote: false,
              job_description: 'desc',
              job_apply_link: 'https://acme.example/qa',
            },
          ],
        }),
      });

      const jobs = await new JSearchAdapter('rapidapi-key').fetchJobs();

      expect(jobs).toEqual([expect.objectContaining({ source: 'JSEARCH', externalId: 'j1', company: 'Acme' })]);
      const [, opts] = fetchMock.mock.calls[0]!;
      expect(opts.headers['X-RapidAPI-Key']).toBe('rapidapi-key');
    });
  });
});
