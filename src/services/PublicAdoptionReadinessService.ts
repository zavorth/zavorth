import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';
import { logger } from '../logger.js';
import {
PUBLIC_ADOPTION_CLAIMS,
  PUBLIC_ADOPTION_DEMO_RUNBOOK,
  PUBLIC_ADOPTION_REQUIRED_CORE_SCRIPTS,
  PUBLIC_ADOPTION_REQUIRED_DOCS,
  PUBLIC_ADOPTION_RISKS,
  type PublicAdoptionReadinessCheck,
  type PublicAdoptionReadinessCheckStatus,
  type PublicAdoptionReadinessSnapshot,
} from '../contracts/PublicAdoptionReadinessContract.js';

type PackageLike = {
  name?: string;
  version?: string;
  scripts?: Record<string, string>;
};

export type PublicAdoptionReadinessServiceOptions = {
  projectRoot?: string;
  websiteRoot?: string;
  files?: Record<string, string>;
  existsSync?: (targetPath: string) => boolean;
  readFileSync?: (targetPath: string, encoding: BufferEncoding) => string;
  now?: () => Date;
};

const REQUIRED_RUNBOOK_ROUTES = ['/', '/demo', '/start', '/docs', '/release', '/feedback'] as const;
const HEAVY_GATE_MARKERS = ['--build', '--screenshots', 'website:build', 'qa:public-product', 'playwright'];

export class PublicAdoptionReadinessService {
  private readonly projectRoot: string;
  private readonly websiteRoot: string;
  private readonly files: Record<string, string>;
  private readonly existsSync: (targetPath: string) => boolean;
  private readonly readFileSync: (targetPath: string, encoding: BufferEncoding) => string;
  private readonly now: () => Date;

  constructor(options: PublicAdoptionReadinessServiceOptions = {}) {
    this.projectRoot = options.projectRoot || config.projectRoot;
    this.websiteRoot = options.websiteRoot || resolveDefaultWebsiteRoot(this.projectRoot);
    this.files = options.files || {};
    this.existsSync = options.existsSync || fs.existsSync;
    this.readFileSync = options.readFileSync || fs.readFileSync;
    this.now = options.now || (() => new Date());
  }

  public buildSnapshot(): PublicAdoptionReadinessSnapshot {
    const checks = [
      this.checkReleaseBaseline(),
      ...this.checkRequiredScripts(),
      this.checkLightGateShape(),
      ...this.checkRequiredDocs(),
      ...this.checkClaims(),
      ...this.checkRisks(),
      this.checkDemoRunbook(),
      this.checkWebsiteRoot(),
      this.checkNextPhasePlanning(),
    ];
    const failed = checks.filter((check) => check.status === 'fail').length;
    const warnings = checks.filter((check) => check.status === 'warn').length;
    const passed = checks.filter((check) => check.status === 'pass').length;

    return {
      phase: '53',
      surface: 'public-adoption-readiness',
      generatedAt: this.now().toISOString(),
      status: failed > 0 ? 'blocked' : warnings > 0 ? 'attention' : 'ready',
      projectRoot: this.projectRoot,
      websiteRoot: this.websiteRoot,
      summary: {
        ok: failed === 0,
        passed,
        warnings,
        failed,
        readinessScore: scoreReadiness(passed, warnings, checks.length),
      },
      baseline: {
        release: 'v1.0.0',
        packageName: this.readPackage()?.name || '<ausente>',
        packageVersion: this.readPackage()?.version || '<ausente>',
        roadmapPath: 'docs/product-direction.md',
        planningPath: 'docs/product-direction.md',
      },
      requiredScripts: [...PUBLIC_ADOPTION_REQUIRED_CORE_SCRIPTS],
      launchChecklist: checks.filter((check) => isLaunchChecklistCheck(check.id)),
      claims: PUBLIC_ADOPTION_CLAIMS,
      risks: PUBLIC_ADOPTION_RISKS,
      demoRunbook: PUBLIC_ADOPTION_DEMO_RUNBOOK,
      checks,
      nextRecommendedPhase: {
        phase: '54',
        title: 'Hosted Website And Demo Operations',
        reason:
          'Com a prontidao publica pos-v1.0.0 protegida por scorecard, claims, riscos e runbook, o proximo passo e fechar preview, deploy e rollback do site/demo.',
      },
    };
  }

