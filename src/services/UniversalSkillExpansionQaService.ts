import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';
import {
  ZAVORTH_UNIVERSAL_SKILL_EXPANSION_QA_CONTRACT_VERSION,
  type ZavorthUniversalSkillExpansionQaMatrixRow,
  type ZavorthUniversalSkillExpansionQaMetric,
  type ZavorthUniversalSkillExpansionQaRolloutStage,
  type ZavorthUniversalSkillExpansionQaSeverity,
  type ZavorthUniversalSkillExpansionQaSnapshot,
  type ZavorthUniversalSkillExpansionQaStatus,
} from '../contracts/ZavorthUniversalSkillExpansionQaContract.js';
import {
  UniversalSkillExpansionService,
  type UniversalSkillExpansionInput,
} from './UniversalSkillExpansionService.js';
import type { ZavorthUniversalSkillExpansionSnapshot } from '../contracts/ZavorthUniversalSkillExpansionContract.js';

type Runtime = {
  now?: () => Date;
  projectRoot?: string;
  expansionService?: Pick<UniversalSkillExpansionService, 'buildSnapshot'>;
  mkdirSync?: typeof fs.mkdirSync;
  writeFileSync?: typeof fs.writeFileSync;
};

export type UniversalSkillExpansionQaInput = UniversalSkillExpansionInput & {
  persistReport?: boolean;
  reportPath?: string | null;
};

export class UniversalSkillExpansionQaService {
  private readonly now: () => Date;
  private readonly defaultProjectRoot: string;
  private readonly expansionService: Pick<UniversalSkillExpansionService, 'buildSnapshot'> | null;
  private readonly mkdirSyncImpl: typeof fs.mkdirSync;
  private readonly writeFileSyncImpl: typeof fs.writeFileSync;

  constructor(runtime: Runtime = {}) {
    this.now = runtime.now || (() => new Date());
    this.defaultProjectRoot = runtime.projectRoot || config.projectRoot;
    this.expansionService = runtime.expansionService || null;
    this.mkdirSyncImpl = runtime.mkdirSync || fs.mkdirSync.bind(fs);
    this.writeFileSyncImpl = runtime.writeFileSync || fs.writeFileSync.bind(fs);
  }

  public async buildSnapshot(input: UniversalSkillExpansionQaInput): Promise<ZavorthUniversalSkillExpansionQaSnapshot> {
    const projectRoot = path.resolve(input.projectRoot || this.defaultProjectRoot);
    const channel = normalizeChannel(input.channel);
    const expansion = await this.resolveExpansionService(projectRoot).buildSnapshot({
      ...input,
      projectRoot,
      channel,
    });
    const matrix = this.buildMatrix(expansion);
    const metrics = this.buildMetrics(expansion, matrix);
    const gates = this.buildGates(expansion, false);
    const status = this.resolveStatus({ expansion, matrix, gates });
    const rollout = this.buildRollout({ expansion, matrix, status });
    const reportPath = path.resolve(input.reportPath || path.join(projectRoot, '.zavorth', 'reports', 'universal-skill-expansion-qa.json'));
    const shouldPersist = input.persistReport !== false;
    let snapshot = this.composeSnapshot({
      projectRoot,
      channel,
      expansion,
      matrix,
      metrics,
      rollout,
      status,
      reportPersisted: false,
      reportPath: shouldPersist ? reportPath : null,
    });

    if (shouldPersist) {
      this.persistSnapshot(reportPath, snapshot);
      snapshot = {
        ...snapshot,
        report: {
          persisted: true,
          path: reportPath,
          rawSecretsSerialized: false,
        },
        certification: {
          ...snapshot.certification,
          gates: {
            ...snapshot.certification.gates,
            reportPersisted: true,
          },
          reasons: this.buildCertificationReasons(expansion, matrix, {
            ...snapshot.certification.gates,
            reportPersisted: true,
          }),
        },
      };
      this.persistSnapshot(reportPath, snapshot);
    }

    return snapshot;
  }

