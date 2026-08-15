import {
  buildZavorthTransactionZavorthControlContractSnapshot,
  ZAVORTH_TRANSACTION_ZAVORTH_CONTROL_CONTRACT_VERSION,
  type ZavorthTransactionZavorthControlContractSnapshot,
  type ZavorthTransactionZavorthControlLane,
  type ZavorthTransactionZavorthControlNotification,
  type ZavorthTransactionZavorthControlOperatorAction,
  type ZavorthTransactionZavorthControlProjectInput,
  type ZavorthTransactionZavorthControlProjection,
  type ZavorthTransactionZavorthControlSafety,
  type ZavorthTransactionZavorthControlTile,
  type ZavorthTransactionZavorthControlTimelineItem,
  type ZavorthTransactionZavorthControlTimelineStatus,
  type ZavorthTransactionZavorthControlTone,
} from '../contracts/ZavorthTransactionZavorthControlContract.js';
import type {
  ZavorthTransactionSurfaceAction,
  ZavorthTransactionSurfaceProjection,
  ZavorthTransactionSurfaceSeverity,
} from '../contracts/ZavorthTransactionSurfaceContract.js';
import type {
  ZavorthTransactionRuntimeStatus,
} from '../contracts/ZavorthTransactionRuntimeContract.js';
import { ZavorthTransactionSurfaceGatewayService } from './ZavorthTransactionSurfaceGatewayService.js';

type TransactionZavorthControlDeps = {
  now?: () => Date;
  surfaceGateway?: ZavorthTransactionSurfaceGatewayService;
};

const SAFETY: ZavorthTransactionZavorthControlSafety = {
  noLiveExecution: true,
  noHiddenLiveAction: true,
  noRawSecretSerialized: true,
  approvalBeforeDryRun: true,
  credentialRefsOnly: true,
  externalSideEffects: false,
  liveExecutionAuthorized: false,
  executableNow: false,
  liveActionApplied: false,
};

export class ZavorthTransactionZavorthControlProjectionService {
  private readonly now: () => Date;
  private readonly surfaceGateway: ZavorthTransactionSurfaceGatewayService;

  public constructor(deps: TransactionZavorthControlDeps = {}) {
    this.now = deps.now ?? (() => new Date());
    this.surfaceGateway = deps.surfaceGateway ?? new ZavorthTransactionSurfaceGatewayService();
  }

  public buildSnapshot(): ZavorthTransactionZavorthControlContractSnapshot {
    return buildZavorthTransactionZavorthControlContractSnapshot();
  }

  public project(input: ZavorthTransactionZavorthControlProjectInput): ZavorthTransactionZavorthControlProjection {
    return this.fromSurfaceProjection(this.surfaceGateway.project(input));
  }

  public fromSurfaceProjection(surfaceProjection: ZavorthTransactionSurfaceProjection): ZavorthTransactionZavorthControlProjection {
    const generatedAt = this.now().toISOString();
    const tone = toneForStatus(surfaceProjection.status);
    const lanes = buildLanes(surfaceProjection);
    const tiles = buildTiles(surfaceProjection, tone);
    const timeline = buildTimeline(surfaceProjection);
    const operatorActions = buildOperatorActions(surfaceProjection.actions);
    const notifications = buildNotifications(surfaceProjection, tone);

    return {
      version: ZAVORTH_TRANSACTION_ZAVORTH_CONTROL_CONTRACT_VERSION,
      id: `${surfaceProjection.id}.zavorthControl`,
      generatedAt,
      surface: surfaceProjection.surface,
      status: surfaceProjection.status,
      tone,
      headline: headlineForStatus(surfaceProjection.status),
      summary: summaryForProjection(surfaceProjection),
      sourceProjectionId: surfaceProjection.id,
      surfaceProjection,
      lanes,
      tiles,
      timeline,
      operatorActions,
      notifications,
      apiPayload: {
        status: surfaceProjection.status,
        tone,
        sourceProjectionId: surfaceProjection.id,
        laneCount: lanes.length,
        actionCount: operatorActions.length,
        safety: SAFETY,
      },
      safety: SAFETY,
    };
  }

