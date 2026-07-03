import {
  createExternalAgentLiveReadinessNoExecutionPolicy,
  normalizeExternalAgentLiveReadinessAssimilationPack,
} from './ExternalAgentLiveReadinessAssimilationPack.js';
import type {
  ExternalAgentLiveReadinessAssimilationPackNormalization,
  ExternalAgentLiveReadinessCapabilitySource,
  ExternalAgentLiveReadinessSnapshotSource,
} from './ExternalAgentLiveReadinessAssimilationPack.js';

export const EXTERNAL_EXECUTOR_REAL_CAPABILITY_SNAPSHOT_READ_ONLY_NOW = '2026-04-28T19:51:25.000Z' as const;
export const EXTERNAL_EXECUTOR_REAL_CAPABILITY_SNAPSHOT_READ_ONLY_RUNTIME_ID = 'external-executor-real-capability-snapshot-read-only' as const;

export type ExternalExecutorRealCapabilitySnapshotDecision =
  | 'blocked'
  | 'real-capability-snapshot-read-only-ok';

export type ExternalExecutorRealCapabilitySnapshotCommandSummary = {
  exitCode: number;
  ok: boolean;
  durationMs: number | null;
  capability?: string | null;
  rpcOk?: boolean;
};

export type ExternalExecutorRealCapabilitySnapshotReadOnlySource = {
  sourceRuntimeName: 'ExternalExecutor';
  sourceRuntimeVersion: string;
  secretRefStatus: 'present-redacted';
  authenticatedHealthDecision: 'authenticated-health-ok';
  gateway: {
    command: 'external-executor gateway run --auth token --port 18789 --bind loopback --ws-log compact';
    bind: 'loopback';
    port: 18789;
    listenerObserved: true;
    listenerObservedAtMs: number;
    rpcPreflightReady: true;
    rpcPreflightAttempts: number;
    cleanupConfirmed: true;
    postListenerCount: 0;
    postProcessCount: 0;
    configHashBefore: string;
    configHashAfter: string;
  };
  readOnlySafeguards: {
    tokenPrinted: false;
    tokenSerialized: false;
    commandArgTokenUsed: false;
    urlOverrideUsed: false;
    channelsSkipped: boolean;
    providersSkipped: boolean;
    bonjourDisabled: boolean;
    executionAuthority: false;
  };
  commands: {
    health: ExternalExecutorRealCapabilitySnapshotCommandSummary & {
      pluginsLoadedCount: number;
      pluginErrorCount: number;
      channelCount: number;
    };
    status: ExternalExecutorRealCapabilitySnapshotCommandSummary & {
      configValid: boolean;
      listenerCount: number;
      portStatus: 'busy';
      rpcCapability: string;
    };
    probe: ExternalExecutorRealCapabilitySnapshotCommandSummary & {
      authRole: string;
      authCapability: string;
      authScopesCount: number;
      connectOk: boolean;
      healthOk: boolean;
      primaryTargetId: string;
    };
  };
};

export type ExternalExecutorRealCapabilitySnapshotReadOnlyNormalization = {
  nativeContract: 'ZavorthExternalExecutorRealCapabilitySnapshotReadOnly/v1';
  generatedAt: string;
  runtimeId: string;
  decision: ExternalExecutorRealCapabilitySnapshotDecision;
  sourceRuntimeName: 'ExternalExecutor';
  sourceRuntimeVersion: string;
  liveEvidenceCaptured: true;
  readOnly: true;
  executionAuthority: false;
  rawSecretSerialized: false;
  commandArgTokenUsed: false;
  urlOverrideUsed: false;
  gatewayStartedEphemeral: true;
  cleanupConfirmed: true;
  sourceIdsEvidenceOnly: true;
  capabilityInventory: ExternalAgentLiveReadinessAssimilationPackNormalization['snapshot'];
  zavorthControlProjection: ExternalAgentLiveReadinessAssimilationPackNormalization['zavorthControlProjection'];
  capabilityImportClassification: ExternalAgentLiveReadinessAssimilationPackNormalization['capabilityImportClassification'];
  degradedUnavailableStateHandling: ExternalAgentLiveReadinessAssimilationPackNormalization['degradedUnavailableStateHandling'];
  auditReceipts: ExternalAgentLiveReadinessAssimilationPackNormalization['auditReceipts'];
  nextGateRecommended: 'future-read-only-capability-diff-or-adapter-design';
};

