import { Module } from '@nestjs/common';
import { UsersController } from './users.controller.js';
import { ResumeUploadController } from './resume-upload.controller.js';
import { UsersService } from './users.service.js';
import { AuthModule } from '../auth/auth.module.js';

/**
 * Usuarios y perfil profesional (Fase 1): CRUD de perfil, ajustes de cuenta,
 * cambio de contraseña y subida/parsing de CV.
 */
@Module({
  imports: [AuthModule],
  controllers: [UsersController, ResumeUploadController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
