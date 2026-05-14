import fs from 'node:fs';
import path from 'node:path';

import {
  createZavorthNativeDashboardViewModelRegistryFixture,
  normalizeZavorthNativeDashboardViewModelRegistryFixture,
} from '../../../src/runtime/external-agents/index.js';

const DOC = 'docs/186-wave-3-dashboard-view-model-registry-native-slice.md';
const GO_NO_GO_DOC = 'docs/117-external-agent-full-absorption-go-no-go.md';
const PAUSE_DOC = 'docs/159-external-executor-secret-provisioning-pause.md';
const TARGET_DOC = 'docs/184-wave-3-native-absorption-target-selection.md';
const CAPABILITY_REGISTRY_DOC = 'docs/185-wave-3-first-native-capability-registry-replacement-slice.md';
const BOUNDARY = 'src/runtime/external-agents/ZavorthNativeDashboardViewModelRegistry.ts';
const INDEX = 'src/runtime/external-agents/index.ts';
const RAW_GATEWAY_TOKEN_ASSIGNMENT_PATTERN = new RegExp(
  'EXTERNAL_EXECUTOR_GATEWAY_TOKEN' + '=(?!present-redacted|<redacted-local-secret>)[^\\s`]+',
);

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('Zavorth native dashboard view model registry', () => {
  it('documents 186 as the native dashboard registry slice', () => {
    const content = read(DOC);

    expect(content).toContain('Status: native-dashboard-view-model-registry-ready');
    expect(content).toContain('ZavorthNativeDashboardViewModelRegistry/v1');
    expect(content).toContain('ZavorthNativeDashboardViewModelRecord/v1');
    expect(content).toContain('ZavorthNativeDashboardRenderResult/v1');
    expect(content).toContain('docs/161-wave-1-real-capability-snapshot-read-only.md');
    expect(content).toContain('docs/172-wave-1-external-executor-session-history-read-only-bridge.md');
    expect(content).toContain('docs/185-wave-3-first-native-capability-registry-replacement-slice.md');
    expect(content).toContain('runtimeExternalExecutorRequiredForDashboardViewLookup: false');
    expect(content).toContain('runtimeExternalExecutorRequiredForDashboardRender: false');
    expect(content).toContain('adapterRemovalAllowed: false');
    expect(content).not.toMatch(RAW_GATEWAY_TOKEN_ASSIGNMENT_PATTERN);
    expect(content).not.toMatch(/(^|[^A-Za-z])sk-[A-Za-z0-9_-]{8,}/);
  });

  it('updates tracking docs for the dashboard registry closure', () => {
    expect(read(GO_NO_GO_DOC)).toContain('docs/186-wave-3-dashboard-view-model-registry-native-slice.md');
    expect(read(PAUSE_DOC)).toContain('`186` is the native dashboard/Command Center view model registry slice');
    expect(read(TARGET_DOC)).toContain('dashboard target closure: docs/186-wave-3-dashboard-view-model-registry-native-slice.md');
    expect(read(CAPABILITY_REGISTRY_DOC)).toContain('dashboard registry follow-up: docs/186-wave-3-dashboard-view-model-registry-native-slice.md');
  });

  it('exports the dashboard registry boundary and contracts', () => {
    const boundary = read(BOUNDARY);
    const index = read(INDEX);

    expect(boundary).toContain('ZavorthNativeDashboardViewModelRegistry/v1');
    expect(boundary).toContain('ZavorthNativeDashboardViewModelRegistrySlice/v1');
    expect(boundary).toContain('normalizeZavorthNativeDashboardViewModelRegistry');
    expect(index).toContain("from './ZavorthNativeDashboardViewModelRegistry.js'");
    expect(index).toContain('ZavorthNativeDashboardViewModelRegistryNormalization');
  });

  it('normalizes prior ExternalExecutor-derived artifacts into Zavorth-native dashboard records', () => {
    const normalized = normalizeZavorthNativeDashboardViewModelRegistryFixture();

    expect(normalized.decision).toBe('native-dashboard-view-model-registry-ready');
    expect(normalized.sourceReadiness).toEqual({
      realCapabilitySnapshot: 'real-capability-snapshot-read-only-ok',
      liveReadOnlyBridge: 'external-executor-live-read-only-bridge-boundary-ready',
      observabilityProjection: 'external-executor-live-observability-projection-ready',
      eventStreamAdapter: 'external-executor-read-only-event-stream-adapter-ready',
      sessionHistoryBridge: 'external-executor-session-history-read-only-bridge-ready',
      commandCenterAssimilation: 'command-center-live-assimilation-ready',
      transportDiscovery: 'real-message-transport-capability-discovery-ready',
      nativeCapabilityRegistry: 'native-capability-registry-replacement-ready',
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
    });
    expect(normalized.registry.records.length).toBeGreaterThan(40);
  });

  it('covers every required dashboard view model type', () => {
    const normalized = normalizeZavorthNativeDashboardViewModelRegistryFixture();
    const viewTypes = new Set(normalized.registry.records.map((record) => record.viewType));

    expect(Array.from(viewTypes)).toEqual(expect.arrayContaining([
      'capability',
      'health-status',
      'event',
      'session',
      'message-metadata',
      'channel',
      'plugin',
      'provider',
      'gateway-lifecycle',
      'transport-metadata',
    ]));
    expect(normalized.registry.indexes.byType['transport-metadata']).toBeGreaterThan(0);
    expect(normalized.registry.indexes.byType['health-status']).toBeGreaterThanOrEqual(2);
  });

  it('supports lookup, list, filter, and render without live ExternalExecutor', () => {
    const registry = createZavorthNativeDashboardViewModelRegistryFixture();
    const capability = registry.list({ viewType: 'capability' })[0];
    const degradedOrUnavailable = registry.list({ degradedOrUnavailable: true });
    const lookup = registry.lookup(capability.id);
    const rendered = registry.render({ viewType: 'capability' });

    expect(lookup).toEqual(expect.objectContaining({
      found: true,
      runtimeExternalExecutorRequiredForDashboardViewLookup: false,
      runtimeExternalExecutorRequiredForDashboardRender: false,
      sourceRuntimeAuthority: false,
    }));
    expect(degradedOrUnavailable.length).toBeGreaterThan(0);
    expect(degradedOrUnavailable.every((row) => row.status === 'degraded' || row.status === 'unavailable')).toBe(true);
    expect(rendered.runtimeExternalExecutorRequiredForDashboardRender).toBe(false);
    expect(rendered.runtimeExternalExecutorRequiredForCapabilityLookup).toBe(false);
    expect(rendered.rows).toHaveLength(registry.list({ viewType: 'capability' }).length);
  });

  it('sources capability cards and transport metadata from the 185 registry', () => {
    const registry = createZavorthNativeDashboardViewModelRegistryFixture();
    const capabilityCards = registry.list({ provenanceSourceKind: 'native-capability-registry' });
    const transports = registry.list({ viewType: 'transport-metadata' });

    expect(capabilityCards.length).toBeGreaterThan(10);
    expect(transports.length).toBeGreaterThan(5);
    capabilityCards.forEach((card) => {
      expect(card.capabilityRegistryEntryId).toBeDefined();
      expect(card.runtimeExternalExecutorRequiredForCapabilityLookup).toBe(false);
      expect(card.sourceRuntimeAuthority).toBe(false);
    });
    transports.forEach((transport) => {
      expect(transport.capabilityRegistryEntryId).toContain('transport-entry');
      expect(transport.messageActuallySent).toBe(false);
    });
  });

  it('renders public rows without exposing source identity or sensitive content', () => {
    const registry = createZavorthNativeDashboardViewModelRegistryFixture();
    const rendered = registry.render();
    const serialized = JSON.stringify(rendered);

    expect(rendered.sourceIdentityPublic).toBe(false);
    rendered.rows.forEach((row) => {
      expect(row.nativeContract).toBe('ZavorthNativeDashboardRenderedViewModel/v1');
      expect(row.sourceIdentityPublic).toBe(false);
      expect(row.sourceStructuresPublic).toBe(false);
      expect(row.executionAuthority).toBe(false);
      expect(row.hasInternalProvenance).toBe(true);
      expect(row.label).not.toContain('ExternalExecutor');
      expect(row.summary).not.toContain('ExternalExecutor');
    });
    expect(serialized).not.toContain('synthetic-external-executor-session-secret-that-must-not-appear');
    expect(serialized).not.toMatch(RAW_GATEWAY_TOKEN_ASSIGNMENT_PATTERN);
  });

  it('keeps internal provenance redacted and non-authoritative', () => {
    const normalized = normalizeZavorthNativeDashboardViewModelRegistryFixture();

    normalized.registry.records.forEach((record) => {
      expect(record.provenance).toEqual(expect.objectContaining({
        nativeContract: 'ZavorthNativeDashboardViewModelProvenance/v1',
        sourceRuntimeNameInternal: 'ExternalExecutor',
        sourceRuntimePublicIdentity: false,
        sourceStructuresPublic: false,
        sourceIdsEvidenceOnly: true,
        redacted: true,
      }));
      expect(record.sourceRuntimeAuthority).toBe(false);
      expect(record.executionAuthority).toBe(false);
      expect(record.rawSecretSerialized).toBe(false);
    });
    expect(JSON.stringify(normalized)).not.toMatch(RAW_GATEWAY_TOKEN_ASSIGNMENT_PATTERN);
    expect(JSON.stringify(normalized)).not.toMatch(/(^|[^A-Za-z])sk-[A-Za-z0-9_-]{8,}/);
  });

  it('keeps execution, live lookup, and adapter removal gates closed', () => {
    const normalized = normalizeZavorthNativeDashboardViewModelRegistryFixture();

    expect(normalized.executionGate).toEqual({
      runtimeExternalExecutorRequiredForDashboardViewLookup: false,
      runtimeExternalExecutorRequiredForDashboardRender: false,
      runtimeExternalExecutorRequiredForCapabilityLookup: false,
      sourceRuntimeAuthority: false,
      executionAuthority: false,
      messageActuallySent: false,
      providerActuallyExecuted: false,
      commandActuallyExecuted: false,
      toolActuallyExecuted: false,
      sourceModuleCopied: false,
      nativeReplacementAuthorizedForDashboardViewModels: true,
      adapterRemovalAllowed: false,
      rawSecretSerialized: false,
    });
    expect(normalized.dependencyReductionProof).toEqual({
      renderWorksWithoutLiveExternalExecutor: true,
      lookupWorksWithoutLiveExternalExecutor: true,
      filterWorksWithoutLiveExternalExecutor: true,
      capabilityLookupUses185Registry: true,
      degradedUnavailablePreserved: true,
    });
    expect(normalized.integration).toEqual(expect.objectContaining({
      commandCenterAdapterPrepared: true,
      commandCenterConsumesNativeRegistry: true,
      capabilityCardsFromNativeCapabilityRegistry: true,
      transportMetadataFromNativeCapabilityRegistry: true,
      runtimeExternalExecutorRequiredForDashboardRender: false,
      publicSourceIdentityExposed: false,
    }));
    expect(normalized.nextGateRecommended).toBe('future-dashboard-native-parity-or-native-refresh-gate');
  });
});
