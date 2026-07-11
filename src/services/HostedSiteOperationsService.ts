import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';
import { logger } from '../logger.js';
import {
HOSTED_SITE_DEPLOY_TARGETS,
  HOSTED_SITE_FORBIDDEN_VISUAL_CLAIMS,
  HOSTED_SITE_REQUIRED_CORE_SCRIPTS,
  HOSTED_SITE_REQUIRED_ROUTES,
  HOSTED_SITE_REQUIRED_WEBSITE_SCRIPTS,
  HOSTED_SITE_ROLLBACK_RUNBOOK,
  HOSTED_SITE_SCREENSHOTS,
  type HostedSiteOperationsCheck,
  type HostedSiteOperationsCheckStatus,
  type HostedSiteOperationsSnapshot,
  type HostedSiteRouteSpec,
} from '../contracts/HostedSiteOperationsContract.js';

type PackageLike = {
  name?: string;
  version?: string;
  scripts?: Record<string, string>;
};

type SmokeArtifact = {
  ok?: boolean;
  routes?: Array<{
    route: string;
    status: number;
    ok: boolean;
    bytes?: number;
  }>;
};

export type HostedSiteOperationsServiceOptions = {
  projectRoot?: string;
  websiteRoot?: string;
  requireExport?: boolean;
  requireSmoke?: boolean;
  requireScreenshots?: boolean;
  screenshotDir?: string;
  smokeArtifactPath?: string;
  files?: Record<string, string>;
  existsSync?: (targetPath: string) => boolean;
  readFileSync?: (targetPath: string, encoding: BufferEncoding) => string;
  statSync?: (targetPath: string) => { size: number };
  now?: () => Date;
};

const EXPECTED_RELEASE_VERSION = 'v1.0.0';

export class HostedSiteOperationsService {
  private readonly projectRoot: string;
  private readonly websiteRoot: string;
  private readonly requireExport: boolean;
  private readonly requireSmoke: boolean;
  private readonly requireScreenshots: boolean;
  private readonly screenshotDir: string;
  private readonly smokeArtifactPath: string;
  private readonly files: Record<string, string>;
  private readonly existsSync: (targetPath: string) => boolean;
  private readonly readFileSync: (targetPath: string, encoding: BufferEncoding) => string;
  private readonly statSync: (targetPath: string) => { size: number };
  private readonly now: () => Date;

  constructor(options: HostedSiteOperationsServiceOptions = {}) {
    this.projectRoot = options.projectRoot || config.projectRoot;
    this.websiteRoot = options.websiteRoot || resolveDefaultWebsiteRoot(this.projectRoot);
    this.requireExport = Boolean(options.requireExport);
    this.requireSmoke = Boolean(options.requireSmoke);
    this.requireScreenshots = Boolean(options.requireScreenshots);
    this.screenshotDir = options.screenshotDir || path.join(this.websiteRoot, '.qa', 'hosted-site');
    this.smokeArtifactPath = options.smokeArtifactPath || path.join(this.websiteRoot, '.qa', 'hosted-site', 'smoke.json');
    this.files = options.files || {};
    this.existsSync = options.existsSync || fs.existsSync;
    this.readFileSync = options.readFileSync || fs.readFileSync;
    this.statSync = options.statSync || fs.statSync;
    this.now = options.now || (() => new Date());
  }

