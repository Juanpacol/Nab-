import { mockEmbedding, EMBEDDING_DIMENSIONS } from '@nab/shared';

const apiKey = process.env.VOYAGE_API_KEY;
const model = process.env.VOYAGE_MODEL ?? 'voyage-3';

/**
 * Embebe el texto de una consulta para búsqueda semántica. Con VOYAGE_API_KEY
 * usa Voyage AI; sin clave, embedding mock determinista (local/offline).
 */
export async function embedQuery(text: string): Promise<number[]> {
  if (!apiKey) return mockEmbedding(text);
  try {
    const res = await fetch('https://api.voyageai.com/v1/embeddings', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: text.slice(0, 4000), model }),
    });
    if (!res.ok) return mockEmbedding(text);
    const data = (await res.json()) as { data?: { embedding: number[] }[] };
    const vec = data.data?.[0]?.embedding;
    return vec && vec.length === EMBEDDING_DIMENSIONS ? vec : mockEmbedding(text);
  } catch {
    return mockEmbedding(text);
  }
}
