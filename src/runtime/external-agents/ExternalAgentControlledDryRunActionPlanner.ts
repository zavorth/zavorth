import {
  GOVERNED_EXECUTOR_BOUNDARY,
} from '../agent/executors/GovernedExecutorAdapter.js';
import {
  normalizeZavorthExternalActionDispatchDesignFixture,
} from './ExternalAgentControlledActionDispatchDesign.js';

import type {
  ZavorthExternalActionControlLevel,
  ZavorthExternalActionDispatchPlan,
  ZavorthExternalActionIntent,
  ZavorthExternalActionKind,
  ZavorthExternalActionReceiptStatus,
} from './ExternalAgentControlledActionDispatchDesign.js';

export const EXTERNAL_AGENT_CONTROLLED_DRY_RUN_ACTION_PLANNER_NOW = '2026-04-28T22:30:00.000Z' as const;
export const EXTERNAL_AGENT_CONTROLLED_DRY_RUN_ACTION_PLANNER_RUNTIME_ID = 'external-agent-controlled-dry-run-action-planner' as const;

export type ZavorthExternalDryRunActionPlannerDecision =
  | 'blocked'
  | 'controlled-dry-run-action-planner-ready';

export type ZavorthExternalDryRunActionPlannerClassification =
  | 'approval-required'
  | 'blocked'
  | 'dry-run-allowed'
  | 'read-only-allowed'
  | 'unsupported';

export type ZavorthExternalDryRunActionPlannerReceiptStatus =
  | ZavorthExternalActionReceiptStatus
  | 'unsupported-degraded';

export type ZavorthExternalDryRunActionPlannerPolicy = {
  nativeContract: 'ZavorthExternalDryRunActionPlannerPolicy/v1';
  blockedTools: string[];
  approvalRequiredTools: string[];
  supportedActionKinds: ZavorthExternalActionKind[];
  sourceApprovalHintsGrantAuthority: false;
  sourceCapabilityGrantsAuthority: false;
};

export type ZavorthExternalDryRunActionPlannerPreflight = {
  nativeContract: 'ZavorthExternalActionPreflight/v1';
  id: string;
  intentId: string;
  actionKind: ZavorthExternalActionKind;
  classification: ZavorthExternalDryRunActionPlannerClassification;
  controlLevel: ZavorthExternalActionControlLevel;
  policyAuthority: 'zavorth-policy-preflight';
  approvalRequired: boolean;
  blocked: boolean;
  unsupported: boolean;
  degraded: boolean;
  dryRunAllowed: boolean;
  sourceApprovalHintAuthority: false;
  sourceCapabilityAuthority: false;
  externalAdapterInvoked: false;
  executionActuallyPerformed: false;
  rawSecretSerialized: false;
};

export type ZavorthExternalDryRunActionPlannerApprovalRequest = {
  nativeContract: 'ZavorthExternalActionApprovalRequest/v1';
  id: string;
  intentId: string;
  preflightId: string;
  actionKind: ZavorthExternalActionKind;
  approvalState:
    | 'not-requested-for-blocked'
    | 'not-requested-for-dry-run'
    | 'not-requested-unsupported'
    | 'pending-human-approval';
  sourceApprovalHintAuthority: false;
  externalAdapterInvoked: false;
  executionActuallyPerformed: false;
  rawSecretSerialized: false;
};

export type ZavorthExternalDryRunActionPlannerRow = {
  nativeContract: 'ZavorthExternalDryRunActionPlannerRow/v1';
  id: string;
  intentId: string;
  actionKind: ZavorthExternalActionKind;
  classification: ZavorthExternalDryRunActionPlannerClassification;
  dispatchPlanId: string;
  receiptId: string;
  unsupportedReasonId?: 'unsupported-capability-combination';
  rollbackOrCompensationPlanRequired: boolean;
  rollbackOrCompensationPlanMetadataOnly: true;
  sourceCapabilityInputOnly: true;
  sourceAuthorityGranted: false;
  externalAdapterInvoked: false;
  executionActuallyPerformed: false;
};

