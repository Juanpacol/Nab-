import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { sendThreadMessageSchema } from '@nab/shared';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { CurrentUser, type JwtUser } from '../../common/decorators/current-user.decorator.js';
import { CompanyMemberGuard } from '../companies/company-member.guard.js';
import { CurrentCompany, type CompanyMembership } from '../companies/current-company.decorator.js';
import { ThreadsService } from './threads.service.js';

/** Chat RH→candidato (lado empresa). companyId siempre de @CurrentCompany(). */
@ApiTags('threads')
@Controller('companies/:companyId/threads')
@UseGuards(JwtAuthGuard, CompanyMemberGuard)
@ApiBearerAuth()
export class CompanyThreadsController {
  constructor(private readonly threads: ThreadsService) {}

  @Get()
  @ApiOperation({ summary: 'Lista los hilos de la empresa (opcionalmente filtrados por vacante)' })
  listThreads(@CurrentCompany() membership: CompanyMembership, @Query('jobId') jobId?: string) {
    return this.threads.listThreadsForCompany(membership.companyId, jobId);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Total de mensajes sin leer de candidatos, a través de todos los hilos de la empresa' })
  async unreadCount(@CurrentCompany() membership: CompanyMembership) {
    return { count: await this.threads.unreadCountForCompany(membership.companyId) };
  }

  @Get(':threadId/messages')
  @ApiOperation({ summary: 'Lista los mensajes de un hilo' })
  listMessages(@CurrentCompany() membership: CompanyMembership, @Param('threadId') threadId: string) {
    return this.threads.listMessagesForCompany(membership.companyId, threadId);
  }

  @Post(':threadId/messages')
  @ApiOperation({ summary: 'Envía un mensaje al candidato' })
  sendMessage(
    @CurrentCompany() membership: CompanyMembership,
    @CurrentUser() user: JwtUser,
    @Param('threadId') threadId: string,
    @Body() body: unknown,
  ) {
    const { content } = sendThreadMessageSchema.parse(body);
    return this.threads.sendMessageAsCompany(membership.companyId, threadId, user.userId, content);
  }

  @Post(':threadId/read')
  @ApiOperation({ summary: 'Marca como leídos los mensajes del candidato' })
  markRead(@CurrentCompany() membership: CompanyMembership, @Param('threadId') threadId: string) {
    return this.threads.markReadForCompany(membership.companyId, threadId);
  }
}
