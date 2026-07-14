import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mockEmbedding, EMBEDDING_DIMENSIONS } from '@nab/shared';

/**
 * embeddings.ts lee VOYAGE_API_KEY como constante de módulo al importarse, así
 * que cada test que necesite un valor distinto debe fijar la env var y volver
 * a importar con `vi.resetModules()` (import estático no sirve aquí).
 */
async function importEmbedText() {
  const mod = await import('./embeddings.js');
  return mod.embedText;
}

describe('embedText', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
    delete process.env.VOYAGE_API_KEY;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.VOYAGE_API_KEY;
  });

  it('sin VOYAGE_API_KEY, usa el embedding mock determinista sin llamar a fetch', async () => {
    const embedText = await importEmbedText();
    const result = await embedText('hola mundo');
    expect(result).toEqual(mockEmbedding('hola mundo'));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('con VOYAGE_API_KEY, llama a Voyage con timeout y devuelve el embedding real', async () => {
    process.env.VOYAGE_API_KEY = 'voyage-key';
    const vector = Array.from({ length: EMBEDDING_DIMENSIONS }, (_, i) => i / EMBEDDING_DIMENSIONS);
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ data: [{ embedding: vector }] }) });

    const embedText = await importEmbedText();
    const result = await embedText('hola mundo');

    expect(result).toEqual(vector);
    const [url, opts] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://api.voyageai.com/v1/embeddings');
    expect(opts.signal).toBeInstanceOf(AbortSignal);
  });

  it('si Voyage responde con dimensiones inválidas, cae al mock', async () => {
    process.env.VOYAGE_API_KEY = 'voyage-key';
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ data: [{ embedding: [1, 2, 3] }] }) });

    const embedText = await importEmbedText();
    const result = await embedText('texto');

    expect(result).toEqual(mockEmbedding('texto'));
  });

  it('si la respuesta no es OK, cae al mock sin lanzar', async () => {
    process.env.VOYAGE_API_KEY = 'voyage-key';
    fetchMock.mockResolvedValueOnce({ ok: false, status: 429 });

    const embedText = await importEmbedText();
    await expect(embedText('texto')).resolves.toEqual(mockEmbedding('texto'));
  });

  it('si fetch lanza (timeout/red), cae al mock sin propagar el error', async () => {
    process.env.VOYAGE_API_KEY = 'voyage-key';
    fetchMock.mockRejectedValueOnce(new Error('timeout'));

    const embedText = await importEmbedText();
    await expect(embedText('texto')).resolves.toEqual(mockEmbedding('texto'));
  });
});