export type ZavorthExternalDryRunActionReceipt = {
  nativeContract: 'ZavorthExternalActionReceipt/v1';
  id: string;
  intentId: string;
  preflightId: string;
  dispatchPlanId: string;
  status: ZavorthExternalDryRunActionPlannerReceiptStatus;
  classification: ZavorthExternalDryRunActionPlannerClassification;
  auditAuthority: 'zavorth-audit-receipt';
  simulated: true;
  sideEffectFree: true;
  redacted: true;
  externalAdapterInvoked: false;
  executionActuallyPerformed: false;
  messageActuallySent: false;
  providerActuallyExecuted: false;
  commandActuallyExecuted: false;
  gatewayMutationActuallyCalled: false;
  sessionMutationActuallyPerformed: false;
  sourceAuthorityGranted: false;
  rawSecretSerialized: false;
};

export type ZavorthExternalDryRunActionPlannerExecutionGate = {
  executionActuallyPerformed: false;
  messageActuallySent: false;
  providerActuallyExecuted: false;
  commandActuallyExecuted: false;
  gatewayMutationActuallyCalled: false;
  sessionMutationActuallyPerformed: false;
  sourceAuthorityGranted: false;
  externalAdapterInvoked: false;
  sourceModuleCopied: false;
  nativeReplacementAuthorized: false;
  rawSecretSerialized: false;
};

export type ZavorthExternalDryRunActionPlannerNormalization = {
  nativeContract: 'ZavorthControlledDryRunActionPlanner/v1';
  generatedAt: string;
  runtimeId: string;
  decision: ZavorthExternalDryRunActionPlannerDecision;
  sourceDesignReady: boolean;
  plannerPolicy: ZavorthExternalDryRunActionPlannerPolicy;
  intents: ZavorthExternalActionIntent[];
  preflights: ZavorthExternalDryRunActionPlannerPreflight[];
  approvalRequests: ZavorthExternalDryRunActionPlannerApprovalRequest[];
  dispatchPlans: ZavorthExternalActionDispatchPlan[];
  receipts: ZavorthExternalDryRunActionReceipt[];
  plannerRows: ZavorthExternalDryRunActionPlannerRow[];
  classifications: {
    readOnlyAllowed: string[];
    dryRunAllowed: string[];
    approvalRequired: string[];
    blocked: string[];
    unsupported: string[];
  };
  executionGate: ZavorthExternalDryRunActionPlannerExecutionGate;
  redaction: {
    rawSecretSerialized: false;
    sourceIdentityPublic: false;
    sourceStructuresPublic: false;
    serializedOutputContainsSensitiveFixture: false;
  };
  nextGateRecommended: 'future-controlled-dispatch-dry-run-operator-review';
};

export type ZavorthExternalDryRunActionPlannerOptions<TRuntimeId extends string = string> = {
  generatedAt: string;
  idPrefix: string;
  runtimeId: TRuntimeId;
  sourceDesignReady: boolean;
  intents: ZavorthExternalActionIntent[];
  policy: ZavorthExternalDryRunActionPlannerPolicy;
  executionGate: ZavorthExternalDryRunActionPlannerExecutionGate;
};

function createPlannerPolicy(): ZavorthExternalDryRunActionPlannerPolicy {
  return {
    nativeContract: 'ZavorthExternalDryRunActionPlannerPolicy/v1',
    blockedTools: [
      'external.command.execute',
      'external.session.history.write',
    ],
    approvalRequiredTools: [
      'external.channel.message.send',
      'external.command.plan.approval',
      'external.provider.invoke',
    ],
    supportedActionKinds: [
      'command-tool-execution',
      'gateway-method-call',
      'message-send',
      'provider-execution',
      'session-history-mutation',
    ],
    sourceApprovalHintsGrantAuthority: false,
    sourceCapabilityGrantsAuthority: false,
  };
}

