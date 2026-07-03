import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';
import {
  WEB_APP_POLISH_CONTRACTS,
  WEB_APP_POLISH_PACKAGE_SCRIPTS,
  WEB_APP_POLISH_REQUIREMENTS,
  type WebAppPolishAsset,
  type WebAppPolishCheck,
  type WebAppPolishCheckStatus,
  type WebAppPolishRequirementSpec,
  type WebAppPolishSnapshot,
} from '../contracts/WebAppPolishContract.js';
import { buildRuntimeShellHtml } from '../domain/surface/presentation/web-console/WebConsoleRuntimeShellHtml.js';
import { buildRuntimeShellScript } from '../domain/surface/presentation/web-console/WebConsoleRuntimeShellScript.js';
import { buildRuntimeShellStyles } from '../domain/surface/presentation/web-console/WebConsoleRuntimeShellStyles.js';

type PackageLike = {
  scripts?: Record<string, string>;
};

export type WebAppPolishContractServiceOptions = {
  projectRoot?: string;
  packageJson?: PackageLike;
  html?: string;
  script?: string;
  styles?: string;
  requirements?: WebAppPolishRequirementSpec[];
  existsSync?: (targetPath: string) => boolean;
  readFileSync?: (targetPath: string, encoding: BufferEncoding) => string;
  now?: () => Date;
};

export class WebAppPolishContractService {
  private readonly projectRoot: string;
  private readonly packageJson: PackageLike | null;
  private readonly html: string | null;
  private readonly script: string | null;
  private readonly styles: string | null;
  private readonly requirements: WebAppPolishRequirementSpec[];
  private readonly existsSync: (targetPath: string) => boolean;
  private readonly readFileSync: (targetPath: string, encoding: BufferEncoding) => string;
  private readonly now: () => Date;

  constructor(options: WebAppPolishContractServiceOptions = {}) {
    this.projectRoot = options.projectRoot || config.projectRoot;
    this.packageJson = options.packageJson || null;
    this.html = Object.prototype.hasOwnProperty.call(options, 'html') ? options.html || '' : null;
    this.script = Object.prototype.hasOwnProperty.call(options, 'script') ? options.script || '' : null;
    this.styles = Object.prototype.hasOwnProperty.call(options, 'styles') ? options.styles || '' : null;
    this.requirements = options.requirements || WEB_APP_POLISH_REQUIREMENTS;
    this.existsSync = options.existsSync || fs.existsSync;
    this.readFileSync = options.readFileSync || ((targetPath, encoding) => fs.readFileSync(targetPath, encoding));
    this.now = options.now || (() => new Date());
  }

  public buildSnapshot(): WebAppPolishSnapshot {
    const checks = [
      ...this.requirements.map((requirement) => this.checkRequirement(requirement)),
      ...this.checkPackageScripts(),
    ];
    const failed = checks.filter((check) => check.status === 'fail').length;
    const warnings = checks.filter((check) => check.status === 'warn').length;
    const passed = checks.filter((check) => check.status === 'pass').length;

    return {
      phase: '40',
      surface: 'web-app-polish',
      generatedAt: this.now().toISOString(),
      status: failed > 0 ? 'blocked' : warnings > 0 ? 'attention' : 'ready',
      summary: {
        ok: failed === 0,
        passed,
        warnings,
        failed,
        requirements: this.requirements.length,
      },
      requirements: this.requirements,
      checks,
      contracts: WEB_APP_POLISH_CONTRACTS,
      commands: {
        inspect: 'npm run web:polish',
        json: 'npm run web:polish -- --json',
        gate: 'npm run qa:web-app-polish',
        webQa: 'npm run test:web:qa',
      },
      nextRecommendedPhase: {
        phase: '43',
        title: 'Artifact And Replay Workbench',
        reason:
          'Depois de polir a web/app como superficie de produto, a proximo passo combinada aprofunda artifacts, replay e comparacao de runs.',
      },
    };
  }

  public renderReport(snapshot: WebAppPolishSnapshot = this.buildSnapshot()): string {
    const lines: string[] = [];
    lines.push('[web-app-polish] Etapa 40 - Web/App Polish');
    lines.push(`status: ${snapshot.status}`);
    lines.push(`ok: ${snapshot.summary.ok ? 'yes' : 'no'} | pass=${snapshot.summary.passed} warn=${snapshot.summary.warnings} fail=${snapshot.summary.failed}`);
    lines.push('');
    for (const check of snapshot.checks) {
      lines.push(`[${check.status}] ${check.title} (${check.asset})`);
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

  private checkRequirement(requirement: WebAppPolishRequirementSpec): WebAppPolishCheck {
    const content = this.readAsset(requirement.asset);
    const missing = requirement.requiredMarkers.filter((marker) => !content.includes(marker));
    return this.check(
      `requirement:${requirement.id}`,
      requirement.title,
      missing.length === 0 ? 'pass' : 'fail',
      missing.length === 0
        ? requirement.reason
        : `${requirement.reason} Marcadores ausentes precisam voltar para a superficie.`,
      requirement.asset,
      missing.map((marker) => `faltando: ${marker}`),
    );
  }

  private checkPackageScripts(): WebAppPolishCheck[] {
    const scripts = this.readPackageJson()?.scripts || {};
    return WEB_APP_POLISH_PACKAGE_SCRIPTS.map((scriptName) => {
      const command = String(scripts[scriptName] || '').trim();
      return this.check(
        `package:${scriptName}`,
        `script ${scriptName}`,
        command ? 'pass' : 'fail',
        command
          ? `package.json expoe ${scriptName} para a Etapa 40.`
          : `package.json precisa expor ${scriptName}.`,
        'package',
        [`command=${command || '<ausente>'}`],
      );
    });
  }

  private readAsset(asset: WebAppPolishAsset): string {
    if (asset === 'html') {
      return this.html !== null ? this.html : buildRuntimeShellHtml('/zavorthControl');
    }
    if (asset === 'script') {
      return this.script !== null ? this.script : buildRuntimeShellScript();
    }
    if (asset === 'styles') {
      return this.styles !== null ? this.styles : buildRuntimeShellStyles();
    }
    return JSON.stringify(this.readPackageJson() || {});
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
    status: WebAppPolishCheckStatus,
    reason: string,
    asset: WebAppPolishAsset,
    evidence: string[] = [],
  ): WebAppPolishCheck {
    return {
      id,
      title,
      status,
      reason,
      asset,
      evidence,
    };
  }
}
