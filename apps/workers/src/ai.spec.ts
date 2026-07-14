import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Igual que embeddings.ts, ai.ts lee ANTHROPIC_API_KEY como constante de
 * módulo — hace falta `vi.resetModules()` + reimport dinámico por test.
 */
async function importParseResume() {
  const mod = await import('./ai.js');
  return mod.parseResume;
}

describe('parseResume (workers)', () => {
  beforeEach(() => {
    vi.resetModules();
    delete process.env.ANTHROPIC_API_KEY;
  });

  afterEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
  });

  it('sin ANTHROPIC_API_KEY, devuelve una extracción mock determinista sin llamar a la IA', async () => {
    const parseResume = await importParseResume();

    const result = await parseResume('Experiencia con TypeScript y React en Acme Corp.');

    expect(result.skills).toEqual(expect.arrayContaining(['TypeScript', 'React']));
    expect(result.headline).toMatch(/demo/i);
  });

  it('el mock nunca inventa habilidades que no aparecen en el texto', async () => {
    const parseResume = await importParseResume();

    const result = await parseResume('Un CV sin ninguna tecnología mencionada.');

    expect(result.skills).toEqual(['Comunicación']);
  });
});