function supportedCapabilityCombination(intent: ZavorthExternalActionIntent): boolean {
  if (intent.actionKind === 'gateway-method-call') {
    return intent.capability.capabilityCategory === 'gateway-method-capabilities';
  }
  if (intent.actionKind === 'message-send') {
    return intent.capability.capabilityCategory === 'channel-capabilities';
  }
  if (intent.actionKind === 'command-tool-execution') {
    return intent.capability.capabilityCategory === 'command-http-capabilities';
  }
  if (intent.actionKind === 'provider-execution') {
    return intent.capability.capabilityCategory === 'provider-capabilities';
  }
  return intent.capability.capabilityCategory === 'session-history-capabilities';
}

function hasAnyTool(intent: ZavorthExternalActionIntent, tools: string[]): boolean {
  const toolSet = new Set(tools.map((tool) => tool.toLowerCase()));
  return intent.requestedTools.some((tool) => toolSet.has(tool.toLowerCase()));
}

function classifyIntent(
  intent: ZavorthExternalActionIntent,
  policy: ZavorthExternalDryRunActionPlannerPolicy,
): ZavorthExternalDryRunActionPlannerClassification {
  if (!policy.supportedActionKinds.includes(intent.actionKind) || !supportedCapabilityCombination(intent)) {
    return 'unsupported';
  }
  if (intent.requestedControlLevel === 'blocked' || intent.risk === 'danger' || hasAnyTool(intent, policy.blockedTools)) {
    return 'blocked';
  }
  if (
    intent.requestedMutation ||
    intent.requestedControlLevel === 'approval-required' ||
    hasAnyTool(intent, policy.approvalRequiredTools)
  ) {
    return 'approval-required';
  }
  if (intent.requestedControlLevel === 'dry-run') {
    return 'dry-run-allowed';
  }
  return 'read-only-allowed';
}

function controlLevelForClassification(
  classification: ZavorthExternalDryRunActionPlannerClassification,
): ZavorthExternalActionControlLevel {
  if (classification === 'approval-required') {
    return 'approval-required';
  }
  if (classification === 'blocked' || classification === 'unsupported') {
    return 'blocked';
  }
  if (classification === 'dry-run-allowed') {
    return 'dry-run';
  }
  return 'read-only';
}

function buildPreflight(
  idPrefix: string,
  intent: ZavorthExternalActionIntent,
  classification: ZavorthExternalDryRunActionPlannerClassification,
  index: number,
): ZavorthExternalDryRunActionPlannerPreflight {
  const dryRunAllowed = classification === 'dry-run-allowed' || classification === 'read-only-allowed';

  return {
    nativeContract: 'ZavorthExternalActionPreflight/v1',
    id: `${idPrefix}:preflight-${index + 1}`,
    intentId: intent.id,
    actionKind: intent.actionKind,
    classification,
    controlLevel: controlLevelForClassification(classification),
    policyAuthority: 'zavorth-policy-preflight',
    approvalRequired: classification === 'approval-required',
    blocked: classification === 'blocked',
    unsupported: classification === 'unsupported',
    degraded: classification === 'unsupported',
    dryRunAllowed,
    sourceApprovalHintAuthority: false,
    sourceCapabilityAuthority: false,
    externalAdapterInvoked: false,
    executionActuallyPerformed: false,
    rawSecretSerialized: false,
  };
}

function approvalState(
  classification: ZavorthExternalDryRunActionPlannerClassification,
): ZavorthExternalDryRunActionPlannerApprovalRequest['approvalState'] {
  if (classification === 'approval-required') {
    return 'pending-human-approval';
  }
  if (classification === 'unsupported') {
    return 'not-requested-unsupported';
  }
  if (classification === 'blocked') {
    return 'not-requested-for-blocked';
  }
  return 'not-requested-for-dry-run';
}

function buildApprovalRequest(
  idPrefix: string,
  preflight: ZavorthExternalDryRunActionPlannerPreflight,
  index: number,
): ZavorthExternalDryRunActionPlannerApprovalRequest {
  return {
    nativeContract: 'ZavorthExternalActionApprovalRequest/v1',
    id: `${idPrefix}:approval-${index + 1}`,
    intentId: preflight.intentId,
    preflightId: preflight.id,
    actionKind: preflight.actionKind,
    approvalState: approvalState(preflight.classification),
    sourceApprovalHintAuthority: false,
    externalAdapterInvoked: false,
    executionActuallyPerformed: false,
    rawSecretSerialized: false,
  };
}

