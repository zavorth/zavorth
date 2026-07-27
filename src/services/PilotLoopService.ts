import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';
import { logger } from '../logger.js';
import {
PILOT_ZAVORTH_CONTROL_METRICS,
  PILOT_FEEDBACK_TEMPLATES,
  PILOT_LEDGER_ENTRIES,
  PILOT_LOOP_FORBIDDEN_CLAIMS,
  PILOT_LOOP_REQUIRED_CORE_SCRIPTS,
  PILOT_LOOP_REQUIRED_WEBSITE_FILES,
  PILOT_SUPPORT_POLICY,
  PILOT_TRIAGE_RULES,
  type PilotLoopCheck,
  type PilotLoopCheckStatus,
  type PilotLoopSnapshot,
} from '../contracts/PilotLoopContract.js';

type PackageLike = {
  scripts?: Record<string, string>;
};

type JsonRecord = Record<string, unknown>;

export type PilotLoopServiceOptions = {
  projectRoot?: string;
  websiteRoot?: string;
  artifactDir?: string;
  feedbackPreviewPath?: string;
  pilotLedgerPath?: string;
  zavorthControlPath?: string;
  requireArtifacts?: boolean;
  files?: Record<string, string>;
  existsSync?: (targetPath: string) => boolean;
  readFileSync?: (targetPath: string, encoding: BufferEncoding) => string;
  now?: () => Date;
};

export class PilotLoopService {
  private readonly projectRoot: string;
  private readonly websiteRoot: string;
  private readonly artifactDir: string;
  private readonly feedbackPreviewPath: string;
  private readonly pilotLedgerPath: string;
  private readonly zavorthControlPath: string;
  private readonly requireArtifacts: boolean;
  private readonly files: Record<string, string>;
  private readonly existsSync: (targetPath: string) => boolean;
  private readonly readFileSync: (targetPath: string, encoding: BufferEncoding) => string;
  private readonly now: () => Date;

  constructor(options: PilotLoopServiceOptions = {}) {
    this.projectRoot = options.projectRoot || config.projectRoot;
    this.websiteRoot = options.websiteRoot || resolveDefaultWebsiteRoot(this.projectRoot);
    this.artifactDir = options.artifactDir || path.join(this.projectRoot, '.qa', 'pilot-loop');
    this.feedbackPreviewPath = options.feedbackPreviewPath || path.join(this.artifactDir, 'feedback-preview-redacted.json');
    this.pilotLedgerPath = options.pilotLedgerPath || path.join(this.artifactDir, 'pilot-ledger.json');
    this.zavorthControlPath = options.zavorthControlPath || path.join(this.artifactDir, 'support-zavorthControl.json');
    this.requireArtifacts = Boolean(options.requireArtifacts);
    this.files = options.files || {};
    this.existsSync = options.existsSync || fs.existsSync;
    this.readFileSync = options.readFileSync || fs.readFileSync;
    this.now = options.now || (() => new Date());
  }

  public buildSnapshot(): PilotLoopSnapshot {
    const scripts = this.readCoreJson('package.json')?.scripts || {};
    const checks = [
      this.checkWebsiteRoot(),
      this.checkWebsiteFiles(),
      ...this.checkCoreScripts(scripts),
      this.checkFeedbackTelemetryFoundation(),
      this.checkTemplates(),
      this.checkTriageRules(),
      this.checkPilotLedgerContract(),
      this.checkSupportPolicy(),
      this.checkZavorthControlMetrics(),
      this.checkWebsiteAndDocsCoverage(),
      this.checkForbiddenClaims(),
      this.checkFeedbackPreviewArtifact(),
      this.checkPilotLedgerArtifact(),
      this.checkZavorthControlArtifact(),
      this.checkDocsRunbook(),
      this.checkNextPhasePlanning(),
    ];
    const failed = checks.filter((check) => check.status === 'fail').length;
    const warnings = checks.filter((check) => check.status === 'warn').length;
    const passed = checks.filter((check) => check.status === 'pass').length;

    return {
      gate: 'pilot-loop',
      surface: 'pilot-loop',
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
      artifacts: {
        feedbackPreviewPath: this.feedbackPreviewPath,
        pilotLedgerPath: this.pilotLedgerPath,
        zavorthControlPath: this.zavorthControlPath,
      },
      templates: PILOT_FEEDBACK_TEMPLATES,
      triageRules: PILOT_TRIAGE_RULES,
      pilotLedger: PILOT_LEDGER_ENTRIES,
      supportPolicy: PILOT_SUPPORT_POLICY,
      zavorthControlMetrics: PILOT_ZAVORTH_CONTROL_METRICS,
      checks,
      nextRecommendedGate: {
        gate: 'integration-showcase',
        title: 'Integration Showcase And Partner Surface',
        reason:
          'With feedback, support, and auditable pilots, the next step is to show real integrations with fixture and safe degradation.',
      },
    };
  }

