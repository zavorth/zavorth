import fs from 'fs';
import path from 'path';
import { config } from '../../src/config/index.js';
import {
  AutoRepairIncidentMemoryService,
  type AutoRepairIncidentMemoryEntry,
} from '../../src/services/AutoRepairIncidentMemoryService.js';

export type ReliabilityCompatCheckStatus = 'passed' | 'warning' | 'failed' | 'skipped';

export type ReliabilityCompatCheck = {
  id: string;
  label: string;
  status: ReliabilityCompatCheckStatus;
  summary: string;
  details: string[];
};

export type ReliabilityCompatReport = {
  generatedAt: string;
  status: 'passed' | 'failed';
  summary: {
    passed: number;
    warning: number;
    failed: number;
    skipped: number;
  };
  metrics: {
    bootMs: number | null;
    statusMs: number | null;
    doctorMs: number | null;
    appLatencyMs: number | null;
    nodeInvokeMs: number | null;
    autorepairSuccessRate: number | null;
    autorepairSamples: number;
  };
  checks: ReliabilityCompatCheck[];
};

type BenchmarkRunReport = {
  operationName: string;
  durationMs: number;
};

type BenchmarkSuiteReport = {
  runs?: BenchmarkRunReport[];
};

type BenchmarkOperationRequirement = string | readonly string[];

type RegressionSuiteReport = {
  tests?: Array<{
    id: string;
    success: boolean;
  }>;
};

type ReliabilityCompatOptions = {
  now?: () => Date;
  qaRuntimeDir?: string;
  existsSync?: typeof fs.existsSync;
  readFileSync?: typeof fs.readFileSync;
  readAutoRepairEntries?: () => AutoRepairIncidentMemoryEntry[];
};

const BENCHMARK_REQUIREMENTS = [
  {
    report: 'benchmark-boot.json',
    label: 'Benchmark de boot',
    operations: ['Gateway host boot', ['CLI status fast', 'CLI status'], ['CLI doctor fast', 'CLI doctor']],
  },
  {
    report: 'benchmark-runtime-flow.json',
    label: 'Benchmark de runtime',
    operations: [
      'Gateway session spawn',
      'Gateway session send',
      'Node Mesh invoke device.info',
      'Web shell /app latency',
    ],
  },
  {
    report: 'benchmark-sidecars.json',
    label: 'Benchmark de sidecars',
    operations: ['Remote transport doctor', 'Channel provider doctor'],
  },
] as const;

const REGRESSION_REQUIREMENTS = ['gateway-public-api', 'web-app-shell', 'remote-transport-doctor'] as const;

const AUTOREPAIR_SUCCESS_STATUSES = new Set(['noop', 'dry_run', 'repaired', 'reloaded']);

