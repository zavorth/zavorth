import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';
import { ArchitectureRefactorScorecardService, type ArchitectureRefactorSnapshot } from '../observability/ArchitectureRefactorScorecardService.js';

export type ZavorthQaProfile = 'alpha' | 'beta';
export type ZavorthQaCheckStatus = 'healthy' | 'attention' | 'critical' | 'missing';

type QaBenchmarkRunBudget = {
  maxDurationMs: number;
  maxMemoryDeltaBytes?: number;
};

type QaBenchmarkSuiteBudget = {
  label: string;
  required: boolean;
  maxAgeHours: number;
  operations: Record<string, QaBenchmarkRunBudget>;
};

type QaRegressionBudget = {
  label: string;
  required: boolean;
  maxAgeHours: number;
  maxFailures: number;
  requiredTests: string[];
};

type QaSmokeBudget = {
  label: string;
  required: boolean;
  maxAgeHours: number;
  maxFailures: number;
  requiredSteps: string[];
};

type QaBudgetProfile = {
  profile: ZavorthQaProfile;
  benchmarks: Record<string, QaBenchmarkSuiteBudget>;
  regression: Record<string, QaRegressionBudget>;
  smokes: Record<string, QaSmokeBudget>;
};

type BenchmarkRunReport = {
  operationName: string;
  durationMs: number;
  memoryDeltaBytes: number;
  success: boolean;
  error: string | null;
  warning: string | null;
  details: Record<string, unknown>;
};

type BenchmarkSuiteReport = {
  suiteName: string;
  generatedAt: string;
  status: 'passed' | 'failed';
  summary: {
    totalRuns: number;
    passed: number;
    failed: number;
    warnings: number;
    totalDurationMs: number;
    averageDurationMs: number;
  };
  runs: BenchmarkRunReport[];
};

type RegressionSuiteReport = {
  generatedAt: string;
  status: 'passed' | 'failed';
  failures: number;
  tests: Array<{
    id: string;
    description: string;
    criticalPath: string;
    success: boolean;
    durationMs: number;
    error: string | null;
  }>;
};

type SmokeSuiteReport = {
  suiteName: string;
  generatedAt: string;
  status: 'passed' | 'failed';
  summary: {
    totalSteps: number;
    passed: number;
    failed: number;
    totalDurationMs: number;
  };
  steps: Array<{
    id: string;
    label: string;
    command: string;
    durationMs: number;
    success: boolean;
    error: string | null;
  }>;
};

type QaRuntime = {
  now?: () => Date;
  qaRuntimeDir?: string;
  qaBudgetsDir?: string;
  existsSync?: typeof fs.existsSync;
  readFileSync?: typeof fs.readFileSync;
  buildArchitectureSnapshot?: () => Pick<ArchitectureRefactorSnapshot, 'summary' | 'gate' | 'narrative'>;
};

export type ZavorthQaControlPlaneQuery = {
  profile?: ZavorthQaProfile | string | null;
};

export type ZavorthQaCheck = {
  id: string;
  label: string;
  category: 'benchmark' | 'regression' | 'smoke';
  status: ZavorthQaCheckStatus;
  summary: string;
  actual: string;
  budget: string;
  updatedAt: string | null;
  reportPath: string | null;
  stale: boolean;
  command: string | null;
};

export type ZavorthQaReleaseGate = {
  profile: ZavorthQaProfile;
  posture: 'healthy' | 'attention' | 'critical';
  ready: boolean;
  summary: string;
  command: string;
};

export type ZavorthQaControlPlaneSnapshot = {
  generatedAt: string;
  profile: ZavorthQaProfile;
  architecture: {
    posture: 'healthy' | 'attention' | 'critical';
    gate: 'passed' | 'warning' | 'failed';
    canProceed: boolean;
    summary: string;
    command: string;
  };
  summary: {
    posture: 'healthy' | 'attention' | 'critical';
    checks: number;
    healthy: number;
    attention: number;
    critical: number;
    missing: number;
    stale: number;
    releaseReady: boolean;
  };
  benchmarks: ZavorthQaCheck[];
  regressions: ZavorthQaCheck[];
  smokes: ZavorthQaCheck[];
  releaseGates: ZavorthQaReleaseGate[];
  actions: Array<{
    id: string;
    label: string;
    rationale: string;
    command: string | null;
  }>;
  narrative: {
    headline: string;
    operatorSummary: string;
    nextAction: string;
  };
};