function planState(
  classification: ZavorthExternalDryRunActionPlannerClassification,
): ZavorthExternalActionDispatchPlan['planState'] {
  if (classification === 'approval-required') {
    return 'approval-pending';
  }
  if (classification === 'blocked' || classification === 'unsupported') {
    return 'blocked';
  }
  return 'dry-run-only';
}

function rollbackRequired(intent: ZavorthExternalActionIntent): boolean {
  return intent.requestedMutation || intent.actionKind === 'session-history-mutation' || intent.actionKind === 'message-send';
}

function buildDispatchPlan(
  idPrefix: string,
  intent: ZavorthExternalActionIntent,
  preflight: ZavorthExternalDryRunActionPlannerPreflight,
  approval: ZavorthExternalDryRunActionPlannerApprovalRequest,
  index: number,
): ZavorthExternalActionDispatchPlan {
  const rollbackOrCompensationPlanRequired = rollbackRequired(intent);

  return {
    nativeContract: 'ZavorthExternalActionDispatchPlan/v1',
    id: `${idPrefix}:dispatch-plan-${index + 1}`,
    intentId: intent.id,
    preflightId: preflight.id,
    approvalRequestId: approval.id,
    actionKind: intent.actionKind,
    planState: planState(preflight.classification),
    controlLevel: preflight.controlLevel,
    futureExecutableLevel: 'executable-future',
    governedExecutorBoundary: GOVERNED_EXECUTOR_BOUNDARY,
    executorEntrypoint: GOVERNED_EXECUTOR_BOUNDARY.entrypoint,
    directExternalInvocationAllowed: false,
    rollbackOrCompensationPlanRequired,
    rollbackOrCompensationPlanPresent: rollbackOrCompensationPlanRequired,
    dispatchDeferredToFutureGate: true,
    executionActuallyPerformed: false,
    messageActuallySent: false,
    providerActuallyExecuted: false,
    commandActuallyExecuted: false,
    gatewayMutationActuallyCalled: false,
    sessionMutationActuallyPerformed: false,
    sourceAuthorityGranted: false,
    sourceModuleCopied: false,
    nativeReplacementAuthorized: false,
    rawSecretSerialized: false,
  };
}

function receiptStatus(
  classification: ZavorthExternalDryRunActionPlannerClassification,
): ZavorthExternalDryRunActionPlannerReceiptStatus {
  if (classification === 'approval-required') {
    return 'approval-requested';
  }
  if (classification === 'blocked') {
    return 'blocked-by-policy';
  }
  if (classification === 'unsupported') {
    return 'unsupported-degraded';
  }
  return 'simulated-dry-run';
}

function buildReceipt(
  idPrefix: string,
  preflight: ZavorthExternalDryRunActionPlannerPreflight,
  dispatchPlan: ZavorthExternalActionDispatchPlan,
  index: number,
): ZavorthExternalDryRunActionReceipt {
  return {
    nativeContract: 'ZavorthExternalActionReceipt/v1',
    id: `${idPrefix}:receipt-${index + 1}`,
    intentId: preflight.intentId,
    preflightId: preflight.id,
    dispatchPlanId: dispatchPlan.id,
    status: receiptStatus(preflight.classification),
    classification: preflight.classification,
    auditAuthority: 'zavorth-audit-receipt',
    simulated: true,
    sideEffectFree: true,
    redacted: true,
    externalAdapterInvoked: false,
    executionActuallyPerformed: false,
    messageActuallySent: false,
    providerActuallyExecuted: false,
    commandActuallyExecuted: false,
    gatewayMutationActuallyCalled: false,
    sessionMutationActuallyPerformed: false,
    sourceAuthorityGranted: false,
    rawSecretSerialized: false,
  };
}