  public buildSnapshot(): HostedSiteOperationsSnapshot {
    const checks = [
      this.checkWebsiteRoot(),
      this.checkCoreReleaseVersion(),
      ...this.checkCoreScripts(),
      this.checkWebsitePackage(),
      ...this.checkWebsiteScripts(),
      this.checkStaticExport(),
      this.checkBuildIsolation(),
      ...this.checkRouteSources(),
      this.checkReleaseVersionVisible(),
      this.checkVisualClaimsPolicy(),
      this.checkRollbackRunbook(),
      this.checkExportedRoutes(),
      this.checkSmokeArtifact(),
      this.checkScreenshots(),
      this.checkNextGatePlanning(),
    ];
    const failed = checks.filter((check) => check.status === 'fail').length;
    const warnings = checks.filter((check) => check.status === 'warn').length;
    const passed = checks.filter((check) => check.status === 'pass').length;

    return {
      gate: 'hosted-site-operations',
      surface: 'hosted-site-operations',
      generatedAt: this.now().toISOString(),
      projectRoot: this.projectRoot,
      websiteRoot: this.websiteRoot,
      status: failed > 0 ? 'blocked' : warnings > 0 ? 'attention' : 'ready',
      summary: {
        ok: failed === 0,
        passed,
        warnings,
        failed,
      },
      release: {
        expectedVersion: EXPECTED_RELEASE_VERSION,
        packageVersion: this.readCoreJson('package.json')?.version || '<ausente>',
        websiteVersion: this.readWebsiteJson('package.json')?.version || '<ausente>',
      },
      requiredRoutes: HOSTED_SITE_REQUIRED_ROUTES,
      deployTargets: HOSTED_SITE_DEPLOY_TARGETS,
      rollbackRunbook: HOSTED_SITE_ROLLBACK_RUNBOOK,
      screenshots: HOSTED_SITE_SCREENSHOTS,
      checks,
      nextRecommendedGate: {
        gate: 'distribution-hardening',
        title: 'Installer And Distribution Hardening',
        reason:
          'Com site e demo operaveis por build, smoke, screenshots e rollback, o proximo passo e endurecer bundle, installer e distribuicao.',
      },
    };
  }

  public renderReport(snapshot: HostedSiteOperationsSnapshot = this.buildSnapshot()): string {
    const lines: string[] = [];
    lines.push('[hosted-site] Readiness checkpoint 4 - Hosted Website And Demo Operations');
    lines.push(`status: ${snapshot.status}`);
    lines.push(`ok: ${snapshot.summary.ok ? 'yes' : 'no'} | pass=${snapshot.summary.passed} warn=${snapshot.summary.warnings} fail=${snapshot.summary.failed}`);
    lines.push(`release: expected=${snapshot.release.expectedVersion} core=${snapshot.release.packageVersion} website=${snapshot.release.websiteVersion}`);
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
    lines.push('runbook publish/rollback:');
    for (const step of snapshot.rollbackRunbook) {
      lines.push(`- ${step.id}: ${step.command} | rollback: ${step.rollback}`);
    }
    lines.push('');
    lines.push(`proximo passo recomendada: ${snapshot.nextRecommendedGate.gate} - ${snapshot.nextRecommendedGate.title}`);
    lines.push(snapshot.nextRecommendedGate.reason);
    return lines.join('\n');
  }

  private checkWebsiteRoot(): HostedSiteOperationsCheck {
    const exists = this.websiteRootExists();
    return this.check(
      'hosted-site:website-root',
      'base publica zavorth-website',
      exists ? 'pass' : 'fail',
      exists
        ? 'repositorio zavorth-website encontrado para build/smoke hospedavel.'
        : 'repositorio zavorth-website nao foi encontrado. Configure ZAVORTH_WEBSITE_REPO_ROOT.',
      this.websiteRoot,
    );
  }

  private checkCoreReleaseVersion(): HostedSiteOperationsCheck {
    const version = String(this.readCoreJson('package.json')?.version || '').trim();
    const ok = version === '1.0.0';
    return this.check(
      'hosted-site:core-release-version',
      'baseline core v1.0.0',
      ok ? 'pass' : 'fail',
      ok
        ? 'core preserva version=1.0.0 como baseline publicado.'
        : 'core precisa preservar version=1.0.0 para o site exibir release atual.',
      'package.json',
      [`version=${version || '<ausente>'}`],
    );
  }

  private checkCoreScripts(): HostedSiteOperationsCheck[] {
    const scripts = this.readCoreJson('package.json')?.scripts || {};
    return HOSTED_SITE_REQUIRED_CORE_SCRIPTS.map((scriptName) => {
      const command = String(scripts[scriptName] || '').trim();
      return this.check(
        `core:script:${scriptName}`,
        `script core ${scriptName}`,
        command ? 'pass' : 'fail',
        command
          ? `repo principal expoe "${scriptName}" para operacao do site.`
          : `repo principal precisa expor "${scriptName}" no package.json.`,
        'package.json',
        [`script=${command || '<ausente>'}`],
      );
    });
  }

