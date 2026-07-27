import type {
  UniversalAgentRequest,
  UniversalAgentRun,
  UniversalAgentRunResult,
  UniversalApprovalRequest,
  UniversalToolRiskLevel,
} from './UniversalAgentRuntimeTypes.js';
import { buildWaitingApprovalCard } from './UniversalApprovalPickerPresentation.js';

export const NATURAL_FIRST_APPROVAL_SAFETY_CONTRACT_VERSION = 'natural-first-approval-safety/7' as const;

export type NaturalFirstApprovalSafetyStatus =
  | 'execution-allowed'
  | 'preview-required'
  | 'approval-required'
  | 'approval-satisfied';

export type NaturalFirstApprovalSafetySnapshot = {
  contractVersion: typeof NATURAL_FIRST_APPROVAL_SAFETY_CONTRACT_VERSION;
  source: 'NaturalFirstApprovalSafetyService';
  stage: 7;
  phase: 7;
  generatedAt: string;
  route: string;
  status: NaturalFirstApprovalSafetyStatus;
  summary: string;
  risk: {
    level: UniversalToolRiskLevel;
    routeRequiresApproval: boolean;
    toolRequiresApproval: boolean;
    discoveryRequiresApproval: boolean;
    previewRequired: boolean;
    reasons: string[];
  };
  toolExposure: {
    mode: string;
    exposedToolIds: string[];
    riskyToolIds: string[];
    approvalRequiredToolIds: string[];
  };
  approvals: {
    pendingIds: string[];
    approvedIds: string[];
    createdApprovalId: string | null;
  };
  enforcement: {
    executorBlockedUntilApproval: boolean;
    naturalLanguageDoesNotBypassPolicy: true;
    noToolExecutionBeforeApproval: true;
    noApprovalBypass: true;
    existingApprovalHonored: boolean;
  };
  nextSafeAction: string;
};

export type NaturalFirstApprovalSafetyInput = {
  run: UniversalAgentRun;
  request: UniversalAgentRequest;
  generatedAt: string;
  createdApprovalId?: string | null;
};

export type NaturalFirstApprovalSafetyFallbackInput = NaturalFirstApprovalSafetyInput & {
  idFactory: (prefix: string) => string;
};

