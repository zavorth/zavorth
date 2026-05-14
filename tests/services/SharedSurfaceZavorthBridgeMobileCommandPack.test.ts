import { SharedSurfaceZavorthBridgeMobileCommandPack } from '../../src/domain/surface/application/shared-surface/SharedSurfaceZavorthBridgeMobileCommandPack';

function buildCtx(rawText = '/agmobile status') {
  return {
    platform: 'telegram',
    userId: 'telegram-user',
    chatId: 'telegram:chat-1',
    isGroup: false,
    rawText,
    reply: jest.fn(async () => undefined),
    editMessage: jest.fn(async () => undefined),
  };
}

function buildAccessResult(overrides: Record<string, any> = {}) {
  return {
    action: 'status',
    ok: true,
    state: 'ready',
    mode: 'lan',
    readyForRemoteUse: true,
    accessUrl: 'http://192.168.0.20:4747',
    publicUrl: null,
    localUrl: 'http://192.168.0.20:4747',
    requiresPassword: false,
    secret: null,
    lease: { active: false, expiresAt: null },
    verification: null,
    summary: 'Remoto do ZavorthBridge pronto para celular via LAN.',
    recommendations: [],
    doctorSummary: null,
    guide: {
      steps: ['Conecte o celular na mesma rede e abra o link.'],
      notes: [],
    },
    ...overrides,
  };
}

function buildPack(overrides: Record<string, any> = {}): SharedSurfaceZavorthBridgeMobileCommandPack {
  return new SharedSurfaceZavorthBridgeMobileCommandPack({
    accessService: {
      start: jest.fn(async () => buildAccessResult({ action: 'start' })),
      status: jest.fn(async () => buildAccessResult()),
      guide: jest.fn(async () => buildAccessResult({ action: 'guide' })),
      stop: jest.fn(async () => buildAccessResult({ action: 'stop', state: 'stopped' })),
      ...overrides,
    } as any,
  });
}

describe('SharedSurfaceZavorthBridgeMobileCommandPack', () => {
  it('parses natural ZavorthBridge mobile requests', () => {
    const pack = buildPack();

    expect(pack.parseNaturalIntent('preciso usar o zavorthBridge pelo celular agora')).toBe('start');
    expect(pack.parseNaturalIntent('qual o status do zavorthBridge no telefone?')).toBe('status');
    expect(pack.parseNaturalIntent('/agmobile status')).toBeNull();
  });

  it('routes status requests through the access service', async () => {
    const status = jest.fn(async () => buildAccessResult());
    const pack = buildPack({ status });
    const ctx = buildCtx('/agmobile status');

    await pack.handle(ctx as any, 'status');

    expect(status).toHaveBeenCalledTimes(1);
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('ZavorthBridge mobile'));
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('http://192.168.0.20:4747'));
  });

  it('renders start replies with secret and verified remote URL', async () => {
    const start = jest.fn(async () => buildAccessResult({
      action: 'start',
      ok: true,
      state: 'active',
      mode: 'public',
      accessUrl: 'https://ag.example.com',
      publicUrl: 'https://ag.example.com',
      requiresPassword: true,
      secret: 'mobile-secret',
      lease: { active: true, expiresAt: '2026-04-04T20:00:00.000Z' },
      verification: {
        ok: true,
        summary: 'URL final validada com HTTP 200 na rota principal.',
        targetUrl: 'https://ag.example.com',
        httpStatus: 200,
      },
      summary: 'Acesso movel do ZavorthBridge ativo via URL publica.',
      doctorSummary: 'Doctor concluiu com sucesso.',
    }));
    const pack = buildPack({ start });
    const ctx = buildCtx('preciso usar o zavorthBridge pelo celular agora');

    await pack.handle(ctx as any, 'start');

    expect(start).toHaveBeenCalledWith({ requestedBy: 'telegram-user' });
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('https://ag.example.com'));
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Senha: mobile-secret'));
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Confirmacao final: sim.'));
  });
});
