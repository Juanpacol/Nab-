import { Body, Controller, Get, Logger, Param, Post, Query, Res, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import type { Response } from 'express';
import { chatMessageSchema } from '@nab/shared';
import type { ChatContext } from '@nab/database';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { CurrentUser, type JwtUser } from '../../common/decorators/current-user.decorator.js';
import { ChatService } from './chat.service.js';

/**
 * Chatbot (Fase 5): soporte (RAG) y career coach (tool-use). La respuesta se
 * emite en streaming SSE por trozos para una UX token a token.
 */
@ApiTags('chat')
@Controller('chat')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ChatController {
  private readonly logger = new Logger(ChatController.name);

  constructor(private readonly chat: ChatService) {}

  @Post()
  @ApiOperation({ summary: 'Envía un mensaje y recibe la respuesta en streaming (SSE)' })
  async stream(@CurrentUser() user: JwtUser, @Body() body: unknown, @Res() res: Response) {
    const input = chatMessageSchema.parse(body);

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    const send = (data: unknown) => res.write(`data: ${JSON.stringify(data)}\n\n`);
    send({ typing: true });

    try {
      const { sessionId, text } = await this.chat.respond(
        user.userId,
        input.contextType,
        input.content,
        input.sessionId,
      );
      // Emitir por palabras para una sensación de streaming token a token.
      for (const chunk of text.match(/\S+\s*/g) ?? [text]) {
        send({ delta: chunk });
        await new Promise((r) => setTimeout(r, 12));
      }
      send({ done: true, sessionId });
    } catch (err) {
      send({ error: 'Ocurrió un error generando la respuesta.' });
      this.logger.error(`chat stream error: ${String(err)}`);
    } finally {
      res.end();
    }
  }

  @Get('sessions')
  @ApiOperation({ summary: 'Lista las sesiones de chat del usuario' })
  sessions(@CurrentUser() user: JwtUser, @Query('contextType') contextType?: string) {
    const ctx: ChatContext = contextType === 'CAREER_COACH' ? 'CAREER_COACH' : 'SUPPORT';
    return this.chat.listSessions(user.userId, ctx);
  }

  @Get('sessions/:id')
  @ApiOperation({ summary: 'Mensajes de una sesión de chat' })
  messages(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.chat.getMessages(user.userId, id);
  }
}
