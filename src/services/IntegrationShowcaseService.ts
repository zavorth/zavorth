import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';
import { logger } from '../logger.js';
import {
INTEGRATION_CAPABILITY_MATRIX,
  INTEGRATION_SHOWCASE_FORBIDDEN_CLAIMS,
  INTEGRATION_SHOWCASE_ITEMS,
  INTEGRATION_SHOWCASE_REQUIRED_CORE_SCRIPTS,
  INTEGRATION_SHOWCASE_REQUIRED_WEBSITE_FILES,
  INTEGRATION_SHOWCASE_REQUIRED_WEBSITE_SCRIPTS,
  INTEGRATION_SHOWCASE_REQUIRED_WEBSITE_TERMS,
  PARTNER_SURFACE_POLICY,
  type IntegrationShowcaseCheck,
  type IntegrationShowcaseCheckStatus,
  type IntegrationShowcaseSmokeResult,
  type IntegrationShowcaseSnapshot,
} from '../contracts/IntegrationShowcaseContract.js';

type PackageLike = {
  scripts?: Record<string, string>;
};

type JsonRecord = Record<string, unknown>;

export type IntegrationShowcaseServiceOptions = {
  projectRoot?: string;
  websiteRoot?: string;
  artifactDir?: string;
  smokePath?: string;
  matrixPath?: string;
  partnerSurfacePath?: string;
  requireArtifacts?: boolean;
  files?: Record<string, string>;
  existsSync?: (targetPath: string) => boolean;
  readFileSync?: (targetPath: string, encoding: BufferEncoding) => string;
  now?: () => Date;
};

export class IntegrationShowcaseService {
  private readonly projectRoot: string;
  private readonly websiteRoot: string;
  private readonly artifactDir: string;
  private readonly smokePath: string;
  private readonly matrixPath: string;
  private readonly partnerSurfacePath: string;
  private readonly requireArtifacts: boolean;
  private readonly files: Record<string, string>;
  private readonly existsSync: (targetPath: string) => boolean;
  private readonly readFileSync: (targetPath: string, encoding: BufferEncoding) => string;
  private readonly now: () => Date;

  constructor(options: IntegrationShowcaseServiceOptions = {}) {
    this.projectRoot = options.projectRoot || config.projectRoot;
    this.websiteRoot = options.websiteRoot || resolveDefaultWebsiteRoot(this.projectRoot);
    this.artifactDir = options.artifactDir || path.join(this.projectRoot, '.qa', 'integration-showcase');
    this.smokePath = options.smokePath || path.join(this.artifactDir, 'integration-smoke.json');
    this.matrixPath = options.matrixPath || path.join(this.artifactDir, 'capability-matrix.json');
    this.partnerSurfacePath = options.partnerSurfacePath || path.join(this.artifactDir, 'partner-surface.json');
    this.requireArtifacts = Boolean(options.requireArtifacts);
    this.files = options.files || {};
    this.existsSync = options.existsSync || fs.existsSync;
    this.readFileSync = options.readFileSync || fs.readFileSync;
    this.now = options.now || (() => new Date());
  }

  public buildSnapshot(): IntegrationShowcaseSnapshot {
    const coreScripts = this.readCoreJson('package.json')?.scripts || {};
    const websiteScripts = this.readWebsiteJson('package.json')?.scripts || {};
    const checks = [
      this.checkWebsiteRoot(),
      this.checkWebsiteFiles(),
      ...this.checkCoreScripts(coreScripts),
      ...this.checkWebsiteScripts(websiteScripts),
      this.checkShowcaseContract(),
      this.checkCapabilityMatrix(),
      this.checkTrustPlaneCoverage(),
      this.checkPartnerSurfacePolicy(),
      this.checkWebsiteCoverage(),
      this.checkForbiddenClaims(),
      this.checkSmokeArtifact(),
      this.checkMatrixArtifact(),
      this.checkPartnerSurfaceArtifact(),
      this.checkDocsRunbook(),
      this.checkNextPhasePlanning(),
    ];
    const failed = checks.filter((check) => check.status === 'fail').length;
    const warnings = checks.filter((check) => check.status === 'warn').length;
    const passed = checks.filter((check) => check.status === 'pass').length;

    return {
      gate: 'integration-showcase',
      surface: 'integration-showcase',
      generatedAt: this.now().toISOString(),
      status: failed > 0 ? 'blocked' : warnings > 0 ? 'attention' : 'ready',
      projectRoot: this.projectRoot,
      websiteRoot: this.websiteRoot,
      artifactDir: this.artifactDir,
      summary: {
        ok: failed === 0,
        passed,
        warnings,
        failed,
      },
      routes: ['/integrations', '/docs#integration-showcase'],
      integrations: INTEGRATION_SHOWCASE_ITEMS,
      matrix: INTEGRATION_CAPABILITY_MATRIX,
      partnerPolicy: PARTNER_SURFACE_POLICY,
      artifacts: {
        smokePath: this.smokePath,
        matrixPath: this.matrixPath,
        partnerSurfacePath: this.partnerSurfacePath,
      },
      checks,
      nextRecommendedGate: {
        gate: 'release-train',
        title: 'v1.x Release Train And LTS Policy',
        reason:
          'With public integrations driven by fixture, Trust Plane, and auditable partner surface, the next step is stabilizing v1.x cadence and LTS policy.',
      },
    };
  }

