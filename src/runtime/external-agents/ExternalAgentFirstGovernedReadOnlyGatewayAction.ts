import {
  GOVERNED_EXECUTOR_BOUNDARY,
} from '../agent/executors/GovernedExecutorAdapter.js';
import {
  planZavorthExternalDryRunActionsFixture,
} from './ExternalAgentControlledDryRunActionPlanner.js';

import type {
  GovernedExecutorBoundary,
} from '../agent/executors/GovernedExecutorAdapter.js';
import type {
  ZavorthExternalActionIntent,
} from './ExternalAgentControlledActionDispatchDesign.js';
import type {
  ZavorthExternalDryRunActionPlannerNormalization,
  ZavorthExternalDryRunActionPlannerPreflight,
} from './ExternalAgentControlledDryRunActionPlanner.js';

export const EXTERNAL_AGENT_FIRST_GOVERNED_READ_ONLY_GATEWAY_ACTION_NOW = '2026-04-28T23:00:00.000Z' as const;
export const EXTERNAL_AGENT_FIRST_GOVERNED_READ_ONLY_GATEWAY_ACTION_RUNTIME_ID = 'external-agent-first-governed-read-only-gateway-action' as const;

export type ZavorthFirstGovernedReadOnlyGatewayActionDecision =
  | 'blocked'
  | 'governed-read-only-gateway-action-degraded'
  | 'governed-read-only-gateway-action-ok';

export type ZavorthGovernedReadOnlyGatewayMethod =
  | 'gateway.health'
  | 'gateway.status';

export type ZavorthGovernedReadOnlyGatewayActionReceiptStatus =
  | 'real-read-only-degraded'
  | 'real-read-only-success';

