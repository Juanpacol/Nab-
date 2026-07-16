import { Module } from '@nestjs/common';
import { CompaniesModule } from '../companies/companies.module.js';
import { CompanyDashboardController } from './company-dashboard.controller.js';
import { CompanyDashboardService } from './company-dashboard.service.js';
import { ComparisonGenerationService } from './comparison-generation.service.js';

/** Métricas y comparativa de candidatos (Fase 3 del plan B2B). */
@Module({
  imports: [CompaniesModule],
  controllers: [CompanyDashboardController],
  providers: [CompanyDashboardService, ComparisonGenerationService],
})
export class CompanyDashboardModule {}