const DEFAULT_PROFILE: ZavorthQaProfile = 'alpha';
const REPORT_TO_COMMAND: Record<string, string> = {
  'benchmark-boot.json': 'npm run qa:bench:boot',
  'benchmark-runtime-flow.json': 'npm run qa:bench:runtime',
  'benchmark-sidecars.json': 'npm run qa:bench:sidecars',
  'critical-regression.json': 'npm run qa:regression',
  'smoke-suite.json': 'npm run test:smoke:flows',
};

export class ZavorthQaControlPlaneService {
  private readonly now: () => Date;
  private readonly qaRuntimeDir: string;
  private readonly qaBudgetsDir: string;
  private readonly existsSync: typeof fs.existsSync;
  private readonly readFileSync: typeof fs.readFileSync;
  private readonly buildArchitectureSnapshot: () => Pick<ArchitectureRefactorSnapshot, 'summary' | 'gate' | 'narrative'>;

  constructor(runtime: QaRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.qaRuntimeDir = path.resolve(runtime.qaRuntimeDir || path.join(config.projectRoot, 'data', 'runtime', 'qa'));
    this.qaBudgetsDir = path.resolve(runtime.qaBudgetsDir || path.join(config.projectRoot, 'qa', 'budgets'));
    this.existsSync = runtime.existsSync || fs.existsSync.bind(fs);
    this.readFileSync = runtime.readFileSync || fs.readFileSync.bind(fs);
    this.buildArchitectureSnapshot = runtime.buildArchitectureSnapshot || (() =>
      new ArchitectureRefactorScorecardService({ now: this.now }).buildSnapshot());
  }

  public buildSnapshot(input: ZavorthQaControlPlaneQuery = {}): ZavorthQaControlPlaneSnapshot {
    const profile = this.normalizeProfile(input.profile);
    const architecture = this.buildArchitectureSnapshot();
    const profileBudget = this.readBudgetProfile(profile);
    const benchmarks = this.buildBenchmarkChecks(profileBudget);
    const regressions = this.buildRegressionChecks(profileBudget);
    const smokes = this.buildSmokeChecks(profileBudget);
    const checks = [...benchmarks, ...regressions, ...smokes];
    const releaseGates = (['alpha', 'beta'] as ZavorthQaProfile[]).map((gateProfile) =>
      this.buildReleaseGate(gateProfile),
    );
    const summary = {
      posture: this.resolvePosture(checks),
      checks: checks.length,
      healthy: checks.filter((entry) => entry.status === 'healthy').length,
      attention: checks.filter((entry) => entry.status === 'attention').length,
      critical: checks.filter((entry) => entry.status === 'critical').length,
      missing: checks.filter((entry) => entry.status === 'missing').length,
      stale: checks.filter((entry) => entry.stale).length,
      releaseReady:
        releaseGates.find((entry) => entry.profile === profile)?.ready === true
        && architecture.gate.status === 'passed',
    } as const;
    const actions = this.buildActions(checks, releaseGates, profile);
    return {
      generatedAt: this.now().toISOString(),
      profile,
      architecture: {
        posture: architecture.summary.posture,
        gate: architecture.gate.status,
        canProceed: architecture.gate.canProceed,
        summary: architecture.narrative.operatorSummary,
        command: 'npm run qa:architecture',
      },
      summary,
      benchmarks,
      regressions,
      smokes,
      releaseGates,
      actions,
      narrative: {
        headline: 'QA release: QA, budgets e release gates',
        operatorSummary:
          `${summary.checks} check(s) lido(s), ${summary.healthy} healthy, ${summary.attention} attention, `
          + `${summary.critical} critical, ${summary.missing} missing e arquitetura ${architecture.gate.status} para o perfil ${profile}.`,
        nextAction: actions[0]?.label || `Rodar npm run release:${profile} para repetir o gate com baseline atual.`,
      },
    };
  }

