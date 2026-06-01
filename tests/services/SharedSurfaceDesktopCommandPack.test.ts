import { SharedSurfaceDesktopCommandPack } from '../../src/domain/surface/presentation/shared-surface/SharedSurfaceDesktopCommandPack';

function buildCtx(rawText = '/doctor desktop') {
  return {
    platform: 'telegram',
    userId: 'telegram-user',
    chatId: 'telegram:chat-1',
    threadId: null,
    channelId: null,
    isGroup: false,
    rawText,
    reply: jest.fn(async () => undefined),
    editMessage: jest.fn(async () => undefined),
  };
}

function buildModeSnapshot(overrides: Record<string, any> = {}) {
  return {
    id: 'operator',
    label: 'Operator Mode',
    summary: 'Modo operacional completo.',
    defaultRuntimeProfile: 'ops',
    runtimeProfile: 'ops',
    profileAligned: true,
    visibleSurfaces: ['chat', 'control'],
    hiddenByDefault: ['companions'],
    escalationTargets: ['builder'],
    commands: {
      show: '/mode',
      set: '/mode <chat|assistant|builder|operator>',
      cliStatus: 'npm run mode:status',
      cliSet: 'npm run mode:set',
    },
    ...overrides,
  };
}

function buildPack(overrides: Record<string, any> = {}): SharedSurfaceDesktopCommandPack {
  return new SharedSurfaceDesktopCommandPack({
    desktopResourcePlaneService: {
      inspectLive: jest.fn(async () => ({ status: 'healthy' })),
      renderReport: jest.fn(() => 'Desktop Resource Plane\n\nRAM, CPU e Docker revisados.'),
    } as any,
    capabilityLifecycleService: {
      buildProductModeSnapshot: jest.fn(() => buildModeSnapshot()),
      setProductMode: jest.fn(() => buildModeSnapshot({ id: 'builder', label: 'Builder Mode' })),
    } as any,
    companionControlService: {
      buildSnapshot: jest.fn(async () => ({ companions: [{ id: 'docker-desktop' }] })),
      inspectCompanion: jest.fn(async () => ({ id: 'docker-desktop', status: 'idle' })),
      executeAction: jest.fn(async () => ({ ok: true })),
      renderSnapshot: jest.fn(() => 'Companion Control Plane\n\nDocker Desktop ativo.'),
      renderCompanion: jest.fn(() => 'Docker Desktop\n\nStatus: idle.'),
      renderActionResult: jest.fn(() => 'Companion action aplicada.'),
    } as any,
    workspaceOptimizerService: {
      buildLoadProfile: jest.fn(async () => ({ workspaceName: 'Zavorth' })),
      previewOptimization: jest.fn(async () => ({ mutationPlan: { id: 'plan-workspace-1' } })),
      applyOptimization: jest.fn(async () => ({ applied: true })),
      renderLoadProfile: jest.fn(() => 'Workspace Doctor: Zavorth'),
      renderPreview: jest.fn(() => 'Workspace Optimize Preview: Zavorth'),
      renderApplyResult: jest.fn(() => 'Workspace Optimize Apply: Zavorth'),
    } as any,
    modeEscalationService: {
      buildSnapshot: jest.fn(() => null),
      resolveRequest: jest.fn(() => ({
        summary: 'Mode escalation aprovado.',
        grant: { targetMode: 'builder', scope: 'session' },
        snapshot: { effectiveMode: { id: 'builder' } },
        request: { fallback: null },
      })),
    } as any,
    ...overrides,
  });
}

