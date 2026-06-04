import {
  GOVERNED_EXECUTOR_BOUNDARY,
} from '../agent/executors/GovernedExecutorAdapter.js';
import {
  planZavorthExternalDryRunActionsFixture,
} from './RuntimeAdapterControlledDryRunActionPlanner.js';
import type {
  GovernedExecutorBoundary,
} from '../agent/executors/GovernedExecutorAdapter.js';
import type {
  RuntimeAdapterLiveReadinessCapabilityAvailability,
  RuntimeAdapterLiveReadinessCapabilityRowKind,
  RuntimeAdapterLiveReadinessImportClassification,
} from './RuntimeAdapterLiveReadinessAssimilationPack.js';
import type {
  ZavorthExternalActionIntent,
} from './RuntimeAdapterControlledActionDispatchDesign.js';
import type {
  ZavorthExternalDryRunActionPlannerNormalization,
  ZavorthExternalDryRunActionPlannerPreflight,
} from './RuntimeAdapterControlledDryRunActionPlanner.js';

export const RUNTIME_ADAPTER_GOVERNED_READ_ONLY_CAPABILITY_REFRESH_NOW = '2026-04-28T23:30:00.000Z' as const;
export const RUNTIME_ADAPTER_GOVERNED_READ_ONLY_CAPABILITY_REFRESH_RUNTIME_ID = 'runtime-adapter-governed-read-only-capability-refresh' as const;

export type ZavorthGovernedReadOnlyCapabilityRefreshDecision =
  | 'blocked'
  | 'governed-read-only-capability-refresh-degraded'
  | 'governed-read-only-capability-refresh-ok';

export type ZavorthGovernedReadOnlyCapabilityRefreshMethod =
  | 'gateway.probe'
  | 'gateway.status';

export type ZavorthGovernedReadOnlyCapabilityRefreshCommandEvidence = {
  method: ZavorthGovernedReadOnlyCapabilityRefreshMethod;
  attempted: boolean;
  exitCode: number | null;
  durationMs: number | null;
  capabilityEvidenceObserved: boolean;
  stdoutPreviewRedacted: string;
  stderrPreviewRedacted: string;
};

export type ZavorthGovernedReadOnlyCapabilityRefreshSource = {
  dryRunPlanner: ZavorthExternalDryRunActionPlannerNormalization;
  secretRefId: 'external-executor-gateway-token';
  secretRefStatus: 'present-redacted';
  tokenInjectionChannel: 'env-var';
  commandArgTokenUsed: false;
  urlOverrideUsed: false;
  envGuards: {
    skipChannels: true;
    skipProviders: true;
    disableBonjour: true;
  };
  preflight: {
    preexistingListenerCount: 0;
    preexistingProcessCount: 0;
    intentPassedPolicyPreflight: boolean;
    plannerGeneratedReadOnlyPlan: boolean;
  };
  gateway: {
    startedEphemeral: boolean;
    bind: 'loopback';
    port: 18789;
    listenerObserved: boolean;
    listenerObservedAtMs: number;
  };
  commands: ZavorthGovernedReadOnlyCapabilityRefreshCommandEvidence[];
  cleanup: {
    finalListenerCount: 0;
    finalProcessCount: 0;
    processStartedByGateOnly: true;
  };
  forbiddenActions: {
    messageActuallySent: false;
    providerActuallyExecuted: false;
    commandActuallyExecuted: false;
    toolActuallyExecuted: false;
    gatewayMutationActuallyCalled: false;
    sessionMutationActuallyPerformed: false;
    sourceAuthorityGranted: false;
    sourceModuleCopied: false;
    nativeReplacementAuthorized: false;
    rawSecretSerialized: false;
  };
};

export type ZavorthGovernedReadOnlyCapabilityRefreshSnapshotRow = {
  nativeContract: 'ZavorthGovernedReadOnlyCapabilityRefreshSnapshotRow/v1';
  id: string;
  rowKind: RuntimeAdapterLiveReadinessCapabilityRowKind;
  availability: RuntimeAdapterLiveReadinessCapabilityAvailability;
  importClassification: RuntimeAdapterLiveReadinessImportClassification;
  policy: 'allowed' | 'approval-required' | 'blocked';
  sourceIdsEvidenceOnly: true;
  sourceCapabilityAuthority: false;
  executionAuthority: false;
  readOnly: true;
};

