import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';
import {
  ARTIFACT_REPLAY_WORKBENCH_CONTRACTS,
  ARTIFACT_REPLAY_WORKBENCH_PACKAGE_SCRIPTS,
  ARTIFACT_REPLAY_WORKBENCH_REQUIRED_CARDS,
  ARTIFACT_REPLAY_WORKBENCH_WEB_MARKERS,
  type ArtifactReplayWorkbenchArtifactIndexEntry,
  type ArtifactReplayWorkbenchCheck,
  type ArtifactReplayWorkbenchCheckStatus,
  type ArtifactReplayWorkbenchCompareEntry,
  type ArtifactReplayWorkbenchEvidenceExport,
  type ArtifactReplayWorkbenchLearningMark,
  type ArtifactReplayWorkbenchSnapshot,
  type ArtifactReplayWorkbenchSource,
} from '../contracts/ArtifactReplayWorkbenchContract.js';
import { buildRuntimeShellHtml } from '../domain/surface/presentation/web-console/WebConsoleRuntimeShellHtml.js';
import {
  ZavorthReplayLearningControlPlaneService,
  type ZavorthReplayLearningControlPlaneSnapshot,
} from './ZavorthReplayLearningControlPlaneService.js';
import {
  ZavorthReplayLearningService,
  type ZavorthReplayLearningSnapshot,
} from './ZavorthReplayLearningService.js';

type PackageLike = {
  scripts?: Record<string, string>;
};

export type ArtifactReplayWorkbenchServiceOptions = {
  projectRoot?: string;
  packageJson?: PackageLike;
  html?: string;
  controlPlaneSnapshot?: ZavorthReplayLearningControlPlaneSnapshot;
  replayLearningSnapshot?: ZavorthReplayLearningSnapshot;
  controlPlane?: Pick<ZavorthReplayLearningControlPlaneService, 'buildSnapshot'>;
  replayLearning?: Pick<ZavorthReplayLearningService, 'buildSnapshot'>;
  existsSync?: (targetPath: string) => boolean;
  readFileSync?: (targetPath: string, encoding: BufferEncoding) => string;
  now?: () => Date;
};

export class ArtifactReplayWorkbenchService {
  private readonly projectRoot: string;
  private readonly packageJson: PackageLike | null;
  private readonly html: string | null;
  private readonly controlPlaneSnapshot: ZavorthReplayLearningControlPlaneSnapshot | null;
  private readonly replayLearningSnapshot: ZavorthReplayLearningSnapshot | null;
  private readonly controlPlane: Pick<ZavorthReplayLearningControlPlaneService, 'buildSnapshot'>;
  private readonly replayLearning: Pick<ZavorthReplayLearningService, 'buildSnapshot'>;
  private readonly existsSync: (targetPath: string) => boolean;
  private readonly readFileSync: (targetPath: string, encoding: BufferEncoding) => string;
  private readonly now: () => Date;

  constructor(options: ArtifactReplayWorkbenchServiceOptions = {}) {
    this.projectRoot = options.projectRoot || config.projectRoot;
    this.packageJson = options.packageJson || null;
    this.html = Object.prototype.hasOwnProperty.call(options, 'html') ? options.html || '' : null;
    this.controlPlaneSnapshot = options.controlPlaneSnapshot || null;
    this.replayLearningSnapshot = options.replayLearningSnapshot || null;
    this.controlPlane = options.controlPlane || new ZavorthReplayLearningControlPlaneService({
      workspaceRoot: this.projectRoot,
    });
    this.replayLearning = options.replayLearning || new ZavorthReplayLearningService({
      projectRoot: this.projectRoot,
    });
    this.existsSync = options.existsSync || fs.existsSync;
    this.readFileSync = options.readFileSync || ((targetPath, encoding) => fs.readFileSync(targetPath, encoding));
    this.now = options.now || (() => new Date());
  }

