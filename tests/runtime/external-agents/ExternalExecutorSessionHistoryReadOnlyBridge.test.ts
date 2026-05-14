import fs from 'node:fs';
import path from 'node:path';

import {
  createExternalExecutorSessionHistoryReadOnlyBridgeFixtureSource,
  normalizeExternalExecutorSessionHistoryReadOnlyBridgeFixture,
} from '../../../src/runtime/external-agents/index.js';

const DOC = 'docs/172-wave-1-external-executor-session-history-read-only-bridge.md';
const BOUNDARY = 'src/runtime/external-agents/ExternalAgentExternalExecutorSessionHistoryReadOnlyBridge.ts';
const INDEX = 'src/runtime/external-agents/index.ts';
const SENSITIVE_SENTINEL = 'synthetic-external-executor-session-secret-that-must-not-appear';

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('ExternalExecutor session history read-only bridge', () => {
  it('documents 172 as read-only and tied to 161/169/170/171 plus migration gates', () => {
    const content = read(DOC);

    expect(content).toContain('Status: external-executor-session-history-read-only-bridge-ready');
    expect(content).toContain('docs/161-wave-1-real-capability-snapshot-read-only.md -> real-capability-snapshot-read-only-ok');
    expect(content).toContain('docs/169-wave-1-external-executor-live-read-only-bridge-boundary.md -> external-executor-live-read-only-bridge-boundary-ready');
    expect(content).toContain('docs/170-wave-1-external-executor-live-observability-projection.md -> external-executor-live-observability-projection-ready');
    expect(content).toContain('docs/171-wave-1-external-executor-read-only-event-stream-adapter.md -> external-executor-read-only-event-stream-adapter-ready');
    expect(content).toContain('docs/167-wave-1-sqlite-session-store-dry-run-design.md -> sqlite-session-dry-run-design-no-real-db');
    expect(content).toContain('nativeContract: ZavorthExternalSessionView/v1');
    expect(content).not.toMatch(/EXTERNAL_EXECUTOR_GATEWAY_TOKEN=(?!present-redacted|<redacted-local-secret>)[^\s`]+/);
    expect(content).not.toMatch(/sk-[A-Za-z0-9_-]{8,}/);
  });

  it('exports the Zavorth-owned session history bridge and public types', () => {
    const boundary = read(BOUNDARY);
    const index = read(INDEX);

    expect(boundary).toContain('ZavorthExternalExecutorSessionHistoryReadOnlyBridge/v1');
    expect(boundary).toContain('ZavorthExternalSessionView/v1');
    expect(boundary).toContain('normalizeExternalExecutorSessionHistoryReadOnlyBridge');
    expect(boundary).toContain('createExternalExecutorSessionHistoryReadOnlyBridgeFixtureSource');
    expect(index).toContain("from './ExternalAgentExternalExecutorSessionHistoryReadOnlyBridge.js'");
    expect(index).toContain('ZavorthExternalSessionView');
  });

  it('normalizes ExternalExecutor-like sessions into ZavorthExternalSessionView rows', () => {
    const source = createExternalExecutorSessionHistoryReadOnlyBridgeFixtureSource();
    const normalized = normalizeExternalExecutorSessionHistoryReadOnlyBridgeFixture();

    expect(source.eventStream.decision).toBe('external-executor-read-only-event-stream-adapter-ready');
    expect(source.sourceDbOpenedForWrite).toBe(false);
    expect(source.sourceDbCopied).toBe(false);
    expect(normalized).toEqual(expect.objectContaining({
      nativeContract: 'ZavorthExternalExecutorSessionHistoryReadOnlyBridge/v1',
      decision: 'external-executor-session-history-read-only-bridge-ready',
      readOnly: true,
      sourceSnapshotDoc: 'docs/161-wave-1-real-capability-snapshot-read-only.md',
      eventStreamDoc: 'docs/171-wave-1-external-executor-read-only-event-stream-adapter.md',
      sqliteDryRunDesignDoc: 'docs/167-wave-1-sqlite-session-store-dry-run-design.md',
    }));
    expect(normalized.sessionViews).toHaveLength(3);
    normalized.sessionViews.forEach((view) => {
      expect(view.nativeContract).toBe('ZavorthExternalSessionView/v1');
      expect(view.stableSessionId).toMatch(/^zavorth_session_view:/);
      expect(view.source.sourceIdsEvidenceOnly).toBe(true);
      expect(view.threadLinkage.stableThreadId).toMatch(/^zavorth_thread_view:/);
      expect(view.threadLinkage.rawThreadIdSerialized).toBe(false);
      expect(view.readOnly).toBe(true);
      expect(view.importAuthority).toBe(false);
      expect(view.migrationAllowed).toBe(false);
      expect(view.writeBackAllowed).toBe(false);
      expect(view.sourceDbOpenedForWrite).toBe(false);
      expect(view.sourceModuleCopied).toBe(false);
      expect(view.nativeReplacementAuthorized).toBe(false);
    });
  });

  it('normalizes message and thread metadata as redacted Zavorth-native views', () => {
    const normalized = normalizeExternalExecutorSessionHistoryReadOnlyBridgeFixture();
    const ready = normalized.sessionViews.find((view) => view.status === 'ready');

    expect(ready?.messages).toHaveLength(2);
    ready?.messages.forEach((message) => {
      expect(message.nativeContract).toBe('ZavorthExternalMessageMetadataView/v1');
      expect(message.stableMessageId).toMatch(/^zavorth_message_view:/);
      expect(message.sessionViewId).toBe(ready.id);
      expect(message.contentPreview).toBe('[redacted-content]');
      expect(message.sensitiveContentRedacted).toBe(true);
      expect(message.rawContentSerialized).toBe(false);
      expect(message.sourceIdsEvidenceOnly).toBe(true);
    });
    const unavailableMessage = normalized.sessionViews
      .find((view) => view.status === 'unavailable')
      ?.messages[0];
    expect(unavailableMessage).toEqual(expect.objectContaining({
      contentState: 'unavailable',
      contentPreview: '[unavailable]',
      rawContentSerialized: false,
    }));
  });

  it('keeps stable aliases from leaking raw source IDs or sensitive content', () => {
    const normalized = normalizeExternalExecutorSessionHistoryReadOnlyBridgeFixture();
    const serialized = JSON.stringify(normalized);

    expect(serialized).not.toContain(SENSITIVE_SENTINEL);
    expect(serialized).not.toContain('external-executor-live-session-private-123');
    expect(serialized).not.toContain('external-executor-thread-alpha-private-456');
    expect(serialized).not.toContain('external-executor-message-private-1');
    expect(serialized).not.toContain('operator text');
    expect(normalized.redaction).toEqual({
      sensitiveContentRedacted: true,
      rawContentSerialized: false,
      rawSourceIdsSerialized: false,
      serializedOutputContainsSensitiveFixture: false,
    });
  });

  it('represents unavailable and degraded history without crashing Zavorth', () => {
    const normalized = normalizeExternalExecutorSessionHistoryReadOnlyBridgeFixture();

    expect(normalized.sessionViews.map((view) => view.status)).toEqual([
      'ready',
      'unavailable',
      'degraded',
    ]);
    expect(normalized.failures.map((failure) => [failure.status, failure.reason])).toEqual([
      ['unavailable', 'history-not-read-by-161-169-170-171'],
      ['degraded', 'metadata-only-history-surface'],
    ]);
    normalized.failures.forEach((failure) => {
      expect(failure.rawExceptionSerialized).toBe(false);
      expect(failure.zavorthRuntimeFailed).toBe(false);
    });
  });

  it('exposes read-only Command Center session views', () => {
    const normalized = normalizeExternalExecutorSessionHistoryReadOnlyBridgeFixture();

    expect(normalized.commandCenterViews).toHaveLength(3);
    normalized.commandCenterViews.forEach((view) => {
      expect(view.nativeContract).toBe('ZavorthExternalSessionCommandCenterView/v1');
      expect(view.commandCenterConsumable).toBe(true);
      expect(view.readOnly).toBe(true);
      expect(view.importAuthority).toBe(false);
      expect(view.migrationAllowed).toBe(false);
      expect(view.writeBackAllowed).toBe(false);
    });
  });

  it('grants no import, migration, write-back, execution, or replacement authority', () => {
    const normalized = normalizeExternalExecutorSessionHistoryReadOnlyBridgeFixture();

    expect(normalized.executionGate).toEqual({
      importAuthority: false,
      migrationAllowed: false,
      writeBackAllowed: false,
      sourceDbOpenedForWrite: false,
      sourceDbCopied: false,
      sourceStateMigrated: false,
      sourceModuleCopied: false,
      nativeReplacementAuthorized: false,
      actionDispatchAllowed: false,
      messageSendAllowed: false,
      providerExecutionAllowed: false,
      commandExecutionAllowed: false,
      rawSecretSerialized: false,
    });
    expect(normalized.nextGateRecommended).toBe('future-read-only-session-schema-fingerprint-or-command-center-session-panel');
  });
});