function buildPlannerRow(
  idPrefix: string,
  intent: ZavorthExternalActionIntent,
  preflight: ZavorthExternalDryRunActionPlannerPreflight,
  dispatchPlan: ZavorthExternalActionDispatchPlan,
  receipt: ZavorthExternalDryRunActionReceipt,
  index: number,
): ZavorthExternalDryRunActionPlannerRow {
  return {
    nativeContract: 'ZavorthExternalDryRunActionPlannerRow/v1',
    id: `${idPrefix}:planner-row-${index + 1}`,
    intentId: intent.id,
    actionKind: intent.actionKind,
    classification: preflight.classification,
    dispatchPlanId: dispatchPlan.id,
    receiptId: receipt.id,
    ...(preflight.classification === 'unsupported'
      ? { unsupportedReasonId: 'unsupported-capability-combination' as const }
      : {}),
    rollbackOrCompensationPlanRequired: dispatchPlan.rollbackOrCompensationPlanRequired,
    rollbackOrCompensationPlanMetadataOnly: true,
    sourceCapabilityInputOnly: true,
    sourceAuthorityGranted: false,
    externalAdapterInvoked: false,
    executionActuallyPerformed: false,
  };
}

function classificationIds(
  rows: ZavorthExternalDryRunActionPlannerRow[],
  classification: ZavorthExternalDryRunActionPlannerClassification,
): string[] {
  return rows
    .filter((row) => row.classification === classification)
    .map((row) => row.intentId);
}

export function createZavorthExternalDryRunActionPlannerExecutionGate(): ZavorthExternalDryRunActionPlannerExecutionGate {
  return {
    executionActuallyPerformed: false,
    messageActuallySent: false,
    providerActuallyExecuted: false,
    commandActuallyExecuted: false,
    gatewayMutationActuallyCalled: false,
    sessionMutationActuallyPerformed: false,
    sourceAuthorityGranted: false,
    externalAdapterInvoked: false,
    sourceModuleCopied: false,
    nativeReplacementAuthorized: false,
    rawSecretSerialized: false,
  };
}

export function createZavorthExternalDryRunActionPlannerFixtureIntents(): ZavorthExternalActionIntent[] {
  const design = normalizeZavorthExternalActionDispatchDesignFixture();
  const gatewayIntent = design.intents.find((intent) => intent.actionKind === 'gateway-method-call');
  const commandIntent = design.intents.find((intent) => intent.actionKind === 'command-tool-execution');

  if (!gatewayIntent || !commandIntent) {
    throw new Error('Controlled action dispatch design fixture is missing required planner intents.');
  }

  const dryRunGatewayIntent: ZavorthExternalActionIntent = {
    ...gatewayIntent,
    id: 'external-agent-controlled-dry-run-action-planner:intent-dry-run-gateway',
    requestedControlLevel: 'dry-run',
    requestedTools: ['external.gateway.capability.plan'],
  };
  const commandApprovalIntent: ZavorthExternalActionIntent = {
    ...commandIntent,
    id: 'external-agent-controlled-dry-run-action-planner:intent-command-approval',
    requestedControlLevel: 'approval-required',
    risk: 'attention',
    requestedTools: ['external.command.plan.approval'],
  };
  const unsupportedIntent: ZavorthExternalActionIntent = {
    ...gatewayIntent,
    id: 'external-agent-controlled-dry-run-action-planner:intent-unsupported-worker-node',
    requestedControlLevel: 'dry-run',
    requestedMutation: false,
    requestedTools: ['external.worker.unsupported.plan'],
    capability: {
      ...gatewayIntent.capability,
      capabilityCategory: 'worker-node-capabilities',
      sourceCapabilityEvidenceAlias: 'source-capability-evidence:unsupported:worker-node-capabilities',
      sourceCapabilityAuthority: false,
      sourceIdentityPublic: false,
      sourceStructuresPublic: false,
    },
  };

  return [
    gatewayIntent,
    dryRunGatewayIntent,
    ...design.intents.filter((intent) => intent.actionKind !== 'gateway-method-call'),
    commandApprovalIntent,
    unsupportedIntent,
  ];
}

