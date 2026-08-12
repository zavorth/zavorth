import {
  UniversalIntentService,
} from '../uni/UniversalIntentService.js';
import type {
  ConversationalPermissionRequest,
  NaturalClarificationPolicy,
  PermissionNarrative,
  TrustPostureSnapshot,
  TrustSliderPolicyDecision,
  UniversalIntentCategory,
  UniversalIntentDecision,
  UniversalIntentInput,
  UniversalIntentRiskHints,
  UniversalIntentRiskLevel,
  UniversalIntentSideEffect,
  UniversalIntentTrustMode,
  UniversalIntentUserRole,
} from '../uni/UniversalIntentContracts.js';
import type {
  UniversalAgentChannel,
  UniversalAgentRequest,
  UniversalAgentRun,
} from './UniversalAgentRuntimeTypes.js';

export const UNIVERSAL_INTENT_TRUST_ENFORCEMENT_CONTRACT_VERSION = '2026-05-04.trust-enforcement' as const;

export type UniversalIntentTrustEnforcementStatus =
  | 'allow'
  | 'requires-clarification'
  | 'requires-permission'
  | 'blocked';

export type UniversalIntentTrustGateStatus = 'passed' | 'requires-action' | 'blocked';

export type UniversalIntentTrustGate = {
  id: string;
  label: string;
  status: UniversalIntentTrustGateStatus;
  source:
    | 'UniversalIntentService'
    | 'TrustSliderPolicyService'
    | 'ConversationalPermissionService'
    | 'NaturalClarificationPolicyService'
    | 'AgentRunService';
  detail: string;
};

export type UniversalIntentTrustReceipt = {
  id: string;
  kind:
    | 'universal-intent'
    | 'trust-slider'
    | 'trust-posture'
    | 'permission'
    | 'clarification'
    | 'preview'
    | 'approval'
    | 'policy'
    | 'surface';
  source: string;
  detail: string;
  status: 'ready' | 'requires-action' | 'blocked';
};

export type UniversalIntentTrustDecisionSummary = {
  schemaVersion: UniversalIntentDecision['schemaVersion'];
  generatedAt: string;
  intent: UniversalIntentCategory;
  risk: UniversalIntentRiskLevel;
  sideEffect: UniversalIntentSideEffect;
  confidence: number;
  capabilityRequired: string[];
  nextSafeAction: UniversalIntentDecision['nextSafeAction'];
  matchedSignals: string[];
  diagnosticsSource: 'UniversalIntentService';
};

export type UniversalIntentTrustPermissionSummary = {
  required: boolean;
  requestId: string | null;
  kind: ConversationalPermissionRequest['kind'] | 'none';
  scope: ConversationalPermissionRequest['scope'] | 'none';
  prompt: string | null;
  reason: string | null;
  previewRequired: boolean;
  approvalRequired: boolean;
  sideEffect: UniversalIntentSideEffect;
  scopeBoundary: {
    sessionId: string | null;
    workspaceRoot: string | null;
    targetPath: string | null;
    hostAllowed: boolean;
  };
  narrative: PermissionNarrative;
};

export type UniversalIntentTrustClarificationSummary = NaturalClarificationPolicy & {
  required: boolean;
};

export type UniversalIntentTrustEnforcementSnapshot = {
  contractVersion: typeof UNIVERSAL_INTENT_TRUST_ENFORCEMENT_CONTRACT_VERSION;
  source: 'UniversalIntentTrustEnforcementService';
  generatedAt: string;
  identifiers: {
    runId: string;
    traceId: string;
    requestId: string;
    sessionId: string;
  };
  status: UniversalIntentTrustEnforcementStatus;
  summary: {
    intent: UniversalIntentCategory;
    risk: UniversalIntentRiskLevel;
    trustLevel: UniversalIntentTrustMode;
    trustDecision: TrustSliderPolicyDecision['decision'];
    posture: TrustPostureSnapshot['posture'];
    requestedToolCount: number;
    capabilityCount: number;
    matchedSignalCount: number;
    requiresClarification: boolean;
    requiresPermission: boolean;
    previewRequired: boolean;
    approvalRequired: boolean;
    blocked: boolean;
    hostAllowed: boolean;
    workspaceRootPresent: boolean;
  };
  universalIntent: UniversalIntentTrustDecisionSummary;
  trustSlider: TrustSliderPolicyDecision;
  trustPosture: TrustPostureSnapshot;
  permission: UniversalIntentTrustPermissionSummary;
  clarification: UniversalIntentTrustClarificationSummary;
  gates: UniversalIntentTrustGate[];
  receipts: UniversalIntentTrustReceipt[];
  policy: {
    universalIntentIsSourceOfTruth: true;
    trustSliderEnforcedBeforeExecutor: true;
    naturalLanguageDoesNotBypassPolicy: true;
    permissionNarrativeRequired: true;
    previewBeforeMutation: boolean;
    approvalRequiredForPermission: boolean;
    hostScopeRequiresOverlord: true;
    workspaceBoundaryEnforced: true;
    noToolExecutedBySnapshot: true;
    secretsSerialized: false;
  };
  surface: {
    cliCommand: string;
    zavorthControlPath: string;
    trustHint: string;
    permissionHint: string;
  };
  nextSafeAction: string;
};

