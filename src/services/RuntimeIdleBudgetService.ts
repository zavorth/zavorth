import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';
import {
  RUNTIME_IDLE_BACKGROUND_SCRIPTS,
  RUNTIME_IDLE_BUDGET_METRICS,
  RUNTIME_IDLE_CONTRACTS,
  type RuntimeIdleBudgetCheck,
  type RuntimeIdleBudgetCheckStatus,
  type RuntimeIdleBudgetSnapshot,
} from '../contracts/RuntimeIdleBudgetContract.js';
import type { DesktopResourceSnapshot } from '../contracts/DesktopResourceContract.js';
import { DesktopResourcePlaneService } from './DesktopResourcePlaneService.js';
import { DeterministicQaMatrixService } from './DeterministicQaMatrixService.js';
import { logger } from '../logger.js';

type PackageLike = {
  scripts?: Record<string, string>;
};

type AlphaBudgetLike = {
  benchmarks?: Record<string, {
    operations?: Record<string, {
      maxDurationMs?: number;
      maxMemoryDeltaBytes?: number;
    }>;
  }>;
};

export type RuntimeIdleBudgetServiceOptions = {
  projectRoot?: string;
  packageJson?: PackageLike;
  alphaBudget?: AlphaBudgetLike;
  desktopSnapshot?: DesktopResourceSnapshot | null;
  desktopResourcePlane?: Pick<DesktopResourcePlaneService, 'readLatest'>;
  deterministicQaMatrix?: Pick<DeterministicQaMatrixService, 'buildSnapshot'>;
  existsSync?: (targetPath: string) => boolean;
  readFileSync?: (targetPath: string, encoding: BufferEncoding) => string;
  now?: () => Date;
};

const QUIET_GATE_SCRIPTS = [
  'runtime:check',
  'qa:product-quality',
  'qa:web-app-polish',
  'qa:artifact-workbench',
  'qa:release-ux',
  'qa:tenant-team-ops',
  'qa:deterministic',
  'qa:phase:39',
  'qa:phase:40',
  'qa:phase:41',
  'qa:phase:42',
  'qa:phase:43',
  'qa:phase:44',
  'qa:phase:45',
];

const BACKGROUND_WORDS = [
  'nodemon',
  '--watch',
  ' dev',
  'start:supervised',
  'node-mesh-host',
  'ops-maintain-recurring',
  'start-ai-gateway-runtime',
];

export class RuntimeIdleBudgetService {
  private readonly projectRoot: string;
  private readonly packageJson: PackageLike | null;
  private readonly alphaBudget: AlphaBudgetLike | null;
  private readonly desktopSnapshot: DesktopResourceSnapshot | null | undefined;
  private readonly desktopResourcePlane: Pick<DesktopResourcePlaneService, 'readLatest'>;
  private readonly deterministicQaMatrix: Pick<DeterministicQaMatrixService, 'buildSnapshot'>;
  private readonly existsSync: (targetPath: string) => boolean;
  private readonly readFileSync: (targetPath: string, encoding: BufferEncoding) => string;
  private readonly now: () => Date;

  constructor(options: RuntimeIdleBudgetServiceOptions = {}) {
    this.projectRoot = options.projectRoot || config.projectRoot;
    this.packageJson = options.packageJson || null;
    this.alphaBudget = options.alphaBudget || null;
    this.desktopSnapshot = Object.prototype.hasOwnProperty.call(options, 'desktopSnapshot')
      ? options.desktopSnapshot
      : undefined;
    this.desktopResourcePlane = options.desktopResourcePlane || new DesktopResourcePlaneService();
    this.deterministicQaMatrix = options.deterministicQaMatrix || new DeterministicQaMatrixService();
    this.existsSync = options.existsSync || fs.existsSync;
    this.readFileSync = options.readFileSync || ((targetPath, encoding) => fs.readFileSync(targetPath, encoding));
    this.now = options.now || (() => new Date());
  }

