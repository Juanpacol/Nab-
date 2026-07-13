import { Worker } from 'bullmq';
import * as Sentry from '@sentry/node';
import nodemailer from 'nodemailer';
import { QUEUE_NAMES } from '@nab/shared';
import { connection } from '../redis.js';
import { logger } from '../logger.js';

type EmailJob =
  | { type: 'verify-email'; to: string; token: string }
  | { type: 'password-reset'; to: string; token: string }
  | { type: 'welcome'; to: string; name: string | null }
  | { type: 'payment-failed'; to: string };

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST ?? 'localhost',
  port: Number(process.env.SMTP_PORT ?? 1025),
  secure: false,
  auth: process.env.SMTP_USER
    ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS ?? '' }
    : undefined,
});

const FROM = process.env.EMAIL_FROM ?? 'Nab <no-reply@nab.app>';
const WEB_URL = process.env.WEB_PUBLIC_URL ?? 'http://localhost:3000';

function render(job: EmailJob): { subject: string; html: string } {
  switch (job.type) {
    case 'verify-email':
      return {
        subject: 'Verifica tu correo en Nab',
        html: `<p>¡Bienvenido a Nab!</p><p>Confirma tu correo:</p>
          <p><a href="${WEB_URL}/verify-email?token=${job.token}">Verificar correo</a></p>`,
      };
    case 'password-reset':
      return {
        subject: 'Restablece tu contraseña de Nab',
        html: `<p>Recibimos una solicitud para restablecer tu contraseña.</p>
          <p><a href="${WEB_URL}/reset-password?token=${job.token}">Crear nueva contraseña</a></p>
          <p>Si no fuiste tú, ignora este correo.</p>`,
      };
    case 'welcome':
      return {
        subject: '¡Tu búsqueda de empleo empieza ahora!',
        html: `<p>Hola ${job.name ?? ''}, tu cuenta de Nab está lista.</p>`,
      };
    case 'payment-failed':
      return {
        subject: 'No pudimos procesar tu pago en Nab',
        html: `<p>El cobro de tu suscripción no se pudo completar.</p>
          <p>Actualiza tu método de pago para no perder el acceso a tus créditos:</p>
          <p><a href="${WEB_URL}/billing">Actualizar método de pago</a></p>`,
      };
  }
}

/** Envía correos transaccionales (verificación, reset, bienvenida) vía SMTP. */
export function startEmailWorker(): Worker {
  const worker = new Worker<EmailJob>(
    QUEUE_NAMES.EMAIL,
    async (job) => {
      const { subject, html } = render(job.data);
      await transporter.sendMail({ from: FROM, to: job.data.to, subject, html });
      logger.info({ to: job.data.to, type: job.data.type }, 'Correo enviado');
      return { ok: true };
    },
    { connection },
  );

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err: err.message }, 'Envío de correo falló');
    Sentry.captureException(err);
  });
  return worker;
}
