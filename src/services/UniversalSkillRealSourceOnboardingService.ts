import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';
import {
  ZAVORTH_UNIVERSAL_SKILL_REAL_SOURCE_ONBOARDING_CONTRACT_VERSION,
  type ZavorthUniversalSkillRealSourceCandidate,
  type ZavorthUniversalSkillRealSourceHistoryEntry,
  type ZavorthUniversalSkillRealSourceOnboardingSnapshot,
  type ZavorthUniversalSkillRealSourceOnboardingSourceOrigin,
  type ZavorthUniversalSkillRealSourceOnboardingStatus,
  type ZavorthUniversalSkillRealSourceRegressionFinding,
} from '../contracts/ZavorthUniversalSkillRealSourceOnboardingContract.js';
import type {
  ZavorthUniversalSkillExpansionPresetId,
  ZavorthUniversalSkillExpansionSourceInput,
} from '../contracts/ZavorthUniversalSkillExpansionContract.js';
import {
  UniversalSkillExpansionQaService,
  type UniversalSkillExpansionQaInput,
} from './UniversalSkillExpansionQaService.js';
import type { ZavorthUniversalSkillExpansionQaSnapshot } from '../contracts/ZavorthUniversalSkillExpansionQaContract.js';

type Runtime = {
  now?: () => Date;
  projectRoot?: string;
  qaService?: Pick<UniversalSkillExpansionQaService, 'buildSnapshot' | 'formatSnapshotText'>;
  existsSync?: typeof fs.existsSync;
  readFileSync?: typeof fs.readFileSync;
  writeFileSync?: typeof fs.writeFileSync;
  mkdirSync?: typeof fs.mkdirSync;
};

export type UniversalSkillRealSourceOnboardingInput = Omit<UniversalSkillExpansionQaInput, 'sources'> & {
  sources?: ZavorthUniversalSkillExpansionSourceInput[];
  discover?: boolean;
  historyPath?: string | null;
  persistHistory?: boolean;
  maxHistoryEntries?: number;
};

type HistoryFile = {
  contractVersion: typeof ZAVORTH_UNIVERSAL_SKILL_REAL_SOURCE_ONBOARDING_CONTRACT_VERSION;
  updatedAt: string;
  entries: ZavorthUniversalSkillRealSourceHistoryEntry[];
};

const DEFAULT_MAX_HISTORY_ENTRIES = 30;

export class UniversalSkillRealSourceOnboardingService {
  private readonly now: () => Date;
  private readonly defaultProjectRoot: string;
  private readonly qaService: Pick<UniversalSkillExpansionQaService, 'buildSnapshot' | 'formatSnapshotText'> | null;
  private readonly existsSyncImpl: typeof fs.existsSync;
  private readonly readFileSyncImpl: typeof fs.readFileSync;
  private readonly writeFileSyncImpl: typeof fs.writeFileSync;
  private readonly mkdirSyncImpl: typeof fs.mkdirSync;

  constructor(runtime: Runtime = {}) {
    this.now = runtime.now || (() => new Date());
    this.defaultProjectRoot = runtime.projectRoot || config.projectRoot;
    this.qaService = runtime.qaService || null;
    this.existsSyncImpl = runtime.existsSync || fs.existsSync.bind(fs);
    this.readFileSyncImpl = runtime.readFileSync || fs.readFileSync.bind(fs);
    this.writeFileSyncImpl = runtime.writeFileSync || fs.writeFileSync.bind(fs);
    this.mkdirSyncImpl = runtime.mkdirSync || fs.mkdirSync.bind(fs);
  }

