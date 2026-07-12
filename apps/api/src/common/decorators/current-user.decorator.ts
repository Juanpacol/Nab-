import { createParamDecorator, type ExecutionContext } from '@nestjs/common';

/** Payload que el JwtAuthGuard adjunta a request.user. */
export interface JwtUser {
  userId: string;
  email: string;
}

/** Inyecta el usuario autenticado: @CurrentUser() user: JwtUser */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): JwtUser => {
    const request = ctx.switchToHttp().getRequest();
    return request.user as JwtUser;
  },
);
