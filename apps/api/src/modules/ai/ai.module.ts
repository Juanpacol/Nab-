import { Global, Module } from '@nestjs/common';
import { AiService } from './ai.service.js';

/**
 * Motor de IA (Fase 3): cliente Claude centralizado con fallback a modo mock
 * cuando no hay ANTHROPIC_API_KEY (ideal para desarrollo y tests locales).
 * En fases siguientes añade generación de CV/carta, score ATS y matching.
 */
@Global()
@Module({
  providers: [AiService],
  exports: [AiService],
})
export class AiModule {}