  public formatSnapshotText(snapshot: ZavorthUniversalSkillExpansionQaSnapshot): string {
    const lines = [
      'Universal Skill Expansion QA - Surface controls',
      '',
      `Status: ${snapshot.status}`,
      `Recommended mode: ${snapshot.rollout.recommendedMode}`,
      `Sources: ${snapshot.expansion.summary.sources} | candidates: ${snapshot.expansion.summary.candidates} | imported: ${snapshot.expansion.summary.materialized}`,
      `Bridge ready: ${snapshot.expansion.summary.bridgeReady} | blocked: ${snapshot.expansion.summary.blockedCandidates} | denied: ${snapshot.expansion.summary.denied}`,
      `Report: ${snapshot.report.persisted ? snapshot.report.path : 'not persisted'}`,
      '',
      'Matrix:',
    ];

    for (const row of snapshot.matrix) {
      lines.push(
        `- ${row.sourceLabel}: ${row.status} | preset=${row.presetId} | candidates=${row.candidates} | imported=${row.materialized} | blocked=${row.blockedCandidates} | bridge=${row.bridgeReady}`,
      );
    }

    lines.push('', 'Rollout:');
    for (const phase of snapshot.rollout.phases) {
      lines.push(`- ${phase.label}: ${phase.status} | ${phase.summary}`);
    }

    lines.push('', 'Next actions:');
    for (const action of snapshot.rollout.nextActions) {
      lines.push(`- ${action}`);
    }

    lines.push('', `Next: ${snapshot.commands.nextStage}`);
    return lines.join('\n');
  }

  private composeSnapshot(input: {
    projectRoot: string;
    channel: string;
    expansion: ZavorthUniversalSkillExpansionSnapshot;
    matrix: ZavorthUniversalSkillExpansionQaMatrixRow[];
    metrics: ZavorthUniversalSkillExpansionQaMetric[];
    rollout: ZavorthUniversalSkillExpansionQaSnapshot['rollout'];
    status: ZavorthUniversalSkillExpansionQaStatus;
    reportPersisted: boolean;
    reportPath: string | null;
  }): ZavorthUniversalSkillExpansionQaSnapshot {
    const gates = this.buildGates(input.expansion, input.reportPersisted);
    return {
      generatedAt: this.now().toISOString(),
      contractVersion: ZAVORTH_UNIVERSAL_SKILL_EXPANSION_QA_CONTRACT_VERSION,
      status: input.status,
      projectRoot: input.projectRoot,
      channel: input.channel,
      expansion: input.expansion,
      matrix: input.matrix,
      metrics: input.metrics,
      rollout: input.rollout,
      certification: {
        passed: input.status !== 'blocked',
        label: input.status,
        reasons: this.buildCertificationReasons(input.expansion, input.matrix, gates),
        gates,
      },
      report: {
        persisted: input.reportPersisted,
        path: input.reportPath,
        rawSecretsSerialized: false,
      },
      policy: {
        qaDoesNotImportOutsideExpansionService: true,
        qaDoesNotExecuteSkills: true,
        qaUsesExpansionSnapshotAsEvidence: true,
        telemetryIsAggregateOnly: true,
        reportContainsNoRawSecrets: true,
        rolloutRequiresDryRunBeforeLive: true,
      },
      commands: {
        run: 'npm run zavorth:universal-skill-expansion-qa -- --source <path>',
        runJson: 'npm run zavorth:universal-skill-expansion-qa:json -- --source <path>',
        check: 'npm run zavorth:universal-skill-expansion-qa:check --silent',
        nextStage: 'ZavorthControl controls - Real Source Onboarding and Continuous Regression',
      },
    };
  }

  private buildMatrix(expansion: ZavorthUniversalSkillExpansionSnapshot): ZavorthUniversalSkillExpansionQaMatrixRow[] {
    return expansion.sourceResults.map((result) => {
      const candidates = result.importSnapshot.summary.candidates;
      const denied = result.importSnapshot.summary.denied;
      const blockedCandidates = result.blockedCandidateNames.length;
      const materialized = result.importSnapshot.summary.materialized;
      const bridgeReady = result.readyForBridgeNames.length;
      return {
        sourceLabel: result.sourceLabel,
        sourcePath: result.sourcePath,
        presetId: result.preset.id,
        status: result.status,
        candidates,
        allowed: result.importSnapshot.summary.allowed,
        denied,
        blockedCandidates,
        materialized,
        bridgeReady,
        receipts: result.importSnapshot.summary.receipts,
        severity: resolveRowSeverity({ denied, blockedCandidates, status: result.status }),
      };
    });
  }

