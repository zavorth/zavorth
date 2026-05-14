import {
  buildZavorthTransactionCommandCenterContractSnapshot,
  ZAVORTH_TRANSACTION_COMMAND_CENTER_CONTRACT_VERSION,
  type ZavorthTransactionCommandCenterContractSnapshot,
  type ZavorthTransactionCommandCenterLane,
  type ZavorthTransactionCommandCenterNotification,
  type ZavorthTransactionCommandCenterOperatorAction,
  type ZavorthTransactionCommandCenterProjectInput,
  type ZavorthTransactionCommandCenterProjection,
  type ZavorthTransactionCommandCenterSafety,
  type ZavorthTransactionCommandCenterTile,
  type ZavorthTransactionCommandCenterTimelineItem,
  type ZavorthTransactionCommandCenterTimelineStatus,
  type ZavorthTransactionCommandCenterTone,
} from '../contracts/ZavorthTransactionCommandCenterContract.js';
import type {
  ZavorthTransactionSurfaceAction,
  ZavorthTransactionSurfaceProjection,
  ZavorthTransactionSurfaceSeverity,
} from '../contracts/ZavorthTransactionSurfaceContract.js';
import type {
  ZavorthTransactionRuntimeStatus,
} from '../contracts/ZavorthTransactionRuntimeContract.js';
import { ZavorthTransactionSurfaceGatewayService } from './ZavorthTransactionSurfaceGatewayService.js';

type TransactionCommandCenterDeps = {
  now?: () => Date;
  surfaceGateway?: ZavorthTransactionSurfaceGatewayService;
};

const SAFETY: ZavorthTransactionCommandCenterSafety = {
  noLiveExecution: true,
  noHiddenLiveAction: true,
  noRawSecretSerialized: true,
  approvalBeforeSimulation: true,
  credentialRefsOnly: true,
  externalSideEffects: false,
  liveExecutionAuthorized: false,
  executableNow: false,
  liveActionApplied: false,
};

export class ZavorthTransactionCommandCenterProjectionService {
  private readonly now: () => Date;
  private readonly surfaceGateway: ZavorthTransactionSurfaceGatewayService;

  public constructor(deps: TransactionCommandCenterDeps = {}) {
    this.now = deps.now ?? (() => new Date());
    this.surfaceGateway = deps.surfaceGateway ?? new ZavorthTransactionSurfaceGatewayService();
  }

  public buildSnapshot(): ZavorthTransactionCommandCenterContractSnapshot {
    return buildZavorthTransactionCommandCenterContractSnapshot();
  }

  public project(input: ZavorthTransactionCommandCenterProjectInput): ZavorthTransactionCommandCenterProjection {
    return this.fromSurfaceProjection(this.surfaceGateway.project(input));
  }

