import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';
import { logger } from '../logger.js';
import {
FIRST_RUN_FORBIDDEN_CLAIMS,
  FIRST_RUN_REQUIRED_ARTIFACTS,
  FIRST_RUN_REQUIRED_COPY,
  FIRST_RUN_REQUIRED_STATES,
  FIRST_RUN_SCREENSHOTS,
  type FirstRunOnboardingCheck,
  type FirstRunOnboardingCheckStatus,
  type FirstRunOnboardingContractSnapshot,
} from '../contracts/FirstRunOnboardingContract.js';

type PackageLike = {
  scripts?: Record<string, string>;
};

export type FirstRunOnboardingContractServiceOptions = {
  projectRoot?: string;
  websiteRoot?: string;
  requireExport?: boolean;
  requireScreenshots?: boolean;
  screenshotDir?: string;
  files?: Record<string, string>;
  existsSync?: (targetPath: string) => boolean;
  readFileSync?: (targetPath: string, encoding: BufferEncoding) => string;
  statSync?: (targetPath: string) => { size: number };
  now?: () => Date;
};

const WEBSITE_FIRST_RUN_SCRIPTS = ['first-run', 'qa:first-run'] as const;
const CORE_FIRST_RUN_SCRIPTS = ['first-run', 'qa:first-run', 'qa:first-run-onboarding'] as const;

export class FirstRunOnboardingContractService {
  private readonly projectRoot: string;
  private readonly websiteRoot: string;
  private readonly requireExport: boolean;
  private readonly requireScreenshots: boolean;
  private readonly screenshotDir: string;
  private readonly files: Record<string, string>;
  private readonly existsSync: (targetPath: string) => boolean;
  private readonly readFileSync: (targetPath: string, encoding: BufferEncoding) => string;
  private readonly statSync: (targetPath: string) => { size: number };
  private readonly now: () => Date;

  constructor(options: FirstRunOnboardingContractServiceOptions = {}) {
    this.projectRoot = options.projectRoot || config.projectRoot;
    this.websiteRoot = options.websiteRoot || resolveDefaultWebsiteRoot(this.projectRoot);
    this.requireExport = Boolean(options.requireExport);
    this.requireScreenshots = Boolean(options.requireScreenshots);
    this.screenshotDir = options.screenshotDir || path.join(this.websiteRoot, '.qa', 'first-run');
    this.files = options.files || {};
    this.existsSync = options.existsSync || fs.existsSync;
    this.readFileSync = options.readFileSync || fs.readFileSync;
    this.statSync = options.statSync || fs.statSync;
    this.now = options.now || (() => new Date());
  }

  public buildSnapshot(): FirstRunOnboardingContractSnapshot {
    const checks = [
      this.checkWebsiteRoot(),
      ...this.checkWebsiteScripts(),
      ...this.checkCoreScripts(),
      this.checkRequiredFiles(),
      this.checkFixtureContract(),
      this.checkRouteContract(),
      this.checkPublicLinks(),
      this.checkForbiddenClaims(),
      this.checkExportedRoute(),
      this.checkScreenshots(),
    ];
    const failed = checks.filter((check) => check.status === 'fail').length;
    const warnings = checks.filter((check) => check.status === 'warn').length;
    const passed = checks.filter((check) => check.status === 'pass').length;

    return {
      gate: 'first-run-onboarding',
      surface: 'first-run-onboarding',
      generatedAt: this.now().toISOString(),
      status: failed > 0 ? 'blocked' : warnings > 0 ? 'attention' : 'ready',
      websiteRoot: this.websiteRoot,
      summary: {
        ok: failed === 0,
        passed,
        warnings,
        failed,
      },
      route: '/start',
      fixturePath: 'data/first-run.ts',
      requiredStates: [...FIRST_RUN_REQUIRED_STATES],
      requiredArtifacts: [...FIRST_RUN_REQUIRED_ARTIFACTS],
      screenshots: FIRST_RUN_SCREENSHOTS,
      checks,
      nextRecommendedGate: {
        gate: 'external-docs',
        title: 'External Docs And Examples',
        reason:
          'after do public first-run mostrar como chegar ao primeiro usage local, o next passo e expandir docs externas e exemplos por caso de usage.',
      },
    };
  }

