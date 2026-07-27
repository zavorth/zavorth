import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';
import { logger } from '../logger.js';
import {
PRODUCT_QUALITY_COMMANDS,
  PRODUCT_QUALITY_DOCS,
  PRODUCT_QUALITY_OFFICIAL_JOURNEY,
  PRODUCT_QUALITY_RULES,
  type ProductQualityCheck,
  type ProductQualityCheckStatus,
  type ProductQualityContractSnapshot,
  type ProductQualityDocSpec,
} from '../contracts/ProductQualityContract.js';

type PackageLike = {
  bin?: Record<string, string>;
  scripts?: Record<string, string>;
};

export type ProductQualityContractServiceOptions = {
  projectRoot?: string;
  packageJson?: PackageLike;
  files?: Record<string, string>;
  existsSync?: (targetPath: string) => boolean;
  readFileSync?: (targetPath: string, encoding: BufferEncoding) => string;
  now?: () => Date;
};

const PRODUCT_ALIAS_EXPECTATIONS: Record<string, string[]> = {
  onboard: ['setup-v3.ts'],
  go: ['ops-go.ts'],
  chat: ['cli -- chat'],
  doctor: ['cli -- doctor'],
  status: ['cli -- status'],
  cockpit: ['cli -- cockpit'],
  capabilities: ['cli -- capabilities'],
  tasks: ['cli -- tasks'],
  artifacts: ['cli -- artifacts'],
  supervisor: ['cli -- supervisor'],
  'memory:review': ['cli -- memory review'],
  heal: ['cli -- heal --preview'],
  'release:status': ['cli -- release status'],
};

const REQUIRED_QA_ALIASES = [
  'test:cli',
  'qa:product-experience',
  'qa:flows',
  'qa:product-quality',
];

const VISUAL_CONTRACT_PATH = 'tests/cli/ZavorthCliVisualContract.test.ts';
const VISUAL_CONTRACT_REQUIRED_PHRASES = [
  'FORBIDDEN_FIRST_LAYER_PATTERNS',
  'npm run ops:',
  'sessionId',
  'chatId',
  'control plane',
];

export class ProductQualityContractService {
  private readonly projectRoot: string;
  private readonly packageJson: PackageLike | null;
  private readonly files: Record<string, string>;
  private readonly existsSync: (targetPath: string) => boolean;
  private readonly readFileSync: (targetPath: string, encoding: BufferEncoding) => string;
  private readonly now: () => Date;

  constructor(options: ProductQualityContractServiceOptions = {}) {
    this.projectRoot = options.projectRoot || config.projectRoot;
    this.packageJson = options.packageJson || null;
    this.files = options.files || {};
    this.existsSync = options.existsSync || fs.existsSync;
    this.readFileSync = options.readFileSync || fs.readFileSync;
    this.now = options.now || (() => new Date());
  }

  public buildSnapshot(): ProductQualityContractSnapshot {
    const checks = [
      this.checkZavorthBinary(),
      ...this.checkProductAliases(),
      ...this.checkQaAliases(),
      ...this.checkDocs(),
      this.checkVisualContract(),
      this.checkHumanJsonContractDoc(),
    ];
    const failed = checks.filter((check) => check.status === 'fail').length;
    const warnings = checks.filter((check) => check.status === 'warn').length;
    const passed = checks.filter((check) => check.status === 'pass').length;

    return {
      gate: 'product-quality',
      surface: 'product-quality-contract',
      generatedAt: this.now().toISOString(),
      status: failed > 0 ? 'blocked' : warnings > 0 ? 'attention' : 'ready',
      summary: {
        ok: failed === 0,
        passed,
        warnings,
        failed,
      },
      officialJourney: [...PRODUCT_QUALITY_OFFICIAL_JOURNEY],
      commandSpecs: PRODUCT_QUALITY_COMMANDS,
      rules: PRODUCT_QUALITY_RULES,
      checks,
      nextRecommendedGate: {
        gate: 'deterministic-qa',
        title: 'QA Deterministico',
        reason:
          'after de travar a qualidade de produto, o next passo da ordem escolhida e transformar os gates em uma matriz deterministica e menos sujeita a flakiness.',
      },
    };
  }

