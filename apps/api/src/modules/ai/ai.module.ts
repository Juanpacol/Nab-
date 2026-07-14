import { Global, Module } from '@nestjs/common';
import { AiService } from './ai.service.js';
import { AiController } from './ai.controller.js';
import { GenerationService } from './generation.service.js';

/**
 * Motor de IA (Fase 3): cliente Claude centralizado con fallback a modo mock
 * cuando no hay ANTHROPIC_API_KEY (ideal para desarrollo y tests locales).
 * Expone endpoints de extracción de requisitos, generación de CV (con score ATS
 * y verificación anti-alucinación) y de cartas de presentación.
 */
@Global()
@Module({
  controllers: [AiController],
  providers: [AiService, GenerationService],
  exports: [AiService, GenerationService],
})
export class AiModule {}