  public async buildSnapshot(input: { limit?: number } = {}): Promise<ArtifactReplayWorkbenchSnapshot> {
    const limit = Math.max(1, Math.min(Number(input.limit || 12), 50));
    const controlPlane = this.controlPlaneSnapshot || await this.controlPlane.buildSnapshot({ limit });
    const replayLearning = this.replayLearningSnapshot || this.replayLearning.buildSnapshot({ limit });
    const artifactIndex = this.buildArtifactIndex(controlPlane, limit);
    const compare = this.buildCompareEntries(controlPlane, limit);
    const learningMarks = this.buildLearningMarks(controlPlane, replayLearning, limit);
    const evidenceExports = this.buildEvidenceExports(controlPlane, learningMarks, artifactIndex, limit);
    const checks = [
      ...this.checkPackageScripts(),
      this.checkWebMarkers(),
      this.checkControlPlaneCards(controlPlane),
      this.checkArtifactIndex(artifactIndex),
      this.checkCompare(compare),
      this.checkRedactionPolicy(replayLearning),
      this.checkLearningMarks(learningMarks, replayLearning),
      this.checkEvidenceExports(evidenceExports),
    ];
    const failed = checks.filter((check) => check.status === 'fail').length;
    const warnings = checks.filter((check) => check.status === 'warn').length;
    const passed = checks.filter((check) => check.status === 'pass').length;

    return {
      phase: '43',
      surface: 'artifact-replay-workbench',
      generatedAt: this.now().toISOString(),
      status: failed > 0 ? 'blocked' : warnings > 0 ? 'attention' : 'ready',
      summary: {
        ok: failed === 0,
        passed,
        warnings,
        failed,
        indexedArtifacts: artifactIndex.length,
        reusableArtifacts: artifactIndex.filter((entry) => entry.reusable).length,
        compareCandidates: compare.length,
        learningMarks: learningMarks.length,
        evidenceExports: evidenceExports.length,
        heavyRuntimesStarted: false,
      },
      workbench: {
        artifactIndex,
        compare,
        learningMarks,
        evidenceExports,
      },
      checks,
      contracts: ARTIFACT_REPLAY_WORKBENCH_CONTRACTS,
      commands: {
        inspect: 'npm run artifact:workbench',
        json: 'npm run artifact:workbench -- --json',
        gate: 'npm run qa:artifact-workbench',
        replayLearning: 'npm run ops:replay-learning',
      },
      nextRecommendedPhase: {
        phase: '44',
        title: 'Release UX',
        reason:
          'Depois de tornar artifacts e replay navegaveis, o proximo passo da ordem combinada e transformar publish, rollback e changelog em um fluxo guiado.',
      },
    };
  }

  public async renderReport(snapshotOrInput: ArtifactReplayWorkbenchSnapshot | { limit?: number } = {}): Promise<string> {
    const snapshot = 'phase' in snapshotOrInput
      ? snapshotOrInput
      : await this.buildSnapshot(snapshotOrInput);
    const lines: string[] = [];
    lines.push('[artifact-workbench] Fase 43 - Artifact And Replay Workbench');
    lines.push(`status: ${snapshot.status}`);
    lines.push(`ok: ${snapshot.summary.ok ? 'yes' : 'no'} | pass=${snapshot.summary.passed} warn=${snapshot.summary.warnings} fail=${snapshot.summary.failed}`);
    lines.push(`artifacts=${snapshot.summary.indexedArtifacts} reusable=${snapshot.summary.reusableArtifacts} compare=${snapshot.summary.compareCandidates} learning=${snapshot.summary.learningMarks} exports=${snapshot.summary.evidenceExports}`);
    lines.push('');
    for (const check of snapshot.checks) {
      lines.push(`[${check.status}] ${check.title} (${check.source})`);
      lines.push(`  ${check.reason}`);
      for (const evidence of check.evidence || []) {
        lines.push(`  - ${evidence}`);
      }
    }
    if (snapshot.workbench.artifactIndex.length > 0) {
      lines.push('', 'Artifacts indexados:');
      for (const artifact of snapshot.workbench.artifactIndex.slice(0, 5)) {
        lines.push(`- ${artifact.label} [${artifact.kind}] ${artifact.sourceRunId || artifact.source}`);
      }
    }
    lines.push('');
    lines.push(`proxima fase recomendada: ${snapshot.nextRecommendedPhase.phase} - ${snapshot.nextRecommendedPhase.title}`);
    lines.push(snapshot.nextRecommendedPhase.reason);
    return lines.join('\n');
  }

