import type {
  RuntimeAdapterHealthSnapshot,
} from './contracts.js';
import type {
  ZavorthSidecarCapabilitySnapshot,
  ZavorthSidecarObservabilityProjection,
  RuntimeAdapterSidecarReadOnlyExecutionGate,
} from './RuntimeAdapterSidecarReadOnlyBoundaryPack.js';
import {
  createCanonicalSidecarReadOnlyExecutionGate,
} from './RuntimeAdapterSidecarReadOnlyBoundaryPack.js';

export type ExternalExecutorReadOnlyProbeCommandKind =
  | 'capabilities'
  | 'help'
  | 'health'
  | 'status'
  | 'version';

export type ExternalExecutorReadOnlyProbeCommandStatus =
  | 'failed'
  | 'ok'
  | 'timeout'
  | 'unavailable';

export type ExternalExecutorReadOnlyProbeCommandResult = {
  kind: ExternalExecutorReadOnlyProbeCommandKind;
  commandLabel: string;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  startedAt: string;
  completedAt: string;
  attempted?: boolean;
  timedOut?: boolean;
};

export type ExternalExecutorReadOnlyProbeExecutionGate = RuntimeAdapterSidecarReadOnlyExecutionGate & {
  manualSmokeOnly: true;
  readOnlyCommandsCaptured: true;
  daemonStarted: false;
  mutableHttpOrWebSocketOpened: false;
  messageSent: false;
  pluginInstalled: false;
  dataMigrated: false;
};

export type ExternalExecutorReadOnlyProbeCommandProjection = {
  id: string;
  kind: ExternalExecutorReadOnlyProbeCommandKind;
  commandLabel: string;
  exitCode: number | null;
  status: ExternalExecutorReadOnlyProbeCommandStatus;
  startedAt: string;
  completedAt: string;
  statusCodeCaptured: true;
  commandAttempted: boolean;
  stdoutCaptured: boolean;
  stderrCaptured: boolean;
  stdoutPreview: string;
  stderrPreview: string;
  stdoutStoredAsEvidenceOnly: true;
  stderrStoredAsEvidenceOnly: true;
  rawOutputStored: false;
  secretLikeOutputRedacted: true;
  commandExecutedOutsideNormalizer: boolean;
  mutationAllowed: false;
  nativeContract: 'ZavorthExternalExecutorReadOnlyProbeCommand/v1';
};

export type ExternalExecutorReadOnlyProbeNormalization<TRuntimeId extends string = string> = {
  nativeContract: 'ZavorthExternalExecutorLiveReadOnlyProbe/v1';
  generatedAt: string;
  runtimeId: TRuntimeId;
  commands: ExternalExecutorReadOnlyProbeCommandProjection[];
  health: RuntimeAdapterHealthSnapshot;
  capabilitySnapshot: Pick<
    ZavorthSidecarCapabilitySnapshot,
    'externalToolsExecuted' | 'nativeContract' | 'sourceModulesLoaded' | 'toolExposurePolicyInput'
  > & {
    observedCapabilityCount: number;
    stdoutParsedAsEvidenceOnly: true;
    secretLikeOutputRedacted: true;
  };
  observability: Pick<ZavorthSidecarObservabilityProjection, 'zavorthControl' | 'nativeContract'> & {
    readOnlyProbeRows: Array<{
      id: string;
      kind: ExternalExecutorReadOnlyProbeCommandKind;
      readOnly: true;
      status: ExternalExecutorReadOnlyProbeCommandStatus;
    }>;
  };
  executionGate: ExternalExecutorReadOnlyProbeExecutionGate;
  liveContactSeparatedFromBoundaryPack: true;
  normalizerExecutedLiveCommand: false;
  normalizedIntoReadOnlyBoundaryContracts: true;
  sourceModulesCopied: false;
  adapterRemoved: false;
};

export type ExternalExecutorReadOnlyProbeNormalizationOptions<TRuntimeId extends string = string> = {
  generatedAt: string;
  runtimeId: TRuntimeId;
  commandResults: ExternalExecutorReadOnlyProbeCommandResult[];
  idPrefix: string;
};

const MAX_EVIDENCE_PREVIEW_LENGTH = 400;

function redactProbeEvidence(value: string): string {
  return value
    .replace(/\bsk-[A-Za-z0-9_-]{8,}\b/g, '[redacted-secret]')
    .replace(/\b([A-Z0-9_]*(?:API|ACCESS|AUTH|SECRET|TOKEN|KEY)[A-Z0-9_]*)=([^\s]+)/gi, '$1=[redacted-secret]')
    .replace(/\b(api[_-]?key|authorization|secret|token)\s*[:=]\s*([^\s]+)/gi, '$1=[redacted-secret]');
}

function evidencePreview(value: string): string {
  const redacted = redactProbeEvidence(value.trim());

  if (redacted.length <= MAX_EVIDENCE_PREVIEW_LENGTH) {
    return redacted;
  }

  return `${redacted.slice(0, MAX_EVIDENCE_PREVIEW_LENGTH)}...`;
}

function commandStatus(result: ExternalExecutorReadOnlyProbeCommandResult): ExternalExecutorReadOnlyProbeCommandStatus {
  if (result.timedOut) {
    return 'timeout';
  }
  if (result.attempted === false || result.exitCode === null) {
    return 'unavailable';
  }
  return result.exitCode === 0 ? 'ok' : 'failed';
}

