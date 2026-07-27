import { SharedSurfaceGatewayToolingCommandPack } from '../../src/domain/surface/presentation/shared-surface/SharedSurfaceGatewayToolingCommandPack';

function buildCtx(rawText = '/gateway') {
  return {
    platform: 'telegram',
    userId: 'telegram-user',
    chatId: 'telegram:chat-1',
    isGroup: false,
    rawText,
    reply: jest.fn(async () => undefined),
    editMessage: jest.fn(async () => undefined)};
}

function buildPack(overrides: Record<string, any> = {}): SharedSurfaceGatewayToolingCommandPack {
  return new SharedSurfaceGatewayToolingCommandPack({
    AIGatewayGatewayService: {
      readStatus: jest.fn(() => ({
        enabled: true,
        ready: true,
        running: true,
        baseUrl: 'http://127.0.0.1:21128/v1',
        upstreamBaseUrl: 'http://127.0.0.1:20128/v1',
        overlayFile: 'C:/repo/config/AIGateway-overlay.json',
        message: 'Gateway own do AIGateway active.'}))} as any,
    AIGatewayGatewayLauncherService: {
      ensureStarted: jest.fn(async () => ({
        enabled: true,
        ready: true,
        running: true,
        baseUrl: 'http://127.0.0.1:21128/v1',
        upstreamBaseUrl: 'http://127.0.0.1:20128/v1',
        overlayFile: 'C:/repo/config/AIGateway-overlay.json',
        message: 'Gateway own do AIGateway active.'}))} as any,
    GatewayCompatibilityDoctorService: {
      run: jest.fn(async () => ({
        ok: true,
        summary: 'Compatibilidade validada.',
        status: 'passed',
        baseUrl: 'http://127.0.0.1:21128/v1',
        checkedTarget: '/v1/models',
        httpStatus: 200,
        error: null}))} as any,
    GatewayUpstreamSyncService: {
      sync: jest.fn(async () => ({
        action: 'sync',
        summary: 'Sync aplicado.',
        status: 'applied',
        compat: { status: 'ready' },
        rollbackApplied: false,
        error: null})),
      promote: jest.fn(),
      rollback: jest.fn()} as any,
    gatewayService: {
      buildHydratedSnapshot: jest.fn(async () => ({
        summary: {
          channelsReady: 2,
          channelsTotal: 4,
          runtimeModesReady: 3,
          teams: 3,
          nodesPaired: 1,
          sessionTargets: 2,
          toolFamilies: 8,
          plugins: 4,
          memoryArtifacts: 2},
        narrative: {
          headline: 'Gateway ready.',
          operatorSummary: 'Canonical snapshot.'}}))} as any,
    toolSurfaceService: {
      buildSnapshot: jest.fn(() => ({
        summary: {
          families: 6,
          ready: 4,
          partial: 1,
          planned: 1,
          explicitTools: 17},
        families: [
          {
            label: 'Session tools',
            summary: 'Listagem, history, envio e spawn de session.'}],
        catalog: {
          entries: [
            {
              id: 'read_file',
              label: 'read_file',
              familyLabel: 'Runtime Tools',
              kind: 'runtime-tool',
              readiness: 'ready',
              summary: 'Le um file do workspace.',
              command: null,
              details: ['1 parametro(s).']}],
          selected: null},
        narrative: {
          headline: 'Official tool plan.',
          operatorSummary: '4 familias ready.'}}))} as any,
    hookPlaneService: {
      buildSnapshot: jest.fn(() => ({
        summary: {
          supportedEvents: 12,
          coveredEvents: 3,
          registeredHooks: 3,
          workspaces: 2},
        events: [
          {
            id: 'transport.before_action',
            label: 'Antes do transporte',
            stage: 'transport',
            description: 'Valida transporte remoto.',
            status: 'ready',
            registeredHooks: 2}],
        registrations: [
          {
            workspace: 'workspace-alpha',
            workspaceName: 'Workspace Alpha',
            event: 'transport.before_action',
            command: 'npm run hooks:transport:before'}],
        narrative: {
          headline: 'Official hook plan.',
          operatorSummary: '3 hooks registrados.'}}))} as any,
    zavorthBridgePreferenceStore: {
      getPreferredModel: jest.fn(async () => 'gemini-2.5-pro')} as any,
    discordSurfacePolicyService: {
      canUseOperationalCommand: jest.fn(() => true)} as any,
    providerDoctorService: {
      renderStatusReport: jest.fn(() => 'Providers ready now\nRecommended profile for this stage')} as any,
    providerControlPlaneService: {
      getUsageTargets: jest.fn(() => ['chat', 'code'])} as any,
    ...overrides});
}