  public async buildSnapshot(
    input: UniversalSkillRealSourceOnboardingInput = {},
  ): Promise<ZavorthUniversalSkillRealSourceOnboardingSnapshot> {
    const generatedAt = this.now().toISOString();
    const projectRoot = path.resolve(input.projectRoot || this.defaultProjectRoot);
    const channel = normalizeChannel(input.channel);
    const discover = input.discover !== false;
    const historyPath = path.resolve(input.historyPath || path.join(
      projectRoot,
      '.zavorth',
      'reports',
      'universal-skill-real-source-onboarding-history.json',
    ));
    const maxHistoryEntries = normalizePositiveInteger(input.maxHistoryEntries, DEFAULT_MAX_HISTORY_ENTRIES);
    const sourceCandidates = this.discoverSources({
      projectRoot,
      discover,
      sources: input.sources || [],
    });
    const includedSources = sourceCandidates
      .filter((candidate) => candidate.includedInQa)
      .map((candidate) => ({
        sourcePath: candidate.sourcePath,
        sourceKind: candidate.sourceKind,
        sourceLabel: candidate.label,
        presetId: candidate.presetId,
        allowSource: input.allowSource,
        allowAllCandidates: input.allowAllCandidates,
        allowedSkillNames: input.allowedSkillNames,
        allowedSkillIds: input.allowedSkillIds,
      }));
    const qa = await this.resolveQaService(projectRoot).buildSnapshot({
      ...input,
      sources: includedSources,
      projectRoot,
      channel,
    });
    const previousEntries = this.readHistory(historyPath);
    const previousEntry = previousEntries.at(-1) || null;
    const findings = this.buildFindings({
      previousEntry,
      qa,
      sourceCandidates,
    });
    const status = this.resolveStatus(qa, findings);
    const currentEntry = this.buildHistoryEntry({
      generatedAt,
      runId: buildRunId(generatedAt, projectRoot, includedSources),
      status,
      qa,
      sourceCandidates,
    });
    const entries = [...previousEntries, currentEntry].slice(-maxHistoryEntries);
    const shouldPersistHistory = input.persistHistory !== false;

    if (shouldPersistHistory) {
      this.persistHistory(historyPath, {
        contractVersion: ZAVORTH_UNIVERSAL_SKILL_REAL_SOURCE_ONBOARDING_CONTRACT_VERSION,
        updatedAt: generatedAt,
        entries,
      });
    }

    return {
      generatedAt,
      contractVersion: ZAVORTH_UNIVERSAL_SKILL_REAL_SOURCE_ONBOARDING_CONTRACT_VERSION,
      status,
      runId: currentEntry.runId,
      projectRoot,
      channel,
      mode: input.apply === true ? 'apply-requested' : 'preview-only',
      sources: {
        discoverWorkspaceSources: discover,
        environmentVariable: 'ZAVORTH_SKILL_SOURCE_PATHS',
        summary: {
          candidates: sourceCandidates.length,
          selected: sourceCandidates.filter((candidate) => candidate.selected).length,
          includedInQa: sourceCandidates.filter((candidate) => candidate.includedInQa).length,
          missingSelected: sourceCandidates.filter((candidate) => candidate.selected && !candidate.exists).length,
        },
        candidates: sourceCandidates,
      },
      qa,
      history: {
        persisted: shouldPersistHistory,
        path: shouldPersistHistory ? historyPath : null,
        maxEntries: maxHistoryEntries,
        previousEntry,
        currentEntry,
        entries,
      },
      regression: {
        status,
        baselineAvailable: previousEntry !== null,
        findings,
      },
      rollout: this.buildRollout({ status, qa, findings, sourceCandidates }),
      policy: {
        defaultPreviewOnly: true,
        realSourcesRequireExplicitApply: true,
        sourceDiscoveryIsWorkspaceBounded: true,
        environmentSourcesAreOperatorDeclared: true,
        regressionDoesNotImportOutsideQa: true,
        historyContainsAggregateOnly: true,
        noExecutionPerformed: true,
        noDirectUpstreamRuntimeUse: true,
        noRawSecretsSerialized: true,
      },
      commands: {
        run: 'npm run zavorth:universal-skill-real-source-onboarding -- --discover',
        runJson: 'npm run zavorth:universal-skill-real-source-onboarding:json -- --discover',
        check: 'npm run zavorth:universal-skill-real-source-onboarding:check --silent',
        nextStage: 'Certification matrix - Real Library Scale Hardening and ZavorthControl Review',
      },
    };
  }

