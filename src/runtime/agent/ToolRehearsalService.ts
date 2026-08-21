import { ToolChainBudgetGuard } from './ToolChainBudgetGuard.js';
import { ToolExecutionSemantics } from './ToolExecutionSemantics.js';
import type {
  UniversalAgentRequest,
  UniversalAgentRun,
  UniversalToolRiskLevel,
} from './UniversalAgentRuntimeTypes.js';

export const TOOL_REHEARSAL_CONTRACT_VERSION = '2026-05-03.tool-rehearsal' as const;

export type ToolRehearsalStatus =
  | 'not-needed'
  | 'waiting-scope'
  | 'proposal'
  | 'waiting-approval'
  | 'approved'
  | 'blocked';

export type ToolRehearsalCall = {
  id: string;
  order: number;
  toolId: string;
  label: string;
  risk: UniversalToolRiskLevel;
  requiresApproval: boolean;
  previewRequired: boolean;
  allowedByScope: boolean;
  blockedByScope: boolean;
  dryRunSupported: boolean;
  externalSideEffect: boolean;
  approximateArguments: Record<string, unknown>;
  expectedOutput: string;
  refusalReason: string | null;
  receipts: string[];
};

export type ToolRehearsalSnapshot = {
  contractVersion: typeof TOOL_REHEARSAL_CONTRACT_VERSION;
  source: 'ToolRehearsalService';
  generatedAt: string;
  identifiers: {
    runId: string;
    traceId: string;
    requestId: string;
    sessionId: string;
  };
  status: ToolRehearsalStatus;
  summary: {
    callCount: number;
    dangerousCallCount: number;
    blockedCallCount: number;
    approvalRequired: boolean;
    scopeApproved: boolean;
    scopeId: string | null;
    highestRisk: UniversalToolRiskLevel;
    budgetAllowed: boolean;
    rehearsalRequired: boolean;
  };
  calls: ToolRehearsalCall[];
  adjustments: Array<{
    id: string;
    label: string;
    detail: string;
    commandHint: string;
  }>;
  approval: {
    required: boolean;
    approvalId: string | null;
    title: string;
    question: string;
  };
  receipts: Array<{
    id: string;
    kind: 'scope' | 'preview' | 'tool-exposure' | 'semantics' | 'budget' | 'approval' | 'policy';
    detail: string;
    status: 'pending' | 'done' | 'blocked';
  }>;
  policy: {
    noToolExecuted: true;
    noFilesystemMutation: true;
    noShellSpawned: true;
    noNetworkCall: true;
    approximateArgumentsOnly: true;
    realExecutionLimitedToRehearsedScope: true;
    approvalsStillRequired: boolean;
    previewStillRequired: boolean;
    secretsSerialized: false;
  };
  surface: {
    cliCommand: string;
    zavorthControlPath: string;
    approvalHint: string;
  };
  nextSafeAction: string;
};

export type ToolRehearsalInput = {
  run: UniversalAgentRun;
  request?: Pick<UniversalAgentRequest, 'text' | 'requestedTools' | 'metadata' | 'workspace' | 'channel'> | null;
  generatedAt?: string | null;
};

type LooseRecord = Record<string, unknown>;

function normalizeText(value: unknown, fallback = ''): string {
  const text = String(value || '').trim();
  return text || fallback;
}

