import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';
import {
  ZAVORTH_UNIVERSAL_SKILL_APPROVED_DASHBOARD_CANARY_CONTRACT_VERSION,
  type ZavorthUniversalSkillApprovedDashboardCanarySnapshot,
  type ZavorthUniversalSkillApprovedDashboardCanaryStatus,
  type ZavorthUniversalSkillCanaryMode,
  type ZavorthUniversalSkillCanaryStatus,
  type ZavorthUniversalSkillDashboardAction,
  type ZavorthUniversalSkillDashboardCard,
  type ZavorthUniversalSkillDashboardFilter,
  type ZavorthUniversalSkillDashboardTableRow,
} from '../contracts/ZavorthUniversalSkillApprovedDashboardCanaryContract.js';
import type {
  ZavorthUniversalSkillDashboardReviewItem,
  ZavorthUniversalSkillScaleBatch,
  ZavorthUniversalSkillScaleHardeningSnapshot,
} from '../contracts/ZavorthUniversalSkillScaleHardeningContract.js';
import {
  UniversalSkillScaleHardeningService,
  type UniversalSkillScaleHardeningInput,
} from './UniversalSkillScaleHardeningService.js';

type Runtime = {
  now?: () => Date;
  projectRoot?: string;
  scaleService?: Pick<UniversalSkillScaleHardeningService, 'buildSnapshot' | 'formatSnapshotText'>;
  mkdirSync?: typeof fs.mkdirSync;
  writeFileSync?: typeof fs.writeFileSync;
};

export type UniversalSkillApprovedDashboardCanaryInput = UniversalSkillScaleHardeningInput & {
  approvedDashboardItemIds?: string[] | null;
  selectedBatchId?: string | null;
  canaryMode?: ZavorthUniversalSkillCanaryMode | null;
  approvalId?: string | null;
  persistCanaryReport?: boolean;
  canaryReportPath?: string | null;
};

export class UniversalSkillApprovedDashboardCanaryService {
  private readonly now: () => Date;
  private readonly defaultProjectRoot: string;
  private readonly scaleService: Pick<UniversalSkillScaleHardeningService, 'buildSnapshot' | 'formatSnapshotText'> | null;
  private readonly mkdirSyncImpl: typeof fs.mkdirSync;
  private readonly writeFileSyncImpl: typeof fs.writeFileSync;

  constructor(runtime: Runtime = {}) {
    this.now = runtime.now || (() => new Date());
    this.defaultProjectRoot = runtime.projectRoot || config.projectRoot;
    this.scaleService = runtime.scaleService || null;
    this.mkdirSyncImpl = runtime.mkdirSync || fs.mkdirSync.bind(fs);
    this.writeFileSyncImpl = runtime.writeFileSync || fs.writeFileSync.bind(fs);
  }

  public async buildSnapshot(
    input: UniversalSkillApprovedDashboardCanaryInput = {},
  ): Promise<ZavorthUniversalSkillApprovedDashboardCanarySnapshot> {
    const projectRoot = path.resolve(input.projectRoot || this.defaultProjectRoot);
    const channel = normalizeChannel(input.channel);
    const scale = await this.resolveScaleService(projectRoot).buildSnapshot({
      ...input,
      projectRoot,
      channel,
    });
    const canaryMode = normalizeCanaryMode(input.canaryMode);
    const approvedItemIds = resolveApprovedItemIds(scale, input.approvedDashboardItemIds);
    const pendingItemIds = scale.dashboardReview.items
      .map((item) => item.id)
      .filter((id) => !approvedItemIds.includes(id));
    const implementedItems = scale.dashboardReview.items
      .filter((item) => approvedItemIds.includes(item.id));
    const selectedBatch = this.selectBatch(scale.batches, input.selectedBatchId || null);
    const canary = this.buildCanary({
      mode: canaryMode,
      scale,
      selectedBatch,
      approvalId: normalizeApprovalId(input.approvalId),
    });
    const status = resolveStatus({
      scale,
      pendingItemIds,
      canary,
    });
    const reportPath = path.resolve(input.canaryReportPath || path.join(
      projectRoot,
      '.zavorth',
      'reports',
      'universal-skill-approved-dashboard-canary.json',
    ));
    const shouldPersistReport = input.persistCanaryReport !== false;
    let snapshot = this.composeSnapshot({
      projectRoot,
      channel,
      scale,
      status,
      canary,
      approvedItemIds,
      pendingItemIds,
      implementedItems,
      reportPersisted: false,
      reportPath: shouldPersistReport ? reportPath : null,
    });

    if (shouldPersistReport) {
      this.persistSnapshot(reportPath, snapshot);
      snapshot = {
        ...snapshot,
        report: {
          persisted: true,
          path: reportPath,
          rawSecretsSerialized: false,
        },
      };
      this.persistSnapshot(reportPath, snapshot);
    }

    return snapshot;
  }