  public renderReport(snapshot: FirstRunOnboardingContractSnapshot = this.buildSnapshot()): string {
    const lines: string[] = [];
    lines.push('[first-run] Public Onboarding And First Run');
    lines.push(`status: ${snapshot.status}`);
    lines.push(`ok: ${snapshot.summary.ok ? 'yes' : 'no'} | pass=${snapshot.summary.passed} warn=${snapshot.summary.warnings} fail=${snapshot.summary.failed}`);
    lines.push(`website: ${snapshot.websiteRoot}`);
    lines.push('');
    for (const check of snapshot.checks) {
      const suffix = check.path ? ` (${check.path})` : '';
      lines.push(`[${check.status}] ${check.title}${suffix}`);
      lines.push(`  ${check.reason}`);
      for (const evidence of check.evidence || []) {
        lines.push(`  - ${evidence}`);
      }
    }
    lines.push('');
    lines.push(`next recommended step: ${snapshot.nextRecommendedGate.gate} - ${snapshot.nextRecommendedGate.title}`);
    lines.push(snapshot.nextRecommendedGate.reason);
    return lines.join('\n');
  }

  private checkWebsiteRoot(): FirstRunOnboardingCheck {
    const exists = this.existsSync(this.websiteRoot);
    return this.check(
      'first-run:website-root',
      'base public zavorth-website',
      exists ? 'pass' : 'fail',
      exists ? 'repositorio zavorth-website encontrado para renderizar /start.'
        : 'zavorth-website repository was not found. Configure ZAVORTH_WEBSITE_REPO_ROOT.',
      this.websiteRoot,
    );
  }

  private checkWebsiteScripts(): FirstRunOnboardingCheck[] {
    const scripts = this.readWebsiteJson('package.json')?.scripts || {};
    return WEBSITE_FIRST_RUN_SCRIPTS.map((scriptName) => {
      const command = String(scripts[scriptName] || '').trim();
      return this.check(
        `first-run:website-script:${scriptName}`,
        `script do site ${scriptName}`,
        command ? 'pass' : 'fail',
        command ? `site exposes "${scriptName}" to validate public first-run.`
          : `site must expose "${scriptName}" no package.json.`,
        'package.json',
        [`script=${command || '<missing>'}`],
      );
    });
  }

  private checkCoreScripts(): FirstRunOnboardingCheck[] {
    const scripts = this.readCoreJson('package.json')?.scripts || {};
    return CORE_FIRST_RUN_SCRIPTS.map((scriptName) => {
      const command = String(scripts[scriptName] || '').trim();
      return this.check(
        `first-run:core-script:${scriptName}`,
        `script canonical ${scriptName}`,
        command ? 'pass' : 'fail',
        command ? `main repository exposes "${scriptName}" para o gate first-run.`
          : `main repo must expose "${scriptName}" no package.json.`,
        'package.json',
        [`script=${command || '<missing>'}`],
      );
    });
  }

  private checkRequiredFiles(): FirstRunOnboardingCheck {
    const required = ['app/start/page.tsx', 'data/first-run.ts', 'scripts/first-run-check.mjs'];
    const missing = required.filter((filePath) => !this.existsSync(path.join(this.websiteRoot, filePath)));
    return this.check(
      'first-run:required-files',
      'rota e fixture do first-run',
      missing.length === 0 ? 'pass' : 'fail',
      missing.length === 0
        ? 'rota /start, fixture e gate local existem.'
        : 'rota /start, fixture ou gate local are missings.',
      undefined,
      missing,
    );
  }