  public renderReport(input: ZavorthQaControlPlaneQuery = {}): string {
    const snapshot = this.buildSnapshot(input);
    const lines = [
      'QA release: QA, budgets e release gates',
      '',
      snapshot.narrative.operatorSummary,
      `Postura: ${snapshot.summary.posture}.`,
      `Release ${snapshot.profile}: ${snapshot.summary.releaseReady ? 'pronto' : 'pendente'}.`,
      `Arquitetura: ${snapshot.architecture.gate} | ${snapshot.architecture.summary}.`,
      '',
      'Benchmarks:',
      ...snapshot.benchmarks.map((entry) =>
        `- ${entry.label}: ${entry.summary}${entry.command ? ` | ${entry.command}` : ''}`),
      '',
      'Regressoes:',
      ...snapshot.regressions.map((entry) =>
        `- ${entry.label}: ${entry.summary}${entry.command ? ` | ${entry.command}` : ''}`),
      '',
      'Smokes:',
      ...snapshot.smokes.map((entry) =>
        `- ${entry.label}: ${entry.summary}${entry.command ? ` | ${entry.command}` : ''}`),
      '',
      'Release gates:',
      ...snapshot.releaseGates.map((entry) =>
        `- ${entry.profile}: ${entry.summary} | ${entry.command}`),
    ];
    if (snapshot.actions.length > 0) {
      lines.push('', 'Acoes sugeridas:', ...snapshot.actions.map((entry) =>
        `- ${entry.label}: ${entry.rationale}${entry.command ? ` | ${entry.command}` : ''}`));
    }
    return lines.join('\n');
  }

  private buildBenchmarkChecks(profileBudget: QaBudgetProfile): ZavorthQaCheck[] {
    return Object.entries(profileBudget.benchmarks).map(([reportName, budget]) => {
      const reportPath = path.join(this.qaRuntimeDir, reportName);
      const report = this.readJsonFile<BenchmarkSuiteReport>(reportPath);
      if (!report) {
        return this.buildMissingCheck(`benchmark:${reportName}`, budget.label, 'benchmark', reportPath, budget.required, REPORT_TO_COMMAND[reportName] || 'npm run qa:bench');
      }
      const updatedAt = this.normalizeTimestamp(report.generatedAt);
      const stale = this.isStale(updatedAt, budget.maxAgeHours);
      const failingRuns = Object.entries(budget.operations).flatMap(([operationName, thresholds]) => {
        const run = Array.isArray(report.runs) ? report.runs.find((entry) => entry.operationName === operationName) : null;
        if (!run) {
          return [{
            label: operationName,
            reason: 'run ausente no relatorio',
            status: 'missing' as ZavorthQaCheckStatus,
          }];
        }
        if (!run.success) {
          return [{
            label: operationName,
            reason: run.error || 'run falhou',
            status: 'critical' as ZavorthQaCheckStatus,
          }];
        }
        if (this.isSkippedBenchmarkRun(run)) {
          return [];
        }
        if (Number(run.durationMs || 0) > thresholds.maxDurationMs) {
          return [{
            label: operationName,
            reason: `${Math.round(Number(run.durationMs || 0))}ms acima do budget ${thresholds.maxDurationMs}ms`,
            status: 'critical' as ZavorthQaCheckStatus,
          }];
        }
        if (
          Number.isFinite(thresholds.maxMemoryDeltaBytes)
          && Number(run.memoryDeltaBytes || 0) > Number(thresholds.maxMemoryDeltaBytes)
        ) {
          return [{
            label: operationName,
            reason: `memoria ${Math.round(Number(run.memoryDeltaBytes || 0))}B acima do budget ${thresholds.maxMemoryDeltaBytes}B`,
            status: 'critical' as ZavorthQaCheckStatus,
          }];
        }
        if (Number(run.durationMs || 0) > (thresholds.maxDurationMs * 0.85)) {
          return [{
            label: operationName,
            reason: `${Math.round(Number(run.durationMs || 0))}ms perto do budget ${thresholds.maxDurationMs}ms`,
            status: 'attention' as ZavorthQaCheckStatus,
          }];
        }
        return [];
      });
      const highestStatus = this.highestStatus([
        stale ? 'attention' : 'healthy',
        report.status === 'failed' ? 'critical' : 'healthy',
        ...failingRuns.map((entry) => entry.status),
      ]);
      const issues = failingRuns.map((entry) => `${entry.label}: ${entry.reason}`);
      return {
        id: `benchmark:${reportName}`,
        label: budget.label,
        category: 'benchmark',
        status: highestStatus,
        summary: highestStatus === 'healthy'
          ? `${report.summary?.passed || 0}/${report.summary?.totalRuns || 0} run(s) dentro do budget.`
          : `${issues[0] || 'Relatorio fora do budget.'}${stale ? ' Relatorio vencido.' : ''}`,
        actual: `${report.summary?.passed || 0}/${report.summary?.totalRuns || 0} run(s) | avg ${Math.round(Number(report.summary?.averageDurationMs || 0))}ms`,
        budget: `${Object.keys(budget.operations).length} budget(s) | maxAge ${budget.maxAgeHours}h`,
        updatedAt,
        reportPath,
        stale,
        command: REPORT_TO_COMMAND[reportName] || 'npm run qa:bench',
      };
    });
  }

