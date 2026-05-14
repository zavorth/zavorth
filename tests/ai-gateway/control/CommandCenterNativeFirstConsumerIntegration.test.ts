import fs from 'node:fs';
import path from 'node:path';

import {
  buildDashboardCommandCenterViewModel,
} from '../../../src/ai-gateway/app/(dashboard)/control/command-center/adapters/index.js';
import {
  COMMAND_CENTER_NATIVE_FIRST_RUNTIME_PROJECTION_VERSION,
  buildCommandCenterNativeFirstRuntimeProjection,
  createCommandCenterNativeFirstConsumerIntegrationFixtureSource,
} from '../../../src/ai-gateway/app/(dashboard)/control/command-center/projections/index.js';

const DOC = 'docs/192-wave-3-command-center-native-first-consumer-integration.md';
const GO_NO_GO_DOC = 'docs/117-external-agent-full-absorption-go-no-go.md';
const PAUSE_DOC = 'docs/159-external-executor-secret-provisioning-pause.md';
const DEPRECATION_DOC = 'docs/191-wave-3-partial-adapter-deprecation-gate.md';
const PROJECTION = 'src/ai-gateway/app/(dashboard)/control/command-center/projections/commandCenterRuntimeProjection.ts';
const PROJECTION_INDEX = 'src/ai-gateway/app/(dashboard)/control/command-center/projections/index.ts';
const COMMAND_CENTER_INDEX = 'src/ai-gateway/app/(dashboard)/control/command-center/index.ts';
const RAW_GATEWAY_TOKEN_ASSIGNMENT_PATTERN = new RegExp(
  'EXTERNAL_EXECUTOR_GATEWAY_TOKEN' + '=(?!present-redacted|<redacted-local-secret>)[^\\s`]+',
);

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('Command Center native-first consumer integration', () => {
  it('documents 192 as the Command Center native-first consumer integration', () => {
    const content = read(DOC);

    expect(content).toContain('Status: command-center-native-first-consumer-integration-ready');
    expect(content).toContain('CommandCenterNativeFirstConsumerIntegration/v1');
    expect(content).toContain('COMMAND_CENTER_NATIVE_FIRST_RUNTIME_PROJECTION_VERSION');
    expect(content).toContain('docs/173-wave-1-command-center-live-assimilation.md');
    expect(content).toContain('docs/186-wave-3-dashboard-view-model-registry-native-slice.md');
    expect(content).toContain('docs/190-wave-3-native-registry-parity-and-dependency-reduction.md');
    expect(content).toContain('docs/191-wave-3-partial-adapter-deprecation-gate.md');
    expect(content).toContain('commandCenterNativeFirstEnabled=true');
    expect(content).toContain('commandCenterDefaultAdapterCall=false');
    expect(content).toContain('externalSourceRequiredForCommandCenterRender=false');
    expect(content).not.toMatch(RAW_GATEWAY_TOKEN_ASSIGNMENT_PATTERN);
    expect(content).not.toMatch(/(^|[^A-Za-z])sk-[A-Za-z0-9_-]{8,}/);
  });

  it('updates tracking docs for the Command Center native-first integration', () => {
    expect(read(GO_NO_GO_DOC)).toContain('docs/192-wave-3-command-center-native-first-consumer-integration.md');
    expect(read(PAUSE_DOC)).toContain('`192` is the Command Center native-first consumer integration');
    expect(read(DEPRECATION_DOC)).toContain('Command Center native-first consumer follow-up: docs/192-wave-3-command-center-native-first-consumer-integration.md');
    expect(read(DEPRECATION_DOC)).toContain('Do not advance to');
    expect(read(DEPRECATION_DOC)).toContain('`193`');
  });

  it('exports the native-first projection consumer from the Command Center package', () => {
    expect(read(PROJECTION)).toContain('CommandCenterNativeFirstConsumerIntegration/v1');
    expect(read(PROJECTION)).toContain('buildCommandCenterNativeFirstRuntimeProjection');
    expect(read(PROJECTION_INDEX)).toContain('buildCommandCenterNativeFirstRuntimeProjection');
    expect(read(COMMAND_CENTER_INDEX)).toContain('buildCommandCenterNativeFirstRuntimeProjection');
  });

  it('builds a Command Center runtime projection from native registries by default', () => {
    const source = createCommandCenterNativeFirstConsumerIntegrationFixtureSource();
    const result = buildCommandCenterNativeFirstRuntimeProjection(source);

    expect(source.adapterCalledForDefaultLookup).toBe(false);
    expect(source.adapterCalledForDefaultRender).toBe(false);
    expect(source.externalSourceLiveCalledForDefaultPath).toBe(false);
    expect(result.nativeContract).toBe('CommandCenterNativeFirstConsumerIntegration/v1');
    expect(result.projection.adapterSource).toEqual(expect.objectContaining({
      kind: 'universal-agent-runtime',
      label: 'Zavorth Native Registry Projection',
      version: COMMAND_CENTER_NATIVE_FIRST_RUNTIME_PROJECTION_VERSION,
    }));
    expect(result.projection.capabilities.length).toBeGreaterThan(0);
    expect(result.projection.integrations.length).toBeGreaterThan(0);
    expect(result.projection.sessions.length).toBeGreaterThan(0);
    expect(result.projection.messages.length).toBeGreaterThan(0);
    expect(result.projection.health?.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'native-first-command-center',
        status: 'ready',
      }),
      expect.objectContaining({
        id: 'adapter-refresh-explicit',
        status: 'degraded',
      }),
    ]));
  });

  it('keeps adapter refresh explicit and outside the default render/lookup path', () => {
    const result = buildCommandCenterNativeFirstRuntimeProjection();

    expect(result.policy).toEqual({
      commandCenterNativeFirstEnabled: true,
      commandCenterDefaultAdapterCall: false,
      externalSourceRequiredForCommandCenterRender: false,
      externalSourceRequiredForCommandCenterLookup: false,
      adapterRefreshAllowed: true,
      adapterRemovalAllowed: false,
      executionAuthority: false,
      messageActuallySent: false,
      providerActuallyExecuted: false,
      commandActuallyExecuted: false,
      toolActuallyExecuted: false,
      stateMigrated: false,
      sourceModuleCopied: false,
      rawSecretSerialized: false,
    });
    expect(result.nativeRegistryConsumer).toEqual({
      capabilityCardsFromNativeRegistry: true,
      dashboardViewsFromNativeRegistry: true,
      integrationMetadataFromNativeRegistry: true,
      sessionHistoryMetadataFromNativeRegistry: true,
      configStateMetadataFromNativeRegistry: true,
      adapterFallbackExplicitOnly: true,
    });
    expect(result.projection.runtimeWarnings).toEqual(expect.arrayContaining([
      'Adapter refresh/reconciliation is explicit and not the default render path.',
    ]));
  });

  it('renders the dashboard view model without public ExternalExecutor identity', () => {
    const result = buildCommandCenterNativeFirstRuntimeProjection();
    const viewModel = buildDashboardCommandCenterViewModel(result.adapterInput);
    const serializedViewModel = JSON.stringify(viewModel);

    expect(viewModel.adapterSource).toEqual(expect.objectContaining({
      label: 'Zavorth Native Registry Projection',
    }));
    expect(viewModel.runtime.status).toBe('degraded');
    expect(viewModel.toolExposure.tools.length).toBeGreaterThan(0);
    expect(viewModel.integrations.length).toBeGreaterThan(0);
    expect(viewModel.sessions.length).toBeGreaterThan(0);
    expect(viewModel.messages).toEqual(expect.arrayContaining([
      expect.objectContaining({
        text: expect.stringMatching(/^\[(redacted-content|unavailable)\]$/),
      }),
    ]));
    expect(serializedViewModel).not.toContain('ExternalExecutor');
    expect(serializedViewModel).not.toContain('external_executor');
    expect(serializedViewModel).not.toMatch(RAW_GATEWAY_TOKEN_ASSIGNMENT_PATTERN);
    expect(serializedViewModel).not.toContain('synthetic-raw-credential-sentinel-that-must-not-appear');
  });

  it('preserves degraded and unavailable registry states as renderable dashboard rows', () => {
    const result = buildCommandCenterNativeFirstRuntimeProjection();
    const viewModel = buildDashboardCommandCenterViewModel(result.adapterInput);

    expect(result.projection.events).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: expect.stringMatching(/^(error|status)$/),
      }),
    ]));
    expect(viewModel.health.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'adapter-refresh-explicit',
        status: 'degraded',
      }),
      expect.objectContaining({
        id: 'dashboard-registry-degraded-rows',
        status: 'degraded',
      }),
    ]));
    expect(viewModel.runtime.blockers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: expect.stringContaining('runtime-warning'),
      }),
    ]));
  });

  it('does not perform execution, migration, source copy, or raw secret serialization', () => {
    const result = buildCommandCenterNativeFirstRuntimeProjection();
    const serialized = JSON.stringify(result);

    expect(result.policy.executionAuthority).toBe(false);
    expect(result.policy.messageActuallySent).toBe(false);
    expect(result.policy.providerActuallyExecuted).toBe(false);
    expect(result.policy.commandActuallyExecuted).toBe(false);
    expect(result.policy.toolActuallyExecuted).toBe(false);
    expect(result.policy.stateMigrated).toBe(false);
    expect(result.policy.sourceModuleCopied).toBe(false);
    expect(result.policy.rawSecretSerialized).toBe(false);
    expect(serialized).not.toMatch(RAW_GATEWAY_TOKEN_ASSIGNMENT_PATTERN);
    expect(serialized).not.toMatch(/(^|[^A-Za-z])sk-[A-Za-z0-9_-]{8,}/);
  });
});