  private checkFixtureContract(): FirstRunOnboardingCheck {
    const fixture = this.readWebsiteText('data/first-run.ts') || '';
    const required = [
      ...FIRST_RUN_REQUIRED_STATES,
      ...FIRST_RUN_REQUIRED_ARTIFACTS,
      'without credential external obrigatoria',
      'without watcher persistente por default',
    ];
    const missing = required.filter((phrase) => !fixture.includes(phrase));
    return this.check(
      'first-run:fixture-contract',
      'fixture safe do first-run',
      missing.length === 0 ? 'pass' : 'fail',
      missing.length === 0
        ? 'fixture covers requirements, preview, local mode, health, cleanup, and safety guarantees.'
        : 'fixture perdeu estado, artifact ou garantia obrigatoria.',
      'data/first-run.ts',
      missing.map((phrase) => `faltando: ${phrase}`),
    );
  }

  private checkRouteContract(): FirstRunOnboardingCheck {
    const source = [
      this.readWebsiteText('app/start/page.tsx') || '',
      this.readWebsiteText('data/first-run.ts') || '',
    ].join('\n');
    const missing = FIRST_RUN_REQUIRED_COPY.filter((phrase) => !source.includes(phrase));
    return this.check(
      'first-run:route-contract',
      'rota /start public',
      missing.length === 0 ? 'pass' : 'fail',
      missing.length === 0
        ? 'rota /start renderiza checklist, requisitos, preview, health check e cleanup.'
        : '/start route lost required text or public block.',
      'app/start/page.tsx',
      missing.map((phrase) => `faltando: ${phrase}`),
    );
  }

  private checkPublicLinks(): FirstRunOnboardingCheck {
    const source = [
      'components/Hero.tsx',
      'components/Navbar.tsx',
      'components/CTASection.tsx',
      'components/Footer.tsx',
      'app/docs/page.tsx',
      'app/demo/page.tsx',
      'app/start/page.tsx',
    ].map((filePath) => this.readWebsiteText(filePath) || '').join('\n');
    const required = ['/start', '/docs#first-run'];
    const missing = required.filter((href) => !source.includes(href));
    return this.check(
      'first-run:public-links',
      'links para first-run',
      missing.length === 0 ? 'pass' : 'fail',
      missing.length === 0
        ? 'public site points to /start and first-run guide.'
        : 'public /start or guide links are absent.',
      undefined,
      missing.map((href) => `faltando: ${href}`),
    );
  }