  private buildRegressionChecks(profileBudget: QaBudgetProfile): ZavorthQaCheck[] {
    return Object.entries(profileBudget.regression).map(([reportName, budget]) => {
      const reportPath = path.join(this.qaRuntimeDir, reportName);
      const report = this.readJsonFile<RegressionSuiteReport>(reportPath);
      if (!report) {
        return this.buildMissingCheck(`regression:${reportName}`, budget.label, 'regression', reportPath, budget.required, REPORT_TO_COMMAND[reportName] || 'npm run qa:regression');
      }
      const updatedAt = this.normalizeTimestamp(report.generatedAt);
      const stale = this.isStale(updatedAt, budget.maxAgeHours);
      const missingTests = budget.requiredTests.filter((id) =>
        !(Array.isArray(report.tests) ? report.tests.some((entry) => entry.id === id) : false));
      const failedTests = Array.isArray(report.tests)
        ? report.tests.filter((entry) => !entry.success).map((entry) => `${entry.id}: ${entry.error || 'falhou'}`)
        : [];
      const highestStatus = this.highestStatus([
        stale ? 'attention' : 'healthy',
        Number(report.failures || 0) > budget.maxFailures ? 'critical' : 'healthy',
        missingTests.length > 0 ? 'critical' : 'healthy',
        failedTests.length > 0 ? 'critical' : 'healthy',
      ]);
      return {
        id: `regression:${reportName}`,
        label: budget.label,
        category: 'regression',
        status: highestStatus,
        summary: highestStatus === 'healthy'
          ? `${report.tests.length - report.failures}/${report.tests.length} fluxo(s) critico(s) passaram.`
          : this.firstNonEmpty(
            failedTests[0],
            missingTests[0] ? `teste obrigatorio ausente: ${missingTests[0]}` : null,
            Number(report.failures || 0) > budget.maxFailures ? `falhas ${report.failures}/${budget.maxFailures}` : null,
            stale ? 'Relatorio vencido.' : null,
            'Regressao critica fora do gate.',
          ),
        actual: `${report.failures || 0} falha(s) | ${report.tests?.length || 0} teste(s)`,
        budget: `maxFailures ${budget.maxFailures} | obrigatorios ${budget.requiredTests.length} | maxAge ${budget.maxAgeHours}h`,
        updatedAt,
        reportPath,
        stale,
        command: REPORT_TO_COMMAND[reportName] || 'npm run qa:regression',
      };
    });
  }

