import fs from 'node:fs';
import path from 'node:path';

import {
  createExternalAgentLiveReadinessAssimilationPackFixtureSource,
  createExternalAgentLiveReadinessNoExecutionPolicy,
  normalizeExternalAgentLiveReadinessAssimilationPackFixture,
} from '../../../src/runtime/external-agents/index.js';

const PACK_DOC = 'docs/168-wave-1-external-agent-live-readiness-assimilation-pack.md';
const GO_NO_GO_DOC = 'docs/117-external-agent-full-absorption-go-no-go.md';
const PAUSE_DOC = 'docs/159-external-executor-secret-provisioning-pause.md';
const SNAPSHOT_DESIGN_DOC = 'docs/160-wave-0-real-capability-snapshot-gate-design.md';
const SQLITE_DESIGN_DOC = 'docs/167-wave-1-sqlite-session-store-dry-run-design.md';
const BOUNDARY_FILE = 'src/runtime/external-agents/ExternalAgentLiveReadinessAssimilationPack.ts';
const INDEX_FILE = 'src/runtime/external-agents/index.ts';

const SUBGATES = [
  'Capability snapshot normalizer',
  'Read-only adapter interface',
  'Event bridge read-only contract',
  'Command Center live assimilation projection',
  'Capability import classification',
  'Degraded/unavailable state handling',
  'Audit/receipt model',
  'No-execution policy invariants',
];

const ROW_KINDS = [
  'plugin-capabilities',
  'provider-capabilities',
  'channel-capabilities',
  'command-http-capabilities',
  'gateway-method-capabilities',
  'worker-node-capabilities',
  'session-history-capabilities',
];

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

function rowFor(content: string, rowKind: string): string {
  return content.split(/\r?\n/).find((line) => line.includes(`\`${rowKind}\``)) || '';
}

