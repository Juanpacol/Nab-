import { Module } from '@nestjs/common';
import { TestTakingController } from './test-taking.controller.js';
import { TestTakingService } from './test-taking.service.js';

/** Lado candidato del motor de pruebas técnicas (Fase 2 del plan B2B). */
@Module({
  controllers: [TestTakingController],
  providers: [TestTakingService],
})
export class TestTakingModule {}
