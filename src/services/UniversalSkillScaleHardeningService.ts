import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';
import {
  ZAVORTH_UNIVERSAL_SKILL_SCALE_HARDENING_CONTRACT_VERSION,
  type ZavorthUniversalSkillDashboardReviewItem,
  type ZavorthUniversalSkillScaleBand,
  type ZavorthUniversalSkillScaleBatch,
  type ZavorthUniversalSkillScaleGate,
  type ZavorthUniversalSkillScaleHardeningSnapshot,
  type ZavorthUniversalSkillScaleHardeningStatus,
  type ZavorthUniversalSkillZavorthControlReviewItem,
} from '../contracts/ZavorthUniversalSkillScaleHardeningContract.js';
import {
  UniversalSkillRealSourceOnboardingService,
  type UniversalSkillRealSourceOnboardingInput,
} from './UniversalSkillRealSourceOnboardingService.js';
import type { ZavorthUniversalSkillRealSourceOnboardingSnapshot } from '../contracts/ZavorthUniversalSkillRealSourceOnboardingContract.js';

type Runtime = {
  now?: () => Date;
  projectRoot?: string;
  onboardingService?: Pick<UniversalSkillRealSourceOnboardingService, 'buildSnapshot' | 'formatSnapshotText'>;
  mkdirSync?: typeof fs.mkdirSync;
  writeFileSync?: typeof fs.writeFileSync;
};

export type UniversalSkillScaleHardeningInput = UniversalSkillRealSourceOnboardingInput & {
  batchSize?: number;
  largeLibraryThreshold?: number;
  massiveLibraryThreshold?: number;
  persistScaleReport?: boolean;
  scaleReportPath?: string | null;
};

const DEFAULT_BATCH_SIZE = 25;
const DEFAULT_LARGE_LIBRARY_THRESHOLD = 100;
const DEFAULT_MASSIVE_LIBRARY_THRESHOLD = 500;

export class UniversalSkillScaleHardeningService {
  private readonly now: () => Date;
  private readonly defaultProjectRoot: string;
  private readonly onboardingService: Pick<UniversalSkillRealSourceOnboardingService, 'buildSnapshot' | 'formatSnapshotText'> | null;
  private readonly mkdirSyncImpl: typeof fs.mkdirSync;
  private readonly writeFileSyncImpl: typeof fs.writeFileSync;

  constructor(runtime: Runtime = {}) {
    this.now = runtime.now || (() => new Date());
    this.defaultProjectRoot = runtime.projectRoot || config.projectRoot;
    this.onboardingService = runtime.onboardingService || null;
    this.mkdirSyncImpl = runtime.mkdirSync || fs.mkdirSync.bind(fs);
    this.writeFileSyncImpl = runtime.writeFileSync || fs.writeFileSync.bind(fs);
  }

