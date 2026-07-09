import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';
import { logger } from '../logger.js';
import {
HOTFIX_PLAYBOOK,
  RELEASE_CANDIDATE_CHECKLIST,
  RELEASE_TRAIN_CALENDAR,
  RELEASE_TRAIN_FORBIDDEN_CLAIMS,
  RELEASE_TRAIN_REQUIRED_CORE_SCRIPTS,
  RELEASE_TRAIN_REQUIRED_WEBSITE_FILES,
  RELEASE_TRAIN_REQUIRED_WEBSITE_TERMS,
  RELEASE_TRAIN_VERSION_POLICIES,
  type ReleaseTrainArtifactResult,
  type ReleaseTrainCheck,
  type ReleaseTrainCheckStatus,
  type ReleaseTrainSnapshot,
} from '../contracts/ReleaseTrainContract.js';

type PackageLike = {
  version?: string;
  scripts?: Record<string, string>;
};

type JsonRecord = Record<string, unknown>;

export type ReleaseTrainServiceOptions = {
  projectRoot?: string;
  websiteRoot?: string;
  artifactDir?: string;
  planPath?: string;
  checklistPath?: string;
  hotfixPath?: string;
  requireArtifacts?: boolean;
  files?: Record<string, string>;
  existsSync?: (targetPath: string) => boolean;
  readFileSync?: (targetPath: string, encoding: BufferEncoding) => string;
  now?: () => Date;
};

export class ReleaseTrainService {
  private readonly projectRoot: string;
  private readonly websiteRoot: string;
  private readonly artifactDir: string;
  private readonly planPath: string;
  private readonly checklistPath: string;
  private readonly hotfixPath: string;
  private readonly requireArtifacts: boolean;
  private readonly files: Record<string, string>;
  private readonly existsSync: (targetPath: string) => boolean;
  private readonly readFileSync: (targetPath: string, encoding: BufferEncoding) => string;
  private readonly now: () => Date;

  constructor(options: ReleaseTrainServiceOptions = {}) {
    this.projectRoot = options.projectRoot || config.projectRoot;
    this.websiteRoot = options.websiteRoot || resolveDefaultWebsiteRoot(this.projectRoot);
    this.artifactDir = options.artifactDir || path.join(this.projectRoot, '.qa', 'release-train');
    this.planPath = options.planPath || path.join(this.artifactDir, 'release-train-plan.json');
    this.checklistPath = options.checklistPath || path.join(this.artifactDir, 'release-candidate-checklist.json');
    this.hotfixPath = options.hotfixPath || path.join(this.artifactDir, 'hotfix-playbook.json');
    this.requireArtifacts = Boolean(options.requireArtifacts);
    this.files = options.files || {};
    this.existsSync = options.existsSync || fs.existsSync;
    this.readFileSync = options.readFileSync || fs.readFileSync;
    this.now = options.now || (() => new Date());
  }

  public buildSnapshot(): ReleaseTrainSnapshot {
    const corePackage = this.readCoreJson('package.json') || {};
    const scripts = corePackage.scripts || {};
    const checks = [
      this.checkWebsiteRoot(),
      this.checkWebsiteFiles(),
      ...this.checkCoreScripts(scripts),
      this.checkBaseline(corePackage),
      this.checkVersionPolicies(),
      this.checkCalendar(),
      this.checkReleaseCandidateChecklist(scripts),
      this.checkHotfixPlaybook(),
      this.checkPreviousPhaseGates(scripts),
      this.checkWebsiteCoverage(),
      this.checkForbiddenClaims(),
      this.checkPlanArtifact(),
      this.checkChecklistArtifact(),
      this.checkHotfixArtifact(),
      this.checkDocsRunbook(),
      this.checkCycleClosure(),
    ];
    const failed = checks.filter((check) => check.status === 'fail').length;
    const warnings = checks.filter((check) => check.status === 'warn').length;
    const passed = checks.filter((check) => check.status === 'pass').length;

    return {
      phase: '59',
      surface: 'release-train',
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
      baseline: {
        version: 'v1.0.0',
        channel: 'stable',
        packageVersion: String(corePackage.version || ''),
      },
      policies: RELEASE_TRAIN_VERSION_POLICIES,
      calendar: RELEASE_TRAIN_CALENDAR,
      releaseCandidateChecklist: RELEASE_CANDIDATE_CHECKLIST,
      hotfixPlaybook: HOTFIX_PLAYBOOK,
      artifacts: {
        planPath: this.planPath,
        checklistPath: this.checklistPath,
        hotfixPath: this.hotfixPath,
      },
      checks,
      nextRecommendedAction: {
        id: 'cycle-closed',
        title: 'Ciclo 53-59 fechado; operar v1.0.x ou planejar v1.1.0',
        reason:
          'Com release train v1.x definido, novas mudancas devem entrar como hotfix v1.0.x ou como ciclo aprovado para v1.1.0.',
      },
    };
  }

