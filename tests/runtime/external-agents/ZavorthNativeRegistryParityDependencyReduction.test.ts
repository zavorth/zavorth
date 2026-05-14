import fs from 'node:fs';
import path from 'node:path';

import {
  createZavorthNativeCapabilityRegistryFixture,
  createZavorthNativeConfigStateRegistryFixture,
  createZavorthNativeDashboardViewModelRegistryFixture,
  createZavorthNativeIntegrationRegistryFixture,
  createZavorthNativeRegistryParityCheckerFixture,
  createZavorthNativeSessionHistoryRegistryFixture,
  normalizeZavorthNativeRegistryParityDependencyReductionFixture,
} from '../../../src/runtime/external-agents/index.js';
import type {
  ZavorthNativeRegistryParityNormalization,
} from '../../../src/runtime/external-agents/index.js';

const DOC = 'docs/190-wave-3-native-registry-parity-and-dependency-reduction.md';
const GO_NO_GO_DOC = 'docs/117-external-agent-full-absorption-go-no-go.md';
const PAUSE_DOC = 'docs/159-external-executor-secret-provisioning-pause.md';
const CAPABILITY_DOC = 'docs/185-wave-3-first-native-capability-registry-replacement-slice.md';
const DASHBOARD_DOC = 'docs/186-wave-3-dashboard-view-model-registry-native-slice.md';
const INTEGRATION_DOC = 'docs/187-wave-3-provider-channel-transport-native-registry.md';
const SESSION_DOC = 'docs/188-wave-3-session-history-native-registry.md';
const CONFIG_DOC = 'docs/189-wave-3-config-secrets-state-native-registry.md';
const BOUNDARY = 'src/runtime/external-agents/ZavorthNativeRegistryParityDependencyReduction.ts';
const INDEX = 'src/runtime/external-agents/index.ts';
const RAW_GATEWAY_TOKEN_ASSIGNMENT_PATTERN = new RegExp(
  'EXTERNAL_EXECUTOR_GATEWAY_TOKEN' + '=(?!present-redacted|<redacted-local-secret>)[^\\s`]+',
);

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('Zavorth native registry parity and dependency reduction', () => {
  let normalized: ZavorthNativeRegistryParityNormalization;

  beforeAll(() => {
    normalized = normalizeZavorthNativeRegistryParityDependencyReductionFixture();
  });

  it('documents 190 as the native registry parity and dependency reduction gate', () => {
    const content = read(DOC);

    expect(content).toContain('Status: native-registry-parity-ready');
    expect(content).toContain('ZavorthNativeRegistryParityDependencyReduction/v1');
    expect(content).toContain('ZavorthNativeRegistryParitySurface/v1');
    expect(content).toContain('ZavorthNativeRegistryDependencyReduction/v1');
    expect(content).toContain('ZavorthNativeRegistryParityGap/v1');
    expect(content).toContain('docs/161-wave-1-real-capability-snapshot-read-only.md');
    expect(content).toContain('docs/169-wave-1-external-executor-live-read-only-bridge-boundary.md');
    expect(content).toContain('docs/170-wave-1-external-executor-live-observability-projection.md');
    expect(content).toContain('docs/171-wave-1-external-executor-read-only-event-stream-adapter.md');
    expect(content).toContain('docs/172-wave-1-external-executor-session-history-read-only-bridge.md');
    expect(content).toContain('docs/173-wave-1-command-center-live-assimilation.md');
    expect(content).toContain('docs/185-wave-3-first-native-capability-registry-replacement-slice.md');
    expect(content).toContain('docs/186-wave-3-dashboard-view-model-registry-native-slice.md');
    expect(content).toContain('docs/187-wave-3-provider-channel-transport-native-registry.md');
    expect(content).toContain('docs/188-wave-3-session-history-native-registry.md');
    expect(content).toContain('docs/189-wave-3-config-secrets-state-native-registry.md');
    expect(content).toContain('runtimeExternalExecutorRequiredForNativeReadyLookup: false');
    expect(content).toContain('runtimeExternalExecutorRequiredForNativeReadyRender: false');
    expect(content).toContain('adapterRemovalAllowed: false');
    expect(content).not.toMatch(RAW_GATEWAY_TOKEN_ASSIGNMENT_PATTERN);
    expect(content).not.toMatch(/(^|[^A-Za-z])sk-[A-Za-z0-9_-]{8,}/);
  });

  it('updates tracking docs and prior registry slices for 190', () => {
    expect(read(GO_NO_GO_DOC)).toContain('docs/190-wave-3-native-registry-parity-and-dependency-reduction.md');
    expect(read(PAUSE_DOC)).toContain('`190` is the native registry parity and dependency-reduction gate');
    expect(read(CAPABILITY_DOC)).toContain('native registry parity follow-up: docs/190-wave-3-native-registry-parity-and-dependency-reduction.md');
    expect(read(DASHBOARD_DOC)).toContain('native registry parity follow-up: docs/190-wave-3-native-registry-parity-and-dependency-reduction.md');
    expect(read(INTEGRATION_DOC)).toContain('native registry parity follow-up: docs/190-wave-3-native-registry-parity-and-dependency-reduction.md');
    expect(read(SESSION_DOC)).toContain('native registry parity follow-up: docs/190-wave-3-native-registry-parity-and-dependency-reduction.md');
    expect(read(CONFIG_DOC)).toContain('native registry parity follow-up: docs/190-wave-3-native-registry-parity-and-dependency-reduction.md');
    expect(read(CONFIG_DOC)).toContain('Do not advance to `191`');
  });

  it('exports the parity checker boundary and contracts', () => {
    const boundary = read(BOUNDARY);
    const index = read(INDEX);

    expect(boundary).toContain('ZavorthNativeRegistryParityDependencyReduction/v1');
    expect(boundary).toContain('ZavorthNativeRegistryParityChecker');
    expect(boundary).toContain('normalizeZavorthNativeRegistryParityDependencyReduction');
    expect(index).toContain("from './ZavorthNativeRegistryParityDependencyReduction.js'");
    expect(index).toContain('ZavorthNativeRegistryParityNormalization');
  });

  it('normalizes native registries against the read-only baselines', () => {
    expect(normalized.decision).toBe('native-registry-parity-ready');
    expect(normalized.sourceReadiness).toEqual({
      realCapabilitySnapshot: 'real-capability-snapshot-read-only-ok',
      liveReadOnlyBridge: 'external-executor-live-read-only-bridge-boundary-ready',
      observabilityProjection: 'external-executor-live-observability-projection-ready',
      eventStreamAdapter: 'external-executor-read-only-event-stream-adapter-ready',
      sessionHistoryBridge: 'external-executor-session-history-read-only-bridge-ready',
      commandCenterAssimilation: 'command-center-live-assimilation-ready',
      nativeCapabilityRegistry: 'native-capability-registry-replacement-ready',
      nativeDashboardViewModelRegistry: 'native-dashboard-view-model-registry-ready',
      nativeIntegrationRegistry: 'native-integration-registry-ready',
      nativeSessionHistoryRegistry: 'native-session-history-registry-ready',
      nativeConfigStateRegistry: 'native-config-state-registry-ready',
    });
    expect(normalized.surfaces.map((surface) => surface.id)).toEqual(expect.arrayContaining([
      'capability-lookup-classify',
      'dashboard-render-view-lookup',
      'provider-channel-transport-metadata-lookup',
      'session-history-metadata-lookup',
      'config-secretref-state-metadata-lookup',
      'live-refresh-reconciliation',
      'action-dispatch-execution',
      'state-migration-import',
    ]));
  });

  it('classifies native-ready, adapter-required, and blocked surfaces explicitly', () => {
    const surfacesById = new Map(normalized.surfaces.map((surface) => [surface.id, surface]));

    expect(surfacesById.get('capability-lookup-classify')?.classification).toBe('native-ready');
    expect(surfacesById.get('dashboard-render-view-lookup')?.classification).toBe('native-ready');
    expect(surfacesById.get('provider-channel-transport-metadata-lookup')?.classification).toBe('native-ready');
    expect(surfacesById.get('session-history-metadata-lookup')?.classification).toBe('native-ready');
    expect(surfacesById.get('config-secretref-state-metadata-lookup')?.classification).toBe('native-ready');
    expect(surfacesById.get('live-refresh-reconciliation')?.classification).toBe('adapter-required');
    expect(surfacesById.get('action-dispatch-execution')?.classification).toBe('blocked');
    expect(surfacesById.get('state-migration-import')?.classification).toBe('blocked');

    normalized.surfaces.forEach((surface) => {
      expect(surface.runtimeExternalExecutorRequiredForLookup).toBe(false);
      expect(surface.runtimeExternalExecutorRequiredForRender).toBe(false);
      expect(surface.adapterRemovalAllowed).toBe(false);
      expect(surface.executionAuthority).toBe(false);
      expect(surface.rawSecretSerialized).toBe(false);
    });
  });

  it('proves each native registry answers without live ExternalExecutor', () => {
    const capabilityRegistry = createZavorthNativeCapabilityRegistryFixture();
    const dashboardRegistry = createZavorthNativeDashboardViewModelRegistryFixture();
    const integrationRegistry = createZavorthNativeIntegrationRegistryFixture();
    const sessionRegistry = createZavorthNativeSessionHistoryRegistryFixture();
    const configStateRegistry = createZavorthNativeConfigStateRegistryFixture();
    const capabilityEntry = capabilityRegistry.list()[0];
    const dashboardRecord = dashboardRegistry.list()[0];
    const integrationRecord = integrationRegistry.list()[0];
    const sessionRecord = sessionRegistry.listSessions()[0];
    const configRecord = configStateRegistry.list()[0];

    expect(capabilityRegistry.lookup(capabilityEntry.id)).toEqual(expect.objectContaining({
      found: true,
      runtimeExternalExecutorRequiredForLookup: false,
    }));
    expect(capabilityRegistry.classify(capabilityEntry.id)).not.toBe('missing');
    expect(dashboardRegistry.lookup(dashboardRecord.id)).toEqual(expect.objectContaining({
      found: true,
      runtimeExternalExecutorRequiredForDashboardRender: false,
      runtimeExternalExecutorRequiredForDashboardViewLookup: false,
    }));
    expect(dashboardRegistry.render().runtimeExternalExecutorRequiredForDashboardRender).toBe(false);
    expect(integrationRegistry.lookup(integrationRecord.id)).toEqual(expect.objectContaining({
      found: true,
      runtimeExternalExecutorRequiredForIntegrationLookup: false,
      runtimeExternalExecutorRequiredForTransportClassification: false,
    }));
    expect(integrationRegistry.classify(integrationRecord.id)).not.toBe('missing');
    expect(sessionRegistry.lookupSession(sessionRecord.id)).toEqual(expect.objectContaining({
      found: true,
      runtimeExternalExecutorRequiredForSessionLookup: false,
      runtimeExternalExecutorRequiredForHistoryRender: false,
    }));
    expect(sessionRegistry.renderDashboardProjection().length).toBeGreaterThan(0);
    expect(configStateRegistry.lookup(configRecord.id)).toEqual(expect.objectContaining({
      found: true,
      runtimeExternalExecutorRequiredForConfigLookup: false,
      runtimeExternalExecutorRequiredForSecretMetadataLookup: false,
    }));
    expect(configStateRegistry.toDashboardProjection().length).toBeGreaterThan(0);
  });

  it('routes Command Center native-ready surfaces through native registries', () => {
    const checker = createZavorthNativeRegistryParityCheckerFixture();
    const nativeReadySurfaces = checker.nativeReadySurfaces();
    const routes = checker.commandCenterNativeRoutes();
    const publicRoutes = JSON.stringify(routes);

    expect(nativeReadySurfaces).toHaveLength(5);
    expect(routes).toHaveLength(5);
    routes.forEach((route) => {
      expect(route.commandCenterUsesNativeRegistry).toBe(true);
      expect(route.runtimeExternalExecutorRequiredForRender).toBe(false);
      expect(route.publicSourceIdentityExposed).toBe(false);
      expect(route.rawSecretSerialized).toBe(false);
    });
    expect(publicRoutes).not.toContain('sourceRuntimeNameInternal');
    expect(publicRoutes).not.toContain('sourceRuntimePublicIdentity');
    expect(publicRoutes).not.toMatch(RAW_GATEWAY_TOKEN_ASSIGNMENT_PATTERN);
  });

  it('keeps remaining gaps explicit before adapter removal', () => {
    const gapsById = new Map(normalized.remainingGaps.map((gap) => [gap.id, gap]));

    expect(gapsById.get('live-refresh-reconciliation-gap')?.classification).toBe('adapter-required');
    expect(gapsById.get('execution-dispatch-gap')?.classification).toBe('blocked');
    expect(gapsById.get('state-migration-import-gap')?.classification).toBe('blocked');
    expect(gapsById.get('adapter-removal-gap')?.classification).toBe('deferred');
    normalized.remainingGaps.forEach((gap) => {
      expect(gap.adapterRemovalAllowed).toBe(false);
      expect(gap.executionAuthority).toBe(false);
      expect(gap.nextGateRequired).toMatch(/future-/);
    });
  });

  it('records dependency reduction without granting execution or adapter removal', () => {
    expect(normalized.dependencyReduction).toEqual({
      nativeContract: 'ZavorthNativeRegistryDependencyReduction/v1',
      capabilityLookupNativeReady: true,
      dashboardRenderNativeReady: true,
      integrationLookupNativeReady: true,
      sessionHistoryLookupNativeReady: true,
      configStateLookupNativeReady: true,
      commandCenterCanUseNativeReadySurfaces: true,
      liveExternalExecutorOptionalForRefreshOnly: true,
      adapterStillRequiredForRefreshReconciliation: true,
      adapterStillRequiredForUnreplacedSurfaces: true,
      adapterRemovalAllowed: false,
    });
    expect(normalized.executionGate).toEqual({
      runtimeExternalExecutorRequiredForNativeReadyLookup: false,
      runtimeExternalExecutorRequiredForNativeReadyRender: false,
      adapterRemovalAllowed: false,
      sourceRuntimeAuthority: false,
      executionAuthority: false,
      messageActuallySent: false,
      providerActuallyExecuted: false,
      commandActuallyExecuted: false,
      toolActuallyExecuted: false,
      stateMigrated: false,
      sourceModuleCopied: false,
      rawSecretSerialized: false,
    });
    expect(normalized.redaction).toEqual({
      rawSecretSerialized: false,
      rawMessageContentSerialized: false,
      sourceIdentityPublic: false,
      sourceStructuresPublic: false,
      provenanceInternalOnly: true,
      serializedOutputContainsSensitiveFixture: false,
    });
    expect(normalized.nextGateRecommended).toBe('future-native-refresh-reconciliation-or-adapter-removal-parity-gate');
  });

  it('does not serialize raw secrets, perform execution, migrate state, or copy source modules', () => {
    const serialized = JSON.stringify(normalized);

    expect(serialized).not.toMatch(RAW_GATEWAY_TOKEN_ASSIGNMENT_PATTERN);
    expect(serialized).not.toMatch(/(^|[^A-Za-z])sk-[A-Za-z0-9_-]{8,}/);
    expect(serialized).not.toContain('synthetic-raw-credential-sentinel-that-must-not-appear');
    normalized.surfaces.forEach((surface) => {
      expect(surface.messageActuallySent).toBe(false);
      expect(surface.providerActuallyExecuted).toBe(false);
      expect(surface.commandActuallyExecuted).toBe(false);
      expect(surface.toolActuallyExecuted).toBe(false);
      expect(surface.stateMigrated).toBe(false);
      expect(surface.sourceModuleCopied).toBe(false);
      expect(surface.rawSecretSerialized).toBe(false);
    });
  });
});
