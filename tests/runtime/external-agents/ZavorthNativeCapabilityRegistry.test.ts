import fs from 'node:fs';
import path from 'node:path';

import {
  createZavorthNativeCapabilityRegistryFixture,
  createZavorthNativeCapabilityRegistryFixtureSource,
  normalizeZavorthNativeCapabilityRegistryReplacementFixture,
  summarizeZavorthNativeCapabilityRegistryBridgeSurfaceKinds,
  summarizeZavorthNativeCapabilityRegistryEventKinds,
  summarizeZavorthNativeCapabilityRegistryTransportStates,
} from '../../../src/runtime/external-agents/index.js';

const DOC = 'docs/185-wave-3-first-native-capability-registry-replacement-slice.md';
const GO_NO_GO_DOC = 'docs/117-external-agent-full-absorption-go-no-go.md';
const PAUSE_DOC = 'docs/159-external-executor-secret-provisioning-pause.md';
const DISCOVERY_DOC = 'docs/183-wave-2-real-message-transport-capability-discovery.md';
const TARGET_DOC = 'docs/184-wave-3-native-absorption-target-selection.md';
const BOUNDARY = 'src/runtime/external-agents/ZavorthNativeCapabilityRegistry.ts';
const INDEX = 'src/runtime/external-agents/index.ts';
const RAW_GATEWAY_TOKEN_ASSIGNMENT_PATTERN = new RegExp(
  'EXTERNAL_EXECUTOR_GATEWAY_TOKEN' + '=(?!present-redacted|<redacted-local-secret>)[^\\s`]+',
);

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('Zavorth native capability registry replacement slice', () => {
  it('documents 185 as the first native capability registry replacement slice', () => {
    const content = read(DOC);

    expect(content).toContain('Status: native-capability-registry-replacement-ready');
    expect(content).toContain('ZavorthNativeCapabilityRegistry/v1');
    expect(content).toContain('ZavorthNativeCapabilityRegistryEntry/v1');
    expect(content).toContain('docs/161-wave-1-real-capability-snapshot-read-only.md');
    expect(content).toContain('docs/169-wave-1-external-executor-live-read-only-bridge-boundary.md');
    expect(content).toContain('docs/170-wave-1-external-executor-live-observability-projection.md');
    expect(content).toContain('docs/171-wave-1-external-executor-read-only-event-stream-adapter.md');
    expect(content).toContain('docs/173-wave-1-command-center-live-assimilation.md');
    expect(content).toContain('docs/175-wave-2-controlled-dry-run-action-planner.md');
    expect(content).toContain('docs/183-wave-2-real-message-transport-capability-discovery.md');
    expect(content).toContain('runtimeExternalExecutorRequiredForRegistryLookup: false');
    expect(content).toContain('nativeReplacementAuthorizedForRegistry: true');
    expect(content).toContain('rawSecretSerialized: false');
    expect(content).not.toMatch(RAW_GATEWAY_TOKEN_ASSIGNMENT_PATTERN);
    expect(content).not.toMatch(/(^|[^A-Za-z])sk-[A-Za-z0-9_-]{8,}/);
  });

  it('updates tracking docs to point at the registry replacement slice', () => {
    expect(read(GO_NO_GO_DOC)).toContain('docs/185-wave-3-first-native-capability-registry-replacement-slice.md');
    expect(read(PAUSE_DOC)).toContain('`185` is the first implemented native capability registry replacement slice');
    expect(read(DISCOVERY_DOC)).toContain('docs/185-wave-3-first-native-capability-registry-replacement-slice.md');
    expect(read(TARGET_DOC)).toContain('explicit follow-up accepted: docs/185-wave-3-first-native-capability-registry-replacement-slice.md');
  });

  it('exports the registry boundary and public contracts', () => {
    const boundary = read(BOUNDARY);
    const index = read(INDEX);

    expect(boundary).toContain('ZavorthNativeCapabilityRegistry/v1');
    expect(boundary).toContain('ZavorthNativeCapabilityRegistryReplacementSlice/v1');
    expect(boundary).toContain('normalizeZavorthNativeCapabilityRegistryReplacement');
    expect(index).toContain("from './ZavorthNativeCapabilityRegistry.js'");
    expect(index).toContain('ZavorthNativeCapabilityRegistryReplacementNormalization');
  });

  it('normalizes real ExternalExecutor-derived artifacts into a Zavorth-owned registry', () => {
    const normalized = normalizeZavorthNativeCapabilityRegistryReplacementFixture();

    expect(normalized.decision).toBe('native-capability-registry-replacement-ready');
    expect(normalized.routeAdjustmentFrom184).toEqual({
      originallySelectedTarget: 'dashboard-view-models',
      promotedTargetFor185: 'capability-plugin-registry',
      explicitOperatorRequest: true,
      commandCenterRemainsConsumer: true,
    });
    expect(normalized.sourceReadiness).toEqual({
      realCapabilitySnapshot: 'real-capability-snapshot-read-only-ok',
      liveReadOnlyBridge: 'external-executor-live-read-only-bridge-boundary-ready',
      observabilityProjection: 'external-executor-live-observability-projection-ready',
      eventStreamAdapter: 'external-executor-read-only-event-stream-adapter-ready',
      commandCenterAssimilation: 'command-center-live-assimilation-ready',
      dryRunPlanner: 'controlled-dry-run-action-planner-ready',
      transportDiscovery: 'real-message-transport-capability-discovery-ready',
    });
    expect(normalized.registry.nativeContract).toBe('ZavorthNativeCapabilityRegistry/v1');
    expect(normalized.registry.entries.length).toBeGreaterThanOrEqual(20);
    expect(normalized.registry.sourceArtifactsConsumed).toEqual({
      realCapabilitySnapshot: 'docs/161-wave-1-real-capability-snapshot-read-only.md',
      liveReadOnlyBridge: 'docs/169-wave-1-external-executor-live-read-only-bridge-boundary.md',
      observabilityProjection: 'docs/170-wave-1-external-executor-live-observability-projection.md',
      eventStreamAdapter: 'docs/171-wave-1-external-executor-read-only-event-stream-adapter.md',
      commandCenterAssimilation: 'docs/173-wave-1-command-center-live-assimilation.md',
      dryRunPlanner: 'docs/175-wave-2-controlled-dry-run-action-planner.md',
      transportDiscovery: 'docs/183-wave-2-real-message-transport-capability-discovery.md',
    });
  });

  it('covers capability, plugin, provider, channel, gateway, command, session, worker, and transport metadata', () => {
    const normalized = normalizeZavorthNativeCapabilityRegistryReplacementFixture();
    const kinds = new Set(normalized.registry.entries.map((entry) => entry.kind));
    const categories = new Set(normalized.registry.entries.map((entry) => entry.category));

    expect(Array.from(kinds)).toEqual(expect.arrayContaining([
      'plugin',
      'provider',
      'channel',
      'gateway-method',
      'command-http',
      'session-history',
      'worker-node',
      'message-transport',
    ]));
    expect(Array.from(categories)).toEqual(expect.arrayContaining([
      'plugin-capabilities',
      'provider-capabilities',
      'channel-capabilities',
      'gateway-method-capabilities',
      'command-http-capabilities',
      'session-history-capabilities',
      'worker-node-capabilities',
      'message-transport-capability',
    ]));
  });

  it('classifies entries with the required Zavorth-native states', () => {
    const normalized = normalizeZavorthNativeCapabilityRegistryReplacementFixture();
    const classifications = new Set(normalized.registry.entries.map((entry) => entry.classification));

    expect(Array.from(classifications)).toEqual(expect.arrayContaining([
      'approval-required',
      'blocked',
      'degraded',
      'read-only',
      'send-capable-but-blocked',
      'unavailable',
      'unsupported',
    ]));
    expect(normalized.registry.indexes.byClassification['send-capable-but-blocked']).toBeGreaterThan(5);
    expect(normalized.registry.indexes.byClassification['read-only']).toBeGreaterThan(0);
  });

  it('supports lookup, list, and classify without a live ExternalExecutor runtime', () => {
    const registry = createZavorthNativeCapabilityRegistryFixture();
    const pluginEntry = registry.list({ kind: 'plugin' })[0];
    const sendCapableEntry = registry.list({ classification: 'send-capable-but-blocked' })[0];
    const lookup = registry.lookup(pluginEntry.id);

    expect(pluginEntry.runtimeExternalExecutorRequiredForLookup).toBe(false);
    expect(lookup).toEqual(expect.objectContaining({
      found: true,
      runtimeExternalExecutorRequiredForLookup: false,
      sourceRuntimeAuthority: false,
    }));
    expect(registry.classify(pluginEntry.id)).toBe(pluginEntry.classification);
    expect(registry.classify(sendCapableEntry.id)).toBe('send-capable-but-blocked');
    expect(registry.classify('missing-entry')).toBe('missing');
  });

  it('feeds Command Center and planner consumers from the native registry only', () => {
    const normalized = normalizeZavorthNativeCapabilityRegistryReplacementFixture();
    const registry = createZavorthNativeCapabilityRegistryFixture();
    const commandCenterViews = registry.toCommandCenterViews();
    const plannerInputs = registry.toPlannerInputs();
    const publicSerialized = JSON.stringify(commandCenterViews);

    expect(commandCenterViews).toHaveLength(normalized.registry.entries.length);
    expect(plannerInputs).toHaveLength(normalized.registry.entries.length);
    commandCenterViews.forEach((view) => {
      expect(view.nativeContract).toBe('ZavorthNativeCapabilityRegistryCommandCenterView/v1');
      expect(view.sourceIdentityPublic).toBe(false);
      expect(view.sourceStructuresPublic).toBe(false);
      expect(view.executionAuthority).toBe(false);
    });
    plannerInputs.forEach((input) => {
      expect(input.nativeContract).toBe('ZavorthNativeCapabilityRegistryPlannerInput/v1');
      expect(input.sourceCapabilityInputOnly).toBe(true);
      expect(input.sourceAuthorityGranted).toBe(false);
      expect(input.directExternalInvocationAllowed).toBe(false);
      expect(input.executionAuthority).toBe(false);
    });
    expect(publicSerialized).not.toContain('ExternalExecutor');
  });

  it('keeps source provenance internal, redacted, and non-authoritative', () => {
    const normalized = normalizeZavorthNativeCapabilityRegistryReplacementFixture();

    normalized.registry.entries.forEach((entry) => {
      expect(entry.provenance).toEqual(expect.objectContaining({
        nativeContract: 'ZavorthNativeCapabilityRegistryProvenance/v1',
        sourceRuntimeNameInternal: 'ExternalExecutor',
        sourceRuntimePublicIdentity: false,
        sourceStructuresPublic: false,
        sourceIdsEvidenceOnly: true,
        redacted: true,
      }));
      expect(entry.sourceRuntimeAuthority).toBe(false);
      expect(entry.executionAuthority).toBe(false);
      expect(entry.rawSecretSerialized).toBe(false);
    });
    expect(JSON.stringify(normalized)).not.toMatch(RAW_GATEWAY_TOKEN_ASSIGNMENT_PATTERN);
    expect(JSON.stringify(normalized)).not.toMatch(/(^|[^A-Za-z])sk-[A-Za-z0-9_-]{8,}/);
  });

  it('summarizes bridge, event, and transport evidence consumed by the registry', () => {
    const source = createZavorthNativeCapabilityRegistryFixtureSource();

    expect(summarizeZavorthNativeCapabilityRegistryBridgeSurfaceKinds(source.liveReadOnlyBridge)).toEqual(expect.arrayContaining([
      'channel',
      'message',
      'event',
      'session',
      'plugin',
      'provider',
      'gateway-method',
    ]));
    expect(summarizeZavorthNativeCapabilityRegistryEventKinds(source.eventStreamAdapter)).toEqual(expect.arrayContaining([
      'health',
      'status',
      'capability',
      'channel',
      'plugin',
      'provider',
      'message-metadata',
      'session-metadata',
      'gateway-lifecycle',
      'unknown',
    ]));
    expect(summarizeZavorthNativeCapabilityRegistryTransportStates(source.transportDiscovery)).toEqual(expect.arrayContaining([
      'read-only',
      'unconfigured',
      'degraded-unknown',
    ]));
  });

  it('keeps all execution and mutation gates closed while authorizing only registry replacement', () => {
    const normalized = normalizeZavorthNativeCapabilityRegistryReplacementFixture();

    expect(normalized.executionGate).toEqual({
      runtimeExternalExecutorRequiredForRegistryLookup: false,
      sourceRuntimeAuthority: false,
      executionAuthority: false,
      messageActuallySent: false,
      providerActuallyExecuted: false,
      commandActuallyExecuted: false,
      toolActuallyExecuted: false,
      sourceModuleCopied: false,
      nativeReplacementAuthorizedForRegistry: true,
      rawSecretSerialized: false,
    });
    expect(normalized.dependencyReductionProof).toEqual({
      lookupWorksWithoutLiveExternalExecutor: true,
      listWorksWithoutLiveExternalExecutor: true,
      classifyWorksWithoutLiveExternalExecutor: true,
      commandCenterConsumerUsesRegistry: true,
      plannerConsumerUsesRegistry: true,
      liveExternalExecutorOptionalForRefreshOnly: true,
    });
    expect(normalized.redaction).toEqual({
      rawSecretSerialized: false,
      sourceIdentityPublic: false,
      sourceStructuresPublic: false,
      provenanceInternalOnly: true,
      serializedOutputContainsSensitiveFixture: false,
    });
    expect(normalized.nextGateRecommended).toBe('future-native-registry-refresh-or-dashboard-registry-slice');
  });
});