  private buildSmokeChecks(profileBudget: QaBudgetProfile): ZavorthQaCheck[] {
    return Object.entries(profileBudget.smokes).map(([reportName, budget]) => {
      const reportPath = path.join(this.qaRuntimeDir, reportName);
      const report = this.readJsonFile<SmokeSuiteReport>(reportPath);
      if (!report) {
        return this.buildMissingCheck(`smoke:${reportName}`, budget.label, 'smoke', reportPath, budget.required, REPORT_TO_COMMAND[reportName] || 'npm run test:smoke:flows');
      }
      const updatedAt = this.normalizeTimestamp(report.generatedAt);
      const stale = this.isStale(updatedAt, budget.maxAgeHours);
      const missingSteps = budget.requiredSteps.filter((id) =>
        !(Array.isArray(report.steps) ? report.steps.some((entry) => entry.id === id) : false));
      const failedSteps = Array.isArray(report.steps)
        ? report.steps.filter((entry) => !entry.success).map((entry) => `${entry.id}: ${entry.error || 'falhou'}`)
        : [];
      const highestStatus = this.highestStatus([
        stale ? 'attention' : 'healthy',
        Number(report.summary?.failed || 0) > budget.maxFailures ? 'critical' : 'healthy',
        missingSteps.length > 0 ? 'critical' : 'healthy',
        failedSteps.length > 0 ? 'critical' : 'healthy',
      ]);
      return {
        id: `smoke:${reportName}`,
        label: budget.label,
        category: 'smoke',
        status: highestStatus,
        summary: highestStatus === 'healthy'
          ? `${report.summary?.passed || 0}/${report.summary?.totalSteps || 0} smoke(s) passaram.`
          : this.firstNonEmpty(
            failedSteps[0],
            missingSteps[0] ? `step obrigatorio ausente: ${missingSteps[0]}` : null,
            Number(report.summary?.failed || 0) > budget.maxFailures ? `falhas ${report.summary?.failed}/${budget.maxFailures}` : null,
            stale ? 'Relatorio vencido.' : null,
            'Smoke suite fora do gate.',
          ),
        actual: `${report.summary?.passed || 0}/${report.summary?.totalSteps || 0} step(s) | total ${Math.round(Number(report.summary?.totalDurationMs || 0))}ms`,
        budget: `maxFailures ${budget.maxFailures} | obrigatorios ${budget.requiredSteps.length} | maxAge ${budget.maxAgeHours}h`,
        updatedAt,
        reportPath,
        stale,
        command: REPORT_TO_COMMAND[reportName] || 'npm run test:smoke:flows',
      };
    });
  }

  private buildReleaseGate(profile: ZavorthQaProfile): ZavorthQaReleaseGate {
    const budget = this.readBudgetProfile(profile);
    const checks = [
      ...this.buildBenchmarkChecks(budget),
      ...this.buildRegressionChecks(budget),
      ...this.buildSmokeChecks(budget),
    ];
    const posture = this.resolvePosture(checks);
    const ready = posture === 'healthy';
    return {
      profile,
      posture,
      ready,
      summary: ready
        ? `Budget, regressao e smokes do perfil ${profile} estao verdes.`
        : `Perfil ${profile} ainda tem ${checks.filter((entry) => entry.status !== 'healthy').length} gate(s) fora do verde.`,
      command: `npm run release:${profile}`,
    };
  }

  private buildActions(
    checks: ZavorthQaCheck[],
    releaseGates: ZavorthQaReleaseGate[],
    profile: ZavorthQaProfile,
  ): ZavorthQaControlPlaneSnapshot['actions'] {
    const actions: ZavorthQaControlPlaneSnapshot['actions'] = [];
    const seen = new Set<string>();
    const push = (entry: ZavorthQaControlPlaneSnapshot['actions'][number] | null) => {
      if (!entry) {
        return;
      }
      const key = `${entry.id}:${entry.command || ''}`;
      if (!seen.has(key)) {
        seen.add(key);
        actions.push(entry);
      }
    };
    const missing = checks.find((entry) => entry.status === 'missing');
    if (missing) {
      push({
        id: `missing:${missing.id}`,
        label: `Gerar ${missing.label}`,
        rationale: missing.summary,
        command: missing.command,
      });
    }
    const critical = checks.find((entry) => entry.status === 'critical');
    if (critical) {
      push({
        id: `critical:${critical.id}`,
        label: `Corrigir ${critical.label}`,
        rationale: critical.summary,
        command: critical.command,
      });
    }
    const stale = checks.find((entry) => entry.stale);
    if (stale) {
      push({
        id: `stale:${stale.id}`,
        label: `Renovar ${stale.label}`,
        rationale: 'O relatorio venceu e precisa de leitura nova antes do release gate.',
        command: stale.command,
      });
    }
    const selectedRelease = releaseGates.find((entry) => entry.profile === profile) || null;
    if (selectedRelease && !selectedRelease.ready) {
      push({
        id: `release:${profile}`,
        label: `Fechar release ${profile}`,
        rationale: selectedRelease.summary,
        command: selectedRelease.command,
      });
    }
    const architecture = this.buildArchitectureSnapshot();
    if (architecture.gate.status !== 'passed') {
      push({
        id: 'architecture:gate',
        label: 'Fechar gate arquitetural',
        rationale: architecture.narrative.operatorSummary,
        command: 'npm run qa:architecture',
      });
    }
    return actions.slice(0, 6);
  }

