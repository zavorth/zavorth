import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';
import { logger } from '../logger.js';
import {
FEEDBACK_TELEMETRY_FORBIDDEN_CLAIMS,
  FEEDBACK_TELEMETRY_REQUIRED_COMMANDS,
  FEEDBACK_TELEMETRY_REQUIRED_COPY,
  FEEDBACK_TELEMETRY_REQUIRED_LINKS,
  FEEDBACK_TELEMETRY_SCREENSHOTS,
  type FeedbackTelemetryCheck,
  type FeedbackTelemetryCheckStatus,
  type FeedbackTelemetryContractSnapshot,
} from '../contracts/FeedbackTelemetryContract.js';

type PackageLike = {
  scripts?: Record<string, string>;
};

export type FeedbackTelemetryContractServiceOptions = {
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

const WEBSITE_FEEDBACK_SCRIPTS = ['feedback-loop', 'qa:feedback-loop'] as const;
const CORE_FEEDBACK_SCRIPTS = [
  'feedback-loop',
  'feedback:preview',
  'feedback:revoke',
  'feedback:delete',
  'qa:feedback-loop',
  'qa:feedback-telemetry',
] as const;

export class FeedbackTelemetryContractService {
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

  constructor(options: FeedbackTelemetryContractServiceOptions = {}) {
    this.projectRoot = options.projectRoot || config.projectRoot;
    this.websiteRoot = options.websiteRoot || resolveDefaultWebsiteRoot(this.projectRoot);
    this.requireExport = Boolean(options.requireExport);
    this.requireScreenshots = Boolean(options.requireScreenshots);
    this.screenshotDir = options.screenshotDir || path.join(this.websiteRoot, '.qa', 'feedback-loop');
    this.files = options.files || {};
    this.existsSync = options.existsSync || fs.existsSync;
    this.readFileSync = options.readFileSync || fs.readFileSync;
    this.statSync = options.statSync || fs.statSync;
    this.now = options.now || (() => new Date());
  }

  public buildSnapshot(): FeedbackTelemetryContractSnapshot {
    const checks = [
      this.checkWebsiteRoot(),
      ...this.checkWebsiteScripts(),
      ...this.checkCoreScripts(),
      this.checkRequiredFiles(),
      this.checkFeedbackContract(),
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
      gate: 'feedback-telemetry',
      surface: 'feedback-loop',
      generatedAt: this.now().toISOString(),
      status: failed > 0 ? 'blocked' : warnings > 0 ? 'attention' : 'ready',
      websiteRoot: this.websiteRoot,
      summary: {
        ok: failed === 0,
        passed,
        warnings,
        failed,
      },
      route: '/feedback',
      fixturePath: 'data/feedback-loop.ts',
      requiredCommands: [...FEEDBACK_TELEMETRY_REQUIRED_COMMANDS],
      screenshots: FEEDBACK_TELEMETRY_SCREENSHOTS,
      checks,
      nextRecommendedGate: {
        phase: 'complete',
        title: 'Public Productization Complete',
        reason:
          'With feedback and opt-in telemetry closed, the public 46-52 cycle is ready for demonstration, adoption, and next architecture planning.',
      },
    };
  }

  public renderReport(snapshot: FeedbackTelemetryContractSnapshot = this.buildSnapshot()): string {
    const lines: string[] = [];
    lines.push('[feedback-loop] Readiness gate - Feedback, Telemetry Opt-In And Product Loop');
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
    lines.push(`next recommended step: ${snapshot.nextRecommendedGate.phase} - ${snapshot.nextRecommendedGate.title}`);
    lines.push(snapshot.nextRecommendedGate.reason);
    return lines.join('\n');
  }

  private checkWebsiteRoot(): FeedbackTelemetryCheck {
    const exists = this.existsSync(this.websiteRoot);
    return this.check(
      'feedback-loop:website-root',
      'base public zavorth-website',
      exists ? 'pass' : 'fail',
      exists ? 'repositorio zavorth-website encontrado para renderizar /feedback.'
        : 'zavorth-website repository was not found. Configure ZAVORTH_WEBSITE_REPO_ROOT.',
      this.websiteRoot,
    );
  }

  private checkWebsiteScripts(): FeedbackTelemetryCheck[] {
    const scripts = this.readWebsiteJson('package.json')?.scripts || {};
    return WEBSITE_FEEDBACK_SCRIPTS.map((scriptName) => {
      const command = String(scripts[scriptName] || '').trim();
      return this.check(
        `feedback-loop:website-script:${scriptName}`,
        `script do site ${scriptName}`,
        command ? 'pass' : 'fail',
        command ? `site exposes "${scriptName}" to validate public feedback.`
          : `site must expose "${scriptName}" no package.json.`,
        'package.json',
        [`script=${command || '<missing>'}`],
      );
    });
  }

  private checkCoreScripts(): FeedbackTelemetryCheck[] {
    const scripts = this.readCoreJson('package.json')?.scripts || {};
    return CORE_FEEDBACK_SCRIPTS.map((scriptName) => {
      const command = String(scripts[scriptName] || '').trim();
      return this.check(
        `feedback-loop:core-script:${scriptName}`,
        `script canonical ${scriptName}`,
        command ? 'pass' : 'fail',
        command ? `main repo exposes "${scriptName}" for the readiness gate.`
          : `main repo must expose "${scriptName}" no package.json.`,
        'package.json',
        [`script=${command || '<missing>'}`],
      );
    });
  }

  private checkRequiredFiles(): FeedbackTelemetryCheck {
    const required = ['app/feedback/page.tsx', 'data/feedback-loop.ts', 'scripts/feedback-loop-check.mjs'];
    const missing = required.filter((filePath) => !this.existsSync(path.join(this.websiteRoot, filePath)));
    return this.check(
      'feedback-loop:required-files',
      'rota e fixture de feedback loop',
      missing.length === 0 ? 'pass' : 'fail',
      missing.length === 0
        ? 'rota /feedback, fixture e gate local existem.'
        : 'rota /feedback, fixture ou gate local iso missings.',
      undefined,
      missing,
    );
  }

  private checkFeedbackContract(): FeedbackTelemetryCheck {
    const source = [
      this.readWebsiteText('app/feedback/page.tsx') || '',
      this.readWebsiteText('data/feedback-loop.ts') || '',
    ].join('\n');
    const missing = FEEDBACK_TELEMETRY_REQUIRED_COPY.filter((phrase) => !source.includes(phrase));
    return this.check(
      'feedback-loop:route-contract',
      'rota /feedback public',
      missing.length === 0 ? 'pass' : 'fail',
      missing.length === 0
        ? '/feedback covers opt-in, redacted preview, revoke/delete, ledger, and safe aggregation.'
        : '/feedback lost required copy or public block.',
      'app/feedback/page.tsx',
      missing.map((phrase) => `faltando: ${phrase}`),
    );
  }

  private checkPublicCommandContract(): FeedbackTelemetryCheck {
    const scripts = this.readCoreJson('package.json')?.scripts || {};
    const docs = [
      this.readWebsiteText('app/feedback/page.tsx') || '',
      this.readWebsiteText('data/feedback-loop.ts') || '',
      this.readWebsiteText('app/docs/page.tsx') || '',
    ].join('\n');
    const missingScripts = FEEDBACK_TELEMETRY_REQUIRED_COMMANDS.filter((scriptName) => !String(scripts[scriptName] || '').trim());
    const missingDocs = FEEDBACK_TELEMETRY_REQUIRED_COMMANDS.filter((scriptName) => !docs.includes(`npm run ${scriptName}`));
    const evidence = [
      ...missingScripts.map((scriptName) => `script missing: ${scriptName}`),
      ...missingDocs.map((scriptName) => `doc without command: ${scriptName}`),
    ];
    return this.check(
      'feedback-loop:public-commands',
      'documented feedback commands',
      evidence.length === 0 ? 'pass' : 'fail',
      evidence.length === 0
        ? 'feedback commands exist in core and appear in the public route/docs.'
        : 'some documented feedback command does not exist or does not appear in docs.',
      'package.json',
      evidence,
    );
  }

  private checkPublicLinks(): FeedbackTelemetryCheck {
    const source = [
      'components/Navbar.tsx',
      'components/CTASection.tsx',
      'components/Footer.tsx',
      'app/docs/page.tsx',
      'app/release/page.tsx',
      'app/changelog/page.tsx',
      'app/privacy/page.tsx',
      'data/external-docs.ts',
    ].map((filePath) => this.readWebsiteText(filePath) || '').join('\n');
    const missing = FEEDBACK_TELEMETRY_REQUIRED_LINKS.filter((href) => !source.includes(href));
    return this.check(
      'feedback-loop:public-links',
      'links de feedback loop',
      missing.length === 0 ? 'pass' : 'fail',
      missing.length === 0
        ? 'public site connects feedback, docs, privacy, and release.'
        : 'public feedback-loop links are absent.',
      undefined,
      missing.map((href) => `faltando: ${href}`),
    );
  }

  private checkForbiddenClaims(): FeedbackTelemetryCheck {
    const source = [
      'app/feedback/page.tsx',
      'data/feedback-loop.ts',
    ].map((filePath) => this.readWebsiteText(filePath) || '').join('\n');
    const forbiddenMatches = FEEDBACK_TELEMETRY_FORBIDDEN_CLAIMS.filter((claim) => source.toLowerCase().includes(String(claim).toLowerCase()));
    const tokenMatches = source.match(/(^|[^A-Za-z])sk-[A-Za-z0-9_-]{12,}/g) || [];
    const pathMatches = source.match(/[A-Z]:\\[^'")\s]+/g) || [];
    const evidence = [...forbiddenMatches, ...tokenMatches, ...pathMatches];
    return this.check(
      'feedback-loop:forbidden-claims',
      'forbidden claims and leaks',
      evidence.length === 0 ? 'pass' : 'fail',
      evidence.length === 0
        ? 'feedback loop does not expose personal paths, tokens, or forbidden claims.'
        : 'feedback loop contains path pessoal, token ou claim proibido.',
      undefined,
      evidence,
    );
  }

  private checkExportedRoute(): FeedbackTelemetryCheck {
    const outRoot = path.join(this.websiteRoot, 'out');
    if (!this.existsSync(outRoot)) {
      return this.check(
        'feedback-loop:exported-route',
        'rota /feedback exportada',
        this.requireExport ? 'fail' : 'pass',
        this.requireExport ? 'out/ must exist after website:build.'
          : 'static export not required in this snapshot; qa:feedback-loop validates /feedback after build.',
        'out',
      );
    }
    const filePath = this.resolveFeedbackOutput();
    if (!filePath) {
      return this.check(
        'feedback-loop:exported-route',
        'rota /feedback exportada',
        this.requireExport ? 'fail' : 'warn',
        this.requireExport ? 'static build did not export /feedback.'
          : 'out/ exists, but does not contain yet /feedback; qa:feedback-loop valida a rota after do build.',
        'out',
        ['/feedback'],
      );
    }
    const html = this.safeReadAbsolute(filePath);
    const missing = ['Feedback, telemetry opt-in and product loop', 'Telemetry desligada por default', 'feedback-preview-redacted.json'].filter((phrase) => !html.includes(phrase));
    return this.check(
      'feedback-loop:exported-route',
      'rota /feedback exportada',
      missing.length === 0 ? 'pass' : this.requireExport ? 'fail' : 'warn',
      missing.length === 0
        ? '/feedback exists in the static export with essential content.'
        : this.requireExport ? 'exported /feedback lost essential content.'
          : 'out/ looks stale and does not contain the new content yet de /feedback.',
      'out',
      missing.map((phrase) => `faltando: ${phrase}`),
    );
  }

  private checkScreenshots(): FeedbackTelemetryCheck {
    if (!this.requireScreenshots) {
      return this.check(
        'feedback-loop:screenshots',
        'screenshots de feedback loop',
        'pass',
        'screenshots not required in this snapshot; qa:feedback-loop captura desktop e mobile.',
        this.screenshotDir,
      );
    }

    const missing = FEEDBACK_TELEMETRY_SCREENSHOTS.flatMap((screenshot) => {
      const target = path.join(this.screenshotDir, screenshot.fileName);
      if (!this.existsSync(target)) {
        return [`faltando: ${screenshot.fileName}`];
      }
      const size = this.statSync(target).size;
      return size > 10_000 ? [] : [`muito pequeno: ${screenshot.fileName} (${size} bytes)`];
    });
    return this.check(
      'feedback-loop:screenshots',
      'screenshots de feedback loop',
      missing.length === 0 ? 'pass' : 'fail',
      missing.length === 0
        ? 'screenshots desktop e mobile de feedback loop foram generated.'
        : 'screenshots desktop/mobile de feedback loop iso missings ou invalids.',
      this.screenshotDir,
      missing,
    );
  }

  private resolveFeedbackOutput(): string | null {
    const outRoot = path.join(this.websiteRoot, 'out');
    const candidates = [
      path.join(outRoot, 'feedback.html'),
      path.join(outRoot, 'feedback', 'index.html'),
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
    } catch (error: unknown) {logger.warn('[Feedback Telemetry Contract] JSON parse failed', error); return null; }
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
    } catch (error: unknown) {logger.warn('[Feedback Telemetry Contract] filesystem operation failed', error); return ''; }
  }

  private check(
    id: string,
    title: string,
    status: FeedbackTelemetryCheckStatus,
    reason: string,
    filePath?: string,
    evidence: string[] = [],
  ): FeedbackTelemetryCheck {
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
