import { TelegramOpsController } from '../../../src/telegram/controllers/TelegramOpsController';

jest.setTimeout(15000);

describe('TelegramOpsController', () => {
  function createController(overrides: Record<string, any> = {}) {
    return new TelegramOpsController(
      {} as any,
      {
        getRecentEvents: jest.fn().mockResolvedValue([]),
        logEvent: jest.fn().mockResolvedValue(undefined),
        ...overrides.auditLogger} as any,
      {
        getModeManager: jest.fn().mockReturnValue({
          getMode: jest.fn().mockReturnValue('WORKSPACE'),
          getPermissions: jest.fn().mockReturnValue({
            read: true,
            write: true,
            build: false}),
          setMode: jest.fn()}),
        ...overrides.executionGateway} as any,
      {
        getPreferredModel: jest.fn().mockResolvedValue(null),
        ...overrides.zavorthBridgePreferenceStore} as any,
      {
        start: jest.fn().mockResolvedValue('http://127.0.0.1:3030'),
        getUrl: jest.fn().mockReturnValue('http://127.0.0.1:3030'),
        getPublicBaseUrl: jest.fn().mockReturnValue(null),
        ...overrides.dashboardService} as any,
      {
        getStatus: jest.fn().mockReturnValue({
          enabled: true,
          lastSentAt: '2026-03-28T09:00:00.000Z',
          updatedAt: '2026-03-28T08:00:00.000Z',
          updatedBy: '42',
          note: 'Activated via Telegram.',
          nextPlannedAt: '2026-03-29T09:00:00.000Z'}),
        enable: jest.fn().mockReturnValue({
          enabled: true,
          lastSentAt: null,
          updatedAt: '2026-03-28T10:00:00.000Z',
          updatedBy: '42',
          note: 'Activated via Telegram.',
          nextPlannedAt: '2026-03-29T09:00:00.000Z'}),
        disable: jest.fn().mockReturnValue({
          enabled: false,
          lastSentAt: '2026-03-28T09:00:00.000Z',
          updatedAt: '2026-03-28T11:00:00.000Z',
          updatedBy: '42',
          note: 'Deactivated via Telegram.',
          nextPlannedAt: '2026-03-29T09:00:00.000Z'}),
        sendNow: jest.fn().mockResolvedValue({
          sent: true,
          message: 'Report diario sent agora.'}),
        ...overrides.dailyReportService} as any,
      {
        isEnabled: jest.fn().mockReturnValue(false),
        getStatus: jest.fn().mockReturnValue({
          enabled: false,
          updatedAt: null,
          updatedBy: null,
          note: null,
          autoPresentationEnabled: false}),
        enable: jest.fn().mockReturnValue({
          enabled: true,
          updatedAt: '2026-03-28T10:00:00.000Z',
          updatedBy: '42',
          note: 'Activated via Telegram.',
          autoPresentationEnabled: true}),
        disable: jest.fn().mockReturnValue({
          enabled: false,
          updatedAt: '2026-03-28T11:00:00.000Z',
          updatedBy: '42',
          note: 'Deactivated via Telegram.',
          autoPresentationEnabled: false}),
        ...overrides.demoModeService} as any,
      {
        getSession: jest.fn().mockReturnValue(null),
        start: jest.fn().mockReturnValue({
          currentIndex: 0,
          startedAt: '2026-03-28T10:00:00.000Z',
          updatedAt: '2026-03-28T10:00:00.000Z',
          completed: false}),
        next: jest.fn().mockReturnValue({
          currentIndex: 1,
          startedAt: '2026-03-28T10:00:00.000Z',
          updatedAt: '2026-03-28T10:02:00.000Z',
          completed: false}),
        reset: jest.fn().mockReturnValue(true),
        ...overrides.demoGuideService} as any,
      {
        isEnabled: jest.fn().mockReturnValue(false),
        getStatus: jest.fn().mockReturnValue({
          enabled: false,
          updatedAt: null,
          updatedBy: null,
          note: null}),
        enable: jest.fn().mockReturnValue({
          enabled: true,
          updatedAt: '2026-03-28T10:00:00.000Z',
          updatedBy: '42',
          note: 'Activated via Telegram.'}),
        disable: jest.fn().mockReturnValue({
          enabled: false,
          updatedAt: '2026-03-28T11:00:00.000Z',
          updatedBy: '42',
          note: 'Deactivated via Telegram.'}),
        ...overrides.operatorModeService} as any,
      {
        isEnabled: jest.fn().mockReturnValue(false),
        getStatus: jest.fn().mockReturnValue({
          enabled: false,
          updatedAt: null,
          updatedBy: null,
          note: null}),
        enable: jest.fn().mockReturnValue({
          enabled: true,
          updatedAt: '2026-03-28T10:00:00.000Z',
          updatedBy: '42',
          note: 'Activated via Telegram.'}),
        disable: jest.fn().mockReturnValue({
          enabled: false,
          updatedAt: '2026-03-28T11:00:00.000Z',
          updatedBy: '42',
          note: 'Deactivated via Telegram.'}),
        ...overrides.presentationModeService} as any,
      {
        activate: jest.fn().mockResolvedValue({ active: true, message: 'activated' }),
        restore: jest.fn().mockResolvedValue({ active: false, message: 'restaurado' }),
        status: jest.fn().mockResolvedValue({ active: false, message: 'inactive' }),
        ...overrides.remoteModeManager} as any,
      {
        writeSnapshot: jest.fn().mockReturnValue({
          process: {
            uptimeSeconds: 600,
            rssMb: 256,
            heapMb: 96,
            platform: 'win32',
            cpuArch: 'x64'},
          runtime: {
            hostSupervisor: { pid: 111, alive: true },
            telegramWorker: { pid: 222, alive: true }},
          tasks: {
            activeCount: 2,
            byStatus: { running: 1, waiting_approval: 1 },
            recentFailures: []}}),
        ...overrides.runtimeDiagnostics} as any,
      {
        status: jest.fn().mockResolvedValue({
          ok: true,
          action: 'status',
          message: 'WSL operacional.',
          distros: [],
          warnings: []}),
        ...overrides.wslControl} as any,
      {
        summarizeRecentChanges: jest.fn().mockReturnValue('Zavorth changes and state\n\nBuild: up to date.'),
        requestReload: jest.fn().mockResolvedValue({
          accepted: true,
          requestId: 'reload-123',
          summary: 'O host supervisor aceitou o handoff do reload.'}),
        ...overrides.supervisedRuntimeService} as any,
      {
        summarizeLastRun: jest.fn().mockReturnValue('Autoreparo do Zavorth\n\nStatus: noop.'),
        run: jest.fn().mockResolvedValue({
          success: true,
          status: 'reloaded',
          summary: 'Autoreparo do Zavorth\n\nStatus final: reloaded.',
          report: {} as any}),
        ...overrides.autoRepairService} as any,
      {
        renderCatalogReport: jest.fn().mockReturnValue('Zavorth Integration Hub\n\nFeatured connectors:'),
        renderManifestReport: jest.fn().mockReturnValue('Integraction selecionada'),
        renderConnectReport: jest.fn().mockReturnValue('Connection prepared:\n\ncustomized in Docker'),
        ...overrides.integrationHubService} as any,
      {
        buildSnapshot: jest.fn().mockResolvedValue({
          generatedAt: '2026-04-02T10:10:00.000Z',
          windowHours: 168,
          totals: {
            tasks: 0,
            completed: 0,
            failed: 0,
            waitingApproval: 0,
            workflowRuns: 0,
            resumableWorkflowRuns: 0,
            artifacts: 0,
            approvals: 0},
          routes: {
            strategies: [],
            taskKinds: [],
            taskSubtypes: []},
          surfaces: {
            sources: []},
          workflows: {
            active: 0,
            resumable: 0,
            completed: 0,
            failed: 0,
            recent: []},
          executors: {
            top: [],
            friction: []},
          approvals: {
            pending: 0,
            approved: 0,
            rejected: 0,
            highRisk: 0,
            permissionPending: 0,
            permissionRejected: 0},
          artifacts: {
            topKinds: [],
            recent: []},
          learning: {
            routes: {
              topSuccessful: [],
              highestFriction: []},
            approvedPolicies: [],
            workflowResumeStages: []},
          insights: []}),
        ...overrides.productObservabilityService} as any,
      {
        buildSnapshot: jest.fn().mockReturnValue({
          profile: 'core',
          commands: {
            profile: '/profile [core|ops|full]',
            capabilities: '/capabilities',
            enable: '/enable <capability> [once|session|host]',
            disable: '/disable <capability>'},
          summary: {
            total: 1,
            builtinCapabilities: 1,
            registeredCommands: 1,
            active: 1,
            dormant: 0,
            requiringApproval: 0},
          capabilities: [
            {
              capabilityId: 'skill-plane',
              state: 'active',
              activationMode: 'profile',
              approvalRequired: false,
              idleTtlMs: null,
              enabledByProfile: true,
              enabledByUser: false,
              estimatedFootprint: {
                ramIdleMb: 64,
                diskMb: 1,
                processCount: 0},
              fallbackBehavior: 'usar comandos nactives',
              notes: 'Skill plane ready.'}]}),
        ...overrides.capabilityLifecycleService} as any,
      {
        buildManifest: jest.fn().mockResolvedValue({
          generatedAt: '2026-04-05T10:00:00.000Z',
          summary: 'Zavorth ready for local and remote use.',
          local: {
            ready: true,
            baseUrl: 'http://127.0.0.1:33333',
            appUrl: 'http://127.0.0.1:33333/app',
            dashboardUrl: 'http://127.0.0.1:33333/',
            apiBaseUrl: 'http://127.0.0.1:33333/api/web'},
          remote: {
            ready: false,
            baseUrl: null,
            appUrl: null,
            requiresHttps: false},
          auth: {
            required: true,
            source: 'env',
            tokenFile: 'C:/tmp/web-token.txt',
            authorizedHost: true},
          commands: {
            install: 'npm run ops:install',
            bootstrap: 'npm run ops:bootstrap -- --repair',
            start: 'npm run ops:up',
            access: 'npm run ops:access',
            remote: 'npm run ops:remote',
            manifest: 'npm run ops:manifest',
            trust: '/hostauth trust'},
          journey: [],
          surfaces: [],
          guides: {
            local: ['Use http://127.0.0.1:33333/app.'],
            remote: ['Defina ZAVORTH_PUBLIC_BASE_URL.']},
          warnings: [],
          nextSteps: []}),
        ...overrides.runtimeAccessManifestService} as any,
      {
        inspectLive: jest.fn().mockResolvedValue({
          checkedAt: '2026-04-05T10:00:00.000Z',
          projectRoot: 'C:/workspace/zavorth',
          env: {
            envFilePresent: true,
            llmProvider: 'gemini',
            llmCredentialReady: true,
            issues: []},
          dependencies: {
            installRequired: false,
            buildRequired: false},
          platforms: [],
          supervisedRuntime: {
            installRequired: false,
            buildRequired: false,
            accessReadiness: {
              local: { ready: true },
              remote: { ready: false },
              nextSteps: []}},
          actions: [
            {
              id: 'configure-public-base-url',
              title: 'Configure public URL',
              command: 'definir ZAVORTH_PUBLIC_BASE_URL',
              reason: 'Falta URL public.',
              blocking: false}],
          summary: 'Bootstrap basico closed: Zavorth ready for local use.'}),
        ...overrides.runtimeBootstrapService} as any,
      {
        inspect: jest.fn().mockResolvedValue({
          summary: 'Acesso remoto oficial do Zavorth',
          remote: {
            ready: false,
            baseUrl: null,
            appUrl: null,
            issues: ['Defina uma URL public.']},
          rollout: {
            activeId: null,
            candidates: []},
          actions: {
            recommendedProvider: null,
            recommendedAction: 'configure-public-base-url'},
          nextSteps: ['npm run ops:manifest']}),
        runAction: jest.fn().mockResolvedValue({
          summary: 'Acesso remoto oficial do Zavorth',
          remote: {
            ready: false,
            baseUrl: null,
            appUrl: null,
            issues: []},
          rollout: {
            activeId: null,
            candidates: []},
          actions: {
            recommendedProvider: null,
            recommendedAction: null},
          nextSteps: []}),
        ...overrides.runtimeOfficialRemoteAccessService} as any,
    );
  }

  it('includes task/runtime diagnostics in the status reply', async () => {
    const ctx = {
      reply: jest.fn().mockResolvedValue(undefined)} as any;

    const controller = createController({
      runtimeDiagnostics: {
        writeSnapshot: jest.fn().mockReturnValue({
          process: {
            uptimeSeconds: 3660,
            rssMb: 320,
            heapMb: 110,
            platform: 'win32',
            cpuArch: 'x64'},
          runtime: {
            hostSupervisor: { pid: 9001, alive: true },
            telegramWorker: { pid: 9002, alive: true }},
          tasks: {
            activeCount: 3,
            byStatus: { running: 2, waiting_approval: 1 },
            recentFailures: [
              {
                taskId: 'abcdef123456',
                executor: 'external_executor',
                commandType: 'external_executor',
                errorSummary: 'gateway timeout'}]}})}});

    await controller.handleStatus(ctx);

    const [statusText, statusOptions] = ctx.reply.mock.calls[0];
    expect(statusText).toContain('Zavorth overview');
    expect(statusText).toContain('Active processes: host 9001 | worker 9002.');
    expect(statusText).toContain('- Demo: inactive');
    expect(statusText).toContain('- Presentation: inactive');
    expect(statusText).toContain('Tasks in progress: 3 (running 2 | awaiting approval 1).');
    expect(statusText).toContain('Skill plane');
    expect(statusText).toContain('Last alert: external_executor | task abcdef12.');
    expect(statusText).toContain('Reason: gateway timeout');
    expect(JSON.stringify(statusOptions.reply_markup.inline_keyboard)).toContain('/zavorthControl');
  });

  it('adds product observability highlights to the status reply', async () => {
    const ctx = {
      reply: jest.fn().mockResolvedValue(undefined)} as any;

    const controller = createController({
      productObservabilityService: {
        buildSnapshot: jest.fn().mockResolvedValue({
          generatedAt: '2026-04-02T10:10:00.000Z',
          windowHours: 168,
          totals: {
            tasks: 3,
            completed: 2,
            failed: 1,
            waitingApproval: 1,
            workflowRuns: 1,
            resumableWorkflowRuns: 1,
            artifacts: 1,
            approvals: 2},
          routes: {
            strategies: [],
            taskKinds: [],
            taskSubtypes: []},
          surfaces: {
            sources: [
              { label: 'telegram', count: 3, last_seen_at: '2026-04-02T10:05:00.000Z' }]},
          workflows: {
            active: 0,
            resumable: 1,
            completed: 0,
            failed: 0,
            recent: [
              {
                workflow_run_id: 'wf-1',
                workflow: 'ship',
                status: 'approval_pending',
                completed_stages: 1,
                total_stages: 2,
                resume_stage_label: 'ExternalExecutor review',
                primary_artifact_name: 'briefing-final.md',
                updated_at: '2026-04-02T10:05:00.000Z'}]},
          executors: {
            top: [
              {
                executor: 'codex',
                total: 2,
                completed: 2,
                failed: 0,
                waiting_approval: 0,
                approval_friction: 0,
                success_rate: 1,
                last_seen_at: '2026-04-02T10:05:00.000Z'}],
            friction: []},
          approvals: {
            pending: 1,
            approved: 1,
            rejected: 1,
            highRisk: 0,
            permissionPending: 1,
            permissionRejected: 1},
          artifacts: {
            topKinds: [],
            recent: []},
          learning: {
            routes: {
              topSuccessful: [
                {
                  executor: 'codex',
                  source: 'workflow_memory',
                  strategy: 'review',
                  workflow: 'ship',
                  kind: 'research',
                  subtype: 'competitive_analysis',
                  total: 2,
                  completed: 2,
                  failed: 0,
                  waitingApproval: 0,
                  waitingPermission: 0,
                  artifactful: 1,
                  success_rate: 1,
                  friction_rate: 0,
                  last_seen_at: '2026-04-02T10:05:00.000Z',
                  rationale: '2/2 completed(s).'}],
              highestFriction: [
                {
                  executor: 'external_executor',
                  source: 'workflow_memory',
                  strategy: 'ship',
                  workflow: 'ship',
                  kind: 'automation',
                  subtype: 'delivery',
                  total: 2,
                  completed: 0,
                  failed: 1,
                  waitingApproval: 1,
                  waitingPermission: 0,
                  artifactful: 0,
                  success_rate: 0,
                  friction_rate: 1,
                  last_seen_at: '2026-04-02T10:05:00.000Z',
                  rationale: '1 failure, 1 waiting for approval.'}]},
            approvedPolicies: [
              {
                executor: 'external_executor',
                kind: 'workspace_access',
                scope: 'once',
                count: 1,
                last_seen_at: '2026-04-02T10:05:00.000Z'}],
            workflowResumeStages: [
              {
                workflow: 'ship',
                stage_label: 'ExternalExecutor review',
                approval_pending: 1,
                blocked: 0,
                failed: 0,
                last_seen_at: '2026-04-02T10:05:00.000Z'}]},
          insights: ['Workflow com resumption pronta no ship.']})}});

    await controller.handleStatus(ctx);

    const productText = ctx.reply.mock.calls[0][0];
    expect(productText).toMatch(/Produto|Product/);
    expect(productText).toContain('Observed window: 3 request(s) | 1 workflow(s) | 1 delivery item(s).');
    expect(productText).toContain('Primary insight: Workflow com resumption pronta no ship.');
    expect(productText).toContain('Most active surface: telegram (3 request(s)).');
    expect(productText).toContain('Best recent route: codex in research/competitive_analysis (2/2 completed).');
    expect(productText).toContain('Workflow to resume: ship');
    expect(productText).toContain('ExternalExecutor review');
    expect(productText).toContain('Featured executor: codex (100% success).');
    expect(productText).toContain('Highest recent friction: external_executor in automation/delivery (1 failure(s), 1 awaiting approval).');
    expect(productText).toContain('Most reused policy: external_executor/workspace_access (1 authorization(s)).');
  });

  it('renders the capability summary reply', async () => {
    const ctx = {
      reply: jest.fn().mockResolvedValue(undefined)} as any;

    const controller = createController();

    await controller.handleCapabilities(ctx);

    expect(String(ctx.reply.mock.calls.map((c) => c?.[0]).join('\n'))).toContain('Zavorth Capabilities');
    expect(String(ctx.reply.mock.calls.map((c) => c?.[0]).join('\n'))).toContain('On-demand capabilities:');
    expect(String(ctx.reply.mock.calls.map((c) => c?.[0]).join('\n'))).toContain('skill-plane');
  });

  it('renders the integration catalog', async () => {
    const ctx = {
      reply: jest.fn().mockResolvedValue(undefined)} as any;

    const controller = createController();

    await controller.handleIntegrations(ctx, '');

    expect(String(ctx.reply.mock.calls.map((c) => c?.[0]).join('\n'))).toContain('Zavorth Integration Hub');
    expect(String(ctx.reply.mock.calls.map((c) => c?.[0]).join('\n'))).toContain('Featured connectors:');
  });

  it('starts a safe connection draft', async () => {
    const ctx = {
      from: { id: 42 },
      reply: jest.fn().mockResolvedValue(undefined)} as any;

    const controller = createController();

    await controller.handleConnect(ctx, 'zerocloud docker');

    expect(String(ctx.reply.mock.calls.map((c) => c?.[0]).join('\n'))).toContain('Connection prepared:');
    expect(String(ctx.reply.mock.calls.map((c) => c?.[0]).join('\n'))).toContain('customized in Docker');
  });

  it('returns the dashboard URL through the chat context', async () => {
    const ctx = {
      reply: jest.fn().mockResolvedValue(undefined)} as any;

    const controller = createController();

    await controller.handleDashboard(ctx);

    expect(String(ctx.reply.mock.calls.map((c) => c?.[0]).join('\n'))).toContain('http://127.0.0.1:3030');
      expect(ctx.reply.mock.calls[0]?.[1]).toEqual(expect.objectContaining({ parse_mode: 'Markdown' }));
  });

  it('renders the access manifest through the chat context', async () => {
    const ctx = {
      reply: jest.fn().mockResolvedValue(undefined)} as any;

    const controller = createController();

    await controller.handleAccess(ctx, 'remote');

    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Acesso remoto oficial do Zavorth');
    expect(String(ctx.reply.mock.calls.map((c) => c?.[0]).join('\n'))).toContain('npm run ops:manifest');
  });

  it('renders the bootstrap summary through the chat context', async () => {
    const ctx = {
      reply: jest.fn().mockResolvedValue(undefined)} as any;

    const controller = createController();

    await controller.handleBootstrap(ctx);

    expect(String(ctx.reply.mock.calls.map((c) => c?.[0]).join('\n'))).toContain('Zavorth Operational Bootstrap');
    expect(String(ctx.reply.mock.calls.map((c) => c?.[0]).join('\n'))).toContain('Configure public URL');
  });

  it('includes the configured public dashboard url when available', async () => {
    const ctx = {
      reply: jest.fn().mockResolvedValue(undefined)} as any;

    const controller = createController({
      dashboardService: {
        getPublicBaseUrl: jest.fn().mockReturnValue('https://dashboard.example.com')}});

    await controller.handleDashboard(ctx);

    expect(String(ctx.reply.mock.calls.map((c) => c?.[0]).join('\n'))).toContain('https://dashboard.example.com');
      expect(ctx.reply.mock.calls[0]?.[1]).toEqual(expect.objectContaining({ parse_mode: 'Markdown' }));
  });

  it('shows WSL status details when no explicit action is provided', async () => {
    const ctx = {
      reply: jest.fn().mockResolvedValue(undefined)} as any;

    const controller = createController({
      wslControl: {
        status: jest.fn().mockResolvedValue({
          ok: true,
          action: 'status',
          message: 'WSL operacional.',
          distros: [{ name: 'Ubuntu-24.04', version: 2, state: 'Running', isDefault: true }],
          warnings: []})}});

    await controller.handleWslCommand(ctx, '');

    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Ubuntu-24.04');
    expect(String(ctx.reply.mock.calls.map((c) => c?.[0]).join('\n'))).toContain('Use /wsl on to start');
  });

  it('parses and handles remote mode commands', async () => {
    const ctx = {
      reply: jest.fn().mockResolvedValue(undefined)} as any;
    const activate = jest.fn().mockResolvedValue({ active: true, message: 'Modo remoto ligado.' });
    const controller = createController({
      remoteModeManager: {
        activate}});

    expect(controller.parseRemoteModeCommand('/remote on')).toBe('activate');
    await controller.handleRemoteMode(ctx, 'activate');

    expect(activate).toHaveBeenCalled();
    expect(String(ctx.reply.mock.calls.map((c) => c?.[0]).join('\n'))).toContain('Remote mode activated.');
  });

  it('reports and toggles operator mode', async () => {
    const ctx = {
      from: { id: 42 },
      reply: jest.fn().mockResolvedValue(undefined)} as any;
    const enable = jest.fn().mockReturnValue({
      enabled: true,
      updatedAt: '2026-03-28T10:00:00.000Z',
      updatedBy: '42',
      note: 'Enabled through Telegram.'});
    const controller = createController({
      operatorModeService: {
        isEnabled: jest.fn().mockReturnValue(true),
        getStatus: jest.fn().mockReturnValue({
          enabled: true,
          updatedAt: '2026-03-28T10:00:00.000Z',
          updatedBy: '42',
          note: 'Activated via Telegram.'}),
        enable}});

    await controller.handleOperatorMode(ctx, '');
    await controller.handleOperatorMode(ctx, 'on');

    expect(String(ctx.reply.mock.calls[0]?.[0] ?? '')).toContain('Operator mode is active.');
    expect(enable).toHaveBeenCalledWith('42', 'Activated via Telegram.');
    expect(String(ctx.reply.mock.calls[1]?.[0] ?? '')).toContain('Operator mode activated.');
  });

  it('reports and toggles presentation mode', async () => {
    const ctx = {
      from: { id: 42 },
      reply: jest.fn().mockResolvedValue(undefined)} as any;
    const enable = jest.fn().mockReturnValue({
      enabled: true,
      updatedAt: '2026-03-28T10:00:00.000Z',
      updatedBy: '42',
      note: 'Enabled through Telegram.'});
    const controller = createController({
      presentationModeService: {
        isEnabled: jest.fn().mockReturnValue(true),
        getStatus: jest.fn().mockReturnValue({
          enabled: true,
          updatedAt: '2026-03-28T10:00:00.000Z',
          updatedBy: '42',
          note: 'Activated via Telegram.'}),
        enable}});

    await controller.handlePresentationMode(ctx, '');
    await controller.handlePresentationMode(ctx, 'on');

    expect(String(ctx.reply.mock.calls[0]?.[0] ?? '')).toContain('Presentation mode is active.');
    expect(enable).toHaveBeenCalledWith('42', 'Activated via Telegram.');
    expect(String(ctx.reply.mock.calls[1]?.[0] ?? '')).toContain('Presentation mode activated.');
  });

  it('returns the demo overview and a specific scenario', async () => {
    const ctx = {
      reply: jest.fn().mockResolvedValue(undefined)} as any;

    const controller = createController();

    await controller.handleDemo(ctx, '');
    await controller.handleDemo(ctx, 'stitch');

    expect(String(ctx.reply.mock.calls[0]?.[0] ?? '')).toContain('Roteiro de demo do Zavorth');
    expect(String(ctx.reply.mock.calls[0]?.[0] ?? '')).toContain('/demo stitch');
    expect(String(ctx.reply.mock.calls[1]?.[0] ?? '')).toContain('Cena de demo: Geraction com Stitch');
    expect(String(ctx.reply.mock.calls[1]?.[0] ?? '')).toContain('/stitch crie uma landing page moderna');
  });

  it('reports and toggles demo mode', async () => {
    const ctx = {
      from: { id: 42 },
      reply: jest.fn().mockResolvedValue(undefined)} as any;
    const enable = jest.fn().mockReturnValue({
      enabled: true,
      updatedAt: '2026-03-28T10:00:00.000Z',
      updatedBy: '42',
      note: 'Enabled through Telegram.',
      autoPresentationEnabled: true});
    const presentationEnable = jest.fn().mockReturnValue({
      enabled: true,
      updatedAt: '2026-03-28T10:00:00.000Z',
      updatedBy: '42',
      note: 'Enabled with demo mode.'});
    const controller = createController({
      demoModeService: {
        isEnabled: jest.fn().mockReturnValue(false),
        getStatus: jest.fn().mockReturnValue({
          enabled: false,
          updatedAt: null,
          updatedBy: null,
          note: null,
          autoPresentationEnabled: false}),
        enable},
      presentationModeService: {
        isEnabled: jest.fn().mockReturnValue(false),
        enable: presentationEnable,
        getStatus: jest.fn().mockReturnValue({
          enabled: false,
          updatedAt: null,
          updatedBy: null,
          note: null})}});

    await controller.handleDemo(ctx, 'status');
    await controller.handleDemo(ctx, 'on');

    expect(String(ctx.reply.mock.calls[0]?.[0] ?? '')).toContain('Demo mode is inactive.');
    expect(presentationEnable).toHaveBeenCalledWith('42', 'Enabled with demo mode.');
    expect(enable).toHaveBeenCalledWith('42', 'Enabled through Telegram.', true);
    expect(String(ctx.reply.mock.calls[1]?.[0] ?? '')).toContain('Demo mode enabled.');
  });

  it('starts, advances and resets the guided demo sequence', async () => {
    const ctx = {
      from: { id: 42 },
      reply: jest.fn().mockResolvedValue(undefined)} as any;
    const start = jest.fn().mockReturnValue({
      currentIndex: 0,
      startedAt: '2026-03-28T10:00:00.000Z',
      updatedAt: '2026-03-28T10:00:00.000Z',
      completed: false});
    const next = jest.fn().mockReturnValue({
      currentIndex: 1,
      startedAt: '2026-03-28T10:00:00.000Z',
      updatedAt: '2026-03-28T10:02:00.000Z',
      completed: false});
    const reset = jest.fn().mockReturnValue(true);
    const controller = createController({
      demoModeService: {
        isEnabled: jest.fn().mockReturnValue(true)},
      demoGuideService: {
        getSession: jest
          .fn()
          .mockReturnValueOnce({
            currentIndex: 0,
            startedAt: '2026-03-28T10:00:00.000Z',
            updatedAt: '2026-03-28T10:00:00.000Z',
            completed: false})
          .mockReturnValueOnce({
            currentIndex: 1,
            startedAt: '2026-03-28T10:00:00.000Z',
            updatedAt: '2026-03-28T10:02:00.000Z',
            completed: false}),
        start,
        next,
        reset}});

    await controller.handleDemo(ctx, 'start');
    await controller.handleDemo(ctx, 'next');
    await controller.handleDemo(ctx, 'reset');

    expect(start).toHaveBeenCalledWith('42');
    expect(String(ctx.reply.mock.calls[0]?.[0] ?? '')).toMatch(/Guided sequence started|Guided sequence|Demo mode enabled for this sequence/i);
    expect(String(ctx.reply.mock.calls[0]?.[0] ?? '')).toMatch(/Como abrir a apresentaction|open the presentation|Guided sequence|step|Step 1\/4/i);
    expect(next).toHaveBeenCalledWith('42', 4);
    // Product copy uses "Step N/M: <title>".
    expect(String(ctx.reply.mock.calls[1]?.[0] ?? '')).toMatch(/Step\s*2\/4:\s*Files/);
    expect(reset).toHaveBeenCalledWith('42');
    expect(String(ctx.reply.mock.calls[2]?.[0] ?? '')).toMatch(
      /Guided sequence reset|Sequencia guiada reiniciada|Use \/demo start/i,
    );
  });

  it('shows the short demo summary', async () => {
    const ctx = {
      reply: jest.fn().mockResolvedValue(undefined)} as any;

    const controller = createController();

    await controller.handleDemo(ctx, 'short');

    expect(String(ctx.reply.mock.calls.map((c) => c?.[0]).join('\n'))).toContain('Apresentaction curta do Zavorth');
  });

  it('reports and sends the daily report on demand', async () => {
    const ctx = {
      from: { id: 42 },
      reply: jest.fn().mockResolvedValue(undefined)} as any;
    const sendNow = jest.fn().mockResolvedValue({
      sent: true,
      message: 'Report diario sent agora.'});
    const controller = createController({
      dailyReportService: {
        getStatus: jest.fn().mockReturnValue({
          enabled: true,
          lastSentAt: '2026-03-28T09:00:00.000Z',
          updatedAt: '2026-03-28T08:00:00.000Z',
          updatedBy: '42',
          note: 'Activated via Telegram.',
          nextPlannedAt: '2026-03-29T09:00:00.000Z'}),
        sendNow}});

    await controller.handleDailyReport(ctx, '');
    await controller.handleDailyReport(ctx, 'now');

    expect(String(ctx.reply.mock.calls[0]?.[0] ?? '')).toContain('The daily report is active.');
    expect(sendNow).toHaveBeenCalledWith('42');
    expect(ctx.reply).toHaveBeenNthCalledWith(2, 'Report diario sent agora.');
  });

  it('reports the current primary and ZavorthBridge models', async () => {
    const ctx = {
      reply: jest.fn().mockResolvedValue(undefined)} as any;
    const controller = createController({
      zavorthBridgePreferenceStore: {
        getPreferredModel: jest.fn().mockResolvedValue('gemini-2.5-pro')}});

    await controller.handleModels(ctx);

    const modelText = ctx.reply.mock.calls[0][0];
    expect(modelText).toContain('Current conversational model');
    expect(modelText).toContain('Preferred ZavorthBridge model');
    expect(modelText).toContain('gemini-2.5-pro');
  });

  it('confirms WSL start with the verified distro status', async () => {
    const ctx = {
      reply: jest.fn().mockResolvedValue(undefined)} as any;
    const start = jest.fn().mockResolvedValue({
      ok: true,
      action: 'start',
      message: 'WSL started and confirmed for distro Ubuntu-24.04.',
      warnings: ['Sem marcador extra'],
      distros: [
        { name: 'Ubuntu-24.04', version: 2, state: 'Running', isDefault: true }]});
    const controller = createController({
      wslControl: {
        start}});

    await controller.handleWslCommand(ctx, 'on Ubuntu-24.04');

    expect(start).toHaveBeenCalledWith('Ubuntu-24.04');
    expect(String(ctx.reply.mock.calls[1]?.[0] ?? '')).toContain('Ubuntu-24.04');
    expect(String(ctx.reply.mock.calls[1]?.[0] ?? '')).toContain('Warnings: Sem marcador extra');
  });

  it('summarizes the latest local changes on demand', async () => {
    const ctx = {
      reply: jest.fn().mockResolvedValue(undefined)} as any;
    const summarizeRecentChanges = jest.fn().mockReturnValue('Zavorth changes and state\n\nBuild: up to date.');
    const controller = createController({
      supervisedRuntimeService: {
        summarizeRecentChanges}});

    await controller.handleChanges(ctx);

    expect(summarizeRecentChanges).toHaveBeenCalled();
    expect(String(ctx.reply.mock.calls.map((c) => c?.[0]).join('\n'))).toContain('Zavorth changes and state');
  });

  it('requests a supervised reload and passes the chat as notification target', async () => {
    const ctx = {
      chat: { id: 987654321 },
      from: { id: 42 },
      reply: jest.fn().mockResolvedValue(undefined)} as any;
    const requestReload = jest.fn().mockResolvedValue({
      accepted: true,
      requestId: 'reload-456',
      summary: 'O host supervisor aceitou o handoff do reload.'});
    const controller = createController({
      supervisedRuntimeService: {
        requestReload}});

    await controller.handleSelfUpdate(ctx, 'force');

    expect(requestReload).toHaveBeenCalledWith({
      reason: 'Forced supervised reload via Telegram.',
      requestedBy: '42',
      notifyChatId: '987654321',
      forceRestart: true});
    expect(String(ctx.reply.mock.calls.map((c) => c?.[0]).join('\n'))).toContain('O host supervisor aceitou o handoff do reload.');
    expect(String(ctx.reply.mock.calls.map((c) => c?.[0]).join('\n'))).toContain('telegram-runtime-reload-reload-456');
  });

  it('only forces reload when explicitly asked', async () => {
    const ctx = {
      chat: { id: 987654321 },
      from: { id: 42 },
      reply: jest.fn().mockResolvedValue(undefined)} as any;
    const requestReload = jest.fn().mockResolvedValue({
      accepted: false,
      requestId: 'reload-789',
      summary: 'O runtime supervisionado ja parece saudavel e sem pending items de install/build. Use /selfupdate force se quiser reciclar mesmo assim.'});
    const controller = createController({
      supervisedRuntimeService: {
        requestReload}});

    await controller.handleSelfUpdate(ctx, '');

    expect(requestReload).toHaveBeenCalledWith({
      reason: 'Supervised reload requested via Telegram.',
      requestedBy: '42',
      notifyChatId: '987654321',
      forceRestart: false});
  });

  it('runs autorepair with dry-run and improvement modes', async () => {
    const ctx = {
      chat: { id: 987654321 },
      from: { id: 42 },
      reply: jest.fn().mockResolvedValue(undefined)} as any;
    const run = jest
      .fn()
      .mockResolvedValueOnce({
        success: true,
        status: 'dry_run',
        summary: 'Autoreparo do Zavorth\n\nStatus final: dry_run.',
        report: {} as any})
      .mockResolvedValueOnce({
        success: true,
        status: 'reloaded',
        summary: 'Autoreparo do Zavorth\n\nStatus final: reloaded.',
        report: {} as any});
    const controller = createController({
      autoRepairService: {
        summarizeLastRun: jest.fn().mockReturnValue('Autoreparo do Zavorth\n\nStatus: noop.'),
        run}});

    await controller.handleAutoRepair(ctx, 'dryrun');
    await controller.handleAutoRepair(ctx, 'improve');

    expect(run).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        dryRun: true,
        force: false,
        goal: 'auto'}),
    );
    expect(run).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        dryRun: false,
        force: true,
        goal: 'improve'}),
    );
  });

  it('runs full autorepair by default and only uses status when explicitly requested', async () => {
    const ctx = {
      chat: { id: 987654321 },
      from: { id: 42 },
      reply: jest.fn().mockResolvedValue(undefined)} as any;
    const summarizeLastRun = jest.fn().mockReturnValue('Autoreparo do Zavorth\n\nStatus: noop.');
    const run = jest.fn().mockResolvedValue({
      success: true,
      status: 'reloaded',
      summary: 'Autoreparo do Zavorth\n\nStatus final: reloaded.',
      report: {} as any});
    const controller = createController({
      autoRepairService: {
        summarizeLastRun,
        run}});

    await controller.handleAutoRepair(ctx, '');
    await controller.handleAutoRepair(ctx, 'status');

    expect(run).toHaveBeenCalledWith(
      expect.objectContaining({
        dryRun: false,
        force: false,
        goal: 'auto'}),
    );
    expect(summarizeLastRun).toHaveBeenCalledTimes(1);
  });

  it('keeps maintenance on explicit slash commands', () => {
    const controller = createController();

    expect(controller.parseRuntimeMaintenanceCommand('summarize recent zavorth changes')).toBeNull();
    expect(controller.parseRuntimeMaintenanceCommand('/changes')).toEqual({
      action: 'changes',
      force: false,
      dryRun: false,
      improve: false});
    expect(controller.parseRuntimeMaintenanceCommand('se autoatualize com as mudancas')).toBeNull();
    expect(controller.parseRuntimeMaintenanceCommand('/reload')).toEqual({
      action: 'reload',
      force: false,
      dryRun: false,
      improve: false});
    expect(controller.parseRuntimeMaintenanceCommand('se autorepare e se melhore')).toBeNull();
    expect(controller.parseRuntimeMaintenanceCommand('/autorepair improve')).toEqual({
      action: 'autorepair',
      force: false,
      dryRun: false,
      improve: true});
  });

  it('summarizes recent audit events together with the current operational mode', async () => {
    const ctx = {
      reply: jest.fn().mockResolvedValue(undefined)} as any;
    const getRecentEvents = jest.fn().mockResolvedValue([
      {
        timestamp: '2026-04-03T12:34:56.000Z',
        event_type: 'SECURITY_BLOCK',
        task_id: 'task-12345678',
        policy_decision: 'BLOCKED',
        execution_summary: 'Tentativa barrada por policy.'},
      {
        timestamp: '2026-04-03T12:40:00.000Z',
        event_type: 'EXECUTION_COMPLETED',
        task_id: 'task-abcdef12',
        policy_decision: 'ALLOWED',
        execution_summary: 'Execution completed successfully.'}]);
    const getMode = jest.fn().mockReturnValue('BUILD');
    const controller = createController({
      auditLogger: {
        getRecentEvents},
      executionGateway: {
        getModeManager: jest.fn().mockReturnValue({
          getMode,
          getPermissions: jest.fn().mockReturnValue({}),
          setMode: jest.fn()})}});

    await controller.handleAudit(ctx, '20');

    expect(getRecentEvents).toHaveBeenCalledWith(20);
    expect(String(ctx.reply.mock.calls.map((c) => c?.[0]).join('\n'))).toMatch(/Ultimos 2 eventos do audit log|Latest 2 audit log events/i);
    expect(String(ctx.reply.mock.calls.map((c) => c?.[0]).join('\n'))).toContain('BLOCK [12:34:56] SECURITY_BLOCK');
    expect(String(ctx.reply.mock.calls.map((c) => c?.[0]).join('\n'))).toMatch(/Modo operacional atual: BUILD|Current operational mode: BUILD/);
  });

  it('reports the current operational mode and permission matrix by default', async () => {
    const ctx = {
      reply: jest.fn().mockResolvedValue(undefined)} as any;
    const getMode = jest.fn().mockReturnValue('READ_ONLY');
    const getPermissions = jest.fn().mockReturnValue({
      read: true,
      write: false,
      build: false});
    const controller = createController({
      executionGateway: {
        getModeManager: jest.fn().mockReturnValue({
          getMode,
          getPermissions,
          setMode: jest.fn()})}});

    await controller.handleOperationalMode(ctx, '');

    expect(String(ctx.reply.mock.calls.map((c) => c?.[0]).join('\n'))).toMatch(/Modo operacional atual: READ_ONLY|Current operational mode: READ_ONLY/);
    expect(String(ctx.reply.mock.calls.map((c) => c?.[0]).join('\\n'))).toMatch(/read: (yes|true)/);
    expect(String(ctx.reply.mock.calls.map((c) => c?.[0]).join('\n'))).toMatch(/write: (not|no)/);
  });

  it('changes the operational mode and records an audit event', async () => {
    const ctx = {
      from: { id: 42 },
      reply: jest.fn().mockResolvedValue(undefined)} as any;
    const setMode = jest.fn();
    const logEvent = jest.fn().mockResolvedValue(undefined);
    const controller = createController({
      auditLogger: {
        logEvent},
      executionGateway: {
        getModeManager: jest.fn().mockReturnValue({
          getMode: jest.fn().mockReturnValue('WORKSPACE'),
          getPermissions: jest.fn().mockReturnValue({}),
          setMode})}});

    await controller.handleOperationalMode(ctx, 'privileged');

    expect(setMode).toHaveBeenCalledWith('PRIVILEGED');
    expect(logEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        event_type: 'MODE_CHANGE',
        user_id: '42',
        operational_mode: 'PRIVILEGED',
        execution_summary: expect.stringMatching(
          /Modo alterado: WORKSPACE -> PRIVILEGED|Mode changed: WORKSPACE -> PRIVILEGED/,
        )}),
    );
    expect(String(ctx.reply.mock.calls.map((c) => c?.[0]).join('\n'))).toMatch(/Anterior: WORKSPACE|Previous: WORKSPACE/);
    expect(String(ctx.reply.mock.calls.map((c) => c?.[0]).join('\n'))).toMatch(/Atual: PRIVILEGED|Current: PRIVILEGED/);
  });
});
