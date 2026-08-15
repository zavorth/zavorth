import { createHash } from 'node:crypto';
import {
  NaturalFirstRunClassifier,
  type NaturalFirstRunClassification,
} from '../runtime/agent/NaturalFirstRunClassifier.js';
import { ZavorthTransactionRuntimeOrchestratorService } from './ZavorthTransactionRuntimeOrchestratorService.js';

import {
  buildZavorthTransactionSurfaceContractSnapshot,
  ZAVORTH_TRANSACTION_SURFACE_CONTRACT_VERSION,
  type ZavorthTransactionSurfaceAction,
  type ZavorthTransactionSurfaceCard,
  type ZavorthTransactionSurfaceContractSnapshot,
  type ZavorthTransactionSurfaceKind,
  type ZavorthTransactionSurfaceProjectInput,
  type ZavorthTransactionSurfaceProjection,
  type ZavorthTransactionSurfaceSeverity,
} from '../contracts/ZavorthTransactionSurfaceContract.js';
import type {
  ZavorthTransactionRuntimeRunResult,
  ZavorthTransactionRuntimeStatus,
} from '../contracts/ZavorthTransactionRuntimeContract.js';
import type { UniversalAgentChannel } from '../runtime/agent/UniversalAgentRuntimeTypes.js';

type SurfaceGatewayDeps = {
  now?: () => Date;
  runtime?: ZavorthTransactionRuntimeOrchestratorService;
  classifier?: NaturalFirstRunClassifier;
};

export class ZavorthTransactionSurfaceGatewayService {
  private readonly now: () => Date;
  private readonly runtime: ZavorthTransactionRuntimeOrchestratorService;
  private readonly classifier: NaturalFirstRunClassifier;

  public constructor(deps: SurfaceGatewayDeps = {}) {
    this.now = deps.now ?? (() => new Date());
    this.runtime = deps.runtime ?? new ZavorthTransactionRuntimeOrchestratorService();
    this.classifier = deps.classifier ?? new NaturalFirstRunClassifier();
  }

  public buildSnapshot(): ZavorthTransactionSurfaceContractSnapshot {
    return buildZavorthTransactionSurfaceContractSnapshot();
  }

  public project(input: ZavorthTransactionSurfaceProjectInput): ZavorthTransactionSurfaceProjection {
    const now = this.now();
    const surface = input.surface ?? 'natural-first';
    const channel = surfaceToChannel(surface);
    const structuredKind = input.kind;
    const structuredAction = input.actionKind;
    const isStructuredTransaction = structuredKind !== undefined || structuredAction !== undefined;
    const isPreviewOnlyAction =
      structuredAction === 'price-monitor' ||
      structuredAction === 'market-data-read' ||
      structuredAction === 'cart-preview' ||
      structuredKind === 'monitor-price' ||
      structuredKind === 'unknown-transaction';
    const naturalFirst = this.classifier.classify({
      text: input.text,
      channel,
      userId: input.userId,
      sessionId: input.sessionId,
      workspace: input.workspace,
      availableTools: ['zavorth.transaction-runtime', 'zavorth.transaction-preview', 'zavorth.transaction-approval'],
      // Structured kind/action only — free text never activates transaction routes.
      transactionApprovalIntent: isStructuredTransaction && !isPreviewOnlyAction,
      transactionPreviewIntent: isStructuredTransaction && isPreviewOnlyAction,
      metadata: {
        transactionSurface: surface,
        ...(structuredKind ? { transactionKind: structuredKind } : {}),
        ...(structuredAction ? { transactionActionKind: structuredAction } : {}),
      },
    });
    const runtime = this.runtime.run({
      text: input.text,
      kind: input.kind,
      actionKind: input.actionKind,
      targetKind: input.targetKind,
      channel,
      mode: input.mode,
      approve: input.approve,
      reject: input.reject,
      requireCredential: input.requireCredential,
      credentialRef: input.credentialRef,
      connectorId: input.connectorId,
    });
    const cards = buildCards(runtime);
    const actions = buildActions(runtime, surface);

    return {
      version: ZAVORTH_TRANSACTION_SURFACE_CONTRACT_VERSION,
      id: buildProjectionId(input.text, surface, now),
      createdAt: now.toISOString(),
      surface,
      status: runtime.status,
      naturalFirst: {
        route: naturalFirst.route,
        intent: naturalFirst.intent.primary,
        shouldEnterGateway: naturalFirst.shouldEnterGateway,
        requiresApproval: naturalFirst.requiresApproval,
        riskLevel: naturalFirst.risk.level,
        signals: naturalFirst.signals,
      },
      runtime,
      cards,
      actions,
      replyText: buildReplyText(surface, runtime, actions),
      apiPayload: {
        status: runtime.status,
        runId: runtime.id,
        previewId: runtime.preview.id,
        cards,
        actions,
      },
      externalSideEffects: false,
      liveActionApplied: false,
      liveExecutionAuthorized: false,
      executableNow: false,
    };
  }