export function buildReliabilityCompatReport(options: ReliabilityCompatOptions = {}): ReliabilityCompatReport {
  const now = options.now || (() => new Date());
  const qaRuntimeDir = path.resolve(options.qaRuntimeDir || path.join(config.projectRoot, 'data', 'runtime', 'qa'));
  const existsSync = options.existsSync || fs.existsSync.bind(fs);
  const readFileSync = options.readFileSync || fs.readFileSync.bind(fs);
  const readAutoRepairEntries =
    options.readAutoRepairEntries
    || (() => new AutoRepairIncidentMemoryService().readEntries());

  const checks: ReliabilityCompatCheck[] = [];

  for (const requirement of BENCHMARK_REQUIREMENTS) {
    const reportPath = path.join(qaRuntimeDir, requirement.report);
    const report = readJsonFile<BenchmarkSuiteReport>(reportPath, existsSync, readFileSync);
    if (!report) {
      checks.push({
        id: `benchmark:${requirement.report}`,
        label: requirement.label,
        status: 'failed',
        summary: 'Relatorio de benchmark ausente.',
        details: [reportPath],
      });
      continue;
    }

    const runs = Array.isArray(report.runs) ? report.runs : [];
    const missingOperations = requirement.operations.filter((operationName) =>
      !hasBenchmarkOperation(runs, operationName));

    checks.push({
      id: `benchmark:${requirement.report}`,
      label: requirement.label,
      status: missingOperations.length === 0 ? 'passed' : 'failed',
      summary: missingOperations.length === 0
        ? `${requirement.operations.length} metrica(s) presentes no relatorio.`
        : 'Relatorio nao cobre todas as metricas minimas da etapa 7.',
      details: missingOperations.length === 0
        ? requirement.operations.map((entry) => `ok: ${formatBenchmarkOperationRequirement(entry)}`)
        : missingOperations.map((entry) => `ausente: ${formatBenchmarkOperationRequirement(entry)}`),
    });
  }

  const regressionPath = path.join(qaRuntimeDir, 'critical-regression.json');
  const regression = readJsonFile<RegressionSuiteReport>(regressionPath, existsSync, readFileSync);
  if (!regression) {
    checks.push({
      id: 'regression:critical',
      label: 'Regressao critica',
      status: 'failed',
      summary: 'Relatorio de regressao critica ausente.',
      details: [regressionPath],
    });
  } else {
    const tests = Array.isArray(regression.tests) ? regression.tests : [];
    const missingTests = REGRESSION_REQUIREMENTS.filter((testId) =>
      !tests.some((entry) => entry.id === testId && entry.success));
    checks.push({
      id: 'regression:critical',
      label: 'Regressao critica',
      status: missingTests.length === 0 ? 'passed' : 'failed',
      summary: missingTests.length === 0
        ? `${REGRESSION_REQUIREMENTS.length} fluxo(s) critico(s) cobrindo gateway, web e transportes.`
        : 'A regressao critica nao cobre todos os fluxos minimos esperados.',
      details: missingTests.length === 0
        ? REGRESSION_REQUIREMENTS.map((entry) => `ok: ${entry}`)
        : missingTests.map((entry) => `ausente ou falhou: ${entry}`),
    });
  }

  const autoRepairEntries = readAutoRepairEntries()
    .filter((entry) => String(entry.status || '').trim().toLowerCase() !== 'busy')
    .slice(0, 20);
  if (autoRepairEntries.length === 0) {
    checks.push({
      id: 'autorepair:success-rate',
      label: 'Autorepair success rate',
      status: 'warning',
      summary: 'Ainda nao existe historico persistido do autorepair para calcular taxa de sucesso.',
      details: ['Registre uma execucao do autorepair para materializar a metrica historica.'],
    });
  } else {
    const successfulRuns = autoRepairEntries.filter((entry) =>
      AUTOREPAIR_SUCCESS_STATUSES.has(String(entry.status || '').trim().toLowerCase()));
    const successRate = successfulRuns.length / autoRepairEntries.length;
    checks.push({
      id: 'autorepair:success-rate',
      label: 'Autorepair success rate',
      status: 'passed',
      summary: `Taxa de sucesso calculada em ${(successRate * 100).toFixed(1)}% nas ultimas ${autoRepairEntries.length} execucao(oes).`,
      details: [
        `sucessos: ${successfulRuns.length}`,
        `falhas: ${autoRepairEntries.length - successfulRuns.length}`,
      ],
    });
  }

  const metrics = {
    bootMs: readBenchmarkMetric(qaRuntimeDir, 'benchmark-boot.json', 'Gateway host boot', existsSync, readFileSync),
    statusMs: readBenchmarkMetric(
      qaRuntimeDir,
      'benchmark-boot.json',
      ['CLI status fast', 'CLI status'],
      existsSync,
      readFileSync,
    ),
    doctorMs: readBenchmarkMetric(
      qaRuntimeDir,
      'benchmark-boot.json',
      ['CLI doctor fast', 'CLI doctor'],
      existsSync,
      readFileSync,
    ),
    appLatencyMs: readBenchmarkMetric(qaRuntimeDir, 'benchmark-runtime-flow.json', 'Web shell /app latency', existsSync, readFileSync),
    nodeInvokeMs: readBenchmarkMetric(qaRuntimeDir, 'benchmark-runtime-flow.json', 'Node Mesh invoke device.info', existsSync, readFileSync),
    autorepairSuccessRate: autoRepairEntries.length > 0
      ? autoRepairEntries.filter((entry) =>
        AUTOREPAIR_SUCCESS_STATUSES.has(String(entry.status || '').trim().toLowerCase())).length / autoRepairEntries.length
      : null,
    autorepairSamples: autoRepairEntries.length,
  };

  const summary = {
    passed: checks.filter((entry) => entry.status === 'passed').length,
    warning: checks.filter((entry) => entry.status === 'warning').length,
    failed: checks.filter((entry) => entry.status === 'failed').length,
    skipped: checks.filter((entry) => entry.status === 'skipped').length,
  };

  return {
    generatedAt: now().toISOString(),
    status: summary.failed > 0 ? 'failed' : 'passed',
    summary,
    metrics,
    checks,
  };
}