export type ZavorthGovernedReadOnlyCapabilityRefreshSnapshot = {
  nativeContract: 'ZavorthGovernedReadOnlyCapabilityRefreshSnapshot/v1';
  id: string;
  rows: ZavorthGovernedReadOnlyCapabilityRefreshSnapshotRow[];
  normalizedBy: 'zavorth-governed-read-only-capability-refresh';
  sourceSnapshotReplaced: false;
  readOnly: true;
  executionAuthority: false;
};

export type ZavorthGovernedReadOnlyCapabilityProjectionUpdate = {
  nativeContract: 'ZavorthDashboardCapabilityProjectionUpdate/v1';
  id: string;
  rows: Array<{
    id: string;
    rowKind: RuntimeAdapterLiveReadinessCapabilityRowKind;
    status: 'approval-required' | 'blocked' | 'degraded' | 'ready' | 'unavailable';
    readOnly: true;
    dashboardConsumable: true;
    sourceAuthorityGranted: false;
  }>;
  inMemoryOnly: true;
  writeBackAllowed: false;
  migrationAllowed: false;
};

export type ZavorthGovernedReadOnlyCapabilityRefreshDispatchPlan = {
  nativeContract: 'ZavorthExternalActionDispatchPlan/v1';
  id: string;
  intentId: string;
  preflightId: string;
  planState: 'governed-read-only-capability-refresh-executable';
  governedExecutorBoundary: GovernedExecutorBoundary;
  executorEntrypoint: GovernedExecutorBoundary['entrypoint'];
  directExternalInvocationAllowed: false;
  readOnlyCapabilityRefreshOnly: true;
  mutableGatewayMethodAllowed: false;
  sourceCapabilityInputOnly: true;
  sourceAuthorityGranted: false;
  externalAdapterInvoked: false;
  sourceModuleCopied: false;
  nativeReplacementAuthorized: false;
  rawSecretSerialized: false;
};

export type ZavorthGovernedReadOnlyCapabilityRefreshReceipt = {
  nativeContract: 'ZavorthExternalActionReceipt/v1';
  id: string;
  intentId: string;
  preflightId: string;
  dispatchPlanId: string;
  status: 'real-read-only-capability-refresh-degraded' | 'real-read-only-capability-refresh-success';
  auditAuthority: 'zavorth-audit-receipt';
  realReceipt: true;
  redacted: true;
  readOnly: true;
  readOnlyCapabilityRefreshActuallyPerformed: boolean;
  commandEvidence: ZavorthGovernedReadOnlyCapabilityRefreshCommandEvidence[];
  statusDurationMs: number | null;
  probeDurationMs: number | null;
  cleanupConfirmed: boolean;
  degradedReason?: string;
  messageActuallySent: false;
  providerActuallyExecuted: false;
  commandActuallyExecuted: false;
  toolActuallyExecuted: false;
  gatewayMutationActuallyCalled: false;
  sessionMutationActuallyPerformed: false;
  sourceAuthorityGranted: false;
  externalAdapterInvoked: false;
  sourceModuleCopied: false;
  nativeReplacementAuthorized: false;
  rawSecretSerialized: false;
};

export type ZavorthGovernedReadOnlyCapabilityRefreshExecutionGate = {
  executionAuthority: 'zavorth-governed-read-only-capability-refresh';
  readOnlyCapabilityRefreshActuallyPerformed: boolean;
  messageActuallySent: false;
  providerActuallyExecuted: false;
  commandActuallyExecuted: false;
  toolActuallyExecuted: false;
  gatewayMutationActuallyCalled: false;
  sessionMutationActuallyPerformed: false;
  sourceAuthorityGranted: false;
  externalAdapterInvoked: false;
  sourceModuleCopied: false;
  nativeReplacementAuthorized: false;
  rawSecretSerialized: false;
};

