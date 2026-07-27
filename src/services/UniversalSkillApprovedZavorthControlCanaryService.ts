import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';
import {
  ZAVORTH_UNIVERSAL_SKILL_APPROVED_ZAVORTH_CONTROL_CANARY_CONTRACT_VERSION,
  type ZavorthUniversalSkillApprovedZavorthControlCanarySnapshot,
  type ZavorthUniversalSkillApprovedZavorthControlCanaryStatus,
  type ZavorthUniversalSkillZavorthControlCanaryMode,
  type ZavorthUniversalSkillZavorthControlCanaryStatus,
  type ZavorthUniversalSkillZavorthControlAction,
  type ZavorthUniversalSkillZavorthControlCard,
  type ZavorthUniversalSkillZavorthControlFilter,
  type ZavorthUniversalSkillZavorthControlTableRow,
} from '../contracts/ZavorthUniversalSkillApprovedZavorthControlCanaryContract.js';
import type {
  ZavorthUniversalSkillZavorthControlReviewItem,
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

export type UniversalSkillApprovedZavorthControlCanaryInput = UniversalSkillScaleHardeningInput & {
  approvedZavorthControlItemIds?: string[] | null;
  selectedBatchId?: string | null;
  canaryMode?: ZavorthUniversalSkillZavorthControlCanaryMode | null;
  approvalId?: string | null;
  persistCanaryReport?: boolean;
  canaryReportPath?: string | null;
};

export class UniversalSkillApprovedZavorthControlCanaryService {
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
    input: UniversalSkillApprovedZavorthControlCanaryInput = {},
  ): Promise<ZavorthUniversalSkillApprovedZavorthControlCanarySnapshot> {
    const projectRoot = path.resolve(input.projectRoot || this.defaultProjectRoot);
    const channel = normalizeChannel(input.channel);
    const scale = await this.resolveScaleService(projectRoot).buildSnapshot({
      ...input,
      projectRoot,
      channel,
    });
    const canaryMode = normalizeCanaryMode(input.canaryMode);
    const approvedItemIds = resolveApprovedItemIds(scale, input.approvedZavorthControlItemIds);
    const pendingItemIds = scale.zavorthControlReview.items
      .map((item: ZavorthUniversalSkillZavorthControlReviewItem) => item.id)
      .filter((id: string) => !approvedItemIds.includes(id));
    const implementedItems = scale.zavorthControlReview.items
      .filter((item: ZavorthUniversalSkillZavorthControlReviewItem) => approvedItemIds.includes(item.id)) as unknown as ZavorthUniversalSkillZavorthControlReviewItem[];
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
      'universal-skill-approved-zavorthControl-canary.json',
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

  public formatSnapshotText(snapshot: ZavorthUniversalSkillApprovedZavorthControlCanarySnapshot): string {
    const lines = [
      'Universal Skill Approved ZavorthControl Canary - Intent model0',
      '',
      `Status: ${snapshot.status}`,
      `ZavorthControl endpoint: ${snapshot.zavorthControlImplementation.endpoint}`,
      `Itens approved: ${snapshot.zavorthControlImplementation.approvedItemIds.length} | pending: ${snapshot.zavorthControlImplementation.pendingItemIds.length}`,
      `Canary: ${snapshot.canary.status} | mode=${snapshot.canary.mode} | batch=${snapshot.canary.selectedBatch?.id || 'none'}`,
      `Live prepared: ${snapshot.canary.livePrepared} | execution=${snapshot.canary.liveExecutionPerformed}`,
      `Report: ${snapshot.report.persisted ? snapshot.report.path : 'not persisted'}`,
      '',
      'Cards:',
    ];

    for (const card of snapshot.zavorthControlImplementation.cards) {
      lines.push(`- ${card.label}: ${card.value} (${card.tone})`);
    }

    lines.push('', 'Actions:');
    for (const action of snapshot.zavorthControlImplementation.actions) {
      lines.push(`- ${action.enabled ? 'enabled' : 'disabled'} ${action.label}: ${action.command}`);
    }

    lines.push('', 'Canary commands:');
    lines.push(`- dry-run: ${snapshot.canary.commands.dryRun || 'none'}`);
    lines.push(`- live: ${snapshot.canary.commands.live || 'none'}`);
    lines.push(`- approval: ${snapshot.canary.commands.requestApproval || 'none'}`);

    lines.push('', 'Proximas actions:');
    for (const action of snapshot.rollout.nextActions) {
      lines.push(`- ${action}`);
    }

    lines.push('', `Next: ${snapshot.commands.nextAction}`);
    return lines.join('\n');
  }

  private composeSnapshot(input: {
    projectRoot: string;
    channel: string;
    scale: ZavorthUniversalSkillScaleHardeningSnapshot;
    status: ZavorthUniversalSkillApprovedZavorthControlCanaryStatus;
    canary: ZavorthUniversalSkillApprovedZavorthControlCanarySnapshot['canary'];
    approvedItemIds: string[];
    pendingItemIds: string[];
    implementedItems: ZavorthUniversalSkillZavorthControlReviewItem[];
    reportPersisted: boolean;
    reportPath: string | null;
  }): ZavorthUniversalSkillApprovedZavorthControlCanarySnapshot {
    return {
      generatedAt: this.now().toISOString(),
      contractVersion: ZAVORTH_UNIVERSAL_SKILL_APPROVED_ZAVORTH_CONTROL_CANARY_CONTRACT_VERSION,
      status: input.status,
      projectRoot: input.projectRoot,
      channel: input.channel,
      scale: input.scale,
      zavorthControlImplementation: {
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
        approvedZavorthControlItemsOnly: true,
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
        run: 'npm run zavorth:universal-skill-approved-zavorthControl-canary -- --discover',
        runJson: 'npm run zavorth:universal-skill-approved-zavorthControl-canary:json -- --discover',
        check: 'npm run zavorth:universal-skill-approved-zavorthControl-canary:check --silent',
        nextAction: 'ZavorthControl Visual Rendering Approval and Canary Monitoring',
      },
    };
  }

  private buildCanary(input: {
    mode: ZavorthUniversalSkillZavorthControlCanaryMode;
    scale: ZavorthUniversalSkillScaleHardeningSnapshot;
    selectedBatch: ZavorthUniversalSkillScaleBatch | null;
    approvalId: string | null;
  }): ZavorthUniversalSkillApprovedZavorthControlCanarySnapshot['canary'] {
    const receiptId = `intent-model0-${this.now().toISOString().replace(/[^0-9]/g, '').slice(0, 14)}-${stableHash(`${input.mode}|${input.selectedBatch?.id || 'none'}`)}`;
    const baseCommands = buildCanaryCommands(input.selectedBatch, input.approvalId);
    const blockedReason = input.scale.status === 'blocked'
      ? 'Scale hardening blocked; canary cannot proceed.'
      : !input.selectedBatch && input.mode !== 'zavorthControl-only'
        ? 'No batch available para canary.'
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

    if (input.mode === 'zavorthControl-only') {
      return canary({
        mode: input.mode,
        status: 'zavorthControl-ready',
        selectedBatch: input.selectedBatch,
        approvalId: input.approvalId,
        receiptId,
        reason: 'ZavorthControl view model approved and ready for endpoint consumption.',
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
        reason: 'Canary dry-run prepared; no skill was executed.',
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
        reason: 'Live canary requires an explicit approvalId before preparing live execution.',
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
      reason: 'Live canary prepared with approvalId; real execution remains outside this preparation.',
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

  private persistSnapshot(reportPath: string, snapshot: ZavorthUniversalSkillApprovedZavorthControlCanarySnapshot): void {
    this.mkdirSyncImpl(path.dirname(reportPath), { recursive: true });
    this.writeFileSyncImpl(reportPath, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
  }

  private resolveScaleService(projectRoot: string): Pick<UniversalSkillScaleHardeningService, 'buildSnapshot' | 'formatSnapshotText'> {
    return this.scaleService || new UniversalSkillScaleHardeningService({ projectRoot });
  }
}

function buildCards(
  scale: ZavorthUniversalSkillScaleHardeningSnapshot,
  operationalStatus: ZavorthUniversalSkillApprovedZavorthControlCanaryStatus,
): ZavorthUniversalSkillZavorthControlCard[] {
  const blockedGates = scale.gates.filter((gate) => gate.status === 'blocked').length;
  const attentionGates = scale.gates.filter((gate) => gate.status === 'attention').length;
  return [
    card('operational-status', 'Status operational', operationalStatus, toneForStatus(operationalStatus), 'Status consolidado do canary approved para operar zavorthControl/canary.'),
    card('scale-status', 'Scale/hardening', scale.status, toneForStatus(scale.status), 'Raw scale hardening status kept as evidence for scale and coverage.'),
    card('sources', 'Fontes em QA', scale.capacity.includedSourceCount, 'neutral', 'Fontes reais incluidas na certificaction.'),
    card('candidates', 'Candidates', scale.capacity.candidateCount, 'neutral', 'Candidates evaluated by the intake/QA chain.'),
    card('batches', 'Batches', scale.capacity.batchCount, scale.capacity.batchCount > 0 ? 'success' : 'warning', 'Batches/canary com approval required.'),
    card('regression', 'Regressions', scale.onboarding.regression.findings.length, scale.onboarding.regression.findings.length > 0 ? 'warning' : 'success', 'Aggregated findings from onboarding/regression.'),
    card('gates', 'Gates com attention', blockedGates + attentionGates, blockedGates > 0 ? 'danger' : attentionGates > 0 ? 'warning' : 'success', 'Gates blocked/attention de scale hardening.'),
  ];
}

function buildTableRows(scale: ZavorthUniversalSkillScaleHardeningSnapshot): ZavorthUniversalSkillZavorthControlTableRow[] {
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

function buildFilters(scale: ZavorthUniversalSkillScaleHardeningSnapshot): ZavorthUniversalSkillZavorthControlFilter[] {
  return [
    {
      id: 'source',
      label: 'source',
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
  canary: ZavorthUniversalSkillApprovedZavorthControlCanarySnapshot['canary'],
  scale: ZavorthUniversalSkillScaleHardeningSnapshot,
): ZavorthUniversalSkillZavorthControlAction[] {
  return [
    action({
      id: 'refresh',
      label: 'Atualizar escala',
      command: 'npm run zavorth:universal-skill-approved-zavorthControl-canary -- --discover',
      apiPath: '/api/skills/scale-hardening',
      enabled: true,
      requiresApproval: false,
      reason: 'Contract update does not execute skills.',
    }),
    action({
      id: 'dry-run-canary',
      label: 'Preparar dry-run canary',
      command: canary.commands.dryRun || 'npm run zavorth:universal-skill-approved-zavorthControl-canary -- --canary dry-run',
      apiPath: '/api/skills/scale-hardening...canary=dry-run',
      enabled: scale.status !== 'blocked' && Boolean(canary.selectedBatch),
      requiresApproval: false,
      reason: 'Dry-run prepares envelope and does not execute upstream.',
    }),
    action({
      id: 'request-live-approval',
      label: 'Solicitar approval live',
      command: canary.commands.requestApproval || '/approvals request skill-canary',
      apiPath: '/api/skills/scale-hardening...canary=live',
      enabled: scale.status !== 'blocked' && Boolean(canary.selectedBatch),
      requiresApproval: true,
      reason: 'Live canary requires approvalId before any preparation.',
    }),
  ];
}

function buildCanaryCommands(
  selectedBatch: ZavorthUniversalSkillScaleBatch | null,
  approvalId: string | null,
): ZavorthUniversalSkillApprovedZavorthControlCanarySnapshot['canary']['commands'] {
  if (!selectedBatch) {
    return {
      dryRun: null,
      live: null,
      requestApproval: '/approvals request skill-canary',
    };
  }
  return {
    dryRun: `npm run zavorth:universal-skill-approved-zavorthControl-canary -- --canary dry-run --batch ${selectedBatch.id}`,
    live: approvalId ? `npm run zavorth:universal-skill-approved-zavorthControl-canary -- --canary live --batch ${selectedBatch.id} --approval-id ${approvalId}`
      : null,
    requestApproval: `/approvals request skill-canary ${selectedBatch.id}`,
  };
}

function buildRollout(
  status: ZavorthUniversalSkillApprovedZavorthControlCanaryStatus,
  canary: ZavorthUniversalSkillApprovedZavorthControlCanarySnapshot['canary'],
  pendingItemIds: string[],
): ZavorthUniversalSkillApprovedZavorthControlCanarySnapshot['rollout'] {
  if (status === 'blocked') {
    return {
      readyForZavorthControlUse: false,
      readyForLiveCanary: false,
      nextActions: [
        'Resolver gates blocked before renderizar canary operational.',
        'Rerun the approved zavorthControl-only canary after the correction.',
      ],
    };
  }

  if (canary.status === 'approval-required') {
    return {
      readyForZavorthControlUse: pendingItemIds.length === 0,
      readyForLiveCanary: false,
      nextActions: [
        'Emitir approvalId do dono para preparar live canary.',
        'Reexecutar com --canary live --approval-id <id>.',
      ],
    };
  }

  return {
    readyForZavorthControlUse: pendingItemIds.length === 0,
    readyForLiveCanary: canary.status === 'live-prepared',
    nextActions: canary.status === 'live-prepared'
      ? [
          'review live-prepared receipt before any real executor.',
          'Monitorar o primeiro batch before ampliar canary.',
        ]
      : [
          'Abrir endpoint /api/skills/scale-hardening no zavorthControl autenticado.',
          'run dry-run do primeiro batch before solicitar live approval.',
        ],
  };
}

function resolveApprovedItemIds(
  scale: ZavorthUniversalSkillScaleHardeningSnapshot,
  approvedZavorthControlItemIds: string[] | null | undefined,
): string[] {
  const allIds = scale.zavorthControlReview.items.map((item: ZavorthUniversalSkillZavorthControlReviewItem) => item.id);
  if (!approvedZavorthControlItemIds || approvedZavorthControlItemIds.length === 0 || approvedZavorthControlItemIds.includes('all')) {
    return allIds;
  }
  return unique(approvedZavorthControlItemIds).filter((id) => allIds.includes(id));
}

function resolveStatus(input: {
  scale: ZavorthUniversalSkillScaleHardeningSnapshot;
  pendingItemIds: string[];
  canary: ZavorthUniversalSkillApprovedZavorthControlCanarySnapshot['canary'];
}): ZavorthUniversalSkillApprovedZavorthControlCanaryStatus {
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
  canary: ZavorthUniversalSkillApprovedZavorthControlCanarySnapshot['canary'],
): boolean {
  if (scale.status !== 'attention') {
    return false;
  }
  if (!['zavorthControl-ready', 'dry-run-ready', 'live-prepared'].includes(canary.status)) {
    return false;
  }
  if (scale.gates.some((gate) => gate.status === 'blocked')) {
    return false;
  }
  const attentionGates = scale.gates.filter((gate) => gate.status === 'attention');
  if (attentionGates.some((gate) => gate.id !== 'zavorthControl-controls-onboarding')) {
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
  const normalizedReason = reason.toLowerCase();
  const hasCoverageReason = ['too many files', 'max files', 'entry limit', 'zip-entry-limit'].some((entry) => normalizedReason.includes(entry));
  const hasCoverageIssue = input.issueCodes.includes('zip-entry-limit');
  const allowedIssueCodes = new Set(['unsupported-file', 'zip-entry-limit']);
  const hasOnlyCoverageIssues = input.issueCodes.every((code) => allowedIssueCodes.has(code));
  return hasOnlyCoverageIssues && (hasCoverageReason || hasCoverageIssue);
}

function canary(input: {
  mode: ZavorthUniversalSkillZavorthControlCanaryMode;
  status: ZavorthUniversalSkillZavorthControlCanaryStatus;
  selectedBatch: ZavorthUniversalSkillScaleBatch | null;
  approvalId: string | null;
  receiptId: string;
  reason: string;
  commands: ZavorthUniversalSkillApprovedZavorthControlCanarySnapshot['canary']['commands'];
  dryRunPrepared?: boolean;
  livePrepared?: boolean;
}): ZavorthUniversalSkillApprovedZavorthControlCanarySnapshot['canary'] {
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
  tone: ZavorthUniversalSkillZavorthControlCard['tone'],
  evidence: string,
): ZavorthUniversalSkillZavorthControlCard {
  return { id, label, value, tone, evidence };
}

function action(input: ZavorthUniversalSkillZavorthControlAction): ZavorthUniversalSkillZavorthControlAction {
  return input;
}

function toneForStatus(status: ZavorthUniversalSkillApprovedZavorthControlCanaryStatus): ZavorthUniversalSkillZavorthControlCard['tone'] {
  if (status === 'blocked') {
    return 'danger';
  }
  if (status === 'attention') {
    return 'warning';
  }
  return 'success';
}

function normalizeCanaryMode(value: ZavorthUniversalSkillZavorthControlCanaryMode | null | undefined): ZavorthUniversalSkillZavorthControlCanaryMode {
  return value === 'dry-run' || value === 'live' || value === 'zavorthControl-only' ? value : 'zavorthControl-only';
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