  public renderReport(projection: ZavorthTransactionZavorthControlProjection): string {
    return [
      '[transaction-zavorthControl] ZavorthControl controls transaction ZavorthControl projection',
      `[transaction-zavorthControl] status: ${projection.status}`,
      `[transaction-zavorthControl] tone: ${projection.tone}`,
      `[transaction-zavorthControl] headline: ${projection.headline}`,
      `[transaction-zavorthControl] surface: ${projection.surface}`,
      `[transaction-zavorthControl] source-projection: ${projection.sourceProjectionId}`,
      `[transaction-zavorthControl] lanes: ${projection.lanes.length}`,
      `[transaction-zavorthControl] tiles: ${projection.tiles.length}`,
      `[transaction-zavorthControl] timeline: ${projection.timeline.length}`,
      `[transaction-zavorthControl] operator-actions: ${projection.operatorActions.length}`,
      `[transaction-zavorthControl] no-live-execution: ${projection.safety.noLiveExecution}`,
      `[transaction-zavorthControl] no-hidden-live-action: ${projection.safety.noHiddenLiveAction}`,
      `[transaction-zavorthControl] no-raw-secret-serialized: ${projection.safety.noRawSecretSerialized}`,
      `[transaction-zavorthControl] live-action-applied: ${projection.safety.liveActionApplied}`,
      ...projection.lanes.map((lane) => `[transaction-zavorthControl] lane: ${lane.kind} status=${lane.status} severity=${lane.severity}`),
      ...projection.operatorActions.map((action) => `[transaction-zavorthControl] action: ${action.id} enabled=${action.enabled} placement=${action.placement}`),
    ].join('\n');
  }
}

function buildLanes(projection: ZavorthTransactionSurfaceProjection): ZavorthTransactionZavorthControlLane[] {
  const runtime = projection.runtime;
  const previewEntry = runtime.previewEntry;
  const approvalEntry = runtime.approvalEntry;
  return [
    lane('intake', 'Intake', 'Free text entered the governed path.', 'info', projection.status, [
      ['surface', projection.surface],
      ['reply', projection.replyText],
      ['runId', runtime.id],
    ]),
    lane('natural-first', 'Natural First', 'Classification natural-first before do runtime transacional.', severityForRisk(projection.naturalFirst.riskLevel), projection.naturalFirst.route, [
      ['route', projection.naturalFirst.route],
      ['intent', projection.naturalFirst.intent],
      ['requiresApproval', String(projection.naturalFirst.requiresApproval)],
    ]),
    lane('preview', 'Preview', 'Reviewable summary before any external effect.', cardSeverity(projection, 'preview'), runtime.preview.status, [
      ['previewId', runtime.preview.id],
      ['action', runtime.preview.intent.actionKind],
      ['risk', runtime.preview.intent.riskLevel],
      ['quote', quoteLabel(projection)],
    ]),
    lane('approval', 'Approval', 'Explicit operator decision remains required when value or risk is present.', cardSeverity(projection, 'approval'), runtime.approvalEntry?.approvalStatus ?? runtime.preview.approval.status, [
      ['required', String(runtime.preview.approval.required)],
      ['approvalId', runtime.preview.approval.approvalId ?? 'none'],
      ['entry', approvalEntry?.id ?? 'none'],
    ]),
    lane('credential', 'Credential Ref', 'Credentials appear only as SecretRef or metadata, never as raw secrets.', cardSeverity(projection, 'credential'), runtime.credentialValidation?.status ?? 'not-provided', [
      ['ref', runtime.credentialValidation?.ref ?? 'none'],
      ['canUse', String(runtime.credentialValidation?.canUseForConnectorRun ?? false)],
      ['rawSecretSerialized', 'false'],
    ]),
    lane('connector', 'Typed Connector', 'Typed payload stays in dry-run/paper mode with no side effects.', cardSeverity(projection, 'connector'), runtime.connectorRun?.status ?? 'not-run', [
      ['connector', runtime.connectorRun?.connector?.id ?? 'none'],
      ['method', runtime.connectorRun?.payload?.method ?? 'none'],
      ['externalSideEffects', String(runtime.connectorRun?.externalSideEffects ?? false)],
    ]),
    lane('ledger', 'Ledger', 'Preview/approval receipts remain visible for audit.', projection.runtime.previewEntry || projection.runtime.approvalEntry ? 'success' : 'info', projection.runtime.previewEntry || projection.runtime.approvalEntry ? 'recorded' : 'not-recorded', [
      ['previewEntry', previewEntry?.id ?? 'none'],
      ['approvalEntry', approvalEntry?.id ?? 'none'],
      ['receiptCount', String(runtime.phaseReceipts.length)],
    ]),
    lane('safety', 'Safety', 'ZavorthControl does not receive live execution authority.', 'info', 'live-disabled', [
      ['externalSideEffects', String(projection.externalSideEffects)],
      ['liveExecutionAuthorized', String(projection.liveExecutionAuthorized)],
      ['executableNow', String(projection.executableNow)],
      ['liveActionApplied', String(projection.liveActionApplied)],
    ]),
  ];
}