  private buildMetrics(
    expansion: ZavorthUniversalSkillExpansionSnapshot,
    matrix: ZavorthUniversalSkillExpansionQaMatrixRow[],
  ): ZavorthUniversalSkillExpansionQaMetric[] {
    const candidates = Math.max(1, expansion.summary.candidates);
    const materialized = Math.max(1, expansion.summary.materialized);
    return [
      metric('sources', 'Evaluated sources', expansion.summary.sources, 'count', 'info', 'greater than zero when sources exist'),
      metric('candidates', 'Candidates found', expansion.summary.candidates, 'count', 'info', 'complete source inventory'),
      metric('blocked-candidate-ratio', 'Blocked candidate ratio', roundRatio(expansion.summary.blockedCandidates / candidates), 'ratio', expansion.summary.blockedCandidates > 0 ? 'warning' : 'info', '0 for clean sources; blocks must be explicit'),
      metric('materialization-rate', 'Materialization rate', roundRatio(expansion.summary.materialized / candidates), 'ratio', expansion.apply ? 'info' : 'warning', 'greater than 0 only after approved apply'),
      metric('bridge-ready-rate', 'Bridge-ready rate', roundRatio(expansion.summary.bridgeReady / materialized), 'ratio', expansion.summary.materialized > 0 && expansion.summary.bridgeReady === 0 ? 'critical' : 'info', 'imported skills should appear in the bridge'),
      metric('reportable-sources', 'Matrix rows', matrix.length, 'count', 'info', 'one row per source'),
      metric('no-execution', 'No upstream execution', expansion.summary.executionPerformed === false, 'boolean', expansion.summary.executionPerformed === false ? 'info' : 'critical', 'always false'),
      metric('no-direct-upstream-runtime', 'No direct upstream runtime use', expansion.summary.directUpstreamRuntimeUse === false, 'boolean', expansion.summary.directUpstreamRuntimeUse === false ? 'info' : 'critical', 'always false'),
    ];
  }

  private buildRollout(input: {
    expansion: ZavorthUniversalSkillExpansionSnapshot;
    matrix: ZavorthUniversalSkillExpansionQaMatrixRow[];
    status: ZavorthUniversalSkillExpansionQaStatus;
  }): ZavorthUniversalSkillExpansionQaSnapshot['rollout'] {
    const expansion = input.expansion;
    const phases: ZavorthUniversalSkillExpansionQaRolloutStage[] = [
      {
        id: 'preview',
        label: 'Source Preview',
        status: expansion.summary.sources > 0 ? 'passed' : 'blocked',
        summary: `${expansion.summary.sources} source(s), ${expansion.summary.candidates} candidate(s).`,
        nextAction: expansion.summary.sources > 0 ? 'Review matrix and allowlists.' : 'Add at least one source.',
      },
      {
        id: 'import',
        label: 'Governed Import',
        status: !expansion.apply
          ? 'waiting'
          : expansion.status === 'passed'
            ? 'passed'
            : expansion.status === 'partial'
              ? 'attention'
              : 'blocked',
        summary: expansion.apply
          ? `${expansion.summary.materialized} imported, ${expansion.summary.denied} denied.`
          : 'Waiting for explicit apply.',
        nextAction: expansion.apply
          ? 'Review denied entries and generated provenance.'
          : 'Run limited apply with an explicit allowlist.',
      },
      {
        id: 'bridge-dry-run',
        label: 'Bridge dry-run',
        status: expansion.summary.bridgeReady > 0
          ? 'passed'
          : expansion.apply
            ? 'blocked'
            : 'waiting',
        summary: `${expansion.summary.bridgeReady} skill(s) ready for dry-run.`,
        nextAction: expansion.summary.bridgeReady > 0
          ? '/skills run <skill>'
          : 'Import at least one allowed skill before dry-run.',
      },
      {
        id: 'live-controlled',
        label: 'Controlled Live',
        status: expansion.summary.bridgeApprovalRequired > 0 ? 'waiting' : 'attention',
        summary: `${expansion.summary.bridgeApprovalRequired} skill(s) require approval before live mode.`,
        nextAction: '/skills live <skill> --approval-id <approval-id>',
      },
      {
        id: 'monitoring',
        label: 'Monitoring',
        status: input.status === 'blocked' ? 'blocked' : 'passed',
        summary: 'Aggregated QA report available for regression.',
        nextAction: 'Add the Stage 7 check to workspace:check.',
      },
    ];
    const recommendedMode = input.status === 'blocked'
      ? 'hold'
      : !expansion.apply
        ? 'limited-apply'
        : expansion.summary.bridgeReady > 0
          ? 'dry-run-rollout'
          : 'preview-only';

    return {
      readyForOperatorUse: input.status !== 'blocked',
      recommendedMode,
      phases,
      nextActions: this.buildNextActions(expansion, input.status),
    };
  }

  private buildNextActions(
    expansion: ZavorthUniversalSkillExpansionSnapshot,
    status: ZavorthUniversalSkillExpansionQaStatus,
  ): string[] {
    if (status === 'blocked') {
      return [
        'Fix blocked gates before importing new sources.',
        'Reduce sources/candidates or review hostile candidates.',
      ];
    }
    if (!expansion.apply) {
      return [
        'Review the preview matrix.',
        'Run limited apply with --allow-source and --skills <approved names>.',
      ];
    }
    const actions = [
      'Run dry-run for ready skills with /skills run <skill>.',
      'Keep live mode behind explicit approval.',
    ];
    if (expansion.summary.denied > 0 || expansion.summary.blockedCandidates > 0) {
      actions.push('Review denied candidates before repeating allow-all.');
    }
    return actions;
  }

