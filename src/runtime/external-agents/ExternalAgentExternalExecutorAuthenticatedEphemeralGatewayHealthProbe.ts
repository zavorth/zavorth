import {
  createWave1SidecarReadOnlyExecutionGate,
} from './ExternalAgentSidecarReadOnlyBoundaryPack.js';

export const EXTERNAL_EXECUTOR_AUTHENTICATED_EPHEMERAL_GATEWAY_HEALTH_PROBE_NOW = '2026-04-28T17:00:00.000Z' as const;
export const EXTERNAL_EXECUTOR_AUTHENTICATED_EPHEMERAL_GATEWAY_HEALTH_PROBE_RUNTIME_ID = 'external-executor-authenticated-ephemeral-gateway-health-probe' as const;

export type ExternalExecutorAuthenticatedEphemeralGatewayHealthProbeDecision =
  | 'auth-secret-unavailable'
  | 'authenticated-health-ok'
  | 'cleanup-failed'
  | 'health-still-degraded'
  | 'injection-channel-blocked'
  | 'start-failed';

export type ExternalExecutorAuthenticatedReadOnlyCommandKind =
  | 'health'
  | 'probe'
  | 'status'
  | 'version';

export type ExternalExecutorAuthenticatedReadOnlyCommandResult = {
  kind: ExternalExecutorAuthenticatedReadOnlyCommandKind;
  commandLabel: string;
  attempted: boolean;
  exitCode: number | null;
  stdout: string;
  stderr: string;
};

export type ExternalExecutorGatewaySecretRefResolution = {
  secretRefId: 'external-executor-gateway-token';
  resolver: 'zavorth-secret-store';
  status: 'injection-channel-blocked' | 'resolved' | 'unavailable';
  unavailableReason?: string;
  accidentalRawCredentialInput?: string;
  rawSecretValueLoadedByNormalizer: false;
  rawSecretValuePrinted: false;
  credentialPassedThroughSecureChannel: boolean;
  commandLineContainsRawSecret: false;
  logsContainRawSecret: false;
};

export type ExternalExecutorAuthenticatedEphemeralGatewayHealthProbeSource = {
  runtimeLabel: string;
  endpoint: 'ws://127.0.0.1:18789';
  priorSecretRefDecision: 'secret-ref-path-known';
  secretRefResolution: ExternalExecutorGatewaySecretRefResolution;
  preflight: {
    preexistingProcessFound: boolean;
    preexistingListenerFound: boolean;
    configHashBefore: string;
    configHashAfter: string;
    configRestored: boolean;
  };
  gatewayStart: {
    attempted: boolean;
    startedByGate: boolean;
    listenerObserved: boolean;
    cleanupAttempted: boolean;
    cleanupSucceeded: boolean;
  };
  commandResults: ExternalExecutorAuthenticatedReadOnlyCommandResult[];
};

export type ExternalExecutorAuthenticatedCommandProjection = {
  id: string;
  kind: ExternalExecutorAuthenticatedReadOnlyCommandKind;
  attempted: boolean;
  exitCode: number | null;
  status: 'failed' | 'ok' | 'skipped';
  commandLabel: string;
  stdoutPreview: string;
  stderrPreview: string;
  rawSecretRedacted: true;
  commandExecutedOutsideNormalizer: boolean;
  readOnly: true;
  nativeContract: 'ZavorthExternalExecutorAuthenticatedReadOnlyCommand/v1';
};