  public renderReport(snapshot: PublicAdoptionReadinessSnapshot = this.buildSnapshot()): string {
    const lines: string[] = [];
    lines.push('[public-adoption] Readiness checkpoint 3 - Public Adoption Readiness');
    lines.push(`status: ${snapshot.status}`);
    lines.push(`ok: ${snapshot.summary.ok ? 'yes' : 'no'} | pass=${snapshot.summary.passed} warn=${snapshot.summary.warnings} fail=${snapshot.summary.failed}`);
    lines.push(`readiness-score: ${snapshot.summary.readinessScore}`);
    lines.push(`core: ${snapshot.projectRoot}`);
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
    lines.push('runbook demo 10min:');
    for (const step of snapshot.demoRunbook) {
      lines.push(`- ${step.minute} ${step.route}: ${step.label}`);
    }
    lines.push('');
    lines.push(`proximo passo recomendada: ${snapshot.nextRecommendedPhase.phase} - ${snapshot.nextRecommendedPhase.title}`);
    lines.push(snapshot.nextRecommendedPhase.reason);
    return lines.join('\n');
  }

  private checkReleaseBaseline(): PublicAdoptionReadinessCheck {
    const pkg = this.readPackage();
    const packageName = String(pkg?.name || '').trim();
    const packageVersion = String(pkg?.version || '').trim();
    const ok = packageName === 'zavorth' && packageVersion === '1.0.0';
    return this.check(
      'public-adoption:baseline',
      'baseline publicado v1.0.0',
      ok ? 'pass' : 'fail',
      ok
        ? 'package principal preserva name=zavorth e version=1.0.0 como baseline publico.'
        : 'package principal precisa preservar name=zavorth e version=1.0.0 para este ciclo.',
      'package.json',
      [`name=${packageName || '<ausente>'}`, `version=${packageVersion || '<ausente>'}`],
    );
  }

  private checkRequiredScripts(): PublicAdoptionReadinessCheck[] {
    const scripts = this.readPackage()?.scripts || {};
    return PUBLIC_ADOPTION_REQUIRED_CORE_SCRIPTS.map((scriptName) => {
      const command = String(scripts[scriptName] || '').trim();
      return this.check(
        `core:script:${scriptName}`,
        `script publico ${scriptName}`,
        command ? 'pass' : 'fail',
        command
          ? `repo principal expoe "${scriptName}" para produto/adocao publica.`
          : `repo principal precisa expor "${scriptName}" no package.json.`,
        'package.json',
        [`script=${command || '<ausente>'}`],
      );
    });
  }

  private checkLightGateShape(): PublicAdoptionReadinessCheck {
    const command = String(this.readPackage()?.scripts?.['qa:public-adoption'] || '').trim();
    const heavyMarkers = HEAVY_GATE_MARKERS.filter((marker) => command.includes(marker));
    const hasRequirePass = command.includes('--require-pass') || command.includes('--gate');
    const ok = Boolean(command) && hasRequirePass && heavyMarkers.length === 0;
    return this.check(
      'public-adoption:light-gate',
      'gate de adocao publica leve',
      ok ? 'pass' : 'fail',
      ok
        ? 'qa:public-adoption e deterministico e nao aciona build/screenshots por padrao.'
        : 'qa:public-adoption deve ser um gate leve, com --require-pass e sem build/screenshots.',
      'package.json',
      [
        `script=${command || '<ausente>'}`,
        `requirePass=${hasRequirePass}`,
        ...heavyMarkers.map((marker) => `marcador pesado: ${marker}`),
      ],
    );
  }