describe('SharedSurfaceDesktopCommandPack', () => {
  it('renders the desktop doctor report', async () => {
    const inspectLive = jest.fn(async () => ({ status: 'healthy' }));
    const renderReport = jest.fn(() => 'Desktop Resource Plane\n\nTudo pronto.');
    const pack = buildPack({
      desktopResourcePlaneService: { inspectLive, renderReport } as any,
    });
    const ctx = buildCtx('/doctor desktop');

    await pack.handleDoctor(ctx as any, 'desktop');

    expect(inspectLive).toHaveBeenCalledWith({ preferCachedWithinMs: 15_000 });
    expect(renderReport).toHaveBeenCalledWith({ status: 'healthy' });
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Desktop Resource Plane'));
  });

  it('renders and updates product mode', async () => {
    const buildProductModeSnapshot = jest.fn(() => buildModeSnapshot());
    const setProductMode = jest.fn(() => buildModeSnapshot({ id: 'builder', label: 'Builder Mode' }));
    const pack = buildPack({
      capabilityLifecycleService: { buildProductModeSnapshot, setProductMode } as any,
    });
    const showCtx = buildCtx('/mode');
    const setCtx = buildCtx('/mode builder');

    await pack.handleProductMode(showCtx as any, '');
    await pack.handleProductMode(setCtx as any, 'builder');

    expect(buildProductModeSnapshot).toHaveBeenCalledTimes(1);
    expect(showCtx.reply).toHaveBeenCalledWith(expect.stringContaining('Operator Mode'));
    expect(setProductMode).toHaveBeenCalledWith('builder', 'telegram-user');
    expect(setCtx.reply).toHaveBeenCalledWith(expect.stringContaining('Builder Mode'));
  });

  it('renders workspace doctor and optimization preview', async () => {
    const buildLoadProfile = jest.fn(async () => ({ workspaceName: 'Zavorth' }));
    const previewOptimization = jest.fn(async () => ({ mutationPlan: { id: 'plan-workspace-1' } }));
    const pack = buildPack({
      workspaceOptimizerService: {
        buildLoadProfile,
        previewOptimization,
        applyOptimization: jest.fn(),
        renderLoadProfile: jest.fn(() => 'Workspace Doctor: Zavorth'),
        renderPreview: jest.fn(() => 'Workspace Optimize Preview: Zavorth'),
        renderApplyResult: jest.fn(),
      } as any,
    });
    const doctorCtx = buildCtx('/workspace doctor');
    const optimizeCtx = buildCtx('/workspace optimize zavorthBridge');

    await pack.handleWorkspace(doctorCtx as any, 'doctor');
    await pack.handleWorkspace(optimizeCtx as any, 'optimize zavorthBridge --workspace C:/workspace/demo');

    expect(buildLoadProfile).toHaveBeenCalledWith({ workspaceHint: null });
    expect(previewOptimization).toHaveBeenCalledWith(expect.objectContaining({
      presetId: 'zavorthBridge',
      workspaceHint: 'C:/workspace/demo',
      requestedBy: 'telegram-user',
      sourceSurface: 'telegram',
    }));
    expect(doctorCtx.reply).toHaveBeenCalledWith(expect.stringContaining('Workspace Doctor'));
    expect(optimizeCtx.reply).toHaveBeenCalledWith(expect.stringContaining('Workspace Optimize Preview'));
  });

  it('renders companion list and inspection', async () => {
    const buildSnapshot = jest.fn(async () => ({ companions: [{ id: 'docker-desktop' }] }));
    const inspectCompanion = jest.fn(async () => ({ id: 'docker-desktop', status: 'idle' }));
    const pack = buildPack({
      companionControlService: {
        buildSnapshot,
        inspectCompanion,
        executeAction: jest.fn(),
        renderSnapshot: jest.fn(() => 'Companion Control Plane\n\nDocker Desktop ativo.'),
        renderCompanion: jest.fn(() => 'Docker Desktop\n\nStatus: idle.'),
        renderActionResult: jest.fn(),
      } as any,
    });
    const listCtx = buildCtx('/companion list');
    const inspectCtx = buildCtx('/companion inspect docker-desktop');

    await pack.handleCompanion(listCtx as any, 'list');
    await pack.handleCompanion(inspectCtx as any, 'inspect docker-desktop');

    expect(buildSnapshot).toHaveBeenCalledWith({ preferCachedWithinMs: 15_000 });
    expect(inspectCompanion).toHaveBeenCalledWith('docker-desktop', { preferCachedWithinMs: 15_000 });
    expect(listCtx.reply).toHaveBeenCalledWith(expect.stringContaining('Companion Control Plane'));
    expect(inspectCtx.reply).toHaveBeenCalledWith(expect.stringContaining('Docker Desktop'));
  });
});
