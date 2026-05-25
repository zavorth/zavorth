import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const controlDir = join(
  process.cwd(),
  'src/ai-gateway/app/(dashboard)/dashboard',
);

describe('DashboardShellWiring', () => {
  it('wires /dashboard to the Dashboard shell instead of the legacy layout', () => {
    const view = readFileSync(join(controlDir, 'controlPageClient.view.tsx'), 'utf8');

    expect(view).toContain('DashboardControlShell');
    expect(view).not.toContain('ControlPageClientHeader');
    expect(view).not.toContain('ControlPageClientSidebar');
    expect(view).not.toContain('ControlPageClientMain');
  });

  it('does not expose /dashboard as a routable product page', () => {
    expect(existsSync(join(controlDir, 'page.tsx'))).toBe(false);
  });

  it('keeps the shell connected to the real control model and adapter', () => {
    const shell = readFileSync(
      join(controlDir, 'dashboard/components/DashboardControlShell.tsx'),
      'utf8',
    );

    expect(shell).toContain('buildDashboardDashboardViewModel');
    expect(shell).toContain('DashboardOnboardingPanel');
    expect(shell).toContain('DashboardDeveloperWorkspace');
    expect(shell).toContain('DashboardGatewayConsole');
    expect(shell).toContain('model.state?.agentRuntime');
    expect(shell).toContain('agentRun: activeRun || null');
    expect(shell).toContain('runObservatory: agentRuntime?.runObservatory || null');
    expect(shell).toContain('viewModel.runObservatory');
    expect(shell).toContain('filterDashboardRunObservatory');
    expect(shell).toContain('readDashboardRunObservatoryUrlQuery');
    expect(shell).toContain('useDashboardNexusWorkbench');
    expect(shell).toContain('nexusWorkbench');
    expect(shell).toContain('model.handleSend');
    expect(shell).toContain('model.handleSessionChange');
    expect(shell).toContain('model.setDraft');

    const overview = readFileSync(
      join(controlDir, 'dashboard/components/DashboardOverviewSector.tsx'),
      'utf8',
    );
    const nexusHook = readFileSync(
      join(controlDir, 'dashboard/components/useDashboardNexusWorkbench.ts'),
      'utf8',
    );
    expect(nexusHook).toContain('/api/v2/nexus/workbench');
    expect(overview).toContain('onRunObservatoryQueryChange({ runId: observedRun.id })');
    expect(overview).toContain('onRunObservatoryQueryChange({ traceId: observedRun.traceId })');
    expect(overview).toContain('onRunObservatoryQueryChange({ sessionId: observedRun.sessionId })');

    const hook = readFileSync(join(controlDir, 'useControlPageClient.ts'), 'utf8');
    expect(hook).toContain('/api/gateway-control');
    expect(hook).toContain('/api/developer-workspace');
    expect(hook).toContain('gatewayControl');
    expect(hook).toContain('developerWorkspace');
    expect(hook).toContain('reloadGatewayControl');
    expect(hook).toContain('reloadDeveloperWorkspace');
  });

  it('keeps the premium chat surface wired to real sending, events, artifacts and memory context', () => {
    const shell = readFileSync(
      join(controlDir, 'dashboard/components/DashboardControlShell.tsx'),
      'utf8',
    );
    const chatSurface = readFileSync(
      join(controlDir, 'dashboard/components/DashboardChatSurface.tsx'),
      'utf8',
    );

    expect(shell).toContain('DashboardChatSurface');
    expect(shell).toContain('draft={model.draft}');
    expect(shell).toContain('sending={model.sending}');
    expect(shell).toContain('onSend={model.handleSend}');
    expect(chatSurface).toContain('viewModel.messages');
    expect(chatSurface).toContain('viewModel.events');
    expect(chatSurface).toContain('viewModel.artifacts');
    expect(chatSurface).toContain('viewModel.memorySignals');
    expect(chatSurface).toContain('onDraftChange');
    expect(chatSurface).toContain('DashboardChatContextStrip');
  });

  it('adds the phase 6 operation layer without creating destructive automatic actions', () => {
    const shell = readFileSync(
      join(controlDir, 'dashboard/components/DashboardControlShell.tsx'),
      'utf8',
    );
    const operationsPanel = readFileSync(
      join(controlDir, 'dashboard/components/DashboardOperationsPanel.tsx'),
      'utf8',
    );
    const commandPalette = readFileSync(
      join(controlDir, 'dashboard/components/DashboardCommandPalette.tsx'),
      'utf8',
    );

    expect(shell).toContain('DashboardOperationsPanel');
    expect(shell).toContain('DashboardCommandPalette');
    expect(shell).toContain('ctrlKey');
    expect(shell).toContain('metaKey');
    expect(operationsPanel).toContain('model.handleApproval');
    expect(operationsPanel).toContain('bcc-approval-summary');
    expect(operationsPanel).toContain('Revise antes de liberar');
    expect(operationsPanel).toContain('model.handleOpenDiff');
    expect(operationsPanel).toContain('Prepare doctor');
    expect(commandPalette).toContain('Acoes seguras');
    expect(commandPalette).toContain('onAction(action)');
    expect(commandPalette).not.toContain('handleApproval(');
    expect(commandPalette).not.toContain('handleOpenDiff(');
  });

  it('renders every Dashboard sector from real control data or honest empty states', () => {
    const shell = readFileSync(
      join(controlDir, 'dashboard/components/DashboardControlShell.tsx'),
      'utf8',
    );

    for (const sector of [
      'overview',
      'workspace',
      'gateway',
      'channels',
      'instances',
      'sessions',
      'usage',
      'agents',
      'skills',
      'nodes',
      'dreams',
      'config',
      'docs',
      'cron',
    ]) {
      expect(shell).toContain(`sectorId === "${sector}"`);
    }
  });

  it('renders the Nexus Workbench in the Dashboard overview from the canonical API', () => {
    const overview = readFileSync(
      join(controlDir, 'dashboard/components/DashboardOverviewSector.tsx'),
      'utf8',
    );
    const adapter = readFileSync(
      join(controlDir, 'dashboard/adapters/dashboardDashboardAdapter.ts'),
      'utf8',
    );
    const nexusAdapter = readFileSync(
      join(controlDir, 'dashboard/adapters/dashboardDashboardNexusWorkbenchAdapter.ts'),
      'utf8',
    );

    expect(overview).toContain('Nexus Workbench');
    expect(overview).toContain('viewModel.nexusWorkbench');
    expect(overview).toContain('humanNexusWorkbenchStatus');
    expect(overview).toContain('nexusWorkbench.operatorExperience.statusLabel');
    expect(overview).toContain('nexusWorkbench.operatorExperience.cards');
    expect(overview).toContain('Proximo passo: {nexusWorkbench.capabilities.nextAction}');
    expect(overview).toContain('onResolveNexusApproval');
    expect(overview).toContain('onRunNexusWorkbenchAction');
    expect(overview).toContain('Abrir readiness completo');
    expect(nexusAdapter).toContain('function normalizeStatus');
    expect(nexusAdapter).toContain('function normalizeActionKind');
    expect(nexusAdapter).toContain('export function buildNexusWorkbench');
    expect(nexusAdapter).toContain('safe_execution');
    expect(adapter).toContain('const nexusWorkbench = buildNexusWorkbench(input)');
    expect(adapter).toContain('nexusWorkbench,');
  });

  it('ships the Developer Workspace as an official Dashboard sector', () => {
    const shell = readFileSync(
      join(controlDir, 'dashboard/components/DashboardControlShell.tsx'),
      'utf8',
    );
    const workspace = readFileSync(
      join(controlDir, 'dashboard/components/DashboardDeveloperWorkspace.tsx'),
      'utf8',
    );

    expect(shell).toContain('sectorId === "workspace"');
    expect(workspace).toContain('handleDeveloperWorkspaceAction');
    expect(workspace).toContain('approval_required');
    expect(workspace).toContain('ptyProfiles');
    expect(workspace).toContain('processes');
    expect(workspace).toContain('hooks');
  });

  it('ships the Gateway Console as a controlled Gateway Control API surface', () => {
    const gatewayConsole = readFileSync(
      join(controlDir, 'dashboard/components/DashboardGatewayConsole.tsx'),
      'utf8',
    );

    expect(gatewayConsole).toContain('/api/gateway-control/providers/test');
    expect(gatewayConsole).toContain('/api/gateway-control/combos/validate');
    expect(gatewayConsole).toContain('/api/gateway-control/cache/invalidate');
    expect(gatewayConsole).toContain('/api/gateway-control/rate-limits/toggle');
    expect(gatewayConsole).toContain('approval_required');
    expect(gatewayConsole).toContain('model.reloadGatewayControl');
  });

  it('renders the shared Model Picker contract inside the Gateway Console', () => {
    const gatewayConsole = readFileSync(
      join(controlDir, 'dashboard/components/DashboardGatewayConsole.tsx'),
      'utf8',
    );

    expect(gatewayConsole).toContain('snapshot?.modelPicker');
    expect(gatewayConsole).toContain('modelPickerSelected');
    expect(gatewayConsole).toContain('modelPickerRoutes');
    expect(gatewayConsole).toContain('Model Picker');
    expect(gatewayConsole).toContain('route.explanation?.[1]');
  });

  it('does not port demo metrics from the fake dashboard into the real /dashboard shell', () => {
    const shell = readFileSync(
      join(controlDir, 'dashboard/components/DashboardControlShell.tsx'),
      'utf8',
    );

    for (const forbidden of [
      '12,847',
      '3.2M',
      '$4.82',
      '4821',
      'RTX 4090',
      'A100',
      '••••7f3a',
      'docs.zavorth.dev',
      'gemini-3-flash',
      'claude-opus-4',
    ]) {
      expect(shell).not.toContain(forbidden);
    }
  });
});
