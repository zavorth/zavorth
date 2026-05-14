import fs from 'node:fs';
import path from 'node:path';

import {
  createZavorthNativeDashboardViewModelRegistryFixture,
  createZavorthNativeIntegrationRegistryFixture,
  createZavorthNativeSessionHistoryRegistryFixture,
  normalizeZavorthNativeSessionHistoryRegistryFixture,
} from '../../../src/runtime/external-agents/index.js';

const DOC = 'docs/188-wave-3-session-history-native-registry.md';
const GO_NO_GO_DOC = 'docs/117-external-agent-full-absorption-go-no-go.md';
const PAUSE_DOC = 'docs/159-external-executor-secret-provisioning-pause.md';
const SQLITE_DESIGN_DOC = 'docs/167-wave-1-sqlite-session-store-dry-run-design.md';
const SESSION_BRIDGE_DOC = 'docs/172-wave-1-external-executor-session-history-read-only-bridge.md';
const DASHBOARD_DOC = 'docs/186-wave-3-dashboard-view-model-registry-native-slice.md';
const INTEGRATION_DOC = 'docs/187-wave-3-provider-channel-transport-native-registry.md';
const BOUNDARY = 'src/runtime/external-agents/ZavorthNativeSessionHistoryRegistry.ts';
const INDEX = 'src/runtime/external-agents/index.ts';
const RAW_GATEWAY_TOKEN_ASSIGNMENT_PATTERN = new RegExp(
  'EXTERNAL_EXECUTOR_GATEWAY_TOKEN' + '=(?!present-redacted|<redacted-local-secret>)[^\\s`]+',
);

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('Zavorth native session/history registry', () => {
  it('documents 188 as the session/history native registry slice', () => {
    const content = read(DOC);

    expect(content).toContain('Status: native-session-history-registry-ready');
    expect(content).toContain('ZavorthNativeSessionHistoryRegistry/v1');
    expect(content).toContain('ZavorthNativeSessionMetadataRecord/v1');
    expect(content).toContain('ZavorthNativeThreadMetadataRecord/v1');
    expect(content).toContain('ZavorthNativeMessageMetadataRecord/v1');
    expect(content).toContain('docs/167-wave-1-sqlite-session-store-dry-run-design.md');
    expect(content).toContain('docs/172-wave-1-external-executor-session-history-read-only-bridge.md');
    expect(content).toContain('docs/173-wave-1-command-center-live-assimilation.md');
    expect(content).toContain('docs/185-wave-3-first-native-capability-registry-replacement-slice.md');
    expect(content).toContain('docs/186-wave-3-dashboard-view-model-registry-native-slice.md');
    expect(content).toContain('docs/187-wave-3-provider-channel-transport-native-registry.md');
    expect(content).toContain('runtimeExternalExecutorRequiredForSessionLookup: false');
    expect(content).toContain('runtimeExternalExecutorRequiredForHistoryRender: false');
    expect(content).toContain('nativeReplacementAuthorizedForSessionMetadata: true');
    expect(content).toContain('sourceDbOpenedForWrite: false');
    expect(content).toContain('sourceDbCopied: false');
    expect(content).not.toMatch(RAW_GATEWAY_TOKEN_ASSIGNMENT_PATTERN);
    expect(content).not.toMatch(/(^|[^A-Za-z])sk-[A-Za-z0-9_-]{8,}/);
  });

  it('updates tracking docs for the session registry closure', () => {
    expect(read(GO_NO_GO_DOC)).toContain('docs/188-wave-3-session-history-native-registry.md');
    expect(read(PAUSE_DOC)).toContain('`188` is the native session/history/message metadata registry slice');
    expect(read(SQLITE_DESIGN_DOC)).toContain('native registry follow-up: docs/188-wave-3-session-history-native-registry.md');
    expect(read(SESSION_BRIDGE_DOC)).toContain('native registry follow-up: docs/188-wave-3-session-history-native-registry.md');
    expect(read(DASHBOARD_DOC)).toContain('session registry follow-up: docs/188-wave-3-session-history-native-registry.md');
    expect(read(INTEGRATION_DOC)).toContain('session registry follow-up: docs/188-wave-3-session-history-native-registry.md');
  });

  it('exports the session registry boundary and contracts', () => {
    const boundary = read(BOUNDARY);
    const index = read(INDEX);

    expect(boundary).toContain('ZavorthNativeSessionHistoryRegistry/v1');
    expect(boundary).toContain('ZavorthNativeSessionHistoryRegistrySlice/v1');
    expect(boundary).toContain('normalizeZavorthNativeSessionHistoryRegistry');
    expect(index).toContain("from './ZavorthNativeSessionHistoryRegistry.js'");
    expect(index).toContain('ZavorthNativeSessionHistoryRegistryNormalization');
  });

  it('normalizes ExternalExecutor-derived session/history metadata into Zavorth-native records', () => {
    const normalized = normalizeZavorthNativeSessionHistoryRegistryFixture();

    expect(normalized.decision).toBe('native-session-history-registry-ready');
    expect(normalized.sourceReadiness).toEqual({
      sessionHistoryReadOnlyBridge: 'external-executor-session-history-read-only-bridge-ready',
      commandCenterAssimilation: 'command-center-live-assimilation-ready',
      nativeCapabilityRegistry: 'native-capability-registry-replacement-ready',
      dashboardViewModelRegistry: 'native-dashboard-view-model-registry-ready',
      nativeIntegrationRegistry: 'native-integration-registry-ready',
      sqliteDryRunDesign: 'sqlite-session-dry-run-design-no-real-db',
    });
    expect(normalized.registry.sourceArtifactsConsumed).toEqual({
      sqliteSessionStoreDryRunDesign: 'docs/167-wave-1-sqlite-session-store-dry-run-design.md',
      sessionHistoryReadOnlyBridge: 'docs/172-wave-1-external-executor-session-history-read-only-bridge.md',
      commandCenterAssimilation: 'docs/173-wave-1-command-center-live-assimilation.md',
      nativeCapabilityRegistry: 'docs/185-wave-3-first-native-capability-registry-replacement-slice.md',
      dashboardViewModelRegistry: 'docs/186-wave-3-dashboard-view-model-registry-native-slice.md',
      integrationRegistry: 'docs/187-wave-3-provider-channel-transport-native-registry.md',
      migrationStrategy: 'docs/162-wave-0-external-agent-config-state-migration-strategy.md',
      readOnlyInventory: 'docs/163-wave-1-external-agent-config-state-read-only-inventory.md',
      redactionSecretRefMapping: 'docs/164-wave-1-redaction-and-secretref-mapping.md',
      dryRunMigrationPlan: 'docs/165-wave-1-dry-run-migration-plan.md',
      rollbackRestoreRehearsal: 'docs/166-wave-1-rollback-restore-rehearsal.md',
    });
    expect(normalized.registry.sessions.length).toBeGreaterThanOrEqual(3);
    expect(normalized.registry.threads.length).toBe(normalized.registry.sessions.length);
    expect(normalized.registry.messages.length).toBeGreaterThan(0);
  });

  it('supports lookup, list, filter, and render without live ExternalExecutor', () => {
    const registry = createZavorthNativeSessionHistoryRegistryFixture();
    const readySession = registry.listSessions({ status: 'ready' })[0];
    const degradedOrUnavailable = registry.listSessions({ degradedOrUnavailable: true });
    const readyThreads = registry.listThreads({ sessionRecordId: readySession.id });
    const redactedMessages = registry.listMessages({ contentState: 'redacted' });
    const lookup = registry.lookupSession(readySession.id);
    const projection = registry.renderDashboardProjection();

    expect(lookup).toEqual(expect.objectContaining({
      found: true,
      runtimeExternalExecutorRequiredForSessionLookup: false,
      runtimeExternalExecutorRequiredForHistoryRender: false,
      sourceRuntimeAuthority: false,
    }));
    expect(registry.lookupThread(readyThreads[0].id).found).toBe(true);
    expect(registry.lookupMessage(redactedMessages[0].id).found).toBe(true);
    expect(degradedOrUnavailable.length).toBeGreaterThan(0);
    expect(degradedOrUnavailable.every((session) => (
      session.status === 'degraded' ||
      session.status === 'unavailable' ||
      session.status === 'unknown'
    ))).toBe(true);
    expect(projection).toHaveLength(registry.listSessions().length);
    projection.forEach((row) => {
      expect(row.nativeContract).toBe('ZavorthNativeSessionHistoryDashboardProjection/v1');
      expect(row.commandCenterConsumable).toBe(true);
      expect(row.sourceIdentityPublic).toBe(false);
      expect(row.messageContentRawStored).toBe(false);
      expect(row.executionAuthority).toBe(false);
    });
  });

  it('uses stable Zavorth aliases without leaking raw source ids', () => {
    const normalized = normalizeZavorthNativeSessionHistoryRegistryFixture();
    const publicSerialized = JSON.stringify({
      sessions: normalized.registry.sessions.map((session) => ({
        id: session.id,
        stableSessionId: session.stableSessionId,
        publicSessionAlias: session.publicSessionAlias,
        title: session.title,
        threadRecordIds: session.threadRecordIds,
        messageMetadataRecordIds: session.messageMetadataRecordIds,
      })),
      threads: normalized.registry.threads.map((thread) => ({
        id: thread.id,
        stableThreadId: thread.stableThreadId,
        publicThreadAlias: thread.publicThreadAlias,
      })),
      messages: normalized.registry.messages.map((message) => ({
        id: message.id,
        stableMessageId: message.stableMessageId,
        publicMessageAlias: message.publicMessageAlias,
      })),
      projection: normalized.dashboardProjection,
    });

    normalized.registry.sessions.forEach((session) => {
      expect(session.publicSessionAlias).toMatch(/^session:/);
      expect(session.title).not.toContain('ExternalExecutor');
      expect(session.stableSessionId).not.toContain('external-executor-live-session-private-123');
      expect(session.publicSessionAlias).not.toContain('external-executor');
      expect(session.participantMetadata.rawParticipantIdsSerialized).toBe(false);
    });
    normalized.registry.threads.forEach((thread) => {
      expect(thread.publicThreadAlias).toMatch(/^thread:/);
      expect(thread.rawThreadIdSerialized).toBe(false);
      expect(thread.stableThreadId).not.toContain('external-executor-thread-alpha-private-456');
    });
    normalized.registry.messages.forEach((message) => {
      expect(message.publicMessageAlias).toMatch(/^message:/);
      expect(message.stableMessageId).not.toContain('external-executor-message-private');
      expect(message.sourceIdsEvidenceOnly).toBe(true);
    });
    expect(publicSerialized).not.toContain('ExternalExecutor');
    expect(publicSerialized).not.toContain('external-executor-live-session-private-123');
    expect(publicSerialized).not.toContain('external-executor-thread-alpha-private-456');
    expect(publicSerialized).not.toContain('external-executor-message-private');
  });

  it('redacts or marks message content unavailable and stores no raw content', () => {
    const normalized = normalizeZavorthNativeSessionHistoryRegistryFixture();
    const serialized = JSON.stringify(normalized);

    expect(normalized.registry.indexes.messagesByContentState.redacted).toBeGreaterThan(0);
    expect(normalized.registry.indexes.messagesByContentState.unavailable).toBeGreaterThan(0);
    normalized.registry.messages.forEach((message) => {
      expect(['[redacted-content]', '[unavailable]']).toContain(message.contentPreview);
      expect(message.rawContentSerialized).toBe(false);
      expect(message.messageContentRawStored).toBe(false);
      expect(message.sensitiveContentRedacted).toBe(true);
    });
    expect(serialized).not.toContain('synthetic-external-executor-session-secret-that-must-not-appear');
    expect(serialized).not.toContain('operator text');
    expect(serialized).not.toContain('assistant response omitted');
    expect(serialized).not.toMatch(RAW_GATEWAY_TOKEN_ASSIGNMENT_PATTERN);
  });

  it('links dashboard view models and integration registry metadata when available', () => {
    const normalized = normalizeZavorthNativeSessionHistoryRegistryFixture();
    const dashboardRegistry = createZavorthNativeDashboardViewModelRegistryFixture();
    const integrationRegistry = createZavorthNativeIntegrationRegistryFixture();

    normalized.registry.sessions.forEach((session) => {
      expect(session.dashboardViewModelIds.length).toBeGreaterThan(0);
      expect(session.channelIntegrationIds.length).toBeGreaterThan(0);
      expect(session.transportIntegrationIds.length).toBeGreaterThan(0);
      session.dashboardViewModelIds.forEach((viewModelId) => {
        expect(dashboardRegistry.lookup(viewModelId).found).toBe(true);
      });
      session.channelIntegrationIds.forEach((integrationId) => {
        const lookup = integrationRegistry.lookup(integrationId);
        expect(lookup.found).toBe(true);
        expect(lookup.record?.integrationKind).toBe('channel');
      });
      session.transportIntegrationIds.forEach((integrationId) => {
        const lookup = integrationRegistry.lookup(integrationId);
        expect(lookup.found).toBe(true);
        expect(lookup.record?.integrationKind).toBe('message-transport');
      });
    });
    expect(normalized.integration).toEqual(expect.objectContaining({
      dashboardProjectionReady: true,
      integrationRegistryCrossReferenceReady: true,
      migrationDryRunOnly: true,
      sqliteRealDbNotOpened: true,
      messageContentRedactedOrUnavailable: true,
      runtimeExternalExecutorRequiredForSessionLookup: false,
      runtimeExternalExecutorRequiredForHistoryRender: false,
      publicSourceIdentityExposed: false,
    }));
  });

  it('keeps provenance internal, redacted, and non-authoritative', () => {
    const normalized = normalizeZavorthNativeSessionHistoryRegistryFixture();

    normalized.registry.sessions.forEach((session) => {
      expect(session.provenance).toEqual(expect.objectContaining({
        nativeContract: 'ZavorthNativeSessionHistoryProvenance/v1',
        sourceRuntimeNameInternal: 'ExternalExecutor',
        sourceRuntimePublicIdentity: false,
        sourceStructuresPublic: false,
        sourceIdsEvidenceOnly: true,
        redacted: true,
      }));
      expect(session.runtimeExternalExecutorRequiredForSessionLookup).toBe(false);
      expect(session.runtimeExternalExecutorRequiredForHistoryRender).toBe(false);
      expect(session.sourceRuntimeAuthority).toBe(false);
      expect(session.sessionImportAllowed).toBe(false);
      expect(session.migrationAllowed).toBe(false);
      expect(session.writeBackAllowed).toBe(false);
      expect(session.rawSecretSerialized).toBe(false);
    });
    expect(JSON.stringify(normalized)).not.toMatch(RAW_GATEWAY_TOKEN_ASSIGNMENT_PATTERN);
    expect(JSON.stringify(normalized)).not.toMatch(/(^|[^A-Za-z])sk-[A-Za-z0-9_-]{8,}/);
  });

  it('keeps migration, write-back, DB, execution, and adapter gates closed', () => {
    const normalized = normalizeZavorthNativeSessionHistoryRegistryFixture();

    expect(normalized.executionGate).toEqual({
      runtimeExternalExecutorRequiredForSessionLookup: false,
      runtimeExternalExecutorRequiredForHistoryRender: false,
      sourceRuntimeAuthority: false,
      sessionImportAllowed: false,
      migrationAllowed: false,
      writeBackAllowed: false,
      sourceDbOpenedForWrite: false,
      sourceDbCopied: false,
      messageContentRawStored: false,
      messageActuallySent: false,
      providerActuallyExecuted: false,
      commandActuallyExecuted: false,
      toolActuallyExecuted: false,
      sourceModuleCopied: false,
      nativeReplacementAuthorizedForSessionMetadata: true,
      adapterRemovalAllowed: false,
      rawSecretSerialized: false,
    });
    expect(normalized.registry).toEqual(expect.objectContaining({
      runtimeExternalExecutorRequiredForSessionLookup: false,
      runtimeExternalExecutorRequiredForHistoryRender: false,
      sourceRuntimeAuthority: false,
      sessionImportAllowed: false,
      migrationAllowed: false,
      writeBackAllowed: false,
      sourceDbOpenedForWrite: false,
      sourceDbCopied: false,
      messageContentRawStored: false,
      nativeReplacementAuthorizedForSessionMetadata: true,
      adapterRemovalAllowed: false,
      rawSecretSerialized: false,
    }));
    expect(normalized.dependencyReductionProof).toEqual({
      lookupWorksWithoutLiveExternalExecutor: true,
      listWorksWithoutLiveExternalExecutor: true,
      filterWorksWithoutLiveExternalExecutor: true,
      historyRenderWorksWithoutLiveExternalExecutor: true,
      dashboardConsumesNativeSessionRegistry: true,
      integrationRegistryCrossReferenceWorks: true,
    });
    expect(normalized.redaction).toEqual({
      rawSecretSerialized: false,
      rawMessageContentSerialized: false,
      messageContentRawStored: false,
      rawSourceIdsSerialized: false,
      sourceIdentityPublic: false,
      sourceStructuresPublic: false,
      provenanceInternalOnly: true,
      serializedOutputContainsSensitiveFixture: false,
    });
    expect(normalized.nextGateRecommended).toBe('future-session-history-native-refresh-or-migration-dry-run-gate');
  });
});