export type ZavorthGovernedReadOnlyGatewayActionSource = {
  dryRunPlanner: ZavorthExternalDryRunActionPlannerNormalization;
  method: ZavorthGovernedReadOnlyGatewayMethod;
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
  call: {
    attempted: boolean;
    exitCode: number | null;
    timeout: boolean;
    stdoutPreviewRedacted: string;
    stderrPreviewRedacted: string;
    statusRpcOkObserved: boolean;
  };
  cleanup: {
    firstPassListenerCount: number;
    firstPassProcessCount: number;
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

export type ZavorthGovernedReadOnlyGatewayDispatchPlan = {
  nativeContract: 'ZavorthExternalActionDispatchPlan/v1';
  id: string;
  intentId: string;
  preflightId: string;
  method: ZavorthGovernedReadOnlyGatewayMethod;
  planState: 'governed-read-only-executable';
  governedExecutorBoundary: GovernedExecutorBoundary;
  executorEntrypoint: GovernedExecutorBoundary['entrypoint'];
  directExternalInvocationAllowed: false;
  sourceCapabilityInputOnly: true;
  sourceAuthorityGranted: false;
  readOnlyGatewayMethodOnly: true;
  mutableGatewayMethodAllowed: false;
  dispatchLimitedToZavorthGovernedPath: true;
  externalAdapterInvoked: false;
  messageActuallySent: false;
  providerActuallyExecuted: false;
  commandActuallyExecuted: false;
  toolActuallyExecuted: false;
  gatewayMutationActuallyCalled: false;
  sessionMutationActuallyPerformed: false;
  sourceModuleCopied: false;
  nativeReplacementAuthorized: false;
  rawSecretSerialized: false;
};

export type ZavorthGovernedReadOnlyGatewayActionReceipt = {
  nativeContract: 'ZavorthExternalActionReceipt/v1';
  id: string;
  intentId: string;
  preflightId: string;
  dispatchPlanId: string;
  method: ZavorthGovernedReadOnlyGatewayMethod;
  status: ZavorthGovernedReadOnlyGatewayActionReceiptStatus;
  auditAuthority: 'zavorth-audit-receipt';
  realReceipt: true;
  redacted: true;
  readOnly: true;
  readOnlyGatewayCallActuallyPerformed: boolean;
  externalGatewayStatusCalled: boolean;
  externalGatewayHealthCalled: boolean;
  exitCode: number | null;
  stdoutPreviewRedacted: string;
  stderrPreviewRedacted: string;
  timeout: boolean;
  degradedReason?: string;
  cleanupConfirmed: boolean;
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

export type ZavorthGovernedReadOnlyGatewayActionExecutionGate = {
  executionAuthority: 'zavorth-governed-read-only-gateway-action';
  readOnlyGatewayCallActuallyPerformed: boolean;
  externalGatewayStatusCalled: boolean;
  externalGatewayHealthCalled: boolean;
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

export type ZavorthFirstGovernedReadOnlyGatewayActionNormalization = {
  nativeContract: 'ZavorthFirstGovernedReadOnlyGatewayAction/v1';
  generatedAt: string;
  runtimeId: string;
  decision: ZavorthFirstGovernedReadOnlyGatewayActionDecision;
  method: ZavorthGovernedReadOnlyGatewayMethod;
  intent: ZavorthExternalActionIntent;
  policyPreflight: ZavorthExternalDryRunActionPlannerPreflight;
  dispatchPlan: ZavorthGovernedReadOnlyGatewayDispatchPlan;
  receipt: ZavorthGovernedReadOnlyGatewayActionReceipt;
  cleanup: ZavorthGovernedReadOnlyGatewayActionSource['cleanup'];
  executionGate: ZavorthGovernedReadOnlyGatewayActionExecutionGate;
  redaction: {
    rawSecretSerialized: false;
    commandArgTokenUsed: false;
    urlOverrideUsed: false;
    stdoutRedacted: true;
    stderrRedacted: true;
    serializedOutputContainsRawSecret: false;
  };
  nextGateRecommended: 'future-governed-read-only-gateway-health-or-operator-review';
};

export type ZavorthFirstGovernedReadOnlyGatewayActionOptions<TRuntimeId extends string = string> = {
  generatedAt: string;
  idPrefix: string;
  runtimeId: TRuntimeId;
  source: ZavorthGovernedReadOnlyGatewayActionSource;
};

function findReadOnlyGatewayIntent(
  planner: ZavorthExternalDryRunActionPlannerNormalization,
): ZavorthExternalActionIntent {
  const intentId = planner.classifications.readOnlyAllowed[0] || planner.classifications.dryRunAllowed[0];
  const intent = planner.intents.find((candidate) => candidate.id === intentId);

  if (!intent) {
    throw new Error('Missing read-only gateway intent for governed gateway action.');
  }

  return intent;
}

function findPreflight(
  planner: ZavorthExternalDryRunActionPlannerNormalization,
  intentId: string,
): ZavorthExternalDryRunActionPlannerPreflight {
  const preflight = planner.preflights.find((candidate) => candidate.intentId === intentId);

  if (!preflight) {
    throw new Error(`Missing policy preflight for governed gateway intent: ${intentId}`);
  }

  return preflight;
}

function determineDecision(
  source: ZavorthGovernedReadOnlyGatewayActionSource,
): ZavorthFirstGovernedReadOnlyGatewayActionDecision {
  if (
    source.dryRunPlanner.decision !== 'controlled-dry-run-action-planner-ready' ||
    !source.preflight.intentPassedPolicyPreflight ||
    !source.preflight.plannerGeneratedReadOnlyPlan ||
    source.forbiddenActions.rawSecretSerialized ||
    source.cleanup.finalListenerCount !== 0 ||
    source.cleanup.finalProcessCount !== 0
  ) {
    return 'blocked';
  }

  if (!source.call.attempted || source.call.exitCode !== 0 || source.call.timeout) {
    return 'governed-read-only-gateway-action-degraded';
  }

  return 'governed-read-only-gateway-action-ok';
}

function buildDispatchPlan(
  idPrefix: string,
  intent: ZavorthExternalActionIntent,
  preflight: ZavorthExternalDryRunActionPlannerPreflight,
  source: ZavorthGovernedReadOnlyGatewayActionSource,
): ZavorthGovernedReadOnlyGatewayDispatchPlan {
  return {
    nativeContract: 'ZavorthExternalActionDispatchPlan/v1',
    id: `${idPrefix}:dispatch-plan`,
    intentId: intent.id,
    preflightId: preflight.id,
    method: source.method,
    planState: 'governed-read-only-executable',
    governedExecutorBoundary: GOVERNED_EXECUTOR_BOUNDARY,
    executorEntrypoint: GOVERNED_EXECUTOR_BOUNDARY.entrypoint,
    directExternalInvocationAllowed: false,
    sourceCapabilityInputOnly: true,
    sourceAuthorityGranted: false,
    readOnlyGatewayMethodOnly: true,
    mutableGatewayMethodAllowed: false,
    dispatchLimitedToZavorthGovernedPath: true,
    externalAdapterInvoked: false,
    messageActuallySent: false,
    providerActuallyExecuted: false,
    commandActuallyExecuted: false,
    toolActuallyExecuted: false,
    gatewayMutationActuallyCalled: false,
    sessionMutationActuallyPerformed: false,
    sourceModuleCopied: false,
    nativeReplacementAuthorized: false,
    rawSecretSerialized: false,
  };
}

function buildReceipt(
  idPrefix: string,
  intent: ZavorthExternalActionIntent,
  preflight: ZavorthExternalDryRunActionPlannerPreflight,
  dispatchPlan: ZavorthGovernedReadOnlyGatewayDispatchPlan,
  source: ZavorthGovernedReadOnlyGatewayActionSource,
  decision: ZavorthFirstGovernedReadOnlyGatewayActionDecision,
): ZavorthGovernedReadOnlyGatewayActionReceipt {
  const cleanupConfirmed = source.cleanup.finalListenerCount === 0 && source.cleanup.finalProcessCount === 0;
  const success = decision === 'governed-read-only-gateway-action-ok';

  return {
    nativeContract: 'ZavorthExternalActionReceipt/v1',
    id: `${idPrefix}:receipt`,
    intentId: intent.id,
    preflightId: preflight.id,
    dispatchPlanId: dispatchPlan.id,
    method: source.method,
    status: success ? 'real-read-only-success' : 'real-read-only-degraded',
    auditAuthority: 'zavorth-audit-receipt',
    realReceipt: true,
    redacted: true,
    readOnly: true,
    readOnlyGatewayCallActuallyPerformed: source.call.attempted,
    externalGatewayStatusCalled: source.method === 'gateway.status' && source.call.attempted,
    externalGatewayHealthCalled: source.method === 'gateway.health' && source.call.attempted,
    exitCode: source.call.exitCode,
    stdoutPreviewRedacted: source.call.stdoutPreviewRedacted,
    stderrPreviewRedacted: source.call.stderrPreviewRedacted,
    timeout: source.call.timeout,
    ...(success ? {} : { degradedReason: source.call.timeout ? 'gateway-read-only-call-timeout' : 'gateway-read-only-call-degraded' }),
    cleanupConfirmed,
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
  source: ZavorthGovernedReadOnlyGatewayActionSource,
): ZavorthGovernedReadOnlyGatewayActionExecutionGate {
  return {
    executionAuthority: 'zavorth-governed-read-only-gateway-action',
    readOnlyGatewayCallActuallyPerformed: source.call.attempted,
    externalGatewayStatusCalled: source.method === 'gateway.status' && source.call.attempted,
    externalGatewayHealthCalled: source.method === 'gateway.health' && source.call.attempted,
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

export function createFirstGovernedReadOnlyGatewayActionFixtureSource(): ZavorthGovernedReadOnlyGatewayActionSource {
  return {
    dryRunPlanner: planZavorthExternalDryRunActionsFixture(),
    method: 'gateway.status',
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
      listenerObservedAtMs: 20500,
    },
    call: {
      attempted: true,
      exitCode: 0,
      timeout: false,
      statusRpcOkObserved: false,
      stdoutPreviewRedacted: 'gateway status returned JSON with service/config/gateway metadata; token and sensitive fields redacted',
      stderrPreviewRedacted: '',
    },
    cleanup: {
      firstPassListenerCount: 2,
      firstPassProcessCount: 1,
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

export function normalizeFirstGovernedReadOnlyGatewayAction<TRuntimeId extends string>(
  options: ZavorthFirstGovernedReadOnlyGatewayActionOptions<TRuntimeId>,
): ZavorthFirstGovernedReadOnlyGatewayActionNormalization {
  const intent = findReadOnlyGatewayIntent(options.source.dryRunPlanner);
  const policyPreflight = findPreflight(options.source.dryRunPlanner, intent.id);
  const dispatchPlan = buildDispatchPlan(options.idPrefix, intent, policyPreflight, options.source);
  const decision = determineDecision(options.source);
  const receipt = buildReceipt(options.idPrefix, intent, policyPreflight, dispatchPlan, options.source, decision);

  return {
    nativeContract: 'ZavorthFirstGovernedReadOnlyGatewayAction/v1',
    generatedAt: options.generatedAt,
    runtimeId: options.runtimeId,
    decision,
    method: options.source.method,
    intent,
    policyPreflight,
    dispatchPlan,
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
    nextGateRecommended: 'future-governed-read-only-gateway-health-or-operator-review',
  };
}

export function normalizeFirstGovernedReadOnlyGatewayActionFixture(): ZavorthFirstGovernedReadOnlyGatewayActionNormalization {
  return normalizeFirstGovernedReadOnlyGatewayAction({
    source: createFirstGovernedReadOnlyGatewayActionFixtureSource(),
    generatedAt: EXTERNAL_AGENT_FIRST_GOVERNED_READ_ONLY_GATEWAY_ACTION_NOW,
    runtimeId: EXTERNAL_AGENT_FIRST_GOVERNED_READ_ONLY_GATEWAY_ACTION_RUNTIME_ID,
    idPrefix: 'external-agent-first-governed-read-only-gateway-action',
  });
}
