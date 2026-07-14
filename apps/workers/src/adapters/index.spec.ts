import { afterEach, describe, expect, it } from 'vitest';
import { buildAdapters } from './index.js';

const ENV_KEYS = [
  'GREENHOUSE_BOARDS',
  'LEVER_BOARDS',
  'ADZUNA_APP_ID',
  'ADZUNA_APP_KEY',
  'JSEARCH_RAPIDAPI_KEY',
] as const;

describe('buildAdapters', () => {
  afterEach(() => {
    for (const key of ENV_KEYS) delete process.env[key];
  });

  it('cae en MockAdapter si no hay ninguna fuente real configurada', () => {
    const adapters = buildAdapters();
    expect(adapters.map((a) => a.provider)).toEqual(['MOCK']);
  });

  it('construye un adapter por cada fuente configurada, sin mock', () => {
    process.env.GREENHOUSE_BOARDS = 'airbnb,stripe';
    process.env.LEVER_BOARDS = 'netflix';
    process.env.ADZUNA_APP_ID = 'id';
    process.env.ADZUNA_APP_KEY = 'key';
    process.env.JSEARCH_RAPIDAPI_KEY = 'rapidkey';

    const adapters = buildAdapters();

    expect(adapters.map((a) => a.provider)).toEqual(['GREENHOUSE', 'LEVER', 'ADZUNA', 'JSEARCH']);
  });

  it('Adzuna requiere AMBAS variables (id y key); con solo una, se omite', () => {
    process.env.ADZUNA_APP_ID = 'id-sin-key';
    const adapters = buildAdapters();
    expect(adapters.map((a) => a.provider)).not.toContain('ADZUNA');
  });
});