  public formatSnapshotText(snapshot: ZavorthUniversalSkillApprovedDashboardCanarySnapshot): string {
    const lines = [
      'Universal Skill Approved Dashboard Canary - Intent model0',
      '',
      `Status: ${snapshot.status}`,
      `Dashboard endpoint: ${snapshot.dashboardImplementation.endpoint}`,
      `Itens aprovados: ${snapshot.dashboardImplementation.approvedItemIds.length} | pendentes: ${snapshot.dashboardImplementation.pendingItemIds.length}`,
      `Canary: ${snapshot.canary.status} | mode=${snapshot.canary.mode} | batch=${snapshot.canary.selectedBatch?.id || 'none'}`,
      `Live prepared: ${snapshot.canary.livePrepared} | execution=${snapshot.canary.liveExecutionPerformed}`,
      `Report: ${snapshot.report.persisted ? snapshot.report.path : 'nao persistido'}`,
      '',
      'Cards:',
    ];

    for (const card of snapshot.dashboardImplementation.cards) {
      lines.push(`- ${card.label}: ${card.value} (${card.tone})`);
    }

    lines.push('', 'Actions:');
    for (const action of snapshot.dashboardImplementation.actions) {
      lines.push(`- ${action.enabled ? 'enabled' : 'disabled'} ${action.label}: ${action.command}`);
    }

    lines.push('', 'Canary commands:');
    lines.push(`- dry-run: ${snapshot.canary.commands.dryRun || 'none'}`);
    lines.push(`- live: ${snapshot.canary.commands.live || 'none'}`);
    lines.push(`- approval: ${snapshot.canary.commands.requestApproval || 'none'}`);

    lines.push('', 'Proximas acoes:');
    for (const action of snapshot.rollout.nextActions) {
      lines.push(`- ${action}`);
    }

    lines.push('', `Next: ${snapshot.commands.nextStage}`);
    return lines.join('\n');
  }

  private composeSnapshot(input: {
    projectRoot: string;
    channel: string;
    scale: ZavorthUniversalSkillScaleHardeningSnapshot;
    status: ZavorthUniversalSkillApprovedDashboardCanaryStatus;
    canary: ZavorthUniversalSkillApprovedDashboardCanarySnapshot['canary'];
    approvedItemIds: string[];
    pendingItemIds: string[];
    implementedItems: ZavorthUniversalSkillDashboardReviewItem[];
    reportPersisted: boolean;
    reportPath: string | null;
  }): ZavorthUniversalSkillApprovedDashboardCanarySnapshot {
    return {
      generatedAt: this.now().toISOString(),
      contractVersion: ZAVORTH_UNIVERSAL_SKILL_APPROVED_DASHBOARD_CANARY_CONTRACT_VERSION,
      status: input.status,
      projectRoot: input.projectRoot,
      channel: input.channel,
      scale: input.scale,
      dashboardImplementation: {
        endpoint: '/api/skills/scale-hardening',
        approvedItemIds: input.approvedItemIds,
        pendingItemIds: input.pendingItemIds,
        implementedItems: input.implementedItems,
        visualFilesChanged: false,
        layoutMutationPerformed: false,
        cards: buildCards(input.scale, input.status),
        table: {
          id: 'scale-canary-batches',
          rows: buildTableRows(input.scale),
        },
        filters: buildFilters(input.scale),
        actions: buildActions(input.canary, input.scale),
      },
      canary: input.canary,
      rollout: buildRollout(input.status, input.canary, input.pendingItemIds),
      report: {
        persisted: input.reportPersisted,
        path: input.reportPath,
        rawSecretsSerialized: false,
      },
      policy: {
        certificationMatrixScaleHardeningIsAuthority: true,
        approvedDashboardItemsOnly: true,
        endpointRequiresManagementAuth: true,
        noLayoutMutationPerformed: true,
        noCssMutationPerformed: true,
        liveCanaryRequiresApprovalId: true,
        canaryPreparationDoesNotExecuteSkills: true,
        noExecutionPerformed: true,
        noDirectUpstreamRuntimeUse: true,
        noRawSecretsSerialized: true,
      },
      commands: {
        run: 'npm run zavorth:universal-skill-approved-dashboard-canary -- --discover',
        runJson: 'npm run zavorth:universal-skill-approved-dashboard-canary:json -- --discover',
        check: 'npm run zavorth:universal-skill-approved-dashboard-canary:check --silent',
        nextStage: 'Intent model1 - Dashboard Visual Rendering Approval and Canary Monitoring',
      },
    };
  }

