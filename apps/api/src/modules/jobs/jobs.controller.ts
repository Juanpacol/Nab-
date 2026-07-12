import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { PrismaService } from '../../prisma/prisma.service.js';

/**
 * Endpoint de vacantes. En Fase 0 expone un listado básico sobre los datos
 * demo sembrados, para validar el flujo end-to-end (DB → API → web).
 * La búsqueda avanzada y semántica se añade en la Fase 2.
 */
@ApiTags('jobs')
@Controller('jobs')
export class JobsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'Lista vacantes activas (paginación simple)' })
  async list(@Query('limit') limit = '20') {
    const take = Math.min(Number(limit) || 20, 50);
    const jobs = await this.prisma.job.findMany({
      where: { isActive: true },
      orderBy: { postedAt: 'desc' },
      take,
      select: {
        id: true,
        title: true,
        company: true,
        companyLogoUrl: true,
        location: true,
        remote: true,
        salaryMin: true,
        salaryMax: true,
        currency: true,
        postedAt: true,
      },
    });
    return { data: jobs, count: jobs.length };
  }
}