export type ExternalExecutorRealCapabilitySnapshotReadOnlyOptions<TRuntimeId extends string = string> = {
  generatedAt: string;
  idPrefix: string;
  runtimeId: TRuntimeId;
  source: ExternalExecutorRealCapabilitySnapshotReadOnlySource;
};

function availabilityForSkippedSurface(skipped: boolean): ExternalAgentLiveReadinessCapabilitySource['availability'] {
  return skipped ? 'degraded' : 'available';
}

function sourceToAssimilationSource(source: ExternalExecutorRealCapabilitySnapshotReadOnlySource): ExternalAgentLiveReadinessSnapshotSource {
  const gatewayAvailable = source.commands.probe.ok && source.commands.probe.rpcOk === true;
  const healthAvailable = source.commands.health.ok && source.commands.status.rpcOk === true;

  return {
    sourceRuntimeName: source.sourceRuntimeName,
    sourceRuntimeVersion: source.sourceRuntimeVersion,
    gatewayMode: 'read-only-simulated',
    healthStatus: healthAvailable ? 'ready' : 'degraded',
    capabilities: [
      {
        rowKind: 'plugin-capabilities',
        publicSourceIdSeed: 'external-executor-real-plugin-inventory',
        label: `ExternalExecutor plugin inventory (${source.commands.health.pluginsLoadedCount} loaded)`,
        kind: 'tool',
        risk: 'attention',
        trustState: 'safe',
        availability: source.commands.health.pluginsLoadedCount > 0 ? 'available' : 'unavailable',
        requiresApprovalHint: true,
        sourceReportedState: `${source.commands.health.pluginsLoadedCount} plugins loaded; import not authorized`,
        toolNames: ['external-executor.plugin.inventory.read'],
        evidenceHints: [
          `pluginsLoadedCount:${source.commands.health.pluginsLoadedCount}`,
          `pluginErrorCount:${source.commands.health.pluginErrorCount}`,
        ],
      },
      {
        rowKind: 'provider-capabilities',
        publicSourceIdSeed: 'external-executor-real-provider-inventory',
        label: 'ExternalExecutor provider inventory',
        kind: 'skill',
        risk: 'attention',
        trustState: 'safe',
        availability: availabilityForSkippedSurface(source.readOnlySafeguards.providersSkipped),
        sourceReportedState: source.readOnlySafeguards.providersSkipped
          ? 'providers skipped by read-only gate'
          : 'providers observed',
        toolNames: ['external-executor.provider.inventory.read'],
        evidenceHints: [
          `providersSkipped:${source.readOnlySafeguards.providersSkipped}`,
          'provider execution authority:false',
        ],
      },
      {
        rowKind: 'channel-capabilities',
        publicSourceIdSeed: 'external-executor-real-channel-inventory',
        label: 'ExternalExecutor channel inventory',
        kind: 'channel',
        risk: 'attention',
        trustState: 'safe',
        availability: availabilityForSkippedSurface(source.readOnlySafeguards.channelsSkipped),
        sourceReportedState: source.readOnlySafeguards.channelsSkipped
          ? 'channels skipped by read-only gate'
          : 'channels observed',
        toolNames: ['external-executor.channel.inventory.read'],
        evidenceHints: [
          `channelCount:${source.commands.health.channelCount}`,
          `channelsSkipped:${source.readOnlySafeguards.channelsSkipped}`,
        ],
      },
      {
        rowKind: 'command-http-capabilities',
        publicSourceIdSeed: 'external-executor-real-command-http-inventory',
        label: 'ExternalExecutor command and HTTP surface inventory',
        kind: 'tool',
        risk: 'danger',
        trustState: 'quarantined',
        availability: 'available',
        sourceReportedState: 'command/http surfaces visible as inventory only',
        toolNames: ['external-executor.command-http.inventory.read'],
        evidenceHints: ['command execution authority:false', 'source commands not invoked'],
      },
      {
        rowKind: 'gateway-method-capabilities',
        publicSourceIdSeed: 'external-executor-real-gateway-method-inventory',
        label: `ExternalExecutor gateway methods (${source.commands.status.rpcCapability})`,
        kind: 'mcp',
        risk: 'attention',
        trustState: 'safe',
        availability: gatewayAvailable ? 'available' : 'degraded',
        requiresApprovalHint: true,
        sourceReportedState: `rpcOk:${source.commands.status.rpcOk === true}; auth:${source.commands.probe.authCapability}`,
        toolNames: ['external-executor.gateway-method.inventory.read'],
        evidenceHints: [
          `authRole:${source.commands.probe.authRole}`,
          `authScopesCount:${source.commands.probe.authScopesCount}`,
          `primaryTargetId:${source.commands.probe.primaryTargetId}`,
        ],
      },
      {
        rowKind: 'worker-node-capabilities',
        publicSourceIdSeed: 'external-executor-real-worker-node-inventory',
        label: 'ExternalExecutor worker/node inventory',
        kind: 'worker',
        risk: 'unknown',
        trustState: 'safe',
        availability: source.gateway.listenerObserved ? 'available' : 'unavailable',
        requiresApprovalHint: true,
        sourceReportedState: `listenerObservedAtMs:${source.gateway.listenerObservedAtMs}`,
        toolNames: ['external-executor.worker-node.inventory.read'],
        evidenceHints: [
          'loopback listener observed',
          `postListenerCount:${source.gateway.postListenerCount}`,
          `postProcessCount:${source.gateway.postProcessCount}`,
        ],
      },
      {
        rowKind: 'session-history-capabilities',
        publicSourceIdSeed: 'external-executor-real-session-history-inventory',
        label: 'ExternalExecutor session/history inventory',
        kind: 'session',
        risk: 'attention',
        trustState: 'safe',
        availability: 'unavailable',
        requiresApprovalHint: true,
        sourceReportedState: 'session/history import intentionally not read',
        toolNames: ['external-executor.session-history.inventory.read'],
        evidenceHints: ['real session import:false', 'message/history content not read'],
      },
    ],
    events: [
      {
        publicEventIdSeed: 'external-executor-real-capability-snapshot-captured',
        rowKind: 'gateway-method-capabilities',
        sessionId: 'external-executor-real-capability-snapshot',
        channel: 'api',
        occurredAt: EXTERNAL_EXECUTOR_REAL_CAPABILITY_SNAPSHOT_READ_ONLY_NOW,
        status: gatewayAvailable ? 'available' : 'degraded',
        text: 'ExternalExecutor real read-only capability snapshot normalized as Zavorth evidence.',
      },
    ],
  };
}

