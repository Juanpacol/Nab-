import { Module } from '@nestjs/common';
import { CompaniesModule } from '../companies/companies.module.js';
import { ThreadsController } from './threads.controller.js';
import { CompanyThreadsController } from './company-threads.controller.js';
import { ThreadsUnreadController } from './threads-unread.controller.js';
import { ThreadsService } from './threads.service.js';

/** Chat humano↔humano candidato↔RH (Fase 4 del plan B2B). */
@Module({
  imports: [CompaniesModule],
  controllers: [ThreadsController, CompanyThreadsController, ThreadsUnreadController],
  providers: [ThreadsService],
})
export class ThreadsModule {}