  public renderReport(snapshot: ReleaseTrainSnapshot = this.buildSnapshot()): string {
    const lines: string[] = [];
    lines.push('[release-train] Readiness checkpoint 9 - v1.x Release Train And LTS Policy');
    lines.push(`status: ${snapshot.status}`);
    lines.push(`ok: ${snapshot.summary.ok ? 'yes' : 'no'} | pass=${snapshot.summary.passed} warn=${snapshot.summary.warnings} fail=${snapshot.summary.failed}`);
    lines.push(`baseline: ${snapshot.baseline.version} (${snapshot.baseline.channel}) | package=${snapshot.baseline.packageVersion}`);
    lines.push(`artifact: ${snapshot.artifacts.planPath}`);
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
    lines.push(`proxima acao recomendada: ${snapshot.nextRecommendedAction.title}`);
    lines.push(snapshot.nextRecommendedAction.reason);
    return lines.join('\n');
  }

  private checkWebsiteRoot(): ReleaseTrainCheck {
    const exists = this.existsSync(this.websiteRoot);
    return this.check(
      'release-train:website-root',
      'base publica zavorth-website',
      exists ? 'pass' : 'fail',
      exists
        ? 'repositorio zavorth-website encontrado para validar release train publico.'
        : 'repositorio zavorth-website nao foi encontrado. Configure ZAVORTH_WEBSITE_REPO_ROOT.',
      this.websiteRoot,
    );
  }

  private checkWebsiteFiles(): ReleaseTrainCheck {
    const missing = RELEASE_TRAIN_REQUIRED_WEBSITE_FILES
      .filter((filePath) => !this.existsSync(path.join(this.websiteRoot, filePath)));
    return this.check(
      'release-train:website-files',
      'release, changelog e docs publicas',
      missing.length === 0 ? 'pass' : 'fail',
      missing.length === 0
        ? '/release, /changelog, /docs e fixture de release existem.'
        : 'site publico precisa expor release train em release, changelog e docs.',
      undefined,
      missing,
    );
  }

  private checkCoreScripts(scripts: Record<string, string>): ReleaseTrainCheck[] {
    return RELEASE_TRAIN_REQUIRED_CORE_SCRIPTS.map((scriptName) => {
      const command = String(scripts[scriptName] || '').trim();
      return this.check(
        `release-train:script:${scriptName}`,
        `script canonico ${scriptName}`,
        command ? 'pass' : 'fail',
        command
          ? `repo principal expoe "${scriptName}" para release train v1.x.`
          : `repo principal precisa expor "${scriptName}" no package.json.`,
        'package.json',
        [`script=${command || '<ausente>'}`],
      );
    });
  }

