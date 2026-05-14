import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';
import {
  DISTRIBUTION_POLICY_FORBIDDEN_CLAIMS,
  DISTRIBUTION_POLICY_REQUIRED_COPY,
  DISTRIBUTION_POLICY_REQUIRED_EDITIONS,
  DISTRIBUTION_POLICY_REQUIRED_LINKS,
  DISTRIBUTION_POLICY_REQUIRED_POLICIES,
  DISTRIBUTION_POLICY_SCREENSHOTS,
  type DistributionPolicyCheck,
  type DistributionPolicyCheckStatus,
  type DistributionPolicyContractSnapshot,
} from '../contracts/DistributionPolicyContract.js';

type PackageLike = {
  scripts?: Record<string, string>;
};

export type DistributionPolicyContractServiceOptions = {
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

const WEBSITE_DISTRIBUTION_SCRIPTS = ['distribution-policy', 'qa:distribution-policy'] as const;
const CORE_DISTRIBUTION_SCRIPTS = ['distribution-policy', 'qa:distribution-policy', 'qa:phase:50'] as const;

export class DistributionPolicyContractService {
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

  constructor(options: DistributionPolicyContractServiceOptions = {}) {
    this.projectRoot = options.projectRoot || config.projectRoot;
    this.websiteRoot = options.websiteRoot || resolveDefaultWebsiteRoot(this.projectRoot);
    this.requireExport = Boolean(options.requireExport);
    this.requireScreenshots = Boolean(options.requireScreenshots);
    this.screenshotDir = options.screenshotDir || path.join(this.websiteRoot, '.qa', 'distribution-policy');
    this.files = options.files || {};
    this.existsSync = options.existsSync || fs.existsSync;
    this.readFileSync = options.readFileSync || fs.readFileSync;
    this.statSync = options.statSync || fs.statSync;
    this.now = options.now || (() => new Date());
  }

  public buildSnapshot(): DistributionPolicyContractSnapshot {
    const checks = [
      this.checkWebsiteRoot(),
      ...this.checkWebsiteScripts(),
      ...this.checkCoreScripts(),
      this.checkRequiredFiles(),
      this.checkPolicyContract(),
      this.checkPublicLinks(),
      this.checkForbiddenClaims(),
      this.checkExportedRoute(),
      this.checkScreenshots(),
    ];
    const failed = checks.filter((check) => check.status === 'fail').length;
    const warnings = checks.filter((check) => check.status === 'warn').length;
    const passed = checks.filter((check) => check.status === 'pass').length;

    return {
      phase: '50',
      surface: 'distribution-policy',
      generatedAt: this.now().toISOString(),
      status: failed > 0 ? 'blocked' : warnings > 0 ? 'attention' : 'ready',
      websiteRoot: this.websiteRoot,
      summary: {
        ok: failed === 0,
        passed,
        warnings,
        failed,
      },
      route: '/editions',
      fixturePath: 'data/distribution-policy.ts',
      requiredEditions: [...DISTRIBUTION_POLICY_REQUIRED_EDITIONS],
      requiredPolicies: [...DISTRIBUTION_POLICY_REQUIRED_POLICIES],
      screenshots: DISTRIBUTION_POLICY_SCREENSHOTS,
      checks,
      nextRecommendedPhase: {
        phase: '51',
        title: 'Release Bundle And Installer Distribution',
        reason:
          'Com edicoes e politica publica definidas, o proximo passo e empacotar bundle e installer verificaveis.',
      },
    };
  }

  public renderReport(snapshot: DistributionPolicyContractSnapshot = this.buildSnapshot()): string {
    const lines: string[] = [];
    lines.push('[distribution-policy] Fase 50 - Editions, Plans And Distribution Policy');
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
    lines.push(`proxima fase recomendada: ${snapshot.nextRecommendedPhase.phase} - ${snapshot.nextRecommendedPhase.title}`);
    lines.push(snapshot.nextRecommendedPhase.reason);
    return lines.join('\n');
  }

  private checkWebsiteRoot(): DistributionPolicyCheck {
    const exists = this.existsSync(this.websiteRoot);
    return this.check(
      'distribution-policy:website-root',
      'base publica zavorth-website',
      exists ? 'pass' : 'fail',
      exists
        ? 'repositorio zavorth-website encontrado para renderizar /editions.'
        : 'repositorio zavorth-website nao foi encontrado. Configure ZAVORTH_WEBSITE_REPO_ROOT.',
      this.websiteRoot,
    );
  }

  private checkWebsiteScripts(): DistributionPolicyCheck[] {
    const scripts = this.readWebsiteJson('package.json')?.scripts || {};
    return WEBSITE_DISTRIBUTION_SCRIPTS.map((scriptName) => {
      const command = String(scripts[scriptName] || '').trim();
      return this.check(
        `distribution-policy:website-script:${scriptName}`,
        `script do site ${scriptName}`,
        command ? 'pass' : 'fail',
        command
          ? `site expoe "${scriptName}" para validar policy publica.`
          : `site precisa expor "${scriptName}" no package.json.`,
        'package.json',
        [`script=${command || '<ausente>'}`],
      );
    });
  }

  private checkCoreScripts(): DistributionPolicyCheck[] {
    const scripts = this.readCoreJson('package.json')?.scripts || {};
    return CORE_DISTRIBUTION_SCRIPTS.map((scriptName) => {
      const command = String(scripts[scriptName] || '').trim();
      return this.check(
        `distribution-policy:core-script:${scriptName}`,
        `script canonico ${scriptName}`,
        command ? 'pass' : 'fail',
        command
          ? `repo principal expoe "${scriptName}" para a Fase 50.`
          : `repo principal precisa expor "${scriptName}" no package.json.`,
        'package.json',
        [`script=${command || '<ausente>'}`],
      );
    });
  }

  private checkRequiredFiles(): DistributionPolicyCheck {
    const required = ['app/editions/page.tsx', 'data/distribution-policy.ts', 'scripts/distribution-policy-check.mjs'];
    const missing = required.filter((filePath) => !this.existsSync(path.join(this.websiteRoot, filePath)));
    return this.check(
      'distribution-policy:required-files',
      'rota e fixture de distribuicao',
      missing.length === 0 ? 'pass' : 'fail',
      missing.length === 0
        ? 'rota /editions, fixture e gate local existem.'
        : 'rota /editions, fixture ou gate local estao ausentes.',
      undefined,
      missing,
    );
  }

  private checkPolicyContract(): DistributionPolicyCheck {
    const source = [
      this.readWebsiteText('app/editions/page.tsx') || '',
      this.readWebsiteText('data/distribution-policy.ts') || '',
    ].join('\n');
    const required = [
      ...DISTRIBUTION_POLICY_REQUIRED_EDITIONS,
      ...DISTRIBUTION_POLICY_REQUIRED_POLICIES,
      ...DISTRIBUTION_POLICY_REQUIRED_COPY,
    ];
    const missing = required.filter((phrase) => !source.includes(phrase));
    return this.check(
      'distribution-policy:policy-contract',
      'rota /editions publica',
      missing.length === 0 ? 'pass' : 'fail',
      missing.length === 0
        ? '/editions cobre edicoes, limites, privacidade, updates, plugins, licenciamento e canais.'
        : '/editions perdeu copy ou bloco publico obrigatorio.',
      'app/editions/page.tsx',
      missing.map((phrase) => `faltando: ${phrase}`),
    );
  }

  private checkPublicLinks(): DistributionPolicyCheck {
    const source = [
      'components/Navbar.tsx',
      'components/CTASection.tsx',
      'components/Footer.tsx',
      'app/docs/page.tsx',
      'app/examples/page.tsx',
      'app/changelog/page.tsx',
    ].map((filePath) => this.readWebsiteText(filePath) || '').join('\n');
    const missing = DISTRIBUTION_POLICY_REQUIRED_LINKS.filter((href) => !source.includes(href));
    return this.check(
      'distribution-policy:public-links',
      'links de edicoes e policy',
      missing.length === 0 ? 'pass' : 'fail',
      missing.length === 0
        ? 'site publico conecta edicoes, docs de policy e exemplos.'
        : 'links publicos de edicoes/policy estao ausentes.',
      undefined,
      missing.map((href) => `faltando: ${href}`),
    );
  }

  private checkForbiddenClaims(): DistributionPolicyCheck {
    const source = [
      'app/editions/page.tsx',
      'data/distribution-policy.ts',
    ].map((filePath) => this.readWebsiteText(filePath) || '').join('\n');
    const forbiddenMatches = DISTRIBUTION_POLICY_FORBIDDEN_CLAIMS.filter((claim) => source.toLowerCase().includes(String(claim).toLowerCase()));
    const tokenMatches = source.match(/(^|[^A-Za-z])sk-[A-Za-z0-9_-]{12,}/g) || [];
    const pathMatches = source.match(/[A-Z]:\\[^'")\s]+/g) || [];
    const evidence = [...forbiddenMatches, ...tokenMatches, ...pathMatches];
    return this.check(
      'distribution-policy:forbidden-claims',
      'claims e vazamentos proibidos',
      evidence.length === 0 ? 'pass' : 'fail',
      evidence.length === 0
        ? 'policy nao expoe paths pessoais, tokens ou claims proibidos.'
        : 'policy contem path pessoal, token ou claim proibido.',
      undefined,
      evidence,
    );
  }

  private checkExportedRoute(): DistributionPolicyCheck {
    const outRoot = path.join(this.websiteRoot, 'out');
    if (!this.existsSync(outRoot)) {
      return this.check(
        'distribution-policy:exported-route',
        'rota /editions exportada',
        this.requireExport ? 'fail' : 'pass',
        this.requireExport
          ? 'out/ precisa existir depois de website:build.'
          : 'export estatico nao exigido neste snapshot; qa:distribution-policy valida /editions depois do build.',
        'out',
      );
    }
    const filePath = this.resolveEditionsOutput();
    if (!filePath) {
      return this.check(
        'distribution-policy:exported-route',
        'rota /editions exportada',
        'fail',
        'build estatico nao exportou /editions.',
        'out',
        ['/editions'],
      );
    }
    const html = this.safeReadAbsolute(filePath);
    const missing = ['Editions, plans and distribution policy', 'Pro Preview', 'Team Preview'].filter((phrase) => !html.includes(phrase));
    return this.check(
      'distribution-policy:exported-route',
      'rota /editions exportada',
      missing.length === 0 ? 'pass' : 'fail',
      missing.length === 0
        ? '/editions existe no export estatico com conteudo essencial.'
        : '/editions exportado perdeu conteudo essencial.',
      'out',
      missing.map((phrase) => `faltando: ${phrase}`),
    );
  }

  private checkScreenshots(): DistributionPolicyCheck {
    if (!this.requireScreenshots) {
      return this.check(
        'distribution-policy:screenshots',
        'screenshots de edicoes',
        'pass',
        'screenshots nao exigidos neste snapshot; qa:distribution-policy captura desktop e mobile.',
        this.screenshotDir,
      );
    }

    const missing = DISTRIBUTION_POLICY_SCREENSHOTS.flatMap((screenshot) => {
      const target = path.join(this.screenshotDir, screenshot.fileName);
      if (!this.existsSync(target)) {
        return [`faltando: ${screenshot.fileName}`];
      }
      const size = this.statSync(target).size;
      return size > 10_000 ? [] : [`muito pequeno: ${screenshot.fileName} (${size} bytes)`];
    });
    return this.check(
      'distribution-policy:screenshots',
      'screenshots de edicoes',
      missing.length === 0 ? 'pass' : 'fail',
      missing.length === 0
        ? 'screenshots desktop e mobile de edicoes foram gerados.'
        : 'screenshots desktop/mobile de edicoes estao ausentes ou invalidos.',
      this.screenshotDir,
      missing,
    );
  }

  private resolveEditionsOutput(): string | null {
    const outRoot = path.join(this.websiteRoot, 'out');
    const candidates = [
      path.join(outRoot, 'editions.html'),
      path.join(outRoot, 'editions', 'index.html'),
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
    } catch {
      return null;
    }
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
    } catch {
      return '';
    }
  }

  private check(
    id: string,
    title: string,
    status: DistributionPolicyCheckStatus,
    reason: string,
    filePath?: string,
    evidence: string[] = [],
  ): DistributionPolicyCheck {
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