  public buildSnapshot(): RuntimeIdleBudgetSnapshot {
    const checks = [
      ...this.checkAlphaBootBudgets(),
      ...this.checkBackgroundScripts(),
      this.checkQuietGates(),
      this.checkDeterministicQuickBudget(),
      this.checkDesktopResourceCache(),
    ];
    const failed = checks.filter((check) => check.status === 'fail').length;
    const warnings = checks.filter((check) => check.status === 'warn').length;
    const passed = checks.filter((check) => check.status === 'pass').length;

    return {
      phase: '45',
      surface: 'runtime-idle-budget',
      generatedAt: this.now().toISOString(),
      status: failed > 0 ? 'blocked' : warnings > 0 ? 'attention' : 'ready',
      summary: {
        ok: failed === 0,
        passed,
        warnings,
        failed,
        metrics: RUNTIME_IDLE_BUDGET_METRICS.length,
        backgroundScripts: RUNTIME_IDLE_BACKGROUND_SCRIPTS.length,
      },
      metrics: RUNTIME_IDLE_BUDGET_METRICS,
      backgroundScripts: RUNTIME_IDLE_BACKGROUND_SCRIPTS,
      checks,
      contracts: RUNTIME_IDLE_CONTRACTS,
      commands: {
        inspect: 'npm run idle:budget',
        json: 'npm run idle:budget -- --json',
        benchmark: 'npm run qa:bench:boot',
        desktopDoctor: 'npm run ops:doctor:desktop',
      },
      nextRecommendedPhase: {
        phase: '40',
        title: 'Web/App Polish',
        reason:
          'Depois de travar qualidade, QA e peso operacional, a ordem combinada volta para polir a experiencia web/app sem carregar o core.',
      },
    };
  }

  public renderReport(snapshot: RuntimeIdleBudgetSnapshot = this.buildSnapshot()): string {
    const lines: string[] = [];
    lines.push('[idle-budget] Etapa 45 - Runtime Performance And Idle Budget');
    lines.push(`status: ${snapshot.status}`);
    lines.push(`ok: ${snapshot.summary.ok ? 'yes' : 'no'} | pass=${snapshot.summary.passed} warn=${snapshot.summary.warnings} fail=${snapshot.summary.failed}`);
    lines.push('');
    lines.push('Budgets principais:');
    for (const metric of snapshot.metrics) {
      lines.push(`- ${metric.label}: <= ${metric.max}${metric.unit} | ${metric.source}`);
    }
    lines.push('');
    for (const check of snapshot.checks) {
      lines.push(`[${check.status}] ${check.title}`);
      lines.push(`  ${check.reason}`);
      for (const evidence of check.evidence || []) {
        lines.push(`  - ${evidence}`);
      }
    }
    lines.push('');
    lines.push(`proximo passo recomendada: ${snapshot.nextRecommendedPhase.phase} - ${snapshot.nextRecommendedPhase.title}`);
    lines.push(snapshot.nextRecommendedPhase.reason);
    return lines.join('\n');
  }

  private checkAlphaBootBudgets(): RuntimeIdleBudgetCheck[] {
    const budget = this.readAlphaBudget();
    const boot = budget?.benchmarks?.['benchmark-boot.json'];
    const operations = boot?.operations || {};
    const required = [
      { name: 'Gateway host boot', expected: 500 },
      { name: 'CLI status fast', expected: 6000 },
      { name: 'CLI doctor fast', expected: 12000 },
      { name: 'CLI ops access fast', expected: 1500 },
    ];

    return required.map((entry) => {
      const maxDurationMs = Number(operations[entry.name]?.maxDurationMs || 0);
      const ok = maxDurationMs > 0 && maxDurationMs <= entry.expected;
      return this.check(
        `budget:boot:${entry.name}`,
        `budget ${entry.name}`,
        ok ? 'pass' : 'fail',
        ok
          ? `${entry.name} esta dentro do budget de ${entry.expected}ms.`
          : `${entry.name} precisa existir em qa/budgets/alpha.json com maxDurationMs <= ${entry.expected}.`,
        [`actual=${maxDurationMs || '<ausente>'}`, `expected<=${entry.expected}`],
      );
    });
  }

  private checkBackgroundScripts(): RuntimeIdleBudgetCheck[] {
    const scripts = this.readPackageJson()?.scripts || {};
    return RUNTIME_IDLE_BACKGROUND_SCRIPTS.map((spec) => {
      const command = String(scripts[spec.script] || '').trim();
      const ok = command.includes(spec.expectedFragment);
      return this.check(
        `background-script:${spec.script}`,
        `script explicito ${spec.script}`,
        ok ? 'pass' : 'fail',
        ok
          ? `${spec.script} esta rotulado como ${spec.category} e permanece acionamento explicito.`
          : `${spec.script} precisa existir e conter ${spec.expectedFragment}.`,
        [`command=${command || '<ausente>'}`, `reason=${spec.reason}`],
      );
    });
  }