  public renderReport(snapshot: IntegrationShowcaseSnapshot = this.buildSnapshot()): string {
    const lines: string[] = [];
    lines.push('[integration-showcase] Readiness gate - Integration Showcase And Partner Surface');
    lines.push(`status: ${snapshot.status}`);
    lines.push(`ok: ${snapshot.summary.ok ? 'yes' : 'no'} | pass=${snapshot.summary.passed} warn=${snapshot.summary.warnings} fail=${snapshot.summary.failed}`);
    lines.push(`website: ${snapshot.websiteRoot}`);
    lines.push(`artifact: ${snapshot.artifacts.smokePath}`);
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

  private checkWebsiteRoot(): IntegrationShowcaseCheck {
    const exists = this.existsSync(this.websiteRoot);
    return this.check(
      'integration-showcase:website-root',
      'base public zavorth-website',
      exists ? 'pass' : 'fail',
      exists ? 'zavorth-website repository found to validate the public showcase.'
        : 'zavorth-website repository was not found. Configure ZAVORTH_WEBSITE_REPO_ROOT.',
      this.websiteRoot,
    );
  }

  private checkWebsiteFiles(): IntegrationShowcaseCheck {
    const missing = INTEGRATION_SHOWCASE_REQUIRED_WEBSITE_FILES
      .filter((filePath) => !this.existsSync(path.join(this.websiteRoot, filePath)));
    return this.check(
      'integration-showcase:website-files',
      'public route, fixture, and check',
      missing.length === 0 ? 'pass' : 'fail',
      missing.length === 0
        ? '/integrations, showcase fixture, docs, and local check exist in the public site.'
        : 'public site must expose /integrations, fixture, docs e check local.',
      undefined,
      missing,
    );
  }

  private checkCoreScripts(scripts: Record<string, string>): IntegrationShowcaseCheck[] {
    return INTEGRATION_SHOWCASE_REQUIRED_CORE_SCRIPTS.map((scriptName) => {
      const command = String(scripts[scriptName] || '').trim();
      return this.check(
        `integration-showcase:core-script:${scriptName}`,
        `script canonical ${scriptName}`,
        command ? 'pass' : 'fail',
        command ? `main repository exposes "${scriptName}" for integration showcase.`
          : `main repo must expose "${scriptName}" no package.json.`,
        'package.json',
        [`script=${command || '<missing>'}`],
      );
    });
  }

  private checkWebsiteScripts(scripts: Record<string, string>): IntegrationShowcaseCheck[] {
    return INTEGRATION_SHOWCASE_REQUIRED_WEBSITE_SCRIPTS.map((scriptName) => {
      const command = String(scripts[scriptName] || '').trim();
      return this.check(
        `integration-showcase:website-script:${scriptName}`,
        `public script ${scriptName}`,
        command ? 'pass' : 'fail',
        command ? `public site exposes "${scriptName}" to validate /integrations.`
          : `zavorth-website must expose "${scriptName}" no package.json.`,
        'zavorth-website/package.json',
        [`script=${command || '<missing>'}`],
      );
    });
  }

  private checkShowcaseContract(): IntegrationShowcaseCheck {
    const issues: string[] = [];
    const vendors = new Set(INTEGRATION_SHOWCASE_ITEMS.map((item) => item.vendor));
    for (const vendor of ['Slack', 'GitHub', 'Vercel', 'Figma']) {
      if (!vendors.has(vendor)) {
        issues.push(`vendor missing: ${vendor}`);
      }
    }
    if (INTEGRATION_SHOWCASE_ITEMS.length < 4) {
      issues.push(`integrations insuficientes: ${INTEGRATION_SHOWCASE_ITEMS.length}/4`);
    }
    for (const item of INTEGRATION_SHOWCASE_ITEMS) {
      if (!item.fixtureAvailable || !item.modes.includes('fixture')) {
        issues.push(`${item.id}: must run in fixture mode`);
      }
      if (item.capabilities.length < 2) {
        issues.push(`${item.id}: capacidades insuficientes`);
      }
      if (item.requirements.length === 0) {
        issues.push(`${item.id}: public requirement missing`);
      }
      if (!item.safeDegradation.trim()) {
        issues.push(`${item.id}: safe degradation missing`);
      }
      if (item.trustPlaneControls.length < 2) {
        issues.push(`${item.id}: Trust Plane has low visibility`);
      }
      if (item.partnerStatus === 'registered-partner' && !item.formalPartnerRegistered) {
        issues.push(`${item.id}: claim formal without registro`);
      }
    }
    return this.check(
      'integration-showcase:contract',
      'showcase por vendor e categoria',
      issues.length === 0 ? 'pass' : 'fail',
      issues.length === 0
        ? 'showcase cobre Slack, GitHub, Vercel e Figma with fixture, requisito, degradaction e Trust Plane.'
        : 'contrato de integration showcase is incompleto ou inflando claims.',
      'src/contracts/IntegrationShowcaseContract.ts',
      issues,
    );
  }

  private checkCapabilityMatrix(): IntegrationShowcaseCheck {
    const issues: string[] = [];
    const matrixIds = new Set(INTEGRATION_CAPABILITY_MATRIX.map((entry) => entry.id));
    for (const item of INTEGRATION_SHOWCASE_ITEMS) {
      if (!matrixIds.has(item.id)) {
        issues.push(`${item.id}: missing na matriz`);
      }
    }
    const fixtureEntries = INTEGRATION_CAPABILITY_MATRIX.filter((entry) => entry.fixtureAvailable && entry.modes.includes('fixture'));
    if (fixtureEntries.length < 4) {
      issues.push(`entries fixture-safe insuficientes: ${fixtureEntries.length}/4`);
    }
    if (!INTEGRATION_CAPABILITY_MATRIX.some((entry) => entry.modes.includes('local'))) {
      issues.push('matrix must differentiate at least one local mode');
    }
    for (const entry of INTEGRATION_CAPABILITY_MATRIX) {
      if (entry.capabilities.length < 2) {
        issues.push(`${entry.id}: capacidades insuficientes na matriz`);
      }
      if (entry.credentialRequiredForLive && !entry.degradation.trim()) {
        issues.push(`${entry.id}: credentialed live mode needs clear degradation`);
      }
    }
    return this.check(
      'integration-showcase:capability-matrix',
      'matriz de capacidades por integration',
      issues.length === 0 ? 'pass' : 'fail',
      issues.length === 0
        ? 'matriz diferencia fixture, local e credential real with degradaction por vendor.'
        : 'matriz de capacidades is incompleta.',
      'src/contracts/IntegrationShowcaseContract.ts',
      issues,
    );
  }

  private checkTrustPlaneCoverage(): IntegrationShowcaseCheck {
    const source = INTEGRATION_SHOWCASE_ITEMS
      .flatMap((item) => item.trustPlaneControls)
      .join('\n')
      .toLowerCase();
    const required = ['approval', 'policy', 'audit'];
    const missing = required.filter((term) => !source.includes(term));
    return this.check(
      'integration-showcase:trust-plane',
      'Trust Plane visible in integrations',
      missing.length === 0 ? 'pass' : 'fail',
      missing.length === 0
        ? 'showcase presents Trust Plane as a public control: approval, policy, and audit trail.'
        : 'Trust Plane must appear as a public control in all integrations.',
      'src/contracts/IntegrationShowcaseContract.ts',
      missing,
    );
  }

  private checkPartnerSurfacePolicy(): IntegrationShowcaseCheck {
    const issues: string[] = [];
    if (!PARTNER_SURFACE_POLICY.registryRequiredForFormalClaim) {
      issues.push('formal claim must require registration');
    }
    if (PARTNER_SURFACE_POLICY.allowedClaims.length < 3) {
      issues.push('allowed claims insuficientes');
    }
    if (PARTNER_SURFACE_POLICY.prohibitedClaims.length < 3) {
      issues.push('prohibited claims insuficientes');
    }
    for (const artifact of ['integration-smoke.json', 'capability-matrix.json', 'partner-surface.json']) {
      if (!PARTNER_SURFACE_POLICY.auditArtifacts.includes(artifact)) {
        issues.push(`missing audit artifact: ${artifact}`);
      }
    }
    const unregistered = INTEGRATION_SHOWCASE_ITEMS
      .filter((item) => item.partnerStatus === 'registered-partner' && !item.formalPartnerRegistered)
      .map((item) => item.id);
    issues.push(...unregistered.map((id) => `${id}: parceiro registrado without prova`));
    return this.check(
      'integration-showcase:partner-surface',
      'partner-surface policy',
      issues.length === 0 ? 'pass' : 'fail',
      issues.length === 0
        ? 'partner surface separates technical compatibility from formal partnership and requires an auditable artifact.'
        : 'partner-surface policy is incompleta ou permite claim formal without registro.',
      'src/contracts/IntegrationShowcaseContract.ts',
      issues,
    );
  }

  private checkWebsiteCoverage(): IntegrationShowcaseCheck {
    const source = this.websiteShowcaseSource();
    const missing = INTEGRATION_SHOWCASE_REQUIRED_WEBSITE_TERMS.filter((term) => !source.includes(term));
    return this.check(
      'integration-showcase:website-coverage',
      'public coverage in /integrations and docs',
      missing.length === 0 ? 'pass' : 'fail',
      missing.length === 0
        ? 'public site covers vendors, modes, fixture, real credentials, degradation, Trust Plane, and partner surface.'
        : 'public site must expose termos essenciais da showcase.',
      'app/integrations/page.tsx',
      missing.map((term) => `faltando: ${term}`),
    );
  }

  private checkForbiddenClaims(): IntegrationShowcaseCheck {
    const source = [
      this.websiteShowcaseSource(),
      this.readCoreText('docs/product-direction.md') || '',
    ].join('\n');
    const forbiddenMatches = INTEGRATION_SHOWCASE_FORBIDDEN_CLAIMS
      .filter((claim) => source.toLowerCase().includes(String(claim).toLowerCase()));
    const tokenMatches = source.match(/(^|[^A-Za-z])sk-[A-Za-z0-9_-]{12,}/g) || [];
    const pathMatches = source.match(/[A-Z]:\\[^'")\s]+/g) || [];
    const evidence = [...forbiddenMatches, ...tokenMatches, ...pathMatches];
    return this.check(
      'integration-showcase:forbidden-claims',
      'prohibited claims and leaks',
      evidence.length === 0 ? 'pass' : 'fail',
      evidence.length === 0
        ? 'showcase does not expose personal paths, tokens, or prohibited partnership claims.'
        : 'showcase contains path pessoal, token ou claim proibido.',
      undefined,
      evidence,
    );
  }

  private checkSmokeArtifact(): IntegrationShowcaseCheck {
    const artifact = this.readArtifactJson(this.smokePath, 'integration-smoke.json');
    if (!artifact) {
      return this.check(
        'integration-showcase:smoke-artifact',
        'smoke fixture de integrations',
        this.requireArtifacts ? 'fail' : 'warn',
        this.requireArtifacts ? 'integration-smoke.json must exist for qa:integration-showcase.'
          : 'smoke fixture not exigido neste snapshot; qa:integration-showcase gera e valida o artifact.',
        this.smokePath,
      );
    }

    const results = Array.isArray(artifact.results) ? artifact.results as IntegrationShowcaseSmokeResult[] : [];
    const issues: string[] = [];
    if (artifact.ok !== true) {
      issues.push('ok must be true');
    }
    if (artifact.mode !== 'fixture') {
      issues.push('mode must be fixture');
    }
    for (const item of INTEGRATION_SHOWCASE_ITEMS) {
      const result = results.find((entry) => entry.id === item.id);
      if (!result) {
        issues.push(`${item.id}: without smoke result`);
        continue;
      }
      if (result.status !== 'pass') {
        issues.push(`${item.id}: smoke failed`);
      }
      if (result.networkRequired) {
        issues.push(`${item.id}: smoke fixture not pode exigir rede`);
      }
      if (result.secretsRequired) {
        issues.push(`${item.id}: smoke fixture not pode exigir secret`);
      }
      if (result.mutatesExternalSystems) {
        issues.push(`${item.id}: smoke fixture not pode mutar sistema external`);
      }
      if (!result.degradedSafely) {
        issues.push(`${item.id}: without degradaction safe`);
      }
    }
    return this.check(
      'integration-showcase:smoke-artifact',
      'smoke fixture de integrations',
      issues.length === 0 ? 'pass' : 'fail',
      issues.length === 0
        ? 'smoke fixture cobre todas as integrations without rede, secrets ou mutation external.'
        : 'smoke fixture is missing, incompleto ou inseguro.',
      this.smokePath,
      issues,
    );
  }

  private checkMatrixArtifact(): IntegrationShowcaseCheck {
    const artifact = this.readArtifactJson(this.matrixPath, 'capability-matrix.json');
    if (!artifact) {
      return this.check(
        'integration-showcase:matrix-artifact',
        'artifact da matriz de capacidades',
        this.requireArtifacts ? 'fail' : 'warn',
        this.requireArtifacts ? 'capability-matrix.json must exist for qa:integration-showcase.'
          : 'matriz not exigida neste snapshot; qa:integration-showcase gera e valida o artifact.',
        this.matrixPath,
      );
    }
    const entries = Array.isArray(artifact.matrix) ? artifact.matrix as JsonRecord[] : [];
    const issues: string[] = [];
    if (artifact.ok !== true) {
      issues.push('ok must be true');
    }
    if (entries.length < INTEGRATION_SHOWCASE_ITEMS.length) {
      issues.push(`entries insuficientes: ${entries.length}/${INTEGRATION_SHOWCASE_ITEMS.length}`);
    }
    for (const item of INTEGRATION_SHOWCASE_ITEMS) {
      if (!entries.some((entry) => entry.id === item.id)) {
        issues.push(`${item.id}: missing no artifact`);
      }
    }
    return this.check(
      'integration-showcase:matrix-artifact',
      'artifact da matriz de capacidades',
      issues.length === 0 ? 'pass' : 'fail',
      issues.length === 0
        ? 'capability-matrix.json lists every public integration.'
        : 'capability-matrix.json is incompleto.',
      this.matrixPath,
      issues,
    );
  }

  private checkPartnerSurfaceArtifact(): IntegrationShowcaseCheck {
    const artifact = this.readArtifactJson(this.partnerSurfacePath, 'partner-surface.json');
    if (!artifact) {
      return this.check(
        'integration-showcase:partner-artifact',
        'artifact de partner surface',
        this.requireArtifacts ? 'fail' : 'warn',
        this.requireArtifacts ? 'partner-surface.json must exist for qa:integration-showcase.'
          : 'partner surface not exigida neste snapshot; qa:integration-showcase gera e valida o artifact.',
        this.partnerSurfacePath,
      );
    }
    const issues: string[] = [];
    const policy = artifact.policy as JsonRecord | undefined;
    if (artifact.ok !== true) {
      issues.push('ok must be true');
    }
    if (!policy || policy.registryRequiredForFormalClaim !== true) {
      issues.push('policy must require registration for formal claims');
    }
    if (artifact.formalPartnersRegistered !== 0) {
      issues.push('artifact fixture must not declare a formal partnership');
    }
    return this.check(
      'integration-showcase:partner-artifact',
      'artifact de partner surface',
      issues.length === 0 ? 'pass' : 'fail',
      issues.length === 0
        ? 'partner-surface.json diferencia compatibilidade de parceria formal.'
        : 'partner-surface.json contains claim formal ou policy incompleta.',
      this.partnerSurfacePath,
      issues,
    );
  }

  private checkDocsRunbook(): IntegrationShowcaseCheck {
    const source = [
      this.readCoreText('docs/product-direction.md') || '',
      this.readCoreText('docs/product-direction.md') || '',
    ].join('\n').toLowerCase();
    const required = [
      'integration showcase',
      'partner surface',
      'slack',
      'github',
      'vercel',
      'figma',
      'fixture',
      'degradaction safe',
      'trust plane',
      'qa:integration-showcase',
    ];
    const missing = required.filter((term) => !source.includes(term));
    return this.check(
      'integration-showcase:docs-runbook',
      'readiness gate documentation and runbook',
      missing.length === 0 ? 'pass' : 'fail',
      missing.length === 0
        ? 'docs explain showcase, vendors, fixtures, Trust Plane, partner surface, and readiness gates.'
        : 'docs must explain how to close and operate integration showcase.',
      'docs/product-direction.md',
      missing.map((term) => `faltando: ${term}`),
    );
  }

  private checkNextPhasePlanning(): IntegrationShowcaseCheck {
    const source = [
      this.readCoreText('docs/product-direction.md') || '',
      this.readCoreText('docs/product-direction.md') || '',
    ].join('\n');
    const missing = ['Readiness gate - v1.x Release Train And LTS Policy', 'qa:release-train']
      .filter((term) => !source.includes(term));
    return this.check(
      'integration-showcase:next-release-state',
      'recommendation for readiness gate',
      missing.length === 0 ? 'pass' : 'fail',
      missing.length === 0
        ? 'readiness gate aponta explicitmente para release train v1.x e LTS.'
        : 'the readiness gate must leave the next readiness gate as the next action.',
      'docs/product-direction.md',
      missing,
    );
  }

  private websiteShowcaseSource(): string {
    return [
      'app/integrations/page.tsx',
      'data/integration-showcase.ts',
      'app/docs/page.tsx',
      'components/ConnectsSection.tsx',
      'components/Navbar.tsx',
      'components/Footer.tsx',
      'components/CTASection.tsx',
    ].map((filePath) => this.readWebsiteText(filePath) || '').join('\n');
  }

  private readCoreJson(relativePath: string): PackageLike | null {
    const raw = this.readCoreText(relativePath);
    return raw ? this.parseJson(raw) as PackageLike | null : null;
  }

  private readWebsiteJson(relativePath: string): PackageLike | null {
    const raw = this.readWebsiteText(relativePath);
    return raw ? this.parseJson(raw) as PackageLike | null : null;
  }

  private readArtifactJson(filePath: string, artifactName: string): JsonRecord | null {
    const directKeys = [
      `artifact:${artifactName}`,
      `absolute:${filePath.replace(/\\/g, '/')}`,
      filePath.replace(/\\/g, '/'),
    ];
    for (const key of directKeys) {
      if (Object.prototype.hasOwnProperty.call(this.files, key)) {
        return this.parseJson(this.files[key]);
      }
    }
    if (!this.existsSync(filePath)) {
      return null;
    }
    try {
      return this.parseJson(this.readFileSync(filePath, 'utf8'));
    } catch (error: unknown) {logger.warn('[Integration Showcase] filesystem operation failed', error); return null; }
  }

  private readCoreText(relativePath: string): string | null {
    return this.readTextFromRoot(this.projectRoot, 'core', relativePath);
  }

  private readWebsiteText(relativePath: string): string | null {
    return this.readTextFromRoot(this.websiteRoot, 'website', relativePath);
  }

  private readTextFromRoot(root: string, prefix: 'core' | 'website', relativePath: string): string | null {
    const normalized = relativePath.replace(/\\/g, '/');
    const keys = [`${prefix}:${normalized}`, normalized];
    for (const key of keys) {
      if (Object.prototype.hasOwnProperty.call(this.files, key)) {
        return this.files[key];
      }
    }
    const targetPath = path.resolve(root, normalized);
    if (!this.existsSync(targetPath)) {
      return null;
    }
    try {
      return this.readFileSync(targetPath, 'utf8');
    } catch (error: unknown) {logger.warn('[Integration Showcase] filesystem operation failed', error); return null; }
  }

  private parseJson(raw: string): JsonRecord | null {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as JsonRecord : null;
    } catch (error: unknown) {logger.warn('[Integration Showcase] JSON parse failed', error); return null; }
  }

  private check(
    id: string,
    title: string,
    status: IntegrationShowcaseCheckStatus,
    reason: string,
    filePath?: string,
    evidence: string[] = [],
  ): IntegrationShowcaseCheck {
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
