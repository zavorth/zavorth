import fs from 'node:fs';
import path from 'node:path';

import {
  createExternalAgentCommandCenterLiveAssimilationFixtureSource,
  normalizeExternalAgentCommandCenterLiveAssimilationFixture,
} from '../../../src/runtime/external-agents/index.js';

const DOC = 'docs/173-wave-1-command-center-live-assimilation.md';
const BOUNDARY = 'src/runtime/external-agents/ExternalAgentCommandCenterLiveAssimilation.ts';
const INDEX = 'src/runtime/external-agents/index.ts';
const SENSITIVE_SENTINEL = 'synthetic-external-executor-session-secret-that-must-not-appear';

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('Command Center live assimilation', () => {
  it('documents 173 as a read-only Command Center assimilation gate', () => {
    const content = read(DOC);

    expect(content).toContain('Status: command-center-live-assimilation-ready');
    expect(content).toContain('docs/161-wave-1-real-capability-snapshot-read-only.md -> real-capability-snapshot-read-only-ok');
    expect(content).toContain('docs/169-wave-1-external-executor-live-read-only-bridge-boundary.md -> external-executor-live-read-only-bridge-boundary-ready');
    expect(content).toContain('docs/170-wave-1-external-executor-live-observability-projection.md -> external-executor-live-observability-projection-ready');
    expect(content).toContain('docs/171-wave-1-external-executor-read-only-event-stream-adapter.md -> external-executor-read-only-event-stream-adapter-ready');
    expect(content).toContain('docs/172-wave-1-external-executor-session-history-read-only-bridge.md -> external-executor-session-history-read-only-bridge-ready');
    expect(content).toContain('nativeContract: ZavorthCommandCenterLiveAssimilationViewModel/v1');
    expect(content).toContain('sourceRuntimeNamePublic: false');
    expect(content).not.toMatch(/EXTERNAL_EXECUTOR_GATEWAY_TOKEN=(?!present-redacted|<redacted-local-secret>)[^\s`]+/);
    expect(content).not.toMatch(/sk-[A-Za-z0-9_-]{8,}/);
  });

  it('exports the Zavorth owned assimilation boundary and public types', () => {
    const boundary = read(BOUNDARY);
    const index = read(INDEX);

    expect(boundary).toContain('ZavorthCommandCenterLiveAssimilationBoundary/v1');
    expect(boundary).toContain('ZavorthCommandCenterLiveAssimilationViewModel/v1');
    expect(boundary).toContain('normalizeExternalAgentCommandCenterLiveAssimilation');
    expect(boundary).toContain('createExternalAgentCommandCenterLiveAssimilationFixtureSource');
    expect(index).toContain("from './ExternalAgentCommandCenterLiveAssimilation.js'");
    expect(index).toContain('ZavorthCommandCenterLiveAssimilationViewModel');
  });

  it('consumes the closed 161/169/170/171/172 gates and creates a Zavorth view model', () => {
    const source = createExternalAgentCommandCenterLiveAssimilationFixtureSource();
    const normalized = normalizeExternalAgentCommandCenterLiveAssimilationFixture();

    expect(source.snapshot.decision).toBe('real-capability-snapshot-read-only-ok');
    expect(source.bridge.decision).toBe('external-executor-live-read-only-bridge-boundary-ready');
    expect(source.observability.decision).toBe('external-executor-live-observability-projection-ready');
    expect(source.eventStream.decision).toBe('external-executor-read-only-event-stream-adapter-ready');
    expect(source.sessionHistory.decision).toBe('external-executor-session-history-read-only-bridge-ready');
    expect(normalized).toEqual(expect.objectContaining({
      nativeContract: 'ZavorthCommandCenterLiveAssimilationBoundary/v1',
      decision: 'command-center-live-assimilation-ready',
      readOnly: true,
    }));
    expect(normalized.sourceGateReadiness).toEqual({
      capabilitySnapshotReady: true,
      bridgeReady: true,
      observabilityProjectionReady: true,
      eventStreamAdapterReady: true,
      sessionHistoryBridgeReady: true,
      sourceIdentityQuarantined: true,
    });
    expect(normalized.viewModel.nativeContract).toBe('ZavorthCommandCenterLiveAssimilationViewModel/v1');
    expect(normalized.viewModel.runtime.label).toBe('External live runtime');
    expect(normalized.viewModel.runtime.sourceIdentityPublic).toBe(false);
    expect(normalized.viewModel.runtime.sourceIdentityQuarantined).toBe(true);
  });

  it('projects capabilities, events, sessions, messages, channels, plugins, providers, and gateway lifecycle rows', () => {
    const normalized = normalizeExternalAgentCommandCenterLiveAssimilationFixture();
    const { viewModel } = normalized;

    expect(viewModel.capabilities).toHaveLength(7);
    expect(viewModel.events.length).toBeGreaterThanOrEqual(9);
    expect(viewModel.sessions).toHaveLength(3);
    expect(viewModel.messages).toHaveLength(3);
    expect(viewModel.channels.map((row) => row.surfaceKind).sort()).toEqual(['channel', 'message']);
    expect(viewModel.plugins.map((row) => row.surfaceKind)).toEqual(['plugin']);
    expect(viewModel.providers.map((row) => row.surfaceKind)).toEqual(['provider']);
    expect(viewModel.gatewayLifecycle.map((row) => row.surfaceKind).sort()).toEqual([
      'event',
      'gateway-lifecycle',
      'gateway-method',
    ]);
    expect(viewModel.capabilities.some((row) => row.authorityDisposition === 'blocked')).toBe(true);
    expect(viewModel.capabilities.some((row) => row.authorityDisposition === 'approval-required')).toBe(true);
  });

  it('keeps public Command Center structures decoupled from source names and structures', () => {
    const normalized = normalizeExternalAgentCommandCenterLiveAssimilationFixture();
    const serialized = JSON.stringify(normalized);

    expect(serialized).not.toMatch(/ExternalExecutor|external-executor/);
    expect(normalized.viewModel.dashboardUsesSourceVisualIdentity).toBe(false);
    expect(normalized.viewModel.sourceRuntimeNamePublic).toBe(false);
    expect(normalized.viewModel.sourceStructuresPublic).toBe(false);
  });

  it('represents degraded, unavailable, and blocked rows as operational state', () => {
    const normalized = normalizeExternalAgentCommandCenterLiveAssimilationFixture();
    const states = normalized.viewModel.operationalStates;

    expect(states.nativeContract).toBe('ZavorthCommandCenterOperationalStates/v1');
    expect(states.degraded.length).toBeGreaterThan(0);
    expect(states.unavailable.length).toBeGreaterThan(0);
    expect(states.blocked.length).toBeGreaterThan(0);
    expect(states.representedAsOperationalState).toBe(true);
    expect(states.rawExceptionSerialized).toBe(false);
    expect(states.zavorthRuntimeFailed).toBe(false);
  });

  it('redacts secrets, message content, sensitive metadata, and source IDs', () => {
    const normalized = normalizeExternalAgentCommandCenterLiveAssimilationFixture();
    const serialized = JSON.stringify(normalized);

    expect(serialized).not.toContain(SENSITIVE_SENTINEL);
    expect(serialized).not.toContain('operator text');
    expect(serialized).not.toContain('assistant response omitted');
    expect(serialized).not.toContain('external-executor-live-session-private-123');
    expect(serialized).not.toContain('external-executor-thread-alpha-private-456');
    expect(serialized).not.toContain('external-executor-message-private-1');
    expect(serialized).not.toMatch(/EXTERNAL_EXECUTOR_GATEWAY_TOKEN=(?!present-redacted|<redacted-local-secret>)[^\s`]+/);
    normalized.viewModel.messages.forEach((message) => {
      expect(message.sensitiveContentRedacted).toBe(true);
      expect(message.rawContentSerialized).toBe(false);
      expect(message.sourceIdsEvidenceOnly).toBe(true);
    });
    expect(normalized.redaction).toEqual({
      rawSecretSerialized: false,
      rawMessageContentSerialized: false,
      sensitiveMetadataRedacted: true,
      sourceIdentityPublic: false,
      sourceIdsEvidenceOnly: true,
      serializedPublicViewContainsSensitiveFixture: false,
    });
  });

  it('grants no execution, dispatch, import, migration, write-back, copy, or replacement authority', () => {
    const normalized = normalizeExternalAgentCommandCenterLiveAssimilationFixture();

    expect(normalized.executionGate).toEqual({
      executionAuthority: false,
      actionDispatchAllowed: false,
      messageSendAllowed: false,
      providerExecutionAllowed: false,
      commandExecutionAllowed: false,
      sessionImportAllowed: false,
      migrationAllowed: false,
      writeBackAllowed: false,
      sourceModuleCopied: false,
      nativeReplacementAuthorized: false,
      mutableStreamOpened: false,
      rawSecretSerialized: false,
    });
    expect(normalized.nextGateRecommended).toBe('future-explicit-gate-required-before-mutable-assimilation');
  });
});