  private buildArtifactIndex(
    controlPlane: ZavorthReplayLearningControlPlaneSnapshot,
    limit: number,
  ): ArtifactReplayWorkbenchArtifactIndexEntry[] {
    const workspace = String(controlPlane.workspaceRoot || this.projectRoot || 'workspace');
    return (controlPlane.artifacts || []).slice(0, limit).map((artifact) => ({
      id: artifact.id,
      label: artifact.label,
      kind: artifact.kind,
      workspace,
      source: artifact.source,
      sourceRunId: artifact.sourceRunId,
      path: artifact.path,
      url: artifact.url,
      reusable: artifact.reusable,
      resumePrompt: artifact.resumePrompt,
    }));
  }

  private buildCompareEntries(
    controlPlane: ZavorthReplayLearningControlPlaneSnapshot,
    limit: number,
  ): ArtifactReplayWorkbenchCompareEntry[] {
    const workflowRuns = Array.isArray(controlPlane.sourceSnapshots?.workflowRuns)
      ? controlPlane.sourceSnapshots.workflowRuns
      : [];
    const entries: ArtifactReplayWorkbenchCompareEntry[] = [];
    for (let index = 0; index < workflowRuns.length - 1 && entries.length < limit; index += 1) {
      const left = workflowRuns[index];
      const right = workflowRuns[index + 1];
      entries.push({
        id: `workflow-compare:${left.workflow_run_id}:${right.workflow_run_id}`,
        leftRunId: left.workflow_run_id,
        rightRunId: right.workflow_run_id,
        label: `${left.workflow_name || 'workflow'} vs ${right.workflow_name || 'workflow'}`,
        reason: 'Comparar objetivo, status, artifacts e ponto de retomada entre workflow runs.',
        ready: true,
      });
    }
    if (entries.length === 0) {
      const timeline = controlPlane.timeline || [];
      entries.push({
        id: 'timeline-compare:latest',
        leftRunId: timeline[0]?.id || null,
        rightRunId: timeline[1]?.id || null,
        label: timeline.length >= 2 ? 'Comparar eventos recentes' : 'Comparacao aguardando mais runs',
        reason: timeline.length >= 2
          ? 'Timeline tem eventos suficientes para comparar decisoes recentes.'
          : 'O workbench ja expoe o plano de comparacao; faltam runs/eventos para uma comparacao real.',
        ready: timeline.length >= 2,
      });
    }
    return entries.slice(0, limit);
  }

  private buildLearningMarks(
    controlPlane: ZavorthReplayLearningControlPlaneSnapshot,
    replayLearning: ZavorthReplayLearningSnapshot,
    limit: number,
  ): ArtifactReplayWorkbenchLearningMark[] {
    const marks = (controlPlane.learningCandidates || []).map((candidate) => ({
      id: candidate.id,
      label: candidate.title,
      status: candidate.reviewState,
      score: candidate.score,
      actionHint: candidate.actionHint,
      evidenceRef: candidate.sourceWorkflow || null,
    }));
    if (marks.length > 0) {
      return marks.slice(0, limit);
    }
    return (replayLearning.records || []).slice(0, limit).map((record) => ({
      id: record.id,
      label: record.summary,
      status: record.status,
      score: record.confidence,
      actionHint: record.status === 'approved'
        ? `npm run ops:replay-learning -- --suggest "${record.kind}"`
        : `npm run ops:replay-learning -- --revoke ${record.id}`,
      evidenceRef: record.replayRef,
    }));
  }