  private checkRequiredDocs(): PublicAdoptionReadinessCheck[] {
    return PUBLIC_ADOPTION_REQUIRED_DOCS.map((doc) => {
      const content = this.readCoreText(doc.path);
      const exists = content !== null;
      const hasPhrase = Boolean(content?.includes(doc.phrase));
      return this.check(
        `public-adoption:doc:${doc.path}`,
        doc.label,
        exists && hasPhrase ? 'pass' : 'fail',
        exists && hasPhrase
          ? `${doc.path} preserva a evidencia publica exigida.`
          : `${doc.path} precisa existir e conter "${doc.phrase}".`,
        doc.path,
        exists ? [`phrase=${hasPhrase}`] : ['arquivo ausente'],
      );
    });
  }

  private checkClaims(): PublicAdoptionReadinessCheck[] {
    return PUBLIC_ADOPTION_CLAIMS.map((claim) => {
      const missing = claim.evidence.flatMap((evidence) => {
        const content = this.readCoreText(evidence.path);
        if (content === null) {
          return [`ausente: ${evidence.path}`];
        }
        if (evidence.phrase && !content.includes(evidence.phrase)) {
          return [`${evidence.path} sem "${evidence.phrase}"`];
        }
        return [];
      });
      return this.check(
        `public-adoption:claim:${claim.id}`,
        `claim publico: ${claim.id}`,
        missing.length === 0 ? 'pass' : 'fail',
        missing.length === 0
          ? 'claim possui evidencia local em docs, servico, script ou release.'
          : `claim sem evidencia suficiente: ${claim.claim}`,
        undefined,
        missing.length === 0
          ? claim.evidence.map((evidence) => `${evidence.kind}:${evidence.path}`)
          : missing,
      );
    });
  }

  private checkRisks(): PublicAdoptionReadinessCheck[] {
    return PUBLIC_ADOPTION_RISKS.map((risk) => {
      const exists = this.pathExistsFromRoot(this.projectRoot, risk.evidencePath);
      return this.check(
        `public-adoption:risk:${risk.id}`,
        `risco mapeado: ${risk.title}`,
        exists ? 'pass' : 'fail',
        exists
          ? `mitigacao documentada: ${risk.mitigation}`
          : `risco precisa apontar para evidencia local: ${risk.evidencePath}`,
        risk.evidencePath,
        [`severity=${risk.severity}`],
      );
    });
  }

  private checkDemoRunbook(): PublicAdoptionReadinessCheck {
    const routes = new Set(PUBLIC_ADOPTION_DEMO_RUNBOOK.map((step) => step.route));
    const missing = REQUIRED_RUNBOOK_ROUTES.filter((route) => !routes.has(route));
    const hasProofAndFallback = PUBLIC_ADOPTION_DEMO_RUNBOOK.every((step) => step.proof.trim() && step.fallback.trim());
    const ok = missing.length === 0 && hasProofAndFallback && PUBLIC_ADOPTION_DEMO_RUNBOOK.length >= REQUIRED_RUNBOOK_ROUTES.length;
    return this.check(
      'public-adoption:runbook',
      'runbook de demo manual 10min',
      ok ? 'pass' : 'fail',
      ok
        ? 'runbook cobre landing, demo, first run, docs, release e feedback com fallback.'
        : 'runbook precisa cobrir todas as rotas e ter prova/fallback por etapa.',
      'docs/product-direction.md',
      [
        `routes=${Array.from(routes).join(',')}`,
        ...missing.map((route) => `faltando: ${route}`),
        `proofAndFallback=${hasProofAndFallback}`,
      ],
    );
  }

