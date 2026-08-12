import { detectPromptInjectionIndicators } from '../security/UntrustedContent.js';
import fs from 'node:fs';
import path from 'node:path';
import {
  ZAVORTH_MNEMOS_LINT_VERSION,
  type ZavorthMnemosLintFinding,
  type ZavorthMnemosLintKind,
  type ZavorthMnemosLintSeverity,
  type ZavorthMnemosLintSnapshot,
  type ZavorthMnemosLintStatus,
} from '../contracts/ZavorthMnemosLintContract.js';

type ZavorthMnemosLintRuntime = {
  now?: () => Date;
  projectRoot?: string;
  existsSync?: typeof fs.existsSync;
  readFileSync?: typeof fs.readFileSync;
};

type WikiIndex = {
  root?: string;
  schema?: string;
  pages?: Array<{ id: string; path: string; title?: string; tags?: string[] }>;
  edges?: Array<{ from: string; to: string; kind?: string }>;
};

type WikiPage = {
  id: string;
  path: string;
  body: string;
};

const REQUIRED_SECTIONS = [
  '## Purpose',
  '## Current Facts',
  '## Decisions',
  '## Open Questions',
  '## Source Links',
  '## Maintenance Notes',
] as const;

const SECRET_PATTERNS: Array<{ label: string; pattern: RegExp }> = [
  { label: 'api-key', pattern: /\b(?:api[_-]?key|token|password|secret)\s*[:=]\s*["']...[^"'\s]+/i },
  { label: 'prefixed-secret', pattern: /\b(?:sk-|hf_|AIza)[A-Za-z0-9_-]{8,}\b/i },
];

const CONTRADICTION_RULES: Array<{ id: string; a: RegExp; b: RegExp; summary: string }> = [
  {
    id: 'database-postgres-sqlite',
    a: /\b(?:using|uses|database|db)\s+(?:postgres|postgresql)\b/i,
    b: /\b(?:using|uses|database|db)\s+sqlite\b/i,
    summary: 'Wiki contains competing database claims.',
  },
  {
    id: 'approval-required-free',
    a: /\brequires...\s+approval\b|\bapproval\s+required\b/i,
    b: /\bno\s+approval\s+required\b|\bwithout\s+approval\b/i,
    summary: 'Wiki contains competing approval claims.',
  },
];

function stableId(input: string): string {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = ((hash << 5) - hash + input.charCodeAt(index)) | 0;
  }
  return Math.abs(hash).toString(36);
}

function redact(value: string): string {
  return SECRET_PATTERNS.reduce(
    (text, rule) => text.replace(rule.pattern, `[REDACTED_${rule.label.toUpperCase()}]`),
    String(value || ''),
  );
}

export class ZavorthMnemosLintService {
  private readonly now: () => Date;
  private readonly projectRoot: string;
  private readonly existsSyncImpl: typeof fs.existsSync;
  private readonly readFileSyncImpl: typeof fs.readFileSync;

  constructor(runtime: ZavorthMnemosLintRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.projectRoot = path.resolve(runtime.projectRoot || process.cwd());
    this.existsSyncImpl = runtime.existsSync || fs.existsSync.bind(fs);
    this.readFileSyncImpl = runtime.readFileSync || fs.readFileSync.bind(fs);
  }

  public lint(): ZavorthMnemosLintSnapshot {
    const generatedAt = this.now().toISOString();
    const findings: ZavorthMnemosLintFinding[] = [];
    const index = this.readIndex(findings);
    const pages = this.readPages(index, findings);

    this.validateIndex(index, findings);
    for (const page of pages) {
      this.validatePageSchema(page, findings);
      this.validateSourceLinks(page, findings);
      this.validateSecretExposure(page, findings);
      this.validatePromptInjection(page, findings);
      this.validateFreshness(page, findings);
    }
    this.validateContradictions(pages, findings);

    const summary = {
      pages: pages.length,
      findings: findings.length,
      info: findings.filter((finding) => finding.severity === 'info').length,
      warnings: findings.filter((finding) => finding.severity === 'warning').length,
      errors: findings.filter((finding) => finding.severity === 'error').length,
      critical: findings.filter((finding) => finding.severity === 'critical').length,
      contradictions: findings.filter((finding) => finding.kind === 'contradiction').length,
      brokenLinks: findings.filter((finding) => finding.kind === 'broken-link').length,
      schemaDrift: findings.filter((finding) => finding.kind === 'schema-drift').length,
      secretFindings: findings.filter((finding) => finding.kind === 'secret-like').length,
    };
    const status = this.statusFor(findings);

    return {
      version: ZAVORTH_MNEMOS_LINT_VERSION,
      generatedAt,
      status,
      summary,
      findings: findings.map((finding) => ({
        ...finding,
        summary: redact(finding.summary),
        recommendation: redact(finding.recommendation),
      })),
      safety: {
        providerCall: false,
        networkCall: false,
        durableMutation: false,
        wikiRootOnly: true,
        operatorDecisionForCritical: true,
        secretsRedacted: true,
      },
      receipt: {
        id: `mnemos-lint-${stableId(`${generatedAt}:${status}:${findings.length}`)}`,
        providerCall: false,
        durableMutation: false,
      },
    };
  }

  private readIndex(findings: ZavorthMnemosLintFinding[]): WikiIndex {
    const indexPath = this.resolveWorkspacePath('.zavorth/wiki/index.json');
    if (!this.existsSyncImpl(indexPath)) {
      this.addFinding(findings, 'critical', 'index', null, 'Mnemos wiki index is missing.', 'Run the wiki baseline initializer before query or ingest.');
      return {};
    }
    try {
      return JSON.parse(String(this.readFileSyncImpl(indexPath, 'utf8'))) as WikiIndex;
    } catch (error: unknown) {this.addFinding(findings, 'critical', 'index', '.zavorth/wiki/index.json', 'Mnemos wiki index is not valid JSON.', 'Fix index.json before trusting wiki retrieval.');
      return {};
    }
  }

  private readPages(index: WikiIndex, findings: ZavorthMnemosLintFinding[]): WikiPage[] {
    const pages = Array.isArray(index.pages) ? index.pages : [];
    const output: WikiPage[] = [];
    for (const page of pages) {
      const pagePath = String(page.path || '');
      if (!pagePath.startsWith('.zavorth/wiki/')) {
        this.addFinding(findings, 'critical', 'path-boundary', pagePath || null, `Wiki page escapes the wiki root: ${pagePath}`, 'Keep semantic memory pages under .zavorth/wiki only.');
        continue;
      }
      const absolute = this.resolveWorkspacePath(pagePath);
      if (!this.existsSyncImpl(absolute)) {
        this.addFinding(findings, 'error', 'broken-link', pagePath, `Indexed wiki page does not exist: ${pagePath}`, 'Create the page or remove it from the index.');
        continue;
      }
      output.push({
        id: String(page.id || path.basename(pagePath, '.md')),
        path: pagePath,
        body: String(this.readFileSyncImpl(absolute, 'utf8')),
      });
    }
    return output;
  }

  private validateIndex(index: WikiIndex, findings: ZavorthMnemosLintFinding[]): void {
    if (index.root !== '.zavorth/wiki') {
      this.addFinding(findings, 'error', 'index', '.zavorth/wiki/index.json', 'Wiki index root is not .zavorth/wiki.', 'Set root to .zavorth/wiki.');
    }
    if (index.schema !== '.zavorth/SCHEMA.md') {
      this.addFinding(findings, 'error', 'index', '.zavorth/wiki/index.json', 'Wiki index schema does not point to .zavorth/SCHEMA.md.', 'Set schema to .zavorth/SCHEMA.md.');
    }
    if (!this.existsSyncImpl(this.resolveWorkspacePath('.zavorth/SCHEMA.md'))) {
      this.addFinding(findings, 'error', 'broken-link', '.zavorth/SCHEMA.md', 'Mnemos wiki schema file is missing.', 'Restore .zavorth/SCHEMA.md before writing semantic memory.');
    }
    const pageIds = new Set((index.pages || []).map((page) => String(page.id || '')));
    for (const edge of index.edges || []) {
      if (!pageIds.has(String(edge.from || '')) || !pageIds.has(String(edge.to || ''))) {
        this.addFinding(findings, 'error', 'index', '.zavorth/wiki/index.json', `Wiki graph edge references unknown pages: ${edge.from} -> ${edge.to}`, 'Update edges so they only reference indexed pages.');
      }
    }
  }

  private validatePageSchema(page: WikiPage, findings: ZavorthMnemosLintFinding[]): void {
    if (!page.body.trimStart().startsWith('---')) {
      this.addFinding(findings, 'error', 'schema-drift', page.path, 'Wiki page is missing frontmatter.', 'Add the standard Mnemos page frontmatter.');
    }
    for (const section of REQUIRED_SECTIONS) {
      if (!page.body.includes(section)) {
        this.addFinding(findings, 'error', 'schema-drift', page.path, `Wiki page is missing required section: ${section}`, 'Restore the required section from the wiki schema.');
      }
    }
  }

  private validateSourceLinks(page: WikiPage, findings: ZavorthMnemosLintFinding[]): void {
    for (const linkPath of this.extractBacktickPathsFromSourceLinks(page.body)) {
      if (/^[a-z][a-z0-9+.-]*:\/\//i.test(linkPath)) {
        continue;
      }
      const normalized = linkPath.replace(/\\/g, '/').replace(/^\/+/, '');
      const absolute = this.resolveWorkspacePath(normalized);
      if (!this.existsSyncImpl(absolute)) {
        this.addFinding(findings, 'warning', 'broken-link', page.path, `Source link target is missing: ${linkPath}`, 'Fix the source link or move it to Open Questions if it is intentionally unavailable.');
      }
    }
  }

  private validateSecretExposure(page: WikiPage, findings: ZavorthMnemosLintFinding[]): void {
    for (const rule of SECRET_PATTERNS) {
      if (rule.pattern.test(page.body)) {
        this.addFinding(findings, 'critical', 'secret-like', page.path, `Secret-like value detected by ${rule.label} rule.`, 'Remove the raw value, rotate it if needed, and replace it with a SecretRef.');
      }
    }
  }

  private validatePromptInjection(page: WikiPage, findings: ZavorthMnemosLintFinding[]): void {
    const indicators = detectPromptInjectionIndicators(page.body);
    for (const indicator of indicators.slice(0, 5)) {
      this.addFinding(findings, 'warning', 'prompt-injection', page.path, `Prompt-injection-like text detected: ${indicator.rule}`, 'Keep this content quoted as evidence only or move it to raw sources with clear untrusted labeling.');
    }
  }

  private validateFreshness(page: WikiPage, findings: ZavorthMnemosLintFinding[]): void {
    const match = page.body.match(/\bupdated_at:\s*([0-9]{4}-[0-9]{2}-[0-9]{2})\b/i);
    if (!match) {
      this.addFinding(findings, 'warning', 'stale', page.path, 'Wiki page does not declare updated_at.', 'Add updated_at so stale semantic memory can be reviewed.');
      return;
    }
    const ageMs = this.now().getTime() - new Date(`${match[1]}T00:00:00.000Z`).getTime();
    const ageDays = Math.floor(ageMs / 86_400_000);
    if (ageDays > 120) {
      this.addFinding(findings, 'info', 'stale', page.path, `Wiki page is ${ageDays} days old.`, 'Review the page during the next memory maintenance pass.');
    }
  }

  private validateContradictions(pages: WikiPage[], findings: ZavorthMnemosLintFinding[]): void {
    const combined = pages.map((page) => `${page.path}\n${page.body}`).join('\n\n');
    for (const rule of CONTRADICTION_RULES) {
      if (rule.a.test(combined) && rule.b.test(combined)) {
        this.addFinding(findings, 'warning', 'contradiction', null, rule.summary, 'Resolve the competing facts or mark the older fact as superseded.');
      }
    }
  }

  private extractBacktickPathsFromSourceLinks(body: string): string[] {
    const section = body.split('## Source Links')[1]?.split(/\n##\s+/)[0] || '';
    return Array.from(section.matchAll(/`([^`]+)`/g))
      .map((match) => match[1].trim())
      .filter((entry) => entry.length > 0);
  }

  private addFinding(
    findings: ZavorthMnemosLintFinding[],
    severity: ZavorthMnemosLintSeverity,
    kind: ZavorthMnemosLintKind,
    pagePath: string | null,
    summary: string,
    recommendation: string,
  ): void {
    findings.push({
      id: `mnemos-lint-${stableId(`${severity}:${kind}:${pagePath || 'global'}:${summary}`)}`,
      severity,
      kind,
      pagePath,
      summary,
      recommendation,
      operatorDecisionRequired: severity === 'critical' || severity === 'error' || kind === 'contradiction',
    });
  }

  private statusFor(findings: ZavorthMnemosLintFinding[]): ZavorthMnemosLintStatus {
    if (findings.some((finding) => finding.severity === 'critical')) return 'blocked';
    if (findings.some((finding) => finding.severity === 'error' || finding.severity === 'warning')) return 'needs-review';
    return 'passed';
  }

  private resolveWorkspacePath(inputPath: string): string {
    const absolute = path.resolve(this.projectRoot, inputPath);
    const relative = path.relative(this.projectRoot, absolute);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new Error(`Mnemos lint path escapes workspace: ${inputPath}`);
    }
    return absolute;
  }
}