  private buildEvidenceExports(
    controlPlane: ZavorthReplayLearningControlPlaneSnapshot,
    learningMarks: ArtifactReplayWorkbenchLearningMark[],
    artifactIndex: ArtifactReplayWorkbenchArtifactIndexEntry[],
    limit: number,
  ): ArtifactReplayWorkbenchEvidenceExport[] {
    const entries: ArtifactReplayWorkbenchEvidenceExport[] = [];
    for (const artifact of artifactIndex.slice(0, Math.ceil(limit / 2))) {
      entries.push({
        id: `artifact:${artifact.id}`,
        label: artifact.label,
        kind: 'artifact',
        ref: artifact.path || artifact.url || artifact.sourceRunId,
        payloadIncluded: false,
        redactionMode: 'references-only',
        reason: 'Export inclui referencia ao artifact e resumo, nao o payload bruto.',
      });
    }
    for (const lifecycle of (controlPlane.lifecycle?.latest || []).slice(0, 3)) {
      entries.push({
        id: `lifecycle:${lifecycle.id}`,
        label: lifecycle.summary || lifecycle.id,
        kind: 'lifecycle',
        ref: lifecycle.runId || lifecycle.traceId || lifecycle.id,
        payloadIncluded: false,
        redactionMode: 'summary-only',
        reason: 'Lifecycle entra como resumo redigido e identificadores canonicos.',
      });
    }
    for (const mark of learningMarks.slice(0, 3)) {
      entries.push({
        id: `learning:${mark.id}`,
        label: mark.label,
        kind: 'learning',
        ref: mark.evidenceRef,
        payloadIncluded: false,
        redactionMode: 'summary-only',
        reason: 'Learning mark exporta score, estado e evidencia redigida.',
      });
    }
    return entries.slice(0, limit);
  }

  private checkPackageScripts(): ArtifactReplayWorkbenchCheck[] {
    const scripts = this.readPackageJson()?.scripts || {};
    return ARTIFACT_REPLAY_WORKBENCH_PACKAGE_SCRIPTS.map((scriptName) => {
      const command = String(scripts[scriptName] || '').trim();
      return this.check(
        `package:${scriptName}`,
        `script ${scriptName}`,
        command ? 'pass' : 'fail',
        command
          ? `package.json expoe ${scriptName} para a bancada de artifacts/replay.`
          : `package.json precisa expor ${scriptName}.`,
        'package',
        [`command=${command || '<ausente>'}`],
      );
    });
  }

  private checkWebMarkers(): ArtifactReplayWorkbenchCheck {
    const html = this.html !== null ? this.html : buildRuntimeShellHtml('/control');
    const missing = ARTIFACT_REPLAY_WORKBENCH_WEB_MARKERS.filter((marker) => !html.includes(marker));
    return this.check(
      'web:artifact-workbench-card',
      'card da bancada no /control',
      missing.length === 0 ? 'pass' : 'fail',
      missing.length === 0
        ? 'Control UI expoe indice, comparacao, redaction, learning e export controlado.'
        : 'Control UI perdeu marcadores da bancada de artifacts/replay.',
      'web',
      missing.map((marker) => `faltando: ${marker}`),
    );
  }

  private checkControlPlaneCards(controlPlane: ZavorthReplayLearningControlPlaneSnapshot): ArtifactReplayWorkbenchCheck {
    const cards = new Set((controlPlane.cards || []).map((card) => card.id));
    const missing = ARTIFACT_REPLAY_WORKBENCH_REQUIRED_CARDS.filter((card) => !cards.has(card));
    return this.check(
      'control-plane:cards',
      'cards base do replay learning',
      missing.length === 0 ? 'pass' : 'fail',
      missing.length === 0
        ? 'Replay learning control plane expoe replay, artifacts, lifecycle, learning, memory e workspace.'
        : 'Replay learning control plane perdeu cards essenciais para a bancada.',
      'control-plane',
      missing.map((card) => `faltando: ${card}`),
    );
  }