function buildTiles(
  projection: ZavorthTransactionSurfaceProjection,
  tone: ZavorthTransactionZavorthControlTone,
): ZavorthTransactionZavorthControlTile[] {
  const runtime = projection.runtime;
  return [
    tile('status', 'Status', projection.status, headlineForStatus(projection.status), tone),
    tile('action', 'Action', runtime.preview.intent.actionKind, 'Transactional action interpreted by the parser.', toneForRisk(runtime.preview.intent.riskLevel)),
    tile('target', 'Target', `${runtime.preview.intent.target.kind}:${runtime.preview.intent.target.label}`, 'Target normalized for preview and connector.', 'ready'),
    tile('amount', 'Amount', quoteLabel(projection), 'Amount or extra limit extracted for review.', runtime.preview.quote.amount ? 'attention' : 'ready'),
    tile('approval', 'Approval', runtime.approvalEntry?.approvalStatus ?? runtime.preview.approval.status, 'Approval never executes a live transaction at this stage.', runtime.preview.approval.required ? 'attention' : 'ready'),
    tile('credential', 'Credential', runtime.credentialValidation?.status ?? 'not-provided', 'Only credential refs enter the cockpit.', runtime.status === 'credential-required' ? 'attention' : 'ready'),
    tile('connector', 'Connector', runtime.connectorRun?.status ?? 'not-run', 'Typed connector only runs dry-run/paper mode.', runtime.connectorRun?.status === 'dryRun' ? 'success' : 'ready'),
    tile('safety', 'Live', 'disabled', 'No external side effects or live action.', 'ready'),
  ];
}

function buildTimeline(projection: ZavorthTransactionSurfaceProjection): ZavorthTransactionZavorthControlTimelineItem[] {
  const runtime = projection.runtime;
  return [
    timeline('received', 'Message received', `${projection.surface} -> Natural First`, 'done'),
    timeline('classified', 'Classification Natural First', `${projection.naturalFirst.route} / ${projection.naturalFirst.riskLevel}`, 'done'),
    timeline('preview', 'Preview generated', `${runtime.preview.status}: ${runtime.preview.intent.actionKind}`, runtime.preview.status === 'blocked' ? 'blocked' : 'done'),
    timeline('approval', 'Approval', approvalTimelineDetail(projection), approvalTimelineStatus(projection)),
    timeline('credential', 'Credential Ref', credentialTimelineDetail(projection), credentialTimelineStatus(projection)),
    timeline('connector', 'Dry-run connector', connectorTimelineDetail(projection), connectorTimelineStatus(projection)),
    timeline('safety', 'Live gate', 'Live execution disabled by stage contract.', 'done'),
  ];
}

function buildOperatorActions(actions: ZavorthTransactionSurfaceAction[]): ZavorthTransactionZavorthControlOperatorAction[] {
  return actions.map((action) => ({
    id: `zavorthControl.${action.id}`,
    sourceActionId: action.id,
    label: action.label,
    description: action.reason,
    enabled: action.enabled,
    placement: actionPlacement(action),
    requiresConfirmation: action.requiresConfirmation,
    command: action.command,
  }));
}

function buildNotifications(
  projection: ZavorthTransactionSurfaceProjection,
  tone: ZavorthTransactionZavorthControlTone,
): ZavorthTransactionZavorthControlNotification[] {
  return [
    {
      id: `${projection.id}.notification.primary`,
      channel: projection.surface,
      title: headlineForStatus(projection.status),
      body: projection.replyText,
      tone,
    },
    {
      id: `${projection.id}.notification.safety`,
      channel: projection.surface,
      title: 'Live execution disabled',
      body: 'The cockpit can request approval, rejection, credential refs, or dryRun; it does not execute live transactions.',
      tone: 'ready',
    },
  ];
}

function lane(
  kind: ZavorthTransactionZavorthControlLane['kind'],
  title: string,
  summary: string,
  severity: ZavorthTransactionSurfaceSeverity,
  status: string,
  facts: Array<[string, string]>,
): ZavorthTransactionZavorthControlLane {
  return {
    id: `transaction-zavorthControl.${kind}`,
    kind,
    title,
    summary,
    severity,
    status,
    facts: facts.map(([label, value]) => ({ label, value })),
  };
}

function tile(
  kind: ZavorthTransactionZavorthControlTile['kind'],
  label: string,
  value: string,
  detail: string,
  tone: ZavorthTransactionZavorthControlTone,
): ZavorthTransactionZavorthControlTile {
  return {
    id: `transaction-zavorthControl.tile.${kind}`,
    kind,
    label,
    value,
    detail,
    tone,
  };
}

function timeline(
  id: string,
  label: string,
  detail: string,
  status: ZavorthTransactionZavorthControlTimelineStatus,
): ZavorthTransactionZavorthControlTimelineItem {
  return {
    id,
    label,
    detail,
    status,
  };
}

function quoteLabel(projection: ZavorthTransactionSurfaceProjection): string {
  const quote = projection.runtime.preview.quote;
  if (quote.amount == null) {
    return 'n/a';
  }
  return `${quote.amount} ${quote.currency ?? ''}`.trim();
}

