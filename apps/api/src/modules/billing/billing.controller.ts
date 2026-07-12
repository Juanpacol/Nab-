import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiExcludeEndpoint } from '@nestjs/swagger';
import { checkoutSchema } from '@nab/shared';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { CurrentUser, type JwtUser } from '../../common/decorators/current-user.decorator.js';
import { BillingService } from './billing.service.js';

/**
 * Facturación (Fase 6): Stripe Checkout (suscripción), Customer Portal y
 * webhooks (alta/renovación/cancelación con créditos vía CreditLedger).
 */
@ApiTags('billing')
@Controller('billing')
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Post('checkout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Crea una Checkout Session de Stripe para suscribirse a un plan' })
  checkout(@CurrentUser() user: JwtUser, @Body() body: unknown) {
    const { planId } = checkoutSchema.parse(body);
    return this.billing.createCheckoutSession(user.userId, planId);
  }

  @Post('portal')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Crea una sesión del Customer Portal de Stripe' })
  portal(@CurrentUser() user: JwtUser) {
    return this.billing.createPortalSession(user.userId);
  }

  @Get('subscription')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Suscripción actual del usuario' })
  async subscription(@CurrentUser() user: JwtUser) {
    return { subscription: await this.billing.getSubscription(user.userId) };
  }

  @Post('webhook')
  @ApiExcludeEndpoint()
  async webhook(@Req() req: RawBodyRequest<Request>, @Headers('stripe-signature') signature?: string) {
    if (!req.rawBody || !signature) throw new BadRequestException('Solicitud de webhook inválida');
    await this.billing.handleWebhook(req.rawBody, signature);
    return { received: true };
  }
}
