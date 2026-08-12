import fs from 'node:fs';
import path from 'node:path';
import { logger } from '../logger.js';
import {
ZAVORTH_MNEMOS_PROCEDURAL_MEMORY_VERSION,
  type ZavorthMnemosProceduralMemorySnapshot,
  type ZavorthMnemosProceduralRisk,
  type ZavorthMnemosProceduralRule,
  type ZavorthMnemosProceduralRuleKind,
} from '../contracts/ZavorthMnemosProceduralMemoryContract.js';

type ProceduralMemoryRuntime = {
  now?: () => Date;
  projectRoot?: string;
  existsSync?: typeof fs.existsSync;
  readFileSync?: typeof fs.readFileSync;
  writeFileSync?: typeof fs.writeFileSync;
  mkdirSync?: typeof fs.mkdirSync;
  renameSync?: typeof fs.renameSync;
};

type PreviewInput = {
  text: string;
  scope?: string[];
  expiresAt?: string | null;
};

type ApplyInput = PreviewInput & {
  approvalId?: string | null;
};

import { redactSecrets as sanitizeSecretText } from './security/SecretSanitizer.js';

function stableId(input: string): string {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = ((hash << 5) - hash + input.charCodeAt(index)) | 0;
  }
  return Math.abs(hash).toString(36);
}

function redact(value: string): string {
  return sanitizeSecretText(value);
}

function compact(value: string, maxChars = 900): string {
  return redact(value).replace(/\s+/g, ' ').trim().slice(0, maxChars);
}

export class ZavorthMnemosProceduralMemoryService {
  private readonly now: () => Date;
  private readonly projectRoot: string;
  private readonly existsSyncImpl: typeof fs.existsSync;
  private readonly readFileSyncImpl: typeof fs.readFileSync;
  private readonly writeFileSyncImpl: typeof fs.writeFileSync;
  private readonly mkdirSyncImpl: typeof fs.mkdirSync;
  private readonly renameSyncImpl: typeof fs.renameSync;

  constructor(runtime: ProceduralMemoryRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.projectRoot = path.resolve(runtime.projectRoot || process.cwd());
    this.existsSyncImpl = runtime.existsSync || fs.existsSync.bind(fs);
    this.readFileSyncImpl = runtime.readFileSync || fs.readFileSync.bind(fs);
    this.writeFileSyncImpl = runtime.writeFileSync || fs.writeFileSync.bind(fs);
    this.mkdirSyncImpl = runtime.mkdirSync || fs.mkdirSync.bind(fs);
    this.renameSyncImpl = runtime.renameSync || fs.renameSync.bind(fs);
  }

  public preview(input: PreviewInput): ZavorthMnemosProceduralMemorySnapshot {
    const generatedAt = this.now().toISOString();
    const existing = this.readRules();
    const rule = this.buildRule(input, generatedAt, 'draft', null);
    const blocked = this.hasRawSecret(input.text);
    return this.snapshot({
      action: 'preview',
      status: blocked ? 'blocked' : 'requires-approval',
      generatedAt,
      rule: blocked ? { ...rule, statement: 'Blocked secret-like procedural memory proposal.' } : rule,
      rules: existing,
      durableMutation: false,
      approvalId: null,
    });
  }

  public apply(input: ApplyInput): ZavorthMnemosProceduralMemorySnapshot {
    const generatedAt = this.now().toISOString();
    const existing = this.readRules();
    if (this.hasRawSecret(input.text)) {
      return this.snapshot({
        action: 'apply',
        status: 'blocked',
        generatedAt,
        rule: this.buildRule(input, generatedAt, 'draft', input.approvalId || null),
        rules: existing,
        durableMutation: false,
        approvalId: input.approvalId || null,
      });
    }
    if (!input.approvalId || !String(input.approvalId).trim()) {
      return this.snapshot({
        action: 'apply',
        status: 'requires-approval',
        generatedAt,
        rule: this.buildRule(input, generatedAt, 'draft', null),
        rules: existing,
        durableMutation: false,
        approvalId: null,
      });
    }
    const nextRule = this.buildRule(input, generatedAt, 'active', input.approvalId);
    const nextRules = this.upsertRule(existing, nextRule);
    this.writeRules(nextRules);
    return this.snapshot({
      action: 'apply',
      status: 'ready',
      generatedAt,
      rule: nextRule,
      rules: nextRules,
      durableMutation: true,
      approvalId: input.approvalId,
    });
  }

