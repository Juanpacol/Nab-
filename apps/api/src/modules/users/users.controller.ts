import { Body, Controller, Get, Patch, Put, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import {
  profileSchema,
  updateAccountSchema,
  changePasswordSchema,
  pushTokenSchema,
  type ProfileInput,
  type UpdateAccountInput,
  type ChangePasswordInput,
  type PushTokenInput,
} from '@nab/shared';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { CurrentUser, type JwtUser } from '../../common/decorators/current-user.decorator.js';
import { UsersService } from './users.service.js';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users/me')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('profile')
  @ApiOperation({ summary: 'Perfil profesional del usuario' })
  getProfile(@CurrentUser() user: JwtUser) {
    return this.users.getProfile(user.userId);
  }

  @Put('profile')
  @ApiOperation({ summary: 'Crea o actualiza el perfil profesional' })
  upsertProfile(
    @CurrentUser() user: JwtUser,
    @Body(new ZodValidationPipe(profileSchema)) body: ProfileInput,
  ) {
    return this.users.upsertProfile(user.userId, body);
  }

  @Patch('account')
  @ApiOperation({ summary: 'Actualiza nombre y avatar' })
  updateAccount(
    @CurrentUser() user: JwtUser,
    @Body(new ZodValidationPipe(updateAccountSchema)) body: UpdateAccountInput,
  ) {
    return this.users.updateAccount(user.userId, body);
  }

  @Patch('password')
  @ApiOperation({ summary: 'Cambia la contraseña' })
  async changePassword(
    @CurrentUser() user: JwtUser,
    @Body(new ZodValidationPipe(changePasswordSchema)) body: ChangePasswordInput,
  ) {
    await this.users.changePassword(user.userId, body.currentPassword, body.newPassword);
    return { ok: true };
  }

  @Get('credits')
  @ApiOperation({ summary: 'Saldo de créditos (desde el ledger)' })
  async credits(@CurrentUser() user: JwtUser) {
    return { credits: await this.users.getCreditBalance(user.userId) };
  }

  @Put('push-token')
  @ApiOperation({ summary: 'Registra el token de Expo Notifications del dispositivo (app móvil)' })
  async setPushToken(
    @CurrentUser() user: JwtUser,
    @Body(new ZodValidationPipe(pushTokenSchema)) body: PushTokenInput,
  ) {
    await this.users.setPushToken(user.userId, body.token);
    return { ok: true };
  }
}