export type ZavorthGovernedReadOnlyCapabilityRefreshNormalization = {
  nativeContract: 'ZavorthGovernedReadOnlyCapabilityRefresh/v1';
  generatedAt: string;
  runtimeId: string;
  decision: ZavorthGovernedReadOnlyCapabilityRefreshDecision;
  intent: ZavorthExternalActionIntent;
  policyPreflight: ZavorthExternalDryRunActionPlannerPreflight;
  dispatchPlan: ZavorthGovernedReadOnlyCapabilityRefreshDispatchPlan;
  capabilitySnapshot: ZavorthGovernedReadOnlyCapabilityRefreshSnapshot;
  projectionUpdate: ZavorthGovernedReadOnlyCapabilityProjectionUpdate;
  receipt: ZavorthGovernedReadOnlyCapabilityRefreshReceipt;
  cleanup: ZavorthGovernedReadOnlyCapabilityRefreshSource['cleanup'];
  executionGate: ZavorthGovernedReadOnlyCapabilityRefreshExecutionGate;
  redaction: {
    rawSecretSerialized: false;
    commandArgTokenUsed: false;
    urlOverrideUsed: false;
    stdoutRedacted: true;
    stderrRedacted: true;
    serializedOutputContainsRawSecret: false;
  };
  nextGateRecommended: 'future-governed-read-only-refresh-operator-review';
};

export type ZavorthGovernedReadOnlyCapabilityRefreshOptions<TRuntimeId extends string = string> = {
  generatedAt: string;
  idPrefix: string;
  runtimeId: TRuntimeId;
  source: ZavorthGovernedReadOnlyCapabilityRefreshSource;
};

function findGatewayIntent(planner: ZavorthExternalDryRunActionPlannerNormalization): ZavorthExternalActionIntent {
  const intentId = planner.classifications.readOnlyAllowed[0] || planner.classifications.dryRunAllowed[0];
  const intent = planner.intents.find((candidate) => candidate.id === intentId);

  if (!intent) {
    throw new Error('Missing read-only gateway intent for governed capability refresh.');
  }

  return intent;
}

function findPreflight(
  planner: ZavorthExternalDryRunActionPlannerNormalization,
  intentId: string,
): ZavorthExternalDryRunActionPlannerPreflight {
  const preflight = planner.preflights.find((candidate) => candidate.intentId === intentId);

  if (!preflight) {
    throw new Error(`Missing policy preflight for governed capability refresh intent: ${intentId}`);
  }

  return preflight;
}

function determineDecision(
  source: ZavorthGovernedReadOnlyCapabilityRefreshSource,
): ZavorthGovernedReadOnlyCapabilityRefreshDecision {
  if (
    source.dryRunPlanner.decision !== 'controlled-dry-run-action-planner-ready' ||
    !source.preflight.intentPassedPolicyPreflight ||
    !source.preflight.plannerGeneratedReadOnlyPlan ||
    source.cleanup.finalListenerCount !== 0 ||
    source.cleanup.finalProcessCount !== 0 ||
    source.forbiddenActions.rawSecretSerialized
  ) {
    return 'blocked';
  }

  const performed = source.commands.some((command) => command.attempted);
  const succeeded = source.commands.some((command) => command.exitCode === 0 && command.capabilityEvidenceObserved);

  if (!performed || !succeeded) {
    return 'governed-read-only-capability-refresh-degraded';
  }

  return 'governed-read-only-capability-refresh-ok';
}

function buildDispatchPlan(
  idPrefix: string,
  intent: ZavorthExternalActionIntent,
  preflight: ZavorthExternalDryRunActionPlannerPreflight,
): ZavorthGovernedReadOnlyCapabilityRefreshDispatchPlan {
  return {
    nativeContract: 'ZavorthExternalActionDispatchPlan/v1',
    id: `${idPrefix}:dispatch-plan`,
    intentId: intent.id,
    preflightId: preflight.id,
    planState: 'governed-read-only-capability-refresh-executable',
    governedExecutorBoundary: GOVERNED_EXECUTOR_BOUNDARY,
    executorEntrypoint: GOVERNED_EXECUTOR_BOUNDARY.entrypoint,
    directExternalInvocationAllowed: false,
    readOnlyCapabilityRefreshOnly: true,
    mutableGatewayMethodAllowed: false,
    sourceCapabilityInputOnly: true,
    sourceAuthorityGranted: false,
    externalAdapterInvoked: false,
    sourceModuleCopied: false,
    nativeReplacementAuthorized: false,
    rawSecretSerialized: false,
  };
}