  private checkBaseline(corePackage: PackageLike): ReleaseTrainCheck {
    const issues: string[] = [];
    const packageVersion = String(corePackage.version || '').trim();
    if (!isV1ReleaseTrainVersion(packageVersion)) {
      issues.push(`package version esperada no release train v1.x, atual ${packageVersion || '<ausente>'}`);
    }
    const source = [
      this.readCoreText('docs/product-direction.md') || '',
      this.readCoreText('docs/product-direction.md') || '',
      this.websiteReleaseSource(),
    ].join('\n');
    for (const term of ['v1.0.0', 'baseline', 'stable']) {
      if (!source.toLowerCase().includes(term.toLowerCase())) {
        issues.push(`baseline sem termo: ${term}`);
      }
    }
    return this.check(
      'release-train:baseline',
      'baseline v1.0.0 documentado',
      issues.length === 0 ? 'pass' : 'fail',
      issues.length === 0
        ? 'v1.0.0 esta documentado como baseline estavel e o package esta no release train v1.x.'
        : 'baseline v1.0.0 precisa estar documentado e o package precisa estar no release train v1.x.',
      'package.json',
      issues,
    );
  }

  private checkVersionPolicies(): ReleaseTrainCheck {
    const issues: string[] = [];
    const byLane = new Map(RELEASE_TRAIN_VERSION_POLICIES.map((policy) => [policy.lane, policy]));
    for (const lane of ['baseline', 'patch', 'minor', 'breaking'] as const) {
      if (!byLane.has(lane)) {
        issues.push(`lane ausente: ${lane}`);
      }
    }
    const patch = byLane.get('patch');
    if (!patch?.requiresRollback) {
      issues.push('patch v1.0.x precisa rollback');
    }
    if ((patch?.allowedScope || []).some((scope) => scope.toLowerCase().includes('feature'))) {
      issues.push('patch v1.0.x nao pode incluir feature ampla');
    }
    const minor = byLane.get('minor');
    if (!minor?.requiresApprovedPlanning) {
      issues.push('minor v1.1.0 precisa planejamento aprovado');
    }
    const breaking = byLane.get('breaking');
    if (!breaking?.requiresApprovedPlanning || !breaking.allowedScope.some((scope) => scope.toLowerCase().includes('migration'))) {
      issues.push('breaking change precisa ciclo explicito e migration guide');
    }
    return this.check(
      'release-train:version-policies',
      'politica patch/minor/breaking',
      issues.length === 0 ? 'pass' : 'fail',
      issues.length === 0
        ? 'v1.0.x, v1.1.0 e breaking changes tem escopo, planejamento e rollback definidos.'
        : 'politica de versao v1.x esta incompleta.',
      'src/contracts/ReleaseTrainContract.ts',
      issues,
    );
  }

  private checkCalendar(): ReleaseTrainCheck {
    const issues: string[] = [];
    if (RELEASE_TRAIN_CALENDAR.length < 4) {
      issues.push(`calendario leve insuficiente: ${RELEASE_TRAIN_CALENDAR.length}/4`);
    }
    const alwaysOn = RELEASE_TRAIN_CALENDAR.filter((item) => item.alwaysOn).map((item) => item.id);
    issues.push(...alwaysOn.map((id) => `${id}: release train nao deve ser processo sempre ligado`));
    for (const required of ['rc-window', 'patch-hotfix', 'minor-planning', 'lts-review']) {
      if (!RELEASE_TRAIN_CALENDAR.some((item) => item.id === required)) {
        issues.push(`item de calendario ausente: ${required}`);
      }
    }
    return this.check(
      'release-train:calendar',
      'calendario leve v1.x',
      issues.length === 0 ? 'pass' : 'fail',
      issues.length === 0
        ? 'calendario e sob demanda/per-release, sem watcher ou processo pesado sempre ligado.'
        : 'calendario de release train esta incompleto ou pesado demais.',
      'src/contracts/ReleaseTrainContract.ts',
      issues,
    );
  }

