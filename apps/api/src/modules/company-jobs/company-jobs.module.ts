import { Module } from '@nestjs/common';
import { CompaniesModule } from '../companies/companies.module.js';
import { TechTestsModule } from '../tech-tests/tech-tests.module.js';
import { CompanyJobsController } from './company-jobs.controller.js';
import { CompanyJobsService } from './company-jobs.service.js';

/**
 * Vacantes propias de empresa (Fase 1 del plan B2B). Reutiliza
 * CompanyMemberGuard de CompaniesModule y TechTestsService (adjuntar/quitar
 * prueba técnica de una vacante) de TechTestsModule.
 */
@Module({
  imports: [CompaniesModule, TechTestsModule],
  controllers: [CompanyJobsController],
  providers: [CompanyJobsService],
  exports: [CompanyJobsService],
})
export class CompanyJobsModule {}
