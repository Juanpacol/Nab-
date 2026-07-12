import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { QUEUE_NAMES } from '@nab/shared';

/** Tipos de trabajo de email (los consume el worker de apps/workers). */
export type EmailJob =
  | { type: 'verify-email'; to: string; token: string }
  | { type: 'password-reset'; to: string; token: string }
  | { type: 'welcome'; to: string; name: string | null };

@Injectable()
export class EmailProducer {
  constructor(@InjectQueue(QUEUE_NAMES.EMAIL) private readonly queue: Queue<EmailJob>) {}

  async enqueueVerification(to: string, token: string): Promise<void> {
    await this.queue.add('verify-email', { type: 'verify-email', to, token });
  }

  async enqueuePasswordReset(to: string, token: string): Promise<void> {
    await this.queue.add('password-reset', { type: 'password-reset', to, token });
  }

  async enqueueWelcome(to: string, name: string | null): Promise<void> {
    await this.queue.add('welcome', { type: 'welcome', to, name });
  }
}
