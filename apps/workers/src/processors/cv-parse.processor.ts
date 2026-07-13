import { Worker } from 'bullmq';
import * as Sentry from '@sentry/node';
// Importamos la implementación interna para evitar el modo debug de pdf-parse
// (su index.js intenta leer un PDF de prueba al importarse en ESM).
import pdfParse from 'pdf-parse/lib/pdf-parse.js';
import { prisma, type Prisma } from '@nab/database';
import { QUEUE_NAMES } from '@nab/shared';
import { connection } from '../redis.js';
import { logger } from '../logger.js';
import { downloadObject } from '../storage.js';
import { parseResume } from '../ai.js';

interface ParseCvJob {
  userId: string;
  key: string;
}

/**
 * Procesa la cola de IA. En Fase 1 maneja "parse-cv": descarga el PDF,
 * extrae el texto, lo pasa por la IA (o mock) y prellena el perfil del usuario.
 */
export function startCvParseWorker(): Worker {
  const worker = new Worker(
    QUEUE_NAMES.AI_GENERATION,
    async (job) => {
      if (job.name !== 'parse-cv') return;
      const { userId, key } = job.data as ParseCvJob;
      logger.info({ userId, key }, 'Parseando CV');

      const pdf = await downloadObject(key);
      const { text } = await pdfParse(pdf);
      const parsed = await parseResume(text);

      await prisma.profile.upsert({
        where: { userId },
        create: {
          userId,
          headline: parsed.headline ?? null,
          summary: parsed.summary ?? null,
          skills: parsed.skills,
          experienceJson: parsed.experience as unknown as Prisma.InputJsonValue,
          educationJson: parsed.education as unknown as Prisma.InputJsonValue,
        },
        update: {
          headline: parsed.headline ?? undefined,
          summary: parsed.summary ?? undefined,
          skills: parsed.skills,
          experienceJson: parsed.experience as unknown as Prisma.InputJsonValue,
          educationJson: parsed.education as unknown as Prisma.InputJsonValue,
        },
      });

      logger.info({ userId }, 'Perfil prellenado desde el CV');
      return { ok: true };
    },
    { connection },
  );

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err: err.message }, 'CV parse falló');
    Sentry.captureException(err);
  });
  return worker;
}
