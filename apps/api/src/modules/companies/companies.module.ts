import { Module } from '@nestjs/common';
import { CompaniesController } from './companies.controller.js';
import { CompaniesService } from './companies.service.js';
import { CompanyMemberGuard } from './company-member.guard.js';

/**
 * Empresas (lado B2B, Fase 0 del plan de implementación). Exporta
 * CompanyMemberGuard + CompaniesService para que los módulos de vacantes,
 * pruebas técnicas, evaluaciones y dashboard de empresa (fases siguientes)
 * los reutilicen sin duplicar la lógica de membresía.
 */
@Module({
  controllers: [CompaniesController],
  providers: [CompaniesService, CompanyMemberGuard],
  exports: [CompaniesService, CompanyMemberGuard],
})
export class CompaniesModule {}
