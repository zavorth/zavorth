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
        reasons: ['Changeset without files materiais; risk operational baixo.'],
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
      reasons.push('Changeset restrito a testes; risk operational naturalmente baixo.');
    } else {
      if (serviceTouch) {
        score += 18;
        reasons.push('Service changes can affect runtime and surface behavior.');
      }
      if (configTouch) {
        score += 12;
        reasons.push('Config changes can affect runtime defaults and guardrails.');
      }
      if (scriptTouch) {
        score += 14;
        reasons.push('Script changes can affect boot, maintenance, or local automations.');
      }
      if (watcherTouch) {
        score += 14;
        reasons.push('Change touches watchers or companions and can affect IDEs or observation loops.');
      }
      if (uiTouch) {
        score += 8;
        reasons.push('Change touches UI or surfaces and needs visual and functional review.');
      }
      if (launcherTouch) {
        score += 28;
        reasons.push('Change touches launcher or supervised runtime and needs extra boot attention.');
      }
      if (wideChangeset) {
        score += 10;
        reasons.push('Multi-file changeset increases regression and rollback surface.');
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