function buildSnapshotRow(
  idPrefix: string,
  rowKind: RuntimeAdapterLiveReadinessCapabilityRowKind,
  availability: RuntimeAdapterLiveReadinessCapabilityAvailability,
  importClassification: RuntimeAdapterLiveReadinessImportClassification,
  policy: 'allowed' | 'approval-required' | 'blocked',
): ZavorthGovernedReadOnlyCapabilityRefreshSnapshotRow {
  return {
    nativeContract: 'ZavorthGovernedReadOnlyCapabilityRefreshSnapshotRow/v1',
    id: `${idPrefix}:snapshot-row:${rowKind}`,
    rowKind,
    availability,
    importClassification,
    policy,
    sourceIdsEvidenceOnly: true,
    sourceCapabilityAuthority: false,
    executionAuthority: false,
    readOnly: true,
  };
}

function buildCapabilitySnapshot(
  idPrefix: string,
  source: ZavorthGovernedReadOnlyCapabilityRefreshSource,
): ZavorthGovernedReadOnlyCapabilityRefreshSnapshot {
  const gatewayEvidenceOk = source.commands.some((command) => (
    command.method === 'gateway.probe' && command.exitCode === 0 && command.capabilityEvidenceObserved
  ));

  return {
    nativeContract: 'ZavorthGovernedReadOnlyCapabilityRefreshSnapshot/v1',
    id: `${idPrefix}:capability-snapshot`,
    rows: [
      buildSnapshotRow(idPrefix, 'gateway-method-capabilities', gatewayEvidenceOk ? 'available' : 'degraded', 'approval-required', 'approval-required'),
      buildSnapshotRow(idPrefix, 'worker-node-capabilities', source.gateway.listenerObserved ? 'available' : 'unavailable', 'approval-required', 'approval-required'),
      buildSnapshotRow(idPrefix, 'provider-capabilities', source.envGuards.skipProviders ? 'degraded' : 'available', 'degraded', 'approval-required'),
      buildSnapshotRow(idPrefix, 'channel-capabilities', source.envGuards.skipChannels ? 'degraded' : 'available', 'degraded', 'approval-required'),
      buildSnapshotRow(idPrefix, 'command-http-capabilities', 'available', 'blocked', 'blocked'),
      buildSnapshotRow(idPrefix, 'plugin-capabilities', 'available', 'approval-required', 'approval-required'),
      buildSnapshotRow(idPrefix, 'session-history-capabilities', 'unavailable', 'unavailable', 'blocked'),
    ],
    normalizedBy: 'zavorth-governed-read-only-capability-refresh',
    sourceSnapshotReplaced: false,
    readOnly: true,
    executionAuthority: false,
  };
}

function projectionStatus(
  row: ZavorthGovernedReadOnlyCapabilityRefreshSnapshotRow,
): ZavorthGovernedReadOnlyCapabilityProjectionUpdate['rows'][number]['status'] {
  if (row.policy === 'blocked' || row.importClassification === 'blocked') {
    return 'blocked';
  }
  if (row.availability === 'unavailable' || row.importClassification === 'unavailable') {
    return 'unavailable';
  }
  if (row.availability === 'degraded' || row.importClassification === 'degraded') {
    return 'degraded';
  }
  if (row.policy === 'approval-required' || row.importClassification === 'approval-required') {
    return 'approval-required';
  }
  return 'ready';
}

function buildProjectionUpdate(
  idPrefix: string,
  snapshot: ZavorthGovernedReadOnlyCapabilityRefreshSnapshot,
): ZavorthGovernedReadOnlyCapabilityProjectionUpdate {
  return {
    nativeContract: 'ZavorthDashboardCapabilityProjectionUpdate/v1',
    id: `${idPrefix}:projection-update`,
    rows: snapshot.rows.map((row) => ({
      id: `${row.id}:projection`,
      rowKind: row.rowKind,
      status: projectionStatus(row),
      readOnly: true,
      dashboardConsumable: true,
      sourceAuthorityGranted: false,
    })),
    inMemoryOnly: true,
    writeBackAllowed: false,
    migrationAllowed: false,
  };
}

