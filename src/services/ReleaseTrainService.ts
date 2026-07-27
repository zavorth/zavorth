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
      this.checkPreviousGates(scripts),
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
      gate: 'release-train',
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
        title: 'Cycle 53-59 closed; operate v1.0.x or plan v1.1.0',
        reason:
          'With release train v1.x defined, new changes must enter as v1.0.x hotfixes or as an approved v1.1.0 cycle.',
      },
    };
  }

  public renderReport(snapshot: ReleaseTrainSnapshot = this.buildSnapshot()): string {
    const lines: string[] = [];
    lines.push('[release-train] Readiness gate - v1.x Release Train And LTS Policy');
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
    lines.push(`next action recomendada: ${snapshot.nextRecommendedAction.title}`);
    lines.push(snapshot.nextRecommendedAction.reason);
    return lines.join('\n');
  }

  private checkWebsiteRoot(): ReleaseTrainCheck {
    const exists = this.existsSync(this.websiteRoot);
    return this.check(
      'release-train:website-root',
      'base public zavorth-website',
      exists ? 'pass' : 'fail',
      exists ? 'zavorth-website repository found to validate the public release train.'
        : 'zavorth-website repository was not found. Configure ZAVORTH_WEBSITE_REPO_ROOT.',
      this.websiteRoot,
    );
  }

  private checkWebsiteFiles(): ReleaseTrainCheck {
    const missing = RELEASE_TRAIN_REQUIRED_WEBSITE_FILES
      .filter((filePath) => !this.existsSync(path.join(this.websiteRoot, filePath)));
    return this.check(
      'release-train:website-files',
      'release, changelog e public docs',
      missing.length === 0 ? 'pass' : 'fail',
      missing.length === 0
        ? '/release, /changelog, /docs e fixture de release existem.'
        : 'public site must expose release train em release, changelog e docs.',
      undefined,
      missing,
    );
  }

  private checkCoreScripts(scripts: Record<string, string>): ReleaseTrainCheck[] {
    return RELEASE_TRAIN_REQUIRED_CORE_SCRIPTS.map((scriptName) => {
      const command = String(scripts[scriptName] || '').trim();
      return this.check(
        `release-train:script:${scriptName}`,
        `script canonical ${scriptName}`,
        command ? 'pass' : 'fail',
        command ? `main repo exposes "${scriptName}" para release train v1.x.`
          : `main repo must expose "${scriptName}" no package.json.`,
        'package.json',
        [`script=${command || '<missing>'}`],
      );
    });
  }

  private checkBaseline(corePackage: PackageLike): ReleaseTrainCheck {
    const issues: string[] = [];
    const packageVersion = String(corePackage.version || '').trim();
    if (!isV1ReleaseTrainVersion(packageVersion)) {
      issues.push(`package version esperada no release train v1.x, current ${packageVersion || '<missing>'}`);
    }
    const source = [
      this.readCoreText('docs/product-direction.md') || '',
      this.readCoreText('docs/product-direction.md') || '',
      this.websiteReleaseSource(),
    ].join('\n');
    for (const term of ['v1.0.0', 'baseline', 'stable']) {
      if (!source.toLowerCase().includes(term.toLowerCase())) {
        issues.push(`baseline without termo: ${term}`);
      }
    }
    return this.check(
      'release-train:baseline',
      'baseline v1.0.0 documentado',
      issues.length === 0 ? 'pass' : 'fail',
      issues.length === 0
        ? 'v1.0.0 is documentado como baseline stable e o package is no release train v1.x.'
        : 'baseline v1.0.0 must be documented and the package must be in release train v1.x.',
      'package.json',
      issues,
    );
  }

  private checkVersionPolicies(): ReleaseTrainCheck {
    const issues: string[] = [];
    const byLane = new Map(RELEASE_TRAIN_VERSION_POLICIES.map((policy) => [policy.lane, policy]));
    for (const lane of ['baseline', 'patch', 'minor', 'breaking'] as const) {
      if (!byLane.has(lane)) {
        issues.push(`lane missing: ${lane}`);
      }
    }
    const patch = byLane.get('patch');
    if (!patch?.requiresRollback) {
      issues.push('patch v1.0.x needs rollback');
    }
    if ((patch?.allowedScope || []).some((scope) => scope.toLowerCase().includes('feature'))) {
      issues.push('patch v1.0.x must not include broad features');
    }
    const minor = byLane.get('minor');
    if (!minor?.requiresApprovedPlanning) {
      issues.push('minor v1.1.0 needs approved planning');
    }
    const breaking = byLane.get('breaking');
    if (!breaking?.requiresApprovedPlanning || !breaking.allowedScope.some((scope) => scope.toLowerCase().includes('migration'))) {
      issues.push('breaking change needs an explicit cycle and migration guide');
    }
    return this.check(
      'release-train:version-policies',
      'patch/minor/breaking policy',
      issues.length === 0 ? 'pass' : 'fail',
      issues.length === 0
        ? 'v1.0.x, v1.1.0 e breaking changes tem escopo, planejamento e rollback definidos.'
        : 'version policy v1.x is incomplete.',
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
    issues.push(...alwaysOn.map((id) => `${id}: release train must not be an always-on process`));
    for (const required of ['rc-window', 'patch-hotfix', 'minor-planning', 'lts-review']) {
      if (!RELEASE_TRAIN_CALENDAR.some((item) => item.id === required)) {
        issues.push(`item de calendario missing: ${required}`);
      }
    }
    return this.check(
      'release-train:calendar',
      'calendario leve v1.x',
      issues.length === 0 ? 'pass' : 'fail',
      issues.length === 0
        ? 'calendario e sob demanda/per-release, without watcher ou process pesado sempre ligado.'
        : 'calendario de release train is incompleto ou pesado demais.',
      'src/contracts/ReleaseTrainContract.ts',
      issues,
    );
  }

  private checkReleaseCandidateChecklist(scripts: Record<string, string>): ReleaseTrainCheck {
    const issues: string[] = [];
    const requiredCommands = ['release:status:fast', 'qa:release-bundle', 'qa:distribution-hardening', 'qa:integration-showcase', 'release:rollback-preview', 'release:changelog'];
    for (const command of requiredCommands) {
      if (!RELEASE_CANDIDATE_CHECKLIST.some((item) => item.command === `npm run ${command}`)) {
        issues.push(`checklist without command: ${command}`);
      }
      if (!String(scripts[command] || '').trim()) {
        issues.push(`script missing: ${command}`);
      }
    }
    const optional = RELEASE_CANDIDATE_CHECKLIST.filter((item) => !item.required).map((item) => item.id);
    if (optional.length > 0) {
      issues.push(`RC checklist must not have optional items: ${optional.join(', ')}`);
    }
    return this.check(
      'release-train:rc-checklist',
      'checklist de release candidate',
      issues.length === 0 ? 'pass' : 'fail',
      issues.length === 0
        ? 'release candidate cobre status, bundle, distribution, integration smoke, rollback e changelog.'
        : 'checklist de release candidate is incompleto.',
      'src/contracts/ReleaseTrainContract.ts',
      issues,
    );
  }

  private checkHotfixPlaybook(): ReleaseTrainCheck {
    const issues: string[] = [];
    for (const required of ['classify', 'branch', 'validate', 'publish']) {
      if (!HOTFIX_PLAYBOOK.some((step) => step.id === required)) {
        issues.push(`passo missing: ${required}`);
      }
    }
    for (const step of HOTFIX_PLAYBOOK) {
      if (!step.rollback.trim()) {
        issues.push(`${step.id}: without rollback`);
      }
      if (!step.evidence.trim()) {
        issues.push(`${step.id}: without evidence`);
      }
    }
    return this.check(
      'release-train:hotfix-playbook',
      'rollback e hotfix playbook',
      issues.length === 0 ? 'pass' : 'fail',
      issues.length === 0
        ? 'hotfix v1.0.x tem classification, branch, validation, publish e rollback claro.'
        : 'hotfix playbook is incompleto.',
      'src/contracts/ReleaseTrainContract.ts',
      issues,
    );
  }

  private checkPreviousGates(scripts: Record<string, string>): ReleaseTrainCheck {
    const missing = ['public-adoption-readiness', 'hosted-site-operations', 'distribution-hardening', 'public-docs-recipes', 'pilot-loop', 'integration-showcase']
      .map((gate) => `qa:${gate}`)
      .filter((scriptName) => !String(scripts[scriptName] || '').trim());
    return this.check(
      'release-train:previous-gates',
      'previous gates preserved',
      missing.length === 0 ? 'pass' : 'fail',
      missing.length === 0
        ? 'release train parte de gates anteriores closeds e ainda executaveis.'
        : 'algum gate anterior do ciclo de release is missing.',
      'package.json',
      missing,
    );
  }

  private checkWebsiteCoverage(): ReleaseTrainCheck {
    const source = this.websiteReleaseSource();
    const missing = RELEASE_TRAIN_REQUIRED_WEBSITE_TERMS.filter((term) => !source.includes(term));
    return this.check(
      'release-train:website-coverage',
      'release train on public site',
      missing.length === 0 ? 'pass' : 'fail',
      missing.length === 0
        ? 'public site covers v1.0.0, v1.0.x, v1.1.0, LTS, hotfix, RC, rollback, tags, and GitHub Releases.'
        : 'public site must document release train v1.x.',
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
      'prohibited release claims',
      evidence.length === 0 ? 'pass' : 'fail',
      evidence.length === 0
        ? 'release train not promete publish without rollback, breaking silencioso ou process sempre ligado.'
        : 'release train contains claim proibido.',
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
        this.requireArtifacts ? 'release-train-plan.json must exist for qa:release-train.'
          : 'plan not required in this snapshot; qa:release-train generates and validates the artifact.',
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
        : 'release-train-plan.json is incompleto.',
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
        this.requireArtifacts ? 'release-candidate-checklist.json must exist for qa:release-train.'
          : 'checklist not exigido neste snapshot; qa:release-train gera e valida o artifact.',
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
        : 'release-candidate-checklist.json is incompleto.',
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
        this.requireArtifacts ? 'hotfix-playbook.json must exist for qa:release-train.'
          : 'hotfix playbook not exigido neste snapshot; qa:release-train gera e valida o artifact.',
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
        ? 'hotfix-playbook.json cobre classify, branch, validate, and publish com rollback.'
        : 'hotfix-playbook.json is incompleto.',
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
    ];
    const missing = required.filter((term) => !source.includes(term));
    return this.check(
      'release-train:docs-runbook',
      'readiness gate documentation and runbook',
      missing.length === 0 ? 'pass' : 'fail',
      missing.length === 0
        ? 'docs explain release train, LTS, patch, minor, RC, hotfix, rollback, and readiness gates.'
        : 'docs must explain how to close and operate release train v1.x.',
      'docs/product-direction.md',
      missing.map((term) => `faltando: ${term}`),
    );
  }

  private checkCycleClosure(): ReleaseTrainCheck {
    const source = [
      this.readCoreText('docs/product-direction.md') || '',
      this.readCoreText('docs/product-direction.md') || '',
    ].join('\n').toLowerCase();
    const required = ['release train', 'closed', 'not objetivos', 'v1.1.0'];
    const missing = required.filter((term) => !source.includes(term));
    return this.check(
      'release-train:cycle-closure',
      'release cycle ready for guided operation',
      missing.length === 0 ? 'pass' : 'fail',
      missing.length === 0
        ? 'documentaction marca o ciclo de release como closed e direciona new changes para v1.0.x/v1.1.0.'
        : 'ciclo de release ainda not is claramente closed na documentaction.',
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
      issues.push('ok must be true');
    }
    for (const id of expectedIds) {
      const result = results.find((item) => item.id === id);
      if (!result) {
        issues.push(`missing result: ${id}`);
        continue;
      }
      if (result.status !== 'pass') {
        issues.push(`result failed: ${id}`);
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
    } catch (error: unknown) {logger.warn('[Release Train] filesystem operation failed', error); return null; }
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
    } catch (error: unknown) {logger.warn('[Release Train] filesystem operation failed', error); return null; }
  }

  private parseJson(raw: string): JsonRecord | null {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as JsonRecord : null;
    } catch (error: unknown) {logger.warn('[Release Train] JSON parse failed', error); return null; }
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
  return /^1\.(?:0|[1-9]\d*)\.\d+(?:-[0-9A-Za-z.-]+)...$/.test(version);
}
