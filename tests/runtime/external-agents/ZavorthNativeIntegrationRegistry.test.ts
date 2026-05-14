import fs from 'node:fs';
import path from 'node:path';

import {
  createZavorthNativeCapabilityRegistryFixture,
  createZavorthNativeDashboardViewModelRegistryFixture,
  createZavorthNativeIntegrationRegistryFixture,
  normalizeZavorthNativeIntegrationRegistryFixture,
} from '../../../src/runtime/external-agents/index.js';

const DOC = 'docs/187-wave-3-provider-channel-transport-native-registry.md';
const GO_NO_GO_DOC = 'docs/117-external-agent-full-absorption-go-no-go.md';
const PAUSE_DOC = 'docs/159-external-executor-secret-provisioning-pause.md';
const DISCOVERY_DOC = 'docs/183-wave-2-real-message-transport-capability-discovery.md';
const CAPABILITY_REGISTRY_DOC = 'docs/185-wave-3-first-native-capability-registry-replacement-slice.md';
const DASHBOARD_REGISTRY_DOC = 'docs/186-wave-3-dashboard-view-model-registry-native-slice.md';
const BOUNDARY = 'src/runtime/external-agents/ZavorthNativeIntegrationRegistry.ts';
const INDEX = 'src/runtime/external-agents/index.plugin-surfaces.ts';
const RAW_GATEWAY_TOKEN_ASSIGNMENT_PATTERN = new RegExp(
  'EXTERNAL_EXECUTOR_GATEWAY_TOKEN' + '=(?!present-redacted|<redacted-local-secret>)[^\\s`]+',
);

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('Zavorth native integration registry', () => {
  it('documents 187 as the provider/channel/transport native registry slice', () => {
    const content = read(DOC);

    expect(content).toContain('Status: native-integration-registry-ready');
    expect(content).toContain('ZavorthNativeIntegrationRegistry/v1');
    expect(content).toContain('ZavorthNativeIntegrationRecord/v1');
    expect(content).toContain('docs/161-wave-1-real-capability-snapshot-read-only.md');
    expect(content).toContain('docs/169-wave-1-external-executor-live-read-only-bridge-boundary.md');
    expect(content).toContain('docs/170-wave-1-external-executor-live-observability-projection.md');
    expect(content).toContain('docs/171-wave-1-external-executor-read-only-event-stream-adapter.md');
    expect(content).toContain('docs/172-wave-1-external-executor-session-history-read-only-bridge.md');
    expect(content).toContain('docs/173-wave-1-command-center-live-assimilation.md');
    expect(content).toContain('docs/183-wave-2-real-message-transport-capability-discovery.md');
    expect(content).toContain('docs/185-wave-3-first-native-capability-registry-replacement-slice.md');
    expect(content).toContain('docs/186-wave-3-dashboard-view-model-registry-native-slice.md');
    expect(content).toContain('runtimeExternalExecutorRequiredForIntegrationLookup: false');
    expect(content).toContain('runtimeExternalExecutorRequiredForTransportClassification: false');
    expect(content).toContain('nativeReplacementAuthorizedForIntegrationMetadata: true');
    expect(content).toContain('adapterRemovalAllowed: false');
    expect(content).not.toMatch(RAW_GATEWAY_TOKEN_ASSIGNMENT_PATTERN);
    expect(content).not.toMatch(/(^|[^A-Za-z])sk-[A-Za-z0-9_-]{8,}/);
  });

  it('updates tracking docs for the integration registry closure', () => {
    expect(read(GO_NO_GO_DOC)).toContain('docs/187-wave-3-provider-channel-transport-native-registry.md');
    expect(read(PAUSE_DOC)).toContain('`187` is the native provider/channel/transport integration metadata registry slice');
    expect(read(DISCOVERY_DOC)).toContain('docs/187-wave-3-provider-channel-transport-native-registry.md');
    expect(read(CAPABILITY_REGISTRY_DOC)).toContain('integration registry follow-up: docs/187-wave-3-provider-channel-transport-native-registry.md');
    expect(read(DASHBOARD_REGISTRY_DOC)).toContain('integration registry follow-up: docs/187-wave-3-provider-channel-transport-native-registry.md');
  });

  it('exports the integration registry boundary and contracts', () => {
    const boundary = read(BOUNDARY);
    const index = read(INDEX);

    expect(boundary).toContain('ZavorthNativeIntegrationRegistry/v1');
    expect(boundary).toContain('ZavorthNativeIntegrationRegistrySlice/v1');
    expect(boundary).toContain('normalizeZavorthNativeIntegrationRegistry');
    expect(index).toContain("from './ZavorthNativeIntegrationRegistry.js'");
    expect(index).toContain('ZavorthNativeIntegrationRegistryNormalization');
  });

  it('normalizes ExternalExecutor-derived integration metadata into Zavorth-native records', () => {
    const normalized = normalizeZavorthNativeIntegrationRegistryFixture();

    expect(normalized.decision).toBe('native-integration-registry-ready');
    expect(normalized.sourceReadiness).toEqual({
      realCapabilitySnapshot: 'real-capability-snapshot-read-only-ok',
      liveReadOnlyBridge: 'external-executor-live-read-only-bridge-boundary-ready',
      observabilityProjection: 'external-executor-live-observability-projection-ready',
      eventStreamAdapter: 'external-executor-read-only-event-stream-adapter-ready',
      sessionHistoryBridge: 'external-executor-session-history-read-only-bridge-ready',
      commandCenterAssimilation: 'command-center-live-assimilation-ready',
      transportDiscovery: 'real-message-transport-capability-discovery-ready',
      nativeCapabilityRegistry: 'native-capability-registry-replacement-ready',
      dashboardViewModelRegistry: 'native-dashboard-view-model-registry-ready',
    });
    expect(normalized.registry.sourceArtifactsConsumed).toEqual({
      realCapabilitySnapshot: 'docs/161-wave-1-real-capability-snapshot-read-only.md',
      liveReadOnlyBridge: 'docs/169-wave-1-external-executor-live-read-only-bridge-boundary.md',
      observabilityProjection: 'docs/170-wave-1-external-executor-live-observability-projection.md',
      eventStreamAdapter: 'docs/171-wave-1-external-executor-read-only-event-stream-adapter.md',
      sessionHistoryBridge: 'docs/172-wave-1-external-executor-session-history-read-only-bridge.md',
      commandCenterAssimilation: 'docs/173-wave-1-command-center-live-assimilation.md',
      transportDiscovery: 'docs/183-wave-2-real-message-transport-capability-discovery.md',
      nativeCapabilityRegistry: 'docs/185-wave-3-first-native-capability-registry-replacement-slice.md',
      dashboardViewModelRegistry: 'docs/186-wave-3-dashboard-view-model-registry-native-slice.md',
    });
    expect(normalized.registry.indexes.byKind.provider).toBeGreaterThan(0);
    expect(normalized.registry.indexes.byKind.channel).toBeGreaterThan(0);
    expect(normalized.registry.indexes.byKind['message-transport']).toBeGreaterThan(5);
  });

  it('supports lookup, list, filter, and classify without live ExternalExecutor', () => {
    const registry = createZavorthNativeIntegrationRegistryFixture();
    const provider = registry.list({ integrationKind: 'provider' })[0];
    const sendCapable = registry.list({ classification: 'send-capable-but-blocked' })[0];
    const degradedOrUnavailable = registry.list({ degradedOrUnavailable: true });
    const lookup = registry.lookup(provider.id);

    expect(lookup).toEqual(expect.objectContaining({
      found: true,
      runtimeExternalExecutorRequiredForIntegrationLookup: false,
      runtimeExternalExecutorRequiredForTransportClassification: false,
      sourceRuntimeAuthority: false,
    }));
    expect(registry.classify(provider.id)).toBe(provider.classification);
    expect(registry.classify(sendCapable.id)).toBe('send-capable-but-blocked');
    expect(registry.classify('missing-integration')).toBe('missing');
    expect(registry.list({ supportsSend: true }).every((record) => record.sendPolicy === 'blocked')).toBe(true);
    expect(degradedOrUnavailable.length).toBeGreaterThan(0);
    expect(degradedOrUnavailable.every((record) => (
      record.status === 'degraded' ||
      record.status === 'unavailable' ||
      record.status === 'unknown'
    ))).toBe(true);
  });

  it('keeps send-capable transports blocked and SecretRefs metadata-only', () => {
    const normalized = normalizeZavorthNativeIntegrationRegistryFixture();
    const sendCapable = normalized.registry.records.filter((record) => record.supportsSend);
    const secretRecords = normalized.registry.records.filter((record) => record.requiredSecretRefs.length > 0);

    expect(sendCapable.length).toBeGreaterThan(5);
    sendCapable.forEach((record) => {
      expect(record.integrationKind).toBe('message-transport');
      expect(record.classification).toBe('send-capable-but-blocked');
      expect(record.sendPolicy).toBe('blocked');
      expect(record.messageActuallySent).toBe(false);
      expect(record.transportActuallyOpened).toBe(false);
    });
    expect(secretRecords.length).toBeGreaterThan(0);
    secretRecords.forEach((record) => {
      record.requiredSecretRefs.forEach((secretRef) => {
        expect(secretRef.nativeContract).toBe('ZavorthNativeIntegrationSecretRefMetadata/v1');
        expect(secretRef.name).toMatch(/^(external-|external-executor-)/);
        expect(secretRef.rawValueSerialized).toBe(false);
        expect(JSON.stringify(secretRef)).not.toMatch(RAW_GATEWAY_TOKEN_ASSIGNMENT_PATTERN);
      });
    });
  });

  it('cross-references capability registry entries and feeds dashboard projection', () => {
    const normalized = normalizeZavorthNativeIntegrationRegistryFixture();
    const capabilityRegistry = createZavorthNativeCapabilityRegistryFixture();
    const dashboardRegistry = createZavorthNativeDashboardViewModelRegistryFixture();
    const registry = createZavorthNativeIntegrationRegistryFixture();
    const projections = registry.toDashboardProjection();

    normalized.crossReferences.forEach((reference) => {
      expect(reference.capabilityRegistryLookupRequiredExternalExecutorLive).toBe(false);
      expect(reference.dashboardLookupRequiredExternalExecutorLive).toBe(false);
      expect(reference.sourceAuthorityGranted).toBe(false);
      reference.capabilityRegistryEntryIds.forEach((entryId) => {
        expect(capabilityRegistry.lookup(entryId).found).toBe(true);
      });
      reference.dashboardViewModelIds.forEach((viewModelId) => {
        expect(dashboardRegistry.lookup(viewModelId).found).toBe(true);
      });
    });
    expect(projections).toHaveLength(registry.list().length);
    projections.forEach((projection) => {
      expect(projection.nativeContract).toBe('ZavorthNativeIntegrationDashboardProjection/v1');
      expect(projection.commandCenterConsumable).toBe(true);
      expect(projection.sourceIdentityPublic).toBe(false);
      expect(projection.executionAuthority).toBe(false);
      expect(projection.label).not.toContain('ExternalExecutor');
    });
    expect(normalized.dependencyReductionProof).toEqual({
      lookupWorksWithoutLiveExternalExecutor: true,
      listWorksWithoutLiveExternalExecutor: true,
      filterWorksWithoutLiveExternalExecutor: true,
      classifyWorksWithoutLiveExternalExecutor: true,
      capabilityRegistryCrossReferenceWorks: true,
      dashboardProjectionConsumesNativeMetadata: true,
    });
  });

  it('keeps provenance internal, redacted, and non-authoritative', () => {
    const normalized = normalizeZavorthNativeIntegrationRegistryFixture();

    normalized.registry.records.forEach((record) => {
      expect(record.provenance).toEqual(expect.objectContaining({
        nativeContract: 'ZavorthNativeIntegrationProvenance/v1',
        sourceRuntimeNameInternal: 'ExternalExecutor',
        sourceRuntimePublicIdentity: false,
        sourceStructuresPublic: false,
        sourceIdsEvidenceOnly: true,
        redacted: true,
      }));
      expect(record.runtimeExternalExecutorRequiredForIntegrationLookup).toBe(false);
      expect(record.runtimeExternalExecutorRequiredForTransportClassification).toBe(false);
      expect(record.sourceRuntimeAuthority).toBe(false);
      expect(record.executionAuthority).toBe(false);
      expect(record.rawSecretSerialized).toBe(false);
    });
    expect(JSON.stringify(normalized)).not.toMatch(RAW_GATEWAY_TOKEN_ASSIGNMENT_PATTERN);
    expect(JSON.stringify(normalized)).not.toMatch(/(^|[^A-Za-z])sk-[A-Za-z0-9_-]{8,}/);
  });

  it('keeps all execution and adapter-removal gates closed', () => {
    const normalized = normalizeZavorthNativeIntegrationRegistryFixture();

    expect(normalized.executionGate).toEqual({
      runtimeExternalExecutorRequiredForIntegrationLookup: false,
      runtimeExternalExecutorRequiredForTransportClassification: false,
      sourceRuntimeAuthority: false,
      executionAuthority: false,
      messageActuallySent: false,
      providerActuallyExecuted: false,
      commandActuallyExecuted: false,
      toolActuallyExecuted: false,
      transportActuallyOpened: false,
      sourceModuleCopied: false,
      nativeReplacementAuthorizedForIntegrationMetadata: true,
      adapterRemovalAllowed: false,
      rawSecretSerialized: false,
    });
    expect(normalized.integration).toEqual(expect.objectContaining({
      capabilityRegistryCrossReferenceReady: true,
      dashboardProjectionReady: true,
      sendCapableTransportsBlocked: true,
      secretRefsMetadataOnly: true,
      runtimeExternalExecutorRequiredForIntegrationLookup: false,
      runtimeExternalExecutorRequiredForTransportClassification: false,
      publicSourceIdentityExposed: false,
    }));
    expect(normalized.redaction).toEqual({
      rawSecretSerialized: false,
      secretRefsMetadataOnly: true,
      sourceIdentityPublic: false,
      sourceStructuresPublic: false,
      provenanceInternalOnly: true,
      serializedOutputContainsSensitiveFixture: false,
    });
    expect(normalized.nextGateRecommended).toBe('future-native-integration-refresh-or-dashboard-parity-gate');
  });
});
