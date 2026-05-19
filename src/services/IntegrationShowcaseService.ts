import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';
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
      phase: '58',
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
      nextRecommendedPhase: {
        phase: '59',
        title: 'v1.x Release Train And LTS Policy',
        reason:
          'Com integracoes publicas descritas por fixture, Trust Plane e partner surface auditavel, o proximo passo e estabilizar cadencia v1.x e politica LTS.',
      },
    };
  }

  public renderReport(snapshot: IntegrationShowcaseSnapshot = this.buildSnapshot()): string {
    const lines: string[] = [];
    lines.push('[integration-showcase] Readiness checkpoint 8 - Integration Showcase And Partner Surface');
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
    lines.push(`proximo passo recomendada: ${snapshot.nextRecommendedPhase.phase} - ${snapshot.nextRecommendedPhase.title}`);
    lines.push(snapshot.nextRecommendedPhase.reason);
    return lines.join('\n');
  }

  private checkWebsiteRoot(): IntegrationShowcaseCheck {
    const exists = this.existsSync(this.websiteRoot);
    return this.check(
      'integration-showcase:website-root',
      'base publica zavorth-website',
      exists ? 'pass' : 'fail',
      exists
        ? 'repositorio zavorth-website encontrado para validar showcase publica.'
        : 'repositorio zavorth-website nao foi encontrado. Configure ZAVORTH_WEBSITE_REPO_ROOT.',
      this.websiteRoot,
    );
  }

  private checkWebsiteFiles(): IntegrationShowcaseCheck {
    const missing = INTEGRATION_SHOWCASE_REQUIRED_WEBSITE_FILES
      .filter((filePath) => !this.existsSync(path.join(this.websiteRoot, filePath)));
    return this.check(
      'integration-showcase:website-files',
      'rota, fixture e check publicos',
      missing.length === 0 ? 'pass' : 'fail',
      missing.length === 0
        ? '/integrations, fixture de showcase, docs e check local existem no site publico.'
        : 'site publico precisa expor /integrations, fixture, docs e check local.',
      undefined,
      missing,
    );
  }

  private checkCoreScripts(scripts: Record<string, string>): IntegrationShowcaseCheck[] {
    return INTEGRATION_SHOWCASE_REQUIRED_CORE_SCRIPTS.map((scriptName) => {
      const command = String(scripts[scriptName] || '').trim();
      return this.check(
        `integration-showcase:core-script:${scriptName}`,
        `script canonico ${scriptName}`,
        command ? 'pass' : 'fail',
        command
          ? `repo principal expoe "${scriptName}" para showcase de integracoes.`
          : `repo principal precisa expor "${scriptName}" no package.json.`,
        'package.json',
        [`script=${command || '<ausente>'}`],
      );
    });
  }

  private checkWebsiteScripts(scripts: Record<string, string>): IntegrationShowcaseCheck[] {
    return INTEGRATION_SHOWCASE_REQUIRED_WEBSITE_SCRIPTS.map((scriptName) => {
      const command = String(scripts[scriptName] || '').trim();
      return this.check(
        `integration-showcase:website-script:${scriptName}`,
        `script publico ${scriptName}`,
        command ? 'pass' : 'fail',
        command
          ? `site publico expoe "${scriptName}" para validar /integrations.`
          : `zavorth-website precisa expor "${scriptName}" no package.json.`,
        'zavorth-website/package.json',
        [`script=${command || '<ausente>'}`],
      );
    });
  }

  private checkShowcaseContract(): IntegrationShowcaseCheck {
    const issues: string[] = [];
    const vendors = new Set(INTEGRATION_SHOWCASE_ITEMS.map((item) => item.vendor));
    for (const vendor of ['Slack', 'GitHub', 'Vercel', 'Figma']) {
      if (!vendors.has(vendor)) {
        issues.push(`vendor ausente: ${vendor}`);
      }
    }
    if (INTEGRATION_SHOWCASE_ITEMS.length < 4) {
      issues.push(`integracoes insuficientes: ${INTEGRATION_SHOWCASE_ITEMS.length}/4`);
    }
    for (const item of INTEGRATION_SHOWCASE_ITEMS) {
      if (!item.fixtureAvailable || !item.modes.includes('fixture')) {
        issues.push(`${item.id}: precisa rodar em fixture mode`);
      }
      if (item.capabilities.length < 2) {
        issues.push(`${item.id}: capacidades insuficientes`);
      }
      if (item.requirements.length === 0) {
        issues.push(`${item.id}: requisito publico ausente`);
      }
      if (!item.safeDegradation.trim()) {
        issues.push(`${item.id}: degradacao segura ausente`);
      }
      if (item.trustPlaneControls.length < 2) {
        issues.push(`${item.id}: Trust Plane pouco visivel`);
      }
      if (item.partnerStatus === 'registered-partner' && !item.formalPartnerRegistered) {
        issues.push(`${item.id}: claim formal sem registro`);
      }
    }
    return this.check(
      'integration-showcase:contract',
      'showcase por vendor e categoria',
      issues.length === 0 ? 'pass' : 'fail',
      issues.length === 0
        ? 'showcase cobre Slack, GitHub, Vercel e Figma com fixture, requisito, degradacao e Trust Plane.'
        : 'contrato de integration showcase esta incompleto ou inflando claims.',
      'src/contracts/IntegrationShowcaseContract.ts',
      issues,
    );
  }

  private checkCapabilityMatrix(): IntegrationShowcaseCheck {
    const issues: string[] = [];
    const matrixIds = new Set(INTEGRATION_CAPABILITY_MATRIX.map((entry) => entry.id));
    for (const item of INTEGRATION_SHOWCASE_ITEMS) {
      if (!matrixIds.has(item.id)) {
        issues.push(`${item.id}: ausente na matriz`);
      }
    }
    const fixtureEntries = INTEGRATION_CAPABILITY_MATRIX.filter((entry) => entry.fixtureAvailable && entry.modes.includes('fixture'));
    if (fixtureEntries.length < 4) {
      issues.push(`entries fixture-safe insuficientes: ${fixtureEntries.length}/4`);
    }
    if (!INTEGRATION_CAPABILITY_MATRIX.some((entry) => entry.modes.includes('local'))) {
      issues.push('matriz precisa diferenciar ao menos um modo local');
    }
    for (const entry of INTEGRATION_CAPABILITY_MATRIX) {
      if (entry.capabilities.length < 2) {
        issues.push(`${entry.id}: capacidades insuficientes na matriz`);
      }
      if (entry.credentialRequiredForLive && !entry.degradation.trim()) {
        issues.push(`${entry.id}: live com credencial precisa degradacao clara`);
      }
    }
    return this.check(
      'integration-showcase:capability-matrix',
      'matriz de capacidades por integracao',
      issues.length === 0 ? 'pass' : 'fail',
      issues.length === 0
        ? 'matriz diferencia fixture, local e credencial real com degradacao por vendor.'
        : 'matriz de capacidades esta incompleta.',
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
      'Trust Plane visivel nas integracoes',
      missing.length === 0 ? 'pass' : 'fail',
      missing.length === 0
        ? 'showcase trata Trust Plane como controle publico: approval, policy e audit trail.'
        : 'Trust Plane precisa aparecer como controle publico em todas as integracoes.',
      'src/contracts/IntegrationShowcaseContract.ts',
      missing,
    );
  }

  private checkPartnerSurfacePolicy(): IntegrationShowcaseCheck {
    const issues: string[] = [];
    if (!PARTNER_SURFACE_POLICY.registryRequiredForFormalClaim) {
      issues.push('claim formal precisa exigir registro');
    }
    if (PARTNER_SURFACE_POLICY.allowedClaims.length < 3) {
      issues.push('allowed claims insuficientes');
    }
    if (PARTNER_SURFACE_POLICY.prohibitedClaims.length < 3) {
      issues.push('prohibited claims insuficientes');
    }
    for (const artifact of ['integration-smoke.json', 'capability-matrix.json', 'partner-surface.json']) {
      if (!PARTNER_SURFACE_POLICY.auditArtifacts.includes(artifact)) {
        issues.push(`artifact de auditoria ausente: ${artifact}`);
      }
    }
    const unregistered = INTEGRATION_SHOWCASE_ITEMS
      .filter((item) => item.partnerStatus === 'registered-partner' && !item.formalPartnerRegistered)
      .map((item) => item.id);
    issues.push(...unregistered.map((id) => `${id}: parceiro registrado sem prova`));
    return this.check(
      'integration-showcase:partner-surface',
      'politica de partner surface',
      issues.length === 0 ? 'pass' : 'fail',
      issues.length === 0
        ? 'partner surface separa compatibilidade tecnica de parceria formal e exige artifact auditavel.'
        : 'politica de partner surface esta incompleta ou permite claim formal sem registro.',
      'src/contracts/IntegrationShowcaseContract.ts',
      issues,
    );
  }

  private checkWebsiteCoverage(): IntegrationShowcaseCheck {
    const source = this.websiteShowcaseSource();
    const missing = INTEGRATION_SHOWCASE_REQUIRED_WEBSITE_TERMS.filter((term) => !source.includes(term));
    return this.check(
      'integration-showcase:website-coverage',
      'cobertura publica em /integrations e docs',
      missing.length === 0 ? 'pass' : 'fail',
      missing.length === 0
        ? 'site publico cobre vendors, modos, fixture, credencial real, degradacao, Trust Plane e partner surface.'
        : 'site publico precisa expor termos essenciais da showcase.',
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
      'claims proibidos e vazamentos',
      evidence.length === 0 ? 'pass' : 'fail',
      evidence.length === 0
        ? 'showcase nao expoe paths pessoais, tokens ou claims proibidos de parceria.'
        : 'showcase contem path pessoal, token ou claim proibido.',
      undefined,
      evidence,
    );
  }

  private checkSmokeArtifact(): IntegrationShowcaseCheck {
    const artifact = this.readArtifactJson(this.smokePath, 'integration-smoke.json');
    if (!artifact) {
      return this.check(
        'integration-showcase:smoke-artifact',
        'smoke fixture de integracoes',
        this.requireArtifacts ? 'fail' : 'warn',
        this.requireArtifacts
          ? 'integration-smoke.json precisa existir para qa:integration-showcase.'
          : 'smoke fixture nao exigido neste snapshot; qa:integration-showcase gera e valida o artifact.',
        this.smokePath,
      );
    }

    const results = Array.isArray(artifact.results) ? artifact.results as IntegrationShowcaseSmokeResult[] : [];
    const issues: string[] = [];
    if (artifact.ok !== true) {
      issues.push('ok precisa ser true');
    }
    if (artifact.mode !== 'fixture') {
      issues.push('mode precisa ser fixture');
    }
    for (const item of INTEGRATION_SHOWCASE_ITEMS) {
      const result = results.find((entry) => entry.id === item.id);
      if (!result) {
        issues.push(`${item.id}: sem resultado de smoke`);
        continue;
      }
      if (result.status !== 'pass') {
        issues.push(`${item.id}: smoke falhou`);
      }
      if (result.networkRequired) {
        issues.push(`${item.id}: smoke fixture nao pode exigir rede`);
      }
      if (result.secretsRequired) {
        issues.push(`${item.id}: smoke fixture nao pode exigir secret`);
      }
      if (result.mutatesExternalSystems) {
        issues.push(`${item.id}: smoke fixture nao pode mutar sistema externo`);
      }
      if (!result.degradedSafely) {
        issues.push(`${item.id}: sem degradacao segura`);
      }
    }
    return this.check(
      'integration-showcase:smoke-artifact',
      'smoke fixture de integracoes',
      issues.length === 0 ? 'pass' : 'fail',
      issues.length === 0
        ? 'smoke fixture cobre todas as integracoes sem rede, secrets ou mutacao externa.'
        : 'smoke fixture esta ausente, incompleto ou inseguro.',
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
        this.requireArtifacts
          ? 'capability-matrix.json precisa existir para qa:integration-showcase.'
          : 'matriz nao exigida neste snapshot; qa:integration-showcase gera e valida o artifact.',
        this.matrixPath,
      );
    }
    const entries = Array.isArray(artifact.matrix) ? artifact.matrix as JsonRecord[] : [];
    const issues: string[] = [];
    if (artifact.ok !== true) {
      issues.push('ok precisa ser true');
    }
    if (entries.length < INTEGRATION_SHOWCASE_ITEMS.length) {
      issues.push(`entries insuficientes: ${entries.length}/${INTEGRATION_SHOWCASE_ITEMS.length}`);
    }
    for (const item of INTEGRATION_SHOWCASE_ITEMS) {
      if (!entries.some((entry) => entry.id === item.id)) {
        issues.push(`${item.id}: ausente no artifact`);
      }
    }
    return this.check(
      'integration-showcase:matrix-artifact',
      'artifact da matriz de capacidades',
      issues.length === 0 ? 'pass' : 'fail',
      issues.length === 0
        ? 'capability-matrix.json lista todas as integracoes publicas.'
        : 'capability-matrix.json esta incompleto.',
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
        this.requireArtifacts
          ? 'partner-surface.json precisa existir para qa:integration-showcase.'
          : 'partner surface nao exigida neste snapshot; qa:integration-showcase gera e valida o artifact.',
        this.partnerSurfacePath,
      );
    }
    const issues: string[] = [];
    const policy = artifact.policy as JsonRecord | undefined;
    if (artifact.ok !== true) {
      issues.push('ok precisa ser true');
    }
    if (!policy || policy.registryRequiredForFormalClaim !== true) {
      issues.push('policy precisa exigir registro para claim formal');
    }
    if (artifact.formalPartnersRegistered !== 0) {
      issues.push('artifact fixture nao deve declarar parceria formal');
    }
    return this.check(
      'integration-showcase:partner-artifact',
      'artifact de partner surface',
      issues.length === 0 ? 'pass' : 'fail',
      issues.length === 0
        ? 'partner-surface.json diferencia compatibilidade de parceria formal.'
        : 'partner-surface.json contem claim formal ou policy incompleta.',
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
      'etapa 58',
      'integration showcase',
      'partner surface',
      'slack',
      'github',
      'vercel',
      'figma',
      'fixture',
      'degradacao segura',
      'trust plane',
      'qa:integration-showcase',
      'qa:phase:58',
    ];
    const missing = required.filter((term) => !source.includes(term));
    return this.check(
      'integration-showcase:docs-runbook',
      'documentacao e runbook da Readiness checkpoint 8',
      missing.length === 0 ? 'pass' : 'fail',
      missing.length === 0
        ? 'docs explicam showcase, vendors, fixtures, Trust Plane, partner surface e gates da Readiness checkpoint 8.'
        : 'docs precisam explicar como fechar e operar integration showcase.',
      'docs/product-direction.md',
      missing.map((term) => `faltando: ${term}`),
    );
  }

  private checkNextPhasePlanning(): IntegrationShowcaseCheck {
    const source = [
      this.readCoreText('docs/product-direction.md') || '',
      this.readCoreText('docs/product-direction.md') || '',
    ].join('\n');
    const missing = ['Readiness checkpoint 9 - v1.x Release Train And LTS Policy', 'qa:phase:59']
      .filter((term) => !source.includes(term));
    return this.check(
      'integration-showcase:next-phase',
      'recomendacao para Readiness checkpoint 9',
      missing.length === 0 ? 'pass' : 'fail',
      missing.length === 0
        ? 'Readiness checkpoint 8 aponta explicitamente para release train v1.x e LTS.'
        : 'Readiness checkpoint 8 precisa deixar a Readiness checkpoint 9 como proxima acao.',
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
    } catch {
      return null;
    }
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
    } catch {
      return null;
    }
  }

  private parseJson(raw: string): JsonRecord | null {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as JsonRecord : null;
    } catch {
      return null;
    }
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