  public list(): ZavorthMnemosProceduralMemorySnapshot {
    const generatedAt = this.now().toISOString();
    const rules = this.readRules();
    return this.snapshot({
      action: 'list',
      status: 'ready',
      generatedAt,
      rule: null,
      rules,
      durableMutation: false,
      approvalId: null,
    });
  }

  public query(input: { query: string; limit?: number }): ZavorthMnemosProceduralMemorySnapshot {
    const generatedAt = this.now().toISOString();
    const terms = this.terms(input.query);
    const limit = Math.max(1, Math.min(Number(input.limit || 8), 20));
    const rules = this.readRules()
      .filter((rule) => rule.status === 'active')
      .map((rule) => ({
        rule,
        score: terms.reduce((sum, term) => sum + (`${rule.kind} ${rule.statement} ${rule.scope.join(' ')}`.toLowerCase().includes(term) ? 1 : 0), 0),
      }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score || a.rule.id.localeCompare(b.rule.id))
      .slice(0, limit)
      .map((entry) => entry.rule);
    return this.snapshot({
      action: 'query',
      status: 'ready',
      generatedAt,
      rule: null,
      rules,
      durableMutation: false,
      approvalId: null,
    });
  }

  public revoke(input: { id: string; approvalId?: string | null; reason?: string | null }): ZavorthMnemosProceduralMemorySnapshot {
    const generatedAt = this.now().toISOString();
    const rules = this.readRules();
    const index = rules.findIndex((rule) => rule.id === input.id);
    if (index < 0) {
      return this.snapshot({
        action: 'revoke',
        status: 'not-found',
        generatedAt,
        rule: null,
        rules,
        durableMutation: false,
        approvalId: input.approvalId || null,
      });
    }
    if (!input.approvalId || !String(input.approvalId).trim()) {
      return this.snapshot({
        action: 'revoke',
        status: 'requires-approval',
        generatedAt,
        rule: rules[index],
        rules,
        durableMutation: false,
        approvalId: null,
      });
    }
    const revoked: ZavorthMnemosProceduralRule = {
      ...rules[index],
      status: 'revoked',
      updatedAt: generatedAt,
      revokedAt: generatedAt,
      revocationReason: compact(input.reason || 'Operator revoked procedural rule.', 240),
    };
    const nextRules = [...rules];
    nextRules[index] = revoked;
    this.writeRules(nextRules);
    return this.snapshot({
      action: 'revoke',
      status: 'ready',
      generatedAt,
      rule: revoked,
      rules: nextRules,
      durableMutation: true,
      approvalId: input.approvalId,
    });
  }

  private buildRule(
    input: PreviewInput,
    generatedAt: string,
    status: ZavorthMnemosProceduralRule['status'],
    approvalId: string | null,
  ): ZavorthMnemosProceduralRule {
    const sourceText = compact(input.text);
    const kind = this.classifyKind(sourceText);
    const risk = this.estimateRisk(sourceText);
    const scope = this.normalizeScope(input.scope?.length ? input.scope : this.inferScope(sourceText, kind));
    const statement = this.toStatement(sourceText, kind);
    return {
      id: `mnemos-procedure-${stableId(`${kind}:${scope.join('|')}:${statement}`)}`,
      kind,
      status,
      statement,
      scope,
      sourceText,
      confidence: this.estimateConfidence(sourceText, kind),
      risk,
      createdAt: generatedAt,
      updatedAt: generatedAt,
      expiresAt: input.expiresAt ? new Date(input.expiresAt).toISOString() : null,
      approvalId,
      revokedAt: null,
      revocationReason: null,
      secretFree: !this.hasRawSecret(input.text),
    };
  }

  private classifyKind(text: string): ZavorthMnemosProceduralRuleKind {
    void text;
    return 'general-procedure';
  }

  private estimateRisk(text: string): ZavorthMnemosProceduralRisk {
    void text;
    return 'low';
  }

  private estimateConfidence(text: string, kind: ZavorthMnemosProceduralRuleKind): number {
    let confidence = kind === 'general-procedure' ? 0.62 : 0.78;
    if (text.length < 12) confidence -= 0.18;
    return Math.max(0.2, Math.min(0.95, Number(confidence.toFixed(2))));
  }

  private inferScope(text: string, kind: ZavorthMnemosProceduralRuleKind): string[] {
    void text;
    return [kind];
  }

  private normalizeScope(scope: string[]): string[] {
    return Array.from(new Set(scope
      .map((entry) => compact(entry, 48).toLowerCase().replace(/[^a-z0-9_.-]+/g, '-'))
      .filter(Boolean))).slice(0, 12);
  }

  private toStatement(text: string, kind: ZavorthMnemosProceduralRuleKind): string {
    const cleaned = compact(text, 420);
    if (!cleaned) return `Apply ${kind} only after explicit operator review.`;
    return cleaned;
  }

  private upsertRule(existing: ZavorthMnemosProceduralRule[], nextRule: ZavorthMnemosProceduralRule): ZavorthMnemosProceduralRule[] {
    const index = existing.findIndex((rule) => rule.id === nextRule.id);
    if (index < 0) return [...existing, nextRule].sort((a, b) => a.id.localeCompare(b.id));
    const previous = existing[index];
    const updated = {
      ...nextRule,
      createdAt: previous.createdAt,
      revokedAt: null,
      revocationReason: null,
    };
    const next = [...existing];
    next[index] = updated;
    return next.sort((a, b) => a.id.localeCompare(b.id));
  }

  private readRules(): ZavorthMnemosProceduralRule[] {
    const file = this.rulesPath();
    if (!this.existsSyncImpl(file)) return [];
    try {
      const parsed = JSON.parse(String(this.readFileSyncImpl(file, 'utf8'))) as { rules?: ZavorthMnemosProceduralRule[] };
      return Array.isArray(parsed.rules) ? parsed.rules.map((rule) => ({
        ...rule,
        statement: compact(rule.statement),
        sourceText: compact(rule.sourceText),
        secretFree: true,
      })) : [];
    } catch (error: unknown) {logger.warn('[Zavorth Mnemos Procedural Memory] JSON parse failed', error); return []; }
  }

  private writeRules(rules: ZavorthMnemosProceduralRule[]): void {
    const file = this.rulesPath();
    this.mkdirSyncImpl(path.dirname(file), { recursive: true });
    const tmpPath = `${file}.${process.pid}.${Date.now()}.tmp`;
    const payload = {
      version: ZAVORTH_MNEMOS_PROCEDURAL_MEMORY_VERSION,
      updatedAt: this.now().toISOString(),
      rules,
    };
    this.writeFileSyncImpl(tmpPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
    this.renameSyncImpl(tmpPath, file);
  }

  private snapshot(input: {
    action: ZavorthMnemosProceduralMemorySnapshot['action'];
    status: ZavorthMnemosProceduralMemorySnapshot['status'];
    generatedAt: string;
    rule: ZavorthMnemosProceduralRule | null;
    rules: ZavorthMnemosProceduralRule[];
    durableMutation: boolean;
    approvalId: string | null;
  }): ZavorthMnemosProceduralMemorySnapshot {
    const rules = input.rules.map((rule) => ({
      ...rule,
      statement: compact(rule.statement),
      sourceText: compact(rule.sourceText),
      secretFree: true,
    }));
    return {
      version: ZAVORTH_MNEMOS_PROCEDURAL_MEMORY_VERSION,
      generatedAt: input.generatedAt,
      action: input.action,
      status: input.status,
      rule: input.rule,
      rules,
      summary: {
        total: rules.length,
        active: rules.filter((rule) => rule.status === 'active').length,
        draft: rules.filter((rule) => rule.status === 'draft').length,
        revoked: rules.filter((rule) => rule.status === 'revoked').length,
        returned: rules.length,
      },
      safety: {
        providerCall: false,
        networkCall: false,
        durableMutation: input.durableMutation,
        approvalRequiredForWrite: true,
        secretsRedacted: true,
        noRawSecrets: true,
        explicitRevocation: true,
      },
      receipt: {
        id: `mnemos-procedural-${stableId(`${input.generatedAt}:${input.action}:${input.status}:${input.rule?.id || rules.length}`)}`,
        providerCall: false,
        durableMutation: input.durableMutation,
        approvalId: input.approvalId,
      },
    };
  }

  private terms(query: string): string[] {
    return Array.from(new Set(compact(query)
      .toLowerCase()
      .split(/[^a-z0-9_.-]+/i)
      .map((term) => term.trim())
      .filter((term) => term.length >= 3))).slice(0, 20);
  }

  private hasRawSecret(value: string): boolean {
    return sanitizeSecretText(value) !== String(value || '');
  }

  private rulesPath(): string {
    return this.resolveWorkspacePath('data/runtime/mnemos-procedural-memory.json');
  }

  private resolveWorkspacePath(inputPath: string): string {
    const absolute = path.resolve(this.projectRoot, inputPath);
    const relative = path.relative(this.projectRoot, absolute);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new Error(`Mnemos procedural memory path escapes workspace: ${inputPath}`);
    }
    return absolute;
  }
}
