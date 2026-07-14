import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';
import { logger } from '../logger.js';
import {
DETERMINISTIC_QA_CONTRACTS,
  DETERMINISTIC_QA_GATES,
  type DeterministicQaCheck,
  type DeterministicQaCheckStatus,
  type DeterministicQaGateSpec,
  type DeterministicQaMatrixSnapshot,
  type DeterministicQaTier,
} from '../contracts/DeterministicQaContract.js';

type PackageLike = {
  scripts?: Record<string, string>;
};

export type DeterministicQaMatrixServiceOptions = {
  projectRoot?: string;
  packageJson?: PackageLike;
  gates?: DeterministicQaGateSpec[];
  readFileSync?: (targetPath: string, encoding: BufferEncoding) => string;
  existsSync?: (targetPath: string) => boolean;
  now?: () => Date;
};

const TIER_ORDER: DeterministicQaTier[] = ['quick', 'standard', 'release'];

export class DeterministicQaMatrixService {
  private readonly projectRoot: string;
  private readonly packageJson: PackageLike | null;
  private readonly gates: DeterministicQaGateSpec[];
  private readonly readFileSync: (targetPath: string, encoding: BufferEncoding) => string;
  private readonly existsSync: (targetPath: string) => boolean;
  private readonly now: () => Date;

  constructor(options: DeterministicQaMatrixServiceOptions = {}) {
    this.projectRoot = options.projectRoot || config.projectRoot;
    this.packageJson = options.packageJson || null;
    this.gates = options.gates || DETERMINISTIC_QA_GATES;
    this.readFileSync = options.readFileSync || fs.readFileSync;
    this.existsSync = options.existsSync || fs.existsSync;
    this.now = options.now || (() => new Date());
  }

  public buildSnapshot(): DeterministicQaMatrixSnapshot {
    const checks = [
      ...this.checkScripts(),
      ...this.checkGateBudgets(),
      ...this.checkGateUniqueness(),
      ...this.checkNoExternalRuntime(),
      this.checkTierContainment(),
      this.checkJsonDeclarations(),
    ];
    const failed = checks.filter((check) => check.status === 'fail').length;
    const warnings = checks.filter((check) => check.status === 'warn').length;
    const passed = checks.filter((check) => check.status === 'pass').length;
    const tiers = this.buildTiers();

    return {
      gate: 'deterministic-qa',
      surface: 'deterministic-qa-matrix',
      generatedAt: this.now().toISOString(),
      status: failed > 0 ? 'blocked' : warnings > 0 ? 'attention' : 'ready',
      summary: {
        ok: failed === 0,
        gates: this.gates.length,
        required: this.gates.filter((gate) => gate.required).length,
        passed,
        warnings,
        failed,
        maxReleaseDurationMs: tiers.release.maxDurationMs,
      },
      tiers,
      gates: this.gates,
      checks,
      contracts: DETERMINISTIC_QA_CONTRACTS,
      nextRecommendedGate: {
        gate: 'runtime-idle-budget',
        title: 'Runtime Performance And Idle Budget',
        reason:
          'Com a matriz de QA travada, a proxima prioridade combinada e medir e reduzir peso de startup/background antes de polir mais superficies.',
      },
    };
  }

