import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { jobSearchSchema } from '@nab/shared';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { CurrentUser, type JwtUser } from '../../common/decorators/current-user.decorator.js';
import { JobsService } from './jobs.service.js';

/**
 * Catálogo de vacantes (Fase 2): búsqueda con filtros y semántica, detalle,
 * guardar vacante y disparo manual de la sincronización.
 */
@ApiTags('jobs')
@Controller('jobs')
export class JobsController {
  constructor(private readonly jobs: JobsService) {}

  @Get()
  @ApiOperation({ summary: 'Busca vacantes con filtros o búsqueda semántica' })
  async list(
    @Query('query') query?: string,
    @Query('location') location?: string,
    @Query('remote') remote?: string,
    @Query('salaryMin') salaryMin?: string,
    @Query('semantic') semantic?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    const input = jobSearchSchema.parse({
      query: query || undefined,
      location: location || undefined,
      remote: remote === undefined ? undefined : remote === 'true',
      salaryMin: salaryMin ? Number(salaryMin) : undefined,
      semantic: semantic === 'true',
      cursor: cursor || undefined,
      limit: limit ? Number(limit) : undefined,
    });
    return this.jobs.search(input);
  }

  @Get('for-you')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Feed "Para ti": matching semántico perfil↔vacante' })
  forYou(@CurrentUser() user: JwtUser) {
    return this.jobs.forYou(user.userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de una vacante' })
  async detail(@Param('id') id: string) {
    const job = await this.jobs.getById(id);
    if (!job) throw new NotFoundException('Vacante no encontrada');
    // No exponemos el embedding en la respuesta.
    const { embedding: _embedding, ...rest } = job as typeof job & { embedding?: unknown };
    return rest;
  }

  @Post(':id/save')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Guarda una vacante para el usuario' })
  save(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.jobs.save(user.userId, id);
  }

  @Post('sync')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Dispara una sincronización de vacantes (dev/admin)' })
  sync() {
    return this.jobs.triggerSync();
  }
}
