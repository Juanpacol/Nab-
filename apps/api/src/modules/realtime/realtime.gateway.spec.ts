import { describe, expect, it, vi } from 'vitest';
import { RealtimeGateway } from './realtime.gateway.js';

function fakeSocket(token?: string) {
  return {
    handshake: { auth: token ? { token } : {}, headers: {} },
    data: {} as Record<string, unknown>,
    join: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn(),
  } as any;
}

describe('RealtimeGateway.handleConnection', () => {
  it('une al socket a su sala de usuario y a la sala de cada empresa de la que es miembro', async () => {
    const jwt = { verifyAsync: vi.fn().mockResolvedValue({ sub: 'user-1' }) };
    const prisma = {
      companyMember: {
        findMany: vi.fn().mockResolvedValue([{ companyId: 'company-1' }, { companyId: 'company-2' }]),
      },
    };
    const gateway = new RealtimeGateway(jwt as any, prisma as any);
    const client = fakeSocket('token-válido');

    await gateway.handleConnection(client);

    expect(client.join).toHaveBeenCalledWith('user:user-1');
    expect(client.join).toHaveBeenCalledWith('company:company-1');
    expect(client.join).toHaveBeenCalledWith('company:company-2');
    expect(client.disconnect).not.toHaveBeenCalled();
  });

  it('un usuario sin membresías solo se une a su sala de usuario', async () => {
    const jwt = { verifyAsync: vi.fn().mockResolvedValue({ sub: 'user-1' }) };
    const prisma = { companyMember: { findMany: vi.fn().mockResolvedValue([]) } };
    const gateway = new RealtimeGateway(jwt as any, prisma as any);
    const client = fakeSocket('token-válido');

    await gateway.handleConnection(client);

    expect(client.join).toHaveBeenCalledTimes(1);
    expect(client.join).toHaveBeenCalledWith('user:user-1');
  });

  it('desconecta si falta el token', async () => {
    const jwt = { verifyAsync: vi.fn() };
    const prisma = { companyMember: { findMany: vi.fn() } };
    const gateway = new RealtimeGateway(jwt as any, prisma as any);
    const client = fakeSocket();

    await gateway.handleConnection(client);

    expect(client.disconnect).toHaveBeenCalled();
    expect(jwt.verifyAsync).not.toHaveBeenCalled();
  });

  it('desconecta si el JWT es inválido', async () => {
    const jwt = { verifyAsync: vi.fn().mockRejectedValue(new Error('expirado')) };
    const prisma = { companyMember: { findMany: vi.fn() } };
    const gateway = new RealtimeGateway(jwt as any, prisma as any);
    const client = fakeSocket('token-vencido');

    await gateway.handleConnection(client);

    expect(client.disconnect).toHaveBeenCalled();
  });
});

describe('RealtimeGateway.emitToCompany', () => {
  it('emite al room company:{id}', () => {
    const jwt = { verifyAsync: vi.fn() };
    const prisma = { companyMember: { findMany: vi.fn() } };
    const gateway = new RealtimeGateway(jwt as any, prisma as any);
    const emit = vi.fn();
    (gateway as any).server = { to: vi.fn().mockReturnValue({ emit }) };

    gateway.emitToCompany('company-1', 'applicant.new', { applicationId: 'app-1' });

    expect((gateway as any).server.to).toHaveBeenCalledWith('company:company-1');
    expect(emit).toHaveBeenCalledWith('applicant.new', { applicationId: 'app-1' });
  });
});
