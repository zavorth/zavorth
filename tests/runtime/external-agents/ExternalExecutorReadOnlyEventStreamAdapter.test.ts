import fs from 'node:fs';
import path from 'node:path';

import {
  createExternalExecutorReadOnlyEventStreamAdapterFixtureSource,
  normalizeExternalExecutorReadOnlyEventStreamAdapterFixture,
} from '../../../src/runtime/external-agents/index.js';

const DOC = 'docs/171-wave-1-external-executor-read-only-event-stream-adapter.md';
const OBSERVABILITY_DOC = 'docs/170-wave-1-external-executor-live-observability-projection.md';
const BRIDGE_DOC = 'docs/169-wave-1-external-executor-live-read-only-bridge-boundary.md';
const SNAPSHOT_DOC = 'docs/161-wave-1-real-capability-snapshot-read-only.md';
const BOUNDARY = 'src/runtime/external-agents/ExternalAgentExternalExecutorReadOnlyEventStreamAdapter.ts';
const INDEX = 'src/runtime/external-agents/index.ts';
const SENSITIVE_SENTINEL = 'synthetic-external-executor-event-secret-that-must-not-appear';

const EVENT_KINDS = [
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
  'degraded',
  'disconnect',
  'timeout',
  'retry',
  'backpressure',
];

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('ExternalExecutor read-only event stream adapter', () => {
  it('documents the 171 adapter as read-only over 169 and 170 without a real stream', () => {
    const content = read(DOC);

    expect(content).toContain('Status: external-executor-read-only-event-stream-adapter-ready');
    expect(content).toContain(`${BRIDGE_DOC} -> external-executor-live-read-only-bridge-boundary-ready`);
    expect(content).toContain(`${OBSERVABILITY_DOC} -> external-executor-live-observability-projection-ready`);
    expect(content).toContain(`source snapshot: ${SNAPSHOT_DOC}`);
    expect(content).toContain('candidate real stream endpoint: none-confirmed');
    expect(content).toContain('live stream connected: false');
    expect(content).toContain('mutable stream opened: false');
    expect(content).not.toMatch(/EXTERNAL_EXECUTOR_GATEWAY_TOKEN=(?!present-redacted|<redacted-local-secret>)[^\s`]+/);
    expect(content).not.toMatch(/sk-[A-Za-z0-9_-]{8,}/);
  });

  it('exports the Zavorth-owned adapter and public types', () => {
    const boundary = read(BOUNDARY);
    const index = read(INDEX);

    expect(boundary).toContain('ZavorthExternalExecutorReadOnlyEventStreamAdapter/v1');
    expect(boundary).toContain('normalizeExternalExecutorReadOnlyEventStreamAdapter');
    expect(boundary).toContain('createExternalExecutorReadOnlyEventStreamAdapterFixtureSource');
    expect(index).toContain("from './ExternalAgentExternalExecutorReadOnlyEventStreamAdapter.js'");
    expect(index).toContain('ExternalExecutorReadOnlyEventStreamAdapterNormalization');
  });

  it('normalizes ExternalExecutor-like event kinds to Zavorth-native event envelopes', () => {
    const source = createExternalExecutorReadOnlyEventStreamAdapterFixtureSource();
    const normalized = normalizeExternalExecutorReadOnlyEventStreamAdapterFixture();

    expect(source.observabilityProjection.decision).toBe('external-executor-live-observability-projection-ready');
    expect(source.liveStreamConnected).toBe(false);
    expect(source.mutableStreamOpened).toBe(false);
    expect(source.sourceEvents.map((event) => event.kind)).toEqual(EVENT_KINDS);
    expect(normalized).toEqual(expect.objectContaining({
      nativeContract: 'ZavorthExternalExecutorReadOnlyEventStreamAdapter/v1',
      decision: 'external-executor-read-only-event-stream-adapter-ready',
      observabilityDoc: OBSERVABILITY_DOC,
      bridgeDoc: BRIDGE_DOC,
      sourceSnapshotDoc: SNAPSHOT_DOC,
      readOnly: true,
      sourceEventCount: EVENT_KINDS.length,
      projectedEventCount: EVENT_KINDS.length,
    }));
    expect(normalized.envelopes.map((event) => event.payload.rawType)).toEqual(EVENT_KINDS);
    expect(normalized.envelopes.map((event) => event.kind)).toEqual([
      'health',
      'health',
      'capability-event',
      'capability-event',
      'capability-event',
      'capability-event',
      'message',
      'capability-event',
      'capability-event',
      'diagnostic',
      'diagnostic',
      'diagnostic',
      'diagnostic',
      'diagnostic',
      'diagnostic',
    ]);
    normalized.envelopes.forEach((event) => {
      expect(event.payload.data).toEqual(expect.objectContaining({
        sourceIdsEvidenceOnly: true,
        readOnly: true,
        executionAuthority: false,
        actionDispatchAllowed: false,
        messageSendAllowed: false,
        providerExecutionAllowed: false,
        commandExecutionAllowed: false,
      }));
    });
  });

  it('maps unknown and degraded events to diagnostics without crashing', () => {
    const normalized = normalizeExternalExecutorReadOnlyEventStreamAdapterFixture();
    const unknown = normalized.envelopes.find((event) => event.payload.rawType === 'unknown');
    const degraded = normalized.envelopes.find((event) => event.payload.rawType === 'degraded');

    expect(unknown).toEqual(expect.objectContaining({
      kind: 'diagnostic',
    }));
    expect(unknown?.payload.data).toEqual(expect.objectContaining({
      sourceStatus: 'degraded',
      severity: 'warning',
    }));
    expect(degraded).toEqual(expect.objectContaining({
      kind: 'diagnostic',
    }));
    expect(degraded?.payload.data).toEqual(expect.objectContaining({
      sourceStatus: 'degraded',
      severity: 'warning',
    }));
  });

  it('redacts sensitive payload values before serialization', () => {
    const normalized = normalizeExternalExecutorReadOnlyEventStreamAdapterFixture();
    const serialized = JSON.stringify(normalized);
    const provider = normalized.envelopes.find((event) => event.payload.rawType === 'provider');
    const message = normalized.envelopes.find((event) => event.payload.rawType === 'message-metadata');
    const unknown = normalized.envelopes.find((event) => event.payload.rawType === 'unknown');

    expect(normalized.redaction).toEqual({
      sensitivePayloadRedacted: true,
      rawSecretSerialized: false,
      rawSecretLikeKeysRedacted: true,
      serializedOutputContainsSensitiveFixture: false,
    });
    expect(provider?.payload.data?.apiKey).toBe('[redacted-secret]');
    expect(message?.payload.data?.token).toBe('[redacted-secret]');
    expect(unknown?.payload.data?.authorization).toBe('[redacted-secret]');
    expect(serialized).not.toContain(SENSITIVE_SENTINEL);
    expect(serialized).not.toContain('EXTERNAL_EXECUTOR_GATEWAY_TOKEN=');
    expect(serialized).not.toContain('Bearer synthetic');
  });

  it('models disconnect, timeout, retry, backpressure, and unknown stream states', () => {
    const normalized = normalizeExternalExecutorReadOnlyEventStreamAdapterFixture();

    expect(normalized.streamState).toEqual({
      nativeContract: 'ZavorthExternalExecutorReadOnlyEventStreamState/v1',
      liveStreamConnected: false,
      mutableStreamOpened: false,
      candidateRealStreamEndpoint: null,
      disconnectModeled: true,
      timeoutModeled: true,
      retryModeled: true,
      backpressureModeled: true,
      unknownEventModeled: true,
      lastKnownStatus: 'degraded',
    });
    expect(normalized.commandCenterEvents.filter((event) => (
      event.kind === 'disconnect'
      || event.kind === 'timeout'
      || event.kind === 'retry'
      || event.kind === 'backpressure'
    )).map((event) => event.severity)).toEqual(['danger', 'danger', 'warning', 'warning']);
  });

  it('exposes Command Center consumable read-only event projections', () => {
    const normalized = normalizeExternalExecutorReadOnlyEventStreamAdapterFixture();

    expect(normalized.commandCenterEvents).toHaveLength(EVENT_KINDS.length);
    normalized.commandCenterEvents.forEach((event) => {
      expect(event.nativeContract).toBe('ZavorthExternalExecutorReadOnlyCommandCenterEventProjection/v1');
      expect(event.commandCenterConsumable).toBe(true);
      expect(event.readOnly).toBe(true);
      expect(event.executionAuthority).toBe(false);
      expect(event.actionDispatchAllowed).toBe(false);
      expect(event.messageSendAllowed).toBe(false);
      expect(event.providerExecutionAllowed).toBe(false);
      expect(event.commandExecutionAllowed).toBe(false);
    });
  });

  it('keeps every execution and mutation gate closed', () => {
    const normalized = normalizeExternalExecutorReadOnlyEventStreamAdapterFixture();

    expect(normalized.executionGate).toEqual({
      executionAuthority: false,
      actionDispatchAllowed: false,
      messageSendAllowed: false,
      providerExecutionAllowed: false,
      commandExecutionAllowed: false,
      sourceModuleCopied: false,
      nativeReplacementAuthorized: false,
      rawSecretSerialized: false,
      liveStreamConnected: false,
      mutableStreamOpened: false,
      liveExternalExecutorStartedByAdapter: false,
      stateMigrated: false,
    });
    expect(normalized.nextGateRecommended).toBe('future-read-only-stream-endpoint-discovery-or-event-diff');
  });
});
