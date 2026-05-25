import fs from 'node:fs';
import path from 'node:path';

import {
  buildDashboardDashboardViewModel,
} from '../../../src/ai-gateway/app/(dashboard)/dashboard/dashboard/adapters/index.js';
import {
  COMMAND_CENTER_NATIVE_FIRST_RUNTIME_PROJECTION_VERSION,
  buildDashboardNativeFirstRuntimeProjection,
  createDashboardNativeFirstConsumerIntegrationFixtureSource,
} from '../../../src/ai-gateway/app/(dashboard)/dashboard/dashboard/projections/index.js';

const PAUSE_DOC = 'docs/external-executor-secret-provisioning.md';
const PROJECTION = 'src/ai-gateway/app/(dashboard)/dashboard/dashboard/projections/dashboardRuntimeProjection.ts';
const PROJECTION_INDEX = 'src/ai-gateway/app/(dashboard)/dashboard/dashboard/projections/index.ts';
const COMMAND_CENTER_INDEX = 'src/ai-gateway/app/(dashboard)/dashboard/dashboard/index.ts';
const RAW_GATEWAY_TOKEN_ASSIGNMENT_PATTERN = new RegExp(
  'EXTERNAL_EXECUTOR_GATEWAY_TOKEN' + '=(?!present-redacted|<redacted-local-secret>)[^\\s`]+',
);

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('Dashboard native-first consumer integration', () => {
  it('documents the native-first external executor secret posture in product docs', () => {
    const content = read(PAUSE_DOC);

    expect(content).toContain('Zavorth does not migrate or expose raw secrets');
    expect(content).toContain('SecretRef');
    expect(content).toContain('every live invocation produces a receipt');
    expect(content).not.toMatch(RAW_GATEWAY_TOKEN_ASSIGNMENT_PATTERN);
    expect(content).not.toMatch(/(^|[^A-Za-z])sk-[A-Za-z0-9_-]{8,}/);
  });

  it('exports the native-first projection consumer from the Dashboard package', () => {
    expect(read(PROJECTION)).toContain('DashboardNativeFirstConsumerIntegration/v1');
    expect(read(PROJECTION)).toContain('buildDashboardNativeFirstRuntimeProjection');
    expect(read(PROJECTION_INDEX)).toContain('buildDashboardNativeFirstRuntimeProjection');
    expect(read(COMMAND_CENTER_INDEX)).toContain('buildDashboardNativeFirstRuntimeProjection');
  });

  it('builds a Dashboard runtime projection from native registries by default', () => {
    const source = createDashboardNativeFirstConsumerIntegrationFixtureSource();
    const result = buildDashboardNativeFirstRuntimeProjection(source);

    expect(source.adapterCalledForDefaultLookup).toBe(false);
    expect(source.adapterCalledForDefaultRender).toBe(false);
    expect(source.externalSourceLiveCalledForDefaultPath).toBe(false);
    expect(result.nativeContract).toBe('DashboardNativeFirstConsumerIntegration/v1');
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
        id: 'native-first-dashboard',
        status: 'ready',
      }),
      expect.objectContaining({
        id: 'native-registry-only',
        status: 'ready',
      }),
    ]));
  });

  it('keeps adapter refresh explicit and outside the default render/lookup path', () => {
    const result = buildDashboardNativeFirstRuntimeProjection();

    expect(result.policy).toEqual({
      dashboardNativeFirstEnabled: true,
      dashboardDefaultAdapterCall: false,
      externalSourceRequiredForDashboardRender: false,
      externalSourceRequiredForDashboardLookup: false,
      adapterRefreshAllowed: false,
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
    expect(result.projection.runtimeWarnings).toEqual([]);
  });

  it('renders the dashboard view model without public ExternalExecutor identity', () => {
    const result = buildDashboardNativeFirstRuntimeProjection();
    const viewModel = buildDashboardDashboardViewModel(result.adapterInput);
    const serializedViewModel = JSON.stringify(viewModel);

    expect(viewModel.adapterSource).toEqual(expect.objectContaining({
      label: 'Zavorth Native Registry Projection',
    }));
    expect(viewModel.runtime.status).toBe('ready');
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
    const result = buildDashboardNativeFirstRuntimeProjection();
    const viewModel = buildDashboardDashboardViewModel(result.adapterInput);

    expect(result.projection.events).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: expect.stringMatching(/^(error|status)$/),
      }),
    ]));
    expect(viewModel.health.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'native-registry-only',
        status: 'ready',
      }),
      expect.objectContaining({
        id: 'dashboard-registry-degraded-rows',
        status: 'degraded',
      }),
    ]));
    expect(viewModel.runtime.blockers).toEqual([]);
  });

  it('does not perform execution, migration, source copy, or raw secret serialization', () => {
    const result = buildDashboardNativeFirstRuntimeProjection();
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