function normalizeKey(value: unknown, fallback = ''): string {
  return normalizeText(value, fallback)
    .toLowerCase()
    .replace(/[^a-z0-9_.:-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function recordOrNull(value: unknown): LooseRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as LooseRecord
    : null;
}

function listOrEmpty(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return Array.from(new Set(value.map((entry) => normalizeText(entry)).filter(Boolean)));
}

function normalizeRisk(value: unknown): UniversalToolRiskLevel {
  const raw = normalizeText(value).toLowerCase();
  if (raw === 'safe' || raw === 'attention' || raw === 'danger' || raw === 'unknown') {
    return raw;
  }
  return 'unknown';
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

function isTruthy(value: unknown): boolean {
  return value === true || value === 'true' || value === 1 || value === '1';
}

function humanize(value: string): string {
  return value
    .replace(/[._:-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^./, (letter) => letter.toUpperCase()) || 'Tool';
}

function listRecords(value: unknown): LooseRecord[] {
  return Array.isArray(value)
    ? value.flatMap((entry) => {
      const record = recordOrNull(entry);
      return record ? [record] : [];
    })
    : [];
}

export class ToolRehearsalService {
  private readonly now: () => Date;
  private readonly semantics = new ToolExecutionSemantics();
  private readonly budgetGuard = new ToolChainBudgetGuard({
    maxToolCalls: 12,
    maxToolRounds: 4,
    maxDangerousToolCalls: 4,
    requireApprovalForDangerousTools: true,
  });

  constructor(options: { now?: () => Date } = {}) {
    this.now = options.now || (() => new Date());
  }

  public buildSnapshot(input: ToolRehearsalInput): ToolRehearsalSnapshot {
    const { run } = input;
    const generatedAt = normalizeText(input.generatedAt, this.now().toISOString());
    const metadata = run.metadata || {};
    const requestMetadata = input.request?.metadata || {};
    const negotiation = recordOrNull(metadata.capabilityNegotiation);
    const preview = recordOrNull(metadata.universalPreviewMode);
    const previous = recordOrNull(metadata.toolRehearsal);
    const scope = recordOrNull(negotiation?.scope);
    const scopeId = normalizeText(scope?.id) || null;
    const scopeApproved = scope?.approved === true || normalizeText(negotiation?.status) === 'approved';
    const allowedToolIds = this.resolveAllowedToolIds(run, scope, input.request);
    const blockedToolIds = this.resolveBlockedToolIds(run, scope, negotiation, preview);
    const calls = this.buildCalls({
      run,
      request: input.request,
      preview,
      allowedToolIds,
      blockedToolIds,
      scopeApproved,
    });
    const highestRisk = maxRisk(calls.map((call) => call.risk));
    const dangerousCallCount = calls.filter((call) => call.risk === 'danger').length;
    const blockedCallCount = calls.filter((call) => call.blockedByScope || !call.allowedByScope).length;
    const approvalRequired = calls.some((call) => call.requiresApproval) || highestRisk === 'danger';
    const previewRequired = calls.some((call) => call.previewRequired);
    const previousApprovalId = normalizeText(previous?.approvalId)
      || normalizeText(recordOrNull(previous?.approval)?.approvalId);
    const approved = this.hasApprovedRehearsal(run, previous, previousApprovalId);
    const waitingApproval = normalizeText(previous?.status) === 'waiting-approval' && !approved;
    const budget = this.budgetGuard.evaluate({
      toolExposure: run.toolExposure,
      calls: calls.map((call) => ({
        toolId: call.toolId,
        round: call.order,
        risk: call.risk,
        requiresApproval: call.requiresApproval,
        estimatedCostUnits: call.risk === 'danger' ? 2 : 1,
      })),
      metadata: {
        source: 'ToolRehearsalService',
      },
    });
    const rehearsalRequired = this.isRehearsalRequired({
      calls,
      highestRisk,
      approvalRequired,
      metadata,
      requestMetadata,
    });
    const status = this.resolveStatus({
      calls,
      blockedCallCount,
      budgetAllowed: budget.allowed,
      scopeApproved,
      negotiationStatus: normalizeText(negotiation?.status),
      approved,
      waitingApproval,
      rehearsalRequired,
    });

    return {
      contractVersion: TOOL_REHEARSAL_CONTRACT_VERSION,
      source: 'ToolRehearsalService',
      generatedAt,
      identifiers: {
        runId: run.id,
        traceId: run.traceId,
        requestId: run.requestId,
        sessionId: run.sessionId,
      },
      status,
      summary: {
        callCount: calls.length,
        dangerousCallCount,
        blockedCallCount,
        approvalRequired,
        scopeApproved,
        scopeId,
        highestRisk,
        budgetAllowed: budget.allowed,
        rehearsalRequired,
      },
      calls,
      adjustments: this.buildAdjustments(calls, budget.reason, scopeApproved),
      approval: {
        required: status === 'proposal' || status === 'waiting-approval',
        approvalId: previousApprovalId || null,
        title: 'Approve tool rehearsal',
        question: 'Do you want to run exactly this governed rehearsal...',
      },
      receipts: this.buildReceipts({ scopeId, preview, run, budget, status, approvalId: previousApprovalId }),
      policy: {
        noToolExecuted: true,
        noFilesystemMutation: true,
        noShellSpawned: true,
        noNetworkCall: true,
        approximateArgumentsOnly: true,
        realExecutionLimitedToRehearsedScope: true,
        approvalsStillRequired: approvalRequired && !approved,
        previewStillRequired: previewRequired && !approved,
        secretsSerialized: false,
      },
      surface: {
        cliCommand: 'zavorth rehearse --json',
        zavorthControlPath: '/zavorthControl...sector=skills',
        approvalHint: 'Adjust the rehearsal if the order, path, or approximate command is wrong.',
      },
      nextSafeAction: this.buildNextSafeAction(status, budget.reason),
    };
  }

  private resolveAllowedToolIds(
    run: UniversalAgentRun,
    scope: LooseRecord | null,
    request?: ToolRehearsalInput['request'],
  ): string[] {
    const scoped = listOrEmpty(scope?.allowedToolIds);
    if (scoped.length > 0) {
      return scoped;
    }
    const requested = listOrEmpty(request?.requestedTools);
    if (requested.length > 0) {
      return requested;
    }
    return run.toolExposure.tools.map((tool) => tool.id);
  }

  private resolveBlockedToolIds(
    run: UniversalAgentRun,
    scope: LooseRecord | null,
    negotiation: LooseRecord | null,
    preview: LooseRecord | null,
  ): string[] {
    const previewToolExposure = recordOrNull(preview?.toolExposure);
    return Array.from(new Set([
      ...listOrEmpty(scope?.blockedToolIds),
      ...listOrEmpty(recordOrNull(negotiation?.summary)?.blockedToolIds),
      ...listOrEmpty(previewToolExposure?.blockedToolIds),
      ...listOrEmpty(run.toolExposure.blockedTools?.map((tool) => tool.id)),
    ].filter(Boolean)));
  }

  private buildCalls(input: {
    run: UniversalAgentRun;
    request?: ToolRehearsalInput['request'];
    preview: LooseRecord | null;
    allowedToolIds: string[];
    blockedToolIds: string[];
    scopeApproved: boolean;
  }): ToolRehearsalCall[] {
    const toolsById = new Map(input.run.toolExposure.tools.map((tool) => [tool.id, tool]));
    const previewByToolId = new Map(
      listRecords(input.preview?.planSteps)
        .map((step) => [normalizeText(step.toolId), step] as const)
        .filter(([toolId]) => Boolean(toolId)),
    );
    const blocked = new Set(input.blockedToolIds.map((toolId) => toolId.toLowerCase()));
    const toolIds = Array.from(new Set(input.allowedToolIds.filter(Boolean)));

    return toolIds.map((toolId, index) => {
      const tool = toolsById.get(toolId);
      const preview = previewByToolId.get(toolId);
      const risk = normalizeRisk(preview?.risk || tool?.risk);
      const semantics = this.semantics.resolve({
        tool,
        toolId,
        risk,
        requiresPreview: preview?.previewRequired === true || undefined,
      });
      const blockedByScope = blocked.has(toolId.toLowerCase());
      const allowedByScope = input.scopeApproved && !blockedByScope;
      return {
        id: `tool-rehearsal:call:${index + 1}:${normalizeKey(toolId, 'tool')}`,
        order: index + 1,
        toolId,
        label: normalizeText(tool?.label, humanize(toolId)),
        risk: semantics.risk,
        requiresApproval: semantics.requiresApproval,
        previewRequired: semantics.requiresPreview,
        allowedByScope,
        blockedByScope,
        dryRunSupported: true,
        externalSideEffect: semantics.externalSideEffect,
        approximateArguments: this.buildApproximateArguments({
          toolId,
          request: input.request,
          run: input.run,
          preview,
          order: index + 1,
        }),
        expectedOutput: this.expectedOutputForTool(toolId, semantics.risk),
        refusalReason: blockedByScope ? 'Tool blocked by the negotiated scope.'
          : allowedByScope
            ? null
            : 'Scope not approved for real execution yet.',
        receipts: [
          `semantics:${semantics.toolId}`,
          preview ? `preview:${normalizeText(preview.id, toolId)}` : 'preview:none',
          input.scopeApproved ? 'scope:approved' : 'scope:pending',
        ],
      };
    });
  }

  private buildApproximateArguments(input: {
    toolId: string;
    request?: ToolRehearsalInput['request'];
    run: UniversalAgentRun;
    preview: LooseRecord | null | undefined;
    order: number;
  }): Record<string, unknown> {
    const scope = recordOrNull(input.run.metadata?.capabilityNegotiation);
    const pathHints = listOrEmpty(recordOrNull(scope?.scope)?.pathHints);
    const targetPath = pathHints[0] || normalizeText(input.request?.workspace, normalizeText(input.run.workspace, '.'));
    const action = normalizeText(input.preview?.action);
    if (/shell|exec|npm|test/i.test(input.toolId)) {
      return {
        command: action || 'npm test -- --runInBand',
        cwd: targetPath,
        dryRun: true,
        order: input.order,
      };
    }
    if (/write|edit|filesystem/i.test(input.toolId)) {
      return {
        targetPath,
        patchMode: 'preview',
        mutationApplied: false,
        order: input.order,
      };
    }
    if (/network|web|fetch|search/i.test(input.toolId)) {
      return {
        query: normalizeText(input.request?.text, input.run.input),
        networkCallPerformed: false,
        order: input.order,
      };
    }
    return {
      objective: normalizeText(input.request?.text, input.run.input),
      dryRun: true,
      order: input.order,
    };
  }

  private expectedOutputForTool(toolId: string, risk: UniversalToolRiskLevel): string {
    if (/shell|exec|npm|test/i.test(toolId)) {
      return 'Command summary, expected exit code, and truncated logs.';
    }
    if (/write|edit|filesystem/i.test(toolId)) {
      return 'Diff/patch preview without applying a file.';
    }
    if (/read|list|workspace/i.test(toolId)) {
      return 'Content or inventory read inside the workspace.';
    }
    if (/network|web|fetch|search/i.test(toolId)) {
      return 'Query results without a real call during rehearsal.';
    }
    return risk === 'danger'
      ? 'Predicted sensitive result is waiting for approval.'
      : 'Approximate tool result.';
  }

  private hasApprovedRehearsal(
    run: UniversalAgentRun,
    previous: LooseRecord | null,
    approvalId: string,
  ): boolean {
    if (isTruthy(previous?.approved) || normalizeText(previous?.status) === 'approved') {
      return true;
    }
    return Boolean(approvalId)
      && run.approvals.some((approval) => approval.id === approvalId && approval.status === 'approved');
  }

  private isRehearsalRequired(input: {
    calls: ToolRehearsalCall[];
    highestRisk: UniversalToolRiskLevel;
    approvalRequired: boolean;
    metadata: LooseRecord;
    requestMetadata: LooseRecord;
  }): boolean {
    if (
      isTruthy(input.metadata.toolRehearsalRequired)
      || isTruthy(input.requestMetadata.toolRehearsalRequired)
      || isTruthy(recordOrNull(input.metadata.toolRehearsal)?.required)
      || isTruthy(recordOrNull(input.requestMetadata.toolRehearsal)?.required)
    ) {
      return true;
    }
    return input.approvalRequired
      || input.highestRisk === 'danger'
      || input.highestRisk === 'attention'
      || input.calls.some((call) => call.externalSideEffect);
  }

  private resolveStatus(input: {
    calls: ToolRehearsalCall[];
    blockedCallCount: number;
    budgetAllowed: boolean;
    scopeApproved: boolean;
    negotiationStatus: string;
    approved: boolean;
    waitingApproval: boolean;
    rehearsalRequired: boolean;
  }): ToolRehearsalStatus {
    if (input.calls.length === 0) {
      return 'not-needed';
    }
    if (input.blockedCallCount > 0 && input.scopeApproved) {
      return 'blocked';
    }
    if (!input.budgetAllowed) {
      return 'blocked';
    }
    if (input.approved) {
      return 'approved';
    }
    if (input.waitingApproval) {
      return 'waiting-approval';
    }
    if (!input.scopeApproved && (input.negotiationStatus === 'proposal' || input.negotiationStatus === 'waiting-approval')) {
      return 'waiting-scope';
    }
    return input.rehearsalRequired ? 'proposal' : 'not-needed';
  }

  private buildAdjustments(
    calls: ToolRehearsalCall[],
    budgetReason: string | null,
    scopeApproved: boolean,
  ): ToolRehearsalSnapshot['adjustments'] {
    const adjustments: ToolRehearsalSnapshot['adjustments'] = [];
    if (!scopeApproved) {
      adjustments.push({
        id: 'tool-rehearsal:adjustment:approve-scope',
        label: 'Approve scope first',
        detail: 'The real rehearsal is waiting for an approved Capability Negotiation.',
        commandHint: 'zavorth negotiate --json',
      });
    }
    if (budgetReason) {
      adjustments.push({
        id: 'tool-rehearsal:adjustment:budget',
        label: 'Reduzir cadeia de tools',
        detail: `ToolChainBudgetGuard marcou ${budgetReason}.`,
        commandHint: 'zavorth rehearse --limit-tools',
      });
    }
    if (calls.some((call) => call.blockedByScope)) {
      adjustments.push({
        id: 'tool-rehearsal:adjustment:blocked-tools',
        label: 'Remove blocked tool',
        detail: 'At least one planned tool is not inside the allowed scope.',
        commandHint: 'zavorth rehearse --without <tool>',
      });
    }
    if (adjustments.length === 0) {
      adjustments.push({
        id: 'tool-rehearsal:adjustment:none',
        label: 'without ajuste required',
        detail: 'The rehearsal can be approved or refined by the operator.',
        commandHint: 'zavorth approve <approval-id>',
      });
    }
    return adjustments;
  }

  private buildReceipts(input: {
    scopeId: string | null;
    preview: LooseRecord | null;
    run: UniversalAgentRun;
    budget: ReturnType<ToolChainBudgetGuard['evaluate']>;
    status: ToolRehearsalStatus;
    approvalId: string;
  }): ToolRehearsalSnapshot['receipts'] {
    const receipts: ToolRehearsalSnapshot['receipts'] = [];
    receipts.push({
      id: 'tool-rehearsal:receipt:scope',
      kind: 'scope',
      detail: input.scopeId ? `Negotiated scope used: ${input.scopeId}.` : 'without an approved negotiated scope yet.',
      status: input.scopeId ? 'done' : 'pending',
    });
    if (input.preview) {
      receipts.push({
        id: 'tool-rehearsal:receipt:preview',
        kind: 'preview',
        detail: 'Universal Preview Mode used for order and approximate impact.',
        status: 'done',
      });
    }
    receipts.push({
      id: 'tool-rehearsal:receipt:tool-exposure',
      kind: 'tool-exposure',
      detail: `${input.run.toolExposure.tools.length} tool(s) lida(s) da ToolExposurePolicy.`,
      status: 'done',
    });
    receipts.push({
      id: 'tool-rehearsal:receipt:budget',
      kind: 'budget',
      detail: input.budget.summary,
      status: input.budget.allowed ? 'done' : 'blocked',
    });
    if (input.approvalId) {
      receipts.push({
        id: 'tool-rehearsal:receipt:approval',
        kind: 'approval',
        detail: `Approval associado: ${input.approvalId}.`,
        status: input.status === 'approved' ? 'done' : 'pending',
      });
    }
    receipts.push({
      id: 'tool-rehearsal:receipt:policy',
      kind: 'policy',
      detail: 'Rehearsal does not execute tools and limits real execution to rehearsed scope.',
      status: 'done',
    });
    receipts.push({
      id: 'tool-rehearsal:receipt:semantics',
      kind: 'semantics',
      detail: 'ToolExecutionSemantics classified approval, preview and side effects.',
      status: 'done',
    });
    return receipts;
  }

  private buildNextSafeAction(status: ToolRehearsalStatus, budgetReason: string | null): string {
    if (status === 'waiting-scope') {
      return 'Approve Capability Negotiation before rehearsing tools for execution.';
    }
    if (status === 'waiting-approval') {
      return 'Wait for operator approval to execute the approved rehearsal.';
    }
    if (status === 'approved') {
      return 'Execute only the rehearsed and approved calls.';
    }
    if (status === 'blocked') {
      return budgetReason ? `Ajustar rehearsal before run: ${budgetReason}.`
        : 'Remove blocked tool ou renegociar escopo.';
    }
    if (status === 'proposal') {
      return 'Show rehearsal to the user and request approval before real execution.';
    }
    return 'Tool rehearsal is not required for this run.';
  }
}
