import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildDashboardCommandCenterViewModel } from '../../../src/ai-gateway/app/(dashboard)/control/command-center/adapters/dashboardCommandCenterAdapter.js';
import { buildDashboardAdapterInputFromCommandCenterRuntimeProjection } from '../../../src/ai-gateway/app/(dashboard)/control/command-center/projections/commandCenterRuntimeProjection.js';

function createProviderCockpitFixture() {
  return {
    contractVersion: '2026-05-13.phase-6',
    schemaVersion: 1,
    surface: 'command-center-provider-cockpit',
    generatedAt: '2026-05-13T20:00:00.000Z',
    status: 'ready',
    sourceMatrixContractVersion: '2026-05-13.phase-5',
    visualMutationApplied: false,
    executionAuthority: false,
    selectedProviderId: 'openai',
    summary: {
      totalProviders: 3,
      readyProviders: 2,
      livePassed: 1,
      liveFailed: 0,
      liveBlocked: 1,
      missingAuth: 1,
      missingBaseUrl: 0,
      needsProbe: 1,
    },
    cards: [
      {
        id: 'provider-cockpit-openai',
        providerId: 'openai',
        title: 'OpenAI',
        status: 'ready',
        liveStatus: 'passed',
        priority: 'primary',
        model: 'gpt-5.4',
        summary: 'OpenAI passed a live models probe.',
        evidence: {
          liveNetworkUsed: true,
          target: 'https://api.openai.com/v1/models',
          httpStatus: 200,
          durationMs: 318,
          modelCount: 117,
          evidenceHash: 'sha256:provider-evidence',
        },
        actions: [
          {
            id: 'provider-openai-read',
            label: 'Read',
            command: 'zavorth providers cockpit --provider openai',
            kind: 'read',
            providerId: 'openai',
            risk: 'read',
            requiresApproval: false,
            dashboardCanExecute: false,
            summary: 'Read-only provider matrix.',
          },
          {
            id: 'provider-openai-live',
            label: 'Probe',
            command: 'zavorth providers live --provider openai',
            kind: 'live_probe',
            providerId: 'openai',
            risk: 'sensitive',
            requiresApproval: true,
            dashboardCanExecute: false,
            summary: 'Live probe must be explicitly triggered by the operator.',
          },
        ],
      },
    ],
    actions: [
      {
        id: 'provider-cockpit-read',
        label: 'Read matrix',
        command: 'zavorth providers cockpit',
        kind: 'read',
        providerId: null,
        risk: 'read',
        requiresApproval: false,
        dashboardCanExecute: false,
        summary: 'Read projected provider cockpit.',
      },
    ],
    healthChecks: [
      {
        id: 'provider-cockpit-render',
        label: 'Render safety',
        status: 'ready',
        detail: 'Dashboard render is projection-only.',
      },
    ],
    receipts: [
      {
        id: 'provider-cockpit-safety',
        kind: 'safety',
        status: 'recorded',
        providerId: null,
        detail: 'No raw provider secrets are serialized.',
        evidenceHash: null,
      },
    ],
    commandCenterProjection: {
      route: '/control',
      endpoint: '/api/providers/readiness',
      renderMode: 'projection-only',
      visualApprovalRequired: true,
      canRenderCardsAfterApproval: true,
    },
    safety: {
      noRawProviderSecrets: true,
      normalRenderMakesNoNetworkCalls: true,
      liveProbeRequiresExplicitOperatorAction: true,
      commandCenterCannotExecuteProviderCalls: true,
    },
    nextAction: 'Use the live matrix to choose or test a provider.',
  };
}