  public renderReport(snapshot: PilotLoopSnapshot = this.buildSnapshot()): string {
    const lines: string[] = [];
    lines.push('[pilot-loop] Readiness gate - Feedback, Support And Pilot Loop');
    lines.push(`status: ${snapshot.status}`);
    lines.push(`ok: ${snapshot.summary.ok ? 'yes' : 'no'} | pass=${snapshot.summary.passed} warn=${snapshot.summary.warnings} fail=${snapshot.summary.failed}`);
    lines.push(`website: ${snapshot.websiteRoot}`);
    lines.push(`artifacts: ${snapshot.artifactDir}`);
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

  private checkWebsiteRoot(): PilotLoopCheck {
    const exists = this.existsSync(this.websiteRoot);
    return this.check(
      'pilot-loop:website-root',
      'base public zavorth-website',
      exists ? 'pass' : 'fail',
      exists ? 'zavorth-website repository found to validate public feedback.'
        : 'zavorth-website repository was not found. Configure ZAVORTH_WEBSITE_REPO_ROOT.',
      this.websiteRoot,
    );
  }

  private checkWebsiteFiles(): PilotLoopCheck {
    const missing = PILOT_LOOP_REQUIRED_WEBSITE_FILES
      .filter((filePath) => !this.existsSync(path.join(this.websiteRoot, filePath)));
    return this.check(
      'pilot-loop:website-files',
      'public feedback route and docs',
      missing.length === 0 ? 'pass' : 'fail',
      missing.length === 0
        ? '/feedback, data fixture e public docs existem.'
        : '/feedback, data fixture ou public docs are missings.',
      undefined,
      missing,
    );
  }

  private checkCoreScripts(scripts: Record<string, string>): PilotLoopCheck[] {
    return PILOT_LOOP_REQUIRED_CORE_SCRIPTS.map((scriptName) => {
      const command = String(scripts[scriptName] || '').trim();
      return this.check(
        `pilot-loop:script:${scriptName}`,
        `script canonical ${scriptName}`,
        command ? 'pass' : 'fail',
        command ? `main repo exposes "${scriptName}" para o pilot loop.`
          : `main repo must expose "${scriptName}" no package.json.`,
        'package.json',
        [`script=${command || '<missing>'}`],
      );
    });
  }

  private checkFeedbackTelemetryFoundation(): PilotLoopCheck {
    const evidence = [
      {
        path: 'src/contracts/FeedbackTelemetryContract.ts',
        phrase: 'Feedback opt-in',
      },
      {
        path: 'src/services/FeedbackTelemetryContractService.ts',
        phrase: 'FeedbackTelemetryContractService',
      },
      {
        path: 'scripts/feedback-loop.ts',
        phrase: 'feedback-preview-redacted.json',
      },
      {
        path: 'docs/product-direction.md',
        phrase: 'Readiness gate - Feedback, Telemetry Opt-In And Product Loop',
      },
    ];
    const missing = evidence
      .filter((item) => !(this.readCoreText(item.path) || '').includes(item.phrase))
      .map((item) => `${item.path}: ${item.phrase}`);
    return this.check(
      'pilot-loop:feedback-foundation',
      'feedback opt-in foundation for the readiness gate',
      missing.length === 0 ? 'pass' : 'fail',
      missing.length === 0
        ? 'feedback opt-in, redacted preview, revoke/delete, and local ledger already exist as a base.'
        : 'readiness gate depends on the feedback opt-in foundation for the readiness gate.',
      undefined,
      missing,
    );
  }

  private checkTemplates(): PilotLoopCheck {
    const requiredAreas = ['bug', 'docs', 'install', 'feature'];
    const areas = new Set(PILOT_FEEDBACK_TEMPLATES.map((template) => template.id));
    const issues: string[] = [];
    for (const area of requiredAreas) {
      if (!areas.has(area as never)) {
        issues.push(`template missing: ${area}`);
      }
    }
    for (const template of PILOT_FEEDBACK_TEMPLATES) {
      if (template.requiredFields.length < 4) {
        issues.push(`${template.id}: insufficient required fields`);
      }
      if (template.redactionRules.length < 3) {
        issues.push(`${template.id}: redaction insuficiente`);
      }
      if (!template.safePrompt.toLowerCase().includes('redig')) {
        issues.push(`${template.id}: prompt must ask for redacted data`);
      }
    }
    return this.check(
      'pilot-loop:templates',
      'templates de issue e feedback',
      issues.length === 0 ? 'pass' : 'fail',
      issues.length === 0
        ? 'templates separam bug, docs, install e feature request com redaction local.'
        : 'public templates de feedback/support are incompletos.',
      'src/contracts/PilotLoopContract.ts',
      issues,
    );
  }

  private checkTriageRules(): PilotLoopCheck {
    const issues: string[] = [];
    const areas = new Set(PILOT_TRIAGE_RULES.map((rule) => rule.area));
    for (const area of ['bug', 'docs', 'install', 'release', 'feature']) {
      if (!areas.has(area as never)) {
        issues.push(`area without triagem: ${area}`);
      }
    }
    if (!PILOT_TRIAGE_RULES.some((rule) => rule.severity === 'high')) {
      issues.push('without regra high');
    }
    for (const rule of PILOT_TRIAGE_RULES) {
      if (!rule.responseTarget.trim()) {
        issues.push(`${rule.id}: without responseTarget`);
      }
      if (!rule.nextAction.trim()) {
        issues.push(`${rule.id}: without nextAction`);
      }
    }
    return this.check(
      'pilot-loop:triage',
      'triagem por severidade e area',
      issues.length === 0 ? 'pass' : 'fail',
      issues.length === 0
        ? 'triage covers areas and severities with owner, response, and next action.'
        : 'matriz de triagem de feedback is incompleta.',
      'src/contracts/PilotLoopContract.ts',
      issues,
    );
  }

  private checkPilotLedgerContract(): PilotLoopCheck {
    const issues: string[] = [];
    if (PILOT_LEDGER_ENTRIES.length < 3) {
      issues.push(`pilotos insuficientes: ${PILOT_LEDGER_ENTRIES.length}/3`);
    }
    for (const entry of PILOT_LEDGER_ENTRIES) {
      if (!entry.scope.trim()) {
        issues.push(`${entry.id}: without escopo`);
      }
      if (!entry.result.trim()) {
        issues.push(`${entry.id}: without result`);
      }
      if (!entry.followUp.trim()) {
        issues.push(`${entry.id}: without follow-up`);
      }
      if (!['no-workspace-payload', 'redacted-only'].includes(entry.dataPolicy)) {
        issues.push(`${entry.id}: dataPolicy invalid`);
      }
    }
    return this.check(
      'pilot-loop:ledger-contract',
      'ledger local de pilotos',
      issues.length === 0 ? 'pass' : 'fail',
      issues.length === 0
        ? 'pilots have scope, status, result, follow-up, and data policy.'
        : 'ledger local de pilotos is incompleto.',
      'src/contracts/PilotLoopContract.ts',
      issues,
    );
  }

  private checkSupportPolicy(): PilotLoopCheck {
    const issues: string[] = [];
    if (PILOT_SUPPORT_POLICY.length < 3) {
      issues.push(`policys insuficientes: ${PILOT_SUPPORT_POLICY.length}/3`);
    }
    for (const policy of PILOT_SUPPORT_POLICY) {
      if (policy.boundaries.length < 3) {
        issues.push(`${policy.id}: boundaries insuficientes`);
      }
      if (!policy.escalation.toLowerCase().includes('preview') && !policy.escalation.toLowerCase().includes('fixture')) {
        issues.push(`${policy.id}: escalation must preserve preview/fixture`);
      }
    }
    return this.check(
      'pilot-loop:support-policy',
      'response and support policy',
      issues.length === 0 ? 'pass' : 'fail',
      issues.length === 0
        ? 'suporte define channels, windows, boundaries e escalaction without capturar dado sensitive.'
        : 'support policy must include boundaries and safe escalation.',
      'src/contracts/PilotLoopContract.ts',
      issues,
    );
  }

  private checkZavorthControlMetrics(): PilotLoopCheck {
    const issues = PILOT_ZAVORTH_CONTROL_METRICS.flatMap((metric) => {
      const local: string[] = [];
      if (!metric.aggregateOnly) {
        local.push(`${metric.id}: must be aggregated`);
      }
      if (!metric.excludesPayload) {
        local.push(`${metric.id}: must exclude payload`);
      }
      return local;
    });
    return this.check(
      'pilot-loop:zavorthControl-metrics',
      'zavorthControl agregado without payload',
      issues.length === 0 ? 'pass' : 'fail',
      issues.length === 0
        ? 'zavorthControl uses only aggregate metrics and excludes sensitive payload.'
        : 'public zavorthControl cannot depend on raw payload.',
      'src/contracts/PilotLoopContract.ts',
      issues,
    );
  }

  private checkWebsiteAndDocsCoverage(): PilotLoopCheck {
    const source = [
      this.readWebsiteText('app/feedback/page.tsx') || '',
      this.readWebsiteText('data/feedback-loop.ts') || '',
      this.readWebsiteText('app/docs/page.tsx') || '',
      this.readCoreText('docs/product-direction.md') || '',
    ].join('\n').toLowerCase();
    const required = [
      'issue/report template',
      'product feedback ledger',
      'agregador without payload sensitive',
      'feedback:preview',
      'feedback:revoke',
      'feedback:delete',
      'triagem',
      'pilotos',
      'suporte',
    ];
    const missing = required.filter((term) => !source.includes(term));
    return this.check(
      'pilot-loop:public-coverage',
      'feedback, suporte e pilotos nas docs',
      missing.length === 0 ? 'pass' : 'fail',
      missing.length === 0
        ? 'site/docs conectam templates, ledger, agregaction, triagem, pilotos e suporte.'
        : 'public docs must link support templates, triage, and pilots.',
      'docs/product-direction.md',
      missing.map((term) => `faltando: ${term}`),
    );
  }

  private checkForbiddenClaims(): PilotLoopCheck {
    const source = [
      this.readWebsiteText('app/feedback/page.tsx') || '',
      this.readWebsiteText('data/feedback-loop.ts') || '',
      this.readCoreText('docs/product-direction.md') || '',
    ].join('\n');
    const forbiddenMatches = PILOT_LOOP_FORBIDDEN_CLAIMS.filter((claim) => source.toLowerCase().includes(String(claim).toLowerCase()));
    const tokenMatches = source.match(/(^|[^A-Za-z])sk-[A-Za-z0-9_-]{12,}/g) || [];
    const pathMatches = source.match(/[A-Z]:\\[^'")\s]+/g) || [];
    const evidence = [...forbiddenMatches, ...tokenMatches, ...pathMatches];
    return this.check(
      'pilot-loop:forbidden-claims',
      'prohibited claims and leaks',
      evidence.length === 0 ? 'pass' : 'fail',
      evidence.length === 0
        ? 'pilot loop does not expose personal paths, tokens, or forbidden claims.'
        : 'pilot loop contains path pessoal, token ou claim proibido.',
      undefined,
      evidence,
    );
  }

  private checkFeedbackPreviewArtifact(): PilotLoopCheck {
    const artifact = this.readArtifactJson(this.feedbackPreviewPath, 'feedback-preview-redacted.json');
    if (!artifact) {
      return this.missingArtifactCheck(
        'pilot-loop:feedback-preview',
        'redacted feedback preview',
        'feedback-preview-redacted.json',
      );
    }
    const redactions = Array.isArray(artifact.redactions) ? artifact.redactions as string[] : [];
    const issues: string[] = [];
    if (artifact.ok !== true) {
      issues.push('ok must be true');
    }
    if (artifact.sendsData !== false) {
      issues.push('sendsData must be false');
    }
    if (artifact.telemetry !== 'disabled-by-default') {
      issues.push('telemetry must be disabled-by-default');
    }
    for (const term of ['tokens', 'secrets', 'paths pessoais', 'payload bruto']) {
      if (!redactions.includes(term)) {
        issues.push(`redaction missing: ${term}`);
      }
    }
    return this.check(
      'pilot-loop:feedback-preview',
      'redacted feedback preview',
      issues.length === 0 ? 'pass' : 'fail',
      issues.length === 0
        ? 'preview de feedback redige dados sensitive e not envia nada.'
        : 'feedback preview must redact and remain unsent.',
      this.feedbackPreviewPath,
      issues,
    );
  }

  private checkPilotLedgerArtifact(): PilotLoopCheck {
    const artifact = this.readArtifactJson(this.pilotLedgerPath, 'pilot-ledger.json');
    if (!artifact) {
      return this.missingArtifactCheck(
        'pilot-loop:pilot-ledger',
        'ledger local de pilotos',
        'pilot-ledger.json',
      );
    }
    const entries = Array.isArray(artifact.entries) ? artifact.entries as JsonRecord[] : [];
    const issues: string[] = [];
    if (artifact.ok !== true) {
      issues.push('ok must be true');
    }
    if (entries.length < 3) {
      issues.push(`entries insuficientes: ${entries.length}/3`);
    }
    for (const entry of entries) {
      if (!entry.scope || !entry.result || !entry.followUp) {
        issues.push(`entry incompleta: ${String(entry.id || '<without id>')}`);
      }
      if (!['no-workspace-payload', 'redacted-only'].includes(String(entry.dataPolicy || ''))) {
        issues.push(`entry com dataPolicy invalid: ${String(entry.id || '<without id>')}`);
      }
    }
    return this.check(
      'pilot-loop:pilot-ledger',
      'ledger local de pilotos',
      issues.length === 0 ? 'pass' : 'fail',
      issues.length === 0
        ? 'pilot ledger records scope, result, and follow-up without workspace payload.'
        : 'pilot ledger must record auditable pilots without sensitive payload.',
      this.pilotLedgerPath,
      issues,
    );
  }

  private checkZavorthControlArtifact(): PilotLoopCheck {
    const artifact = this.readArtifactJson(this.zavorthControlPath, 'support-zavorthControl.json');
    if (!artifact) {
      return this.missingArtifactCheck(
        'pilot-loop:zavorthControl',
        'zavorthControl agregado de suporte',
        'support-zavorthControl.json',
      );
    }
    const metrics = Array.isArray(artifact.metrics) ? artifact.metrics as JsonRecord[] : [];
    const issues: string[] = [];
    if (artifact.ok !== true) {
      issues.push('ok must be true');
    }
    if (artifact.containsPayload !== false) {
      issues.push('containsPayload must be false');
    }
    if (metrics.length < PILOT_ZAVORTH_CONTROL_METRICS.length) {
      issues.push(`insufficient metrics: ${metrics.length}/${PILOT_ZAVORTH_CONTROL_METRICS.length}`);
    }
    for (const metric of metrics) {
      if (metric.aggregateOnly !== true || metric.excludesPayload !== true) {
        issues.push(`metrica insegura: ${String(metric.id || '<without id>')}`);
      }
    }
    return this.check(
      'pilot-loop:zavorthControl',
      'zavorthControl agregado de suporte',
      issues.length === 0 ? 'pass' : 'fail',
      issues.length === 0
        ? 'zavorthControl agrega sinais without payload sensitive.'
        : 'zavorthControl must be aggregated e without payload.',
      this.zavorthControlPath,
      issues,
    );
  }

  private checkDocsRunbook(): PilotLoopCheck {
    const source = [
      this.readCoreText('docs/product-direction.md') || '',
      this.readCoreText('docs/product-direction.md') || '',
    ].join('\n').toLowerCase();
    const required = [
      'feedback',
      'support',
      'pilot loop',
      'triagem',
      'ledger local',
      'payload sensitive',
      'qa:pilot-loop',
    ];
    const missing = required.filter((term) => !source.includes(term));
    return this.check(
      'pilot-loop:docs-runbook',
      'readiness gate documentation and runbook',
      missing.length === 0 ? 'pass' : 'fail',
      missing.length === 0
        ? 'docs explain feedback, support, pilots, intake, ledger, and readiness gates.'
        : 'docs must explain how to operate the pilot loop.',
      'docs/product-direction.md',
      missing.map((term) => `faltando: ${term}`),
    );
  }

  private checkNextPhasePlanning(): PilotLoopCheck {
    const source = [
      this.readCoreText('docs/product-direction.md') || '',
      this.readCoreText('docs/product-direction.md') || '',
    ].join('\n');
    const missing = ['Readiness gate - Integration Showcase And Partner Surface', 'qa:integration-showcase']
      .filter((term) => !source.includes(term));
    return this.check(
      'pilot-loop:next-phase',
      'recommendation for readiness gate',
      missing.length === 0 ? 'pass' : 'fail',
      missing.length === 0
        ? 'readiness gate aponta explicitmente para integration showcase e partner surface.'
        : 'the readiness gate must leave the next readiness gate as the next action.',
      'docs/product-direction.md',
      missing,
    );
  }

  private missingArtifactCheck(id: string, title: string, fileName: string): PilotLoopCheck {
    return this.check(
      id,
      title,
      this.requireArtifacts ? 'fail' : 'warn',
      this.requireArtifacts ? `${fileName} must exist for the gate qa:pilot-loop.`
        : `${fileName} ainda was not exigido neste snapshot; qa:pilot-loop gera e valida o artifact.`,
      path.join(this.artifactDir, fileName),
    );
  }

  private readCoreJson(relativePath: string): PackageLike | null {
    const raw = this.readCoreText(relativePath);
    if (!raw) {
      return null;
    }
    try {
      return JSON.parse(raw) as PackageLike;
    } catch (error: unknown) {logger.warn('[Pilot Loop] JSON parse failed', error); return null; }
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
    } catch (error: unknown) {logger.warn('[Pilot Loop] filesystem operation failed', error); return null; }
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
    } catch (error: unknown) {logger.warn('[Pilot Loop] filesystem operation failed', error); return null; }
  }

  private parseJson(raw: string): JsonRecord | null {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as JsonRecord : null;
    } catch (error: unknown) {logger.warn('[Pilot Loop] JSON parse failed', error); return null; }
  }

  private check(
    id: string,
    title: string,
    status: PilotLoopCheckStatus,
    reason: string,
    filePath?: string,
    evidence: string[] = [],
  ): PilotLoopCheck {
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