  private checkForbiddenClaims(): FirstRunOnboardingCheck {
    const source = [
      'app/start/page.tsx',
      'data/first-run.ts',
    ].map((filePath) => this.readWebsiteText(filePath) || '').join('\n');
    const forbiddenMatches = FIRST_RUN_FORBIDDEN_CLAIMS.filter((claim) => source.toLowerCase().includes(String(claim).toLowerCase()));
    const tokenMatches = source.match(/(^|[^A-Za-z])sk-[A-Za-z0-9_-]{12,}/g) || [];
    const pathMatches = source.match(/[A-Z]:\\[^'")\s]+/g) || [];
    const evidence = [...forbiddenMatches, ...tokenMatches, ...pathMatches];
    return this.check(
      'first-run:forbidden-claims',
      'forbidden claims and leaks',
      evidence.length === 0 ? 'pass' : 'fail',
      evidence.length === 0
        ? 'first-run does not expose personal paths, tokens, or forbidden claims.'
        : 'first-run contains path pessoal, token ou claim proibido.',
      undefined,
      evidence,
    );
  }

  private checkExportedRoute(): FirstRunOnboardingCheck {
    const outRoot = path.join(this.websiteRoot, 'out');
    if (!this.existsSync(outRoot)) {
      return this.check(
        'first-run:exported-route',
        'rota /start exportada',
        this.requireExport ? 'fail' : 'pass',
        this.requireExport ? 'out/ must exist after website:build.'
          : 'static export not required in this snapshot; qa:first-run valida /start after do build.',
        'out',
      );
    }
    const filePath = this.resolveStartOutput();
    if (!filePath) {
      return this.check(
        'first-run:exported-route',
        'rota /start exportada',
        'fail',
        'static build did not export /start.',
        'out',
        ['/start'],
      );
    }
    const html = this.safeReadAbsolute(filePath);
    const missing = ['Primeiro usage local', 'Health check', 'cleanup'].filter((phrase) => !html.includes(phrase));
    return this.check(
      'first-run:exported-route',
      'rota /start exportada',
      missing.length === 0 ? 'pass' : 'fail',
      missing.length === 0
        ? '/start exists in the static export with essential content.'
        : 'exported /start lost essential content.',
      'out',
      missing.map((phrase) => `faltando: ${phrase}`),
    );
  }

  private checkScreenshots(): FirstRunOnboardingCheck {
    if (!this.requireScreenshots) {
      return this.check(
        'first-run:screenshots',
        'screenshots do first-run',
        'pass',
        'screenshots not required in this snapshot; qa:first-run captura desktop e mobile.',
        this.screenshotDir,
      );
    }

    const missing = FIRST_RUN_SCREENSHOTS.flatMap((screenshot) => {
      const target = path.join(this.screenshotDir, screenshot.fileName);
      if (!this.existsSync(target)) {
        return [`faltando: ${screenshot.fileName}`];
      }
      const size = this.statSync(target).size;
      return size > 10_000 ? [] : [`muito pequeno: ${screenshot.fileName} (${size} bytes)`];
    });
    return this.check(
      'first-run:screenshots',
      'screenshots do first-run',
      missing.length === 0 ? 'pass' : 'fail',
      missing.length === 0
        ? 'screenshots desktop e mobile do first-run foram generated.'
        : 'screenshots desktop/mobile do first-run are missings ou invalids.',
      this.screenshotDir,
      missing,
    );
  }

  private resolveStartOutput(): string | null {
    const outRoot = path.join(this.websiteRoot, 'out');
    const candidates = [
      path.join(outRoot, 'start.html'),
      path.join(outRoot, 'start', 'index.html'),
    ];
    return candidates.find((candidate) => this.existsSync(candidate)) || null;
  }

  private readWebsiteJson(relativePath: string): PackageLike | null {
    return this.readJson(this.websiteRoot, relativePath);
  }

  private readCoreJson(relativePath: string): PackageLike | null {
    return this.readJson(this.projectRoot, relativePath);
  }

  private readJson(root: string, relativePath: string): PackageLike | null {
    const raw = this.readTextFromRoot(root, relativePath);
    if (!raw) {
      return null;
    }
    try {
      return JSON.parse(raw) as PackageLike;
    } catch (error: unknown) {logger.warn('[First Run Onboarding Contract] JSON parse failed', error); return null; }
  }

  private readWebsiteText(relativePath: string): string | null {
    return this.readTextFromRoot(this.websiteRoot, relativePath);
  }

  private readTextFromRoot(root: string, relativePath: string): string | null {
    const normalized = relativePath.replace(/\\/g, '/');
    const key = `${root === this.websiteRoot ? 'website:' : 'core:'}${normalized}`;
    if (Object.prototype.hasOwnProperty.call(this.files, key)) {
      return this.files[key];
    }
    if (Object.prototype.hasOwnProperty.call(this.files, normalized)) {
      return this.files[normalized];
    }
    const targetPath = path.resolve(root, normalized);
    if (!this.existsSync(targetPath)) {
      return null;
    }
    return this.readFileSync(targetPath, 'utf8');
  }

  private safeReadAbsolute(filePath: string): string {
    try {
      return this.readFileSync(filePath, 'utf8');
    } catch (error: unknown) {logger.warn('[First Run Onboarding Contract] filesystem operation failed', error); return ''; }
  }

  private check(
    id: string,
    title: string,
    status: FirstRunOnboardingCheckStatus,
    reason: string,
    filePath?: string,
    evidence: string[] = [],
  ): FirstRunOnboardingCheck {
    return { id, title, status, reason, path: filePath, evidence };
  }
}

function resolveDefaultWebsiteRoot(projectRoot: string): string {
  const override = String(process.env.ZAVORTH_WEBSITE_REPO_ROOT || '').trim();
  if (override) {
    return path.resolve(override);
  }
  return path.resolve(projectRoot, '..', '..', 'zavorth-website');
}
