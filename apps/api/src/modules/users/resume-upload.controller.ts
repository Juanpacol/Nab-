import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { QUEUE_NAMES } from '@nab/shared';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { CurrentUser, type JwtUser } from '../../common/decorators/current-user.decorator.js';
import { StorageService } from '../../storage/storage.service.js';

interface UploadedFileLike {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

/**
 * Subida de CV (Fase 1): guarda el PDF en S3/MinIO y encola su parsing por IA.
 * El worker extrae el texto, llama a la IA (o mock) y prellena el perfil.
 */
@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users/me/resume')
export class ResumeUploadController {
  constructor(
    private readonly storage: StorageService,
    @InjectQueue(QUEUE_NAMES.AI_GENERATION) private readonly aiQueue: Queue,
  ) {}

  @Post('upload')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Sube un CV en PDF y encola el parsing por IA' })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 8 * 1024 * 1024 } }))
  async upload(@CurrentUser() user: JwtUser, @UploadedFile() file?: UploadedFileLike) {
    if (!file) throw new BadRequestException('No se recibió ningún archivo');
    if (file.mimetype !== 'application/pdf') {
      throw new BadRequestException('El CV debe ser un PDF');
    }
    // El mimetype lo declara el cliente (spoofable) — confirmamos el contenido
    // real revisando la cabecera del archivo ("%PDF-"), no solo el header HTTP.
    if (file.buffer.subarray(0, 5).toString('latin1') !== '%PDF-') {
      throw new BadRequestException('El archivo no es un PDF válido');
    }

    const key = await this.storage.upload(
      `resumes/${user.userId}`,
      file.originalname,
      file.buffer,
      file.mimetype,
    );

    await this.aiQueue.add('parse-cv', { userId: user.userId, key });

    return { status: 'processing', key };
  }
}
