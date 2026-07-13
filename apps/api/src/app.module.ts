import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import { APP_GUARD, APP_FILTER } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';

import { PrismaModule } from './prisma/prisma.module.js';
import { QueuesModule } from './queues/queues.module.js';
import { StorageModule } from './storage/storage.module.js';
import { HealthModule } from './health/health.module.js';
import { AllExceptionsFilter } from './common/all-exceptions.filter.js';

// Módulos de dominio (esqueletos en Fase 0; se implementan en fases siguientes)
import { AuthModule } from './modules/auth/auth.module.js';
import { UsersModule } from './modules/users/users.module.js';
import { JobsModule } from './modules/jobs/jobs.module.js';
import { ApplicationsModule } from './modules/applications/applications.module.js';
import { AiModule } from './modules/ai/ai.module.js';
import { BillingModule } from './modules/billing/billing.module.js';
import { ChatModule } from './modules/chat/chat.module.js';
import { RealtimeModule } from './modules/realtime/realtime.module.js';
import { NotificationsModule } from './modules/notifications/notifications.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    LoggerModule.forRoot({
      pinoHttp: {
        transport:
          process.env.NODE_ENV !== 'production'
            ? { target: 'pino-pretty', options: { singleLine: true } }
            : undefined,
        // Redacción de datos sensibles en logs
        redact: ['req.headers.authorization', 'req.headers.cookie', '*.password', '*.passwordHash'],
      },
    }),
    // Storage en Redis (no en memoria): los límites de rate-limit son
    // compartidos entre réplicas de la API en vez de reiniciarse por instancia.
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 60_000, limit: 120 }],
      storage: new ThrottlerStorageRedisService(process.env.REDIS_URL ?? 'redis://localhost:6379'),
    }),
    PrismaModule,
    QueuesModule,
    StorageModule,
    HealthModule,
    AuthModule,
    RealtimeModule,
    NotificationsModule,
    UsersModule,
    JobsModule,
    ApplicationsModule,
    AiModule,
    BillingModule,
    ChatModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
