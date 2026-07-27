import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';
import { logger } from '../logger.js';
import {
EXTERNAL_DOCS_FORBIDDEN_CLAIMS,
  EXTERNAL_DOCS_REQUIRED_COMMANDS,
  EXTERNAL_DOCS_REQUIRED_COPY,
  EXTERNAL_DOCS_REQUIRED_LINKS,
  EXTERNAL_DOCS_REQUIRED_SECTIONS,
  EXTERNAL_DOCS_SCREENSHOTS,
  type ExternalDocsCheck,
  type ExternalDocsCheckStatus,
  type ExternalDocsContractSnapshot,
} from '../contracts/ExternalDocsContract.js';

type PackageLike = {
  scripts?: Record<string, string>;
};

export type ExternalDocsContractServiceOptions = {
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

const WEBSITE_EXTERNAL_DOCS_SCRIPTS = ['external-docs', 'qa:external-docs'] as const;
const CORE_EXTERNAL_DOCS_SCRIPTS = ['external-docs', 'qa:external-docs', 'qa:external-docs'] as const;

export class ExternalDocsContractService {
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

  constructor(options: ExternalDocsContractServiceOptions = {}) {
    this.projectRoot = options.projectRoot || config.projectRoot;
    this.websiteRoot = options.websiteRoot || resolveDefaultWebsiteRoot(this.projectRoot);
    this.requireExport = Boolean(options.requireExport);
    this.requireScreenshots = Boolean(options.requireScreenshots);
    this.screenshotDir = options.screenshotDir || path.join(this.websiteRoot, '.qa', 'external-docs');
    this.files = options.files || {};
    this.existsSync = options.existsSync || fs.existsSync;
    this.readFileSync = options.readFileSync || fs.readFileSync;
    this.statSync = options.statSync || fs.statSync;
    this.now = options.now || (() => new Date());
  }

  public buildSnapshot(): ExternalDocsContractSnapshot {
    const checks = [
      this.checkWebsiteRoot(),
      ...this.checkWebsiteScripts(),
      ...this.checkCoreScripts(),
      this.checkRequiredFiles(),
      this.checkDocsContract(),
      this.checkExamplesContract(),
      this.checkPublicCommandContract(),
      this.checkPublicLinks(),
      this.checkForbiddenClaims(),
      this.checkExportedRoutes(),
      this.checkScreenshots(),
    ];
    const failed = checks.filter((check) => check.status === 'fail').length;
    const warnings = checks.filter((check) => check.status === 'warn').length;
    const passed = checks.filter((check) => check.status === 'pass').length;

    return {
      gate: 'external-docs',
      surface: 'external-docs',
      generatedAt: this.now().toISOString(),
      status: failed > 0 ? 'blocked' : warnings > 0 ? 'attention' : 'ready',
      websiteRoot: this.websiteRoot,
      summary: {
        ok: failed === 0,
        passed,
        warnings,
        failed,
      },
      routes: ['/docs', '/examples'],
      fixturePath: 'data/external-docs.ts',
      requiredSections: [...EXTERNAL_DOCS_REQUIRED_SECTIONS],
      requiredCommands: [...EXTERNAL_DOCS_REQUIRED_COMMANDS],
      screenshots: EXTERNAL_DOCS_SCREENSHOTS,
      checks,
      nextRecommendedGate: {
        gate: 'distribution-policy',
        title: 'Editions, Plans And Distribution Policy',
        reason:
          'With external docs and public examples organized, the next step is explaining edits, limits, and distribution policy.',
      },
    };
  }

  public renderReport(snapshot: ExternalDocsContractSnapshot = this.buildSnapshot()): string {
    const lines: string[] = [];
    lines.push('[external-docs] External Docs And Examples');
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

  private checkWebsiteRoot(): ExternalDocsCheck {
    const exists = this.existsSync(this.websiteRoot);
    return this.check(
      'external-docs:website-root',
      'base public zavorth-website',
      exists ? 'pass' : 'fail',
      exists ? 'repositorio zavorth-website encontrado para renderizar docs externas.'
        : 'zavorth-website repository was not found. Configure ZAVORTH_WEBSITE_REPO_ROOT.',
      this.websiteRoot,
    );
  }

  private checkWebsiteScripts(): ExternalDocsCheck[] {
    const scripts = this.readWebsiteJson('package.json')?.scripts || {};
    return WEBSITE_EXTERNAL_DOCS_SCRIPTS.map((scriptName) => {
      const command = String(scripts[scriptName] || '').trim();
      return this.check(
        `external-docs:website-script:${scriptName}`,
        `script do site ${scriptName}`,
        command ? 'pass' : 'fail',
        command ? `site exposes "${scriptName}" para validate docs externas.`
          : `site must expose "${scriptName}" no package.json.`,
        'package.json',
        [`script=${command || '<missing>'}`],
      );
    });
  }

  private checkCoreScripts(): ExternalDocsCheck[] {
    const scripts = this.readCoreJson('package.json')?.scripts || {};
    return CORE_EXTERNAL_DOCS_SCRIPTS.map((scriptName) => {
      const command = String(scripts[scriptName] || '').trim();
      return this.check(
        `external-docs:core-script:${scriptName}`,
        `script canonical ${scriptName}`,
        command ? 'pass' : 'fail',
        command ? `main repository exposes "${scriptName}" para o gate external-docs.`
          : `main repo must expose "${scriptName}" no package.json.`,
        'package.json',
        [`script=${command || '<missing>'}`],
      );
    });
  }

  private checkRequiredFiles(): ExternalDocsCheck {
    const required = [
      'app/docs/page.tsx',
      'app/examples/page.tsx',
      'data/external-docs.ts',
      'scripts/external-docs-check.mjs',
    ];
    const missing = required.filter((filePath) => !this.existsSync(path.join(this.websiteRoot, filePath)));
    return this.check(
      'external-docs:required-files',
      'rotas e fixture de docs externas',
      missing.length === 0 ? 'pass' : 'fail',
      missing.length === 0
        ? 'docs, exemplos, fixture e gate local existem.'
        : 'docs, exemplos, fixture ou gate local are missings.',
      undefined,
      missing,
    );
  }

  private checkDocsContract(): ExternalDocsCheck {
    const source = [
      this.readWebsiteText('app/docs/page.tsx') || '',
      this.readWebsiteText('data/external-docs.ts') || '',
    ].join('\n');
    const required = [
      ...EXTERNAL_DOCS_REQUIRED_COPY,
      ...EXTERNAL_DOCS_REQUIRED_SECTIONS.map((section) => `id="${section}"`),
    ];
    const missing = required.filter((phrase) => !source.includes(phrase));
    return this.check(
      'external-docs:docs-contract',
      'rota /docs external',
      missing.length === 0 ? 'pass' : 'fail',
      missing.length === 0
        ? '/docs covers installation, first-run, security, examples, troubleshooting, and maturity.'
        : '/docs perdeu copy ou section public obrigatoria.',
      'app/docs/page.tsx',
      missing.map((phrase) => `faltando: ${phrase}`),
    );
  }

  private checkExamplesContract(): ExternalDocsCheck {
    const source = [
      this.readWebsiteText('app/examples/page.tsx') || '',
      this.readWebsiteText('data/external-docs.ts') || '',
    ].join('\n');
    const required = [
      'Exemplos externos por caso de usage',
      'Engenharia',
      'Release',
      'Artifacts',
      'replay',
      'npm run chat',
      'npm run release:status:fast',
      'npm run status:fast',
      'guardrail',
      'engineering',
      'release',
      'replay-artifacts',
    ];
    const missing = required.filter((phrase) => !source.includes(phrase));
    return this.check(
      'external-docs:examples-contract',
      'rota /examples public',
      missing.length === 0 ? 'pass' : 'fail',
      missing.length === 0
        ? '/examples cobre engenharia, release, artifacts/replay e guardrails.'
        : '/examples perdeu caso de usage ou guardrail required.',
      'app/examples/page.tsx',
      missing.map((phrase) => `faltando: ${phrase}`),
    );
  }

  private checkPublicCommandContract(): ExternalDocsCheck {
    const scripts = this.readCoreJson('package.json')?.scripts || {};
    const docs = [
      this.readWebsiteText('app/docs/page.tsx') || '',
      this.readWebsiteText('data/external-docs.ts') || '',
      this.readWebsiteText('app/examples/page.tsx') || '',
    ].join('\n');
    const missingScripts = EXTERNAL_DOCS_REQUIRED_COMMANDS.filter((scriptName) => {
      if (scriptName === 'install') {
        return false;
      }
      return !String(scripts[scriptName] || '').trim();
    });
    const missingDocs = EXTERNAL_DOCS_REQUIRED_COMMANDS.filter((scriptName) => {
      const command = scriptName === 'install' ? 'npm install' : `npm run ${scriptName}`;
      return !docs.includes(command);
    });
    const evidence = [
      ...missingScripts.map((scriptName) => `script missing: ${scriptName}`),
      ...missingDocs.map((scriptName) => `doc without command: ${scriptName}`),
    ];
    return this.check(
      'external-docs:public-commands',
      'public commands documentados',
      evidence.length === 0 ? 'pass' : 'fail',
      evidence.length === 0
        ? 'public commands exist in core and appear in docs/examples.'
        : 'some documented public command does not exist or does not appear in the docs.',
      'package.json',
      evidence,
    );
  }

  private checkPublicLinks(): ExternalDocsCheck {
    const source = [
      'components/Navbar.tsx',
      'components/CTASection.tsx',
      'components/Footer.tsx',
      'app/docs/page.tsx',
      'app/examples/page.tsx',
      'app/changelog/page.tsx',
      'data/external-docs.ts',
    ].map((filePath) => this.readWebsiteText(filePath) || '').join('\n');
    const missing = EXTERNAL_DOCS_REQUIRED_LINKS.filter((href) => !source.includes(href));
    return this.check(
      'external-docs:public-links',
      'links de docs externas',
      missing.length === 0 ? 'pass' : 'fail',
      missing.length === 0
        ? 'public site connects docs, examples, demo, first-run, security, and privacy.'
        : 'public docs/examples links are absent.',
      undefined,
      missing.map((href) => `faltando: ${href}`),
    );
  }

  private checkForbiddenClaims(): ExternalDocsCheck {
    const source = [
      'app/docs/page.tsx',
      'app/examples/page.tsx',
      'data/external-docs.ts',
    ].map((filePath) => this.readWebsiteText(filePath) || '').join('\n');
    const forbiddenMatches = EXTERNAL_DOCS_FORBIDDEN_CLAIMS.filter((claim) => source.toLowerCase().includes(String(claim).toLowerCase()));
    const tokenMatches = source.match(/(^|[^A-Za-z])sk-[A-Za-z0-9_-]{12,}/g) || [];
    const pathMatches = source.match(/[A-Z]:\\[^'")\s]+/g) || [];
    const evidence = [...forbiddenMatches, ...tokenMatches, ...pathMatches];
    return this.check(
      'external-docs:forbidden-claims',
      'forbidden claims and leaks',
      evidence.length === 0 ? 'pass' : 'fail',
      evidence.length === 0
        ? 'external docs do not expose personal paths, tokens, or forbidden claims.'
        : 'docs externas contains path pessoal, token ou claim proibido.',
      undefined,
      evidence,
    );
  }

  private checkExportedRoutes(): ExternalDocsCheck {
    const outRoot = path.join(this.websiteRoot, 'out');
    if (!this.existsSync(outRoot)) {
      return this.check(
        'external-docs:exported-routes',
        'rotas docs/examples exportadas',
        this.requireExport ? 'fail' : 'pass',
        this.requireExport ? 'out/ must exist after website:build.'
          : 'static export not required in this snapshot; qa:external-docs valida /docs e /examples after do build.',
        'out',
      );
    }

    const specs = [
      { route: '/docs', filePath: this.resolveRouteOutput('/docs'), phrases: ['External docs', 'Feature maturity'] },
      { route: '/examples', filePath: this.resolveRouteOutput('/examples'), phrases: ['Exemplos externos por caso de usage', 'guardrail'] },
    ];
    const evidence: string[] = [];
    for (const spec of specs) {
      if (!spec.filePath) {
        evidence.push(`rota missing: ${spec.route}`);
        continue;
      }
      const html = this.safeReadAbsolute(spec.filePath);
      for (const phrase of spec.phrases) {
        if (!html.includes(phrase)) {
          evidence.push(`${spec.route} without ${phrase}`);
        }
      }
    }
    return this.check(
      'external-docs:exported-routes',
      'rotas docs/examples exportadas',
      evidence.length === 0 ? 'pass' : 'fail',
      evidence.length === 0
        ? '/docs and /examples exist in the static export with essential content.'
        : 'static build did not export complete docs/examples.',
      'out',
      evidence,
    );
  }

  private checkScreenshots(): ExternalDocsCheck {
    if (!this.requireScreenshots) {
      return this.check(
        'external-docs:screenshots',
        'screenshots de docs/examples',
        'pass',
        'screenshots not required in this snapshot; qa:external-docs captura desktop e mobile.',
        this.screenshotDir,
      );
    }

    const missing = EXTERNAL_DOCS_SCREENSHOTS.flatMap((screenshot) => {
      const target = path.join(this.screenshotDir, screenshot.fileName);
      if (!this.existsSync(target)) {
        return [`faltando: ${screenshot.fileName}`];
      }
      const size = this.statSync(target).size;
      return size > 10_000 ? [] : [`muito pequeno: ${screenshot.fileName} (${size} bytes)`];
    });
    return this.check(
      'external-docs:screenshots',
      'screenshots de docs/examples',
      missing.length === 0 ? 'pass' : 'fail',
      missing.length === 0
        ? 'screenshots desktop e mobile de docs/examples foram generated.'
        : 'screenshots desktop/mobile de docs/examples are missings ou invalids.',
      this.screenshotDir,
      missing,
    );
  }

  private resolveRouteOutput(route: '/docs' | '/examples'): string | null {
    const outRoot = path.join(this.websiteRoot, 'out');
    const clean = route.replace(/^\/+/, '');
    const candidates = [
      path.join(outRoot, `${clean}.html`),
      path.join(outRoot, clean, 'index.html'),
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
    } catch (error: unknown) {logger.warn('[External Docs Contract] JSON parse failed', error); return null; }
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
    } catch (error: unknown) {logger.warn('[External Docs Contract] filesystem operation failed', error); return ''; }
  }

  private check(
    id: string,
    title: string,
    status: ExternalDocsCheckStatus,
    reason: string,
    filePath?: string,
    evidence: string[] = [],
  ): ExternalDocsCheck {
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