describe('Command Center Provider Cockpit Visual Implementation', () => {
  it('projects provider cockpit data into the dashboard view model without execution authority', () => {
    const viewModel = buildDashboardCommandCenterViewModel({
      runtime: { status: 'ready' },
      wsStatus: 'connected',
      providerCockpit: createProviderCockpitFixture(),
    });

    expect(viewModel.providerCockpit).toEqual(expect.objectContaining({
      surface: 'command-center-provider-cockpit',
      status: 'ready',
      executionAuthority: false,
      visualMutationApplied: false,
      summary: expect.objectContaining({
        readyProviders: 2,
        livePassed: 1,
      }),
      safety: expect.objectContaining({
        noRawProviderSecrets: true,
        normalRenderMakesNoNetworkCalls: true,
        commandCenterCannotExecuteProviderCalls: true,
      }),
    }));
    expect(viewModel.providerCockpit?.cards[0]).toEqual(expect.objectContaining({
      providerId: 'openai',
      liveStatus: 'passed',
      evidence: expect.objectContaining({
        httpStatus: 200,
        evidenceHash: 'sha256:provider-evidence',
      }),
    }));
  });

  it('passes provider cockpit through runtime projections for Web and CLI parity', () => {
    const adapterInput = buildDashboardAdapterInputFromCommandCenterRuntimeProjection({
      projectionVersion: 'command-center-runtime-projection/v1',
      generatedAt: '2026-05-13T20:00:00.000Z',
      adapterSource: {
        kind: 'universal-agent-runtime',
        label: 'test',
      },
      runtimeStatus: 'ready',
      wsStatus: 'connected',
      agentRun: null,
      sessions: [],
      messages: [],
      tasks: [],
      events: [],
      approvals: [],
      artifacts: [],
      memorySignals: [],
      capabilities: [],
      toolExposure: {
        mode: 'safe',
        summary: 'none',
        tools: [],
      },
      providerCockpit: createProviderCockpitFixture() as any,
      replyPorts: [],
      integrations: [],
      logs: [],
      workflowJobs: [],
      runtimeWarnings: [],
    });

    const viewModel = buildDashboardCommandCenterViewModel(adapterInput);

    expect(adapterInput.providerCockpit).toBeTruthy();
    expect(viewModel.providerCockpit?.selectedProviderId).toBe('openai');
  });

  it('renders from projected state and prepares commands instead of executing provider probes', () => {
    const panelSource = readFileSync(
      join(process.cwd(), 'src/ai-gateway/app/(dashboard)/control/command-center/components/CommandCenterOperationsPanel.tsx'),
      'utf8',
    );
    const previewSource = readFileSync(
      join(process.cwd(), 'scripts/command-center-browser-preview.ts'),
      'utf8',
    );
    const visualQaSource = readFileSync(
      join(process.cwd(), 'scripts/command-center-provider-cockpit-visual-qa.ts'),
      'utf8',
    );
    const liveSmokeSource = readFileSync(
      join(process.cwd(), 'scripts/command-center-provider-cockpit-live-smoke.ts'),
      'utf8',
    );
    const webStateRouteSource = readFileSync(
      join(process.cwd(), 'src/domain/surface/presentation/web-app/WebAppRuntimeStateRouteService.ts'),
      'utf8',
    );
    const fixturesSource = readFileSync(
      join(process.cwd(), 'src/ai-gateway/app/(dashboard)/control/command-center/fixtures/dashboardCommandCenterFixtures.ts'),
      'utf8',
    );
    const packageJson = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8')) as {
      scripts: Record<string, string>;
    };

    expect(panelSource).toContain('CommandCenterProviderCockpitPanel');
    expect(panelSource).toContain('normalRenderMakesNoNetworkCalls');
    expect(panelSource).toContain('onDraftCommand(liveAction.command)');
    expect(panelSource).not.toContain('fetch(');
    expect(previewSource).toContain('renderProviderCockpitPanel');
    expect(previewSource).toContain('data-zavorth-provider-cockpit="ready"');
    expect(visualQaSource).toContain('01-provider-cockpit-desktop.png');
    expect(visualQaSource).toContain('02-provider-cockpit-mobile.png');
    expect(visualQaSource).toContain('forbiddenSecrets');
    expect(liveSmokeSource).toContain('/api/providers/readiness');
    expect(liveSmokeSource).toContain('live-probe-blocked-from-dashboard-route');
    expect(liveSmokeSource).toContain('command-center-snapshot-consumes-provider-cockpit');
    expect(webStateRouteSource).toContain("pathname === '/api/providers/readiness'");
    expect(webStateRouteSource).toContain('provider_live_probe_requires_explicit_operator_cli_or_approved_api');
    expect(webStateRouteSource).toContain('attachProviderCockpit');
    expect(fixturesSource).toContain('providerCockpit');
    expect(fixturesSource).toContain('normalRenderMakesNoNetworkCalls: true');
    expect(packageJson.scripts['qa:command-center-provider-cockpit-visual']).toContain('command-center-provider-cockpit-visual-qa.ts --require-pass');
    expect(packageJson.scripts['qa:command-center-provider-cockpit-live']).toContain('command-center-provider-cockpit-live-smoke.ts --require-pass');
    expect(packageJson.scripts['qa:command-center']).toContain('qa:command-center-provider-cockpit-visual');
    expect(packageJson.scripts['qa:command-center']).toContain('qa:command-center-provider-cockpit-live');
  });
});