  private buildMissingCheck(
    id: string,
    label: string,
    category: ZavorthQaCheck['category'],
    reportPath: string,
    required: boolean,
    command: string | null,
  ): ZavorthQaCheck {
    return {
      id,
      label,
      category,
      status: required ? 'missing' : 'attention',
      summary: required ? 'Relatorio ausente para este gate.' : 'Relatorio opcional ausente.',
      actual: 'sem relatorio',
      budget: required ? 'required' : 'optional',
      updatedAt: null,
      reportPath,
      stale: false,
      command,
    };
  }

  private resolvePosture(checks: ZavorthQaCheck[]): ZavorthQaControlPlaneSnapshot['summary']['posture'] {
    if (checks.some((entry) => entry.status === 'critical' || entry.status === 'missing')) {
      return 'critical';
    }
    if (checks.some((entry) => entry.status === 'attention')) {
      return 'attention';
    }
    return 'healthy';
  }

  private highestStatus(statuses: ZavorthQaCheckStatus[]): ZavorthQaCheckStatus {
    if (statuses.includes('missing')) {
      return 'missing';
    }
    if (statuses.includes('critical')) {
      return 'critical';
    }
    if (statuses.includes('attention')) {
      return 'attention';
    }
    return 'healthy';
  }

  private isSkippedBenchmarkRun(run: BenchmarkRunReport): boolean {
    return run.success && String(run.details?.status || '').trim().toLowerCase() === 'skipped';
  }

  private normalizeProfile(profile: string | null | undefined): ZavorthQaProfile {
    const normalized = String(profile || '').trim().toLowerCase();
    return normalized === 'beta' ? 'beta' : DEFAULT_PROFILE;
  }

  private readBudgetProfile(profile: ZavorthQaProfile): QaBudgetProfile {
    const filePath = path.join(this.qaBudgetsDir, `${profile}.json`);
    const parsed = this.readJsonFile<QaBudgetProfile>(filePath);
    if (parsed) {
      return parsed;
    }
    throw new Error(`Budget profile ${profile} nao encontrado em ${filePath}.`);
  }

  private readJsonFile<T>(filePath: string): T | null {
    if (!this.existsSync(filePath)) {
      return null;
    }
    try {
      return JSON.parse(this.readFileSync(filePath, 'utf8')) as T;
    } catch {
      return null;
    }
  }

  private normalizeTimestamp(value: string | null | undefined): string | null {
    const timestamp = String(value || '').trim();
    return timestamp || null;
  }

  private isStale(timestamp: string | null, maxAgeHours: number): boolean {
    if (!timestamp) {
      return true;
    }
    const parsed = Date.parse(timestamp);
    if (!Number.isFinite(parsed)) {
      return true;
    }
    const maxAgeMs = Math.max(1, Number(maxAgeHours || 0)) * 60 * 60 * 1000;
    return (this.now().getTime() - parsed) > maxAgeMs;
  }

  private firstNonEmpty(...values: Array<string | null | undefined>): string {
    for (const value of values) {
      const normalized = String(value || '').trim();
      if (normalized) {
        return normalized;
      }
    }
    return '';
  }
}
