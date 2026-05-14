import fs from 'node:fs';
import path from 'node:path';

import {
  createWave1SidecarReadOnlyBoundaryPackFixtureSource,
  normalizeWave1SidecarReadOnlyBoundaryPackFixture,
} from '../../../src/runtime/external-agents/index.js';

const PACK_DOC = 'docs/150-wave-1-sidecar-read-only-boundary-pack.md';
const TEST_DESIGN_DOC = 'docs/149-wave-1-real-sidecar-adapter-test-design.md';
const BOUNDARY_FILE = 'src/runtime/external-agents/ExternalAgentSidecarReadOnlyBoundaryPack.ts';
const INDEX_FILE = 'src/runtime/external-agents/index.ts';

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('Wave 1 sidecar read-only boundary pack', () => {
  it('documents the accelerated boundary pack and keeps live integration blocked', () => {
    const content = read(PACK_DOC);

    expect(content).toContain('Status: wave-1-sidecar-read-only-boundary-pack-ready');
    expect(content).toContain(TEST_DESIGN_DOC);
    expect(content).toContain('old conceptual slices `150` through `156`');
    expect(content).toContain('does not start a process');
    expect(content).toContain('call ExternalExecutor live');
    expect(content).toContain('open HTTP/WebSocket');
    expect(content).toContain('execute an external command/tool/provider');
    expect(content).toContain('read raw secrets');
    expect(content).toContain('migrate config/state');
    expect(content).toContain('copy source modules');
    expect(content).toContain('remove an');
    expect(content).toContain('make the sidecar required');
  });

  it('exports the Zavorth-owned pack, fixtures, and public types', () => {
    const boundary = read(BOUNDARY_FILE);
    const index = read(INDEX_FILE);

    expect(boundary).toContain('normalizeExternalAgentSidecarReadOnlyBoundaryPack');
    expect(boundary).toContain('normalizeWave1SidecarReadOnlyBoundaryPackFixture');
    expect(boundary).toContain("nativeContract: 'ZavorthSidecarReadOnlyBoundaryPack/v1'");
    expect(boundary).toContain('createWave1SidecarReadOnlyBoundaryPackFixtureSource');
    expect(index).toContain("from './ExternalAgentSidecarReadOnlyBoundaryPack.js'");
    expect(index).toContain('ExternalAgentSidecarReadOnlyBoundaryPackNormalization');
  });

  it('normalizes process descriptor metadata without starting or requiring a sidecar', () => {
    const normalized = normalizeWave1SidecarReadOnlyBoundaryPackFixture();

    expect(normalized.descriptor).toEqual(expect.objectContaining({
      nativeContract: 'ZavorthSidecarProcessDescriptor/v1',
      optional: true,
      disabledByDefault: true,
      zavorthRunsWithoutSidecar: true,
      transport: 'wsl-command',
      sourceHintsStoredAsEvidenceOnly: true,
      sourceCommandHintStoredAsEvidenceOnly: true,
      sourceEndpointHintStoredAsEvidenceOnly: true,
      sourceWorkingDirectoryHintStoredAsEvidenceOnly: true,
    }));
    expect(normalized.descriptor.launchPolicy).toEqual({
      authority: 'zavorth-sidecar-read-only-boundary-pack',
      processSpawnAllowed: false,
      commandExecutionAllowed: false,
      workingDirectoryMutationAllowed: false,
      liveConnectionAllowed: false,
    });
    expect(normalized.sidecarOptional).toBe(true);
    expect(normalized.zavorthRunsWithoutSidecar).toBe(true);
    expect(normalized.executionGate.sidecarProcessStarted).toBe(false);
    expect(normalized.executionGate.sourceRuntimeConnected).toBe(false);
  });

  it('projects fixture health into ExternalAgentHealthSnapshot without authority', () => {
    const normalized = normalizeWave1SidecarReadOnlyBoundaryPackFixture();

    expect(normalized.health).toEqual(expect.objectContaining({
      runtimeId: 'external-wave1-sidecar-read-only-runtime',
      status: 'degraded',
      generatedAt: '2026-04-28T12:00:00.000Z',
      capabilities: {
        total: 3,
        trusted: 0,
        safe: 2,
        quarantined: 1,
      },
    }));
    expect(normalized.health.channels).toEqual([
      expect.objectContaining({
        id: 'sidecar-read-only-channel-1',
        label: 'Sidecar read-only channel 1',
        outbound: false,
        replyBoundary: 'zavorth-reply-port-only',
      }),
    ]);
    expect(normalized.health.diagnostics?.notes).toContain('health-probe-no-authority');
    expect(normalized.executionGate.httpConnectionOpened).toBe(false);
    expect(normalized.executionGate.websocketConnectionOpened).toBe(false);
  });

  it('turns capability snapshots into inventory and Zavorth policy input without provider/tool execution', () => {
    const normalized = normalizeWave1SidecarReadOnlyBoundaryPackFixture();

    expect(normalized.capabilitySnapshot).toEqual(expect.objectContaining({
      nativeContract: 'ZavorthSidecarCapabilitySnapshot/v1',
      sourceCapabilitiesStoredAsEvidenceOnly: true,
      sourceModulesLoaded: false,
      externalToolsExecuted: false,
      toolExposurePolicyInput: {
        requestedTools: ['sidecar.status.read', 'network_fetch', 'workspace.delete'],
        allowedTools: ['sidecar.status.read'],
        requireApprovalFor: ['network_fetch'],
        blockedTools: ['workspace.delete'],
        blockedToolReason: 'blocked-by-sidecar-read-only-boundary-pack',
      },
    }));
    expect(normalized.capabilitySnapshot.rows).toEqual([
      expect.objectContaining({
        label: 'Sidecar capability 1',
        risk: 'safe',
        trustState: 'safe',
        sourceModuleLoaded: false,
        providerSdkLoaded: false,
        externalToolExecuted: false,
      }),
      expect.objectContaining({
        label: 'Sidecar capability 2',
        risk: 'attention',
        trustState: 'safe',
      }),
      expect.objectContaining({
        label: 'Sidecar capability 3',
        risk: 'danger',
        trustState: 'quarantined',
      }),
    ]);
    expect(normalized.capabilitySnapshot.inventoryRows.map((row) => row.policy)).toEqual([
      'allowed',
      'approval-required',
      'blocked',
    ]);
    expect(normalized.executionGate.externalProviderExecuted).toBe(false);
    expect(normalized.executionGate.externalToolExecuted).toBe(false);
  });

  it('normalizes event pull into Zavorth envelopes without a second event bus or live polling', () => {
    const normalized = normalizeWave1SidecarReadOnlyBoundaryPackFixture();
    const [envelope] = normalized.eventPull.envelopes;

    expect(normalized.eventPull).toEqual(expect.objectContaining({
      noSecondEventBus: true,
      livePollPerformed: false,
    }));
    expect(envelope).toEqual(expect.objectContaining({
      nativeContract: 'ZavorthSidecarEventPullEnvelope/v1',
      sourceCursorStoredAsEvidenceOnly: true,
      sourceEventIdStoredAsEvidenceOnly: true,
      noSecondEventBus: true,
      livePollPerformed: false,
      httpRequestOpened: false,
      websocketReadOpened: false,
      sourceEventBusSubscribed: false,
    }));
    expect(envelope.eventEnvelope.kind).toBe('message');
    expect(envelope.normalizedInboundMessage).toEqual(expect.objectContaining({
      requestId: `${envelope.id}:request`,
      channel: 'api',
      text: 'Status event observed through read-only fixture boundary.',
      requestedTools: ['sidecar.status.read'],
    }));
    expect(envelope.normalizedInboundMessage.metadata).toEqual(expect.objectContaining({
      source: 'sidecar-read-only-boundary-pack',
      noSecondEventBus: true,
    }));
  });

  it('keeps SecretRef/runtime config/state as sanitized evidence only', () => {
    const normalized = normalizeWave1SidecarReadOnlyBoundaryPackFixture();

    expect(normalized.runtimeConfig).toEqual(expect.objectContaining({
      nativeContract: 'ZavorthSidecarRuntimeConfigBoundary/v1',
      rawSecretsRead: false,
      envValuesRead: false,
      configMigrated: false,
      stateMigrated: false,
    }));
    expect(normalized.runtimeConfig.secretRefs).toEqual([
      expect.objectContaining({
        purpose: 'health-probe',
        rawSecretValueLoaded: false,
        sourceSecretNameStoredAsEvidenceOnly: true,
        nativeContract: 'SecretRef',
      }),
      expect.objectContaining({
        purpose: 'capability-snapshot',
        rawSecretValueLoaded: false,
        nativeContract: 'SecretRef',
      }),
    ]);
    expect(normalized.runtimeConfig.configKeys).toEqual([
      { id: 'zavorth-sidecar-read-only:config-key-1', sourceConfigKeyStoredAsEvidenceOnly: true },
      { id: 'zavorth-sidecar-read-only:config-key-2', sourceConfigKeyStoredAsEvidenceOnly: true },
    ]);
    expect(normalized.runtimeConfig.statePaths).toEqual([
      { id: 'zavorth-sidecar-read-only:state-path-1', sourceStatePathStoredAsEvidenceOnly: true },
    ]);
    expect(JSON.stringify(normalized)).not.toContain('raw-secret-value');
    expect(JSON.stringify(normalized)).not.toContain('EXTERNAL_EXECUTOR_HOME');
    expect(JSON.stringify(normalized)).not.toContain('/home/source');
  });

  it('models failures as degraded/offline rollback metadata without adapter removal', () => {
    const normalized = normalizeWave1SidecarReadOnlyBoundaryPackFixture();

    expect(normalized.rollback).toEqual(expect.objectContaining({
      nativeContract: 'ZavorthSidecarRollbackModel/v1',
      degradedState: 'offline',
      rollbackAvailable: true,
      disableSidecarRecommended: true,
      zavorthFallbackAvailable: true,
      sourceRuntimeRequired: false,
      adapterRemovalAllowed: false,
      sourceStateMutationAllowed: false,
    }));
    expect(normalized.rollback.failures).toEqual([
      expect.objectContaining({
        kind: 'probe-timeout',
        status: 'degraded',
        retryable: true,
        rollbackRecommended: true,
        sourceFailureStoredAsEvidenceOnly: true,
        sourceStateMutated: false,
        adapterRemoved: false,
      }),
      expect.objectContaining({
        kind: 'stale-snapshot',
        status: 'offline',
        retryable: false,
        rollbackRecommended: false,
      }),
    ]);
  });

  it('projects observability in Zavorth terms and keeps dispatch candidates away from executors', () => {
    const normalized = normalizeWave1SidecarReadOnlyBoundaryPackFixture();

    expect(normalized.blockedDispatch).toEqual(expect.objectContaining({
      actionsReachedExecutor: false,
      executionAuthority: false,
    }));
    expect(normalized.blockedDispatch.candidates).toEqual([
      expect.objectContaining({
        decision: 'approval_required',
        requiresInvocationEnvelope: true,
        requiresPolicyPreflight: true,
        requiresApproval: true,
        executionAuthority: false,
        actionReachedExecutor: false,
        externalToolExecuted: false,
      }),
      expect.objectContaining({
        decision: 'blocked',
        requiresApproval: false,
        actionReachedExecutor: false,
      }),
    ]);
    expect(normalized.observability).toEqual(expect.objectContaining({
      nativeContract: 'ZavorthSidecarObservabilityProjection/v1',
      commandCenter: expect.objectContaining({
        readOnly: true,
        executableControlsExposed: false,
      }),
    }));
    expect(normalized.observability.rows.map((row) => row.kind)).toEqual([
      'process-descriptor',
      'health',
      'capability-snapshot',
      'event-pull',
      'runtime-config',
      'failure-rollback',
      'blocked-dispatch',
    ]);
    normalized.observability.rows.forEach((row) => {
      expect(row.readOnly).toBe(true);
      expect(row.commandCenterVisible).toBe(true);
      expect(row.executableControlExposed).toBe(false);
      expect(row.routeRegistrationControlExposed).toBe(false);
      expect(row.gatewayDispatchControlExposed).toBe(false);
      expect(row.serviceLaunchControlExposed).toBe(false);
      expect(row.cliSpawnControlExposed).toBe(false);
      expect(row.providerExecutionControlExposed).toBe(false);
      expect(row.sourceToolExecutionControlExposed).toBe(false);
    });
  });

  it('enforces global metadata-only and no-live/no-copy invariants', () => {
    const source = createWave1SidecarReadOnlyBoundaryPackFixtureSource();
    const normalized = normalizeWave1SidecarReadOnlyBoundaryPackFixture();
    const output = JSON.stringify(normalized);

    expect(source.sourceRuntimeName).toBe('ExternalExecutor');
    expect(normalized).toEqual(expect.objectContaining({
      nativeContract: 'ZavorthSidecarReadOnlyBoundaryPack/v1',
      metadataOnly: true,
      liveConnectionBlocked: true,
      sourceModulesCopied: false,
      executionGate: {
        sidecarOptional: true,
        zavorthRunsWithoutSidecar: true,
        sidecarProcessStarted: false,
        sourceRuntimeConnected: false,
        externalExecutorLiveCalled: false,
        httpConnectionOpened: false,
        websocketConnectionOpened: false,
        externalCommandExecuted: false,
        externalToolExecuted: false,
        externalProviderExecuted: false,
        sourceHandlerLoaded: false,
        sourceHttpRouteRegistered: false,
        sourceGatewayMethodDispatched: false,
        sourceServiceLaunched: false,
        rawSecretsRead: false,
        configMigrated: false,
        stateMigrated: false,
        sourceModulesCopied: false,
        adapterRemoved: false,
        actionReachedExecutor: false,
      },
    }));
    expect(output).not.toContain('ExternalExecutor');
    expect(output).not.toContain('external-executor');
    expect(output).not.toContain('127.0.0.1:17771');
    expect(output).not.toContain('/opt/external-executor');
  });
});
