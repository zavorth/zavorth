import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';
import { logger } from '../logger.js';
import {
WEBSITE_PUBLIC_FORBIDDEN_CLAIMS,
  WEBSITE_PUBLIC_REQUIRED_LINKS,
  WEBSITE_PUBLIC_REQUIRED_ROUTES,
  WEBSITE_PUBLIC_REQUIRED_SECTIONS,
  WEBSITE_PUBLIC_SCREENSHOTS,
  type WebsitePublicCheck,
  type WebsitePublicCheckStatus,
  type WebsitePublicContractSnapshot,
  type WebsitePublicRouteSpec,
} from '../contracts/WebsitePublicContract.js';

type PackageLike = {
  name?: string;
  scripts?: Record<string, string>;
};

export type WebsitePublicContractServiceOptions = {
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

const WEBSITE_PACKAGE_SCRIPTS = [
  'website:build',
  'website:public',
  'qa:website-public',
] as const;

const CORE_PACKAGE_SCRIPTS = [
  'website:build',
  'website:public',
  'qa:website-public',
] as const;

export class WebsitePublicContractService {
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

  constructor(options: WebsitePublicContractServiceOptions = {}) {
    this.projectRoot = options.projectRoot || config.projectRoot;
    this.websiteRoot = options.websiteRoot || resolveDefaultWebsiteRoot(this.projectRoot);
    this.requireExport = Boolean(options.requireExport);
    this.requireScreenshots = Boolean(options.requireScreenshots);
    this.screenshotDir = options.screenshotDir || path.join(this.websiteRoot, '.qa', 'website-public');
    this.files = options.files || {};
    this.existsSync = options.existsSync || fs.existsSync;
    this.readFileSync = options.readFileSync || fs.readFileSync;
    this.statSync = options.statSync || fs.statSync;
    this.now = options.now || (() => new Date());
  }

  public buildSnapshot(): WebsitePublicContractSnapshot {
    const checks = [
      this.checkCanonicalRoot(),
      this.checkWebsitePackage(),
      ...this.checkWebsiteScripts(),
      ...this.checkCoreScripts(),
      this.checkNextExport(),
      ...this.checkSourceRoutes(),
      this.checkLandingComposition(),
      this.checkNarrativeCopy(),
      this.checkSectionIds(),
      this.checkRequiredSourceLinks(),
      this.checkForbiddenClaims(),
      this.checkExportedRoutes(),
      this.checkExportedLinks(),
      this.checkScreenshots(),
    ];
    const failed = checks.filter((check) => check.status === 'fail').length;
    const warnings = checks.filter((check) => check.status === 'warn').length;
    const passed = checks.filter((check) => check.status === 'pass').length;

    return {
      gate: 'website-public',
      surface: 'website-public',
      generatedAt: this.now().toISOString(),
      status: failed > 0 ? 'blocked' : warnings > 0 ? 'attention' : 'ready',
      websiteRoot: this.websiteRoot,
      summary: {
        ok: failed === 0,
        passed,
        warnings,
        failed,
      },
      canonicalBase: {
        repoName: 'zavorth-website',
        envOverride: 'ZAVORTH_WEBSITE_REPO_ROOT',
        expectedPackageName: 'zavorth-website',
      },
      narrative: {
        headline: 'Zavorth as a local-first runtime for governed execution',
        promise:
          'Natural language becomes auditable work with preview, approval, evidence, and local control.',
        requiredSections: [...WEBSITE_PUBLIC_REQUIRED_SECTIONS],
      },
      requiredRoutes: WEBSITE_PUBLIC_REQUIRED_ROUTES,
      requiredLinks: WEBSITE_PUBLIC_REQUIRED_LINKS,
      screenshots: WEBSITE_PUBLIC_SCREENSHOTS,
      forbiddenClaims: [...WEBSITE_PUBLIC_FORBIDDEN_CLAIMS],
      checks,
      nextRecommendedGate: {
        gate: 'public-demo',
        title: 'Public Demo And Guided Story',
        reason:
          'Com a landing real protegida por build, links, narractive e screenshots, o next passo e provar a promessa em uma demo public fixture-first.',
      },
    };
  }

  public renderReport(snapshot: WebsitePublicContractSnapshot = this.buildSnapshot()): string {
    const lines: string[] = [];
    lines.push('[website-public] Website/Landing Real');
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

  private checkCanonicalRoot(): WebsitePublicCheck {
    const exists = this.existsSync(this.websiteRoot);
    return this.check(
      'website:root',
      'base public zavorth-website',
      exists ? 'pass' : 'fail',
      exists ? 'repositorio zavorth-website encontrado como base public oficial.'
        : 'zavorth-website repository was not found. Configure ZAVORTH_WEBSITE_REPO_ROOT.',
      this.websiteRoot,
    );
  }

  private checkWebsitePackage(): WebsitePublicCheck {
    const pkg = this.readWebsiteJson('package.json');
    const lock = this.readWebsiteJson('package-lock.json');
    const packageName = String(pkg?.name || '').trim();
    const lockName = String(lock?.name || '').trim();
    const ok = packageName === 'zavorth-website' && lockName === 'zavorth-website';
    return this.check(
      'website:package-name',
      'package oficial do site',
      ok ? 'pass' : 'fail',
      ok ? 'package.json and package-lock.json point to zavorth-website.'
        : 'website package.json and package-lock.json must use name=zavorth-website.',
      'package.json',
      [`package=${packageName || '<missing>'}`, `lock=${lockName || '<missing>'}`],
    );
  }

  private checkWebsiteScripts(): WebsitePublicCheck[] {
    const scripts = this.readWebsiteJson('package.json')?.scripts || {};
    return WEBSITE_PACKAGE_SCRIPTS.map((scriptName) => {
      const command = String(scripts[scriptName] || '').trim();
      return this.check(
        `website:script:${scriptName}`,
        `script do site ${scriptName}`,
        command ? 'pass' : 'fail',
        command ? `site exposes "${scriptName}" to build/contrato local.`
          : `site must expose "${scriptName}" no package.json.`,
        'package.json',
        [`script=${command || '<missing>'}`],
      );
    });
  }

  private checkCoreScripts(): WebsitePublicCheck[] {
    const scripts = this.readCoreJson('package.json')?.scripts || {};
    return CORE_PACKAGE_SCRIPTS.map((scriptName) => {
      const command = String(scripts[scriptName] || '').trim();
      return this.check(
        `core:script:${scriptName}`,
        `script canonical ${scriptName}`,
        command ? 'pass' : 'fail',
        command ? `main repository exposes "${scriptName}" to o gate website-public.`
          : `main repo must expose "${scriptName}" no package.json.`,
        'package.json',
        [`script=${command || '<missing>'}`],
      );
    });
  }

  private checkNextExport(): WebsitePublicCheck {
    const content = this.readWebsiteText('next.config.js') || '';
    const hasExport = content.includes("output: 'export'") || content.includes('output: "export"');
    const hasUnoptimized = content.includes('unoptimized: true');
    const ok = hasExport && hasUnoptimized;
    return this.check(
      'website:static-export',
      'export estatico do Next',
      ok ? 'pass' : 'fail',
      ok ? 'site is configured to build/export estatico without server persistente.'
        : 'next.config.js must keep output export e images.unoptimized=true.',
      'next.config.js',
      [`outputExport=${hasExport}`, `imagesUnoptimized=${hasUnoptimized}`],
    );
  }

  private checkSourceRoutes(): WebsitePublicCheck[] {
    return WEBSITE_PUBLIC_REQUIRED_ROUTES.map((route) => {
      const content = this.readWebsiteText(route.sourcePath);
      if (content === null) {
        return this.check(
          `website:route-source:${route.route}`,
          route.label,
          'fail',
          `route source ${route.route} not found.`,
          route.sourcePath,
        );
      }
      const missing = route.requiredPhrases.filter((phrase) => !content.includes(phrase));
      return this.check(
        `website:route-source:${route.route}`,
        route.label,
        missing.length === 0 ? 'pass' : 'fail',
        missing.length === 0
          ? `rota ${route.route} preserva a copy/estrutura public esperada.`
          : `rota ${route.route} perdeu copy ou estrutura obrigatoria.`,
        route.sourcePath,
        missing.map((phrase) => `faltando: ${phrase}`),
      );
    });
  }

  private checkLandingComposition(): WebsitePublicCheck {
    const content = this.readWebsiteText('app/page.tsx') || '';
    const ordered = ['Navbar', 'Hero', 'DemoSection', 'RuntimeSection', 'FeaturesSection', 'ConnectsSection', 'CTASection', 'Footer'];
    const missing = ordered.filter((name) => !content.includes(`<${name} />`));
    const positions = ordered.map((name) => content.indexOf(`<${name} />`));
    const isOrdered = positions.every((position, index) => position >= 0 && (index === 0 || position > positions[index - 1]));
    const ok = missing.length === 0 && isOrdered;
    return this.check(
      'website:landing-composition',
      'composicao da landing',
      ok ? 'pass' : 'fail',
      ok ? 'landing segue a ordem public: nav, hero, demo, runtime, capabilitys, conexoes, CTA e footer.'
        : 'landing perdeu componente required ou ordem public.',
      'app/page.tsx',
      [
        ...missing.map((name) => `faltando: ${name}`),
        `ordered=${isOrdered}`,
      ],
    );
  }

  private checkNarrativeCopy(): WebsitePublicCheck {
    const source = this.readPublicSourceBundle();
    const required = [
      'A IA local',
      'real execution',
      'local-first',
      'Preview',
      'approval',
      'evidence',
      'runtime single',
      'replay',
      'opt-in',
    ];
    const missing = required.filter((phrase) => !source.includes(phrase));
    return this.check(
      'website:narrative-copy',
      'public narrative allowed',
      missing.length === 0 ? 'pass' : 'fail',
      missing.length === 0
        ? 'copy public cobre produto, local-first, approvals, evidence, replay e opt-in.'
        : 'public copy does not yet cover the minimum public website narrative.',
      undefined,
      missing.map((phrase) => `faltando: ${phrase}`),
    );
  }

  private checkSectionIds(): WebsitePublicCheck {
    const source = this.readPublicSourceBundle();
    const missing = WEBSITE_PUBLIC_REQUIRED_SECTIONS.filter((id) => !source.includes(`id="${id}"`));
    return this.check(
      'website:section-ids',
      'ancoras principais',
      missing.length === 0 ? 'pass' : 'fail',
      missing.length === 0
        ? 'main sections have stable IDs for navigation and links.'
        : 'alguma section principal perdeu id stable.',
      undefined,
      missing.map((id) => `faltando id=${id}`),
    );
  }

  private checkRequiredSourceLinks(): WebsitePublicCheck {
    const source = this.readPublicSourceBundle();
    const missing = WEBSITE_PUBLIC_REQUIRED_LINKS.filter((link) => !source.includes(link.href));
    return this.check(
      'website:source-links',
      'required public links',
      missing.length === 0 ? 'pass' : 'fail',
      missing.length === 0
        ? 'site sources preserve main product, docs, security, and changelog links.'
        : 'some required public link is missing in the source.',
      undefined,
      missing.map((link) => `faltando: ${link.href} (${link.label})`),
    );
  }

  private checkForbiddenClaims(): WebsitePublicCheck {
    const source = this.readPublicSourceBundle();
    const matches = WEBSITE_PUBLIC_FORBIDDEN_CLAIMS.filter((claim) => source.toLowerCase().includes(String(claim).toLowerCase()));
    const secretLike = source.match(/sk-[A-Za-z0-9_-]{12,}/g) || [];
    const pathLike = source.match(/[A-Z]:\\[^'")\s]+/g) || [];
    const evidence = [...matches, ...secretLike, ...pathLike];
    return this.check(
      'website:forbidden-claims',
      'forbidden claims and leaks',
      evidence.length === 0 ? 'pass' : 'fail',
      evidence.length === 0
        ? 'site does not expose personal paths, secrets, placeholders, or forbidden promises.'
        : 'site contains path pessoal, secret, placeholder ou claim proibido.',
      undefined,
      evidence,
    );
  }

  private checkExportedRoutes(): WebsitePublicCheck {
    const outRoot = path.join(this.websiteRoot, 'out');
    if (!this.existsSync(outRoot)) {
      return this.check(
        'website:exported-routes',
        'rotas exportadas',
        this.requireExport ? 'fail' : 'warn',
        this.requireExport ? 'out/ must exist after website:build.'
          : 'out/ does not exist yet; run website:build to validate exported routes.',
        'out',
      );
    }

    const missing = WEBSITE_PUBLIC_REQUIRED_ROUTES
      .filter((route) => !this.resolveRouteOutput(route))
      .map((route) => route.route);
    return this.check(
      'website:exported-routes',
      'rotas exportadas',
      missing.length === 0 ? 'pass' : 'fail',
      missing.length === 0
        ? 'build exported every required public route.'
        : 'build did not export every required public route.',
      'out',
      missing.map((route) => `faltando: ${route}`),
    );
  }

  private checkExportedLinks(): WebsitePublicCheck {
    const outRoot = path.join(this.websiteRoot, 'out');
    if (!this.existsSync(outRoot)) {
      return this.check(
        'website:exported-links',
        'links in exported HTML',
        this.requireExport ? 'fail' : 'warn',
        this.requireExport ? 'exported links need validation after build.'
          : 'out/ missing; exported links remain pending until build.',
        'out',
      );
    }

    const htmlFiles = this.listExportedHtmlFiles(outRoot);
    const broken = new Set<string>();
    const missingAnchors = new Set<string>();
    for (const filePath of htmlFiles) {
      const html = this.safeReadAbsolute(filePath);
      for (const href of extractHtmlHrefs(html)) {
        const target = this.resolveInternalHref(href);
        if (!target) {
          continue;
        }
        if (!this.routeExists(target.route)) {
          broken.add(href);
          continue;
        }
        if (target.anchor && !this.anchorExists(target.route, target.anchor)) {
          missingAnchors.add(href);
        }
      }
    }

    const requiredMissing = WEBSITE_PUBLIC_REQUIRED_LINKS.filter((link) => {
      const target = this.resolveInternalHref(link.href);
      return target ? !this.routeExists(target.route) : false;
    });
    const evidence = [
      ...Array.from(broken).map((href) => `link quebrado: ${href}`),
      ...Array.from(missingAnchors).map((href) => `ancora missing: ${href}`),
      ...requiredMissing.map((link) => `required missing: ${link.href}`),
    ];
    return this.check(
      'website:exported-links',
      'links in exported HTML',
      evidence.length === 0 ? 'pass' : 'fail',
      evidence.length === 0
        ? 'links internos e ancoras principais resolvem no export estatico.'
        : 'export estatico contains link interno ou ancora quebrada.',
      'out',
      evidence,
    );
  }

  private checkScreenshots(): WebsitePublicCheck {
    if (!this.requireScreenshots) {
      return this.check(
        'website:screenshots',
        'screenshots desktop/mobile',
        'warn',
        'screenshots not required in this snapshot; use qa:website-public to capturar desktop e mobile.',
        this.screenshotDir,
      );
    }

    const missing = WEBSITE_PUBLIC_SCREENSHOTS.flatMap((screenshot) => {
      const target = path.join(this.screenshotDir, screenshot.fileName);
      if (!this.existsSync(target)) {
        return [`faltando: ${screenshot.fileName}`];
      }
      const size = this.statSync(target).size;
      return size > 10_000 ? [] : [`muito pequeno: ${screenshot.fileName} (${size} bytes)`];
    });
    return this.check(
      'website:screenshots',
      'screenshots desktop/mobile',
      missing.length === 0 ? 'pass' : 'fail',
      missing.length === 0
        ? 'screenshots desktop e mobile foram generated como artifacts de QA.'
        : 'screenshots desktop/mobile are missings ou invalids.',
      this.screenshotDir,
      missing,
    );
  }

  private readWebsiteJson(relativePath: string): PackageLike | null {
    const raw = this.readWebsiteText(relativePath);
    if (!raw) {
      return null;
    }
    try {
      return JSON.parse(raw) as PackageLike;
    } catch (error: unknown) {logger.warn('[Website Public Contract] JSON parse failed', error); return null; }
  }

  private readCoreJson(relativePath: string): PackageLike | null {
    const raw = this.readCoreText(relativePath);
    if (!raw) {
      return null;
    }
    try {
      return JSON.parse(raw) as PackageLike;
    } catch (error: unknown) {logger.warn('[Website Public Contract] JSON parse failed', error); return null; }
  }

  private readWebsiteText(relativePath: string): string | null {
    return this.readTextFromRoot(this.websiteRoot, relativePath);
  }

  private readCoreText(relativePath: string): string | null {
    return this.readTextFromRoot(this.projectRoot, relativePath);
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

  private readPublicSourceBundle(): string {
    const sourcePaths = [
      'README.md',
      'app/layout.tsx',
      'app/page.tsx',
      'app/docs/page.tsx',
      'app/changelog/page.tsx',
      'app/security/page.tsx',
      'app/privacy/page.tsx',
      'app/terms/page.tsx',
      'components/Hero.tsx',
      'components/Navbar.tsx',
      'components/DemoSection.tsx',
      'components/RuntimeSection.tsx',
      'components/FeaturesSection.tsx',
      'components/ConnectsSection.tsx',
      'components/CTASection.tsx',
      'components/Footer.tsx',
    ];
    return sourcePaths
      .map((sourcePath) => this.readWebsiteText(sourcePath) || '')
      .join('\n');
  }

  private resolveRouteOutput(route: WebsitePublicRouteSpec): string | null {
    const outRoot = path.join(this.websiteRoot, 'out');
    for (const candidate of route.outputCandidates) {
      const absolute = path.join(outRoot, candidate);
      if (this.existsSync(absolute)) {
        return absolute;
      }
    }
    return null;
  }

  private listExportedHtmlFiles(outRoot: string): string[] {
    const files: string[] = [];
    const visit = (directory: string) => {
      if (!this.existsSync(directory)) {
        return;
      }
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const absolute = path.join(directory, entry.name);
        if (entry.isDirectory()) {
          visit(absolute);
        } else if (entry.isFile() && entry.name.endsWith('.html')) {
          files.push(absolute);
        }
      }
    };
    visit(outRoot);
    return files;
  }

  private safeReadAbsolute(filePath: string): string {
    try {
      return this.readFileSync(filePath, 'utf8');
    } catch (error: unknown) {logger.warn('[Website Public Contract] filesystem operation failed', error); return ''; }
  }

  private resolveInternalHref(href: string): { route: string; anchor: string } | null {
    const clean = href.trim();
    if (
      !clean
      || clean.startsWith('http:')
      || clean.startsWith('https:')
      || clean.startsWith('mailto:')
      || clean.startsWith('tel:')
      || clean.startsWith('/_next/')
      || clean.startsWith('/favicon')
      || /\.(css|js|png|jpg|jpeg|svg|webp|ico|txt)$/i.test(clean)
    ) {
      return null;
    }
    const [routePart, anchor = ''] = clean.split('#');
    const route = routePart
      ? routePart.startsWith('/') ? routePart : `/${routePart}`
      : '/';
    return { route: route === '' ? '/' : route.replace(/\/$/, '') || '/', anchor };
  }

  private routeExists(route: string): boolean {
    const spec = WEBSITE_PUBLIC_REQUIRED_ROUTES.find((candidate) => candidate.route === route);
    if (spec) {
      return Boolean(this.resolveRouteOutput(spec));
    }
    return Boolean(this.resolveGenericRouteOutput(route));
  }

  private resolveGenericRouteOutput(route: string): string | null {
    const outRoot = path.join(this.websiteRoot, 'out');
    if (route === '/') {
      const indexPath = path.join(outRoot, 'index.html');
      return this.existsSync(indexPath) ? indexPath : null;
    }
    const clean = route.replace(/^\/+/, '');
    const candidates = [
      path.join(outRoot, `${clean}.html`),
      path.join(outRoot, clean, 'index.html'),
    ];
    return candidates.find((candidate) => this.existsSync(candidate)) || null;
  }

  private anchorExists(route: string, anchor: string): boolean {
    if (!anchor) {
      return true;
    }
    const spec = WEBSITE_PUBLIC_REQUIRED_ROUTES.find((candidate) => candidate.route === route);
    const filePath = spec ? this.resolveRouteOutput(spec) : this.resolveGenericRouteOutput(route);
    if (!filePath) {
      return false;
    }
    const html = this.safeReadAbsolute(filePath);
    return html.includes(`id="${anchor}"`) || html.includes(`id='${anchor}'`);
  }

  private check(
    id: string,
    title: string,
    status: WebsitePublicCheckStatus,
    reason: string,
    filePath?: string,
    evidence: string[] = [],
  ): WebsitePublicCheck {
    return {
      id,
      title,
      status,
      reason,
      path: filePath,
      evidence,
    };
  }
}

function resolveDefaultWebsiteRoot(projectRoot: string): string {
  const override = String(process.env.ZAVORTH_WEBSITE_REPO_ROOT || '').trim();
  if (override) {
    return path.resolve(override);
  }
  return path.resolve(projectRoot, '..', '..', 'zavorth-website');
}

function extractHtmlHrefs(html: string): string[] {
  return Array.from(html.matchAll(/href="([^"]+)"/g)).map((match) => match[1]);
}