describe('External agent live readiness assimilation pack', () => {
  it('documents all subgates and keeps live ExternalExecutor work blocked', () => {
    const content = read(PACK_DOC);

    expect(content).toContain('Status: wave-1-live-readiness-assimilation-pack-ready');
    SUBGATES.forEach((subgate) => {
      expect(content).toContain(subgate);
    });
    [
      'ExternalExecutor live call blocked',
      'SecretRef resolution blocked',
      'token read blocked',
      'gateway start blocked',
      'HTTP connection blocked',
      'WebSocket connection blocked',
      'tool execution blocked',
      'provider execution blocked',
      'command execution blocked',
      'action dispatch blocked',
      'real session import blocked',
      'config/state migration blocked',
      'source module copy blocked',
      'real adapter creation blocked',
      'native replacement blocked',
      'live event stream blocked',
    ].forEach((blocked) => {
      expect(content).toContain(blocked);
    });
  });

  it('exports the Zavorth-owned pack, fixtures, and public types', () => {
    const boundary = read(BOUNDARY_FILE);
    const index = read(INDEX_FILE);

    expect(boundary).toContain('normalizeExternalAgentLiveReadinessAssimilationPack');
    expect(boundary).toContain('normalizeExternalAgentLiveReadinessAssimilationPackFixture');
    expect(boundary).toContain('createExternalAgentLiveReadinessAssimilationPackFixtureSource');
    expect(boundary).toContain("nativeContract: 'ZavorthExternalAgentLiveReadinessAssimilationPack/v1'");
    expect(index).toContain("from './ExternalAgentLiveReadinessAssimilationPack.js'");
    expect(index).toContain('ExternalAgentLiveReadinessAssimilationPackNormalization');
  });

  it('turns a simulated ExternalExecutor snapshot into Zavorth capability inventory', () => {
    const source = createExternalAgentLiveReadinessAssimilationPackFixtureSource();
    const normalized = normalizeExternalAgentLiveReadinessAssimilationPackFixture();

    expect(source.gatewayMode).toBe('read-only-simulated');
    expect(normalized.snapshot).toEqual(expect.objectContaining({
      nativeContract: 'ZavorthExternalAgentCapabilitySnapshotNormalizer/v1',
      sourceSnapshotStoredAsEvidenceOnly: true,
      executionAuthority: false,
      sourceModuleCopied: false,
      realCapabilityImported: false,
    }));
    expect(normalized.snapshot.inventory.map((row) => row.rowKind)).toEqual(ROW_KINDS);
    normalized.snapshot.inventory.forEach((row) => {
      expect(row.nativeContract).toBe('ZavorthExternalAgentCapabilityInventoryRow/v1');
      expect(row.executionAuthority).toBe(false);
      expect(row.sourceIdsEvidenceOnly).toBe(true);
      expect(row.sourceModuleCopied).toBe(false);
      expect(row.sourceHandlerLoaded).toBe(false);
      expect(row.providerSdkLoaded).toBe(false);
      expect(row.sessionImportAuthorized).toBe(false);
      expect(row.sourceEvidence.sourceIdStoredAsEvidenceOnly).toBe(true);
    });
    expect(normalized.snapshot.toolExposurePolicyInput).toEqual({
      requestedTools: [
        'plugin.status.read',
        'provider.embedding.snapshot',
        'channel.telegram.inspect',
        'shell.exec',
        'gateway.rpc.read',
        'worker.node.inspect',
        'session.history.snapshot',
      ],
      allowedTools: ['plugin.status.read'],
      requireApprovalFor: [
        'channel.telegram.inspect',
        'gateway.rpc.read',
        'session.history.snapshot',
      ],
      blockedTools: [
        'provider.embedding.snapshot',
        'shell.exec',
        'worker.node.inspect',
      ],
      blockedToolReason: 'blocked-by-live-readiness-assimilation-pack',
    });
  });

  it('keeps the adapter interface read-only and does not create a real adapter', () => {
    const normalized = normalizeExternalAgentLiveReadinessAssimilationPackFixture();

    expect(normalized.adapterInterface).toEqual(expect.objectContaining({
      nativeContract: 'ZavorthExternalAgentReadOnlyAdapterInterface/v1',
      readOnly: true,
      adapterRealCreated: false,
      sourceRuntimeConnected: false,
      startGatewayAllowed: false,
      connectHttpAllowed: false,
      connectWebSocketAllowed: false,
      actionDispatchAllowed: false,
      providerExecutionAllowed: false,
      commandExecutionAllowed: false,
      sessionImportAllowed: false,
    }));
    expect(normalized.adapterInterface.methods.map((method) => method.name)).toEqual([
      'getHealthSnapshot',
      'listCapabilitySnapshot',
      'pullReadOnlyEvents',
      'getAuditReceipts',
    ]);
    normalized.adapterInterface.methods.forEach((method) => {
      expect(method.readOnly).toBe(true);
      expect(method.mutatesSource).toBe(false);
      expect(method.liveTransportRequired).toBe(false);
      expect(method.executionAuthority).toBe(false);
    });
  });

  it('produces event envelopes without dispatch, live stream, sockets, or second bus', () => {
    const normalized = normalizeExternalAgentLiveReadinessAssimilationPackFixture();

    expect(normalized.eventBridge).toEqual(expect.objectContaining({
      nativeContract: 'ZavorthExternalAgentLiveReadinessEventBridge/v1',
      readOnly: true,
      producesEnvelopes: true,
      dispatchPerformed: false,
      liveEventStreamConnected: false,
      noSecondEventBus: true,
    }));
    expect(normalized.eventBridge.envelopes).toHaveLength(2);
    normalized.eventBridge.envelopes.forEach((envelope) => {
      expect(envelope).toEqual(expect.objectContaining({
        nativeContract: 'ZavorthExternalAgentLiveReadinessEventBridgeEnvelope/v1',
        sourceEventStoredAsEvidenceOnly: true,
        producesEnvelope: true,
        dispatchPerformed: false,
        liveStreamConnected: false,
        websocketConnected: false,
        httpConnected: false,
        noSecondEventBus: true,
      }));
      expect(envelope.eventEnvelope.kind).toBe('capability-event');
      expect(envelope.eventEnvelope.payload.data).toEqual(expect.objectContaining({
        readOnly: true,
        sourceIdsEvidenceOnly: true,
      }));
    });
  });

  it('projects Command Center rows in Zavorth terms without executable controls', () => {
    const normalized = normalizeExternalAgentLiveReadinessAssimilationPackFixture();

    expect(normalized.commandCenterProjection).toEqual(expect.objectContaining({
      nativeContract: 'ZavorthExternalAgentCommandCenterLiveAssimilationProjection/v1',
      readOnly: true,
      usesZavorthTerms: true,
      executableControlsExposed: false,
      providerExecutionControlsExposed: false,
      commandExecutionControlsExposed: false,
      sessionImportControlsExposed: false,
    }));
    expect(normalized.commandCenterProjection.rows.map((row) => row.status)).toEqual([
      'ready',
      'unavailable',
      'degraded',
      'blocked',
      'approval-required',
      'unavailable',
      'approval-required',
    ]);
    normalized.commandCenterProjection.rows.forEach((row) => {
      expect(row.zavorthTerm).toBe('Zavorth capability inventory projection');
      expect(row.readOnly).toBe(true);
      expect(row.usesZavorthTerms).toBe(true);
      expect(row.sourceIdStoredAsEvidenceOnly).toBe(true);
      expect(row.executionAuthority).toBe(false);
      expect(row.executableControlExposed).toBe(false);
      expect(row.providerExecutionControlExposed).toBe(false);
      expect(row.commandExecutionControlExposed).toBe(false);
      expect(row.sessionImportControlExposed).toBe(false);
    });
  });

  it('blocks or approval-gates dangerous, attention, degraded, and unavailable capabilities', () => {
    const normalized = normalizeExternalAgentLiveReadinessAssimilationPackFixture();
    const rows = normalized.capabilityImportClassification.rows;

    expect(normalized.capabilityImportClassification).toEqual(expect.objectContaining({
      nativeContract: 'ZavorthExternalAgentCapabilityImportClassification/v1',
      dangerousCapabilitiesBlockedOrApprovalGated: true,
      sourceIdsEvidenceOnly: true,
      importAuthorized: false,
    }));
    expect(rows.map((row) => [row.rowKind, row.classification, row.policy])).toEqual([
      ['plugin-capabilities', 'inventory-only', 'allowed'],
      ['provider-capabilities', 'unavailable', 'blocked'],
      ['channel-capabilities', 'degraded', 'approval-required'],
      ['command-http-capabilities', 'blocked', 'blocked'],
      ['gateway-method-capabilities', 'approval-required', 'approval-required'],
      ['worker-node-capabilities', 'unavailable', 'blocked'],
      ['session-history-capabilities', 'approval-required', 'approval-required'],
    ]);
    rows.forEach((row) => {
      expect(row.executionAuthority).toBe(false);
      expect(row.sourceIdsEvidenceOnly).toBe(true);
    });
  });

  it('preserves unavailable and degraded states honestly', () => {
    const normalized = normalizeExternalAgentLiveReadinessAssimilationPackFixture();

    expect(normalized.degradedUnavailableStateHandling).toEqual(expect.objectContaining({
      nativeContract: 'ZavorthExternalAgentDegradedUnavailableStateHandling/v1',
      preservedHonestly: true,
      unavailableNotPromotedToReady: true,
      degradedNotSilentlyIgnored: true,
    }));
    expect(normalized.degradedUnavailableStateHandling.degradedRows).toHaveLength(1);
    expect(normalized.degradedUnavailableStateHandling.unavailableRows).toHaveLength(2);
    expect(normalized.snapshot.inventory.find((row) => row.rowKind === 'channel-capabilities')).toEqual(expect.objectContaining({
      availability: 'degraded',
      importClassification: 'degraded',
      policy: 'approval-required',
    }));
    expect(normalized.snapshot.inventory.find((row) => row.rowKind === 'worker-node-capabilities')).toEqual(expect.objectContaining({
      availability: 'unavailable',
      importClassification: 'unavailable',
      policy: 'blocked',
    }));
  });

  it('creates redacted audit receipts with no raw secrets and no authority', () => {
    const normalized = normalizeExternalAgentLiveReadinessAssimilationPackFixture();
    const output = JSON.stringify(normalized);

    expect(normalized.auditReceipts.map((receipt) => receipt.subgate)).toEqual([
      'capability-snapshot-normalizer',
      'read-only-adapter-interface',
      'event-bridge-read-only-contract',
      'command-center-live-assimilation-projection',
      'capability-import-classification',
      'degraded-unavailable-state-handling',
      'audit-receipt-model',
      'no-execution-policy-invariants',
    ]);
    normalized.auditReceipts.forEach((receipt) => {
      expect(receipt.rawSecretObserved).toBe(false);
      expect(receipt.rawSecretSerialized).toBe(false);
      expect(receipt.redacted).toBe(true);
      expect(receipt.sourceEvidenceOnly).toBe(true);
      expect(receipt.executionAuthority).toBe(false);
    });
    expect(output).not.toContain('EXTERNAL_EXECUTOR_GATEWAY_TOKEN');
    expect(output).not.toContain('raw-token');
    expect(output).not.toContain('secret-value');
  });

  it('keeps every no-execution invariant false and leaves live authority closed after 161', () => {
    const policy = createExternalAgentLiveReadinessNoExecutionPolicy();
    const normalized = normalizeExternalAgentLiveReadinessAssimilationPackFixture();

    expect(normalized.noExecutionPolicy).toEqual(policy);
    expect(normalized).toEqual(expect.objectContaining({
      nativeContract: 'ZavorthExternalAgentLiveReadinessAssimilationPack/v1',
      readOnlyDesignBoundary: true,
      liveExternalExecutorBlocked: true,
      nextLiveGatesBlockedUntil: {
        secretProvisioning: 'secret-present-redacted',
        authenticatedHealth: 'authenticated-health-ok',
      },
    }));
    [
      'externalExecutorLiveCalled',
      'secretResolved',
      'tokenRead',
      'gatewayStarted',
      'websocketConnected',
      'httpConnected',
      'liveEventStreamConnected',
      'toolExecuted',
      'providerExecuted',
      'commandExecuted',
      'actionDispatched',
      'sessionImported',
      'configMigrated',
      'stateMigrated',
      'sourceModulesCopied',
      'realAdapterCreated',
      'nativeReplacementAuthorized',
      'executionAuthority',
    ].forEach((key) => {
      expect(normalized.noExecutionPolicy[key as keyof typeof normalized.noExecutionPolicy]).toBe(false);
    });
    expect(normalized.noExecutionPolicy.sourceIdsEvidenceOnly).toBe(true);
  });

  it('documents all simulated rows and current decision invariants', () => {
    const content = read(PACK_DOC);

    ROW_KINDS.forEach((rowKind) => {
      const row = rowFor(content, rowKind);

      expect(row).toContain(`\`${rowKind}\``);
      expect(row).toMatch(/allowed|blocked|approval-required|degraded|unavailable|inventory-only/i);
    });
    [
      'ExternalExecutor live called: false',
      'SecretRef resolved: false',
      'token read: false',
      'gateway started: false',
      'tool/provider/command executed: false',
      'real session imported: false',
      'real adapter created: false',
      'executionAuthority: false',
      'source ids evidence-only: true',
      'next live gate 158 executed: true',
      'next live gate 156 executed: true',
      'next live gate 161 executed: true',
      'next state: real-capability-snapshot-read-only-ok',
    ].forEach((invariant) => {
      expect(content).toContain(invariant);
    });
  });

  it('updates 117, 159, 160, and 167 tracking docs while keeping mutable work blocked', () => {
    const goNoGo = read(GO_NO_GO_DOC);
    const pause = read(PAUSE_DOC);
    const snapshotDesign = read(SNAPSHOT_DESIGN_DOC);
    const sqliteDesign = read(SQLITE_DESIGN_DOC);

    [goNoGo, pause, snapshotDesign, sqliteDesign].forEach((content) => {
      expect(content).toContain(PACK_DOC);
      expect(content).toContain('wave-1-live-readiness-assimilation-pack-ready');
    });
    expect(pause).toContain('168` is live readiness assimilation pack only');
    expect(snapshotDesign).toContain('The accelerated readiness pack is now documented');
    expect(sqliteDesign).toContain('The adjacent live readiness assimilation pack is documented');
    expect(goNoGo).toContain('live readiness assimilation pack');
  });
});
