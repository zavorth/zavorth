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
const CORE_DEMO_SCRIPTS = ['public-demo', 'qa:public-demo', 'qa:phase:47'] as const;

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
      phase: '47',
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
      nextRecommendedPhase: {
        phase: '48',
        title: 'Public Onboarding And First Run',
        reason:
          'Depois da demo fixture-first provar a historia publica, o proximo passo e transformar interesse em primeiro uso local guiado.',
      },
    };
  }

  public renderReport(snapshot: PublicDemoContractSnapshot = this.buildSnapshot()): string {
    const lines: string[] = [];
    lines.push('[public-demo] Etapa 47 - Public Demo And Guided Story');
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
    lines.push(`proximo passo recomendada: ${snapshot.nextRecommendedPhase.phase} - ${snapshot.nextRecommendedPhase.title}`);
    lines.push(snapshot.nextRecommendedPhase.reason);
    return lines.join('\n');
  }

  private checkWebsiteRoot(): PublicDemoCheck {
    const exists = this.existsSync(this.websiteRoot);
    return this.check(
      'demo:website-root',
      'base publica zavorth-website',
      exists ? 'pass' : 'fail',
      exists
        ? 'repositorio zavorth-website encontrado para renderizar /demo.'
        : 'repositorio zavorth-website nao foi encontrado. Configure ZAVORTH_WEBSITE_REPO_ROOT.',
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
        command
          ? `site expoe "${scriptName}" para validar a demo publica.`
          : `site precisa expor "${scriptName}" no package.json.`,
        'package.json',
        [`script=${command || '<ausente>'}`],
      );
    });
  }

  private checkCoreScripts(): PublicDemoCheck[] {
    const scripts = this.readCoreJson('package.json')?.scripts || {};
    return CORE_DEMO_SCRIPTS.map((scriptName) => {
      const command = String(scripts[scriptName] || '').trim();
      return this.check(
        `demo:core-script:${scriptName}`,
        `script canonico ${scriptName}`,
        command ? 'pass' : 'fail',
        command
          ? `repo principal expoe "${scriptName}" para a Etapa 47.`
          : `repo principal precisa expor "${scriptName}" no package.json.`,
        'package.json',
        [`script=${command || '<ausente>'}`],
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
        : 'rota /demo, fixture ou gate local estao ausentes.',
      undefined,
      missing,
    );
  }

  private checkFixtureContract(): PublicDemoCheck {
    const fixture = this.readWebsiteText('data/public-demo.ts') || '';
    const required = [...PUBLIC_DEMO_REQUIRED_STATES, ...PUBLIC_DEMO_REQUIRED_ARTIFACTS, 'sem rede externa obrigatoria'];
    const missing = required.filter((phrase) => !fixture.includes(phrase));
    return this.check(
      'demo:fixture-contract',
      'fixture segura da demo',
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
      'rota /demo publica',
      missing.length === 0 ? 'pass' : 'fail',
      missing.length === 0
        ? 'rota /demo renderiza historia guiada, estados e comparacao publica.'
        : 'rota /demo perdeu texto ou bloco publico obrigatorio.',
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
        ? 'site publico aponta para /demo e roteiro da demo.'
        : 'links publicos para /demo ou roteiro estao ausentes.',
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
      'claims e vazamentos proibidos',
      evidence.length === 0 ? 'pass' : 'fail',
      evidence.length === 0
        ? 'demo nao expoe paths pessoais, tokens ou claims proibidos.'
        : 'demo contem path pessoal, token ou claim proibido.',
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
        this.requireExport
          ? 'out/ precisa existir depois de website:build.'
          : 'export estatico nao exigido neste snapshot; qa:public-demo valida /demo depois do build.',
        'out',
      );
    }
    const filePath = this.resolveDemoOutput();
    if (!filePath) {
      return this.check(
        'demo:exported-route',
        'rota /demo exportada',
        'fail',
        'build estatico nao exportou /demo.',
        'out',
        ['/demo'],
      );
    }
    const html = this.safeReadAbsolute(filePath);
    const missing = ['Build fix com aprovacao e replay', 'Chat comum', 'artifact'].filter((phrase) => !html.includes(phrase));
    return this.check(
      'demo:exported-route',
      'rota /demo exportada',
      missing.length === 0 ? 'pass' : 'fail',
      missing.length === 0
        ? '/demo existe no export estatico com conteudo essencial.'
        : '/demo exportado perdeu conteudo essencial.',
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
        'screenshots nao exigidos neste snapshot; qa:public-demo captura desktop e mobile.',
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
        ? 'screenshots desktop e mobile da demo foram gerados.'
        : 'screenshots desktop/mobile da demo estao ausentes ou invalidos.',
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
