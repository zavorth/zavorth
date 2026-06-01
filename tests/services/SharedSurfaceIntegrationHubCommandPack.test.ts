import { SharedSurfaceIntegrationHubCommandPack } from '../../src/domain/surface/presentation/shared-surface/SharedSurfaceIntegrationHubCommandPack';

function buildCtx(rawText = '/integrations') {
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

function buildPack(overrides: Record<string, any> = {}): SharedSurfaceIntegrationHubCommandPack {
  return new SharedSurfaceIntegrationHubCommandPack({
    integrationHubService: {
      renderCatalogReport: jest.fn(() => 'Catalogo de integracoes do Zavorth'),
      renderManifestReport: jest.fn(() => 'Manifesto da integracao Discord'),
      renderConnectReport: jest.fn(() => 'Conexao guiada com Discord'),
    } as any,
    ...overrides,
  });
}

describe('SharedSurfaceIntegrationHubCommandPack', () => {
  it('renders the integrations catalog without arguments', async () => {
    const renderCatalogReport = jest.fn(() => 'Catalogo de integracoes do Zavorth');
    const pack = buildPack({
      integrationHubService: {
        renderCatalogReport,
        renderManifestReport: jest.fn(),
        renderConnectReport: jest.fn(),
      } as any,
    });
    const ctx = buildCtx('/integrations');

    const handled = await pack.maybeHandle(ctx as any, '/integrations', '');

    expect(handled).toBe(true);
    expect(renderCatalogReport).toHaveBeenCalledTimes(1);
    expect(ctx.reply).toHaveBeenCalledWith('Catalogo de integracoes do Zavorth');
  });

  it('renders an integration manifest when a target is provided', async () => {
    const renderManifestReport = jest.fn(() => 'Manifesto da integracao Discord');
    const pack = buildPack({
      integrationHubService: {
        renderCatalogReport: jest.fn(),
        renderManifestReport,
        renderConnectReport: jest.fn(),
      } as any,
    });
    const ctx = buildCtx('/integrations discord');

    const handled = await pack.maybeHandle(ctx as any, '/integrations', 'discord');

    expect(handled).toBe(true);
    expect(renderManifestReport).toHaveBeenCalledWith('discord');
    expect(ctx.reply).toHaveBeenCalledWith('Manifesto da integracao Discord');
  });

  it('starts a guided connection with an explicit mode', async () => {
    const renderConnectReport = jest.fn(() => 'Conexao guiada com Discord');
    const pack = buildPack({
      integrationHubService: {
        renderCatalogReport: jest.fn(),
        renderManifestReport: jest.fn(),
        renderConnectReport,
      } as any,
    });
    const ctx = buildCtx('/connect discord docker');

    const handled = await pack.maybeHandle(ctx as any, '/connect', 'discord docker');

    expect(handled).toBe(true);
    expect(renderConnectReport).toHaveBeenCalledWith({
      requestedId: 'discord',
      requestedBy: 'telegram-user',
      selectedMode: 'docker',
      persist: true,
    });
    expect(ctx.reply).toHaveBeenCalledWith('Conexao guiada com Discord');
  });

  it('shows usage when /connect has no integration target', async () => {
    const pack = buildPack();
    const ctx = buildCtx('/connect');

    const handled = await pack.maybeHandle(ctx as any, '/connect', '');

    expect(handled).toBe(true);
    expect(ctx.reply).toHaveBeenCalledWith(
      'Use /connect <integracao>. Exemplos: /connect discord, /connect slack, /connect whatsapp, /connect openrouter.',
    );
  });

  it('ignores unrelated commands', async () => {
    const pack = buildPack();
    const ctx = buildCtx('/changes');

    const handled = await pack.maybeHandle(ctx as any, '/changes', '');

    expect(handled).toBe(false);
    expect(ctx.reply).not.toHaveBeenCalled();
  });
});