function commandDuration(
  commands: ZavorthGovernedReadOnlyCapabilityRefreshCommandEvidence[],
  method: ZavorthGovernedReadOnlyCapabilityRefreshMethod,
): number | null {
  return commands.find((command) => command.method === method)?.durationMs ?? null;
}

function buildReceipt(
  idPrefix: string,
  intent: ZavorthExternalActionIntent,
  preflight: ZavorthExternalDryRunActionPlannerPreflight,
  dispatchPlan: ZavorthGovernedReadOnlyCapabilityRefreshDispatchPlan,
  source: ZavorthGovernedReadOnlyCapabilityRefreshSource,
  decision: ZavorthGovernedReadOnlyCapabilityRefreshDecision,
): ZavorthGovernedReadOnlyCapabilityRefreshReceipt {
  const success = decision === 'governed-read-only-capability-refresh-ok';

  return {
    nativeContract: 'ZavorthExternalActionReceipt/v1',
    id: `${idPrefix}:receipt`,
    intentId: intent.id,
    preflightId: preflight.id,
    dispatchPlanId: dispatchPlan.id,
    status: success ? 'real-read-only-capability-refresh-success' : 'real-read-only-capability-refresh-degraded',
    auditAuthority: 'zavorth-audit-receipt',
    realReceipt: true,
    redacted: true,
    readOnly: true,
    readOnlyCapabilityRefreshActuallyPerformed: source.commands.some((command) => command.attempted),
    commandEvidence: source.commands,
    statusDurationMs: commandDuration(source.commands, 'gateway.status'),
    probeDurationMs: commandDuration(source.commands, 'gateway.probe'),
    cleanupConfirmed: source.cleanup.finalListenerCount === 0 && source.cleanup.finalProcessCount === 0,
    ...(success ? {} : { degradedReason: 'capability-refresh-read-only-call-degraded' }),
    messageActuallySent: false,
    providerActuallyExecuted: false,
    commandActuallyExecuted: false,
    toolActuallyExecuted: false,
    gatewayMutationActuallyCalled: false,
    sessionMutationActuallyPerformed: false,
    sourceAuthorityGranted: false,
    externalAdapterInvoked: false,
    sourceModuleCopied: false,
    nativeReplacementAuthorized: false,
    rawSecretSerialized: false,
  };
}

function buildExecutionGate(
  source: ZavorthGovernedReadOnlyCapabilityRefreshSource,
): ZavorthGovernedReadOnlyCapabilityRefreshExecutionGate {
  return {
    executionAuthority: 'zavorth-governed-read-only-capability-refresh',
    readOnlyCapabilityRefreshActuallyPerformed: source.commands.some((command) => command.attempted),
    messageActuallySent: false,
    providerActuallyExecuted: false,
    commandActuallyExecuted: false,
    toolActuallyExecuted: false,
    gatewayMutationActuallyCalled: false,
    sessionMutationActuallyPerformed: false,
    sourceAuthorityGranted: false,
    externalAdapterInvoked: false,
    sourceModuleCopied: false,
    nativeReplacementAuthorized: false,
    rawSecretSerialized: false,
  };
}

export function createGovernedReadOnlyCapabilityRefreshFixtureSource(): ZavorthGovernedReadOnlyCapabilityRefreshSource {
  return {
    dryRunPlanner: planZavorthExternalDryRunActionsFixture(),
    secretRefId: 'external-executor-gateway-token',
    secretRefStatus: 'present-redacted',
    tokenInjectionChannel: 'env-var',
    commandArgTokenUsed: false,
    urlOverrideUsed: false,
    envGuards: {
      skipChannels: true,
      skipProviders: true,
      disableBonjour: true,
    },
    preflight: {
      preexistingListenerCount: 0,
      preexistingProcessCount: 0,
      intentPassedPolicyPreflight: true,
      plannerGeneratedReadOnlyPlan: true,
    },
    gateway: {
      startedEphemeral: true,
      bind: 'loopback',
      port: 18789,
      listenerObserved: true,
      listenerObservedAtMs: 27500,
    },
    commands: [
      {
        method: 'gateway.status',
        attempted: true,
        exitCode: 0,
        durationMs: 127228,
        capabilityEvidenceObserved: true,
        stdoutPreviewRedacted: 'gateway status returned service/config/gateway metadata with sensitive fields redacted',
        stderrPreviewRedacted: '',
      },
      {
        method: 'gateway.probe',
        attempted: true,
        exitCode: 0,
        durationMs: 30322,
        capabilityEvidenceObserved: true,
        stdoutPreviewRedacted: 'gateway probe returned ok, admin capability, loopback target, auth role, and health metadata with sensitive fields redacted',
        stderrPreviewRedacted: '',
      },
    ],
    cleanup: {
      finalListenerCount: 0,
      finalProcessCount: 0,
      processStartedByGateOnly: true,
    },
    forbiddenActions: {
      messageActuallySent: false,
      providerActuallyExecuted: false,
      commandActuallyExecuted: false,
      toolActuallyExecuted: false,
      gatewayMutationActuallyCalled: false,
      sessionMutationActuallyPerformed: false,
      sourceAuthorityGranted: false,
      sourceModuleCopied: false,
      nativeReplacementAuthorized: false,
      rawSecretSerialized: false,
    },
  };
}

