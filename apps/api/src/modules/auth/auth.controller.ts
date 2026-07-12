import { Body, Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  registerSchema,
  loginSchema,
  refreshSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  verifyEmailSchema,
  type RegisterInput,
  type LoginInput,
} from '@nab/shared';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { CurrentUser, type JwtUser } from '../../common/decorators/current-user.decorator.js';
import { AuthService } from './auth.service.js';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Crea una cuenta y devuelve tokens' })
  register(@Body(new ZodValidationPipe(registerSchema)) body: RegisterInput) {
    return this.auth.register(body);
  }

  @Post('login')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Inicia sesión' })
  login(@Body(new ZodValidationPipe(loginSchema)) body: LoginInput) {
    return this.auth.login(body);
  }

  @Post('refresh')
  @HttpCode(200)
  @ApiOperation({ summary: 'Rota el refresh token y emite un par nuevo' })
  async refresh(@Body(new ZodValidationPipe(refreshSchema)) body: { refreshToken: string }) {
    const tokens = await this.auth.refresh(body.refreshToken);
    return { tokens };
  }

  @Post('logout')
  @HttpCode(204)
  @ApiOperation({ summary: 'Revoca el refresh token' })
  async logout(@Body(new ZodValidationPipe(refreshSchema)) body: { refreshToken: string }) {
    await this.auth.logout(body.refreshToken);
  }

  @Post('verify-email')
  @HttpCode(200)
  @ApiOperation({ summary: 'Verifica el correo con el token del enlace' })
  async verifyEmail(@Body(new ZodValidationPipe(verifyEmailSchema)) body: { token: string }) {
    await this.auth.verifyEmail(body.token);
    return { ok: true };
  }

  @Post('forgot-password')
  @HttpCode(202)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Envía un enlace de reseteo (si el correo existe)' })
  async forgot(@Body(new ZodValidationPipe(forgotPasswordSchema)) body: { email: string }) {
    await this.auth.forgotPassword(body.email);
    return { ok: true };
  }

  @Post('reset-password')
  @HttpCode(200)
  @ApiOperation({ summary: 'Restablece la contraseña con el token' })
  async reset(
    @Body(new ZodValidationPipe(resetPasswordSchema)) body: { token: string; password: string },
  ) {
    await this.auth.resetPassword(body.token, body.password);
    return { ok: true };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Devuelve el usuario autenticado' })
  me(@CurrentUser() user: JwtUser) {
    return this.auth.toAuthUser(user.userId);
  }
}