function normalizeText(value: unknown, fallback = ''): string {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function recordOrNull(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function listStrings(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return Array.from(new Set(value.map((entry) => normalizeText(entry)).filter(Boolean)));
}

function normalizeRisk(value: unknown): UniversalToolRiskLevel {
  const normalized = normalizeText(value).toLowerCase();
  if (normalized === 'safe' || normalized === 'attention' || normalized === 'danger' || normalized === 'unknown') {
    return normalized;
  }
  return 'safe';
}

function riskScore(risk: UniversalToolRiskLevel): number {
  if (risk === 'danger') {
    return 3;
  }
  if (risk === 'attention') {
    return 2;
  }
  if (risk === 'unknown') {
    return 1;
  }
  return 0;
}

function maxRisk(risks: UniversalToolRiskLevel[]): UniversalToolRiskLevel {
  const score = Math.max(0, ...risks.map(riskScore));
  if (score >= 3) {
    return 'danger';
  }
  if (score === 2) {
    return 'attention';
  }
  if (score === 1) {
    return 'unknown';
  }
  return 'safe';
}

function riskForApproval(risk: UniversalToolRiskLevel): UniversalToolRiskLevel {
  return risk === 'safe' ? 'attention' : risk;
}

function isApprovalRequiredRoute(route: string, routeRequiresApproval: boolean): boolean {
  return route === 'approval-proposal' || routeRequiresApproval;
}

export class NaturalFirstApprovalSafetyService {
  public buildSnapshot(input: NaturalFirstApprovalSafetyInput): NaturalFirstApprovalSafetySnapshot {
    const { run } = input;
    const naturalFirstRoute = recordOrNull(run.metadata.naturalFirstRoute);
    const routeRisk = recordOrNull(naturalFirstRoute?.risk);
    const discovery = recordOrNull(run.metadata.naturalCapabilityDiscovery);
    const discoverySafety = recordOrNull(discovery?.safety);
    const route = normalizeText(naturalFirstRoute?.route, 'unknown');
    const exposedToolIds = run.toolExposure.tools.map((tool) => tool.id);
    const approvalRequiredToolIds = run.toolExposure.tools
      .filter((tool) => tool.requiresApproval)
      .map((tool) => tool.id);
    const riskyToolIds = run.toolExposure.tools
      .filter(
        (tool) =>
          tool.requiresApproval || tool.risk === 'danger' || tool.risk === 'attention' || tool.risk === 'unknown',
      )
      .map((tool) => tool.id);
    const discoveryApprovalRequired = discoverySafety?.requiresApproval === true;
    const discoveryPreviewRequired = discoverySafety?.previewRequired === true;
    const routeRequiresApproval =
      routeRisk?.requiresApproval === true ||
      naturalFirstRoute?.requiresApproval === true ||
      isApprovalRequiredRoute(route, false);
    const toolRequiresApproval =
      approvalRequiredToolIds.length > 0 || run.toolExposure.tools.some((tool) => tool.risk === 'danger');
    const previewRequired = route === 'tool-preview' || routeRisk?.previewRequired === true || discoveryPreviewRequired;
    const approvalRequired =
      routeRequiresApproval || toolRequiresApproval || discoveryApprovalRequired || routeRisk?.level === 'danger';
    const approvedIds = run.approvals
      .filter((approval) => approval.status === 'approved')
      .map((approval) => approval.id);
    const pendingIds = run.approvals.filter((approval) => approval.status === 'pending').map((approval) => approval.id);
    const riskLevel = maxRisk([
      normalizeRisk(routeRisk?.level),
      normalizeRisk(discoverySafety?.highestRisk),
      ...run.toolExposure.tools.map((tool) => normalizeRisk(tool.risk)),
      approvalRequired ? 'attention' : 'safe',
    ]);
    const reasons = [
      ...(routeRequiresApproval ? [`route:${route}`] : []),
      ...(toolRequiresApproval ? [`tool-approval:${approvalRequiredToolIds.join(',') || 'danger-risk'}`] : []),
      ...(discoveryApprovalRequired ? ['natural-capability-discovery'] : []),
      ...(previewRequired ? ['preview-required'] : []),
      ...listStrings(routeRisk?.reasons),
    ];
    const status: NaturalFirstApprovalSafetyStatus =
      approvedIds.length > 0
        ? 'approval-satisfied'
        : approvalRequired ? 'approval-required'
          : previewRequired ? 'preview-required'
            : 'execution-allowed';
    const executorBlockedUntilApproval = status === 'approval-required' && approvedIds.length === 0;

    return {
      contractVersion: NATURAL_FIRST_APPROVAL_SAFETY_CONTRACT_VERSION,
      source: 'NaturalFirstApprovalSafetyService',
      stage: 7,
      phase: 7,
      generatedAt: input.generatedAt,
      route,
      status,
      summary: this.buildSummary(status, route),
      risk: {
        level: riskLevel,
        routeRequiresApproval,
        toolRequiresApproval,
        discoveryRequiresApproval: discoveryApprovalRequired,
        previewRequired,
        reasons: reasons.length > 0 ? Array.from(new Set(reasons)) : ['no-sensitive-risk-detected'],
      },
      toolExposure: {
        mode: run.toolExposure.mode,
        exposedToolIds,
        riskyToolIds,
        approvalRequiredToolIds,
      },
      approvals: {
        pendingIds,
        approvedIds,
        createdApprovalId: input.createdApprovalId || null,
      },
      enforcement: {
        executorBlockedUntilApproval,
        naturalLanguageDoesNotBypassPolicy: true,
        noToolExecutionBeforeApproval: true,
        noApprovalBypass: true,
        existingApprovalHonored: pendingIds.length > 0 || approvedIds.length > 0,
      },
      nextSafeAction: this.buildNextSafeAction(status, exposedToolIds.length),
    };
  }

  public shouldRecord(snapshot: NaturalFirstApprovalSafetySnapshot): boolean {
    return (
      snapshot.status !== 'execution-allowed' ||
      snapshot.route === 'tool-preview' ||
      snapshot.route === 'approval-proposal' ||
      snapshot.route === 'governed-execution'
    );
  }

  public record(input: NaturalFirstApprovalSafetyInput): NaturalFirstApprovalSafetySnapshot {
    const snapshot = this.buildSnapshot(input);
    if (!this.shouldRecord(snapshot)) {
      return snapshot;
    }

    input.run.metadata = {
      ...input.run.metadata,
      naturalFirstApprovalSafety: snapshot,
    };
    const eventId = `${input.run.id}:natural-first-approval-safety`;
    if (!input.run.events.some((event) => event.id === eventId)) {
      input.run.events.push({
        id: eventId,
        runId: input.run.id,
        kind: 'planning',
        title: 'Natural First Safety',
        detail: snapshot.summary,
        status: snapshot.enforcement.executorBlockedUntilApproval ? 'pending' : 'done',
        createdAt: input.generatedAt,
        metadata: snapshot,
      });
    }
    return snapshot;
  }

  public shouldOpenFallbackApproval(snapshot: NaturalFirstApprovalSafetySnapshot): boolean {
    return (
      snapshot.status === 'approval-required' &&
      snapshot.approvals.pendingIds.length === 0 &&
      snapshot.approvals.approvedIds.length === 0 &&
      snapshot.toolExposure.exposedToolIds.length === 0
    );
  }

  public openFallbackApproval(input: NaturalFirstApprovalSafetyFallbackInput): UniversalAgentRunResult {
    const firstSnapshot = this.buildSnapshot(input);
    const approval: UniversalApprovalRequest = {
      id: input.idFactory('approval'),
      runId: input.run.id,
      title: 'Approve sensitive intent',
      reason:
        'The message was classified as sensitive by Natural First, but no concrete tool was mapped to a safe preview.',
      risk: riskForApproval(firstSnapshot.risk.level),
      status: 'pending',
      createdAt: input.generatedAt,
    };
    const run = input.run;
    run.status = 'waiting_approval';
    run.summary = 'Natural First approval is waiting for the operator decision.';
    run.updatedAt = input.generatedAt;
    run.approvals.push(approval);
    const snapshot = this.buildSnapshot({
      ...input,
      createdApprovalId: approval.id,
    });
    run.metadata = {
      ...run.metadata,
      naturalFirstApprovalSafety: snapshot,
    };
    const planningEvent = run.events.find((event) => event.id === `${run.id}:natural-first-approval-safety`);
    if (planningEvent) {
      planningEvent.detail = snapshot.summary;
      planningEvent.status = 'pending';
      planningEvent.metadata = snapshot;
    }
    run.events.push({
      id: input.idFactory('agent-event'),
      runId: run.id,
      kind: 'approval',
      title: approval.title,
      detail: approval.reason,
      status: 'pending',
      createdAt: input.generatedAt,
      metadata: {
        approvalId: approval.id,
        source: snapshot.source,
        contractVersion: snapshot.contractVersion,
        route: snapshot.route,
        noToolExecuted: true,
      },
    });

    const port = run.replyPorts[0] || {
      id: `${run.channel}:primary`,
      label: 'Channel de origem',
      kind: run.channel,
      status: 'available' as const,
      primary: true,
    };

    // Proposal-time single-pending card (buttons when channel profile has inline_buttons).
    const waitingCard = buildWaitingApprovalCard(
      {
        runId: run.id,
        approvalId: approval.id,
        userId: run.userId,
        sessionId: run.sessionId,
        channel: run.channel,
        title: approval.title,
        risk: approval.risk,
        createdAt: approval.createdAt,
      },
      run.channel,
    );
    const baseText = [
      'Approval needed — sensitive intent paused',
      'This request looks sensitive and was stopped before any tool or executor ran.',
      'Nothing has been executed. Approve only if you want a governed plan to continue.',
    ].join('\n');
    const replyText = waitingCard.usedNativeButtons ? `${baseText}\n\nUse the Approve / Reject buttons below (or /approve / /reject).`
      : `${baseText}\n\nReply with:\n  /approve\n  /reject`;

    return {
      ok: true,
      run,
      replies: [
        {
          id: `${run.id}:reply:natural-first-approval`,
          runId: run.id,
          port,
          text: replyText,
          createdAt: input.generatedAt,
          metadata: {
            source: snapshot.source,
            contractVersion: snapshot.contractVersion,
            approvalId: approval.id,
            noToolExecuted: true,
            surfaceResponse: waitingCard.surfaceResponse,
            usedNativeButtons: waitingCard.usedNativeButtons,
            approvalActions: waitingCard.actions,
            singleApprovalCard: true,
          },
        },
      ],
    };
  }

  private buildSummary(status: NaturalFirstApprovalSafetyStatus, route: string): string {
    if (status === 'approval-required') {
      return `Route ${route} requires approval before executor/tool.`;
    }
    if (status === 'preview-required') {
      return `Route ${route} requires governed preview before execution.`;
    }
    if (status === 'approval-satisfied') {
      return `Route ${route} already possui approval satisfeito.`;
    }
    return `Route ${route} released by Natural First safety.`;
  }

  private buildNextSafeAction(status: NaturalFirstApprovalSafetyStatus, exposedToolCount: number): string {
    if (status === 'approval-required' && exposedToolCount === 0) {
      return 'Open generic sensitive-intent approval and do not call executor.';
    }
    if (status === 'approval-required') {
      return 'Let Capability Negotiation, Tool Rehearsal, or Policy Kernel open a specific approval.';
    }
    if (status === 'preview-required') {
      return 'Prepare a governed preview before any external effect.';
    }
    if (status === 'approval-satisfied') {
      return 'Allow resumption only through the approved and tracked flow.';
    }
    return 'Continue through the normal runtime.';
  }
}
