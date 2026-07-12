import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller.js';
import { ChatService } from './chat.service.js';

/**
 * Chatbot (Fase 5): streaming SSE, bot de soporte con RAG sobre HelpArticle
 * y career coach con tool-use. Historial en ChatSession/ChatMessage.
 */
@Module({
  controllers: [ChatController],
  providers: [ChatService],
})
export class ChatModule {}
