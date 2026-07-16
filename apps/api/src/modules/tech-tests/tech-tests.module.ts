import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { QUEUE_NAMES } from '@nab/shared';
import { CompaniesModule } from '../companies/companies.module.js';
import { TechTestsController } from './tech-tests.controller.js';
import { TechTestsService } from './tech-tests.service.js';
import { TechTestGenerationService } from './tech-test-generation.service.js';
import { EvaluationsController } from './evaluations.controller.js';
import { EvaluationsService } from './evaluations.service.js';
import { EvaluationGenerationService } from './evaluation-generation.service.js';
import { CompanyAiProcessor } from './company-ai.processor.js';

/**
 * Motor de pruebas técnicas + evaluación con IA (Fases 2-3 del plan B2B).
 * Registra la cola `company-ai` localmente (mismo patrón que AutoApplyModule
 * con QUEUE_NAMES.AUTO_APPLY): la produce y la consume este mismo módulo,
 * vía un único CompanyAiProcessor que maneja ambos tipos de job
 * (generate-test, evaluate-submission).
 */
@Module({
  imports: [CompaniesModule, BullModule.registerQueue({ name: QUEUE_NAMES.COMPANY_AI })],
  controllers: [TechTestsController, EvaluationsController],
  providers: [
    TechTestsService,
    TechTestGenerationService,
    EvaluationsService,
    EvaluationGenerationService,
    CompanyAiProcessor,
  ],
  exports: [TechTestsService, EvaluationsService],
})
export class TechTestsModule {}