  public renderReport(snapshot: ProductQualityContractSnapshot = this.buildSnapshot()): string {
    const lines: string[] = [];
    lines.push('[product-quality] Product Quality Contract');
    lines.push(`status: ${snapshot.status}`);
    lines.push(`ok: ${snapshot.summary.ok ? 'yes' : 'no'} | pass=${snapshot.summary.passed} warn=${snapshot.summary.warnings} fail=${snapshot.summary.failed}`);
    lines.push(`jornada: ${snapshot.officialJourney.join(' -> ')}`);
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

  private checkZavorthBinary(): ProductQualityCheck {
    const pkg = this.readPackageJson();
    const bin = pkg?.bin || {};
    const target = String(bin.zavorth || '').trim();
    const ok = target === './dist/zavorth-cli.js';
    return this.check(
      'package:bin-zavorth',
      'canonical zavorth binary',
      ok ? 'pass' : 'fail',
      ok ? 'package.json exposes the zavorth binary pointing to dist/zavorth-cli.js.'
        : 'package.json must expose bin.zavorth as ./dist/zavorth-cli.js.',
      'package.json',
      [`bin.zavorth=${target || '<missing>'}`],
    );
  }

  private checkProductAliases(): ProductQualityCheck[] {
    const scripts = this.readPackageJson()?.scripts || {};
    return Object.entries(PRODUCT_ALIAS_EXPECTATIONS).map(([alias, expectedParts]) => {
      const command = String(scripts[alias] || '').trim();
      const missingPart = expectedParts.find((part) => !command.includes(part));
      return this.check(
        `package:alias:${alias}`,
        `alias local ${alias}`,
        command && !missingPart ? 'pass' : 'fail',
        command && !missingPart ? `alias local preserva a ponte de produto para "${alias}".`
          : `alias local "${alias}" must exist and point to ${expectedParts.join(' + ')}.`,
        'package.json',
        [`script=${command || '<missing>'}`],
      );
    });
  }

  private checkQaAliases(): ProductQualityCheck[] {
    const scripts = this.readPackageJson()?.scripts || {};
    return REQUIRED_QA_ALIASES.map((alias) => {
      const command = String(scripts[alias] || '').trim();
      return this.check(
        `package:qa:${alias}`,
        `gate ${alias}`,
        command ? 'pass' : 'fail',
        command ? `gate "${alias}" is exposto para validation local.`
          : `gate "${alias}" must exist in package.json.`,
        'package.json',
        [`script=${command || '<missing>'}`],
      );
    });
  }

  private checkDocs(): ProductQualityCheck[] {
    return PRODUCT_QUALITY_DOCS.map((doc) => this.checkDoc(doc));
  }

  private checkDoc(doc: ProductQualityDocSpec): ProductQualityCheck {
    const content = this.readText(doc.path);
    if (content === null) {
      return this.check(
        `doc:${doc.path}`,
        doc.label,
        'fail',
        `document ${doc.path} not found.`,
        doc.path,
      );
    }

    const missing = doc.requiredPhrases.filter((phrase) => !content.includes(phrase));
    const journeyIndex = content.indexOf('zavorth setup');
    const advancedIndex = doc.advancedPhrase ? content.indexOf(doc.advancedPhrase) : -1;
    const firstOpsIndex = content.indexOf('npm run ops:');
    const enforceAdvancedLane = Boolean(doc.advancedPhrase);
    const opsBeforeJourney =
      enforceAdvancedLane
      && firstOpsIndex >= 0
      && journeyIndex >= 0
      && firstOpsIndex < journeyIndex;
    const opsBeforeAdvanced =
      enforceAdvancedLane
      &&
      firstOpsIndex >= 0
      && advancedIndex >= 0
      && firstOpsIndex < advancedIndex;
    const status: ProductQualityCheckStatus =
      missing.length > 0 || opsBeforeJourney || opsBeforeAdvanced ? 'fail' : 'pass';

    const evidence = [
      ...missing.map((phrase) => `faltando: ${phrase}`),
    ];
    if (opsBeforeJourney) {
      evidence.push('npm run ops:* aparece before da jornada zavorth setup/go/chat.');
    }
    if (opsBeforeAdvanced) {
      evidence.push(`npm run ops:* aparece before da trilha avancada (${doc.advancedPhrase}).`);
    }

    return this.check(
      `doc:${doc.path}`,
      doc.label,
      status,
      status === 'pass'
        ? 'document preserves the official journey, human/JSON contract, and advanced trail in the right place.'
        : 'document broke part of the journey or exposed internals too early.',
      doc.path,
      evidence,
    );
  }

  private checkVisualContract(): ProductQualityCheck {
    const content = this.readText(VISUAL_CONTRACT_PATH);
    if (content === null) {
      return this.check(
        'test:visual-contract',
        'contrato visual anti-ruido',
        'fail',
        'CLI visual test was not found.',
        VISUAL_CONTRACT_PATH,
      );
    }

    const missing = VISUAL_CONTRACT_REQUIRED_PHRASES.filter((phrase) => !content.includes(phrase));
    return this.check(
      'test:visual-contract',
      'contrato visual anti-ruido',
      missing.length === 0 ? 'pass' : 'fail',
      missing.length === 0
        ? 'teste da CLI ainda blocks ruido de primeira camada.'
        : 'teste visual da CLI perdeu padroes importbefore ruido.',
      VISUAL_CONTRACT_PATH,
      missing.map((phrase) => `faltando: ${phrase}`),
    );
  }

  private checkHumanJsonContractDoc(): ProductQualityCheck {
    const cliDoc = this.readText('docs/zavorth-cli.md') || '';
    const hasHuman = cliDoc.includes('without `--json`, the CLI must be product-grade');
    const hasMachine = cliDoc.includes('With `--json`, the CLI must be predictable for automation');
    const hasCleanJsonRule = cliDoc.includes('Regra: humano bonito; JSON limpo.');
    const ok = hasHuman && hasMachine && hasCleanJsonRule;
    return this.check(
      'doc:human-json-contract',
      'contrato humano vs JSON',
      ok ? 'pass' : 'fail',
      ok ? 'docs/product-direction declara separaction entre UX humana e JSON parseavel.'
        : 'docs/product-direction must explicitly declare the separation between human and JSON.',
      'docs/zavorth-cli.md',
      [
        `human=${hasHuman}`,
        `machine=${hasMachine}`,
        `cleanJson=${hasCleanJsonRule}`,
      ],
    );
  }

  private readPackageJson(): PackageLike | null {
    if (this.packageJson) {
      return this.packageJson;
    }
    const raw = this.readText('package.json');
    if (!raw) {
      return null;
    }
    try {
      return JSON.parse(raw) as PackageLike;
    } catch (error: unknown) {logger.warn('[Product Quality Contract] JSON parse failed', error); return null; }
  }

  private readText(relativePath: string): string | null {
    const normalized = relativePath.replace(/\\/g, '/');
    if (Object.prototype.hasOwnProperty.call(this.files, normalized)) {
      return this.files[normalized];
    }
    const targetPath = path.resolve(this.projectRoot, normalized);
    if (!this.existsSync(targetPath)) {
      return null;
    }
    return this.readFileSync(targetPath, 'utf8');
  }

  private check(
    id: string,
    title: string,
    status: ProductQualityCheckStatus,
    reason: string,
    filePath?: string,
    evidence: string[] = [],
  ): ProductQualityCheck {
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
