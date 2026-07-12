import { mockEmbedding, EMBEDDING_DIMENSIONS } from '@nab/shared';
import { logger } from './logger.js';

const apiKey = process.env.VOYAGE_API_KEY;
const model = process.env.VOYAGE_MODEL ?? 'voyage-3';

/**
 * Genera un embedding para el texto. Con VOYAGE_API_KEY usa Voyage AI; sin
 * clave usa un embedding mock determinista (local/offline, sin costo).
 */
export async function embedText(text: string): Promise<number[]> {
  if (!apiKey) return mockEmbedding(text);

  try {
    const res = await fetch('https://api.voyageai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ input: text.slice(0, 8000), model }),
    });
    if (!res.ok) {
      logger.warn({ status: res.status }, 'Voyage: respuesta no OK; usando mock');
      return mockEmbedding(text);
    }
    const data = (await res.json()) as { data?: { embedding: number[] }[] };
    const vec = data.data?.[0]?.embedding;
    if (!vec || vec.length !== EMBEDDING_DIMENSIONS) return mockEmbedding(text);
    return vec;
  } catch (err) {
    logger.error({ err: String(err) }, 'Voyage: error de red; usando mock');
    return mockEmbedding(text);
  }
}