describe('SharedSurfaceGatewayToolingCommandPack', () => {
  it('starts the Zavorth-owned AIGateway route', async () => {
    const ensureStarted = jest.fn(async () => ({
      enabled: true,
      ready: true,
      running: true,
      baseUrl: 'http://127.0.0.1:21128/v1',
      upstreamBaseUrl: 'http://127.0.0.1:20128/v1',
      overlayFile: 'C:/repo/config/AIGateway-overlay.json',
      message: 'Gateway own do AIGateway active.'}));
    const pack = buildPack({
      AIGatewayGatewayLauncherService: { ensureStarted } as any});
    const ctx = buildCtx('/AIGateway start');

    await pack.handleAIGateway(ctx as any, 'start');

    expect(ensureStarted).toHaveBeenCalledTimes(1);
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('http://127.0.0.1:21128/v1'));
  });

  it('renders the hydrated gateway snapshot', async () => {
    const buildHydratedSnapshot = jest.fn(async () => ({
      summary: {
        channelsReady: 2,
        channelsTotal: 4,
        runtimeModesReady: 3,
        teams: 3,
        nodesPaired: 1,
        sessionTargets: 2,
        toolFamilies: 8,
        plugins: 4,
        memoryArtifacts: 2},
      narrative: {
        headline: 'Gateway ready.',
        operatorSummary: 'Canonical snapshot.'}}));
    const pack = buildPack({
      gatewayService: { buildHydratedSnapshot } as any});
    const ctx = buildCtx('/gateway');

    await pack.handleGateway(ctx as any);

    expect(buildHydratedSnapshot).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'telegram-user',
      chatId: 'telegram:chat-1'}));
    expect(ctx.reply.mock.calls[0][0]).toContain('Zavorth Gateway');
    expect(ctx.reply.mock.calls[0][0]).toContain('Gateway ready.');
    expect(ctx.reply.mock.calls[0][1]).toEqual(expect.objectContaining({
      reply_markup: expect.any(Object)}));
  });

  it('renders focused tools with query context', async () => {
    const buildSnapshot = jest.fn(() => ({
      summary: {
        families: 6,
        ready: 4,
        partial: 1,
        planned: 1,
        explicitTools: 17},
      families: [],
      catalog: {
        entries: [
          {
            id: 'read_file',
            label: 'read_file',
            familyLabel: 'Runtime Tools',
            kind: 'runtime-tool',
            readiness: 'ready',
            summary: 'Le um file do workspace.',
            command: null,
            details: ['1 parametro(s).']}],
        selected: {
          id: 'read_file',
          label: 'read_file',
          familyLabel: 'Runtime Tools',
          kind: 'runtime-tool',
          readiness: 'ready',
          summary: 'Le um file do workspace.',
          command: null,
          details: ['1 parametro(s).']}},
      narrative: {
        headline: 'Tool surface with 1 visible item.',
        operatorSummary: 'Item em foco.'}});
    const pack = buildPack({
      toolSurfaceService: { buildSnapshot } as any});
    const ctx = buildCtx('/tools read_file');

    await pack.handleTools(ctx as any, 'read_file');

    expect(buildSnapshot).toHaveBeenCalledWith(expect.objectContaining({
      query: 'read_file',
      selectedId: 'read_file'}));
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('In focus: read_file'));
  });

  it('renders hook plane filters', async () => {
    const pack = buildPack();
    const ctx = buildCtx('/hooks transport');

    await pack.handleHooks(ctx as any, 'transport');

    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Zavorth Hook Plane'));
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Current filter: transport'));
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Workspace Alpha: transport.before_action -> npm run hooks:transport:before'));
  });

  it('renders provider model summary through /models', async () => {
    const pack = buildPack();
    const ctx = buildCtx('/models');

    const reply = await pack.buildModelsReply(ctx as any);

    expect(reply).toContain('Providers ready now');
    expect(reply).toContain('Accepted targets in /model: chat, code.');
  });

  it('sends provider model summary with channel-native actions', async () => {
    const pack = buildPack();
    const ctx = buildCtx('/models');

    await pack.handleModels(ctx as any);

    expect(ctx.reply.mock.calls[0][0]).toContain('Providers ready now');
    expect(ctx.reply.mock.calls[0][1]).toEqual(expect.objectContaining({
      reply_markup: expect.objectContaining({
        inline_keyboard: expect.any(Array)})}));
  });
});