export function createZavorthExternalDryRunActionPlannerPolicy(): ZavorthExternalDryRunActionPlannerPolicy {
  return createPlannerPolicy();
}

export function planZavorthExternalDryRunActions<TRuntimeId extends string>(
  options: ZavorthExternalDryRunActionPlannerOptions<TRuntimeId>,
): ZavorthExternalDryRunActionPlannerNormalization {
  const preflights = options.intents.map((intent, index) => (
    buildPreflight(options.idPrefix, intent, classifyIntent(intent, options.policy), index)
  ));
  const approvalRequests = preflights.map((preflight, index) => (
    buildApprovalRequest(options.idPrefix, preflight, index)
  ));
  const dispatchPlans = options.intents.map((intent, index) => (
    buildDispatchPlan(options.idPrefix, intent, preflights[index], approvalRequests[index], index)
  ));
  const receipts = preflights.map((preflight, index) => (
    buildReceipt(options.idPrefix, preflight, dispatchPlans[index], index)
  ));
  const plannerRows = options.intents.map((intent, index) => (
    buildPlannerRow(options.idPrefix, intent, preflights[index], dispatchPlans[index], receipts[index], index)
  ));
  const noExecution =
    options.executionGate.executionActuallyPerformed === false &&
    options.executionGate.messageActuallySent === false &&
    options.executionGate.providerActuallyExecuted === false &&
    options.executionGate.commandActuallyExecuted === false &&
    options.executionGate.gatewayMutationActuallyCalled === false &&
    options.executionGate.sessionMutationActuallyPerformed === false &&
    options.executionGate.sourceAuthorityGranted === false &&
    options.executionGate.externalAdapterInvoked === false &&
    options.executionGate.sourceModuleCopied === false &&
    options.executionGate.nativeReplacementAuthorized === false &&
    options.executionGate.rawSecretSerialized === false;

  return {
    nativeContract: 'ZavorthControlledDryRunActionPlanner/v1',
    generatedAt: options.generatedAt,
    runtimeId: options.runtimeId,
    decision: options.sourceDesignReady && noExecution
      ? 'controlled-dry-run-action-planner-ready'
      : 'blocked',
    sourceDesignReady: options.sourceDesignReady,
    plannerPolicy: options.policy,
    intents: options.intents,
    preflights,
    approvalRequests,
    dispatchPlans,
    receipts,
    plannerRows,
    classifications: {
      readOnlyAllowed: classificationIds(plannerRows, 'read-only-allowed'),
      dryRunAllowed: classificationIds(plannerRows, 'dry-run-allowed'),
      approvalRequired: classificationIds(plannerRows, 'approval-required'),
      blocked: classificationIds(plannerRows, 'blocked'),
      unsupported: classificationIds(plannerRows, 'unsupported'),
    },
    executionGate: options.executionGate,
    redaction: {
      rawSecretSerialized: false,
      sourceIdentityPublic: false,
      sourceStructuresPublic: false,
      serializedOutputContainsSensitiveFixture: false,
    },
    nextGateRecommended: 'future-controlled-dispatch-dry-run-operator-review',
  };
}

export function planZavorthExternalDryRunActionsFixture(): ZavorthExternalDryRunActionPlannerNormalization {
  const design = normalizeZavorthExternalActionDispatchDesignFixture();

  return planZavorthExternalDryRunActions({
    sourceDesignReady: design.decision === 'controlled-action-dispatch-design-ready',
    intents: createZavorthExternalDryRunActionPlannerFixtureIntents(),
    policy: createZavorthExternalDryRunActionPlannerPolicy(),
    executionGate: createZavorthExternalDryRunActionPlannerExecutionGate(),
    generatedAt: EXTERNAL_AGENT_CONTROLLED_DRY_RUN_ACTION_PLANNER_NOW,
    runtimeId: EXTERNAL_AGENT_CONTROLLED_DRY_RUN_ACTION_PLANNER_RUNTIME_ID,
    idPrefix: 'external-agent-controlled-dry-run-action-planner',
  });
}
