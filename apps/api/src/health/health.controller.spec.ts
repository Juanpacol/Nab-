import { describe, it, expect } from 'vitest';
import { HealthController } from './health.controller.js';

describe('HealthController', () => {
  it('devuelve estado ok en /health', () => {
    // El endpoint de liveness no depende de Prisma.
    const controller = new HealthController({} as never);
    const result = controller.health();
    expect(result.status).toBe('ok');
    expect(result.service).toBe('nab-api');
  });
});