  private checkReleaseCandidateChecklist(scripts: Record<string, string>): ReleaseTrainCheck {
    const issues: string[] = [];
    const requiredCommands = ['release:status:fast', 'qa:release-bundle', 'qa:distribution-hardening', 'qa:integration-showcase', 'release:rollback-preview', 'release:changelog'];
    for (const command of requiredCommands) {
      if (!RELEASE_CANDIDATE_CHECKLIST.some((item) => item.command === `npm run ${command}`)) {
        issues.push(`checklist sem comando: ${command}`);
      }
      if (!String(scripts[command] || '').trim()) {
        issues.push(`script ausente: ${command}`);
      }
    }
    const optional = RELEASE_CANDIDATE_CHECKLIST.filter((item) => !item.required).map((item) => item.id);
    if (optional.length > 0) {
      issues.push(`checklist de RC nao deve ter item opcional: ${optional.join(', ')}`);
    }
    return this.check(
      'release-train:rc-checklist',
      'checklist de release candidate',
      issues.length === 0 ? 'pass' : 'fail',
      issues.length === 0
        ? 'release candidate cobre status, bundle, distribution, integration smoke, rollback e changelog.'
        : 'checklist de release candidate esta incompleto.',
      'src/contracts/ReleaseTrainContract.ts',
      issues,
    );
  }

  private checkHotfixPlaybook(): ReleaseTrainCheck {
    const issues: string[] = [];
    for (const required of ['classify', 'branch', 'validate', 'publish']) {
      if (!HOTFIX_PLAYBOOK.some((step) => step.id === required)) {
        issues.push(`passo ausente: ${required}`);
      }
    }
    for (const step of HOTFIX_PLAYBOOK) {
      if (!step.rollback.trim()) {
        issues.push(`${step.id}: sem rollback`);
      }
      if (!step.evidence.trim()) {
        issues.push(`${step.id}: sem evidencia`);
      }
    }
    return this.check(
      'release-train:hotfix-playbook',
      'rollback e hotfix playbook',
      issues.length === 0 ? 'pass' : 'fail',
      issues.length === 0
        ? 'hotfix v1.0.x tem classificacao, branch, validacao, publish e rollback claro.'
        : 'hotfix playbook esta incompleto.',
      'src/contracts/ReleaseTrainContract.ts',
      issues,
    );
  }

  private checkPreviousPhaseGates(scripts: Record<string, string>): ReleaseTrainCheck {
    const missing = ['53', '54', '55', '56', '57', '58']
      .map((phase) => `qa:phase:${phase}`)
      .filter((scriptName) => !String(scripts[scriptName] || '').trim());
    return this.check(
      'release-train:previous-phase-gates',
      'gates das etapas 53-58 preservados',
      missing.length === 0 ? 'pass' : 'fail',
      missing.length === 0
        ? 'release train parte de etapas 53-58 fechadas e ainda executaveis.'
        : 'algum gate anterior do ciclo 53-59 esta ausente.',
      'package.json',
      missing,
    );
  }

  private checkWebsiteCoverage(): ReleaseTrainCheck {
    const source = this.websiteReleaseSource();
    const missing = RELEASE_TRAIN_REQUIRED_WEBSITE_TERMS.filter((term) => !source.includes(term));
    return this.check(
      'release-train:website-coverage',
      'release train no site publico',
      missing.length === 0 ? 'pass' : 'fail',
      missing.length === 0
        ? 'site publico cobre v1.0.0, v1.0.x, v1.1.0, LTS, hotfix, RC, rollback, tags e GitHub Releases.'
        : 'site publico precisa documentar release train v1.x.',
      'app/release/page.tsx',
      missing.map((term) => `faltando: ${term}`),
    );
  }