  private buildCanary(input: {
    mode: ZavorthUniversalSkillCanaryMode;
    scale: ZavorthUniversalSkillScaleHardeningSnapshot;
    selectedBatch: ZavorthUniversalSkillScaleBatch | null;
    approvalId: string | null;
  }): ZavorthUniversalSkillApprovedDashboardCanarySnapshot['canary'] {
    const receiptId = `intent-model0-${this.now().toISOString().replace(/[^0-9]/g, '').slice(0, 14)}-${stableHash(`${input.mode}|${input.selectedBatch?.id || 'none'}`)}`;
    const baseCommands = buildCanaryCommands(input.selectedBatch, input.approvalId);
    const blockedReason = input.scale.status === 'blocked'
      ? 'Scale hardening bloqueado; canary nao pode prosseguir.'
      : !input.selectedBatch && input.mode !== 'dashboard-only'
        ? 'Nenhum batch disponivel para canary.'
        : null;

    if (blockedReason) {
      return canary({
        mode: input.mode,
        status: 'blocked',
        selectedBatch: input.selectedBatch,
        approvalId: input.approvalId,
        receiptId,
        reason: blockedReason,
        commands: baseCommands,
      });
    }

    if (input.mode === 'dashboard-only') {
      return canary({
        mode: input.mode,
        status: 'dashboard-ready',
        selectedBatch: input.selectedBatch,
        approvalId: input.approvalId,
        receiptId,
        reason: 'Dashboard view model aprovado e pronto para consumo pelo endpoint.',
        commands: baseCommands,
      });
    }

    if (input.mode === 'dry-run') {
      return canary({
        mode: input.mode,
        status: 'dry-run-ready',
        selectedBatch: input.selectedBatch,
        approvalId: input.approvalId,
        dryRunPrepared: true,
        receiptId,
        reason: 'Canary dry-run preparado; nenhuma skill foi executada.',
        commands: baseCommands,
      });
    }

    if (!input.approvalId) {
      return canary({
        mode: input.mode,
        status: 'approval-required',
        selectedBatch: input.selectedBatch,
        approvalId: null,
        receiptId,
        reason: 'Canary live exige approvalId explicito antes de preparar live.',
        commands: baseCommands,
      });
    }

    return canary({
      mode: input.mode,
      status: 'live-prepared',
      selectedBatch: input.selectedBatch,
      approvalId: input.approvalId,
      dryRunPrepared: true,
      livePrepared: true,
      receiptId,
      reason: 'Canary live preparado com approvalId; execucao real permanece fora desta preparacao.',
      commands: baseCommands,
    });
  }

  private selectBatch(
    batches: ZavorthUniversalSkillScaleBatch[],
    selectedBatchId: string | null,
  ): ZavorthUniversalSkillScaleBatch | null {
    if (selectedBatchId) {
      return batches.find((batch) => batch.id === selectedBatchId) || null;
    }
    return batches[0] || null;
  }

