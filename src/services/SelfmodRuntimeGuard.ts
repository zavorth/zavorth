import type { SelfmodRuntimeRiskLevel, SelfmodRuntimeRiskReport } from '../contracts/SelfmodOptimizationContract.js';

const LAUNCHER_TOUCH_PATTERNS = [
  /^scripts\/launch-zavorth/i,
  /^scripts\/install-windows-startup\.ps1$/i,
  /^src\/index\.ts$/i,
  /^src\/host\.ts$/i,
  /^src\/services\/(Runtime|ZavorthGateway|WebAppService)/i,
  /^src\/domain\/surface\/presentation\/web-app\/WebAppRuntimeRouteService\.ts$/i,
];

const WATCHER_TOUCH_PATTERNS = [
  /^src\/services\/(Companion|DesktopResource|TaskResourcePlanner|ComputerUseWatchMode)/i,
  /^src\/services\/(Workspace|ContextResolver)/i,
  /^scripts\/essential-/i,
];

const UI_TOUCH_PATTERNS = [
  /^src\/services\/WebApp/i,
  /^src\/services\/ZavorthControl/i,
  /^src\/domain\/surface\/presentation\/web-console\//i,
  /^src\/domain\/surface\/presentation\/web-app\//i,
];

export class SelfmodRuntimeGuard {
  public assess(relativePaths: string[]): SelfmodRuntimeRiskReport {
    const normalizedPaths = relativePaths
      .map((entry) => String(entry || '').trim().replace(/\\/g, '/'))
      .filter(Boolean);

    if (normalizedPaths.length === 0) {
      return {
        level: 'low',
        score: 10,
        reasons: ['Changeset sem arquivos materiais; risco operacional baixo.'],
        requiresRestart: false,
        requiresSupervisorAttention: false,
        launcherTouch: false,
      };
    }

    const launcherTouch = normalizedPaths.some((entry) =>
      LAUNCHER_TOUCH_PATTERNS.some((pattern) => pattern.test(entry)),
    );
    const watcherTouch = normalizedPaths.some((entry) =>
      WATCHER_TOUCH_PATTERNS.some((pattern) => pattern.test(entry)),
    );
    const uiTouch = normalizedPaths.some((entry) =>
      UI_TOUCH_PATTERNS.some((pattern) => pattern.test(entry)),
    );
    const testOnly = normalizedPaths.every((entry) => entry.startsWith('tests/'));
    const configTouch = normalizedPaths.some((entry) => entry.startsWith('config/'));
    const serviceTouch = normalizedPaths.some((entry) => entry.startsWith('src/services/'));
    const scriptTouch = normalizedPaths.some((entry) => entry.startsWith('scripts/'));
    const wideChangeset = normalizedPaths.length >= 4;

    let score = 10;
    const reasons: string[] = [];

    if (testOnly) {
      score = 12;
      reasons.push('Changeset restrito a testes; risco operacional naturalmente baixo.');
    } else {
      if (serviceTouch) {
        score += 18;
        reasons.push('Mudanca em service pode alterar comportamento do runtime e das surfaces.');
      }
      if (configTouch) {
        score += 12;
        reasons.push('Mudanca em config pode alterar defaults e guardrails do runtime.');
      }
      if (scriptTouch) {
        score += 14;
        reasons.push('Mudanca em scripts pode afetar boot, manutencao ou automacoes locais.');
      }
      if (watcherTouch) {
        score += 14;
        reasons.push('Mudanca toca watchers/companions e pode refletir em IDEs ou loops de observacao.');
      }
      if (uiTouch) {
        score += 8;
        reasons.push('Mudanca toca UI/surface e pede revisao visual e funcional.');
      }
      if (launcherTouch) {
        score += 28;
        reasons.push('Mudanca toca launcher/runtime supervisionado e exige atencao extra no boot.');
      }
      if (wideChangeset) {
        score += 10;
        reasons.push('Changeset multi-arquivo aumenta a superficie de regressao e rollback.');
      }
    }

    const level = this.resolveRiskLevel(score);
    return {
      level,
      score,
      reasons,
      requiresRestart: launcherTouch || serviceTouch || scriptTouch,
      requiresSupervisorAttention: level === 'high' || level === 'critical' || launcherTouch,
      launcherTouch,
    };
  }

  private resolveRiskLevel(score: number): SelfmodRuntimeRiskLevel {
    if (score >= 75) {
      return 'critical';
    }
    if (score >= 55) {
      return 'high';
    }
    if (score >= 28) {
      return 'moderate';
    }
    return 'low';
  }
}