function observedCapabilityCount(results: ExternalExecutorReadOnlyProbeCommandResult[]): number {
  const capabilityResult = results.find((result) => result.kind === 'capabilities');
  if (!capabilityResult || capabilityResult.exitCode !== 0) {
    return 0;
  }

  return capabilityResult.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean).length;
}

function probeHealthStatus(results: ExternalExecutorReadOnlyProbeCommandResult[]): RuntimeAdapterHealthSnapshot['status'] {
  if (results.length === 0) {
    return 'offline';
  }
  if (results.some((result) => result.timedOut)) {
    return 'degraded';
  }
  if (results.every((result) => result.attempted === false || result.exitCode === null)) {
    return 'offline';
  }
  if (results.every((result) => result.exitCode === 0)) {
    return 'ready';
  }
  if (results.some((result) => result.exitCode === 0)) {
    return 'degraded';
  }
  return 'offline';
}

function probeDiagnostics(results: ExternalExecutorReadOnlyProbeCommandResult[]): string[] {
  const statuses = results.map((result) => `${result.kind}:${commandStatus(result)}`);

  return [
    'external-executor-live-read-only-probe',
    'normalized-from-captured-command-output',
    'normalizer-did-not-execute-command',
    ...statuses,
  ];
}

function redactedCommandLabel(result: ExternalExecutorReadOnlyProbeCommandResult): string {
  return evidencePreview(result.commandLabel);
}

function createExternalExecutorReadOnlyProbeExecutionGate(): ExternalExecutorReadOnlyProbeExecutionGate {
  return {
    ...createCanonicalSidecarReadOnlyExecutionGate(),
    manualSmokeOnly: true,
    readOnlyCommandsCaptured: true,
    daemonStarted: false,
    mutableHttpOrWebSocketOpened: false,
    messageSent: false,
    pluginInstalled: false,
    dataMigrated: false,
  };
}

export function normalizeExternalExecutorLiveReadOnlyProbe<TRuntimeId extends string>(
  options: ExternalExecutorReadOnlyProbeNormalizationOptions<TRuntimeId>,
): ExternalExecutorReadOnlyProbeNormalization<TRuntimeId> {
  const commands = options.commandResults.map((result, index): ExternalExecutorReadOnlyProbeCommandProjection => ({
    id: `${options.idPrefix}:command-${index + 1}-${result.kind}`,
    kind: result.kind,
    commandLabel: redactedCommandLabel(result),
    exitCode: result.exitCode,
    status: commandStatus(result),
    startedAt: result.startedAt,
    completedAt: result.completedAt,
    statusCodeCaptured: true,
    commandAttempted: result.attempted !== false,
    stdoutCaptured: result.stdout.length > 0,
    stderrCaptured: result.stderr.length > 0,
    stdoutPreview: evidencePreview(result.stdout),
    stderrPreview: evidencePreview(result.stderr),
    stdoutStoredAsEvidenceOnly: true,
    stderrStoredAsEvidenceOnly: true,
    rawOutputStored: false,
    secretLikeOutputRedacted: true,
    commandExecutedOutsideNormalizer: result.attempted !== false,
    mutationAllowed: false,
    nativeContract: 'ZavorthExternalExecutorReadOnlyProbeCommand/v1',
  }));
  const capabilityCount = observedCapabilityCount(options.commandResults);

  return {
    nativeContract: 'ZavorthExternalExecutorLiveReadOnlyProbe/v1',
    generatedAt: options.generatedAt,
    runtimeId: options.runtimeId,
    commands,
    health: {
      runtimeId: options.runtimeId,
      status: probeHealthStatus(options.commandResults),
      generatedAt: options.generatedAt,
      capabilities: {
        total: capabilityCount,
        trusted: 0,
        safe: capabilityCount,
        quarantined: 0,
      },
      channels: [],
      diagnostics: {
        notes: probeDiagnostics(options.commandResults),
      },
    },
    capabilitySnapshot: {
      observedCapabilityCount: capabilityCount,
      stdoutParsedAsEvidenceOnly: true,
      secretLikeOutputRedacted: true,
      toolExposurePolicyInput: {
        requestedTools: [],
        allowedTools: [],
        requireApprovalFor: [],
        blockedTools: [],
        blockedToolReason: 'live-read-only-probe-does-not-expose-tools',
      },
      sourceModulesLoaded: false,
      externalToolsExecuted: false,
      nativeContract: 'ZavorthSidecarCapabilitySnapshot/v1',
    },
    observability: {
      readOnlyProbeRows: commands.map((command) => ({
        id: `${command.id}:observability`,
        kind: command.kind,
        readOnly: true,
        status: command.status,
      })),
      zavorthControl: {
        readOnly: true,
        rows: [],
        executableControlsExposed: false,
      },
      nativeContract: 'ZavorthSidecarObservabilityProjection/v1',
    },
    executionGate: createExternalExecutorReadOnlyProbeExecutionGate(),
    liveContactSeparatedFromBoundaryPack: true,
    normalizerExecutedLiveCommand: false,
    normalizedIntoReadOnlyBoundaryContracts: true,
    sourceModulesCopied: false,
    adapterRemoved: false,
  };
}
