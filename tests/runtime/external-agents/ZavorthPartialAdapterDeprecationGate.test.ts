import fs from 'node:fs';
import path from 'node:path';

import {
  createZavorthPartialAdapterDeprecationPolicyFixture,
  normalizeZavorthPartialAdapterDeprecationGateFixture,
} from '../../../src/runtime/external-agents/index.js';
import type {
  ZavorthPartialAdapterDeprecationNormalization,
} from '../../../src/runtime/external-agents/index.js';

const DOC = 'docs/191-wave-3-partial-adapter-deprecation-gate.md';
const GO_NO_GO_DOC = 'docs/117-external-agent-full-absorption-go-no-go.md';
const PAUSE_DOC = 'docs/159-external-executor-secret-provisioning-pause.md';
const PARITY_DOC = 'docs/190-wave-3-native-registry-parity-and-dependency-reduction.md';
const BOUNDARY = 'src/runtime/external-agents/ZavorthPartialAdapterDeprecationGate.ts';
const INDEX = 'src/runtime/external-agents/index.ts';
const RAW_GATEWAY_TOKEN_ASSIGNMENT_PATTERN = new RegExp(
  'EXTERNAL_EXECUTOR_GATEWAY_TOKEN' + '=(?!present-redacted|<redacted-local-secret>)[^\\s`]+',
);

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('Zavorth partial adapter deprecation gate', () => {
  let normalized: ZavorthPartialAdapterDeprecationNormalization;
  let policy: ReturnType<typeof createZavorthPartialAdapterDeprecationPolicyFixture>;

  beforeAll(() => {
    normalized = normalizeZavorthPartialAdapterDeprecationGateFixture();
    policy = createZavorthPartialAdapterDeprecationPolicyFixture();
  });

  it('documents 191 as the partial adapter deprecation gate', () => {
    const content = read(DOC);

    expect(content).toContain('Status: partial-adapter-deprecation-ready');
    expect(content).toContain('ZavorthPartialAdapterDeprecationGate/v1');
    expect(content).toContain('ZavorthPartialAdapterDeprecationSurfacePolicy/v1');
    expect(content).toContain('ZavorthPartialAdapterDeprecationConsumerRoute/v1');
    expect(content).toContain('ZavorthPartialAdapterRefreshPolicy/v1');
    expect(content).toContain('ZavorthPartialAdapterNativeOnlyGuard/v1');
    expect(content).toContain('docs/185-wave-3-first-native-capability-registry-replacement-slice.md');
    expect(content).toContain('docs/186-wave-3-dashboard-view-model-registry-native-slice.md');
    expect(content).toContain('docs/187-wave-3-provider-channel-transport-native-registry.md');
    expect(content).toContain('docs/188-wave-3-session-history-native-registry.md');
    expect(content).toContain('docs/189-wave-3-config-secrets-state-native-registry.md');
    expect(content).toContain('docs/190-wave-3-native-registry-parity-and-dependency-reduction.md');
    expect(content).toContain('nativeFirstLookupEnabled: true');
    expect(content).toContain('adapterDefaultPathForNativeReadySurfaces: false');
    expect(content).toContain('adapterRemovalAllowed: false');
    expect(content).not.toMatch(RAW_GATEWAY_TOKEN_ASSIGNMENT_PATTERN);
    expect(content).not.toMatch(/(^|[^A-Za-z])sk-[A-Za-z0-9_-]{8,}/);
  });

  it('updates tracking docs for the partial adapter deprecation gate', () => {
    expect(read(GO_NO_GO_DOC)).toContain('docs/191-wave-3-partial-adapter-deprecation-gate.md');
    expect(read(PAUSE_DOC)).toContain('`191` is the partial adapter deprecation gate');
    expect(read(PARITY_DOC)).toContain('partial adapter deprecation follow-up: docs/191-wave-3-partial-adapter-deprecation-gate.md');
    expect(read(PARITY_DOC)).toContain('Do not advance to');
    expect(read(PARITY_DOC)).toContain('`192`');
  });

  it('exports the deprecation policy boundary and contracts', () => {
    const boundary = read(BOUNDARY);
    const index = read(INDEX);

    expect(boundary).toContain('ZavorthPartialAdapterDeprecationGate/v1');
    expect(boundary).toContain('ZavorthPartialAdapterDeprecationPolicy');
    expect(boundary).toContain('normalizeZavorthPartialAdapterDeprecationGate');
    expect(index).toContain("from './ZavorthPartialAdapterDeprecationGate.js'");
    expect(index).toContain('ZavorthPartialAdapterDeprecationNormalization');
  });

  it('normalizes the 190 parity checker into partial adapter deprecation policy', () => {
    expect(normalized.decision).toBe('partial-adapter-deprecation-ready');
    expect(normalized.sourceReadiness).toEqual({
      nativeRegistryParity: 'native-registry-parity-ready',
      nativeCapabilityRegistry: 'native-capability-registry-replacement-ready',
      nativeDashboardViewModelRegistry: 'native-dashboard-view-model-registry-ready',
      nativeIntegrationRegistry: 'native-integration-registry-ready',
      nativeSessionHistoryRegistry: 'native-session-history-registry-ready',
      nativeConfigStateRegistry: 'native-config-state-registry-ready',
    });
    expect(normalized.deprecatedDefaultAdapterSurfaces).toEqual(expect.arrayContaining([
      'capability-lookup-classify',
      'dashboard-render-view-lookup',
      'provider-channel-transport-metadata-lookup',
      'session-history-metadata-lookup',
      'config-secretref-state-metadata-lookup',
    ]));
  });

  it('uses native-first by default for every native-ready surface', () => {
    const nativeFirstPolicies = policy.nativeFirstPolicies();

    expect(nativeFirstPolicies.map((row) => row.surfaceId)).toEqual(expect.arrayContaining([
      'capability-lookup-classify',
      'dashboard-render-view-lookup',
      'provider-channel-transport-metadata-lookup',
      'session-history-metadata-lookup',
      'config-secretref-state-metadata-lookup',
    ]));
    expect(nativeFirstPolicies).toHaveLength(5);
    nativeFirstPolicies.forEach((row) => {
      expect(row.policyMode).toBe('native-first');
      expect(row.defaultLookupPath).toBe('native-registry');
      expect(row.defaultRenderPath).toBe('native-registry');
      expect(row.adapterDefaultPathForNativeReadySurfaces).toBe(false);
      expect(row.adapterInvokedForDefaultLookup).toBe(false);
      expect(row.adapterInvokedForDefaultRender).toBe(false);
      expect(row.adapterRefreshAllowed).toBe(true);
      expect(row.fallbackBehavior).toBe('degraded-native-fallback');
      expect(row.runtimeExternalExecutorRequiredForNativeReadyLookup).toBe(false);
      expect(row.runtimeExternalExecutorRequiredForNativeReadyRender).toBe(false);
      expect(row.executionAuthority).toBe(false);
    });
  });

  it('keeps adapter available only for refresh, reconciliation, or degraded fallback', () => {
    expect(normalized.refreshPolicy).toEqual({
      nativeContract: 'ZavorthPartialAdapterRefreshPolicy/v1',
      policyMode: 'adapter-refresh-allowed',
      adapterRoles: [
        'optional-refresh-source',
        'reconciliation-source',
        'degraded-fallback',
        'not-default-render-lookup-path',
      ],
      allowedOnlyFor: [
        'refresh',
        'reconciliation',
        'degraded-fallback',
      ],
      nativeReadyDefaultPath: 'native-registry',
      adapterDefaultPathForNativeReadySurfaces: false,
      adapterRemovalAllowed: false,
      executionAuthority: false,
    });
    expect(normalized.nativeOnlyGuard).toEqual({
      nativeContract: 'ZavorthPartialAdapterNativeOnlyGuard/v1',
      policyMode: 'native-only',
      appliesTo: [
        'public-dashboard-identity',
        'raw-secret-values',
        'default-native-ready-render-lookup',
      ],
      adapterFallbackAllowedForTheseConcerns: false,
      rawSecretSerialized: false,
      publicSourceIdentityExposed: false,
    });
  });

  it('keeps gap surfaces adapter-required or blocked', () => {
    const refresh = policy.lookupPolicy('live-refresh-reconciliation');
    const action = policy.lookupPolicy('action-dispatch-execution');
    const migration = policy.lookupPolicy('state-migration-import');

    expect(refresh).toEqual(expect.objectContaining({
      policyMode: 'adapter-required',
      fallbackBehavior: 'adapter-refresh-only',
      adapterInvokedForDefaultLookup: false,
      adapterInvokedForDefaultRender: false,
      executionAuthority: false,
    }));
    expect(action).toEqual(expect.objectContaining({
      policyMode: 'blocked',
      fallbackBehavior: 'blocked',
      adapterRefreshAllowed: false,
      executionAuthority: false,
    }));
    expect(migration).toEqual(expect.objectContaining({
      policyMode: 'blocked',
      fallbackBehavior: 'blocked',
      stateMigrated: false,
      executionAuthority: false,
    }));
    expect(normalized.adapterRequiredSurfaces).toEqual(['live-refresh-reconciliation']);
    expect(normalized.blockedSurfaces).toEqual(expect.arrayContaining([
      'action-dispatch-execution',
      'state-migration-import',
    ]));
  });

  it('prepares Command Center and runtime consumers for native-first routes', () => {
    const routes = policy.consumerRoutes();
    const routesBySurface = new Map<string, number>();
    const serializedRoutes = JSON.stringify(routes);

    routes.forEach((route) => {
      routesBySurface.set(route.surfaceId, (routesBySurface.get(route.surfaceId) ?? 0) + 1);
      expect(route.path).toBe('native-first');
      expect(route.registryIds.length).toBeGreaterThan(0);
      expect(route.adapterInvokedForDefaultPath).toBe(false);
      expect(route.runtimeExternalExecutorRequiredForLookup).toBe(false);
      expect(route.runtimeExternalExecutorRequiredForRender).toBe(false);
      expect(route.publicSourceIdentityExposed).toBe(false);
      expect(route.rawSecretSerialized).toBe(false);
    });
    expect(routes).toHaveLength(15);
    normalized.deprecatedDefaultAdapterSurfaces.forEach((surfaceId) => {
      expect(routesBySurface.get(surfaceId)).toBe(3);
    });
    expect(serializedRoutes).not.toContain('sourceRuntimeNameInternal');
    expect(serializedRoutes).not.toMatch(RAW_GATEWAY_TOKEN_ASSIGNMENT_PATTERN);
  });

  it('keeps the required no-execution and no-removal guarantees closed', () => {
    expect(normalized.executionGate).toEqual({
      nativeFirstLookupEnabled: true,
      nativeFirstRenderEnabled: true,
      runtimeExternalExecutorRequiredForNativeReadyLookup: false,
      runtimeExternalExecutorRequiredForNativeReadyRender: false,
      adapterDefaultPathForNativeReadySurfaces: false,
      adapterRefreshAllowed: true,
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
    normalized.policies.forEach((row) => {
      expect(row.adapterInvokedForDefaultLookup).toBe(false);
      expect(row.adapterInvokedForDefaultRender).toBe(false);
      expect(row.sourceRuntimeAuthority).toBe(false);
      expect(row.executionAuthority).toBe(false);
      expect(row.messageActuallySent).toBe(false);
      expect(row.providerActuallyExecuted).toBe(false);
      expect(row.commandActuallyExecuted).toBe(false);
      expect(row.toolActuallyExecuted).toBe(false);
      expect(row.stateMigrated).toBe(false);
      expect(row.sourceModuleCopied).toBe(false);
      expect(row.rawSecretSerialized).toBe(false);
    });
  });

  it('does not serialize raw secrets or authorize public source identity', () => {
    const serialized = JSON.stringify(normalized);

    expect(normalized.redaction).toEqual({
      rawSecretSerialized: false,
      rawMessageContentSerialized: false,
      sourceIdentityPublic: false,
      sourceStructuresPublic: false,
      provenanceInternalOnly: true,
      serializedOutputContainsSensitiveFixture: false,
    });
    expect(serialized).not.toMatch(RAW_GATEWAY_TOKEN_ASSIGNMENT_PATTERN);
    expect(serialized).not.toMatch(/(^|[^A-Za-z])sk-[A-Za-z0-9_-]{8,}/);
    expect(serialized).not.toContain('synthetic-raw-credential-sentinel-that-must-not-appear');
    expect(normalized.nextGateRecommended).toBe('future-native-refresh-reconciliation-or-adapter-removal-parity-gate');
  });
});