  private checkWebsitePackage(): HostedSiteOperationsCheck {
    const pkg = this.readWebsiteJson('package.json');
    const packageName = String(pkg?.name || '').trim();
    const version = String(pkg?.version || '').trim();
    const ok = packageName === 'zavorth-website' && version === '1.0.0';
    return this.check(
      'hosted-site:website-package',
      'package do site versionado',
      ok ? 'pass' : 'fail',
      ok
        ? 'site oficial usa name=zavorth-website e version=1.0.0.'
        : 'site precisa usar name=zavorth-website e version=1.0.0.',
      'package.json',
      [`name=${packageName || '<ausente>'}`, `version=${version || '<ausente>'}`],
    );
  }

  private checkWebsiteScripts(): HostedSiteOperationsCheck[] {
    const scripts = this.readWebsiteJson('package.json')?.scripts || {};
    return HOSTED_SITE_REQUIRED_WEBSITE_SCRIPTS.map((scriptName) => {
      const command = String(scripts[scriptName] || '').trim();
      return this.check(
        `hosted-site:website-script:${scriptName}`,
        `script do site ${scriptName}`,
        command ? 'pass' : 'fail',
        command
          ? `site expoe "${scriptName}" para build e contratos publicos.`
          : `site precisa expor "${scriptName}" no package.json.`,
        'package.json',
        [`script=${command || '<ausente>'}`],
      );
    });
  }

  private checkStaticExport(): HostedSiteOperationsCheck {
    const content = this.readWebsiteText('next.config.js') || '';
    const hasExport = content.includes("output: 'export'") || content.includes('output: "export"');
    const hasDistDir = content.includes('ZAVORTH_NEXT_DIST_DIR');
    const hasUnoptimized = content.includes('unoptimized: true');
    const ok = hasExport && hasDistDir && hasUnoptimized;
    return this.check(
      'hosted-site:static-export',
      'Next export estatico configurado',
      ok ? 'pass' : 'fail',
      ok
        ? 'next.config.js usa output export, distDir isolado e imagens unoptimized.'
        : 'next.config.js precisa manter export estatico, distDir isolado e images.unoptimized=true.',
      'next.config.js',
      [`outputExport=${hasExport}`, `distDirEnv=${hasDistDir}`, `imagesUnoptimized=${hasUnoptimized}`],
    );
  }

  private checkBuildIsolation(): HostedSiteOperationsCheck {
    const buildScript = this.readWebsiteText('scripts/website-build.mjs') || '';
    const websiteBuild = String(this.readWebsiteJson('package.json')?.scripts?.['website:build'] || '');
    const hasQaDir = buildScript.includes('.next-zavorth-qa');
    const cleansOut = buildScript.includes("removeGeneratedBuildDir('out')") || buildScript.includes('removeGeneratedBuildDir("out")');
    const disablesTelemetry = buildScript.includes('NEXT_TELEMETRY_DISABLED');
    const avoidsNextDev = !websiteBuild.includes('next dev') && !buildScript.includes('next dev');
    const ok = hasQaDir && cleansOut && disablesTelemetry && avoidsNextDev;
    return this.check(
      'hosted-site:build-isolation',
      'build isolado de next dev',
      ok ? 'pass' : 'fail',
      ok
        ? 'build usa diretorio QA isolado, limpa out/ e nao depende de next dev vivo.'
        : 'build precisa ser isolado, limpar out/ e nao depender de next dev.',
      'scripts/website-build.mjs',
      [
        `qaDistDir=${hasQaDir}`,
        `cleansOut=${cleansOut}`,
        `telemetryDisabled=${disablesTelemetry}`,
        `avoidsNextDev=${avoidsNextDev}`,
      ],
    );
  }

