import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';
import { logger } from '../logger.js';
import {
PUBLIC_DOCS_NO_SECRETS_MATRIX,
  PUBLIC_DOCS_RECIPES,
  PUBLIC_DOCS_RECIPES_FORBIDDEN_CLAIMS,
  PUBLIC_DOCS_RECIPES_REQUIRED_CORE_SCRIPTS,
  PUBLIC_DOCS_RECIPES_REQUIRED_TERMS,
  PUBLIC_DOCS_RECIPES_REQUIRED_WEBSITE_FILES,
  PUBLIC_DOCS_TROUBLESHOOTING,
  type PublicDocsRecipesCheck,
  type PublicDocsRecipesCheckStatus,
  type PublicDocsRecipesFixtureResult,
  type PublicDocsRecipesSnapshot,
} from '../contracts/PublicDocsRecipesContract.js';
type PackageLike = {
  scripts?: Record<string, string>;
};
type JsonRecord = Record<string, unknown>;
export type PublicDocsRecipesServiceOptions = {
  projectRoot?: string;
  websiteRoot?: string;
  artifactDir?: string;
  fixtureSmokePath?: string;
  requireArtifacts?: boolean;
  files?: Record<string, string>;
  existsSync?: (targetPath: string) => boolean;
  readFileSync?: (targetPath: string, encoding: BufferEncoding) => string;
  now?: () => Date;
};
export class PublicDocsRecipesService {
  private readonly projectRoot: string;
  private readonly websiteRoot: string;
  private readonly artifactDir: string;
  private readonly fixtureSmokePath: string;
  private readonly requireArtifacts: boolean;
  private readonly files: Record<string, string>;
  private readonly existsSync: (targetPath: string) => boolean;
  private readonly readFileSync: (targetPath: string, encoding: BufferEncoding) => string;
  private readonly now: () => Date;
  constructor(options: PublicDocsRecipesServiceOptions = {}) {
    this.projectRoot = options.projectRoot || config.projectRoot;
    this.websiteRoot = options.websiteRoot || resolveDefaultWebsiteRoot(this.projectRoot);
    this.artifactDir = options.artifactDir || path.join(this.projectRoot, '.qa', 'public-docs-recipes');
    this.fixtureSmokePath = options.fixtureSmokePath || path.join(this.artifactDir, 'recipes-fixture-smoke.json');
    this.requireArtifacts = Boolean(options.requireArtifacts);
    this.files = options.files || {};
    this.existsSync = options.existsSync || fs.existsSync;
    this.readFileSync = options.readFileSync || fs.readFileSync;
    this.now = options.now || (() => new Date());
  }
  public buildSnapshot(): PublicDocsRecipesSnapshot {
    const scripts = this.readCoreJson('package.json')?.scripts || {};
    const checks = [
      this.checkWebsiteRoot(),
      this.checkWebsiteFiles(),
      ...this.checkCoreScripts(scripts),
      this.checkRecipesContract(),
      this.checkRecipeCommands(scripts),
      this.checkWebsiteCoverage(),
      this.checkTroubleshootingCoverage(),
      this.checkNoSecretsMatrix(scripts),
      this.checkForbiddenClaims(),
      this.checkFixtureSmokeArtifact(),
      this.checkDocsRunbook(),
      this.checkNextPhasePlanning(),
    ];
    const failed = checks.filter((check) => check.status === 'fail').length;
    const warnings = checks.filter((check) => check.status === 'warn').length;
    const passed = checks.filter((check) => check.status === 'pass').length;
    return {
      gate: 'public-docs-recipes',
      surface: 'public-docs-recipes',
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
      routes: ['/docs', '/examples'],
      recipes: PUBLIC_DOCS_RECIPES,
      troubleshooting: PUBLIC_DOCS_TROUBLESHOOTING,
      noSecretsMatrix: PUBLIC_DOCS_NO_SECRETS_MATRIX,
      artifacts: {
        fixtureSmokePath: this.fixtureSmokePath,
      },
      checks,
      nextRecommendedGate: {
        gate: 'pilot-loop',
        title: 'Feedback, Support And Pilot Loop',
        reason:
          'With verifiable public docs and recipes, the next step is turning feedback and pilots into an auditable product loop.',
      },
    };
  }
  public renderReport(snapshot: PublicDocsRecipesSnapshot = this.buildSnapshot()): string {
    const lines: string[] = [];
    lines.push('[public-docs-recipes] Readiness gate - Public Docs, Examples And Recipes Expansion');
    lines.push(`status: ${snapshot.status}`);
    lines.push(`ok: ${snapshot.summary.ok ? 'yes' : 'no'} | pass=${snapshot.summary.passed} warn=${snapshot.summary.warnings} fail=${snapshot.summary.failed}`);
    lines.push(`website: ${snapshot.websiteRoot}`);
    lines.push(`artifact: ${snapshot.artifacts.fixtureSmokePath}`);
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
  private checkWebsiteRoot(): PublicDocsRecipesCheck {
    const exists = this.existsSync(this.websiteRoot);
    return this.check(
      'public-docs-recipes:website-root',
      'base public zavorth-website',
      exists ? 'pass' : 'fail',
      exists ? 'repositorio zavorth-website encontrado para validate docs e examples.'
        : 'zavorth-website repository was not found. Configure ZAVORTH_WEBSITE_REPO_ROOT.',
      this.websiteRoot,
    );
  }
  private checkWebsiteFiles(): PublicDocsRecipesCheck {
    const missing = PUBLIC_DOCS_RECIPES_REQUIRED_WEBSITE_FILES
      .filter((filePath) => !this.existsSync(path.join(this.websiteRoot, filePath)));
    return this.check(
      'public-docs-recipes:website-files',
      'public routes and fixture',
      missing.length === 0 ? 'pass' : 'fail',
      missing.length === 0
        ? '/docs, /examples, fixture, and local gate exist in the public site.'
        : 'docs, examples, fixture, or local gate are missing in the public site.',
      undefined,
      missing,
    );
  }
  private checkCoreScripts(scripts: Record<string, string>): PublicDocsRecipesCheck[] {
    return PUBLIC_DOCS_RECIPES_REQUIRED_CORE_SCRIPTS.map((scriptName) => {
      const command = String(scripts[scriptName] || '').trim();
      return this.check(
        `public-docs-recipes:script:${scriptName}`,
        `script canonical ${scriptName}`,
        command ? 'pass' : 'fail',
        command ? `main repo exposes "${scriptName}" for public docs and recipes.`
          : `main repo must expose "${scriptName}" no package.json.`,
        'package.json',
        [`script=${command || '<missing>'}`],
      );
    });
  }
  private checkRecipesContract(): PublicDocsRecipesCheck {
    const issues: string[] = [];
    const fixtureRecipes = PUBLIC_DOCS_RECIPES.filter((recipe) => recipe.fixtureMode && !recipe.requiresSecrets);
    if (fixtureRecipes.length < 3) {
      issues.push(`recipes fixture-safe insuficientes: ${fixtureRecipes.length}/3`);
    }
    const useCases = new Set(PUBLIC_DOCS_RECIPES.map((recipe) => recipe.useCase));
    for (const useCase of ['quickstart', 'engineering', 'release', 'replay-artifacts']) {
      if (!useCases.has(useCase as never)) {
        issues.push(`use case missing: ${useCase}`);
      }
    }
    for (const recipe of PUBLIC_DOCS_RECIPES) {
      if (recipe.prerequisites.length === 0) {
        issues.push(`${recipe.id}: without pre-requisitos`);
      }
      if (recipe.commands.length === 0) {
        issues.push(`${recipe.id}: without commands`);
      }
      if (!recipe.expectedResult.trim()) {
        issues.push(`${recipe.id}: without expected result`);
      }
      if (recipe.risk !== 'low' && !recipe.previewFirst) {
        issues.push(`${recipe.id}: risky recipe must be preview-first`);
      }
      if (recipe.requiresSecrets && recipe.fixtureMode) {
        issues.push(`${recipe.id}: fixture must not require secrets`);
      }
    }
    return this.check(
      'public-docs-recipes:recipes-contract',
      'public cookbooks por caso de usage',
      issues.length === 0 ? 'pass' : 'fail',
      issues.length === 0
        ? 'recipes cobrem quickstart, engenharia, release e artifacts/replay com fixture-safe mode.'
        : 'public recipes are incomplete or missing guardrails.',
      'src/contracts/PublicDocsRecipesContract.ts',
      issues,
    );
  }
  private checkRecipeCommands(scripts: Record<string, string>): PublicDocsRecipesCheck {
    const commands = new Set(PUBLIC_DOCS_RECIPES.flatMap((recipe) => recipe.commands));
    const missing = [...commands].flatMap((command) => {
      const scriptName = extractNpmRunScript(command);
      if (!scriptName || scriptName === 'install') {
        return [];
      }
      return String(scripts[scriptName] || '').trim() ? [] : [`${command} -> script missing: ${scriptName}`];
    });
    return this.check(
      'public-docs-recipes:recipe-commands',
      'recipe commands exist',
      missing.length === 0 ? 'pass' : 'fail',
      missing.length === 0
        ? 'all npm run commands used by recipes exist in package.json.'
        : 'some public recipe points to a missing command.',
      'package.json',
      missing,
    );
  }
  private checkWebsiteCoverage(): PublicDocsRecipesCheck {
    const source = this.websiteDocsSource();
    const missing = PUBLIC_DOCS_RECIPES_REQUIRED_TERMS.filter((term) => !source.includes(term));
    return this.check(
      'public-docs-recipes:website-coverage',
      'coverage in /docs and /examples',
      missing.length === 0 ? 'pass' : 'fail',
      missing.length === 0
        ? 'public site covers quickstart, examples, troubleshooting, artifacts/replay, fixture, and essential routes.'
        : 'public site must expose essential terms/links for docs and recipes.',
      'app/docs/page.tsx',
      missing.map((term) => `faltando: ${term}`),
    );
  }
  private checkTroubleshootingCoverage(): PublicDocsRecipesCheck {
    const source = [
      this.websiteDocsSource(),
      this.readCoreText('docs/troubleshooting.md') || '',
    ].join('\n').toLowerCase();
    const missing = PUBLIC_DOCS_TROUBLESHOOTING.flatMap((item) => {
      const terms = [item.id, item.safeCommand, item.symptom.split(' ')[0]].map((term) => term.toLowerCase());
      return terms.some((term) => source.includes(term)) ? [] : [`symptom without coverage: ${item.id}`];
    });
    return this.check(
      'public-docs-recipes:troubleshooting',
      'troubleshooting por sintomas',
      missing.length === 0 ? 'pass' : 'fail',
      missing.length === 0
        ? 'troubleshooting covers install, runtime, site, and feedback with safe commands.'
        : 'public troubleshooting must cover install, runtime, site, and feedback.',
      'docs/troubleshooting.md',
      missing,
    );
  }
  private checkNoSecretsMatrix(scripts: Record<string, string>): PublicDocsRecipesCheck {
    const issues: string[] = [];
    const runnableWithoutSecrets = PUBLIC_DOCS_NO_SECRETS_MATRIX.filter((item) => item.runsWithoutSecrets);
    if (runnableWithoutSecrets.length < 4) {
      issues.push(`capacidades without secrets insuficientes: ${runnableWithoutSecrets.length}/4`);
    }
    for (const item of PUBLIC_DOCS_NO_SECRETS_MATRIX) {
      const scriptName = extractNpmRunScript(item.command);
      if (scriptName && !String(scripts[scriptName] || '').trim()) {
        issues.push(`${item.id}: script missing ${scriptName}`);
      }
      if (item.runsWithoutSecrets && !item.fixtureAvailable) {
        issues.push(`${item.id}: without fixture para modo without secrets`);
      }
    }
    return this.check(
      'public-docs-recipes:no-secrets-matrix',
      'matrix of what runs without secrets',
      issues.length === 0 ? 'pass' : 'fail',
      issues.length === 0
        ? 'matrix separates flows without secrets from external publish that requires a credential.'
        : 'secrets/fixtures matrix is incomplete.',
      'src/contracts/PublicDocsRecipesContract.ts',
      issues,
    );
  }
  private checkForbiddenClaims(): PublicDocsRecipesCheck {
    const source = [
      this.websiteDocsSource(),
      this.readCoreText('docs/product-direction.md') || '',
    ].join('\n');
    const forbiddenMatches = PUBLIC_DOCS_RECIPES_FORBIDDEN_CLAIMS.filter((claim) => source.toLowerCase().includes(String(claim).toLowerCase()));
    const tokenMatches = source.match(/(^|[^A-Za-z])sk-[A-Za-z0-9_-]{12,}/g) || [];
    const pathMatches = source.match(/[A-Z]:\\[^'")\s]+/g) || [];
    const evidence = [...forbiddenMatches, ...tokenMatches, ...pathMatches];
    return this.check(
      'public-docs-recipes:forbidden-claims',
      'prohibited claims and leaks',
      evidence.length === 0 ? 'pass' : 'fail',
      evidence.length === 0
        ? 'docs and recipes do not expose personal paths, tokens, or forbidden claims.'
        : 'docs or recipes contains path pessoal, token or claim proibido.',
      undefined,
      evidence,
    );
  }
  private checkFixtureSmokeArtifact(): PublicDocsRecipesCheck {
    const artifact = this.readArtifactJson(this.fixtureSmokePath, 'recipes-fixture-smoke.json');
    if (!artifact) {
      return this.check(
        'public-docs-recipes:fixture-smoke',
        'smoke fixture dos recipes',
        this.requireArtifacts ? 'fail' : 'warn',
        this.requireArtifacts ? 'recipes-fixture-smoke.json must exist for qa:public-docs-recipes.'
          : 'fixture smoke not required in this snapshot; qa:public-docs-recipes gera e valida o artifact.',
        this.fixtureSmokePath,
      );
    }
    const results = Array.isArray(artifact.results) ? artifact.results as PublicDocsRecipesFixtureResult[] : [];
    const issues: string[] = [];
    if (artifact.ok !== true) {
      issues.push('ok must be true');
    }
    if (artifact.mode !== 'fixture') {
      issues.push('mode must be fixture');
    }
    for (const recipe of PUBLIC_DOCS_RECIPES.filter((item) => item.fixtureMode)) {
      const result = results.find((item) => item.id === recipe.id);
      if (!result) {
        issues.push(`recipe without result: ${recipe.id}`);
        continue;
      }
      if (result.status !== 'pass') {
        issues.push(`recipe failed: ${recipe.id}`);
      }
      if (result.requiresSecrets) {
        issues.push(`recipe requires secret in fixture: ${recipe.id}`);
      }
      if (result.mutatesHost) {
        issues.push(`recipe muta host no fixture: ${recipe.id}`);
      }
    }
    const passedFixtureResults = results.filter((item) => item.status === 'pass' && !item.requiresSecrets && !item.mutatesHost);
    if (passedFixtureResults.length < 3) {
      issues.push(`fixture recipes verdes insuficientes: ${passedFixtureResults.length}/3`);
    }
    return this.check(
      'public-docs-recipes:fixture-smoke',
      'smoke fixture dos recipes',
      issues.length === 0 ? 'pass' : 'fail',
      issues.length === 0
        ? 'at least three recipes pass in fixture mode without secrets and without mutating the host.'
        : 'fixture smoke dos recipes is missing, incompleto or inseguro.',
      this.fixtureSmokePath,
      issues,
    );
  }
  private checkDocsRunbook(): PublicDocsRecipesCheck {
    const source = [
      this.readCoreText('docs/product-direction.md') || '',
      this.readCoreText('docs/product-direction.md') || '',
    ].join('\n').toLowerCase();
    const required = [
      'public docs',
      'recipes',
      'pre-requisitos',
      'fixture',
      'without secrets',
      'troubleshooting',
      'qa:public-docs-recipes',
    ];
    const missing = required.filter((term) => !source.includes(term));
    return this.check(
      'public-docs-recipes:docs-runbook',
      'readiness gate documentation and runbook',
      missing.length === 0 ? 'pass' : 'fail',
      missing.length === 0
        ? 'docs explain recipes, prerequisites, fixture mode, secret-free operation, troubleshooting, and readiness gates.'
        : 'docs must explain how to close and operate public docs recipes.',
      'docs/product-direction.md',
      missing.map((term) => `faltando: ${term}`),
    );
  }
  private checkNextPhasePlanning(): PublicDocsRecipesCheck {
    const source = [
      this.readCoreText('docs/product-direction.md') || '',
      this.readCoreText('docs/product-direction.md') || '',
    ].join('\n');
    const missing = ['Readiness gate - Feedback, Support And Pilot Loop', 'qa:pilot-loop']
      .filter((term) => !source.includes(term));
    return this.check(
      'public-docs-recipes:next-phase',
      'recommendation for readiness gate',
      missing.length === 0 ? 'pass' : 'fail',
      missing.length === 0
        ? 'readiness gate aponta explicitmente para feedback, support e pilot loop.'
        : 'readiness gate must leave readiness gate as the next action.',
      'docs/product-direction.md',
      missing,
    );
  }
  private websiteDocsSource(): string {
    return [
      'app/docs/page.tsx',
      'app/examples/page.tsx',
      'data/external-docs.ts',
    ].map((filePath) => this.readWebsiteText(filePath) || '').join('\n');
  }
  private readCoreJson(relativePath: string): PackageLike | null {
    const raw = this.readCoreText(relativePath);
    if (!raw) {
      return null;
    }
    try {
      return JSON.parse(raw) as PackageLike;
    } catch (error: unknown) {logger.warn('[Public Docs Recipes] JSON parse failed', error); return null; }
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
    } catch (error: unknown) {logger.warn('[Public Docs Recipes] filesystem operation failed', error); return null; }
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
    } catch (error: unknown) {logger.warn('[Public Docs Recipes] filesystem operation failed', error); return null; }
  }
  private parseJson(raw: string): JsonRecord | null {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as JsonRecord : null;
    } catch (error: unknown) {logger.warn('[Public Docs Recipes] JSON parse failed', error); return null; }
  }
  private check(
    id: string,
    title: string,
    status: PublicDocsRecipesCheckStatus,
    reason: string,
    filePath?: string,
    evidence: string[] = [],
  ): PublicDocsRecipesCheck {
    return { id, title, status, reason, path: filePath, evidence };
  }
}
function extractNpmRunScript(command: string): string | null {
  const normalized = command.trim();
  if (normalized === 'npm install') {
    return null;
  }
  const match = normalized.match(/^npm run ([^\s]+)/);
  return match ? match[1] : null;
}
function resolveDefaultWebsiteRoot(projectRoot: string): string {
  const override = String(process.env.ZAVORTH_WEBSITE_REPO_ROOT || '').trim();
  if (override) {
    return path.resolve(override);
  }
  return path.resolve(projectRoot, '..', '..', 'zavorth-website');
}