  private buildGates(
    expansion: ZavorthUniversalSkillExpansionSnapshot,
    reportPersisted: boolean,
  ): ZavorthUniversalSkillExpansionQaSnapshot['certification']['gates'] {
    return {
      noExecution: expansion.summary.executionPerformed === false,
      noDirectUpstreamRuntimeUse: expansion.summary.directUpstreamRuntimeUse === false,
      previewFirst: expansion.policy.previewFirstForEverySource === true,
      denyByDefault: expansion.policy.denyByDefault === true,
      hostileBlocked: expansion.sourceResults.every((result) =>
        result.blockedCandidateNames.every((name) => result.importedSkillNames.includes(name) === false)),
      bridgeRegistryAvailable: Boolean(expansion.bridgeRegistry && expansion.bridgeRegistry.policy?.bridgeRuntimeIsAuthority === true),
      reportPersisted,
    };
  }

  private buildCertificationReasons(
    expansion: ZavorthUniversalSkillExpansionSnapshot,
    matrix: ZavorthUniversalSkillExpansionQaMatrixRow[],
    gates: ZavorthUniversalSkillExpansionQaSnapshot['certification']['gates'],
  ): string[] {
    const reasons = [
      'QA used the expansion snapshot as evidence without executing skills directly.',
      `${matrix.length} source(s) covered by the operational matrix.`,
      `Metrics: ${expansion.summary.candidates} candidate(s), ${expansion.summary.materialized} imported, ${expansion.summary.bridgeReady} ready for bridge.`,
    ];
    if (expansion.summary.blockedCandidates > 0) {
      reasons.push(`${expansion.summary.blockedCandidates} hostile candidate(s) remained outside the import.`);
    }
    if (expansion.status === 'blocked') {
      reasons.push('Expansion status blocked: gates require review before rollout.');
    }
    if (!gates.reportPersisted) {
      reasons.push('Report was not persisted in this call.');
    }
    if (!Object.values(gates).every(Boolean)) {
      reasons.push('One or more gates require review before broad rollout.');
    }
    return reasons;
  }

  private resolveStatus(input: {
    expansion: ZavorthUniversalSkillExpansionSnapshot;
    matrix: ZavorthUniversalSkillExpansionQaMatrixRow[];
    gates: ZavorthUniversalSkillExpansionQaSnapshot['certification']['gates'];
  }): ZavorthUniversalSkillExpansionQaStatus {
    const hardGatePassed = input.gates.noExecution
      && input.gates.noDirectUpstreamRuntimeUse
      && input.gates.previewFirst
      && input.gates.denyByDefault
      && input.gates.hostileBlocked
      && input.gates.bridgeRegistryAvailable;
    if (!hardGatePassed || input.expansion.status === 'blocked') {
      return 'blocked';
    }
    if (
      input.expansion.status === 'partial'
      || input.expansion.summary.denied > 0
      || input.expansion.summary.blockedCandidates > 0
      || input.matrix.some((row) => row.severity !== 'info')
    ) {
      return 'attention';
    }
    return 'passed';
  }

  private persistSnapshot(reportPath: string, snapshot: ZavorthUniversalSkillExpansionQaSnapshot): void {
    this.mkdirSyncImpl(path.dirname(reportPath), { recursive: true });
    this.writeFileSyncImpl(reportPath, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
  }

  private resolveExpansionService(projectRoot: string): Pick<UniversalSkillExpansionService, 'buildSnapshot'> {
    return this.expansionService || new UniversalSkillExpansionService({ projectRoot });
  }
}

function resolveRowSeverity(input: {
  denied: number;
  blockedCandidates: number;
  status: string;
}): ZavorthUniversalSkillExpansionQaSeverity {
  if (input.status === 'blocked') {
    return 'critical';
  }
  if (input.denied > 0 || input.blockedCandidates > 0 || input.status === 'partial') {
    return 'warning';
  }
  return 'info';
}

function metric(
  id: string,
  label: string,
  value: number | string | boolean,
  unit: ZavorthUniversalSkillExpansionQaMetric['unit'],
  severity: ZavorthUniversalSkillExpansionQaSeverity,
  target: string,
): ZavorthUniversalSkillExpansionQaMetric {
  return { id, label, value, unit, severity, target };
}

function roundRatio(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function normalizeChannel(value: string | null | undefined): string {
  return String(value || 'cli').trim().toLowerCase().replace(/[^a-z0-9_.:-]+/g, '-') || 'cli';
}