  public renderReport(snapshot: DeterministicQaMatrixSnapshot = this.buildSnapshot()): string {
    const lines: string[] = [];
    lines.push('[deterministic-qa] QA Deterministico');
    lines.push(`status: ${snapshot.status}`);
    lines.push(`ok: ${snapshot.summary.ok ? 'yes' : 'no'} | gates=${snapshot.summary.gates} required=${snapshot.summary.required}`);
    for (const tier of TIER_ORDER) {
      const entry = snapshot.tiers[tier];
      lines.push(`${tier}: ${entry.gates.length} gate(s) | budget ${entry.maxDurationMs}ms | ${entry.command}`);
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
    lines.push(`proximo passo recomendada: ${snapshot.nextRecommendedGate.gate} - ${snapshot.nextRecommendedGate.title}`);
    lines.push(snapshot.nextRecommendedGate.reason);
    return lines.join('\n');
  }

  private checkScripts(): DeterministicQaCheck[] {
    const scripts = this.readPackageJson()?.scripts || {};
    return this.gates
      .filter((gate) => gate.required && gate.packageScript)
      .map((gate) => {
        const script = gate.packageScript || '';
        const value = String(scripts[script] || '').trim();
        return this.check(
          `script:${script}`,
          `script ${script}`,
          value ? 'pass' : 'fail',
          value
            ? `package.json expoe o gate requerido para ${gate.label}.`
            : `package.json precisa expor ${script} para ${gate.label}.`,
          [`command=${gate.command}`, `script=${value || '<ausente>'}`],
        );
      });
  }

  private checkGateBudgets(): DeterministicQaCheck[] {
    return this.gates.map((gate) => this.check(
      `budget:${gate.id}`,
      `budget ${gate.id}`,
      Number.isFinite(gate.maxDurationMs) && gate.maxDurationMs > 0 ? 'pass' : 'fail',
      Number.isFinite(gate.maxDurationMs) && gate.maxDurationMs > 0
        ? `${gate.label} tem budget explicito de ${gate.maxDurationMs}ms.`
        : `${gate.label} precisa de maxDurationMs positivo.`,
      [`tier=${gate.tier}`, `layer=${gate.layer}`],
    ));
  }

  private checkGateUniqueness(): DeterministicQaCheck[] {
    const seen = new Set<string>();
    const duplicates = new Set<string>();
    for (const gate of this.gates) {
      if (seen.has(gate.id)) {
        duplicates.add(gate.id);
      }
      seen.add(gate.id);
    }
    return [
      this.check(
        'matrix:unique-gates',
        'ids unicos de gate',
        duplicates.size === 0 ? 'pass' : 'fail',
        duplicates.size === 0
          ? 'todos os gates tem id unico.'
          : `gates duplicados: ${Array.from(duplicates).join(', ')}`,
      ),
    ];
  }

  private checkNoExternalRuntime(): DeterministicQaCheck[] {
    const networkGates = this.gates.filter((gate) => gate.requiresNetwork);
    const persistentGates = this.gates.filter((gate) => gate.startsPersistentProcess);
    return [
      this.check(
        'matrix:no-network',
        'sem rede externa obrigatoria',
        networkGates.length === 0 ? 'pass' : 'fail',
        networkGates.length === 0
          ? 'matriz default nao exige rede externa.'
          : `gates exigem rede externa: ${networkGates.map((gate) => gate.id).join(', ')}`,
      ),
      this.check(
        'matrix:no-persistent-process',
        'sem processo persistente',
        persistentGates.length === 0 ? 'pass' : 'fail',
        persistentGates.length === 0
          ? 'matriz default nao declara processo persistente.'
          : `gates podem deixar processo persistente: ${persistentGates.map((gate) => gate.id).join(', ')}`,
      ),
    ];
  }

  private checkTierContainment(): DeterministicQaCheck {
    const tiers = this.buildTiers();
    const quick = new Set(tiers.quick.gates);
    const standard = new Set(tiers.standard.gates);
    const release = new Set(tiers.release.gates);
    const missingFromStandard = Array.from(quick).filter((id) => !standard.has(id));
    const missingFromRelease = Array.from(standard).filter((id) => !release.has(id));
    const ok = missingFromStandard.length === 0 && missingFromRelease.length === 0;
    return this.check(
      'matrix:tier-containment',
      'tiers cumulativos',
      ok ? 'pass' : 'fail',
      ok
        ? 'quick esta contido em standard, e standard esta contido em release.'
        : 'tiers precisam ser cumulativos para o operador entender cobertura.',
      [
        missingFromStandard.length ? `faltando no standard: ${missingFromStandard.join(', ')}` : '',
        missingFromRelease.length ? `faltando no release: ${missingFromRelease.join(', ')}` : '',
      ].filter(Boolean),
    );
  }

  private checkJsonDeclarations(): DeterministicQaCheck {
    const jsonCommands = this.gates.filter((gate) => gate.command.includes('--json'));
    const missing = jsonCommands.filter((gate) => !gate.producesJson);
    return this.check(
      'matrix:json-declarations',
      'declaraction de JSON',
      missing.length === 0 ? 'pass' : 'fail',
      missing.length === 0
        ? 'todos os comandos com --json declaram producesJson=true.'
        : `gates com --json sem declaracao: ${missing.map((gate) => gate.id).join(', ')}`,
    );
  }

  private buildTiers(): DeterministicQaMatrixSnapshot['tiers'] {
    const quick = this.gates.filter((gate) => gate.tier === 'quick');
    const standardOwn = this.gates.filter((gate) => gate.tier === 'standard');
    const releaseOwn = this.gates.filter((gate) => gate.tier === 'release');
    const standard = [...quick, ...standardOwn];
    const release = [...standard, ...releaseOwn];
    return {
      quick: this.buildTier('quick', quick, 'npm run qa:deterministic -- --tier=quick'),
      standard: this.buildTier('standard', standard, 'npm run qa:deterministic -- --tier=standard'),
      release: this.buildTier('release', release, 'npm run qa:deterministic -- --tier=release'),
    };
  }

  private buildTier(
    tier: DeterministicQaTier,
    gates: DeterministicQaGateSpec[],
    command: string,
  ): DeterministicQaMatrixSnapshot['tiers'][DeterministicQaTier] {
    return {
      gates: gates.map((gate) => gate.id),
      maxDurationMs: gates.reduce((sum, gate) => sum + gate.maxDurationMs, 0),
      command,
    };
  }

  private readPackageJson(): PackageLike | null {
    if (this.packageJson) {
      return this.packageJson;
    }
    const targetPath = path.resolve(this.projectRoot, 'package.json');
    if (!this.existsSync(targetPath)) {
      return null;
    }
    try {
      return JSON.parse(this.readFileSync(targetPath, 'utf8')) as PackageLike;
    } catch (error: unknown) {logger.warn('[Deterministic Qa Matrix] JSON parse failed', error); return null; }
  }

  private check(
    id: string,
    title: string,
    status: DeterministicQaCheckStatus,
    reason: string,
    evidence: string[] = [],
  ): DeterministicQaCheck {
    return {
      id,
      title,
      status,
      reason,
      evidence,
    };
  }
}
