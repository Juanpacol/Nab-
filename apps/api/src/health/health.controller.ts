import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { PrismaService } from '../prisma/prisma.service.js';

@ApiTags('health')
@SkipThrottle()
@Controller()
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  /** Liveness: el proceso está arriba. */
  @Get('health')
  health() {
    return { status: 'ok', service: 'nab-api', timestamp: new Date().toISOString() };
  }

  /** Readiness: dependencias (DB) accesibles. */
  @Get('ready')
  async ready() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ready', db: 'up' };
    } catch {
      return { status: 'not-ready', db: 'down' };
    }
  }
}
