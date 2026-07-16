import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { CurrentUser, type JwtUser } from '../../common/decorators/current-user.decorator.js';
import { ThreadsService } from './threads.service.js';

/** Conteo global de no leídos del candidato — badge de navegación, no atado a una aplicación. */
@ApiTags('threads')
@Controller('threads')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ThreadsUnreadController {
  constructor(private readonly threads: ThreadsService) {}

  @Get('unread-count')
  @ApiOperation({ summary: 'Total de mensajes sin leer del RH, a través de todas las aplicaciones del candidato' })
  async unreadCount(@CurrentUser() user: JwtUser) {
    return { count: await this.threads.unreadCountForCandidate(user.userId) };
  }
}
