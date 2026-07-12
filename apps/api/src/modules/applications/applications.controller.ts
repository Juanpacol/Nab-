import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import {
  createApplicationSchema,
  updateApplicationStatusSchema,
  applicationNotesSchema,
} from '@nab/shared';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { CurrentUser, type JwtUser } from '../../common/decorators/current-user.decorator.js';
import { ApplicationsService } from './applications.service.js';

/**
 * Aplicaciones y seguimiento (Fase 4): aplicar (asistido, descuenta crédito),
 * kanban de estados, timeline de eventos, notas y métricas del dashboard.
 */
@ApiTags('applications')
@Controller('applications')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ApplicationsController {
  constructor(private readonly applications: ApplicationsService) {}

  @Post()
  @ApiOperation({ summary: 'Aplica a una vacante (asistido; descuenta 1 crédito)' })
  apply(@CurrentUser() user: JwtUser, @Body() body: unknown) {
    const input = createApplicationSchema.parse(body);
    return this.applications.apply(user.userId, input);
  }

  @Get()
  @ApiOperation({ summary: 'Lista las aplicaciones del usuario (kanban)' })
  list(@CurrentUser() user: JwtUser) {
    return this.applications.list(user.userId);
  }

  @Get('metrics')
  @ApiOperation({ summary: 'Métricas del dashboard de seguimiento' })
  metrics(@CurrentUser() user: JwtUser) {
    return this.applications.metrics(user.userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de una aplicación con su timeline' })
  detail(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.applications.getById(user.userId, id);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Cambia el estado de una aplicación (kanban)' })
  updateStatus(@CurrentUser() user: JwtUser, @Param('id') id: string, @Body() body: unknown) {
    const { status, notes } = updateApplicationStatusSchema.parse(body);
    return this.applications.updateStatus(user.userId, id, status, notes);
  }

  @Patch(':id/notes')
  @ApiOperation({ summary: 'Actualiza las notas de una aplicación' })
  updateNotes(@CurrentUser() user: JwtUser, @Param('id') id: string, @Body() body: unknown) {
    const { notes } = applicationNotesSchema.parse(body);
    return this.applications.updateNotes(user.userId, id, notes);
  }
}
