import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { TokenService } from './token.service.js';
import { VerificationService } from './verification.service.js';

/**
 * Autenticación (Fase 1): registro, login, refresh con rotación, verificación
 * de email, reset de contraseña. Guard JWT compartido con el frontend.
 */
@Module({
  imports: [
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET ?? 'nab-dev-secret-cambia-esto',
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, TokenService, VerificationService],
  exports: [AuthService, TokenService],
})
export class AuthModule {}