export function createExternalExecutorRealCapabilitySnapshotReadOnlyFixtureSource(): ExternalExecutorRealCapabilitySnapshotReadOnlySource {
  return {
    sourceRuntimeName: 'ExternalExecutor',
    sourceRuntimeVersion: '2026.4.26',
    secretRefStatus: 'present-redacted',
    authenticatedHealthDecision: 'authenticated-health-ok',
    gateway: {
      command: 'external-executor gateway run --auth token --port 18789 --bind loopback --ws-log compact',
      bind: 'loopback',
      port: 18789,
      listenerObserved: true,
      listenerObservedAtMs: 35000,
      rpcPreflightReady: true,
      rpcPreflightAttempts: 7,
      cleanupConfirmed: true,
      postListenerCount: 0,
      postProcessCount: 0,
      configHashBefore: 'd1a32b3211174de9b27422f9fc28ca10d13af63ddcd6ecfece7b132617347fe1',
      configHashAfter: 'd1a32b3211174de9b27422f9fc28ca10d13af63ddcd6ecfece7b132617347fe1',
    },
    readOnlySafeguards: {
      tokenPrinted: false,
      tokenSerialized: false,
      commandArgTokenUsed: false,
      urlOverrideUsed: false,
      channelsSkipped: true,
      providersSkipped: true,
      bonjourDisabled: true,
      executionAuthority: false,
    },
    commands: {
      health: {
        exitCode: 0,
        ok: true,
        durationMs: 177368,
        pluginsLoadedCount: 9,
        pluginErrorCount: 0,
        channelCount: 2,
      },
      status: {
        exitCode: 0,
        ok: true,
        durationMs: null,
        rpcOk: true,
        capability: 'admin_capable',
        rpcCapability: 'admin_capable',
        portStatus: 'busy',
        listenerCount: 1,
        configValid: true,
      },
      probe: {
        exitCode: 0,
        ok: true,
        durationMs: 3106,
        capability: 'admin_capable',
        rpcOk: true,
        authRole: 'operator',
        authCapability: 'admin_capable',
        authScopesCount: 5,
        connectOk: true,
        healthOk: true,
        primaryTargetId: 'localLoopback',
      },
    },
  };
}