  public formatSnapshotText(snapshot: ZavorthUniversalSkillRealSourceOnboardingSnapshot): string {
    const lines = [
      'Universal Skill Real Source Onboarding - ZavorthControl controls',
      '',
      `Status: ${snapshot.status}`,
      `Modo: ${snapshot.mode} | Canal: ${snapshot.channel}`,
      `Fontes: ${snapshot.sources.summary.includedInQa}/${snapshot.sources.summary.candidates} em QA | missing=${snapshot.sources.summary.missingSelected}`,
      `QA: ${snapshot.qa.status} | candidates=${snapshot.qa.expansion.summary.candidates} | imported=${snapshot.qa.expansion.summary.materialized} | bridge=${snapshot.qa.expansion.summary.bridgeReady}`,
      `History: ${snapshot.history.persisted ? snapshot.history.path : 'nao persistido'} | baseline=${snapshot.regression.baselineAvailable}`,
      '',
      'Fontes avaliadas:',
    ];

    for (const candidate of snapshot.sources.candidates) {
      lines.push(
        `- ${candidate.label}: selected=${candidate.selected} included=${candidate.includedInQa} exists=${candidate.exists} preset=${candidate.presetId}`,
        `  ${candidate.sourcePath}`,
        `  reason=${candidate.reason}`,
      );
    }

    lines.push('', 'Regressao:');
    if (snapshot.regression.findings.length === 0) {
      lines.push('- Nenhuma regressao detectada.');
    } else {
      for (const finding of snapshot.regression.findings) {
        lines.push(`- ${finding.severity} ${finding.metric}: ${finding.summary}`);
      }
    }

    lines.push('', 'Proximas acoes:');
    for (const action of snapshot.rollout.nextActions) {
      lines.push(`- ${action}`);
    }

    lines.push('', `Next: ${snapshot.commands.nextStage}`);
    return lines.join('\n');
  }

  private discoverSources(input: {
    projectRoot: string;
    discover: boolean;
    sources: ZavorthUniversalSkillExpansionSourceInput[];
  }): ZavorthUniversalSkillRealSourceCandidate[] {
    const candidates: ZavorthUniversalSkillRealSourceCandidate[] = [];

    for (const source of input.sources) {
      candidates.push(this.toCandidate({
        origin: 'explicit',
        source,
        selected: true,
        reason: 'Fonte informada explicitamente pelo operador.',
      }));
    }

    for (const source of readEnvironmentSources()) {
      candidates.push(this.toCandidate({
        origin: 'environment',
        source,
        selected: true,
        reason: 'Fonte declarada em ZAVORTH_SKILL_SOURCE_PATHS.',
      }));
    }

    if (input.discover) {
      for (const source of workspaceDiscoverySources(input.projectRoot)) {
        candidates.push(this.toCandidate({
          origin: 'workspace-discovery',
          source,
          selected: true,
          reason: 'Fonte descoberta em raiz local conhecida do workspace.',
        }));
      }
    }

    return dedupeByPath(candidates).map((candidate) => {
      const selected = candidate.origin === 'workspace-discovery'
        ? candidate.exists
        : candidate.selected;
      const includedInQa = selected && candidate.exists;
      const reason = selected && !candidate.exists
        ? `${candidate.reason} Caminho ausente; nao incluido no QA.`
        : !selected && !candidate.exists && candidate.origin === 'workspace-discovery'
          ? `${candidate.reason} Caminho ausente; mantido como candidato, nao selecionado.`
          : candidate.reason;

      return {
        ...candidate,
        selected,
        includedInQa,
        reason,
      };
    });
  }

  private toCandidate(input: {
    origin: ZavorthUniversalSkillRealSourceOnboardingSourceOrigin;
    source: ZavorthUniversalSkillExpansionSourceInput;
    selected: boolean;
    reason: string;
  }): ZavorthUniversalSkillRealSourceCandidate {
    const sourcePath = path.resolve(String(input.source.sourcePath || '').trim() || '.');
    const presetId = input.source.presetId || inferPresetFromPath(sourcePath);
    const sourceKind = input.source.sourceKind || inferKindFromPath(sourcePath);
    const exists = this.existsSyncImpl(sourcePath);
    const label = input.source.sourceLabel || buildSourceLabel(sourcePath, presetId);

    return {
      id: stableSourceCandidateId(sourcePath, input.origin),
      label,
      sourcePath,
      sourceKind,
      presetId,
      origin: input.origin,
      exists,
      selected: input.selected,
      includedInQa: input.selected && exists,
      reason: input.reason,
    };
  }

