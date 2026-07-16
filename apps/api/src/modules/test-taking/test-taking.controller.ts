import { Body, Controller, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { saveTestAnswersSchema } from '@nab/shared';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { CurrentUser, type JwtUser } from '../../common/decorators/current-user.decorator.js';
import { TestTakingService } from './test-taking.service.js';

/**
 * Lado candidato: tomar la prueba técnica de una aplicación. Ownership por
 * `Application.userId` (no CompanyMemberGuard — este es el otro lado del
 * marketplace). El detalle completo con rúbrica vive en TechTestsController,
 * detrás de CompanyMemberGuard; este controller SOLO expone la vista sanitizada.
 */
@ApiTags('test-taking')
@Controller('applications/:id/test')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class TestTakingController {
  constructor(private readonly testTaking: TestTakingService) {}

  @Get()
  @ApiOperation({ summary: 'Preguntas de la prueba (sin claves ni rúbrica) + estado de la submission' })
  getTest(@CurrentUser() user: JwtUser, @Param('id') applicationId: string) {
    return this.testTaking.getTest(user.userId, applicationId);
  }

  @Post('start')
  @ApiOperation({ summary: 'Inicia la prueba (idempotente, no reinicia el cronómetro si ya empezó)' })
  start(@CurrentUser() user: JwtUser, @Param('id') applicationId: string) {
    return this.testTaking.start(user.userId, applicationId);
  }

  @Put('answers')
  @ApiOperation({ summary: 'Autosave de respuestas' })
  saveAnswers(@CurrentUser() user: JwtUser, @Param('id') applicationId: string, @Body() body: unknown) {
    const input = saveTestAnswersSchema.parse(body);
    return this.testTaking.saveAnswers(user.userId, applicationId, input);
  }

  @Post('submit')
  @ApiOperation({ summary: 'Envía la prueba (idempotente)' })
  submit(@CurrentUser() user: JwtUser, @Param('id') applicationId: string) {
    return this.testTaking.submit(user.userId, applicationId);
  }
}