export function normalizeExternalExecutorRealCapabilitySnapshotReadOnly<TRuntimeId extends string>(
  options: ExternalExecutorRealCapabilitySnapshotReadOnlyOptions<TRuntimeId>,
): ExternalExecutorRealCapabilitySnapshotReadOnlyNormalization {
  const assimilation = normalizeExternalAgentLiveReadinessAssimilationPack({
    source: sourceToAssimilationSource(options.source),
    generatedAt: options.generatedAt,
    runtimeId: options.runtimeId,
    idPrefix: options.idPrefix,
    executionPolicy: createExternalAgentLiveReadinessNoExecutionPolicy(),
  });

  const decision: ExternalExecutorRealCapabilitySnapshotDecision =
    options.source.authenticatedHealthDecision === 'authenticated-health-ok' &&
    options.source.gateway.cleanupConfirmed &&
    options.source.commands.health.exitCode === 0 &&
    options.source.commands.status.exitCode === 0 &&
    options.source.commands.probe.exitCode === 0
      ? 'real-capability-snapshot-read-only-ok'
      : 'blocked';

  return {
    nativeContract: 'ZavorthExternalExecutorRealCapabilitySnapshotReadOnly/v1',
    generatedAt: options.generatedAt,
    runtimeId: options.runtimeId,
    decision,
    sourceRuntimeName: options.source.sourceRuntimeName,
    sourceRuntimeVersion: options.source.sourceRuntimeVersion,
    liveEvidenceCaptured: true,
    readOnly: true,
    executionAuthority: false,
    rawSecretSerialized: false,
    commandArgTokenUsed: options.source.readOnlySafeguards.commandArgTokenUsed,
    urlOverrideUsed: options.source.readOnlySafeguards.urlOverrideUsed,
    gatewayStartedEphemeral: true,
    cleanupConfirmed: options.source.gateway.cleanupConfirmed,
    sourceIdsEvidenceOnly: true,
    capabilityInventory: assimilation.snapshot,
    zavorthControlProjection: assimilation.zavorthControlProjection,
    capabilityImportClassification: assimilation.capabilityImportClassification,
    degradedUnavailableStateHandling: assimilation.degradedUnavailableStateHandling,
    auditReceipts: assimilation.auditReceipts,
    nextGateRecommended: 'future-read-only-capability-diff-or-adapter-design',
  };
}

export function normalizeExternalExecutorRealCapabilitySnapshotReadOnlyFixture(): ExternalExecutorRealCapabilitySnapshotReadOnlyNormalization {
  return normalizeExternalExecutorRealCapabilitySnapshotReadOnly({
    source: createExternalExecutorRealCapabilitySnapshotReadOnlyFixtureSource(),
    generatedAt: EXTERNAL_EXECUTOR_REAL_CAPABILITY_SNAPSHOT_READ_ONLY_NOW,
    runtimeId: EXTERNAL_EXECUTOR_REAL_CAPABILITY_SNAPSHOT_READ_ONLY_RUNTIME_ID,
    idPrefix: 'external-executor-real-capability-snapshot',
  });
}