  private checkRouteSources(): HostedSiteOperationsCheck[] {
    return HOSTED_SITE_REQUIRED_ROUTES.map((route) => {
      const source = route.sourcePaths.map((sourcePath) => this.readWebsiteText(sourcePath) || '').join('\n');
      const missingFiles = route.sourcePaths.filter((sourcePath) => this.readWebsiteText(sourcePath) === null);
      const missingPhrases = route.requiredPhrases.filter((phrase) => !source.includes(phrase));
      const evidence = [
        ...missingFiles.map((sourcePath) => `arquivo ausente: ${sourcePath}`),
        ...missingPhrases.map((phrase) => `faltando: ${phrase}`),
      ];
      return this.check(
        `hosted-site:route-source:${route.route}`,
        route.label,
        evidence.length === 0 ? 'pass' : 'fail',
        evidence.length === 0
          ? `${route.route} preserva fonte, copy e fixture para operacao publica.`
          : `${route.route} perdeu fonte ou frase publica obrigatoria.`,
        route.sourcePaths[0],
        evidence,
      );
    });
  }

  private checkReleaseVersionVisible(): HostedSiteOperationsCheck {
    const source = [
      this.readWebsiteText('data/release-bundle.ts') || '',
      this.readWebsiteText('app/release/page.tsx') || '',
      this.readWebsiteText('app/changelog/page.tsx') || '',
    ].join('\n');
    const exported = this.readRouteOutput('/release');
    const sourceHasVersion =
      source.includes(`version: '${EXPECTED_RELEASE_VERSION}'`)
      || source.includes(`version: "${EXPECTED_RELEASE_VERSION}"`);
    const exportedHasVersion = !this.requireExport || (exported !== null && exported.includes(EXPECTED_RELEASE_VERSION));
    const sourceHasDigest = source.includes('sha256:');
    const ok = sourceHasVersion && exportedHasVersion && sourceHasDigest;
    return this.check(
      'hosted-site:release-visible',
      'release atual verificavel no site',
      ok ? 'pass' : 'fail',
      ok
        ? 'site exibe v1.0.0 e digest verificavel em fonte/export.'
        : 'site precisa expor v1.0.0 e digest verificavel na rota /release.',
      'data/release-bundle.ts',
      [`sourceVersion=${sourceHasVersion}`, `exportedVersion=${exportedHasVersion}`, `digest=${sourceHasDigest}`],
    );
  }