  public renderReport(projection: ZavorthTransactionSurfaceProjection): string {
    return [
      '[transaction-surface] Surface controls transaction surface gateway',
      `[transaction-surface] surface: ${projection.surface}`,
      `[transaction-surface] status: ${projection.status}`,
      `[transaction-surface] natural-first-route: ${projection.naturalFirst.route}`,
      `[transaction-surface] natural-first-risk: ${projection.naturalFirst.riskLevel}`,
      `[transaction-surface] cards: ${projection.cards.length}`,
      `[transaction-surface] actions: ${projection.actions.length}`,
      `[transaction-surface] external-side-effects: ${projection.externalSideEffects}`,
      `[transaction-surface] live-execution-authorized: ${projection.liveExecutionAuthorized}`,
      `[transaction-surface] executable-now: ${projection.executableNow}`,
      `[transaction-surface] live-action-applied: ${projection.liveActionApplied}`,
      `[transaction-surface] reply: ${projection.replyText}`,
      ...projection.actions.map(
        (action) => `[transaction-surface] action: ${action.id} enabled=${action.enabled} reason=${action.reason}`,
      ),
    ].join('\n');
  }
}

function buildCards(runtime: ZavorthTransactionRuntimeRunResult): ZavorthTransactionSurfaceCard[] {
  const severity = severityForStatus(runtime.status);
  const cards: ZavorthTransactionSurfaceCard[] = [
    {
      id: `${runtime.id}.summary`,
      kind: 'runtime-summary',
      title: 'Transaction Runtime',
      status: runtime.status,
      severity,
      lines: [
        `mode=${runtime.mode}`,
        `action=${runtime.preview.intent.actionKind}`,
        `target=${runtime.preview.intent.target.kind}:${runtime.preview.intent.target.label}`,
      ],
    },
    {
      id: `${runtime.id}.preview`,
      kind: 'preview',
      title: 'Preview',
      status: runtime.preview.status,
      severity: severityForPreview(runtime.preview.status),
      lines: [
        `previewId=${runtime.preview.id}`,
        `quote=${runtime.preview.quote.amount ?? 'n/a'} ${runtime.preview.quote.currency ?? ''}`.trim(),
        `risk=${runtime.preview.intent.riskLevel}`,
      ],
    },
    {
      id: `${runtime.id}.approval`,
      kind: 'approval',
      title: 'Approval',
      status: runtime.approvalEntry?.approvalStatus ?? runtime.preview.approval.status,
      severity: runtime.preview.approval.required && !runtime.approvalEntry ? 'warning' : 'info',
      lines: [
        `required=${runtime.preview.approval.required}`,
        `approvalId=${runtime.preview.approval.approvalId ?? 'none'}`,
        `entry=${runtime.approvalEntry?.id ?? 'none'}`,
      ],
    },
    {
      id: `${runtime.id}.credential`,
      kind: 'credential',
      title: 'Credential Ref',
      status: runtime.credentialValidation?.status ?? 'not-provided',
      severity: runtime.status === 'credential-required' ? 'warning' : 'info',
      lines: [
        `ref=${runtime.credentialValidation?.ref ?? 'none'}`,
        `canUse=${runtime.credentialValidation?.canUseForConnectorRun ?? false}`,
        'rawSecretSerialized=false',
      ],
    },
    {
      id: `${runtime.id}.connector`,
      kind: 'connector',
      title: 'Typed Connector',
      status: runtime.connectorRun?.status ?? 'not-run',
      severity:
        runtime.connectorRun?.status === 'dryRun'
          ? 'success'
          : runtime.connectorRun?.status === 'blocked'
            ? 'danger'
            : 'info',
      lines: [
        `connector=${runtime.connectorRun?.connector?.id ?? 'none'}`,
        `payload=${runtime.connectorRun?.payload?.method ?? 'none'}`,
        `externalSideEffects=${runtime.connectorRun?.externalSideEffects ?? false}`,
      ],
    },
    {
      id: `${runtime.id}.safety`,
      kind: 'safety',
      title: 'Safety',
      status: 'live-disabled',
      severity: 'info',
      lines: [
        `externalSideEffects=${runtime.externalSideEffects}`,
        `liveExecutionAuthorized=${runtime.liveExecutionAuthorized}`,
        `executableNow=${runtime.executableNow}`,
        `liveActionApplied=${runtime.liveActionApplied}`,
      ],
    },
  ];

  return cards;
}