  private buildFindings(input: {
    previousEntry: ZavorthUniversalSkillRealSourceHistoryEntry | null;
    qa: ZavorthUniversalSkillExpansionQaSnapshot;
    sourceCandidates: ZavorthUniversalSkillRealSourceCandidate[];
  }): ZavorthUniversalSkillRealSourceRegressionFinding[] {
    const findings: ZavorthUniversalSkillRealSourceRegressionFinding[] = [];
    const selected = input.sourceCandidates.filter((candidate) => candidate.selected);
    const missing = selected.filter((candidate) => !candidate.exists);
    const included = selected.filter((candidate) => candidate.includedInQa);

    if (missing.length > 0) {
      findings.push(finding(
        'missing-selected-source',
        'critical',
        'source-exists',
        true,
        false,
        `${missing.length} fonte(s) selecionada(s) nao existem no host.`,
      ));
    }

    if (included.length === 0) {
      findings.push(finding(
        'no-included-source',
        'warning',
        'included-source-count',
        null,
        0,
        'Nenhuma fonte real entrou no QA; onboarding fica em modo de espera.',
      ));
    }

    if (input.qa.status === 'blocked') {
      findings.push(finding(
        'qa-blocked',
        'critical',
        'qa-status',
        null,
        input.qa.status,
        'QA da expansao bloqueou o rollout desta execucao.',
      ));
    }

    if (!input.previousEntry) {
      return findings;
    }

    const current = this.buildHistoryEntry({
      generatedAt: input.qa.generatedAt,
      runId: 'current-preview',
      status: input.qa.status,
      qa: input.qa,
      sourceCandidates: input.sourceCandidates,
    });

    if (statusRank(current.status) < statusRank(input.previousEntry.status)) {
      findings.push(finding(
        'status-regression',
        current.status === 'blocked' ? 'critical' : 'warning',
        'status',
        input.previousEntry.status,
        current.status,
        `Status piorou de ${input.previousEntry.status} para ${current.status}.`,
      ));
    }
    if (current.candidates < input.previousEntry.candidates) {
      findings.push(finding(
        'candidate-count-drop',
        'warning',
        'candidates',
        input.previousEntry.candidates,
        current.candidates,
        'Quantidade de candidatos caiu em relacao ao ultimo baseline.',
      ));
    }
    if (current.materialized < input.previousEntry.materialized) {
      findings.push(finding(
        'materialized-drop',
        'warning',
        'materialized',
        input.previousEntry.materialized,
        current.materialized,
        'Quantidade de skills materializadas caiu em relacao ao ultimo baseline.',
      ));
    }
    if (current.bridgeReady < input.previousEntry.bridgeReady) {
      findings.push(finding(
        'bridge-ready-drop',
        'warning',
        'bridgeReady',
        input.previousEntry.bridgeReady,
        current.bridgeReady,
        'Quantidade pronta para bridge caiu em relacao ao ultimo baseline.',
      ));
    }
    if (current.blockedCandidates > input.previousEntry.blockedCandidates) {
      findings.push(finding(
        'blocked-candidates-increase',
        'warning',
        'blockedCandidates',
        input.previousEntry.blockedCandidates,
        current.blockedCandidates,
        'Candidatos bloqueados aumentaram desde o ultimo baseline.',
      ));
    }
    if (current.denied > input.previousEntry.denied) {
      findings.push(finding(
        'denied-increase',
        'warning',
        'denied',
        input.previousEntry.denied,
        current.denied,
        'Decisoes denied aumentaram desde o ultimo baseline.',
      ));
    }

    return findings;
  }

  private buildHistoryEntry(input: {
    generatedAt: string;
    runId: string;
    status: ZavorthUniversalSkillRealSourceOnboardingStatus;
    qa: ZavorthUniversalSkillExpansionQaSnapshot;
    sourceCandidates: ZavorthUniversalSkillRealSourceCandidate[];
  }): ZavorthUniversalSkillRealSourceHistoryEntry {
    return {
      runId: input.runId,
      generatedAt: input.generatedAt,
      status: input.status,
      qaStatus: input.qa.status,
      candidateSourceCount: input.sourceCandidates.length,
      selectedSourceCount: input.sourceCandidates.filter((candidate) => candidate.selected).length,
      includedSourceCount: input.sourceCandidates.filter((candidate) => candidate.includedInQa).length,
      candidates: input.qa.expansion.summary.candidates,
      materialized: input.qa.expansion.summary.materialized,
      bridgeReady: input.qa.expansion.summary.bridgeReady,
      blockedCandidates: input.qa.expansion.summary.blockedCandidates,
      denied: input.qa.expansion.summary.denied,
      recommendedMode: input.qa.rollout.recommendedMode,
    };
  }

  private resolveStatus(
    qa: ZavorthUniversalSkillExpansionQaSnapshot,
    findings: ZavorthUniversalSkillRealSourceRegressionFinding[],
  ): ZavorthUniversalSkillRealSourceOnboardingStatus {
    if (qa.status === 'blocked' || findings.some((findingEntry) => findingEntry.severity === 'critical')) {
      return 'blocked';
    }
    if (qa.status === 'attention' || findings.some((findingEntry) => findingEntry.severity === 'warning')) {
      return 'attention';
    }
    return 'passed';
  }