  public async buildSnapshot(
    input: UniversalSkillScaleHardeningInput = {},
  ): Promise<ZavorthUniversalSkillScaleHardeningSnapshot> {
    const projectRoot = path.resolve(input.projectRoot || this.defaultProjectRoot);
    const channel = normalizeChannel(input.channel);
    const batchSize = normalizePositiveInteger(input.batchSize, DEFAULT_BATCH_SIZE);
    const largeLibraryThreshold = normalizePositiveInteger(input.largeLibraryThreshold, DEFAULT_LARGE_LIBRARY_THRESHOLD);
    const massiveLibraryThreshold = normalizePositiveInteger(input.massiveLibraryThreshold, DEFAULT_MASSIVE_LIBRARY_THRESHOLD);
    const onboarding = await this.resolveOnboardingService(projectRoot).buildSnapshot({
      ...input,
      projectRoot,
      channel,
    });
    const batches = this.buildBatches({ onboarding, batchSize });
    const capacity = {
      scaleBand: resolveScaleBand({
        candidateCount: onboarding.qa.expansion.summary.candidates,
        largeLibraryThreshold,
        massiveLibraryThreshold,
      }),
      candidateCount: onboarding.qa.expansion.summary.candidates,
      includedSourceCount: onboarding.sources.summary.includedInQa,
      batchSize,
      batchCount: batches.length,
      largeLibraryThreshold,
      massiveLibraryThreshold,
    };
    const zavorthControlReview: ZavorthUniversalSkillScaleHardeningSnapshot['zavorthControlReview'] = {
      contractOnly: true,
      approvedVisualChangesApplied: false,
      layoutMutationPerformed: false,
      items: this.buildZavorthControlReviewItems({ onboarding, batches, capacity }),
      recommendedDataEndpoint: '/api/skills/scale-hardening' as const,
    };
    const dashboardReview: ZavorthUniversalSkillScaleHardeningSnapshot['dashboardReview'] = {
      ...zavorthControlReview,
      items: zavorthControlReview.items,
    };
    const gates = this.buildGates({ onboarding, batches, capacity, zavorthControlItems: zavorthControlReview.items });
    const status = resolveStatus(onboarding.status, gates);
    const reportPath = path.resolve(input.scaleReportPath || path.join(
      projectRoot,
      '.zavorth',
      'reports',
      'universal-skill-scale-hardening.json',
    ));
    const shouldPersistReport = input.persistScaleReport !== false;
    let snapshot = this.composeSnapshot({
      projectRoot,
      channel,
      onboarding,
      capacity,
      gates,
      batches,
      dashboardReview,
      zavorthControlReview,
      status,
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

  public formatSnapshotText(snapshot: ZavorthUniversalSkillScaleHardeningSnapshot): string {
    const lines = [
      'Universal Skill Scale Hardening - Certification matrix',
      '',
      `Status: ${snapshot.status}`,
      `Escala: ${snapshot.capacity.scaleBand} | candidates=${snapshot.capacity.candidateCount} | batches=${snapshot.capacity.batchCount} | batchSize=${snapshot.capacity.batchSize}`,
      `Fontes em QA: ${snapshot.capacity.includedSourceCount} | onboarding=${snapshot.onboarding.status} | QA=${snapshot.onboarding.qa.status}`,
      `ZavorthControl review: contract-only=${snapshot.zavorthControlReview.contractOnly} | visual-applied=${snapshot.zavorthControlReview.approvedVisualChangesApplied}`,
      `Report: ${snapshot.report.persisted ? snapshot.report.path : 'nao persistido'}`,
      '',
      'Gates:',
    ];

    for (const gate of snapshot.gates) {
      lines.push(`- ${gate.status} ${gate.label}: ${gate.summary}`);
    }

    lines.push('', 'Batches:');
    if (snapshot.batches.length === 0) {
      lines.push('- Nenhum batch recomendado.');
    } else {
      for (const batch of snapshot.batches.slice(0, 12)) {
        lines.push(`- ${batch.id}: ${batch.sourceLabel} candidates=${batch.candidateEstimate} mode=${batch.recommendedMode}`);
      }
      if (snapshot.batches.length > 12) {
        lines.push(`- ... ${snapshot.batches.length - 12} batch(es) adicionais.`);
      }
    }

    lines.push('', 'ZavorthControl review items:');
    for (const item of snapshot.zavorthControlReview.items) {
      lines.push(`- ${item.priority} ${item.label}: ${item.status} | approval=${item.ownerApprovalRequired}`);
    }

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
    onboarding: ZavorthUniversalSkillRealSourceOnboardingSnapshot;
    capacity: ZavorthUniversalSkillScaleHardeningSnapshot['capacity'];
    gates: ZavorthUniversalSkillScaleGate[];
    batches: ZavorthUniversalSkillScaleBatch[];
    dashboardReview: ZavorthUniversalSkillScaleHardeningSnapshot['dashboardReview'];
    zavorthControlReview: ZavorthUniversalSkillScaleHardeningSnapshot['zavorthControlReview'];
    status: ZavorthUniversalSkillScaleHardeningStatus;
    reportPersisted: boolean;
    reportPath: string | null;
  }): ZavorthUniversalSkillScaleHardeningSnapshot {
    return {
      generatedAt: this.now().toISOString(),
      contractVersion: ZAVORTH_UNIVERSAL_SKILL_SCALE_HARDENING_CONTRACT_VERSION,
      status: input.status,
      projectRoot: input.projectRoot,
      channel: input.channel,
      onboarding: input.onboarding,
      capacity: input.capacity,
      gates: input.gates,
      batches: input.batches,
      dashboardReview: input.dashboardReview,
      zavorthControlReview: input.zavorthControlReview,
      rollout: this.buildRollout({ status: input.status, onboarding: input.onboarding, capacity: input.capacity }),
      report: {
        persisted: input.reportPersisted,
        path: input.reportPath,
        rawSecretsSerialized: false,
      },
      policy: {
        dashboardControlsOnboardingIsAuthority: true,
        zavorthControlControlsOnboardingIsAuthority: true,
        previewFirstForLargeLibraries: true,
        batchApplyRequiresExplicitAllowlist: true,
        canaryBeforeBulkApply: true,
        dashboardReviewDoesNotChangeVisuals: true,
        zavorthControlReviewDoesNotChangeVisuals: true,
        noVisualChangeWithoutOwnerApproval: true,
        noExecutionPerformed: true,
        noDirectUpstreamRuntimeUse: true,
        noRawSecretsSerialized: true,
      },
      commands: {
        run: 'npm run zavorth:universal-skill-scale-hardening -- --discover',
        runJson: 'npm run zavorth:universal-skill-scale-hardening:json -- --discover',
        check: 'npm run zavorth:universal-skill-scale-hardening:check --silent',
        nextStage: 'Intent model0 - Approved ZavorthControl Implementation and Live Scale Canary',
      },
    };
  }

  private buildBatches(input: {
    onboarding: ZavorthUniversalSkillRealSourceOnboardingSnapshot;
    batchSize: number;
  }): ZavorthUniversalSkillScaleBatch[] {
    const batches: ZavorthUniversalSkillScaleBatch[] = [];
    for (const row of input.onboarding.qa.matrix) {
      const candidateCount = row.candidates;
      if (candidateCount <= 0) {
        continue;
      }
      const totalBatchesForSource = Math.ceil(candidateCount / input.batchSize);
      for (let index = 0; index < totalBatchesForSource; index += 1) {
        const candidateStart = index * input.batchSize + 1;
        const candidateEnd = Math.min((index + 1) * input.batchSize, candidateCount);
        const candidateEstimate = candidateEnd - candidateStart + 1;
        batches.push({
          id: `${slug(row.sourceLabel)}-${index + 1}-of-${totalBatchesForSource}`,
          sourceLabel: row.sourceLabel,
          sourcePath: row.sourcePath,
          batchIndex: index + 1,
          totalBatchesForSource,
          candidateStart,
          candidateEnd,
          candidateEstimate,
          recommendedMode: input.onboarding.status === 'blocked'
            ? 'hold'
            : input.onboarding.qa.expansion.apply
              ? 'limited-apply'
              : 'preview',
          approvalRequired: true,
        });
      }
    }
    return batches;
  }

  private buildGates(input: {
    onboarding: ZavorthUniversalSkillRealSourceOnboardingSnapshot;
    batches: ZavorthUniversalSkillScaleBatch[];
    capacity: ZavorthUniversalSkillScaleHardeningSnapshot['capacity'];
    zavorthControlItems: ZavorthUniversalSkillZavorthControlReviewItem[];
  }): ZavorthUniversalSkillScaleGate[] {
    const candidates = input.capacity.candidateCount;
    const maxCandidates = input.onboarding.qa.expansion.certification.scaleLimits.maxCandidates;
    const hasCriticalRegression = input.onboarding.regression.findings.some((finding) => finding.severity === 'critical');
    const hasWarningRegression = input.onboarding.regression.findings.some((finding) => finding.severity === 'warning');
    return [
      gate({
        id: 'zavorthControl-controls-onboarding',
        label: 'Etapa 8 como autoridade',
        status: input.onboarding.status === 'blocked' ? 'blocked' : input.onboarding.status,
        observed: input.onboarding.status,
        target: 'Etapa 8 nao pode estar blocked',
        summary: `Onboarding real retornou ${input.onboarding.status}.`,
      }),
      gate({
        id: 'source-coverage',
        label: 'Cobertura de fontes reais',
        status: input.capacity.includedSourceCount > 0 ? 'passed' : 'blocked',
        observed: input.capacity.includedSourceCount,
        target: 'pelo menos uma fonte real incluida no QA',
        summary: `${input.capacity.includedSourceCount} fonte(s) incluidas no QA.`,
      }),
      gate({
        id: 'candidate-scale-limit',
        label: 'Limite de escala respeitado',
        status: candidates > maxCandidates
          ? 'blocked'
          : candidates >= Math.floor(maxCandidates * 0.8)
            ? 'attention'
            : 'passed',
        observed: candidates,
        target: `<= ${maxCandidates} candidatos por execucao`,
        summary: `${candidates}/${maxCandidates} candidato(s) avaliados.`,
      }),
      gate({
        id: 'batch-plan',
        label: 'Plano de batch/canary',
        status: input.batches.length > 0 ? 'passed' : 'attention',
        observed: input.batches.length,
        target: 'batches devem existir antes de apply em escala',
        summary: `${input.batches.length} batch(es) com approval obrigatorio.`,
      }),
      gate({
        id: 'regression-health',
        label: 'Saude de regressao',
        status: hasCriticalRegression ? 'blocked' : hasWarningRegression ? 'attention' : 'passed',
        observed: input.onboarding.regression.findings.length,
        target: '0 findings criticos antes de canary',
        summary: `${input.onboarding.regression.findings.length} finding(s) de regressao.`,
      }),
      gate({
        id: 'zavorthControl-review-contract',
        label: 'Contrato para ZavorthControl',
        status: input.zavorthControlItems.length >= 5 ? 'passed' : 'attention',
        observed: input.zavorthControlItems.length,
        target: 'itens suficientes para card, tabela, filtros, alertas e acoes',
        summary: `${input.zavorthControlItems.length} item(ns) preparados para review visual futuro.`,
      }),
      gate({
        id: 'no-visual-mutation',
        label: 'Sem alteracao visual sem aprovacao',
        status: 'passed',
        observed: true,
        target: 'nenhuma mudanca de layout/CSS nesta etapa',
        summary: 'Etapa 9 produz contrato e evidencia, nao altera layout do ZavorthControl.',
      }),
      gate({
        id: 'no-execution',
        label: 'Sem execucao upstream',
        status: input.onboarding.policy.noExecutionPerformed ? 'passed' : 'blocked',
        observed: input.onboarding.policy.noExecutionPerformed,
        target: 'sempre true',
        summary: 'Hardening de escala nao executa runtime upstream.',
      }),
    ];
  }

  private buildZavorthControlReviewItems(input: {
    onboarding: ZavorthUniversalSkillRealSourceOnboardingSnapshot;
    batches: ZavorthUniversalSkillScaleBatch[];
    capacity: ZavorthUniversalSkillScaleHardeningSnapshot['capacity'];
  }): ZavorthUniversalSkillZavorthControlReviewItem[] {
    const status = input.onboarding.status;
    return [
      dashboardItem({
        id: 'source-summary-card',
        label: 'Card denso de fontes',
        surface: 'summary-card',
        priority: 'high',
        status,
        evidence: `${input.capacity.includedSourceCount} fonte(s), ${input.capacity.candidateCount} candidato(s), ${input.capacity.scaleBand}.`,
      }),
      dashboardItem({
        id: 'regression-alert',
        label: 'Alerta de regressao',
        surface: 'alert',
        priority: 'high',
        status: input.onboarding.regression.findings.some((finding) => finding.severity === 'critical')
          ? 'blocked'
          : input.onboarding.regression.findings.length > 0
            ? 'attention'
            : 'passed',
        evidence: `${input.onboarding.regression.findings.length} finding(s) de regressao.`,
      }),
      dashboardItem({
        id: 'batch-table',
        label: 'Tabela de batches/canary',
        surface: 'table',
        priority: 'high',
        status: input.batches.length > 0 ? 'passed' : 'attention',
        evidence: `${input.batches.length} batch(es) planejados com approval obrigatorio.`,
      }),
      dashboardItem({
        id: 'source-filter',
        label: 'Filtros por fonte e status',
        surface: 'filter',
        priority: 'medium',
        status: 'passed',
        evidence: 'Dados de sourceLabel, preset, status e includedInQa existem no contrato.',
      }),
      dashboardItem({
        id: 'approval-action-row',
        label: 'Acoes de apply limitado',
        surface: 'action-row',
        priority: 'high',
        status: input.onboarding.status === 'blocked' ? 'blocked' : 'passed',
        evidence: 'Acoes recomendadas continuam atras de --apply, --allow-source e allowlist.',
      }),
      dashboardItem({
        id: 'empty-state',
        label: 'Estado vazio operacional',
        surface: 'empty-state',
        priority: 'medium',
        status: input.capacity.includedSourceCount > 0 ? 'passed' : 'attention',
        evidence: input.capacity.includedSourceCount > 0
          ? 'Ha fonte real para renderizar.'
          : 'Contrato informa ausencia de fontes para orientar proximo passo.',
      }),
    ];
  }

  private buildRollout(input: {
    status: ZavorthUniversalSkillScaleHardeningStatus;
    onboarding: ZavorthUniversalSkillRealSourceOnboardingSnapshot;
    capacity: ZavorthUniversalSkillScaleHardeningSnapshot['capacity'];
  }): ZavorthUniversalSkillScaleHardeningSnapshot['rollout'] {
    if (input.status === 'blocked') {
      return {
        readyForLargeLibraryUse: false,
        recommendedMode: 'hold',
        nextActions: [
          'Resolver gates blocked antes de qualquer apply em escala.',
          'Rodar novamente a Etapa 9 em preview para atualizar batches e ZavorthControl review.',
        ],
      };
    }
    if (input.onboarding.qa.expansion.apply) {
      return {
        readyForLargeLibraryUse: true,
        recommendedMode: 'canary-apply',
        nextActions: [
          'Validar primeiro batch importado via dry-run antes de ampliar.',
          'Exigir approval por batch para qualquer live activation.',
        ],
      };
    }
    return {
      readyForLargeLibraryUse: true,
      recommendedMode: input.capacity.scaleBand === 'large' || input.capacity.scaleBand === 'massive'
        ? 'limited-apply'
        : 'preview',
      nextActions: [
        'Revisar os batches planejados e escolher um canary pequeno.',
        'Solicitar aprovacao visual antes de implementar os itens de ZavorthControl review.',
      ],
    };
  }

  private persistSnapshot(reportPath: string, snapshot: ZavorthUniversalSkillScaleHardeningSnapshot): void {
    this.mkdirSyncImpl(path.dirname(reportPath), { recursive: true });
    this.writeFileSyncImpl(reportPath, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
  }

  private resolveOnboardingService(projectRoot: string): Pick<UniversalSkillRealSourceOnboardingService, 'buildSnapshot' | 'formatSnapshotText'> {
    return this.onboardingService || new UniversalSkillRealSourceOnboardingService({ projectRoot });
  }
}

function gate(input: {
  id: string;
  label: string;
  status: ZavorthUniversalSkillScaleHardeningStatus;
  observed: number | string | boolean;
  target: string;
  summary: string;
}): ZavorthUniversalSkillScaleGate {
  return {
    ...input,
    severity: input.status === 'blocked' ? 'critical' : input.status === 'attention' ? 'warning' : 'info',
  };
}

function dashboardItem(input: Omit<ZavorthUniversalSkillDashboardReviewItem, 'visualChangeProposed' | 'ownerApprovalRequired'>): ZavorthUniversalSkillDashboardReviewItem {
  return {
    ...input,
    visualChangeProposed: true,
    ownerApprovalRequired: true,
  };
}

function resolveStatus(
  onboardingStatus: ZavorthUniversalSkillScaleHardeningStatus,
  gates: ZavorthUniversalSkillScaleGate[],
): ZavorthUniversalSkillScaleHardeningStatus {
  if (onboardingStatus === 'blocked' || gates.some((gateEntry) => gateEntry.status === 'blocked')) {
    return 'blocked';
  }
  if (onboardingStatus === 'attention' || gates.some((gateEntry) => gateEntry.status === 'attention')) {
    return 'attention';
  }
  return 'passed';
}

function resolveScaleBand(input: {
  candidateCount: number;
  largeLibraryThreshold: number;
  massiveLibraryThreshold: number;
}): ZavorthUniversalSkillScaleBand {
  if (input.candidateCount <= 0) {
    return 'empty';
  }
  if (input.candidateCount >= input.massiveLibraryThreshold) {
    return 'massive';
  }
  if (input.candidateCount >= input.largeLibraryThreshold) {
    return 'large';
  }
  if (input.candidateCount >= Math.max(10, Math.floor(input.largeLibraryThreshold / 2))) {
    return 'medium';
  }
  return 'small';
}

function normalizeChannel(value: string | null | undefined): string {
  return String(value || 'cli').trim().toLowerCase().replace(/[^a-z0-9_.:-]+/g, '-') || 'cli';
}

function normalizePositiveInteger(value: number | undefined, fallback: number): number {
  return Number.isFinite(value) && Number(value) > 0 ? Math.floor(Number(value)) : fallback;
}

function slug(value: string): string {
  return String(value || 'source')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48) || 'source';
}
