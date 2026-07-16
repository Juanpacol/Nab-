import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { sendThreadMessageSchema } from '@nab/shared';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { CurrentUser, type JwtUser } from '../../common/decorators/current-user.decorator.js';
import { ThreadsService } from './threads.service.js';

/** Chat candidato→RH por aplicación. Ownership siempre por userId del JWT, nunca del path. */
@ApiTags('threads')
@Controller('applications/:applicationId/thread')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ThreadsController {
  constructor(private readonly threads: ThreadsService) {}

  @Get()
  @ApiOperation({ summary: 'Obtiene (o crea) el hilo de chat de esta aplicación' })
  getThread(@CurrentUser() user: JwtUser, @Param('applicationId') applicationId: string) {
    return this.threads.getThreadForCandidate(applicationId, user.userId);
  }

  @Get('messages')
  @ApiOperation({ summary: 'Lista los mensajes del hilo' })
  listMessages(@CurrentUser() user: JwtUser, @Param('applicationId') applicationId: string) {
    return this.threads.listMessagesForCandidate(applicationId, user.userId);
  }

  @Post('messages')
  @ApiOperation({ summary: 'Envía un mensaje al RH de la empresa' })
  sendMessage(@CurrentUser() user: JwtUser, @Param('applicationId') applicationId: string, @Body() body: unknown) {
    const { content } = sendThreadMessageSchema.parse(body);
    return this.threads.sendMessageAsCandidate(applicationId, user.userId, content);
  }

  @Post('read')
  @ApiOperation({ summary: 'Marca como leídos los mensajes del RH' })
  markRead(@CurrentUser() user: JwtUser, @Param('applicationId') applicationId: string) {
    return this.threads.markReadForCandidate(applicationId, user.userId);
  }
}
