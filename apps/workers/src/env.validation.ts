import { z } from 'zod';

const baseSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL es obligatorio'),
  REDIS_URL: z.string().min(1, 'REDIS_URL es obligatorio'),
});

const productionSchema = z.object({
  S3_ENDPOINT: z.string().url('S3_ENDPOINT debe ser una URL válida'),
  S3_ACCESS_KEY: z.string().min(1, 'S3_ACCESS_KEY es obligatorio en producción'),
  S3_SECRET_KEY: z.string().min(1, 'S3_SECRET_KEY es obligatorio en producción'),
  S3_BUCKET: z.string().min(1),
  SMTP_HOST: z.string().min(1, 'SMTP_HOST es obligatorio en producción'),
  EMAIL_FROM: z.string().min(1, 'EMAIL_FROM es obligatorio en producción'),
  ANTHROPIC_API_KEY: z.string().optional(),
  VOYAGE_API_KEY: z.string().optional(),
  AI_MOCK: z.string().optional(),
  INGEST_MOCK: z.string().optional(),
  GREENHOUSE_BOARDS: z.string().optional(),
  LEVER_BOARDS: z.string().optional(),
  ADZUNA_APP_ID: z.string().optional(),
  JSEARCH_RAPIDAPI_KEY: z.string().optional(),
});

/**
 * Valida el entorno de los workers al arrancar. En producción exige
 * credenciales reales de storage/email y evita caer en modos mock (IA,
 * embeddings, ingesta) de forma silenciosa: hace falta pedirlo explícitamente
 * con AI_MOCK=true / INGEST_MOCK=true.
 */
export function validateEnv(env: NodeJS.ProcessEnv): void {
  const base = baseSchema.safeParse(env);
  if (!base.success) printErrorsAndExit(base.error);
  if (!base.success || base.data.NODE_ENV !== 'production') return;

  const prod = productionSchema.safeParse(env);
  if (!prod.success) printErrorsAndExit(prod.error);
  if (!prod.success) return;

  if (!prod.data.ANTHROPIC_API_KEY && prod.data.AI_MOCK !== 'true') {
    printFatal(
      'ANTHROPIC_API_KEY no está configurada. Si es intencional, define AI_MOCK=true ' +
        'explícitamente; si no, el parseo de CV y la extracción de vacantes correrían en ' +
        'modo mock sin avisar.',
    );
  }
  if (!prod.data.VOYAGE_API_KEY && prod.data.AI_MOCK !== 'true') {
    printFatal(
      'VOYAGE_API_KEY no está configurada. Si es intencional, define AI_MOCK=true ' +
        'explícitamente; si no, los embeddings de matching serían mock sin avisar.',
    );
  }
  const hasRealSource =
    prod.data.GREENHOUSE_BOARDS || prod.data.LEVER_BOARDS || prod.data.ADZUNA_APP_ID || prod.data.JSEARCH_RAPIDAPI_KEY;
  if (!hasRealSource && prod.data.INGEST_MOCK !== 'true') {
    printFatal(
      'No hay ninguna fuente de vacantes configurada (GREENHOUSE_BOARDS/LEVER_BOARDS/' +
        'ADZUNA_APP_ID/JSEARCH_RAPIDAPI_KEY). Si es intencional, define INGEST_MOCK=true ' +
        'explícitamente; si no, la ingesta correría en modo mock sin avisar.',
    );
  }
}

function printErrorsAndExit(error: z.ZodError): never {
  printFatal(error.issues.map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`).join('\n'));
}

function printFatal(message: string): never {
  console.error(`\n✖ Configuración de entorno inválida:\n${message}\n`);
  process.exit(1);
}