  private checkForbiddenClaims(): ReleaseTrainCheck {
    const source = [
      this.websiteReleaseSource(),
      this.readCoreText('docs/product-direction.md') || '',
      this.readCoreText('docs/product-direction.md') || '',
    ].join('\n');
    const forbiddenMatches = RELEASE_TRAIN_FORBIDDEN_CLAIMS
      .filter((claim) => source.toLowerCase().includes(String(claim).toLowerCase()));
    const tokenMatches = source.match(/(^|[^A-Za-z])sk-[A-Za-z0-9_-]{12,}/g) || [];
    const evidence = [...forbiddenMatches, ...tokenMatches];
    return this.check(
      'release-train:forbidden-claims',
      'claims proibidos de release',
      evidence.length === 0 ? 'pass' : 'fail',
      evidence.length === 0
        ? 'release train nao promete publish sem rollback, breaking silencioso ou processo sempre ligado.'
        : 'release train contem claim proibido.',
      undefined,
      evidence,
    );
  }

  private checkPlanArtifact(): ReleaseTrainCheck {
    const artifact = this.readArtifactJson(this.planPath, 'release-train-plan.json');
    if (!artifact) {
      return this.check(
        'release-train:plan-artifact',
        'artifact do release train',
        this.requireArtifacts ? 'fail' : 'warn',
        this.requireArtifacts
          ? 'release-train-plan.json precisa existir para qa:release-train.'
          : 'plano nao exigido neste snapshot; qa:release-train gera e valida o artifact.',
        this.planPath,
      );
    }
    const results = Array.isArray(artifact.results) ? artifact.results as ReleaseTrainArtifactResult[] : [];
    const issues = this.checkArtifactBasics(artifact, results, ['baseline', 'patch', 'minor', 'breaking']);
    return this.check(
      'release-train:plan-artifact',
      'artifact do release train',
      issues.length === 0 ? 'pass' : 'fail',
      issues.length === 0
        ? 'release-train-plan.json cobre baseline, patch, minor e breaking.'
        : 'release-train-plan.json esta incompleto.',
      this.planPath,
      issues,
    );
  }

  private checkChecklistArtifact(): ReleaseTrainCheck {
    const artifact = this.readArtifactJson(this.checklistPath, 'release-candidate-checklist.json');
    if (!artifact) {
      return this.check(
        'release-train:checklist-artifact',
        'artifact de release candidate',
        this.requireArtifacts ? 'fail' : 'warn',
        this.requireArtifacts
          ? 'release-candidate-checklist.json precisa existir para qa:release-train.'
          : 'checklist nao exigido neste snapshot; qa:release-train gera e valida o artifact.',
        this.checklistPath,
      );
    }
    const results = Array.isArray(artifact.results) ? artifact.results as ReleaseTrainArtifactResult[] : [];
    const issues = this.checkArtifactBasics(artifact, results, RELEASE_CANDIDATE_CHECKLIST.map((item) => item.id));
    return this.check(
      'release-train:checklist-artifact',
      'artifact de release candidate',
      issues.length === 0 ? 'pass' : 'fail',
      issues.length === 0
        ? 'release-candidate-checklist.json cobre todos os checks de RC.'
        : 'release-candidate-checklist.json esta incompleto.',
      this.checklistPath,
      issues,
    );
  }

  private checkHotfixArtifact(): ReleaseTrainCheck {
    const artifact = this.readArtifactJson(this.hotfixPath, 'hotfix-playbook.json');
    if (!artifact) {
      return this.check(
        'release-train:hotfix-artifact',
        'artifact do hotfix playbook',
        this.requireArtifacts ? 'fail' : 'warn',
        this.requireArtifacts
          ? 'hotfix-playbook.json precisa existir para qa:release-train.'
          : 'hotfix playbook nao exigido neste snapshot; qa:release-train gera e valida o artifact.',
        this.hotfixPath,
      );
    }
    const results = Array.isArray(artifact.results) ? artifact.results as ReleaseTrainArtifactResult[] : [];
    const issues = this.checkArtifactBasics(artifact, results, HOTFIX_PLAYBOOK.map((item) => item.id));
    return this.check(
      'release-train:hotfix-artifact',
      'artifact do hotfix playbook',
      issues.length === 0 ? 'pass' : 'fail',
      issues.length === 0
        ? 'hotfix-playbook.json cobre classificar, branch, validar e publicar com rollback.'
        : 'hotfix-playbook.json esta incompleto.',
      this.hotfixPath,
      issues,
    );
  }