export function renderReliabilityCompatReport(report: ReliabilityCompatReport): string {
  const lines = [
    'Reliability compat da etapa 7',
    `Status: ${report.status}.`,
    `Checks: ${report.summary.passed} passed, ${report.summary.warning} warning, ${report.summary.failed} failed.`,
    `Metricas: boot=${formatMetric(report.metrics.bootMs)} | status=${formatMetric(report.metrics.statusMs)} | doctor=${formatMetric(report.metrics.doctorMs)} | /app=${formatMetric(report.metrics.appLatencyMs)} | nodeinvoke=${formatMetric(report.metrics.nodeInvokeMs)} | autorepair=${formatRate(report.metrics.autorepairSuccessRate, report.metrics.autorepairSamples)}`,
    '',
    ...report.checks.map((check) => `- [${check.status}] ${check.label}: ${check.summary}`),
  ];
  return lines.join('\n');
}

function readBenchmarkMetric(
  qaRuntimeDir: string,
  reportName: string,
  operationName: BenchmarkOperationRequirement,
  existsSync: typeof fs.existsSync,
  readFileSync: typeof fs.readFileSync,
): number | null {
  const report = readJsonFile<BenchmarkSuiteReport>(path.join(qaRuntimeDir, reportName), existsSync, readFileSync);
  const acceptableNames = Array.isArray(operationName) ? operationName : [operationName];
  const run = Array.isArray(report?.runs)
    ? report.runs.find((entry) => acceptableNames.includes(entry.operationName))
    : null;
  return run ? Number(run.durationMs || 0) : null;
}

function hasBenchmarkOperation(
  runs: BenchmarkRunReport[],
  operationName: BenchmarkOperationRequirement,
): boolean {
  const acceptableNames = Array.isArray(operationName) ? operationName : [operationName];
  return runs.some((run) => acceptableNames.includes(run.operationName));
}

function formatBenchmarkOperationRequirement(operationName: BenchmarkOperationRequirement): string {
  return Array.isArray(operationName) ? operationName.join(' | ') : String(operationName);
}

function readJsonFile<T>(
  filePath: string,
  existsSync: typeof fs.existsSync,
  readFileSync: typeof fs.readFileSync,
): T | null {
  if (!existsSync(filePath)) {
    return null;
  }
  try {
    return JSON.parse(readFileSync(filePath, 'utf8')) as T;
  } catch {
    return null;
  }
}

function formatMetric(value: number | null): string {
  return value === null ? 'n/d' : `${value.toFixed(2)}ms`;
}

function formatRate(value: number | null, samples: number): string {
  if (value === null) {
    return `n/d (${samples} amostra(s))`;
  }
  return `${(value * 100).toFixed(1)}% (${samples} amostra(s))`;
}