  public fromSurfaceProjection(surfaceProjection: ZavorthTransactionSurfaceProjection): ZavorthTransactionCommandCenterProjection {
    const generatedAt = this.now().toISOString();
    const tone = toneForStatus(surfaceProjection.status);
    const lanes = buildLanes(surfaceProjection);
    const tiles = buildTiles(surfaceProjection, tone);
    const timeline = buildTimeline(surfaceProjection);
    const operatorActions = buildOperatorActions(surfaceProjection.actions);
    const notifications = buildNotifications(surfaceProjection, tone);

    return {
      version: ZAVORTH_TRANSACTION_COMMAND_CENTER_CONTRACT_VERSION,
      id: `${surfaceProjection.id}.command-center`,
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

  public renderReport(projection: ZavorthTransactionCommandCenterProjection): string {
    return [
      '[transaction-command-center] Phase 8 transaction Command Center projection',
      `[transaction-command-center] status: ${projection.status}`,
      `[transaction-command-center] tone: ${projection.tone}`,
      `[transaction-command-center] headline: ${projection.headline}`,
      `[transaction-command-center] surface: ${projection.surface}`,
      `[transaction-command-center] source-projection: ${projection.sourceProjectionId}`,
      `[transaction-command-center] lanes: ${projection.lanes.length}`,
      `[transaction-command-center] tiles: ${projection.tiles.length}`,
      `[transaction-command-center] timeline: ${projection.timeline.length}`,
      `[transaction-command-center] operator-actions: ${projection.operatorActions.length}`,
      `[transaction-command-center] no-live-execution: ${projection.safety.noLiveExecution}`,
      `[transaction-command-center] no-hidden-live-action: ${projection.safety.noHiddenLiveAction}`,
      `[transaction-command-center] no-raw-secret-serialized: ${projection.safety.noRawSecretSerialized}`,
      `[transaction-command-center] live-action-applied: ${projection.safety.liveActionApplied}`,
      ...projection.lanes.map((lane) => `[transaction-command-center] lane: ${lane.kind} status=${lane.status} severity=${lane.severity}`),
      ...projection.operatorActions.map((action) => `[transaction-command-center] action: ${action.id} enabled=${action.enabled} placement=${action.placement}`),
    ].join('\n');
  }
}

function buildLanes(projection: ZavorthTransactionSurfaceProjection): ZavorthTransactionCommandCenterLane[] {
  const runtime = projection.runtime;
  const previewEntry = runtime.previewEntry;
  const approvalEntry = runtime.approvalEntry;
  return [
    lane('intake', 'Intake', 'Texto livre entrou no caminho governado.', 'info', projection.status, [
      ['surface', projection.surface],
      ['reply', projection.replyText],
      ['runId', runtime.id],
    ]),
    lane('natural-first', 'Natural First', 'Classificacao natural-first antes do runtime transacional.', severityForRisk(projection.naturalFirst.riskLevel), projection.naturalFirst.route, [
      ['route', projection.naturalFirst.route],
      ['intent', projection.naturalFirst.intent],
      ['requiresApproval', String(projection.naturalFirst.requiresApproval)],
    ]),
    lane('preview', 'Preview', 'Resumo revisavel antes de qualquer efeito externo.', cardSeverity(projection, 'preview'), runtime.preview.status, [
      ['previewId', runtime.preview.id],
      ['action', runtime.preview.intent.actionKind],
      ['risk', runtime.preview.intent.riskLevel],
      ['quote', quoteLabel(projection)],
    ]),
    lane('approval', 'Approval', 'Decisao explicita do operador continua obrigatoria quando ha valor ou risco.', cardSeverity(projection, 'approval'), runtime.approvalEntry?.approvalStatus ?? runtime.preview.approval.status, [
      ['required', String(runtime.preview.approval.required)],
      ['approvalId', runtime.preview.approval.approvalId ?? 'none'],
      ['entry', approvalEntry?.id ?? 'none'],
    ]),
    lane('credential', 'Credential Ref', 'Credenciais aparecem apenas como SecretRef/metadata, nunca como segredo bruto.', cardSeverity(projection, 'credential'), runtime.credentialValidation?.status ?? 'not-provided', [
      ['ref', runtime.credentialValidation?.ref ?? 'none'],
      ['canUse', String(runtime.credentialValidation?.canUseForConnectorRun ?? false)],
      ['rawSecretSerialized', 'false'],
    ]),
    lane('connector', 'Typed Connector', 'Payload tipado fica em simulacao/paper e sem side effects.', cardSeverity(projection, 'connector'), runtime.connectorRun?.status ?? 'not-run', [
      ['connector', runtime.connectorRun?.connector?.id ?? 'none'],
      ['method', runtime.connectorRun?.payload?.method ?? 'none'],
      ['externalSideEffects', String(runtime.connectorRun?.externalSideEffects ?? false)],
    ]),
    lane('ledger', 'Ledger', 'Receipts de preview/approval ficam visiveis para auditoria.', projection.runtime.previewEntry || projection.runtime.approvalEntry ? 'success' : 'info', projection.runtime.previewEntry || projection.runtime.approvalEntry ? 'recorded' : 'not-recorded', [
      ['previewEntry', previewEntry?.id ?? 'none'],
      ['approvalEntry', approvalEntry?.id ?? 'none'],
      ['receiptCount', String(runtime.stageReceipts.length)],
    ]),
    lane('safety', 'Safety', 'Command Center nao recebe autoridade de execucao live.', 'info', 'live-disabled', [
      ['externalSideEffects', String(projection.externalSideEffects)],
      ['liveExecutionAuthorized', String(projection.liveExecutionAuthorized)],
      ['executableNow', String(projection.executableNow)],
      ['liveActionApplied', String(projection.liveActionApplied)],
    ]),
  ];
}

function buildTiles(
  projection: ZavorthTransactionSurfaceProjection,
  tone: ZavorthTransactionCommandCenterTone,
): ZavorthTransactionCommandCenterTile[] {
  const runtime = projection.runtime;
  return [
    tile('status', 'Status', projection.status, headlineForStatus(projection.status), tone),
    tile('action', 'Acao', runtime.preview.intent.actionKind, 'Acao transacional interpretada pelo parser.', toneForRisk(runtime.preview.intent.riskLevel)),
    tile('target', 'Alvo', `${runtime.preview.intent.target.kind}:${runtime.preview.intent.target.label}`, 'Alvo normalizado para preview e connector.', 'ready'),
    tile('amount', 'Valor', quoteLabel(projection), 'Valor ou limite extraido para revisao.', runtime.preview.quote.amount ? 'attention' : 'ready'),
    tile('approval', 'Approval', runtime.approvalEntry?.approvalStatus ?? runtime.preview.approval.status, 'Approval nunca executa transacao live nesta fase.', runtime.preview.approval.required ? 'attention' : 'ready'),
    tile('credential', 'Credential', runtime.credentialValidation?.status ?? 'not-provided', 'Somente credential refs entram no cockpit.', runtime.status === 'credential-required' ? 'attention' : 'ready'),
    tile('connector', 'Connector', runtime.connectorRun?.status ?? 'not-run', 'Connector tipado roda apenas simulacao/paper.', runtime.connectorRun?.status === 'simulated' ? 'success' : 'ready'),
    tile('safety', 'Live', 'disabled', 'Sem side effects externos ou live action.', 'ready'),
  ];
}

function buildTimeline(projection: ZavorthTransactionSurfaceProjection): ZavorthTransactionCommandCenterTimelineItem[] {
  const runtime = projection.runtime;
  return [
    timeline('received', 'Mensagem recebida', `${projection.surface} -> Natural First`, 'done'),
    timeline('classified', 'Classificacao Natural First', `${projection.naturalFirst.route} / ${projection.naturalFirst.riskLevel}`, 'done'),
    timeline('preview', 'Preview gerado', `${runtime.preview.status}: ${runtime.preview.intent.actionKind}`, runtime.preview.status === 'blocked' ? 'blocked' : 'done'),
    timeline('approval', 'Approval', approvalTimelineDetail(projection), approvalTimelineStatus(projection)),
    timeline('credential', 'Credential Ref', credentialTimelineDetail(projection), credentialTimelineStatus(projection)),
    timeline('connector', 'Connector simulado', connectorTimelineDetail(projection), connectorTimelineStatus(projection)),
    timeline('safety', 'Live gate', 'Execucao live desabilitada pelo contrato da fase.', 'done'),
  ];
}

function buildOperatorActions(actions: ZavorthTransactionSurfaceAction[]): ZavorthTransactionCommandCenterOperatorAction[] {
  return actions.map((action) => ({
    id: `command-center.${action.id}`,
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
  tone: ZavorthTransactionCommandCenterTone,
): ZavorthTransactionCommandCenterNotification[] {
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
      body: 'O cockpit pode pedir approval, rejeicao, credential ref ou simulacao; ele nao executa transacoes live.',
      tone: 'ready',
    },
  ];
}

function lane(
  kind: ZavorthTransactionCommandCenterLane['kind'],
  title: string,
  summary: string,
  severity: ZavorthTransactionSurfaceSeverity,
  status: string,
  facts: Array<[string, string]>,
): ZavorthTransactionCommandCenterLane {
  return {
    id: `transaction-command-center.${kind}`,
    kind,
    title,
    summary,
    severity,
    status,
    facts: facts.map(([label, value]) => ({ label, value })),
  };
}

function tile(
  kind: ZavorthTransactionCommandCenterTile['kind'],
  label: string,
  value: string,
  detail: string,
  tone: ZavorthTransactionCommandCenterTone,
): ZavorthTransactionCommandCenterTile {
  return {
    id: `transaction-command-center.tile.${kind}`,
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
  status: ZavorthTransactionCommandCenterTimelineStatus,
): ZavorthTransactionCommandCenterTimelineItem {
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
    return 'Simulacao transacional pronta';
  }
  if (status === 'approval-required') {
    return 'Transacao aguardando approval';
  }
  if (status === 'credential-required') {
    return 'Credential ref obrigatoria';
  }
  if (status === 'blocked') {
    return 'Transacao bloqueada';
  }
  if (status === 'needs-clarification') {
    return 'Transacao precisa de detalhes';
  }
  return 'Preview transacional pronto';
}

function summaryForProjection(projection: ZavorthTransactionSurfaceProjection): string {
  return `${headlineForStatus(projection.status)} para ${projection.runtime.preview.intent.target.label}; live execution permanece desabilitada.`;
}

function toneForStatus(status: ZavorthTransactionRuntimeStatus): ZavorthTransactionCommandCenterTone {
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

function toneForRisk(risk: string): ZavorthTransactionCommandCenterTone {
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

function approvalTimelineStatus(projection: ZavorthTransactionSurfaceProjection): ZavorthTransactionCommandCenterTimelineStatus {
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

function credentialTimelineStatus(projection: ZavorthTransactionSurfaceProjection): ZavorthTransactionCommandCenterTimelineStatus {
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

function connectorTimelineStatus(projection: ZavorthTransactionSurfaceProjection): ZavorthTransactionCommandCenterTimelineStatus {
  if (projection.runtime.connectorRun?.status === 'simulated') {
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

function actionPlacement(action: ZavorthTransactionSurfaceAction): ZavorthTransactionCommandCenterOperatorAction['placement'] {
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
