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
          'Com docs e recipes publicas verificaveis, o proximo passo e transformar feedback e pilotos em loop de produto auditavel.',
      },
    };
  }

  public renderReport(snapshot: PublicDocsRecipesSnapshot = this.buildSnapshot()): string {
    const lines: string[] = [];
    lines.push('[public-docs-recipes] Readiness checkpoint 6 - Public Docs, Examples And Recipes Expansion');
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
    lines.push(`proximo passo recomendada: ${snapshot.nextRecommendedGate.gate} - ${snapshot.nextRecommendedGate.title}`);
    lines.push(snapshot.nextRecommendedGate.reason);
    return lines.join('\n');
  }

  private checkWebsiteRoot(): PublicDocsRecipesCheck {
    const exists = this.existsSync(this.websiteRoot);
    return this.check(
      'public-docs-recipes:website-root',
      'base publica zavorth-website',
      exists ? 'pass' : 'fail',
      exists
        ? 'repositorio zavorth-website encontrado para validar docs e examples.'
        : 'repositorio zavorth-website nao foi encontrado. Configure ZAVORTH_WEBSITE_REPO_ROOT.',
      this.websiteRoot,
    );
  }

  private checkWebsiteFiles(): PublicDocsRecipesCheck {
    const missing = PUBLIC_DOCS_RECIPES_REQUIRED_WEBSITE_FILES
      .filter((filePath) => !this.existsSync(path.join(this.websiteRoot, filePath)));
    return this.check(
      'public-docs-recipes:website-files',
      'rotas e fixture publicas',
      missing.length === 0 ? 'pass' : 'fail',
      missing.length === 0
        ? '/docs, /examples, fixture e gate local existem no site publico.'
        : 'docs, examples, fixture ou gate local estao ausentes no site publico.',
      undefined,
      missing,
    );
  }

  private checkCoreScripts(scripts: Record<string, string>): PublicDocsRecipesCheck[] {
    return PUBLIC_DOCS_RECIPES_REQUIRED_CORE_SCRIPTS.map((scriptName) => {
      const command = String(scripts[scriptName] || '').trim();
      return this.check(
        `public-docs-recipes:script:${scriptName}`,
        `script canonico ${scriptName}`,
        command ? 'pass' : 'fail',
        command
          ? `repo principal expoe "${scriptName}" para docs e recipes publicas.`
          : `repo principal precisa expor "${scriptName}" no package.json.`,
        'package.json',
        [`script=${command || '<ausente>'}`],
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
        issues.push(`use case ausente: ${useCase}`);
      }
    }
    for (const recipe of PUBLIC_DOCS_RECIPES) {
      if (recipe.prerequisites.length === 0) {
        issues.push(`${recipe.id}: sem pre-requisitos`);
      }
      if (recipe.commands.length === 0) {
        issues.push(`${recipe.id}: sem comandos`);
      }
      if (!recipe.expectedResult.trim()) {
        issues.push(`${recipe.id}: sem resultado esperado`);
      }
      if (recipe.risk !== 'low' && !recipe.previewFirst) {
        issues.push(`${recipe.id}: recipe de risco precisa ser preview-first`);
      }
      if (recipe.requiresSecrets && recipe.fixtureMode) {
        issues.push(`${recipe.id}: fixture nao deve exigir secrets`);
      }
    }
    return this.check(
      'public-docs-recipes:recipes-contract',
      'cookbooks publicos por caso de uso',
      issues.length === 0 ? 'pass' : 'fail',
      issues.length === 0
        ? 'recipes cobrem quickstart, engenharia, release e artifacts/replay com fixture-safe mode.'
        : 'recipes publicos estao incompletos ou sem guardrails.',
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
      return String(scripts[scriptName] || '').trim() ? [] : [`${command} -> script ausente: ${scriptName}`];
    });
    return this.check(
      'public-docs-recipes:recipe-commands',
      'comandos de recipes existem',
      missing.length === 0 ? 'pass' : 'fail',
      missing.length === 0
        ? 'todos os comandos npm run usados pelos recipes existem no package.json.'
        : 'algum recipe publico aponta para comando inexistente.',
      'package.json',
      missing,
    );
  }

  private checkWebsiteCoverage(): PublicDocsRecipesCheck {
    const source = this.websiteDocsSource();
    const missing = PUBLIC_DOCS_RECIPES_REQUIRED_TERMS.filter((term) => !source.includes(term));
    return this.check(
      'public-docs-recipes:website-coverage',
      'cobertura em /docs e /examples',
      missing.length === 0 ? 'pass' : 'fail',
      missing.length === 0
        ? 'site publico cobre quickstart, examples, troubleshooting, artifacts/replay, fixture e rotas essenciais.'
        : 'site publico precisa expor termos/links essenciais para docs e recipes.',
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
      return terms.some((term) => source.includes(term)) ? [] : [`sintoma sem cobertura: ${item.id}`];
    });
    return this.check(
      'public-docs-recipes:troubleshooting',
      'troubleshooting por sintomas',
      missing.length === 0 ? 'pass' : 'fail',
      missing.length === 0
        ? 'troubleshooting cobre install, runtime, site e feedback com comandos seguros.'
        : 'troubleshooting publico precisa cobrir install, runtime, site e feedback.',
      'docs/troubleshooting.md',
      missing,
    );
  }

  private checkNoSecretsMatrix(scripts: Record<string, string>): PublicDocsRecipesCheck {
    const issues: string[] = [];
    const runnableWithoutSecrets = PUBLIC_DOCS_NO_SECRETS_MATRIX.filter((item) => item.runsWithoutSecrets);
    if (runnableWithoutSecrets.length < 4) {
      issues.push(`capacidades sem secrets insuficientes: ${runnableWithoutSecrets.length}/4`);
    }
    for (const item of PUBLIC_DOCS_NO_SECRETS_MATRIX) {
      const scriptName = extractNpmRunScript(item.command);
      if (scriptName && !String(scripts[scriptName] || '').trim()) {
        issues.push(`${item.id}: script ausente ${scriptName}`);
      }
      if (item.runsWithoutSecrets && !item.fixtureAvailable) {
        issues.push(`${item.id}: sem fixture para modo sem secrets`);
      }
    }
    return this.check(
      'public-docs-recipes:no-secrets-matrix',
      'matriz do que roda sem secrets',
      issues.length === 0 ? 'pass' : 'fail',
      issues.length === 0
        ? 'matriz diferencia fluxos sem secrets de publish externo que exige credencial.'
        : 'matriz de secrets/fixtures esta incompleta.',
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
      'claims e vazamentos proibidos',
      evidence.length === 0 ? 'pass' : 'fail',
      evidence.length === 0
        ? 'docs e recipes nao expoem paths pessoais, tokens ou claims proibidos.'
        : 'docs ou recipes contem path pessoal, token ou claim proibido.',
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
        this.requireArtifacts
          ? 'recipes-fixture-smoke.json precisa existir para qa:public-docs-recipes.'
          : 'fixture smoke nao exigido neste snapshot; qa:public-docs-recipes gera e valida o artifact.',
        this.fixtureSmokePath,
      );
    }

    const results = Array.isArray(artifact.results) ? artifact.results as PublicDocsRecipesFixtureResult[] : [];
    const issues: string[] = [];
    if (artifact.ok !== true) {
      issues.push('ok precisa ser true');
    }
    if (artifact.mode !== 'fixture') {
      issues.push('mode precisa ser fixture');
    }
    for (const recipe of PUBLIC_DOCS_RECIPES.filter((item) => item.fixtureMode)) {
      const result = results.find((item) => item.id === recipe.id);
      if (!result) {
        issues.push(`recipe sem resultado: ${recipe.id}`);
        continue;
      }
      if (result.status !== 'pass') {
        issues.push(`recipe falhou: ${recipe.id}`);
      }
      if (result.requiresSecrets) {
        issues.push(`recipe exige secret no fixture: ${recipe.id}`);
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
        ? 'pelo menos tres recipes passam em modo fixture sem secrets e sem mutar o host.'
        : 'fixture smoke dos recipes esta ausente, incompleto ou inseguro.',
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
      'sem secrets',
      'troubleshooting',
      'qa:public-docs-recipes',
    ];
    const missing = required.filter((term) => !source.includes(term));
    return this.check(
      'public-docs-recipes:docs-runbook',
      'documentacao e runbook da Readiness checkpoint 6',
      missing.length === 0 ? 'pass' : 'fail',
      missing.length === 0
        ? 'docs explicam recipes, pre-requisitos, fixture mode, sem secrets, troubleshooting e gates da Readiness checkpoint 6.'
        : 'docs precisam explicar como fechar e operar public docs recipes.',
      'docs/product-direction.md',
      missing.map((term) => `faltando: ${term}`),
    );
  }

  private checkNextPhasePlanning(): PublicDocsRecipesCheck {
    const source = [
      this.readCoreText('docs/product-direction.md') || '',
      this.readCoreText('docs/product-direction.md') || '',
    ].join('\n');
    const missing = ['Readiness checkpoint 7 - Feedback, Support And Pilot Loop', 'qa:pilot-loop']
      .filter((term) => !source.includes(term));
    return this.check(
      'public-docs-recipes:next-phase',
      'recomendacao para Readiness checkpoint 7',
      missing.length === 0 ? 'pass' : 'fail',
      missing.length === 0
        ? 'Readiness checkpoint 6 aponta explicitamente para feedback, support e pilot loop.'
        : 'Readiness checkpoint 6 precisa deixar a Readiness checkpoint 7 como proxima acao.',
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