export type ExternalExecutorAuthenticatedEphemeralGatewayExecutionGate = {
  sidecarOptional: true;
  zavorthRunsWithoutSidecar: true;
  sidecarProcessStarted: boolean;
  sourceRuntimeConnected: false;
  externalExecutorLiveCalled: boolean;
  httpConnectionOpened: false;
  websocketConnectionOpened: false;
  externalCommandExecuted: false;
  externalToolExecuted: false;
  externalProviderExecuted: false;
  sourceHandlerLoaded: false;
  sourceHttpRouteRegistered: false;
  sourceGatewayMethodDispatched: false;
  sourceServiceLaunched: false;
  rawSecretsRead: false;
  configMigrated: false;
  stateMigrated: false;
  sourceModulesCopied: false;
  adapterRemoved: false;
  actionReachedExecutor: false;
  authenticatedEphemeralProbeGate: true;
  priorSecretRefDecisionKnown: true;
  secretRefResolutionAttempted: true;
  secretRefResolved: boolean;
  authSecretUnavailable: boolean;
  rawSecretValueLoadedByNormalizer: false;
  rawSecretValuePrinted: false;
  credentialLogged: false;
  credentialPassedThroughSecureChannel: boolean;
  gatewayStartedByGate: boolean;
  readOnlyProbeCommandsAttempted: boolean;
  cleanupConfirmed: boolean;
  persistentDaemonStarted: false;
  adapterCreated: false;
  liveEventStreamOpened: false;
  actionDispatchOpened: false;
  messageSent: false;
  pluginInstalled: false;
  configMutated: boolean;
  stateMutated: false;
  dataMigrated: false;
};

export type ExternalExecutorAuthenticatedEphemeralGatewayHealthProbeNormalization<TRuntimeId extends string = string> = {
  nativeContract: 'ZavorthExternalExecutorAuthenticatedEphemeralGatewayHealthProbe/v1';
  generatedAt: string;
  runtimeId: TRuntimeId;
  decision: ExternalExecutorAuthenticatedEphemeralGatewayHealthProbeDecision;
  endpoint: 'ws://127.0.0.1:18789';
  secretRefId: 'external-executor-gateway-token';
  commandProjections: ExternalExecutorAuthenticatedCommandProjection[];
  diagnostics: string[];
  redaction: {
    rawSecretValueLoadedByNormalizer: false;
    rawSecretValuePrinted: false;
    accidentalRawCredentialInputDiscarded: boolean;
    serializedOutputContainsAccidentalRawCredential: false;
    commandOutputSecretLikeValuesRedacted: true;
  };
  cleanup: {
    preexistingProcessFound: boolean;
    preexistingListenerFound: boolean;
    gatewayStartedByGate: boolean;
    cleanupAttempted: boolean;
    cleanupSucceeded: boolean;
    configHashBefore: string;
    configHashAfter: string;
    configRestored: boolean;
  };
  executionGate: ExternalExecutorAuthenticatedEphemeralGatewayExecutionGate;
  nextGateRecommended: string | null;
  sourceModulesCopied: false;
  adapterRemoved: false;
};

export type ExternalExecutorAuthenticatedEphemeralGatewayHealthProbeOptions<TRuntimeId extends string = string> = {
  generatedAt: string;
  runtimeId: TRuntimeId;
  idPrefix: string;
  source: ExternalExecutorAuthenticatedEphemeralGatewayHealthProbeSource;
};

const SECRET_REF_ID = 'external-executor-gateway-token' as const;

function redactSecretLike(value: string): string {
  return value
    .replace(/(--(?:password|token)\s+)([^\s]+)/gi, '$1[redacted-secret]')
    .replace(/\bsk-[A-Za-z0-9_-]{8,}\b/g, '[redacted-secret]')
    .replace(/\b([A-Z0-9_]*(?:API|ACCESS|AUTH|SECRET|TOKEN|KEY)[A-Z0-9_]*)=([^\s]+)/gi, '$1=[redacted-secret]')
    .replace(/\b(api[_-]?key|authorization|secret|token)(\s*[:=]\s*)([^\s]+)/gi, '$1$2[redacted-secret]');
}

function preview(value: string): string {
  const redacted = redactSecretLike(value.trim());

  return redacted.length > 400 ? `${redacted.slice(0, 400)}...` : redacted;
}

function commandStatus(result: ExternalExecutorAuthenticatedReadOnlyCommandResult): ExternalExecutorAuthenticatedCommandProjection['status'] {
  if (!result.attempted) {
    return 'skipped';
  }

  return result.exitCode === 0 ? 'ok' : 'failed';
}