  private checkQuietGates(): RuntimeIdleBudgetCheck {
    const scripts = this.readPackageJson()?.scripts || {};
    const offenders = QUIET_GATE_SCRIPTS.filter((scriptName) => {
      const command = ` ${String(scripts[scriptName] || '').toLowerCase()} `;
      return BACKGROUND_WORDS.some((word) => command.includes(word.toLowerCase()));
    });
    return this.check(
      'quiet-gates:no-background',
      'gates quiet nao iniciam background',
      offenders.length === 0 ? 'pass' : 'fail',
      offenders.length === 0
        ? 'gates rapidos de qualidade nao apontam para watchers, hosts ou sidecars persistentes.'
        : `gates quiet apontam para comandos de background: ${offenders.join(', ')}`,
      offenders,
    );
  }

  private checkDeterministicQuickBudget(): RuntimeIdleBudgetCheck {
    const quick = this.deterministicQaMatrix.buildSnapshot().tiers.quick;
    const expected = RUNTIME_IDLE_BUDGET_METRICS.find((metric) => metric.id === 'quick-qa-budget')?.max || 780000;
    return this.check(
      'deterministic-quick-budget',
      'budget do QA quick',
      quick.maxDurationMs <= expected ? 'pass' : 'fail',
      quick.maxDurationMs <= expected
        ? `tier quick permanece dentro de ${expected}ms.`
        : `tier quick esta em ${quick.maxDurationMs}ms, acima de ${expected}ms.`,
      [`actual=${quick.maxDurationMs}`, `gates=${quick.gates.join(', ')}`],
    );
  }

  private checkDesktopResourceCache(): RuntimeIdleBudgetCheck {
    const snapshot = this.resolveDesktopSnapshot();
    if (!snapshot) {
      return this.check(
        'desktop-resource-cache',
        'cache de desktop resource',
        'warn',
        'sem snapshot passivo de recursos; rode ops:doctor:desktop quando quiser medir memoria/processos reais.',
        ['gate nao inicia coleta live por padrao'],
      );
    }

    const zavorthMemoryBudget = RUNTIME_IDLE_BUDGET_METRICS.find((metric) => metric.id === 'zavorth-idle-memory')?.max || 512;
    const zavorthProcessBudget = RUNTIME_IDLE_BUDGET_METRICS.find((metric) => metric.id === 'zavorth-idle-processes')?.max || 3;
    const zavorthProcesses = (snapshot.items || []).filter((item) => item.owner === 'zavorth').length;
    const overMemory = snapshot.totals.zavorthMemoryMb > zavorthMemoryBudget;
    const overProcesses = zavorthProcesses > zavorthProcessBudget;
    const status: RuntimeIdleBudgetCheckStatus = overMemory || overProcesses ? 'warn' : 'pass';

    return this.check(
      'desktop-resource-cache',
      'cache de desktop resource',
      status,
      status === 'pass'
        ? 'ultimo snapshot passivo esta dentro dos budgets de idle.'
        : 'ultimo snapshot passivo sugere revisar peso em idle.',
      [
        `generatedAt=${snapshot.generatedAt}`,
        `zavorthMemoryMb=${snapshot.totals.zavorthMemoryMb}/${zavorthMemoryBudget}`,
        `zavorthProcesses=${zavorthProcesses}/${zavorthProcessBudget}`,
      ],
    );
  }

  private resolveDesktopSnapshot(): DesktopResourceSnapshot | null {
    if (this.desktopSnapshot !== undefined) {
      return this.desktopSnapshot;
    }
    try {
      return this.desktopResourcePlane.readLatest();
    } catch (error: unknown) {logger.warn('[Runtime Idle Budget] operation failed', error); return null; }
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
    } catch (error: unknown) {logger.warn('[Runtime Idle Budget] JSON parse failed', error); return null; }
  }

  private readAlphaBudget(): AlphaBudgetLike | null {
    if (this.alphaBudget) {
      return this.alphaBudget;
    }
    const target = path.resolve(this.projectRoot, 'qa', 'budgets', 'alpha.json');
    if (!this.existsSync(target)) {
      return null;
    }
    try {
      return JSON.parse(this.readFileSync(target, 'utf8')) as AlphaBudgetLike;
    } catch (error: unknown) {logger.warn('[Runtime Idle Budget] JSON parse failed', error); return null; }
  }

  private check(
    id: string,
    title: string,
    status: RuntimeIdleBudgetCheckStatus,
    reason: string,
    evidence: string[] = [],
  ): RuntimeIdleBudgetCheck {
    return {
      id,
      title,
      status,
      reason,
      evidence,
    };
  }
}
