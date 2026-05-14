import fs from 'node:fs';
import path from 'node:path';

import {
  createExternalExecutorLiveObservabilityProjectionFixtureInput,
  normalizeExternalExecutorLiveObservabilityProjectionFixture,
} from '../../../src/runtime/external-agents/index.js';

const DOC = 'docs/170-wave-1-external-executor-live-observability-projection.md';
const BRIDGE_DOC = 'docs/169-wave-1-external-executor-live-read-only-bridge-boundary.md';
const SNAPSHOT_DOC = 'docs/161-wave-1-real-capability-snapshot-read-only.md';
const BOUNDARY = 'src/runtime/external-agents/ExternalAgentExternalExecutorLiveObservabilityProjection.ts';
const INDEX = 'src/runtime/external-agents/index.ts';

const ROWS = [
  'runtime',
  'channel',
  'message',
  'event',
  'session',
  'plugin',
  'provider',
  'gateway-method',
];

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('ExternalExecutor live observability projection', () => {
  it('documents the 170 projection as read-only over 161 and 169 evidence', () => {
    const content = read(DOC);

    expect(content).toContain('Status: external-executor-live-observability-projection-ready');
    expect(content).toContain(`${SNAPSHOT_DOC} -> real-capability-snapshot-read-only-ok`);
    expect(content).toContain(`${BRIDGE_DOC} -> external-executor-live-read-only-bridge-boundary-ready`);
    expect(content).toContain('secretRef: external-executor-gateway-token');
    expect(content).toContain('token status: present-redacted');
    expect(content).toContain('live ExternalExecutor started by projection: false');
    expect(content).toContain('mutable stream opened: false');
    expect(content).toContain('state migrated: false');
    expect(content).not.toMatch(/EXTERNAL_EXECUTOR_GATEWAY_TOKEN=(?!present-redacted|<redacted-local-secret>)[^\s`]+/);
    expect(content).not.toMatch(/sk-[A-Za-z0-9_-]{8,}/);
  });

  it('exports the Zavorth-owned observability projection and public types', () => {
    const boundary = read(BOUNDARY);
    const index = read(INDEX);

    expect(boundary).toContain('ZavorthExternalExecutorLiveObservabilityProjection/v1');
    expect(boundary).toContain('normalizeExternalExecutorLiveObservabilityProjection');
    expect(boundary).toContain('createExternalExecutorLiveObservabilityProjectionFixtureInput');
    expect(index).toContain("from './ExternalAgentExternalExecutorLiveObservabilityProjection.js'");
    expect(index).toContain('ExternalExecutorLiveObservabilityProjectionNormalization');
  });

  it('projects health, status, probe, capabilities, and cleanup into runtime observability', () => {
    const source = createExternalExecutorLiveObservabilityProjectionFixtureInput();
    const normalized = normalizeExternalExecutorLiveObservabilityProjectionFixture();

    expect(source.bridge.decision).toBe('external-executor-live-read-only-bridge-boundary-ready');
    expect(source.liveExternalExecutorStartedByProjection).toBe(false);
    expect(normalized).toEqual(expect.objectContaining({
      nativeContract: 'ZavorthExternalExecutorLiveObservabilityProjection/v1',
      decision: 'external-executor-live-observability-projection-ready',
      bridgeDoc: BRIDGE_DOC,
      sourceSnapshotDoc: SNAPSHOT_DOC,
      readOnly: true,
    }));
    expect(normalized.runtimeObservability).toEqual(expect.objectContaining({
      nativeContract: 'ZavorthExternalExecutorLiveRuntimeObservabilityProjection/v1',
      status: 'ready',
      sourceBridgeDecision: 'external-executor-live-read-only-bridge-boundary-ready',
      sourceSnapshotDecision: 'real-capability-snapshot-read-only-ok',
      healthProbeAuthenticated: true,
      statusRpcOk: true,
      probeOk: true,
      cleanupConfirmed: true,
      postListenerCount: 0,
      postProcessCount: 0,
      capabilitySurfaceCount: 7,
      degradedSurfaceCount: 2,
      unavailableSurfaceCount: 2,
      sourceIdsEvidenceOnly: true,
      executionAuthority: false,
    }));
  });

  it('builds a Command Center projection in Zavorth terms without executable controls', () => {
    const normalized = normalizeExternalExecutorLiveObservabilityProjectionFixture();

    expect(normalized.commandCenterProjection).toEqual(expect.objectContaining({
      nativeContract: 'ZavorthExternalExecutorCommandCenterObservabilityProjection/v1',
      runtimeStatus: 'ready',
      usesZavorthTerms: true,
      readOnly: true,
      executableControlsExposed: false,
      actionDispatchControlsExposed: false,
      messageSendControlsExposed: false,
      providerExecutionControlsExposed: false,
      commandExecutionControlsExposed: false,
      sessionImportControlsExposed: false,
    }));
    expect(normalized.commandCenterProjection.rows.map((row) => row.surfaceKind)).toEqual(ROWS);
    normalized.commandCenterProjection.rows.forEach((row) => {
      expect(row.nativeContract).toBe('ZavorthExternalExecutorCommandCenterObservabilityRow/v1');
      expect(row.readOnly).toBe(true);
      expect(row.sourceIdsEvidenceOnly).toBe(true);
      expect(row.executionAuthority).toBe(false);
      expect(row.actionDispatchAllowed).toBe(false);
      expect(row.messageSendAllowed).toBe(false);
      expect(row.providerExecutionAllowed).toBe(false);
      expect(row.commandExecutionAllowed).toBe(false);
      expect(row.sourceModuleCopied).toBe(false);
      expect(row.nativeReplacementAuthorized).toBe(false);
    });
  });

  it('classifies channel, plugin, provider, gateway method, session, event, and message metadata honestly', () => {
    const normalized = normalizeExternalExecutorLiveObservabilityProjectionFixture();
    const byKind = new Map(normalized.commandCenterProjection.rows.map((row) => [row.surfaceKind, row]));

    expect(byKind.get('runtime')).toEqual(expect.objectContaining({ status: 'ready' }));
    expect(byKind.get('channel')).toEqual(expect.objectContaining({ status: 'degraded' }));
    expect(byKind.get('plugin')).toEqual(expect.objectContaining({ status: 'ready' }));
    expect(byKind.get('provider')).toEqual(expect.objectContaining({ status: 'degraded' }));
    expect(byKind.get('gateway-method')).toEqual(expect.objectContaining({ status: 'ready' }));
    expect(byKind.get('event')).toEqual(expect.objectContaining({ status: 'ready' }));
    expect(byKind.get('message')).toEqual(expect.objectContaining({ status: 'unavailable' }));
    expect(byKind.get('session')).toEqual(expect.objectContaining({ status: 'unavailable' }));
  });

  it('maps ExternalExecutor failures to degraded or unavailable rows without raw exceptions', () => {
    const normalized = normalizeExternalExecutorLiveObservabilityProjectionFixture();

    expect(normalized.failureProjection).toEqual(expect.objectContaining({
      nativeContract: 'ZavorthExternalExecutorLiveObservabilityFailureProjection/v1',
      degradedUnavailableMapped: true,
      rawExceptionThrown: false,
      rawExceptionSerialized: false,
      zavorthRuntimeContinues: true,
    }));
    expect(normalized.failureProjection.failureRows.map((row) => [row.surfaceKind, row.status])).toEqual([
      ['channel', 'degraded'],
      ['message', 'unavailable'],
      ['session', 'unavailable'],
      ['provider', 'degraded'],
    ]);
    normalized.failureProjection.failureRows.forEach((row) => {
      expect(row.rawExceptionSerialized).toBe(false);
      expect(row.zavorthRuntimeFailed).toBe(false);
    });
  });

  it('keeps real capabilities without authority and serializes no raw token material', () => {
    const normalized = normalizeExternalExecutorLiveObservabilityProjectionFixture();
    const serialized = JSON.stringify(normalized);

    expect(normalized.executionGate).toEqual({
      executionAuthority: false,
      actionDispatchAllowed: false,
      messageSendAllowed: false,
      providerExecutionAllowed: false,
      commandExecutionAllowed: false,
      liveMutableStreamOpened: false,
      liveExternalExecutorStartedByProjection: false,
      sourceRuntimeConnectedForMutation: false,
      stateMigrated: false,
      sourceModuleCopied: false,
      nativeReplacementAuthorized: false,
      tokenViaSecretRefEnvVar: true,
      rawSecretSerialized: false,
    });
    expect(serialized).not.toContain('EXTERNAL_EXECUTOR_GATEWAY_TOKEN');
    expect(serialized).not.toContain('raw-token');
    expect(serialized).not.toContain('secret-value');
    expect(normalized.nextGateRecommended).toBe('future-read-only-event-diff-or-controlled-event-bridge-design');
  });
});
