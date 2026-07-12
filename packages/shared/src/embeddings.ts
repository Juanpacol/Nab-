import { EMBEDDING_DIMENSIONS } from './constants.js';

/**
 * Embedding determinista y sin dependencias externas, para desarrollo/local
 * sin claves de IA. No es semánticamente rico como un modelo real, pero es
 * estable (mismo texto → mismo vector) y normalizado, así el matching por
 * similitud coseno funciona de forma coherente en local.
 *
 * En producción se reemplaza por Voyage AI (ver embed helper de api/workers).
 */
export function mockEmbedding(text: string, dims = EMBEDDING_DIMENSIONS): number[] {
  const vec = new Array<number>(dims).fill(0);
  const tokens = text
    .toLowerCase()
    .replace(/[^a-z0-9áéíóúñ ]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

  for (const token of tokens) {
    // Hash simple y estable del token a un índice de la dimensión.
    let h = 2166136261;
    for (let i = 0; i < token.length; i++) {
      h ^= token.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    const idx = Math.abs(h) % dims;
    vec[idx] = (vec[idx] ?? 0) + 1;
  }

  // Normalizar a vector unitario (para coseno).
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
  return vec.map((v) => v / norm);
}

/** Serializa un vector al formato literal de pgvector: "[0.1,0.2,...]". */
export function toPgVector(vec: number[]): string {
  return `[${vec.join(',')}]`;
}