function determineDecision(
  source: ExternalExecutorAuthenticatedEphemeralGatewayHealthProbeSource,
): ExternalExecutorAuthenticatedEphemeralGatewayHealthProbeDecision {
  if (source.secretRefResolution.status !== 'resolved') {
    if (source.secretRefResolution.status === 'injection-channel-blocked') {
      return 'injection-channel-blocked';
    }

    return 'auth-secret-unavailable';
  }
  if (source.gatewayStart.attempted && !source.gatewayStart.startedByGate) {
    return 'start-failed';
  }
  if (source.gatewayStart.startedByGate && !source.gatewayStart.cleanupSucceeded) {
    return 'cleanup-failed';
  }

  const health = source.commandResults.find((result) => result.kind === 'health');

  if (health?.attempted && health.exitCode === 0) {
    return 'authenticated-health-ok';
  }

  return 'health-still-degraded';
}

function buildExecutionGate(
  source: ExternalExecutorAuthenticatedEphemeralGatewayHealthProbeSource,
): ExternalExecutorAuthenticatedEphemeralGatewayExecutionGate {
  const secretRefResolved = source.secretRefResolution.status === 'resolved';
  const readOnlyProbeCommandsAttempted = source.commandResults.some((result) => result.attempted);

  return {
    ...createWave1SidecarReadOnlyExecutionGate(),
    authenticatedEphemeralProbeGate: true,
    priorSecretRefDecisionKnown: true,
    secretRefResolutionAttempted: true,
    secretRefResolved,
    authSecretUnavailable: !secretRefResolved,
    rawSecretValueLoadedByNormalizer: false,
    rawSecretValuePrinted: false,
    credentialLogged: false,
    credentialPassedThroughSecureChannel: source.secretRefResolution.credentialPassedThroughSecureChannel,
    gatewayStartedByGate: source.gatewayStart.startedByGate,
    readOnlyProbeCommandsAttempted,
    cleanupConfirmed: source.gatewayStart.startedByGate ? source.gatewayStart.cleanupSucceeded : true,
    persistentDaemonStarted: false,
    adapterCreated: false,
    liveEventStreamOpened: false,
    actionDispatchOpened: false,
    messageSent: false,
    pluginInstalled: false,
    configMutated: source.preflight.configHashBefore !== source.preflight.configHashAfter && !source.preflight.configRestored,
    stateMutated: false,
    dataMigrated: false,
    sidecarProcessStarted: source.gatewayStart.startedByGate,
    sourceRuntimeConnected: false,
    externalExecutorLiveCalled: source.gatewayStart.startedByGate,
    externalCommandExecuted: false,
    rawSecretsRead: false,
    configMigrated: false,
    stateMigrated: false,
    sourceModulesCopied: false,
    adapterRemoved: false,
    actionReachedExecutor: false,
  };
}

function buildDiagnostics(
  decision: ExternalExecutorAuthenticatedEphemeralGatewayHealthProbeDecision,
  source: ExternalExecutorAuthenticatedEphemeralGatewayHealthProbeSource,
): string[] {
  const diagnostics = [
    `decision:${decision}`,
    `secret-ref:${source.secretRefResolution.status}`,
    `gateway-start-attempted:${source.gatewayStart.attempted}`,
    `listener-observed:${source.gatewayStart.listenerObserved}`,
    `commands-attempted:${source.commandResults.filter((result) => result.attempted).length}`,
  ];

  if (source.secretRefResolution.unavailableReason) {
    diagnostics.push(`secret-ref-unavailable-reason:${source.secretRefResolution.unavailableReason}`);
  }

  return diagnostics;
}

export function createExternalExecutorAuthenticatedEphemeralGatewayHealthProbeUnavailableFixtureSource(): ExternalExecutorAuthenticatedEphemeralGatewayHealthProbeSource {
  return {
    runtimeLabel: 'ExternalExecutor gateway authenticated ephemeral health probe',
    endpoint: 'ws://127.0.0.1:18789',
    priorSecretRefDecision: 'secret-ref-path-known',
    secretRefResolution: {
      secretRefId: SECRET_REF_ID,
      resolver: 'zavorth-secret-store',
      status: 'unavailable',
      unavailableReason: 'no-real-provisioned-secret-for-external-executor-gateway-token',
      rawSecretValueLoadedByNormalizer: false,
      rawSecretValuePrinted: false,
      credentialPassedThroughSecureChannel: false,
      commandLineContainsRawSecret: false,
      logsContainRawSecret: false,
    },
    preflight: {
      preexistingProcessFound: false,
      preexistingListenerFound: false,
      configHashBefore: 'c506184cbcaea9181f133e49750287bb7d0e45516ad5854af5fc43607c1e351d',
      configHashAfter: 'c506184cbcaea9181f133e49750287bb7d0e45516ad5854af5fc43607c1e351d',
      configRestored: true,
    },
    gatewayStart: {
      attempted: false,
      startedByGate: false,
      listenerObserved: false,
      cleanupAttempted: false,
      cleanupSucceeded: true,
    },
    commandResults: [],
  };
}

