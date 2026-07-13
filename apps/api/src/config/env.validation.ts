import { z } from 'zod';

/**
 * Valores de JWT_SECRET que NUNCA deben llegar a producción: el fallback que
 * tenía el código y los placeholders publicados en .env.example (públicos en
 * el repo). Si el JWT_SECRET real coincide, cualquiera puede forjar tokens.
 * No se aplica el mismo criterio a las credenciales S3: en el docker-compose.yml
 * base el backend MinIO por defecto usa "minio"/"minio12345" pero no se expone
 * a internet, así que no es un secreto de cara al público.
 */
const DEV_ONLY_JWT_SECRETS = new Set([
  'nab-dev-secret-cambia-esto',
  'cambia-esto-por-otro-secreto-largo',
  'cambia-esto-por-un-secreto-largo',
]);

const baseSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL es obligatorio'),
  REDIS_URL: z.string().min(1, 'REDIS_URL es obligatorio'),
  // Requerido siempre (no solo en prod): sin él, JwtModule arranca sin firmar
  // tokens correctamente. copia .env.example a .env para tener un valor de dev.
  JWT_SECRET: z.string().min(1, 'JWT_SECRET es obligatorio (copia .env.example a .env)'),
});

const productionSchema = z.object({
  JWT_SECRET: z
    .string()
    .min(32, 'JWT_SECRET debe tener al menos 32 caracteres en producción')
    .refine((v) => !DEV_ONLY_JWT_SECRETS.has(v), 'JWT_SECRET no puede ser el placeholder de .env.example (genera uno con: openssl rand -base64 32)'),
  CORS_ORIGINS: z
    .string()
    .min(1, 'CORS_ORIGINS es obligatorio en producción')
    .refine(
      (v) => !v.split(',').some((o) => o.trim().includes('localhost')),
      'CORS_ORIGINS no debe incluir localhost en producción',
    ),
  S3_ENDPOINT: z.string().url('S3_ENDPOINT debe ser una URL válida'),
  S3_ACCESS_KEY: z.string().min(1, 'S3_ACCESS_KEY es obligatorio en producción'),
  S3_SECRET_KEY: z.string().min(1, 'S3_SECRET_KEY es obligatorio en producción'),
  S3_BUCKET: z.string().min(1),
  STRIPE_SECRET_KEY: z.string().startsWith('sk_', 'STRIPE_SECRET_KEY debe empezar con sk_'),
  STRIPE_WEBHOOK_SECRET: z.string().startsWith('whsec_', 'STRIPE_WEBHOOK_SECRET debe empezar con whsec_'),
  // La IA/embeddings solo pueden faltar si el modo mock se pide explícitamente.
  ANTHROPIC_API_KEY: z.string().optional(),
  AI_MOCK: z.string().optional(),
});

/**
 * Valida las variables de entorno al arrancar. Con NODE_ENV=production exige
 * secretos reales (nunca los defaults de desarrollo) y falla con un mensaje
 * claro en vez de arrancar en un estado inseguro o silenciosamente mockeado.
 */
export function validateEnv(env: NodeJS.ProcessEnv): void {
  const base = baseSchema.safeParse(env);
  if (!base.success) {
    printErrorsAndExit(base.error);
  }

  if (base.success && base.data.NODE_ENV === 'production') {
    const prod = productionSchema.safeParse(env);
    if (!prod.success) {
      printErrorsAndExit(prod.error);
    }
    if (prod.success && !prod.data.ANTHROPIC_API_KEY && prod.data.AI_MOCK !== 'true') {
      printFatal(
        'ANTHROPIC_API_KEY no está configurada. Si esto es intencional (beta sin IA real), ' +
          'define AI_MOCK=true explícitamente. De lo contrario el servicio arrancaría en modo ' +
          'mock silencioso, sirviendo respuestas falsas sin avisar.',
      );
    }
  }
}

function printErrorsAndExit(error: z.ZodError): never {
  printFatal(
    error.issues.map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`).join('\n'),
  );
}

function printFatal(message: string): never {
  console.error(`\n✖ Configuración de entorno inválida:\n${message}\n`);
  process.exit(1);
}
