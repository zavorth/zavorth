import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';
import { logger } from '../logger.js';
import {
PUBLIC_DEMO_FORBIDDEN_CLAIMS,
  PUBLIC_DEMO_REQUIRED_ARTIFACTS,
  PUBLIC_DEMO_REQUIRED_COPY,
  PUBLIC_DEMO_REQUIRED_STATES,
  PUBLIC_DEMO_SCREENSHOTS,
  type PublicDemoCheck,
  type PublicDemoCheckStatus,
  type PublicDemoContractSnapshot,
} from '../contracts/PublicDemoContract.js';

type PackageLike = {
  scripts?: Record<string, string>;
};

export type PublicDemoContractServiceOptions = {
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

const WEBSITE_DEMO_SCRIPTS = ['public-demo', 'qa:public-demo'] as const;
const CORE_DEMO_SCRIPTS = ['public-demo', 'qa:public-demo', 'qa:public-demo'] as const;

export class PublicDemoContractService {
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

  constructor(options: PublicDemoContractServiceOptions = {}) {
    this.projectRoot = options.projectRoot || config.projectRoot;
    this.websiteRoot = options.websiteRoot || resolveDefaultWebsiteRoot(this.projectRoot);
    this.requireExport = Boolean(options.requireExport);
    this.requireScreenshots = Boolean(options.requireScreenshots);
    this.screenshotDir = options.screenshotDir || path.join(this.websiteRoot, '.qa', 'public-demo');
    this.files = options.files || {};
    this.existsSync = options.existsSync || fs.existsSync;
    this.readFileSync = options.readFileSync || fs.readFileSync;
    this.statSync = options.statSync || fs.statSync;
    this.now = options.now || (() => new Date());
  }

  public buildSnapshot(): PublicDemoContractSnapshot {
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
      gate: 'public-demo',
      surface: 'public-demo',
      generatedAt: this.now().toISOString(),
      status: failed > 0 ? 'blocked' : warnings > 0 ? 'attention' : 'ready',
      websiteRoot: this.websiteRoot,
      summary: {
        ok: failed === 0,
        passed,
        warnings,
        failed,
      },
      route: '/demo',
      fixturePath: 'data/public-demo.ts',
      requiredStates: [...PUBLIC_DEMO_REQUIRED_STATES],
      requiredArtifacts: [...PUBLIC_DEMO_REQUIRED_ARTIFACTS],
      screenshots: PUBLIC_DEMO_SCREENSHOTS,
      checks,
      nextRecommendedGate: {
        gate: 'first-run-onboarding',
        title: 'Public Onboarding And First Run',
        reason:
          'after da demo fixture-first provar a historia public, o next passo e transformar interesse at primeiro usage local guiado.',
      },
    };
  }

  public renderReport(snapshot: PublicDemoContractSnapshot = this.buildSnapshot()): string {
    const lines: string[] = [];
    lines.push('[public-demo] Public Demo And Guided Story');
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
    lines.push(`next passo recomendada: ${snapshot.nextRecommendedGate.gate} - ${snapshot.nextRecommendedGate.title}`);
    lines.push(snapshot.nextRecommendedGate.reason);
    return lines.join('\n');
  }

  private checkWebsiteRoot(): PublicDemoCheck {
    const exists = this.existsSync(this.websiteRoot);
    return this.check(
      'demo:website-root',
      'base public zavorth-website',
      exists ? 'pass' : 'fail',
      exists ? 'repositorio zavorth-website encontrado para renderizar /demo.'
        : 'zavorth-website repository was not found. Configure ZAVORTH_WEBSITE_REPO_ROOT.',
      this.websiteRoot,
    );
  }

  private checkWebsiteScripts(): PublicDemoCheck[] {
    const scripts = this.readWebsiteJson('package.json')?.scripts || {};
    return WEBSITE_DEMO_SCRIPTS.map((scriptName) => {
      const command = String(scripts[scriptName] || '').trim();
      return this.check(
        `demo:website-script:${scriptName}`,
        `script do site ${scriptName}`,
        command ? 'pass' : 'fail',
        command ? `site exposes "${scriptName}" para validate a demo public.`
          : `site must expose "${scriptName}" no package.json.`,
        'package.json',
        [`script=${command || '<missing>'}`],
      );
    });
  }

  private checkCoreScripts(): PublicDemoCheck[] {
    const scripts = this.readCoreJson('package.json')?.scripts || {};
    return CORE_DEMO_SCRIPTS.map((scriptName) => {
      const command = String(scripts[scriptName] || '').trim();
      return this.check(
        `demo:core-script:${scriptName}`,
        `script canonical ${scriptName}`,
        command ? 'pass' : 'fail',
        command ? `main repo exposes "${scriptName}" para o gate public-demo.`
          : `main repo must expose "${scriptName}" no package.json.`,
        'package.json',
        [`script=${command || '<missing>'}`],
      );
    });
  }

  private checkRequiredFiles(): PublicDemoCheck {
    const required = ['app/demo/page.tsx', 'data/public-demo.ts', 'scripts/public-demo-check.mjs'];
    const missing = required.filter((filePath) => !this.existsSync(path.join(this.websiteRoot, filePath)));
    return this.check(
      'demo:required-files',
      'rota e fixture da demo',
      missing.length === 0 ? 'pass' : 'fail',
      missing.length === 0
        ? 'rota /demo, fixture e gate local existem.'
        : 'rota /demo, fixture ou gate local are missings.',
      undefined,
      missing,
    );
  }

  private checkFixtureContract(): PublicDemoCheck {
    const fixture = this.readWebsiteText('data/public-demo.ts') || '';
    const required = [...PUBLIC_DEMO_REQUIRED_STATES, ...PUBLIC_DEMO_REQUIRED_ARTIFACTS, 'without rede external obrigatoria'];
    const missing = required.filter((phrase) => !fixture.includes(phrase));
    return this.check(
      'demo:fixture-contract',
      'fixture safe da demo',
      missing.length === 0 ? 'pass' : 'fail',
      missing.length === 0
        ? 'fixture cobre estados, artifacts, replay e modo offline.'
        : 'fixture perdeu estado, artifact ou garantia offline obrigatoria.',
      'data/public-demo.ts',
      missing.map((phrase) => `faltando: ${phrase}`),
    );
  }

  private checkRouteContract(): PublicDemoCheck {
    const source = [
      this.readWebsiteText('app/demo/page.tsx') || '',
      this.readWebsiteText('data/public-demo.ts') || '',
    ].join('\n');
    const missing = PUBLIC_DEMO_REQUIRED_COPY.filter((phrase) => !source.includes(phrase));
    return this.check(
      'demo:route-contract',
      'rota /demo public',
      missing.length === 0 ? 'pass' : 'fail',
      missing.length === 0
        ? 'rota /demo renderiza historia guiada, estados e comparison public.'
        : '/demo route lost required copy or public block.',
      'app/demo/page.tsx',
      missing.map((phrase) => `faltando: ${phrase}`),
    );
  }

  private checkPublicLinks(): PublicDemoCheck {
    const source = [
      'components/Hero.tsx',
      'components/Navbar.tsx',
      'components/CTASection.tsx',
      'components/Footer.tsx',
      'app/docs/page.tsx',
      'app/changelog/page.tsx',
      'app/demo/page.tsx',
    ].map((filePath) => this.readWebsiteText(filePath) || '').join('\n');
    const required = ['/demo', '/docs#demo'];
    const missing = required.filter((href) => !source.includes(href));
    return this.check(
      'demo:public-links',
      'links para a demo',
      missing.length === 0 ? 'pass' : 'fail',
      missing.length === 0
        ? 'public site points to /demo and demo guide.'
        : 'public /demo or guide links are absent.',
      undefined,
      missing.map((href) => `faltando: ${href}`),
    );
  }

  private checkForbiddenClaims(): PublicDemoCheck {
    const source = [
      'app/demo/page.tsx',
      'data/public-demo.ts',
    ].map((filePath) => this.readWebsiteText(filePath) || '').join('\n');
    const forbiddenMatches = PUBLIC_DEMO_FORBIDDEN_CLAIMS.filter((claim) => source.toLowerCase().includes(String(claim).toLowerCase()));
    const tokenMatches = source.match(/(^|[^A-Za-z])sk-[A-Za-z0-9_-]{12,}/g) || [];
    const pathMatches = source.match(/[A-Z]:\\[^'")\s]+/g) || [];
    const evidence = [...forbiddenMatches, ...tokenMatches, ...pathMatches];
    return this.check(
      'demo:forbidden-claims',
      'forbidden claims and leaks',
      evidence.length === 0 ? 'pass' : 'fail',
      evidence.length === 0
        ? 'demo does not expose personal paths, tokens, or forbidden claims.'
        : 'demo contains personal path, token ou claim proibido.',
      undefined,
      evidence,
    );
  }

  private checkExportedRoute(): PublicDemoCheck {
    const outRoot = path.join(this.websiteRoot, 'out');
    if (!this.existsSync(outRoot)) {
      return this.check(
        'demo:exported-route',
        'rota /demo exportada',
        this.requireExport ? 'fail' : 'pass',
        this.requireExport ? 'out/ must exist after website:build.'
          : 'static export not required in this snapshot; qa:public-demo valida /demo after do build.',
        'out',
      );
    }
    const filePath = this.resolveDemoOutput();
    if (!filePath) {
      return this.check(
        'demo:exported-route',
        'rota /demo exportada',
        'fail',
        'static build did not export /demo.',
        'out',
        ['/demo'],
      );
    }
    const html = this.safeReadAbsolute(filePath);
    const missing = ['Build fix with approval and replay', 'Common chat', 'artifact'].filter((phrase) => !html.includes(phrase));
    return this.check(
      'demo:exported-route',
      'rota /demo exportada',
      missing.length === 0 ? 'pass' : 'fail',
      missing.length === 0
        ? '/demo exists in the static export with essential content.'
        : 'exported /demo lost essential content.',
      'out',
      missing.map((phrase) => `faltando: ${phrase}`),
    );
  }

  private checkScreenshots(): PublicDemoCheck {
    if (!this.requireScreenshots) {
      return this.check(
        'demo:screenshots',
        'screenshots da demo',
        'pass',
        'screenshots not required in this snapshot; qa:public-demo captura desktop e mobile.',
        this.screenshotDir,
      );
    }

    const missing = PUBLIC_DEMO_SCREENSHOTS.flatMap((screenshot) => {
      const target = path.join(this.screenshotDir, screenshot.fileName);
      if (!this.existsSync(target)) {
        return [`faltando: ${screenshot.fileName}`];
      }
      const size = this.statSync(target).size;
      return size > 10_000 ? [] : [`muito pequeno: ${screenshot.fileName} (${size} bytes)`];
    });
    return this.check(
      'demo:screenshots',
      'screenshots da demo',
      missing.length === 0 ? 'pass' : 'fail',
      missing.length === 0
        ? 'screenshots desktop e mobile da demo foram generated.'
        : 'screenshots desktop/mobile da demo are missings ou invalids.',
      this.screenshotDir,
      missing,
    );
  }

  private resolveDemoOutput(): string | null {
    const outRoot = path.join(this.websiteRoot, 'out');
    const candidates = [
      path.join(outRoot, 'demo.html'),
      path.join(outRoot, 'demo', 'index.html'),
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
    } catch (error: unknown) {logger.warn('[Public Demo Contract] JSON parse failed', error); return null; }
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
    } catch (error: unknown) {logger.warn('[Public Demo Contract] filesystem operation failed', error); return ''; }
  }

  private check(
    id: string,
    title: string,
    status: PublicDemoCheckStatus,
    reason: string,
    filePath?: string,
    evidence: string[] = [],
  ): PublicDemoCheck {
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
