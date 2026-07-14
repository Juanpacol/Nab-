import { HttpException, Injectable, Logger } from '@nestjs/common';
import * as Sentry from '@sentry/node';
import { PrismaService } from '../../prisma/prisma.service.js';
import { JobsService } from '../jobs/jobs.service.js';
import { ApplicationsService } from '../applications/applications.service.js';
import { GenerationService } from '../ai/generation.service.js';
import { PushService } from '../notifications/push.service.js';

/**
 * Agente de auto-aplicación (opt-in): para cada usuario que lo activó, revisa
 * sus vacantes con mejor match y aplica en su nombre, dentro del score mínimo
 * y el tope diario que el propio usuario configuró.
 *
 * Reusa TAL CUAL la lógica de dinero ya endurecida (`GenerationService`,
 * `ApplicationsService.apply`) — este servicio solo decide QUÉ vacantes
 * intentar y CUÁNTAS; nunca reimplementa el cobro de crédito ni el chequeo
 * de propiedad (IDOR) de recursos.
 */
@Injectable()
export class AutoApplyService {
  private readonly logger = new Logger(AutoApplyService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jobs: JobsService,
    private readonly applications: ApplicationsService,
    private readonly generation: GenerationService,
    private readonly push: PushService,
  ) {}

  /** Recorre a todos los usuarios con el agente activo. Un usuario nunca detiene la corrida de los demás. */
  async runSweep(): Promise<void> {
    const profiles = await this.prisma.profile.findMany({
      where: { autoApplyEnabled: true },
      select: { userId: true, autoApplyMinScore: true, autoApplyMaxPerDay: true },
    });
    this.logger.log(`Auto-apply: barrida sobre ${profiles.length} usuario(s) con el agente activo`);

    for (const profile of profiles) {
      try {
        await this.runForUser(profile);
      } catch (err) {
        this.logger.error(`Auto-apply falló para el usuario ${profile.userId}: ${String(err)}`);
        Sentry.captureException(err);
      }
    }
  }

  private async runForUser(profile: {
    userId: string;
    autoApplyMinScore: number;
    autoApplyMaxPerDay: number;
  }): Promise<void> {
    const startOfToday = new Date();
    startOfToday.setUTCHours(0, 0, 0, 0);

    const appliedToday = await this.prisma.application.count({
      where: { userId: profile.userId, autoApplied: true, submittedAt: { gte: startOfToday } },
    });
    let remaining = profile.autoApplyMaxPerDay - appliedToday;
    if (remaining <= 0) return;

    const { data: matches } = await this.jobs.forYou(profile.userId, 20);
    const minScore = profile.autoApplyMinScore / 100;
    const candidates = matches.filter((j) => j.score >= minScore);

    for (const job of candidates) {
      if (remaining <= 0) break;

      // Evita duplicar una aplicación ya hecha (manual o de una corrida previa).
      const existing = await this.prisma.application.findUnique({
        where: { userId_jobId: { userId: profile.userId, jobId: job.id } },
        select: { submittedAt: true },
      });
      if (existing?.submittedAt) continue;

      try {
        const { resume } = await this.generation.generateAndSaveResume(profile.userId, job.id);
        await this.applications.apply(profile.userId, { jobId: job.id, resumeId: resume.id }, { auto: true });
        remaining--;
        await this.notify(profile.userId, job.title, job.company);
      } catch (err) {
        if (err instanceof HttpException && err.getStatus() === 402) {
          // Sin saldo suficiente: reintentar con la siguiente vacante fallaría
          // exactamente igual, así que cortamos para este usuario en esta corrida.
          break;
        }
        this.logger.warn(
          `Auto-apply: no se pudo aplicar a "${job.title}" (${job.id}) para ${profile.userId}: ${String(err)}`,
        );
        Sentry.captureException(err);
      }
    }
  }

  /** Push best-effort si el usuario tiene la app móvil con token registrado. */
  private async notify(userId: string, jobTitle: string, company: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { expoPushToken: true } });
    if (!user?.expoPushToken) return;
    await this.push.send(
      user.expoPushToken,
      'Aplicación automática 🤖',
      `Aplicamos por ti a ${jobTitle} en ${company}.`,
      { type: 'auto-apply' },
    );
  }
}
