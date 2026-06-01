import { SharedSurfaceRuntimeMaintenanceCommandPack } from '../../src/domain/surface/presentation/shared-surface/SharedSurfaceRuntimeMaintenanceCommandPack';

function buildCtx(rawText = '/changes') {
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

function buildPack(overrides: Record<string, any> = {}): SharedSurfaceRuntimeMaintenanceCommandPack {
  return new SharedSurfaceRuntimeMaintenanceCommandPack({
    supervisedRuntimeService: {
      summarizeRecentChanges: jest.fn(() => 'Mudancas recentes do Zavorth'),
      requestReload: jest.fn(async () => ({
        accepted: true,
        summary: 'Reload supervisionado aceito.',
        requestId: 'reload-1',
      })),
    } as any,
    autoRepairService: {
      summarizeLastRun: jest.fn(() => 'Ultimo autoreparo: healthy.'),
      run: jest.fn(async () => ({
        success: true,
        status: 'dry_run',
        summary: 'Plano de autoreparo montado.',
        report: {},
      })),
    } as any,
    renderHelp: jest.fn(() => 'Ajuda operacional do Zavorth'),
    ...overrides,
  });
}

describe('SharedSurfaceRuntimeMaintenanceCommandPack', () => {
  it('renders recent changes through /changes', async () => {
    const summarizeRecentChanges = jest.fn(() => 'Mudancas recentes do Zavorth');
    const pack = buildPack({
      supervisedRuntimeService: {
        summarizeRecentChanges,
        requestReload: jest.fn(),
      } as any,
    });
    const ctx = buildCtx('/changes');

    const handled = await pack.maybeHandle(ctx as any, '/changes', '');

    expect(handled).toBe(true);
    expect(summarizeRecentChanges).toHaveBeenCalledTimes(1);
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Mudancas recentes do Zavorth'));
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('shared-runtime-changes'));
  });

  it('requests a forced reload through /selfupdate force', async () => {
    const requestReload = jest.fn(async () => ({
      accepted: true,
      summary: 'Reload supervisionado forcado aceito.',
      requestId: 'reload-1',
    }));
    const pack = buildPack({
      supervisedRuntimeService: {
        summarizeRecentChanges: jest.fn(),
        requestReload,
      } as any,
    });
    const ctx = buildCtx('/reload force');

    const handled = await pack.maybeHandle(ctx as any, '/selfupdate', 'force');

    expect(handled).toBe(true);
    expect(requestReload).toHaveBeenCalledWith(expect.objectContaining({
      forceRestart: true,
      requestedBy: 'telegram-user',
      notifyChatId: 'telegram:chat-1',
    }));
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Reload supervisionado forcado aceito.'));
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('shared-runtime-reload-reload-1'));
  });

  it('shows the last autorepair summary through /autorepair status', async () => {
    const summarizeLastRun = jest.fn(() => 'Ultimo autoreparo: healthy.');
    const pack = buildPack({
      autoRepairService: {
        summarizeLastRun,
        run: jest.fn(),
      } as any,
    });
    const ctx = buildCtx('/autorepair status');

    const handled = await pack.maybeHandle(ctx as any, '/autorepair', 'status');

    expect(handled).toBe(true);
    expect(summarizeLastRun).toHaveBeenCalledTimes(1);
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Ultimo autoreparo: healthy.'));
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('shared-autorepair-status'));
  });

  it('runs an autorepair dry run with the expected operator preface', async () => {
    const run = jest.fn(async () => ({
      success: true,
      status: 'dry_run',
      summary: 'Plano de autoreparo montado.',
      report: {},
    }));
    const pack = buildPack({
      autoRepairService: {
        summarizeLastRun: jest.fn(),
        run,
      } as any,
    });
    const ctx = buildCtx('/autorepair dryrun');

    const handled = await pack.maybeHandle(ctx as any, '/autorepair', 'dryrun');

    expect(handled).toBe(true);
    expect(run).toHaveBeenCalledWith(expect.objectContaining({
      dryRun: true,
      force: false,
      goal: 'auto',
      requestedBy: 'telegram-user',
    }));
    expect(ctx.reply).toHaveBeenNthCalledWith(1, 'Montando um plano seguro de autoreparo agora.');
    expect(ctx.reply).toHaveBeenNthCalledWith(2, expect.stringContaining('Plano de autoreparo montado.'));
    expect(ctx.reply).toHaveBeenNthCalledWith(2, expect.stringContaining('shared-autorepair-dry_run'));
  });

  it('handles natural runtime maintenance intents through the same pack', async () => {
    const requestReload = jest.fn(async () => ({
      accepted: true,
      summary: 'Reload natural aceito.',
      requestId: 'reload-natural',
    }));
    const pack = buildPack({
      supervisedRuntimeService: {
        summarizeRecentChanges: jest.fn(),
        requestReload,
      } as any,
    });
    const ctx = buildCtx('reinicie o zavorth');

    await pack.handleRuntimeMaintenanceIntent(ctx as any, {
      action: 'reload',
      force: true,
      dryRun: false,
      improve: false,
    });

    expect(requestReload).toHaveBeenCalledWith(expect.objectContaining({
      forceRestart: true,
    }));
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Reload natural aceito.'));
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('shared-runtime-reload-reload-natural'));
  });

  it('ignores unrelated commands', async () => {
    const pack = buildPack();
    const ctx = buildCtx('/platform');

    const handled = await pack.maybeHandle(ctx as any, '/platform', '');

    expect(handled).toBe(false);
    expect(ctx.reply).not.toHaveBeenCalled();
  });
});