  private persistSnapshot(reportPath: string, snapshot: ZavorthUniversalSkillApprovedDashboardCanarySnapshot): void {
    this.mkdirSyncImpl(path.dirname(reportPath), { recursive: true });
    this.writeFileSyncImpl(reportPath, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
  }

  private resolveScaleService(projectRoot: string): Pick<UniversalSkillScaleHardeningService, 'buildSnapshot' | 'formatSnapshotText'> {
    return this.scaleService || new UniversalSkillScaleHardeningService({ projectRoot });
  }
}

function buildCards(
  scale: ZavorthUniversalSkillScaleHardeningSnapshot,
  operationalStatus: ZavorthUniversalSkillApprovedDashboardCanaryStatus,
): ZavorthUniversalSkillDashboardCard[] {
  const blockedGates = scale.gates.filter((gate) => gate.status === 'blocked').length;
  const attentionGates = scale.gates.filter((gate) => gate.status === 'attention').length;
  return [
    card('operational-status', 'Status operacional', operationalStatus, toneForStatus(operationalStatus), 'Status consolidado da Etapa 10 para operar dashboard/canary.'),
    card('scale-status', 'Escala/Etapa 9', scale.status, toneForStatus(scale.status), 'Status bruto da Etapa 9 mantido como evidencia de escala e cobertura.'),
    card('sources', 'Fontes em QA', scale.capacity.includedSourceCount, 'neutral', 'Fontes reais incluidas na certificacao.'),
    card('candidates', 'Candidatos', scale.capacity.candidateCount, 'neutral', 'Candidatos avaliados pela cadeia de intake/QA.'),
    card('batches', 'Batches', scale.capacity.batchCount, scale.capacity.batchCount > 0 ? 'success' : 'warning', 'Batches/canary com approval obrigatorio.'),
    card('regression', 'Regressoes', scale.onboarding.regression.findings.length, scale.onboarding.regression.findings.length > 0 ? 'warning' : 'success', 'Findings agregados da Etapa 8.'),
    card('gates', 'Gates com atencao', blockedGates + attentionGates, blockedGates > 0 ? 'danger' : attentionGates > 0 ? 'warning' : 'success', 'Gates blocked/attention da Etapa 9.'),
  ];
}

function buildTableRows(scale: ZavorthUniversalSkillScaleHardeningSnapshot): ZavorthUniversalSkillDashboardTableRow[] {
  return scale.batches.map((batch) => ({
    id: batch.id,
    sourceLabel: batch.sourceLabel,
    candidateRange: `${batch.candidateStart}-${batch.candidateEnd}`,
    candidateEstimate: batch.candidateEstimate,
    mode: batch.recommendedMode,
    approvalRequired: batch.approvalRequired,
    status: batch.recommendedMode === 'hold' ? 'blocked' : scale.status === 'blocked' ? 'blocked' : 'passed',
  }));
}

function buildFilters(scale: ZavorthUniversalSkillScaleHardeningSnapshot): ZavorthUniversalSkillDashboardFilter[] {
  return [
    {
      id: 'source',
      label: 'Fonte',
      options: unique(scale.batches.map((batch) => batch.sourceLabel)),
    },
    {
      id: 'status',
      label: 'Status',
      options: unique(['passed', 'attention', 'blocked', scale.status]),
    },
    {
      id: 'mode',
      label: 'Modo',
      options: unique(scale.batches.map((batch) => batch.recommendedMode)),
    },
  ];
}

function buildActions(
  canary: ZavorthUniversalSkillApprovedDashboardCanarySnapshot['canary'],
  scale: ZavorthUniversalSkillScaleHardeningSnapshot,
): ZavorthUniversalSkillDashboardAction[] {
  return [
    action({
      id: 'refresh',
      label: 'Atualizar escala',
      command: 'npm run zavorth:universal-skill-approved-dashboard-canary -- --discover',
      apiPath: '/api/skills/scale-hardening',
      enabled: true,
      requiresApproval: false,
      reason: 'Atualizacao de contrato nao executa skills.',
    }),
    action({
      id: 'dry-run-canary',
      label: 'Preparar dry-run canary',
      command: canary.commands.dryRun || 'npm run zavorth:universal-skill-approved-dashboard-canary -- --canary dry-run',
      apiPath: '/api/skills/scale-hardening?canary=dry-run',
      enabled: scale.status !== 'blocked' && Boolean(canary.selectedBatch),
      requiresApproval: false,
      reason: 'Dry-run prepara envelope e nao executa upstream.',
    }),
    action({
      id: 'request-live-approval',
      label: 'Solicitar approval live',
      command: canary.commands.requestApproval || '/approvals request skill-canary',
      apiPath: '/api/skills/scale-hardening?canary=live',
      enabled: scale.status !== 'blocked' && Boolean(canary.selectedBatch),
      requiresApproval: true,
      reason: 'Live canary exige approvalId antes de qualquer preparacao.',
    }),
  ];
}

function buildCanaryCommands(
  selectedBatch: ZavorthUniversalSkillScaleBatch | null,
  approvalId: string | null,
): ZavorthUniversalSkillApprovedDashboardCanarySnapshot['canary']['commands'] {
  if (!selectedBatch) {
    return {
      dryRun: null,
      live: null,
      requestApproval: '/approvals request skill-canary',
    };
  }
  return {
    dryRun: `npm run zavorth:universal-skill-approved-dashboard-canary -- --canary dry-run --batch ${selectedBatch.id}`,
    live: approvalId
      ? `npm run zavorth:universal-skill-approved-dashboard-canary -- --canary live --batch ${selectedBatch.id} --approval-id ${approvalId}`
      : null,
    requestApproval: `/approvals request skill-canary ${selectedBatch.id}`,
  };
}

function buildRollout(
  status: ZavorthUniversalSkillApprovedDashboardCanaryStatus,
  canary: ZavorthUniversalSkillApprovedDashboardCanarySnapshot['canary'],
  pendingItemIds: string[],
): ZavorthUniversalSkillApprovedDashboardCanarySnapshot['rollout'] {
  if (status === 'blocked') {
    return {
      readyForDashboardUse: false,
      readyForLiveCanary: false,
      nextActions: [
        'Resolver gates blocked antes de renderizar canary operacional.',
        'Reexecutar Etapa 10 em dashboard-only depois da correcao.',
      ],
    };
  }

  if (canary.status === 'approval-required') {
    return {
      readyForDashboardUse: pendingItemIds.length === 0,
      readyForLiveCanary: false,
      nextActions: [
        'Emitir approvalId do dono para preparar live canary.',
        'Reexecutar com --canary live --approval-id <id>.',
      ],
    };
  }

  return {
    readyForDashboardUse: pendingItemIds.length === 0,
    readyForLiveCanary: canary.status === 'live-prepared',
    nextActions: canary.status === 'live-prepared'
      ? [
          'Revisar receipt live-prepared antes de qualquer executor real.',
          'Monitorar o primeiro batch antes de ampliar canary.',
        ]
      : [
          'Abrir endpoint /api/skills/scale-hardening no dashboard autenticado.',
          'Executar dry-run do primeiro batch antes de solicitar live approval.',
        ],
  };
}

function resolveApprovedItemIds(
  scale: ZavorthUniversalSkillScaleHardeningSnapshot,
  approvedDashboardItemIds: string[] | null | undefined,
): string[] {
  const allIds = scale.dashboardReview.items.map((item) => item.id);
  if (!approvedDashboardItemIds || approvedDashboardItemIds.length === 0 || approvedDashboardItemIds.includes('all')) {
    return allIds;
  }
  return unique(approvedDashboardItemIds).filter((id) => allIds.includes(id));
}

function resolveStatus(input: {
  scale: ZavorthUniversalSkillScaleHardeningSnapshot;
  pendingItemIds: string[];
  canary: ZavorthUniversalSkillApprovedDashboardCanarySnapshot['canary'];
}): ZavorthUniversalSkillApprovedDashboardCanaryStatus {
  if (input.scale.status === 'blocked' || input.canary.status === 'blocked') {
    return 'blocked';
  }
  if (
    input.canary.status === 'approval-required'
    || input.pendingItemIds.length > 0
  ) {
    return 'attention';
  }
  if (input.scale.status === 'attention' && !isAdvisoryScaleAttention(input.scale, input.canary)) {
    return 'attention';
  }
  return 'passed';
}

function isAdvisoryScaleAttention(
  scale: ZavorthUniversalSkillScaleHardeningSnapshot,
  canary: ZavorthUniversalSkillApprovedDashboardCanarySnapshot['canary'],
): boolean {
  if (scale.status !== 'attention') {
    return false;
  }
  if (!['dashboard-ready', 'dry-run-ready', 'live-prepared'].includes(canary.status)) {
    return false;
  }
  if (scale.gates.some((gate) => gate.status === 'blocked')) {
    return false;
  }
  const attentionGates = scale.gates.filter((gate) => gate.status === 'attention');
  if (attentionGates.some((gate) => gate.id !== 'dashboard-controls-onboarding')) {
    return false;
  }
  if (scale.onboarding.regression.findings.some((finding) => finding.severity !== 'info')) {
    return false;
  }

  const expansion = scale.onboarding.qa.expansion;
  if (
    expansion.summary.denied > 0
    || expansion.summary.executionPerformed
    || expansion.summary.directUpstreamRuntimeUse
    || scale.onboarding.qa.certification.gates.hostileBlocked === false
  ) {
    return false;
  }

  const blockedCandidates = expansion.sourceResults.flatMap((result) =>
    result.importSnapshot.preview.candidates.filter((candidate) => candidate.status === 'blocked'));
  if (blockedCandidates.length === 0) {
    return true;
  }
  return blockedCandidates.every((candidate) => isAdvisoryPreviewCoverageBlock({
    blockedReason: candidate.blockedReason,
    issueCodes: candidate.issues.map((issue) => issue.code),
  }));
}

function isAdvisoryPreviewCoverageBlock(input: {
  blockedReason: string | null;
  issueCodes: string[];
}): boolean {
  const reason = String(input.blockedReason || '');
  const hasCoverageReason = /limite.*arquivo|arquivo.*limite|too many files|max files|entry limit|zip-entry-limit/i.test(reason);
  const hasCoverageIssue = input.issueCodes.includes('zip-entry-limit');
  const allowedIssueCodes = new Set(['unsupported-file', 'zip-entry-limit']);
  const hasOnlyCoverageIssues = input.issueCodes.every((code) => allowedIssueCodes.has(code));
  return hasOnlyCoverageIssues && (hasCoverageReason || hasCoverageIssue);
}

function canary(input: {
  mode: ZavorthUniversalSkillCanaryMode;
  status: ZavorthUniversalSkillCanaryStatus;
  selectedBatch: ZavorthUniversalSkillScaleBatch | null;
  approvalId: string | null;
  receiptId: string;
  reason: string;
  commands: ZavorthUniversalSkillApprovedDashboardCanarySnapshot['canary']['commands'];
  dryRunPrepared?: boolean;
  livePrepared?: boolean;
}): ZavorthUniversalSkillApprovedDashboardCanarySnapshot['canary'] {
  return {
    mode: input.mode,
    status: input.status,
    selectedBatch: input.selectedBatch,
    approvalId: input.approvalId,
    dryRunPrepared: input.dryRunPrepared === true,
    livePrepared: input.livePrepared === true,
    liveExecutionPerformed: false,
    upstreamExecutionPerformed: false,
    receiptId: input.receiptId,
    reason: input.reason,
    commands: input.commands,
  };
}

function card(
  id: string,
  label: string,
  value: number | string | boolean,
  tone: ZavorthUniversalSkillDashboardCard['tone'],
  evidence: string,
): ZavorthUniversalSkillDashboardCard {
  return { id, label, value, tone, evidence };
}

function action(input: ZavorthUniversalSkillDashboardAction): ZavorthUniversalSkillDashboardAction {
  return input;
}

function toneForStatus(status: ZavorthUniversalSkillApprovedDashboardCanaryStatus): ZavorthUniversalSkillDashboardCard['tone'] {
  if (status === 'blocked') {
    return 'danger';
  }
  if (status === 'attention') {
    return 'warning';
  }
  return 'success';
}

function normalizeCanaryMode(value: ZavorthUniversalSkillCanaryMode | null | undefined): ZavorthUniversalSkillCanaryMode {
  return value === 'dry-run' || value === 'live' || value === 'dashboard-only' ? value : 'dashboard-only';
}

function normalizeApprovalId(value: string | null | undefined): string | null {
  const normalized = String(value || '').trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeChannel(value: string | null | undefined): string {
  return String(value || 'cli').trim().toLowerCase().replace(/[^a-z0-9_.:-]+/g, '-') || 'cli';
}

function stableHash(value: string): string {
  let hash = 0;
  for (const char of value) {
    hash = ((hash << 5) - hash + char.charCodeAt(0)) | 0;
  }
  return Math.abs(hash).toString(36).slice(0, 8).padStart(4, '0');
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}