function headlineForStatus(status: ZavorthTransactionRuntimeStatus): string {
  if (status === 'simulated') {
    return 'Transactional simulation ready';
  }
  if (status === 'approval-required') {
    return 'Transaction waiting for approval';
  }
  if (status === 'credential-required') {
    return 'Credential ref required';
  }
  if (status === 'blocked') {
    return 'Transaction blocked';
  }
  if (status === 'needs-clarification') {
    return 'Transaction needs details';
  }
  return 'Preview transacional ready';
}

function summaryForProjection(projection: ZavorthTransactionSurfaceProjection): string {
  return `${headlineForStatus(projection.status)} para ${projection.runtime.preview.intent.target.label}; live execution remains disabled.`;
}

function toneForStatus(status: ZavorthTransactionRuntimeStatus): ZavorthTransactionZavorthControlTone {
  if (status === 'simulated') {
    return 'success';
  }
  if (status === 'blocked') {
    return 'blocked';
  }
  if (status === 'approval-required' || status === 'credential-required' || status === 'needs-clarification') {
    return 'attention';
  }
  return 'ready';
}

function toneForRisk(risk: string): ZavorthTransactionZavorthControlTone {
  if (risk === 'danger') {
    return 'blocked';
  }
  if (risk === 'attention') {
    return 'attention';
  }
  return 'ready';
}

function severityForRisk(risk: string): ZavorthTransactionSurfaceSeverity {
  if (risk === 'danger') {
    return 'danger';
  }
  if (risk === 'attention') {
    return 'warning';
  }
  return 'info';
}

function cardSeverity(
  projection: ZavorthTransactionSurfaceProjection,
  kind: string,
): ZavorthTransactionSurfaceSeverity {
  return projection.cards.find((card) => card.kind === kind)?.severity ?? 'info';
}

function approvalTimelineStatus(projection: ZavorthTransactionSurfaceProjection): ZavorthTransactionZavorthControlTimelineStatus {
  if (projection.status === 'approval-required') {
    return 'pending';
  }
  if (projection.runtime.approvalEntry) {
    return projection.runtime.approvalEntry.approvalStatus === 'rejected' ? 'blocked' : 'done';
  }
  if (projection.runtime.preview.approval.required) {
    return 'pending';
  }
  return 'skipped';
}

function approvalTimelineDetail(projection: ZavorthTransactionSurfaceProjection): string {
  if (projection.runtime.approvalEntry) {
    return `${projection.runtime.approvalEntry.approvalStatus}: ${projection.runtime.approvalEntry.id}`;
  }
  if (projection.runtime.preview.approval.required) {
    return `required: ${projection.runtime.preview.approval.approvalId ?? 'pending-id'}`;
  }
  return 'approval not required for this preview';
}

function credentialTimelineStatus(projection: ZavorthTransactionSurfaceProjection): ZavorthTransactionZavorthControlTimelineStatus {
  if (projection.status === 'credential-required') {
    return 'pending';
  }
  if (projection.runtime.credentialValidation?.status === 'ready') {
    return 'done';
  }
  if (projection.runtime.credentialValidation?.status === 'blocked' || projection.runtime.credentialValidation?.status === 'missing') {
    return 'blocked';
  }
  return 'skipped';
}

function credentialTimelineDetail(projection: ZavorthTransactionSurfaceProjection): string {
  if (projection.runtime.credentialValidation) {
    return `${projection.runtime.credentialValidation.status}: ${projection.runtime.credentialValidation.ref}`;
  }
  return projection.status === 'credential-required' ? 'credential ref required' : 'credential not required';
}

function connectorTimelineStatus(projection: ZavorthTransactionSurfaceProjection): ZavorthTransactionZavorthControlTimelineStatus {
  if (projection.runtime.connectorRun?.status === 'dryRun') {
    return 'done';
  }
  if (projection.runtime.connectorRun?.status === 'blocked') {
    return 'blocked';
  }
  if (projection.status === 'approval-required' || projection.status === 'credential-required' || projection.status === 'needs-clarification') {
    return 'pending';
  }
  if (projection.status === 'blocked') {
    return 'blocked';
  }
  return 'skipped';
}

function connectorTimelineDetail(projection: ZavorthTransactionSurfaceProjection): string {
  if (projection.runtime.connectorRun) {
    return `${projection.runtime.connectorRun.connector?.id ?? 'none'}: ${projection.runtime.connectorRun.payload?.method ?? 'no-payload'}`;
  }
  return 'connector not run yet';
}

function actionPlacement(action: ZavorthTransactionSurfaceAction): ZavorthTransactionZavorthControlOperatorAction['placement'] {
  if (!action.enabled) {
    return 'disabled';
  }
  if (action.kind === 'request-approval' || action.kind === 'simulate') {
    return 'primary';
  }
  if (action.kind === 'reject-preview') {
    return 'danger';
  }
  return 'secondary';
}