  private checkWebsiteRoot(): PublicAdoptionReadinessCheck {
    const exists = this.websiteRootExists();
    return this.check(
      'public-adoption:website-root',
      'site publico zavorth-website disponivel',
      exists ? 'pass' : 'warn',
      exists
        ? 'zavorth-website foi encontrado para apoiar demo/adocao publica.'
        : 'zavorth-website nao foi encontrado nesta workspace; configure ZAVORTH_WEBSITE_REPO_ROOT antes da Readiness checkpoint 4.',
      this.websiteRoot,
    );
  }

  private checkNextPhasePlanning(): PublicAdoptionReadinessCheck {
    const content = this.readCoreText('docs/product-direction.md') || '';
    const hasPhase = content.includes('Readiness checkpoint 4 - Hosted Website And Demo Operations');
    const hasGate = content.includes('qa:phase:54');
    const ok = hasPhase && hasGate;
    return this.check(
      'public-adoption:next-phase',
      'proximo passo planejada',
      ok ? 'pass' : 'fail',
      ok
        ? 'planejamento do ciclo aponta para a Readiness checkpoint 4 com gate proprio.'
        : 'docs/product-direction precisa manter Readiness checkpoint 4 e seu gate planejado.',
      'docs/product-direction.md',
      [`credential-vault4=${hasPhase}`, `gate54=${hasGate}`],
    );
  }

  private readPackage(): PackageLike | null {
    return this.readCoreJson('package.json');
  }

  private readCoreJson(relativePath: string): PackageLike | null {
    const raw = this.readCoreText(relativePath);
    if (!raw) {
      return null;
    }
    try {
      return JSON.parse(raw) as PackageLike;
    } catch (error: any) { logger.warn('[Public Adoption Readiness] JSON parse failed', error); return null; }
  }

  private readCoreText(relativePath: string): string | null {
    return this.readTextFromRoot(this.projectRoot, relativePath, 'core');
  }

  private readTextFromRoot(root: string, relativePath: string, scope: 'core' | 'website'): string | null {
    const normalized = normalizeRelativePath(relativePath);
    const scopedKey = `${scope}:${normalized}`;
    if (Object.prototype.hasOwnProperty.call(this.files, scopedKey)) {
      return this.files[scopedKey];
    }
    if (Object.prototype.hasOwnProperty.call(this.files, normalized)) {
      return this.files[normalized];
    }
    const targetPath = path.resolve(root, normalized);
    if (!this.existsSync(targetPath)) {
      return null;
    }
    try {
      return this.readFileSync(targetPath, 'utf8');
    } catch (error: any) { logger.warn('[Public Adoption Readiness] filesystem operation failed', error); return null; }
  }

  private pathExistsFromRoot(root: string, relativePath: string): boolean {
    const normalized = normalizeRelativePath(relativePath);
    if (
      Object.prototype.hasOwnProperty.call(this.files, `core:${normalized}`)
      || Object.prototype.hasOwnProperty.call(this.files, normalized)
    ) {
      return true;
    }
    return this.existsSync(path.resolve(root, normalized));
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
    status: PublicAdoptionReadinessCheckStatus,
    reason: string,
    filePath?: string,
    evidence: string[] = [],
  ): PublicAdoptionReadinessCheck {
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

function normalizeRelativePath(relativePath: string): string {
  return relativePath.replace(/\\/g, '/');
}

function scoreReadiness(passed: number, warnings: number, total: number): number {
  if (total === 0) {
    return 0;
  }
  return Math.round(((passed + warnings * 0.5) / total) * 100);
}

function isLaunchChecklistCheck(checkId: string): boolean {
  return (
    checkId === 'public-adoption:baseline'
    || checkId === 'public-adoption:light-gate'
    || checkId === 'public-adoption:runbook'
    || checkId === 'public-adoption:website-root'
    || checkId === 'public-adoption:next-phase'
    || checkId.startsWith('public-adoption:doc:')
    || checkId.startsWith('public-adoption:claim:')
  );
}