  private checkDocsRunbook(): ReleaseTrainCheck {
    const source = [
      this.readCoreText('docs/product-direction.md') || '',
      this.readCoreText('docs/product-direction.md') || '',
    ].join('\n').toLowerCase();
    const required = [
      'etapa 59',
      'release train',
      'lts',
      'v1.0.0',
      'v1.0.x',
      'v1.1.0',
      'hotfix',
      'release candidate',
      'rollback',
      'github releases',
      'qa:release-train',
      'qa:phase:59',
    ];
    const missing = required.filter((term) => !source.includes(term));
    return this.check(
      'release-train:docs-runbook',
      'documentacao e runbook da Readiness checkpoint 9',
      missing.length === 0 ? 'pass' : 'fail',
      missing.length === 0
        ? 'docs explicam release train, LTS, patch, minor, RC, hotfix, rollback e gates da Readiness checkpoint 9.'
        : 'docs precisam explicar como fechar e operar o release train v1.x.',
      'docs/product-direction.md',
      missing.map((term) => `faltando: ${term}`),
    );
  }

  private checkCycleClosure(): ReleaseTrainCheck {
    const source = [
      this.readCoreText('docs/product-direction.md') || '',
      this.readCoreText('docs/product-direction.md') || '',
    ].join('\n').toLowerCase();
    const required = ['ciclo 53-59', 'fechado', 'nao objetivos', 'v1.1.0'];
    const missing = required.filter((term) => !source.includes(term));
    return this.check(
      'release-train:cycle-closure',
      'ciclo 53-59 pronto para operacao etapaada',
      missing.length === 0 ? 'pass' : 'fail',
      missing.length === 0
        ? 'documentacao marca o ciclo 53-59 como fechado e direciona novas mudancas para v1.0.x/v1.1.0.'
        : 'ciclo 53-59 ainda nao esta claramente fechado na documentacao.',
      'docs/product-direction.md',
      missing,
    );
  }

  private checkArtifactBasics(
    artifact: JsonRecord,
    results: ReleaseTrainArtifactResult[],
    expectedIds: string[],
  ): string[] {
    const issues: string[] = [];
    if (artifact.ok !== true) {
      issues.push('ok precisa ser true');
    }
    for (const id of expectedIds) {
      const result = results.find((item) => item.id === id);
      if (!result) {
        issues.push(`resultado ausente: ${id}`);
        continue;
      }
      if (result.status !== 'pass') {
        issues.push(`resultado falhou: ${id}`);
      }
    }
    return issues;
  }

  private websiteReleaseSource(): string {
    return [
      'app/release/page.tsx',
      'app/changelog/page.tsx',
      'app/docs/page.tsx',
      'data/release-bundle.ts',
    ].map((filePath) => this.readWebsiteText(filePath) || '').join('\n');
  }

  private readCoreJson(relativePath: string): PackageLike | null {
    const raw = this.readCoreText(relativePath);
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
    } catch (error: any) { logger.warn('[Release Train] filesystem operation failed', error); return null; }
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
    } catch (error: any) { logger.warn('[Release Train] filesystem operation failed', error); return null; }
  }

  private parseJson(raw: string): JsonRecord | null {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as JsonRecord : null;
    } catch (error: any) { logger.warn('[Release Train] JSON parse failed', error); return null; }
  }

  private check(
    id: string,
    title: string,
    status: ReleaseTrainCheckStatus,
    reason: string,
    filePath?: string,
    evidence: string[] = [],
  ): ReleaseTrainCheck {
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

function isV1ReleaseTrainVersion(version: string): boolean {
  return /^1\.(?:0|[1-9]\d*)\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version);
}