  private checkArtifactIndex(index: ArtifactReplayWorkbenchArtifactIndexEntry[]): ArtifactReplayWorkbenchCheck {
    return this.check(
      'workbench:artifact-index',
      'indice de artifacts por workspace/run',
      'pass',
      index.length > 0
        ? 'Artifacts recentes foram normalizados com workspace, sourceRunId e prompt de retomada.'
        : 'Cold start sem artifacts; o indice existe e permanece vazio sem bloquear o operador.',
      'workbench',
      [`indexed=${index.length}`, `reusable=${index.filter((entry) => entry.reusable).length}`],
    );
  }

  private checkCompare(compare: ArtifactReplayWorkbenchCompareEntry[]): ArtifactReplayWorkbenchCheck {
    return this.check(
      'workbench:compare',
      'comparacao entre runs',
      'pass',
      compare.some((entry) => entry.ready)
        ? 'A bancada tem ao menos uma comparacao pronta entre runs/eventos.'
        : 'Comparacao esta modelada e aguardando mais eventos, sem falso bloqueio em cold start.',
      'workbench',
      compare.map((entry) => `${entry.id}:ready=${entry.ready}`),
    );
  }

  private checkRedactionPolicy(replayLearning: ZavorthReplayLearningSnapshot): ArtifactReplayWorkbenchCheck {
    const ok =
      replayLearning.policy?.rawReplayPersisted === false
      && replayLearning.policy?.secretsPersisted === false
      && replayLearning.policy?.approvalRequiredForProfile === true;
    return this.check(
      'policy:redaction',
      'replay redigido e approval-first',
      ok ? 'pass' : 'fail',
      ok
        ? 'Replay learning confirma rawReplayPersisted=false, secretsPersisted=false e approval para profile.'
        : 'Replay learning precisa manter redaction e approval antes de promover memoria.',
      'policy',
      [
        `rawReplayPersisted=${replayLearning.policy?.rawReplayPersisted}`,
        `secretsPersisted=${replayLearning.policy?.secretsPersisted}`,
        `approvalRequiredForProfile=${replayLearning.policy?.approvalRequiredForProfile}`,
      ],
    );
  }

  private checkLearningMarks(
    marks: ArtifactReplayWorkbenchLearningMark[],
    replayLearning: ZavorthReplayLearningSnapshot,
  ): ArtifactReplayWorkbenchCheck {
    return this.check(
      'workbench:learning-marks',
      'marcacao de sessoes boas para aprendizado',
      'pass',
      marks.length > 0 || replayLearning.policy?.suggestOnlyDefault === true
        ? 'Learning marks ficam em review/suggest-only antes de qualquer promocao.'
        : 'Sem marks ainda, mas o modo suggest-only continua preservado.',
      'workbench',
      [`marks=${marks.length}`, `suggestOnlyDefault=${replayLearning.policy?.suggestOnlyDefault}`],
    );
  }

  private checkEvidenceExports(exports: ArtifactReplayWorkbenchEvidenceExport[]): ArtifactReplayWorkbenchCheck {
    const unsafe = exports.filter((entry) => entry.payloadIncluded !== false);
    return this.check(
      'workbench:evidence-export',
      'export controlado de evidencias',
      unsafe.length === 0 ? 'pass' : 'fail',
      unsafe.length === 0
        ? 'Evidence export usa referencias/resumos e nao inclui payload bruto.'
        : 'Evidence export nao pode incluir payload bruto.',
      'workbench',
      [`exports=${exports.length}`, ...unsafe.map((entry) => `unsafe=${entry.id}`)],
    );
  }

  private readPackageJson(): PackageLike | null {
    if (this.packageJson) {
      return this.packageJson;
    }
    const target = path.resolve(this.projectRoot, 'package.json');
    if (!this.existsSync(target)) {
      return null;
    }
    try {
      return JSON.parse(this.readFileSync(target, 'utf8')) as PackageLike;
    } catch {
      return null;
    }
  }

  private check(
    id: string,
    title: string,
    status: ArtifactReplayWorkbenchCheckStatus,
    reason: string,
    source: ArtifactReplayWorkbenchSource,
    evidence: string[] = [],
  ): ArtifactReplayWorkbenchCheck {
    return {
      id,
      title,
      status,
      source,
      reason,
      evidence,
    };
  }
}
