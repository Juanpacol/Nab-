/** Constantes compartidas de dominio. */

export const APP_NAME = 'Nab';
export const APP_TAGLINE = 'Deja de aplicar. Empieza a conseguir entrevistas.';

/** Dimensión de los embeddings (Voyage voyage-3). Debe coincidir con schema.prisma. */
export const EMBEDDING_DIMENSIONS = 1024;

/** Tonos disponibles para cartas de presentación. */
export const COVER_LETTER_TONES = [
  { id: 'professional', label: 'Profesional' },
  { id: 'enthusiastic', label: 'Entusiasta' },
  { id: 'concise', label: 'Conciso' },
  { id: 'friendly', label: 'Cercano' },
] as const;

/** Etiquetas en español para los estados de aplicación. */
export const APPLICATION_STATUS_LABELS: Record<string, string> = {
  SAVED: 'Guardado',
  APPLIED: 'Aplicado',
  VIEWED: 'Visto',
  INTERVIEW: 'Entrevista',
  OFFER: 'Oferta',
  REJECTED: 'Rechazado',
  WITHDRAWN: 'Retirado',
};

/** Orden de columnas del kanban de seguimiento. */
export const KANBAN_COLUMNS = ['SAVED', 'APPLIED', 'INTERVIEW', 'OFFER', 'REJECTED'] as const;

/** Nombres de las colas BullMQ. */
export const QUEUE_NAMES = {
  JOB_INGEST: 'job-ingest',
  EMBEDDINGS: 'embeddings',
  AI_GENERATION: 'ai-generation',
  EMAIL: 'email',
} as const;
