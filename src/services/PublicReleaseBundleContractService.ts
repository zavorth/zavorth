import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';
import { logger } from '../logger.js';
import {
PUBLIC_RELEASE_BUNDLE_FORBIDDEN_CLAIMS,
  PUBLIC_RELEASE_BUNDLE_REQUIRED_COMMANDS,
  PUBLIC_RELEASE_BUNDLE_REQUIRED_COPY,
  PUBLIC_RELEASE_BUNDLE_REQUIRED_LINKS,
  PUBLIC_RELEASE_BUNDLE_SCREENSHOTS,
  type PublicReleaseBundleCheck,
  type PublicReleaseBundleCheckStatus,
  type PublicReleaseBundleContractSnapshot,
} from '../contracts/PublicReleaseBundleContract.js';

type PackageLike = {
  scripts?: Record<string, string>;
};

export type PublicReleaseBundleContractServiceOptions = {
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

const WEBSITE_RELEASE_BUNDLE_SCRIPTS = ['release-bundle', 'qa:release-bundle'] as const;
const CORE_RELEASE_BUNDLE_SCRIPTS = ['release-bundle', 'qa:release-bundle', 'qa:public-release-bundle'] as const;

export class PublicReleaseBundleContractService {
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

  constructor(options: PublicReleaseBundleContractServiceOptions = {}) {
    this.projectRoot = options.projectRoot || config.projectRoot;
    this.websiteRoot = options.websiteRoot || resolveDefaultWebsiteRoot(this.projectRoot);
    this.requireExport = Boolean(options.requireExport);
    this.requireScreenshots = Boolean(options.requireScreenshots);
    this.screenshotDir = options.screenshotDir || path.join(this.websiteRoot, '.qa', 'release-bundle');
    this.files = options.files || {};
    this.existsSync = options.existsSync || fs.existsSync;
    this.readFileSync = options.readFileSync || fs.readFileSync;
    this.statSync = options.statSync || fs.statSync;
    this.now = options.now || (() => new Date());
  }

  public buildSnapshot(): PublicReleaseBundleContractSnapshot {
    const checks = [
      this.checkWebsiteRoot(),
      ...this.checkWebsiteScripts(),
      ...this.checkCoreScripts(),
      this.checkRequiredFiles(),
      this.checkReleaseContract(),
      this.checkPublicCommandContract(),
      this.checkPublicLinks(),
      this.checkForbiddenClaims(),
      this.checkExportedRoute(),
      this.checkScreenshots(),
    ];
    const failed = checks.filter((check) => check.status === 'fail').length;
    const warnings = checks.filter((check) => check.status === 'warn').length;
    const passed = checks.filter((check) => check.status === 'pass').length;

    return {
      gate: 'public-release-bundle',
      surface: 'release-bundle',
      generatedAt: this.now().toISOString(),
      status: failed > 0 ? 'blocked' : warnings > 0 ? 'attention' : 'ready',
      websiteRoot: this.websiteRoot,
      summary: {
        ok: failed === 0,
        passed,
        warnings,
        failed,
      },
      route: '/release',
      fixturePath: 'data/release-bundle.ts',
      requiredCommands: [...PUBLIC_RELEASE_BUNDLE_REQUIRED_COMMANDS],
      screenshots: PUBLIC_RELEASE_BUNDLE_SCREENSHOTS,
      checks,
      nextRecommendedGate: {
        gate: 'feedback-telemetry',
        title: 'Feedback, Telemetry Opt-In And Product Loop',
        reason:
          'Com bundle e installer verificaveis, o proximo passo e abrir feedback e telemetry opt-in sem quebrar soberania local.',
      },
    };
  }

  public renderReport(snapshot: PublicReleaseBundleContractSnapshot = this.buildSnapshot()): string {
    const lines: string[] = [];
    lines.push('[release-bundle] Readiness checkpoint 1 - Release Bundle And Installer Distribution');
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
    lines.push(`proximo passo recomendada: ${snapshot.nextRecommendedGate.gate} - ${snapshot.nextRecommendedGate.title}`);
    lines.push(snapshot.nextRecommendedGate.reason);
    return lines.join('\n');
  }

  private checkWebsiteRoot(): PublicReleaseBundleCheck {
    const exists = this.existsSync(this.websiteRoot);
    return this.check(
      'release-bundle:website-root',
      'base publica zavorth-website',
      exists ? 'pass' : 'fail',
      exists
        ? 'repositorio zavorth-website encontrado para renderizar /release.'
        : 'repositorio zavorth-website nao foi encontrado. Configure ZAVORTH_WEBSITE_REPO_ROOT.',
      this.websiteRoot,
    );
  }

  private checkWebsiteScripts(): PublicReleaseBundleCheck[] {
    const scripts = this.readWebsiteJson('package.json')?.scripts || {};
    return WEBSITE_RELEASE_BUNDLE_SCRIPTS.map((scriptName) => {
      const command = String(scripts[scriptName] || '').trim();
      return this.check(
        `release-bundle:website-script:${scriptName}`,
        `script do site ${scriptName}`,
        command ? 'pass' : 'fail',
        command
          ? `site expoe "${scriptName}" para validar bundle publico.`
          : `site precisa expor "${scriptName}" no package.json.`,
        'package.json',
        [`script=${command || '<ausente>'}`],
      );
    });
  }

  private checkCoreScripts(): PublicReleaseBundleCheck[] {
    const scripts = this.readCoreJson('package.json')?.scripts || {};
    return CORE_RELEASE_BUNDLE_SCRIPTS.map((scriptName) => {
      const command = String(scripts[scriptName] || '').trim();
      return this.check(
        `release-bundle:core-script:${scriptName}`,
        `script canonico ${scriptName}`,
        command ? 'pass' : 'fail',
        command
          ? `repo principal expoe "${scriptName}" para a Readiness checkpoint 1.`
          : `repo principal precisa expor "${scriptName}" no package.json.`,
        'package.json',
        [`script=${command || '<ausente>'}`],
      );
    });
  }

  private checkRequiredFiles(): PublicReleaseBundleCheck {
    const required = ['app/release/page.tsx', 'data/release-bundle.ts', 'scripts/release-bundle-check.mjs'];
    const missing = required.filter((filePath) => !this.existsSync(path.join(this.websiteRoot, filePath)));
    return this.check(
      'release-bundle:required-files',
      'rota e fixture de release bundle',
      missing.length === 0 ? 'pass' : 'fail',
      missing.length === 0
        ? 'rota /release, fixture e gate local existem.'
        : 'rota /release, fixture ou gate local estao ausentes.',
      undefined,
      missing,
    );
  }

  private checkReleaseContract(): PublicReleaseBundleCheck {
    const source = [
      this.readWebsiteText('app/release/page.tsx') || '',
      this.readWebsiteText('data/release-bundle.ts') || '',
    ].join('\n');
    const missing = PUBLIC_RELEASE_BUNDLE_REQUIRED_COPY.filter((phrase) => !source.includes(phrase));
    return this.check(
      'release-bundle:route-contract',
      'rota /release publica',
      missing.length === 0 ? 'pass' : 'fail',
      missing.length === 0
        ? '/release cobre bundle, digest, installer preview, smoke, rollback e changelog.'
        : '/release perdeu copy ou bloco publico obrigatorio.',
      'app/release/page.tsx',
      missing.map((phrase) => `faltando: ${phrase}`),
    );
  }

  private checkPublicCommandContract(): PublicReleaseBundleCheck {
    const scripts = this.readCoreJson('package.json')?.scripts || {};
    const docs = [
      this.readWebsiteText('app/release/page.tsx') || '',
      this.readWebsiteText('data/release-bundle.ts') || '',
      this.readWebsiteText('app/docs/page.tsx') || '',
    ].join('\n');
    const missingScripts = PUBLIC_RELEASE_BUNDLE_REQUIRED_COMMANDS.filter((scriptName) => !String(scripts[scriptName] || '').trim());
    const missingDocs = PUBLIC_RELEASE_BUNDLE_REQUIRED_COMMANDS.filter((scriptName) => !docs.includes(`npm run ${scriptName}`));
    const evidence = [
      ...missingScripts.map((scriptName) => `script ausente: ${scriptName}`),
      ...missingDocs.map((scriptName) => `doc sem comando: ${scriptName}`),
    ];
    return this.check(
      'release-bundle:public-commands',
      'comandos de release documentados',
      evidence.length === 0 ? 'pass' : 'fail',
      evidence.length === 0
        ? 'comandos de release existem no core e aparecem na rota/docs publicas.'
        : 'algum comando de release documentado nao existe ou nao aparece na docs.',
      'package.json',
      evidence,
    );
  }

  private checkPublicLinks(): PublicReleaseBundleCheck {
    const source = [
      'components/Navbar.tsx',
      'components/CTASection.tsx',
      'components/Footer.tsx',
      'app/docs/page.tsx',
      'app/examples/page.tsx',
      'app/editions/page.tsx',
      'app/changelog/page.tsx',
      'data/external-docs.ts',
    ].map((filePath) => this.readWebsiteText(filePath) || '').join('\n');
    const missing = PUBLIC_RELEASE_BUNDLE_REQUIRED_LINKS.filter((href) => !source.includes(href));
    return this.check(
      'release-bundle:public-links',
      'links de release bundle',
      missing.length === 0 ? 'pass' : 'fail',
      missing.length === 0
        ? 'site publico conecta release, docs, changelog e policy.'
        : 'links publicos de release bundle estao ausentes.',
      undefined,
      missing.map((href) => `faltando: ${href}`),
    );
  }

  private checkForbiddenClaims(): PublicReleaseBundleCheck {
    const source = [
      'app/release/page.tsx',
      'data/release-bundle.ts',
    ].map((filePath) => this.readWebsiteText(filePath) || '').join('\n');
    const forbiddenMatches = PUBLIC_RELEASE_BUNDLE_FORBIDDEN_CLAIMS.filter((claim) => source.toLowerCase().includes(String(claim).toLowerCase()));
    const tokenMatches = source.match(/(^|[^A-Za-z])sk-[A-Za-z0-9_-]{12,}/g) || [];
    const pathMatches = source.match(/[A-Z]:\\[^'")\s]+/g) || [];
    const evidence = [...forbiddenMatches, ...tokenMatches, ...pathMatches];
    return this.check(
      'release-bundle:forbidden-claims',
      'claims e vazamentos proibidos',
      evidence.length === 0 ? 'pass' : 'fail',
      evidence.length === 0
        ? 'release bundle nao expoe paths pessoais, tokens ou claims proibidos.'
        : 'release bundle contem path pessoal, token ou claim proibido.',
      undefined,
      evidence,
    );
  }

  private checkExportedRoute(): PublicReleaseBundleCheck {
    const outRoot = path.join(this.websiteRoot, 'out');
    if (!this.existsSync(outRoot)) {
      return this.check(
        'release-bundle:exported-route',
        'rota /release exportada',
        this.requireExport ? 'fail' : 'pass',
        this.requireExport
          ? 'out/ precisa existir depois de website:build.'
          : 'export estatico nao exigido neste snapshot; qa:release-bundle valida /release depois do build.',
        'out',
      );
    }
    const filePath = this.resolveReleaseOutput();
    if (!filePath) {
      return this.check(
        'release-bundle:exported-route',
        'rota /release exportada',
        this.requireExport ? 'fail' : 'warn',
        this.requireExport
          ? 'build estatico nao exportou /release.'
          : 'out/ existe, mas ainda nao contem /release; qa:release-bundle valida a rota depois do build.',
        'out',
        ['/release'],
      );
    }
    const html = this.safeReadAbsolute(filePath);
    const missing = ['Release bundle and installer distribution', 'zavorth-v0.1-preview.zip', 'Installer preview'].filter((phrase) => !html.includes(phrase));
    return this.check(
      'release-bundle:exported-route',
      'rota /release exportada',
      missing.length === 0 ? 'pass' : this.requireExport ? 'fail' : 'warn',
      missing.length === 0
        ? '/release existe no export estatico com conteudo essencial.'
        : this.requireExport
          ? '/release exportado perdeu conteudo essencial.'
          : 'out/ parece stale e ainda nao contem o conteudo novo de /release.',
      'out',
      missing.map((phrase) => `faltando: ${phrase}`),
    );
  }

  private checkScreenshots(): PublicReleaseBundleCheck {
    if (!this.requireScreenshots) {
      return this.check(
        'release-bundle:screenshots',
        'screenshots de release bundle',
        'pass',
        'screenshots nao exigidos neste snapshot; qa:release-bundle captura desktop e mobile.',
        this.screenshotDir,
      );
    }

    const missing = PUBLIC_RELEASE_BUNDLE_SCREENSHOTS.flatMap((screenshot) => {
      const target = path.join(this.screenshotDir, screenshot.fileName);
      if (!this.existsSync(target)) {
        return [`faltando: ${screenshot.fileName}`];
      }
      const size = this.statSync(target).size;
      return size > 10_000 ? [] : [`muito pequeno: ${screenshot.fileName} (${size} bytes)`];
    });
    return this.check(
      'release-bundle:screenshots',
      'screenshots de release bundle',
      missing.length === 0 ? 'pass' : 'fail',
      missing.length === 0
        ? 'screenshots desktop e mobile de release bundle foram gerados.'
        : 'screenshots desktop/mobile de release bundle estao ausentes ou invalidos.',
      this.screenshotDir,
      missing,
    );
  }

  private resolveReleaseOutput(): string | null {
    const outRoot = path.join(this.websiteRoot, 'out');
    const candidates = [
      path.join(outRoot, 'release.html'),
      path.join(outRoot, 'release', 'index.html'),
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
    } catch (error: unknown) {logger.warn('[Public Release Bundle Contract] JSON parse failed', error); return null; }
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
    } catch (error: unknown) {logger.warn('[Public Release Bundle Contract] filesystem operation failed', error); return ''; }
  }

  private check(
    id: string,
    title: string,
    status: PublicReleaseBundleCheckStatus,
    reason: string,
    filePath?: string,
    evidence: string[] = [],
  ): PublicReleaseBundleCheck {
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
