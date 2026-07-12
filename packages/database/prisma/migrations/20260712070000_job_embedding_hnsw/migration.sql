-- Índice HNSW para búsqueda semántica de vacantes por similitud coseno.
-- Prisma no gestiona índices sobre columnas de tipo Unsupported ("vector"),
-- así que se crea manualmente aquí. Requiere pgvector >= 0.5.0.
CREATE INDEX IF NOT EXISTS "Job_embedding_hnsw_idx"
  ON "Job" USING hnsw ("embedding" vector_cosine_ops);