  private buildRollout(input: {
    status: ZavorthUniversalSkillRealSourceOnboardingStatus;
    qa: ZavorthUniversalSkillExpansionQaSnapshot;
    findings: ZavorthUniversalSkillRealSourceRegressionFinding[];
    sourceCandidates: ZavorthUniversalSkillRealSourceCandidate[];
  }): ZavorthUniversalSkillRealSourceOnboardingSnapshot['rollout'] {
    if (input.status === 'blocked') {
      return {
        readyForContinuousUse: false,
        recommendedCadence: 'hold',
        nextActions: [
          'Corrigir fontes ausentes, gates bloqueados ou regressao critica antes de novo apply.',
          'Rodar novamente em preview ate o status sair de blocked.',
        ],
      };
    }

    const included = input.sourceCandidates.filter((candidate) => candidate.includedInQa).length;
    const nextActions = input.qa.expansion.apply
      ? [
          'Manter a regressao continua ativa depois de cada importacao real.',
          'Executar dry-run das skills novas antes de liberar live.',
        ]
      : [
          'Revisar o preview das fontes reais descobertas.',
          'Aplicar apenas fontes e skills aprovadas com --apply --allow-source --skills <nome>.',
        ];

    if (input.findings.length > 0) {
      nextActions.unshift('Revisar findings de regressao antes de expandir o rollout.');
    }

    return {
      readyForContinuousUse: included > 0,
      recommendedCadence: input.qa.expansion.apply ? 'per-source-change' : 'manual-before-import',
      nextActions,
    };
  }

  private readHistory(historyPath: string): ZavorthUniversalSkillRealSourceHistoryEntry[] {
    if (!this.existsSyncImpl(historyPath)) {
      return [];
    }
    try {
      const parsed = JSON.parse(this.readFileSyncImpl(historyPath, 'utf8')) as Partial<HistoryFile>;
      return Array.isArray(parsed.entries)
        ? parsed.entries.filter(isHistoryEntry)
        : [];
    } catch {
      return [];
    }
  }

  private persistHistory(historyPath: string, history: HistoryFile): void {
    this.mkdirSyncImpl(path.dirname(historyPath), { recursive: true });
    this.writeFileSyncImpl(historyPath, `${JSON.stringify(history, null, 2)}\n`, 'utf8');
  }

  private resolveQaService(projectRoot: string): Pick<UniversalSkillExpansionQaService, 'buildSnapshot' | 'formatSnapshotText'> {
    return this.qaService || new UniversalSkillExpansionQaService({ projectRoot });
  }
}

function workspaceDiscoverySources(projectRoot: string): ZavorthUniversalSkillExpansionSourceInput[] {
  return [
    {
      sourcePath: path.join(projectRoot, 'skill-library'),
      sourceLabel: 'Workspace skill library',
      presetId: 'workspace-skill-library',
      sourceKind: 'directory',
    },
    {
      sourcePath: path.join(projectRoot, 'skill-library', 'imported'),
      sourceLabel: 'Workspace imported skill library',
      presetId: 'workspace-skill-library',
      sourceKind: 'directory',
    },
    {
      sourcePath: path.join(projectRoot, 'skills'),
      sourceLabel: 'Workspace skills folder',
      presetId: 'generic-skill-folder',
      sourceKind: 'directory',
    },
    {
      sourcePath: path.join(projectRoot, '.codex', 'skills'),
      sourceLabel: 'Workspace Codex skill root',
      presetId: 'codex-skill-root',
      sourceKind: 'directory',
    },
    {
      sourcePath: path.join(projectRoot, '.agents', 'skills'),
      sourceLabel: 'Workspace agent skill root',
      presetId: 'agent-skill-root',
      sourceKind: 'directory',
    },
  ];
}

function readEnvironmentSources(): ZavorthUniversalSkillExpansionSourceInput[] {
  return splitList(process.env.ZAVORTH_SKILL_SOURCE_PATHS)
    .map((sourcePath) => ({
      sourcePath,
      presetId: inferPresetFromPath(sourcePath),
      sourceKind: inferKindFromPath(sourcePath),
      sourceLabel: `Env skill source: ${path.basename(sourcePath) || sourcePath}`,
    }));
}