function buildActions(
  runtime: ZavorthTransactionRuntimeRunResult,
  surface: ZavorthTransactionSurfaceKind,
): ZavorthTransactionSurfaceAction[] {
  const baseCommand = `npm run zavorth:transaction-runtime -- --text ${JSON.stringify(runtime.text)} --mode ${runtime.mode}`;
  const actions: ZavorthTransactionSurfaceAction[] = [];

  actions.push({
    id: 'explain-blockers',
    kind: 'explain-blockers',
    label: 'Explain blockers',
    enabled: runtime.blockers.length > 0,
    requiresConfirmation: false,
    reason: runtime.blockers.length > 0 ? runtime.blockers.join(', ') : 'No blockers to explain.',
  });

  actions.push({
    id: 'request-approval',
    kind: 'request-approval',
    label: 'Request approval',
    enabled: runtime.status === 'approval-required',
    requiresConfirmation: true,
    command: `${baseCommand} --approve`,
    reason:
      runtime.status === 'approval-required'
        ? 'Approval is required before dryRun can continue.'
        : 'Approval is not currently the blocking step.',
  });

  actions.push({
    id: 'reject-preview',
    kind: 'reject-preview',
    label: 'Reject preview',
    enabled: runtime.status === 'approval-required',
    requiresConfirmation: true,
    command: `${baseCommand} --reject`,
    reason:
      runtime.status === 'approval-required'
        ? 'The operator can reject this preview before any dryRun continues.'
        : 'There is no pending approval preview to reject.',
  });

  actions.push({
    id: 'provide-credential-ref',
    kind: 'provide-credential-ref',
    label: 'Provide credential ref',
    enabled: runtime.status === 'credential-required',
    requiresConfirmation: false,
    reason:
      runtime.status === 'credential-required'
        ? 'A valid transaction credential ref is required before connector dry-run.'
        : 'Credential ref is not currently required.',
  });

  actions.push({
    id: 'simulate',
    kind: 'simulate',
    label: 'Simulate',
    enabled: runtime.status === 'approval-required' || runtime.status === 'credential-required',
    requiresConfirmation: true,
    command: baseCommand,
    reason: 'DryRun reruns the governed runtime; it still cannot execute live effects.',
  });

  actions.push({
    id: 'open-ledger',
    kind: 'open-ledger',
    label: surface === 'api' ? 'Read ledger API payload' : 'Open ledger',
    enabled: Boolean(runtime.previewEntry || runtime.approvalEntry),
    requiresConfirmation: false,
    reason: 'Ledger is available when preview or approval entries were written.',
  });

  actions.push({
    id: 'no-live-action',
    kind: 'no-live-action',
    label: 'Live execution disabled',
    enabled: false,
    requiresConfirmation: true,
    reason: 'Surface controls exposes surface actions only; it cannot authorize live execution.',
  });

  return actions;
}

function buildReplyText(
  surface: ZavorthTransactionSurfaceKind,
  runtime: ZavorthTransactionRuntimeRunResult,
  actions: ZavorthTransactionSurfaceAction[],
): string {
  const action = runtime.preview.intent.actionKind;
  const target = runtime.preview.intent.target.label;
  if (runtime.status === 'simulated') {
    return surface === 'telegram'
      ? `Simulation: ${action} on ${target}. Nothing live was executed.`
      : `Transaction runtime simulation ${action} for ${target}; no live transaction was executed.`;
  }
  if (runtime.status === 'approval-required') {
    return surface === 'telegram'
      ? `I need approval for ${action} on ${target}.`
      : `Approval is required before simulating ${action} for ${target}.`;
  }
  if (runtime.status === 'credential-required') {
    return surface === 'telegram'
      ? `I need a secure credential ref for ${action} on ${target}.`
      : `A valid credential ref is required before simulating ${action} for ${target}.`;
  }
  if (runtime.status === 'needs-clarification') {
    return 'I need a clearer target, amount, limit or condition before preparing this transaction.';
  }
  const enabledAction = actions.find((item) => item.enabled);
  return enabledAction ? `${runtime.status}: ${enabledAction.reason}`
    : `${runtime.status}: transaction surface projection is live-disabled.`;
}

function severityForStatus(status: ZavorthTransactionRuntimeStatus): ZavorthTransactionSurfaceSeverity {
  if (status === 'simulated') {
    return 'success';
  }
  if (status === 'blocked') {
    return 'danger';
  }
  if (status === 'approval-required' || status === 'credential-required' || status === 'needs-clarification') {
    return 'warning';
  }
  return 'info';
}

function severityForPreview(status: string): ZavorthTransactionSurfaceSeverity {
  if (status === 'ready-for-review') {
    return 'success';
  }
  if (status === 'blocked') {
    return 'danger';
  }
  return 'warning';
}

function surfaceToChannel(surface: ZavorthTransactionSurfaceKind): UniversalAgentChannel {
  if (surface === 'natural-first') {
    return 'web';
  }
  return surface;
}

function buildProjectionId(text: string, surface: ZavorthTransactionSurfaceKind, now: Date): string {
  const hash = createHash('sha256').update(`${now.toISOString()}:${surface}:${text}`).digest('hex').slice(0, 16);
  return `ztx-surface-${hash}`;
}
