import type { JwtUser } from '../common/decorators/current-user.decorator.js';

// Adjunta el usuario autenticado a la Request de Express (lo pone el JwtAuthGuard).
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: JwtUser;
    }
  }
}

export {};