function dedupeByPath(
  candidates: ZavorthUniversalSkillRealSourceCandidate[],
): ZavorthUniversalSkillRealSourceCandidate[] {
  const seen = new Set<string>();
  const deduped: ZavorthUniversalSkillRealSourceCandidate[] = [];
  for (const candidate of candidates) {
    const key = path.resolve(candidate.sourcePath).toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    deduped.push(candidate);
  }
  return deduped;
}

function finding(
  id: string,
  severity: ZavorthUniversalSkillRealSourceRegressionFinding['severity'],
  metric: string,
  previous: ZavorthUniversalSkillRealSourceRegressionFinding['previous'],
  current: ZavorthUniversalSkillRealSourceRegressionFinding['current'],
  summary: string,
): ZavorthUniversalSkillRealSourceRegressionFinding {
  return { id, severity, metric, previous, current, summary };
}

function stableSourceCandidateId(sourcePath: string, origin: string): string {
  return `${origin}:${path.resolve(sourcePath).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;
}

function buildRunId(
  generatedAt: string,
  projectRoot: string,
  sources: ZavorthUniversalSkillExpansionSourceInput[],
): string {
  const sourcePart = sources
    .map((source) => path.resolve(source.sourcePath).toLowerCase())
    .sort()
    .join('|');
  return `zavorth-control-${generatedAt.replace(/[^0-9]/g, '').slice(0, 14)}-${stableHash(`${projectRoot}|${sourcePart}`)}`;
}

function stableHash(value: string): string {
  let hash = 0;
  for (const char of value) {
    hash = ((hash << 5) - hash + char.charCodeAt(0)) | 0;
  }
  return Math.abs(hash).toString(36).slice(0, 8).padStart(4, '0');
}

function buildSourceLabel(sourcePath: string, presetId: ZavorthUniversalSkillExpansionPresetId): string {
  const baseName = path.basename(sourcePath) || sourcePath;
  if (presetId === 'downloaded-skill-archive') {
    return `Downloaded archive: ${baseName}`;
  }
  if (presetId === 'codex-skill-root') {
    return `Codex skill root: ${baseName}`;
  }
  if (presetId === 'agent-skill-root') {
    return `Agent skill root: ${baseName}`;
  }
  if (presetId === 'workspace-skill-library') {
    return `Workspace skill library: ${baseName}`;
  }
  return `Skill source: ${baseName}`;
}

function inferPresetFromPath(sourcePath: string): ZavorthUniversalSkillExpansionPresetId {
  const normalized = sourcePath.toLowerCase();
  if (normalized.endsWith('.zip')) {
    return 'downloaded-skill-archive';
  }
  if (normalized.includes('.codex') || normalized.includes('codex')) {
    return 'codex-skill-root';
  }
  if (normalized.includes('.agents') || normalized.includes('agent')) {
    return 'agent-skill-root';
  }
  if (normalized.includes('skill-library')) {
    return 'workspace-skill-library';
  }
  return 'generic-skill-folder';
}

function inferKindFromPath(sourcePath: string): 'auto' | 'directory' | 'zip' {
  return sourcePath.toLowerCase().endsWith('.zip') ? 'zip' : 'directory';
}

function statusRank(status: ZavorthUniversalSkillRealSourceOnboardingStatus): number {
  if (status === 'passed') {
    return 3;
  }
  if (status === 'attention') {
    return 2;
  }
  return 1;
}

function normalizeChannel(value: string | null | undefined): string {
  return String(value || 'cli').trim().toLowerCase().replace(/[^a-z0-9_.:-]+/g, '-') || 'cli';
}

function normalizePositiveInteger(value: number | undefined, fallback: number): number {
  return Number.isFinite(value) && Number(value) > 0 ? Math.floor(Number(value)) : fallback;
}

function splitList(value: string | undefined): string[] {
  return String(value || '')
    .split(/[;,]/g)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function isHistoryEntry(value: unknown): value is ZavorthUniversalSkillRealSourceHistoryEntry {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const entry = value as Partial<ZavorthUniversalSkillRealSourceHistoryEntry>;
  return typeof entry.runId === 'string'
    && typeof entry.generatedAt === 'string'
    && (entry.status === 'passed' || entry.status === 'attention' || entry.status === 'blocked')
    && typeof entry.candidates === 'number'
    && typeof entry.materialized === 'number'
    && typeof entry.bridgeReady === 'number';
}
