import fs from 'node:fs';
import path from 'node:path';

import {
  createExternalExecutorLiveReadOnlyBridgeBoundaryFixtureSource,
  normalizeExternalExecutorLiveReadOnlyBridgeBoundaryFixture,
} from '../../../src/runtime/external-agents/index.js';

const DOC = 'docs/169-wave-1-external-executor-live-read-only-bridge-boundary.md';
const SOURCE_DOC = 'docs/161-wave-1-real-capability-snapshot-read-only.md';
const BOUNDARY = 'src/runtime/external-agents/ExternalAgentExternalExecutorLiveReadOnlyBridgeBoundary.ts';
const INDEX = 'src/runtime/external-agents/index.ts';

const SURFACES = [
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

describe('ExternalExecutor live read-only bridge boundary', () => {
  it('documents the 169 bridge as read-only over the 161 snapshot', () => {
    const content = read(DOC);

    expect(content).toContain('Status: external-executor-live-read-only-bridge-boundary-ready');
    expect(content).toContain('docs/156-wave-1-authenticated-ephemeral-external-executor-gateway-health-probe.md -> authenticated-health-ok');
    expect(content).toContain(`${SOURCE_DOC} -> real-capability-snapshot-read-only-ok`);
    expect(content).toContain('secretRef: external-executor-gateway-token');
    expect(content).toContain('secret injection channel: env-var');
    expect(content).toContain('token status: present-redacted');
    expect(content).not.toMatch(/EXTERNAL_EXECUTOR_GATEWAY_TOKEN=(?!present-redacted|<redacted-local-secret>)[^\s`]+/);
    expect(content).not.toMatch(/sk-[A-Za-z0-9_-]{8,}/);
  });

  it('lists bridge surfaces and keeps every execution bit closed', () => {
    const content = read(DOC);

    SURFACES.forEach((surface) => {
      expect(content).toContain(`\`${surface}\``);
    });
    [
      'executionAuthority: false',
      'actionDispatchAllowed: false',
      'providerExecutionAllowed: false',
      'commandExecutionAllowed: false',
      'messageSendAllowed: false',
      'liveMutableStreamOpened: false',
      'sourceRuntimeConnectedForMutation: false',
      'sourceModuleCopied: false',
      'nativeReplacementAuthorized: false',
      'stateMigrated: false',
      'tokenViaSecretRefEnvVar: true',
      'rawSecretSerialized: false',
    ].forEach((invariant) => {
      expect(content).toContain(invariant);
    });
  });

  it('exports the Zavorth-owned bridge boundary and public types', () => {
    const boundary = read(BOUNDARY);
    const index = read(INDEX);

    expect(boundary).toContain('ZavorthExternalExecutorLiveReadOnlyBridgeBoundary/v1');
    expect(boundary).toContain('normalizeExternalExecutorLiveReadOnlyBridgeBoundary');
    expect(boundary).toContain('createExternalExecutorLiveReadOnlyBridgeBoundaryFixtureSource');
    expect(index).toContain("from './ExternalAgentExternalExecutorLiveReadOnlyBridgeBoundary.js'");
    expect(index).toContain('ExternalExecutorLiveReadOnlyBridgeBoundaryNormalization');
  });

  it('turns the real 161 capability snapshot into Zavorth-native bridge surfaces', () => {
    const source = createExternalExecutorLiveReadOnlyBridgeBoundaryFixtureSource();
    const normalized = normalizeExternalExecutorLiveReadOnlyBridgeBoundaryFixture();

    expect(source.realSnapshot.decision).toBe('real-capability-snapshot-read-only-ok');
    expect(source.sourceSnapshotDoc).toBe(SOURCE_DOC);
    expect(source.secretInjectionChannel).toBe('env-var');
    expect(normalized).toEqual(expect.objectContaining({
      nativeContract: 'ZavorthExternalExecutorLiveReadOnlyBridgeBoundary/v1',
      decision: 'external-executor-live-read-only-bridge-boundary-ready',
      sourceSnapshotDoc: SOURCE_DOC,
      readOnly: true,
    }));
    expect(normalized.capabilityInventoryNative.inventory).toHaveLength(7);
    expect(normalized.capabilityInventoryNative.inventory.every((row) => row.executionAuthority === false)).toBe(true);
    expect(normalized.surfaces.map((surface) => surface.surfaceKind)).toEqual(SURFACES);
    normalized.surfaces.forEach((surface) => {
      expect(surface.nativeContract).toBe('ZavorthExternalExecutorLiveReadOnlyBridgeSurface/v1');
      expect(surface.sourceIdsEvidenceOnly).toBe(true);
      expect(surface.readOnly).toBe(true);
      expect(surface.executionAuthority).toBe(false);
      expect(surface.actionDispatchAllowed).toBe(false);
      expect(surface.providerExecutionAllowed).toBe(false);
      expect(surface.commandExecutionAllowed).toBe(false);
      expect(surface.messageSendAllowed).toBe(false);
      expect(surface.sessionImportAllowed).toBe(false);
      expect(surface.sourceModuleCopied).toBe(false);
      expect(surface.nativeReplacementAuthorized).toBe(false);
    });
  });

  it('feeds health/status/probe evidence into Zavorth observability and preserves cleanup', () => {
    const normalized = normalizeExternalExecutorLiveReadOnlyBridgeBoundaryFixture();

    expect(normalized.observability).toEqual(expect.objectContaining({
      nativeContract: 'ZavorthExternalExecutorLiveReadOnlyBridgeObservability/v1',
      sourceSnapshotDecision: 'real-capability-snapshot-read-only-ok',
      healthStatus: 'ready',
      commandCenterProjectionRows: 7,
      healthProbeAuthenticated: true,
      statusRpcOk: true,
      probeOk: true,
      cleanupConfirmed: true,
      postListenerCount: 0,
      postProcessCount: 0,
      zavorthRuntimeFailed: false,
    }));
  });

  it('classifies channels, plugins, providers, gateway methods, messages, events, and sessions safely', () => {
    const normalized = normalizeExternalExecutorLiveReadOnlyBridgeBoundaryFixture();
    const bySurface = new Map(normalized.surfaces.map((surface) => [surface.surfaceKind, surface]));

    expect(bySurface.get('channel')).toEqual(expect.objectContaining({
      availability: 'degraded',
      classification: 'degraded',
      policy: 'approval-required',
    }));
    expect(bySurface.get('plugin')).toEqual(expect.objectContaining({
      availability: 'available',
      classification: 'approval-required',
      policy: 'approval-required',
    }));
    expect(bySurface.get('provider')).toEqual(expect.objectContaining({
      availability: 'degraded',
      classification: 'degraded',
      policy: 'approval-required',
    }));
    expect(bySurface.get('gateway-method')).toEqual(expect.objectContaining({
      availability: 'available',
      classification: 'approval-required',
      policy: 'approval-required',
    }));
    expect(bySurface.get('message')).toEqual(expect.objectContaining({
      availability: 'unavailable',
      classification: 'unavailable',
      policy: 'blocked',
    }));
    expect(bySurface.get('event')).toEqual(expect.objectContaining({
      availability: 'available',
      classification: 'approval-required',
      policy: 'approval-required',
    }));
    expect(bySurface.get('session')).toEqual(expect.objectContaining({
      availability: 'unavailable',
      classification: 'unavailable',
      policy: 'blocked',
    }));
  });

  it('preserves degraded and unavailable failures without failing the Zavorth runtime', () => {
    const normalized = normalizeExternalExecutorLiveReadOnlyBridgeBoundaryFixture();

    expect(normalized.failureModel).toEqual(expect.objectContaining({
      nativeContract: 'ZavorthExternalExecutorLiveReadOnlyBridgeFailureModel/v1',
      degradedUnavailablePreserved: true,
      failureMode: 'metadata-only-degraded-unavailable',
      zavorthRuntimeContinues: true,
      rollbackRequiredBeforeMutation: true,
    }));
    expect(normalized.failureModel.degradedRows).toHaveLength(2);
    expect(normalized.failureModel.unavailableRows).toHaveLength(1);
  });

  it('keeps the bridge non-executing and free of raw secret material', () => {
    const normalized = normalizeExternalExecutorLiveReadOnlyBridgeBoundaryFixture();
    const serialized = JSON.stringify(normalized);

    expect(normalized.executionGate).toEqual({
      executionAuthority: false,
      actionDispatchAllowed: false,
      providerExecutionAllowed: false,
      commandExecutionAllowed: false,
      messageSendAllowed: false,
      liveMutableStreamOpened: false,
      sourceRuntimeConnectedForMutation: false,
      sourceModuleCopied: false,
      nativeReplacementAuthorized: false,
      stateMigrated: false,
      tokenViaSecretRefEnvVar: true,
      rawSecretSerialized: false,
    });
    expect(serialized).not.toContain('EXTERNAL_EXECUTOR_GATEWAY_TOKEN');
    expect(serialized).not.toContain('raw-token');
    expect(serialized).not.toContain('secret-value');
    expect(normalized.nextGateRecommended).toBe('future-read-only-event-diff-or-controlled-bridge-probe');
  });
});