  private checkVisualClaimsPolicy(): HostedSiteOperationsCheck {
    const source = this.readWebsiteSourceBundle();
    const matches = HOSTED_SITE_FORBIDDEN_VISUAL_CLAIMS.filter((claim) =>
      source.toLowerCase().includes(String(claim).toLowerCase()),
    );
    const tokenMatches = source.match(/(^|[^A-Za-z])sk-[A-Za-z0-9_-]{12,}/g) || [];
    const pathMatches = source.match(/[A-Z]:\\[^'")\s]+/g) || [];
    const evidence = [...matches, ...tokenMatches, ...pathMatches];
    return this.check(
      'hosted-site:visual-claims-policy',
      'politica de assets e claims visuais',
      evidence.length === 0 ? 'pass' : 'fail',
      evidence.length === 0
        ? 'fontes publicas nao expoem secrets, paths pessoais ou claims visuais proibidos.'
        : 'fontes publicas contem segredo, path pessoal ou claim visual proibido.',
      undefined,
      evidence,
    );
  }

  private checkRollbackRunbook(): HostedSiteOperationsCheck {
    const doc = this.readCoreText('docs/product-direction.md') || '';
    const required = ['preview', 'publish', 'rollback', 'smoke', 'qa:hosted-site'];
    const missing = required.filter((phrase) => !doc.toLowerCase().includes(phrase.toLowerCase()));
    const runbookComplete = HOSTED_SITE_ROLLBACK_RUNBOOK.every((step) =>
      step.command.trim() && step.proof.trim() && step.rollback.trim(),
    );
    return this.check(
      'hosted-site:rollback-runbook',
      'runbook preview/publish/rollback',
      missing.length === 0 && runbookComplete ? 'pass' : 'fail',
      missing.length === 0 && runbookComplete
        ? 'docs e contrato explicam preview, publish, smoke e rollback.'
        : 'runbook precisa cobrir preview, publish, smoke, rollback e qa:hosted-site.',
      'docs/product-direction.md',
      [...missing.map((phrase) => `faltando: ${phrase}`), `contractRunbook=${runbookComplete}`],
    );
  }

  private checkExportedRoutes(): HostedSiteOperationsCheck {
    const outRoot = path.join(this.websiteRoot, 'out');
    if (!this.existsSync(outRoot)) {
      return this.check(
        'hosted-site:exported-routes',
        'rotas exportadas para hospedagem',
        this.requireExport ? 'fail' : 'warn',
        this.requireExport
          ? 'out/ precisa existir depois de website:build.'
          : 'out/ ausente; rode hosted-site --build para validar export.',
        'out',
      );
    }

    const missing = HOSTED_SITE_REQUIRED_ROUTES
      .filter((route) => !this.resolveRouteOutput(route))
      .map((route) => route.route);
    return this.check(
      'hosted-site:exported-routes',
      'rotas exportadas para hospedagem',
      missing.length === 0 ? 'pass' : 'fail',
      missing.length === 0
        ? 'export estatico contem landing, demo, start, docs, release e feedback.'
        : 'export estatico nao contem todas as rotas de operacao publica.',
      'out',
      missing.map((route) => `faltando: ${route}`),
    );
  }

  private checkSmokeArtifact(): HostedSiteOperationsCheck {
    if (!this.requireSmoke) {
      return this.check(
        'hosted-site:smoke-artifact',
        'smoke local/preview',
        'warn',
        'smoke nao exigido neste snapshot; use qa:hosted-site para gerar .qa/hosted-site/smoke.json.',
        this.smokeArtifactPath,
      );
    }

    const raw = this.readAbsoluteText(this.smokeArtifactPath);
    if (raw === null) {
      return this.check(
        'hosted-site:smoke-artifact',
        'smoke local/preview',
        'fail',
        'smoke.json nao foi gerado.',
        this.smokeArtifactPath,
      );
    }
    const artifact = parseJson(raw) as SmokeArtifact | null;
    const routes = Array.isArray(artifact?.routes) ? artifact.routes : [];
    const missing = HOSTED_SITE_REQUIRED_ROUTES
      .filter((route) => !routes.some((entry) => entry.route === route.route && entry.ok && entry.status === 200))
      .map((route) => route.route);
    const ok = Boolean(artifact?.ok) && missing.length === 0;
    return this.check(
      'hosted-site:smoke-artifact',
      'smoke local/preview',
      ok ? 'pass' : 'fail',
      ok
        ? 'smoke estatico validou todas as rotas publicas obrigatorias.'
        : 'smoke estatico falhou ou nao cobriu todas as rotas obrigatorias.',
      this.smokeArtifactPath,
      missing.map((route) => `faltando/falhou: ${route}`),
    );
  }

  private checkScreenshots(): HostedSiteOperationsCheck {
    if (!this.requireScreenshots) {
      return this.check(
        'hosted-site:screenshots',
        'screenshots pos-build desktop/mobile',
        'warn',
        'screenshots nao exigidos neste snapshot; use qa:hosted-site para capturar desktop e mobile.',
        this.screenshotDir,
      );
    }

    const missing = HOSTED_SITE_SCREENSHOTS.flatMap((screenshot) => {
      const target = path.join(this.screenshotDir, screenshot.fileName);
      if (!this.existsSync(target)) {
        return [`faltando: ${screenshot.fileName}`];
      }
      const size = this.statSync(target).size;
      return size > 10_000 ? [] : [`muito pequeno: ${screenshot.fileName} (${size} bytes)`];
    });
    return this.check(
      'hosted-site:screenshots',
      'screenshots pos-build desktop/mobile',
      missing.length === 0 ? 'pass' : 'fail',
      missing.length === 0
        ? 'screenshots desktop/mobile foram gerados depois do build estatico.'
        : 'screenshots desktop/mobile estao ausentes ou invalidos.',
      this.screenshotDir,
      missing,
    );
  }

  private checkNextGatePlanning(): HostedSiteOperationsCheck {
    const doc = this.readCoreText('docs/product-direction.md') || '';
    const hasNextDoc = doc.includes('Readiness checkpoint 5 - Installer And Distribution Hardening');
    const hasGate = doc.includes('qa:distribution-hardening');
    return this.check(
      'hosted-site:next-gate',
      'proximo passo planejada',
      hasNextDoc && hasGate ? 'pass' : 'fail',
      hasNextDoc && hasGate
        ? 'planejamento aponta para Readiness checkpoint 5 e gate qa:distribution-hardening.'
        : 'docs/product-direction precisa manter Readiness checkpoint 5 e gate qa:distribution-hardening planejados.',
      'docs/product-direction.md',
      [`nextDoc=${hasNextDoc}`, `gate=${hasGate}`],
    );
  }

  private readWebsiteSourceBundle(): string {
    const sourcePaths = Array.from(new Set(HOSTED_SITE_REQUIRED_ROUTES.flatMap((route) => route.sourcePaths)));
    return sourcePaths.map((sourcePath) => this.readWebsiteText(sourcePath) || '').join('\n');
  }

  private resolveRouteOutput(route: HostedSiteRouteSpec): string | null {
    const outRoot = path.join(this.websiteRoot, 'out');
    for (const candidate of route.outputCandidates) {
      const absolute = path.join(outRoot, candidate);
      if (this.existsSync(absolute)) {
        return absolute;
      }
    }
    return null;
  }

  private readRouteOutput(route: string): string | null {
    const spec = HOSTED_SITE_REQUIRED_ROUTES.find((candidate) => candidate.route === route);
    const filePath = spec ? this.resolveRouteOutput(spec) : null;
    return filePath ? this.readAbsoluteText(filePath) : null;
  }

  private readCoreJson(relativePath: string): PackageLike | null {
    return this.readJson(this.projectRoot, relativePath, 'core');
  }

  private readWebsiteJson(relativePath: string): PackageLike | null {
    return this.readJson(this.websiteRoot, relativePath, 'website');
  }

  private readJson(root: string, relativePath: string, scope: 'core' | 'website'): PackageLike | null {
    const raw = this.readTextFromRoot(root, relativePath, scope);
    return raw ? parseJson(raw) as PackageLike | null : null;
  }

  private readCoreText(relativePath: string): string | null {
    return this.readTextFromRoot(this.projectRoot, relativePath, 'core');
  }

  private readWebsiteText(relativePath: string): string | null {
    return this.readTextFromRoot(this.websiteRoot, relativePath, 'website');
  }

  private readTextFromRoot(root: string, relativePath: string, scope: 'core' | 'website'): string | null {
    const normalized = relativePath.replace(/\\/g, '/');
    const scopedKey = `${scope}:${normalized}`;
    if (Object.prototype.hasOwnProperty.call(this.files, scopedKey)) {
      return this.files[scopedKey];
    }
    if (Object.prototype.hasOwnProperty.call(this.files, normalized)) {
      return this.files[normalized];
    }
    const targetPath = path.resolve(root, normalized);
    return this.readAbsoluteText(targetPath);
  }

  private readAbsoluteText(filePath: string): string | null {
    const normalizedAbsolute = path.resolve(filePath).replace(/\\/g, '/');
    if (Object.prototype.hasOwnProperty.call(this.files, `abs:${normalizedAbsolute}`)) {
      return this.files[`abs:${normalizedAbsolute}`];
    }
    if (!this.existsSync(filePath)) {
      return null;
    }
    try {
      return this.readFileSync(filePath, 'utf8');
    } catch (error: unknown) {logger.warn('[Hosted Site Operations] filesystem operation failed', error); return null; }
  }

  private websiteRootExists(): boolean {
    if (Object.keys(this.files).some((key) => key.startsWith('website:'))) {
      return true;
    }
    return this.existsSync(this.websiteRoot);
  }

  private check(
    id: string,
    title: string,
    status: HostedSiteOperationsCheckStatus,
    reason: string,
    filePath?: string,
    evidence: string[] = [],
  ): HostedSiteOperationsCheck {
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

function parseJson(raw: string): unknown | null {
  try {
    return JSON.parse(raw);
  } catch (error: unknown) {logger.warn('[Hosted Site Operations] JSON parse failed', error); return null; }
}