export type UniversalIntentTrustEnforcementInput = {
  run: UniversalAgentRun;
  request?: UniversalAgentRequest | null;
  generatedAt?: string | null;
};

type LooseRecord = Record<string, unknown>;

function normalizeText(value: unknown, fallback = ''): string {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function normalizeSearchText(value: unknown): string {
  return normalizeText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function recordOrNull(value: unknown): LooseRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as LooseRecord
    : null;
}

function listStrings(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return Array.from(new Set(value.map((entry) => normalizeText(entry)).filter(Boolean)));
}

function booleanFlag(...values: unknown[]): boolean {
  return values.some((value) => value === true || value === 'true' || value === 1 || value === '1');
}

function normalizeTrustMode(value: unknown): UniversalIntentTrustMode | null {
  const normalized = normalizeText(value).toLowerCase();
  if (normalized === 'protected' || normalized === 'collaborator' || normalized === 'overlord') {
    return normalized;
  }
  return null;
}

function redactText(value: unknown, fallback = 'request', maxLength = 90): string {
  const text = normalizeText(value, fallback)
    .replace(/((?:api[_-]?key|token|secret|password)\s*[:=]\s*)\S+/gi, '$1[redacted]')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > maxLength ? `${text.slice(0, maxLength - 3)}...` : text;
}

export class UniversalIntentTrustEnforcementService {
  private readonly now: () => Date;
  private readonly universalIntent: UniversalIntentService;

  constructor(runtime: {
    now?: () => Date;
    universalIntent?: UniversalIntentService | null;
  } = {}) {
    this.now = runtime.now || (() => new Date());
    this.universalIntent = runtime.universalIntent || new UniversalIntentService({
      now: this.now,
    });
  }

  public buildSnapshot(input: UniversalIntentTrustEnforcementInput): UniversalIntentTrustEnforcementSnapshot {
    const { run } = input;
    const generatedAt = normalizeText(input.generatedAt, this.now().toISOString());
    const intentInput = this.toUniversalIntentInput(input);
    const decision = this.universalIntent.decide(intentInput);
    const status = this.resolveStatus(decision);
    const permission = this.summarizePermission(decision);
    const clarification = this.summarizeClarification(decision);
    const gates = this.buildGates(decision);
    const receipts = this.buildReceipts(decision, gates);

    return {
      contractVersion: UNIVERSAL_INTENT_TRUST_ENFORCEMENT_CONTRACT_VERSION,
      source: 'UniversalIntentTrustEnforcementService',
      generatedAt,
      identifiers: {
        runId: run.id,
        traceId: run.traceId,
        requestId: run.requestId,
        sessionId: run.sessionId,
      },
      status,
      summary: {
        intent: decision.intent,
        risk: decision.risk,
        trustLevel: decision.trustSlider.level,
        trustDecision: decision.trustSlider.decision,
        posture: decision.trustPosture.posture,
        requestedToolCount: intentInput.requestedTools?.length || 0,
        capabilityCount: decision.capabilityRequired.length,
        matchedSignalCount: decision.diagnostics.matchedSignals.length,
        requiresClarification: decision.requiresClarification,
        requiresPermission: decision.requiresPermission || decision.trustSlider.decision === 'requires_permission',
        previewRequired: decision.trustSlider.previewRequired || Boolean(decision.permissionRequest?.previewRequired),
        approvalRequired: decision.trustSlider.approvalRequired || Boolean(decision.permissionRequest?.approvalRequired),
        blocked: decision.trustPosture.blocked || decision.trustSlider.blocked,
        hostAllowed: decision.trustSlider.hostAllowed,
        workspaceRootPresent: Boolean(decision.trustSlider.workspaceRoot),
      },
      universalIntent: {
        schemaVersion: decision.schemaVersion,
        generatedAt: decision.generatedAt,
        intent: decision.intent,
        risk: decision.risk,
        sideEffect: decision.safety.sideEffect,
        confidence: decision.confidence,
        capabilityRequired: decision.capabilityRequired,
        nextSafeAction: decision.nextSafeAction,
        matchedSignals: decision.diagnostics.matchedSignals,
        diagnosticsSource: decision.diagnostics.source,
      },
      trustSlider: decision.trustSlider,
      trustPosture: decision.trustPosture,
      permission,
      clarification,
      gates,
      receipts,
      policy: {
        universalIntentIsSourceOfTruth: true,
        trustSliderEnforcedBeforeExecutor: true,
        naturalLanguageDoesNotBypassPolicy: true,
        permissionNarrativeRequired: true,
        previewBeforeMutation: permission.previewRequired || decision.trustSlider.previewRequired,
        approvalRequiredForPermission: permission.approvalRequired || decision.trustSlider.approvalRequired,
        hostScopeRequiresOverlord: true,
        workspaceBoundaryEnforced: true,
        noToolExecutedBySnapshot: true,
        secretsSerialized: false,
      },
      surface: {
        cliCommand: `zavorth uni "${redactText(intentInput.text)}"`,
        zavorthControlPath: '/zavorthControl...sector=config',
        trustHint: `${decision.trustSlider.level} -> ${decision.trustSlider.decision}`,
        permissionHint: permission.required
          ? permission.prompt || 'Permission conversacional obrigatoria.'
          : 'No mandatory conversational permission.',
      },
      nextSafeAction: this.resolveNextSafeAction(status, decision, permission, clarification),
    };
  }

  private toUniversalIntentInput(input: UniversalIntentTrustEnforcementInput): UniversalIntentInput {
    const { run, request } = input;
    const metadata = {
      ...(run.metadata || {}),
      ...(request?.metadata || {}),
    };
    const trustSlider = recordOrNull(metadata.trustSlider) || recordOrNull(metadata.trust);
    const universalIntent = recordOrNull(metadata.universalIntent);
    const riskHints = recordOrNull(metadata.riskHints);
    const passiveLinkConversation = this.isPassiveLinkConversation(run, request, metadata);
    const requestedTools = Array.from(new Set([
      ...(request?.requestedTools || []),
      ...listStrings(metadata.requestedTools),
      ...(passiveLinkConversation ? [] : listStrings(universalIntent?.capabilityRequired)),
      ...(passiveLinkConversation ? [] : run.toolExposure.tools.map((tool) => tool.id)),
    ]));
    const userRole = this.resolveUserRole(request, run, metadata, trustSlider);
    const workspaceRoot = normalizeText(
      trustSlider?.workspaceRoot
      || metadata.workspaceRoot
      || metadata.workspacePath
      || request?.workspace
      || run.workspace,
    );
    const targetPath = normalizeText(
      trustSlider?.targetPath
      || metadata.targetPath
      || metadata.filePath,
    );

    return {
      surface: this.resolveSurface(request?.channel || run.channel),
      text: passiveLinkConversation
        ? this.stripUrls(normalizeText(request?.text, run.input))
        : normalizeText(request?.text, run.input),
      requestedTools,
      capabilityIds: listStrings(metadata.capabilityIds),
      userRole,
      trustMode: normalizeTrustMode(
        trustSlider?.level
        || metadata.trustMode
        || metadata.trustSliderLevel
        || universalIntent?.trustMode,
      ),
      previousTrustMode: normalizeTrustMode(
        trustSlider?.previousLevel
        || trustSlider?.fromLevel
        || metadata.previousTrustMode
        || metadata.previousTrustSliderLevel,
      ),
      ownerConfirmed: booleanFlag(
        trustSlider?.ownerConfirmed,
        metadata.ownerConfirmed,
        metadata.operatorConfirmed,
      ),
      killSwitchActive: booleanFlag(
        trustSlider?.killSwitchActive,
        metadata.killSwitchActive,
        metadata.overlordKillSwitchActive,
      ),
      contextHints: {
        activeTargetId: normalizeText(metadata.activeTargetId) || null,
        activeArtifactId: normalizeText(metadata.activeArtifactId) || null,
        previousRunId: normalizeText(metadata.previousRunId) || null,
        sessionId: request?.sessionId || run.sessionId,
        workspacePath: normalizeText(request?.workspace, run.workspace || workspaceRoot) || null,
        workspaceRoot: workspaceRoot || null,
        targetPath: targetPath || null,
        hostScopeRequested: booleanFlag(
          trustSlider?.hostScopeRequested,
          metadata.hostScopeRequested,
          metadata.hostAllowed,
        ),
        sensitiveDomain: booleanFlag(metadata.sensitiveDomain, riskHints?.sensitiveDomain),
      },
      riskHints: this.resolveRiskHints(metadata, riskHints),
    };
  }

  private isPassiveLinkConversation(
    run: UniversalAgentRun,
    request: UniversalAgentRequest | null | undefined,
    metadata: Record<string, unknown>,
  ): boolean {
    const text = normalizeText(request?.text, run.input);
    if (!/https?:\/\/|www\./i.test(text)) {
      return false;
    }
    if ((request?.requestedTools || []).length > 0) {
      return false;
    }
    const route = recordOrNull(metadata.naturalFirstRoute);
    const responseDecision = recordOrNull(metadata.responseDecision);
    const responseTools = listStrings(responseDecision?.requestedTools);
    if (responseTools.length > 0) {
      return false;
    }
    const isConversationRoute = normalizeText(route?.route) === 'llm-reply'
      || normalizeText(responseDecision?.responsePath) === 'fast-chat';
    if (!isConversationRoute) {
      return false;
    }
    return normalizeSearchText(text).length > 0;
  }

  private stripUrls(text: string): string {
    return text.replace(/https?:\/\/\S+|www\.\S+/gi, '[link compartilhado]').trim();
  }

  private resolveSurface(channel: UniversalAgentChannel): UniversalIntentInput['surface'] {
    return channel || 'unknown';
  }

  private resolveUserRole(
    request: UniversalAgentRequest | null | undefined,
    run: UniversalAgentRun,
    metadata: LooseRecord,
    trustSlider: LooseRecord | null,
  ): UniversalIntentUserRole {
    const explicit = normalizeText(
      trustSlider?.userRole
      || metadata.userRole
      || metadata.operatorRole,
    );
    if (explicit) {
      return explicit;
    }
    const userId = normalizeText(request?.userId, run.userId).toLowerCase();
    return userId === 'operator' ? 'operator' : 'common';
  }

  private resolveRiskHints(metadata: LooseRecord, riskHints: LooseRecord | null): UniversalIntentRiskHints {
    return {
      mutation: booleanFlag(metadata.mutation, riskHints?.mutation),
      externalSideEffect: booleanFlag(metadata.externalSideEffect, riskHints?.externalSideEffect),
      destructive: booleanFlag(metadata.destructive, riskHints?.destructive),
      shell: booleanFlag(metadata.shell, riskHints?.shell),
      network: booleanFlag(metadata.network, riskHints?.network),
      approvalRequired: booleanFlag(metadata.approvalRequired, riskHints?.approvalRequired),
      operatorRequired: booleanFlag(metadata.operatorRequired, riskHints?.operatorRequired),
    };
  }

  private resolveStatus(decision: UniversalIntentDecision): UniversalIntentTrustEnforcementStatus {
    if (decision.trustPosture.blocked || decision.trustSlider.blocked || decision.nextSafeAction === 'block') {
      return 'blocked';
    }
    if (decision.requiresClarification) {
      return 'requires-clarification';
    }
    if (decision.requiresPermission || decision.trustSlider.decision === 'requires_permission') {
      return 'requires-permission';
    }
    return 'allow';
  }

  private summarizePermission(decision: UniversalIntentDecision): UniversalIntentTrustPermissionSummary {
    const request = decision.permissionRequest;
    const boundary = request?.scopeBoundary;
    return {
      required: Boolean(request),
      requestId: request?.id || null,
      kind: request?.kind || 'none',
      scope: request?.scope || 'none',
      prompt: request?.prompt || null,
      reason: request?.reason || null,
      previewRequired: Boolean(request?.previewRequired || decision.trustSlider.previewRequired),
      approvalRequired: Boolean(request?.approvalRequired || decision.trustSlider.approvalRequired),
      sideEffect: request?.sideEffect || decision.safety.sideEffect,
      scopeBoundary: {
        sessionId: boundary?.sessionId || null,
        workspaceRoot: boundary?.workspaceRoot || decision.trustSlider.workspaceRoot || null,
        targetPath: boundary?.targetPath || decision.trustSlider.targetPath || null,
        hostAllowed: Boolean(boundary?.hostAllowed),
      },
      narrative: decision.permissionNarrative,
    };
  }

  private summarizeClarification(decision: UniversalIntentDecision): UniversalIntentTrustClarificationSummary {
    return {
      ...decision.clarification,
      required: decision.requiresClarification,
    };
  }

  private buildGates(decision: UniversalIntentDecision): UniversalIntentTrustGate[] {
    return [
      {
        id: 'universal-intent:classification',
        label: 'Universal Intent',
        status: 'passed',
        source: 'UniversalIntentService',
        detail: `${decision.intent} / ${decision.risk} / ${decision.safety.sideEffect}`,
      },
      {
        id: 'universal-intent:clarification',
        label: 'Ask Before Assumption',
        status: decision.requiresClarification ? 'requires-action' : 'passed',
        source: 'NaturalClarificationPolicyService',
        detail: decision.clarification.reason || 'No required question.',
      },
      {
        id: 'universal-intent:permission',
        label: 'Conversational Permission',
        status: decision.requiresPermission ? 'requires-action' : 'passed',
        source: 'ConversationalPermissionService',
        detail: decision.permissionRequest?.reason || 'Conversational permission is not mandatory.',
      },
      {
        id: 'universal-intent:trust-slider',
        label: 'Trust Slider',
        status: decision.trustSlider.blocked ? 'blocked'
          : decision.trustSlider.decision === 'requires_permission'
            ? 'requires-action'
            : 'passed',
        source: 'TrustSliderPolicyService',
        detail: decision.trustSlider.blockReason || decision.trustSlider.reason,
      },
      {
        id: 'universal-intent:executor-boundary',
        label: 'Executor Boundary',
        status: decision.trustPosture.blocked ? 'blocked' : 'passed',
        source: 'AgentRunService',
        detail: decision.trustPosture.reason,
      },
    ];
  }

  private buildReceipts(
    decision: UniversalIntentDecision,
    gates: UniversalIntentTrustGate[],
  ): UniversalIntentTrustReceipt[] {
    return [
      {
        id: 'uni:receipt:intent',
        kind: 'universal-intent',
        source: 'UniversalIntentService',
        detail: `Intent ${decision.intent} classificado com risk ${decision.risk}.`,
        status: 'ready',
      },
      {
        id: 'uni:receipt:trust-slider',
        kind: 'trust-slider',
        source: 'TrustSliderPolicyService',
        detail: `${decision.trustSlider.level} decidiu ${decision.trustSlider.decision}.`,
        status: decision.trustSlider.blocked ? 'blocked'
          : decision.trustSlider.decision === 'requires_permission'
            ? 'requires-action'
            : 'ready',
      },
      {
        id: 'uni:receipt:posture',
        kind: 'trust-posture',
        source: 'TrustPostureService',
        detail: decision.trustPosture.reason,
        status: decision.trustPosture.blocked ? 'blocked' : 'ready',
      },
      {
        id: 'uni:receipt:permission',
        kind: 'permission',
        source: 'ConversationalPermissionService',
        detail: decision.permissionRequest?.prompt || 'No conversational permission pending.',
        status: decision.permissionRequest ? 'requires-action' : 'ready',
      },
      {
        id: 'uni:receipt:clarification',
        kind: 'clarification',
        source: 'NaturalClarificationPolicyService',
        detail: decision.clarification.question || 'without esclarecimento required.',
        status: decision.requiresClarification ? 'requires-action' : 'ready',
      },
      {
        id: 'uni:receipt:policy',
        kind: 'policy',
        source: 'UniversalIntentTrustEnforcementService',
        detail: `${gates.filter((gate) => gate.status !== 'passed').length} gate(s) require action before free execution.`,
        status: gates.some((gate) => gate.status === 'blocked') ? 'blocked'
          : gates.some((gate) => gate.status === 'requires-action') ? 'requires-action'
            : 'ready',
      },
    ];
  }

  private resolveNextSafeAction(
    status: UniversalIntentTrustEnforcementStatus,
    decision: UniversalIntentDecision,
    permission: UniversalIntentTrustPermissionSummary,
    clarification: UniversalIntentTrustClarificationSummary,
  ): string {
    if (status === 'blocked') {
      return decision.trustPosture.blockReason || decision.trustSlider.blockReason || 'Block before any executor.';
    }
    if (status === 'requires-clarification') {
      return clarification.question || 'Ask before assuming target, scope, or permission.';
    }
    if (status === 'requires-permission') {
      return permission.prompt || 'Prepare preview and request conversational permission.';
    }
    return 'Continue through the governed executor with Trust Slider recorded.';
  }
}