export function createGovernedReadOnlyCapabilityRefreshDegradedFixtureSource(): ZavorthGovernedReadOnlyCapabilityRefreshSource {
  return {
    ...createGovernedReadOnlyCapabilityRefreshFixtureSource(),
    commands: [
      {
        method: 'gateway.status',
        attempted: true,
        exitCode: 124,
        durationMs: 120000,
        capabilityEvidenceObserved: false,
        stdoutPreviewRedacted: '',
        stderrPreviewRedacted: 'timeout while waiting for read-only gateway status',
      },
      {
        method: 'gateway.probe',
        attempted: false,
        exitCode: null,
        durationMs: null,
        capabilityEvidenceObserved: false,
        stdoutPreviewRedacted: '',
        stderrPreviewRedacted: '',
      },
    ],
  };
}

export function normalizeGovernedReadOnlyCapabilityRefresh<TRuntimeId extends string>(
  options: ZavorthGovernedReadOnlyCapabilityRefreshOptions<TRuntimeId>,
): ZavorthGovernedReadOnlyCapabilityRefreshNormalization {
  const intent = findGatewayIntent(options.source.dryRunPlanner);
  const policyPreflight = findPreflight(options.source.dryRunPlanner, intent.id);
  const dispatchPlan = buildDispatchPlan(options.idPrefix, intent, policyPreflight);
  const decision = determineDecision(options.source);
  const capabilitySnapshot = buildCapabilitySnapshot(options.idPrefix, options.source);
  const projectionUpdate = buildProjectionUpdate(options.idPrefix, capabilitySnapshot);
  const receipt = buildReceipt(options.idPrefix, intent, policyPreflight, dispatchPlan, options.source, decision);

  return {
    nativeContract: 'ZavorthGovernedReadOnlyCapabilityRefresh/v1',
    generatedAt: options.generatedAt,
    runtimeId: options.runtimeId,
    decision,
    intent,
    policyPreflight,
    dispatchPlan,
    capabilitySnapshot,
    projectionUpdate,
    receipt,
    cleanup: options.source.cleanup,
    executionGate: buildExecutionGate(options.source),
    redaction: {
      rawSecretSerialized: false,
      commandArgTokenUsed: false,
      urlOverrideUsed: false,
      stdoutRedacted: true,
      stderrRedacted: true,
      serializedOutputContainsRawSecret: false,
    },
    nextGateRecommended: 'future-governed-read-only-refresh-operator-review',
  };
}

export function normalizeGovernedReadOnlyCapabilityRefreshFixture(): ZavorthGovernedReadOnlyCapabilityRefreshNormalization {
  return normalizeGovernedReadOnlyCapabilityRefresh({
    source: createGovernedReadOnlyCapabilityRefreshFixtureSource(),
    generatedAt: RUNTIME_ADAPTER_GOVERNED_READ_ONLY_CAPABILITY_REFRESH_NOW,
    runtimeId: RUNTIME_ADAPTER_GOVERNED_READ_ONLY_CAPABILITY_REFRESH_RUNTIME_ID,
    idPrefix: 'runtime-adapter-governed-read-only-capability-refresh',
  });
}