export function normalizeExternalExecutorAuthenticatedEphemeralGatewayHealthProbe<TRuntimeId extends string>(
  options: ExternalExecutorAuthenticatedEphemeralGatewayHealthProbeOptions<TRuntimeId>,
): ExternalExecutorAuthenticatedEphemeralGatewayHealthProbeNormalization<TRuntimeId> {
  const decision = determineDecision(options.source);
  const commandProjections = options.source.commandResults.map((result, index): ExternalExecutorAuthenticatedCommandProjection => ({
    id: `${options.idPrefix}:command-${index + 1}-${result.kind}`,
    kind: result.kind,
    attempted: result.attempted,
    exitCode: result.exitCode,
    status: commandStatus(result),
    commandLabel: preview(result.commandLabel),
    stdoutPreview: preview(result.stdout),
    stderrPreview: preview(result.stderr),
    rawSecretRedacted: true,
    commandExecutedOutsideNormalizer: result.attempted,
    readOnly: true,
    nativeContract: 'ZavorthExternalExecutorAuthenticatedReadOnlyCommand/v1',
  }));

  return {
    nativeContract: 'ZavorthExternalExecutorAuthenticatedEphemeralGatewayHealthProbe/v1',
    generatedAt: options.generatedAt,
    runtimeId: options.runtimeId,
    decision,
    endpoint: options.source.endpoint,
    secretRefId: SECRET_REF_ID,
    commandProjections,
    diagnostics: buildDiagnostics(decision, options.source),
    redaction: {
      rawSecretValueLoadedByNormalizer: false,
      rawSecretValuePrinted: false,
      accidentalRawCredentialInputDiscarded: options.source.secretRefResolution.accidentalRawCredentialInput !== undefined,
      serializedOutputContainsAccidentalRawCredential: false,
      commandOutputSecretLikeValuesRedacted: true,
    },
    cleanup: {
      preexistingProcessFound: options.source.preflight.preexistingProcessFound,
      preexistingListenerFound: options.source.preflight.preexistingListenerFound,
      gatewayStartedByGate: options.source.gatewayStart.startedByGate,
      cleanupAttempted: options.source.gatewayStart.cleanupAttempted,
      cleanupSucceeded: options.source.gatewayStart.cleanupSucceeded,
      configHashBefore: options.source.preflight.configHashBefore,
      configHashAfter: options.source.preflight.configHashAfter,
      configRestored: options.source.preflight.configRestored,
    },
    executionGate: buildExecutionGate(options.source),
    nextGateRecommended: decision === 'authenticated-health-ok'
      ? 'docs/161-wave-1-real-capability-snapshot-read-only.md'
      : null,
    sourceModulesCopied: false,
    adapterRemoved: false,
  };
}

export function normalizeExternalExecutorAuthenticatedEphemeralGatewayHealthProbeUnavailableFixture(): ExternalExecutorAuthenticatedEphemeralGatewayHealthProbeNormalization<typeof EXTERNAL_EXECUTOR_AUTHENTICATED_EPHEMERAL_GATEWAY_HEALTH_PROBE_RUNTIME_ID> {
  return normalizeExternalExecutorAuthenticatedEphemeralGatewayHealthProbe({
    source: createExternalExecutorAuthenticatedEphemeralGatewayHealthProbeUnavailableFixtureSource(),
    generatedAt: EXTERNAL_EXECUTOR_AUTHENTICATED_EPHEMERAL_GATEWAY_HEALTH_PROBE_NOW,
    runtimeId: EXTERNAL_EXECUTOR_AUTHENTICATED_EPHEMERAL_GATEWAY_HEALTH_PROBE_RUNTIME_ID,
    idPrefix: 'external-executor-authenticated-ephemeral-health',
  });
}
