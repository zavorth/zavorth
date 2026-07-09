import crypto from 'crypto';
import DatabaseLib, { type Database as SQLiteDatabase } from 'better-sqlite3';
import { Database } from '../storage/Database.js';
import { buildUntrustedContextBlock, sanitizeTrustPlaneText } from '../runtime/agent/security/index.js';
import { logger } from '../logger.js';
import type {
ZavorthLearningMemoryDecision,
  ZavorthLearningMemoryEntry,
  ZavorthLearningMemoryLayer,
  ZavorthLearningMemoryReceipt,
  ZavorthLearningMemoryRisk,
  ZavorthLearningMemorySearchResult,
  ZavorthSkillMemoryCandidateAssessment,
} from '../contracts/ZavorthMemoryLearningLoopContract.js';

type MemoryLearningRuntime = {
  now?: () => Date;
  db?: SQLiteDatabase;
};

type RememberInput = {
  layer: ZavorthLearningMemoryLayer;
  key: string;
  content: string;
  userId?: string | null;
  sessionId?: string | null;
  workspace?: string | null;
  source?: string | null;
  confidence?: number;
  risk?: ZavorthLearningMemoryRisk;
  ttlMs?: number | null;
  metadata?: Record<string, unknown>;
};

type SearchInput = {
  query: string;
  userId?: string | null;
  sessionId?: string | null;
  workspace?: string | null;
  layers?: ZavorthLearningMemoryLayer[];
  limit?: number;
};

type SkillCandidateInput = {
  intent: string;
  demonstration?: string | null;
  requestedBy?: string | null;
  sourceSurface?: string | null;
  persistCandidate?: boolean;
};

const DEFAULT_SESSION_TTL_MS = 2 * 60 * 60 * 1000;
const MIN_SESSION_TTL_MS = 60 * 1000;
const MAX_SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_CONTENT_CHARS = 1800;
const MAX_PROMPT_CONTEXT_ENTRIES = 8;
const MAX_PROMPT_CONTEXT_CHARS = 500;

export class ZavorthMemoryLearningLoopService {
  private readonly now: () => Date;
  private db: SQLiteDatabase | null;
  private initialized = false;

  constructor(runtime: MemoryLearningRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.db = runtime.db || null;
  }

  public static createInMemoryForTests(now?: () => Date): ZavorthMemoryLearningLoopService {
    return new ZavorthMemoryLearningLoopService({
      now,
      db: new DatabaseLib(':memory:'),
    });
  }

  public async remember(input: RememberInput): Promise<ZavorthLearningMemoryReceipt> {
    await this.init();
    const db = this.requireDb();
    const layer = this.normalizeLayer(input.layer);
    const risk = this.normalizeRisk(input.risk || this.estimateRisk(`${input.key}\n${input.content}`));
    const reasons = this.evaluateMemoryWrite(input, risk);
    const decision = this.resolveMemoryDecision(layer, risk, reasons);
    const generatedAt = this.now().toISOString();

    if (decision === 'rejected' || decision === 'requires_review') {
      return this.receipt({
        layer,
        decision,
        risk,
        summary: decision === 'rejected'
          ? 'Memory write rejected before persistence.'
          : 'Memory write requires review before persistence.',
        reasons,
        entryId: null,
        ftsIndexed: false,
        generatedAt,
      });
    }

    const entryId = this.entryId(layer, input.userId || null, input.sessionId || null, input.key);
    const expiresAt = layer === 'session'
      ? new Date(this.now().getTime() + this.normalizeSessionTtl(input.ttlMs)).toISOString()
      : null;
    const content = this.redact(input.content);
    const key = this.normalizeKey(input.key);
    const metadata = {
      ...this.sanitizeMetadata(input.metadata || {}),
      rawTranscriptPersisted: false,
      promotedFromSession: false,
    };

    db.prepare(`
      INSERT INTO zavorth_learning_memory (
        id, layer, user_id, session_id, workspace, key, content, source,
        confidence, risk, created_at, updated_at, expires_at, metadata_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        content = excluded.content,
        source = excluded.source,
        confidence = excluded.confidence,
        risk = excluded.risk,
        updated_at = excluded.updated_at,
        expires_at = excluded.expires_at,
        metadata_json = excluded.metadata_json
    `).run(
      entryId,
      layer,
      input.userId || null,
      input.sessionId || null,
      input.workspace || null,
      key,
      content,
      input.source || 'learning-loop',
      this.clampConfidence(input.confidence),
      risk,
      generatedAt,
      generatedAt,
      expiresAt,
      JSON.stringify(metadata),
    );
    this.upsertFts(entryId, layer, key, content);

    return this.receipt({
      layer,
      decision,
      risk,
      summary: `${layer} memory stored with top-k recall only.`,
      reasons,
      entryId,
      ftsIndexed: true,
      generatedAt,
    });
  }

  public async search(input: SearchInput): Promise<ZavorthLearningMemorySearchResult> {
    await this.init();
    const db = this.requireDb();
    this.pruneExpired();
    const generatedAt = this.now().toISOString();
    const query = String(input.query || '').trim();
    const limit = Math.max(1, Math.min(Number(input.limit || 8), 24));
    if (!query) {
      return {
        generatedAt,
        query: '',
        limit,
        total: 0,
        entries: [],
        receipt: this.receipt({
          layer: 'session',
          decision: 'accepted_session_only',
          risk: 'low',
          summary: 'Empty memory search skipped.',
          reasons: ['query-empty'],
          entryId: null,
          ftsIndexed: false,
          generatedAt,
        }),
      };
    }

    const layers: ZavorthLearningMemoryLayer[] = input.layers?.length
      ? input.layers.map((layer) => this.normalizeLayer(layer))
      : ['session', 'persistent', 'skill'];
    const ftsQuery = this.toFtsQuery(query);
    const nowIso = this.now().toISOString();
    const rows = ftsQuery
      ? this.searchFts(db, ftsQuery, input, layers, limit, nowIso)
      : this.searchLike(db, query, input, layers, limit, nowIso);
    const entries = rows.map((row: any) => ({
      ...this.mapEntry(row),
      score: Number(row.score || 0),
      trustBoundary: 'untrusted_memory' as const,
    }));

    return {
      generatedAt,
      query,
      limit,
      total: entries.length,
      entries,
      receipt: this.receipt({
        layer: 'persistent',
        decision: 'accepted',
        risk: 'low',
        summary: `Memory recall returned ${entries.length} top-k entr${entries.length === 1 ? 'y' : 'ies'}.`,
        reasons: ['top-k-only', 'untrusted-on-recall', 'no-full-memory-injection'],
        entryId: null,
        ftsIndexed: Boolean(ftsQuery),
        generatedAt,
      }),
    };
  }

  public async buildPromptContext(input: SearchInput): Promise<string> {
    const result = await this.search({
      ...input,
      limit: Math.min(Number(input.limit || MAX_PROMPT_CONTEXT_ENTRIES), MAX_PROMPT_CONTEXT_ENTRIES),
    });
    if (result.entries.length === 0) {
      return '';
    }
    const lines = result.entries.map((entry) => {
      const layer = sanitizeTrustPlaneText(entry.layer, { maxChars: 32 });
      const key = sanitizeTrustPlaneText(entry.key, { maxChars: 96 });
      const content = sanitizeTrustPlaneText(entry.content, { maxChars: MAX_PROMPT_CONTEXT_CHARS });
      return `- [${layer}] ${key}: ${content}`;
    });
    return buildUntrustedContextBlock('ZAVORTH MEMORY RECALL (TOP-K, UNTRUSTED):', lines);
  }

  public async forget(input: { id?: string | null; key?: string | null; userId?: string | null }): Promise<boolean> {
    await this.init();
    const db = this.requireDb();
    const id = String(input.id || '').trim();
    const key = this.normalizeKey(input.key || '');
    if (!id && (!input.userId || !key)) {
      return false;
    }
    const row = id
      ? db.prepare(`
        SELECT id FROM zavorth_learning_memory
        WHERE id = ? AND (? IS NULL OR user_id = ?)
      `).get(id, input.userId || null, input.userId || null) as { id: string } | undefined
      : db.prepare('SELECT id FROM zavorth_learning_memory WHERE user_id IS ? AND key = ? ORDER BY updated_at DESC LIMIT 1')
        .get(input.userId || null, key) as { id: string } | undefined;
    if (!row?.id) {
      return false;
    }
    db.prepare('DELETE FROM zavorth_learning_memory_fts WHERE entry_id = ?').run(row.id);
    db.prepare('DELETE FROM zavorth_learning_memory WHERE id = ?').run(row.id);
    return true;
  }

  public async correct(input: RememberInput & { id?: string | null }): Promise<ZavorthLearningMemoryReceipt> {
    if (input.id) {
      await this.forget({ id: input.id });
    }
    return this.remember(input);
  }

  public async assessSkillCandidate(input: SkillCandidateInput): Promise<ZavorthSkillMemoryCandidateAssessment> {
    await this.init();
    const generatedAt = this.now().toISOString();
    const intent = this.redact(input.intent);
    const combined = `${intent}\n${this.redact(input.demonstration || '')}`;
    const risk = this.estimateRisk(combined);
    const generality = this.scoreGenerality(combined);
    const determinism = this.scoreDeterminism(combined);
    const reasons: string[] = [];

    if (risk === 'high') reasons.push('high-risk-tasks-stay-missions-not-skills');
    if (generality < 0.55) reasons.push('too-domain-specific-for-skill-memory');
    if (determinism < 0.55) reasons.push('not-deterministic-enough-for-reusable-skill');
    if (this.hasPromptInjection(combined)) reasons.push('prompt-injection-risk');

    let decision: ZavorthSkillMemoryCandidateAssessment['decision'] = 'allow_skill_candidate';
    if (risk === 'high' || this.hasPromptInjection(combined)) {
      decision = 'reject_skill_candidate';
    } else if (generality < 0.55 || determinism < 0.55 || risk === 'medium') {
      decision = 'procedure_only';
    }

    const receipt = this.receipt({
      layer: 'skill',
      decision: decision === 'allow_skill_candidate' ? 'accepted' : decision === 'procedure_only' ? 'accepted_session_only' : 'rejected',
      risk,
      summary: decision === 'allow_skill_candidate'
        ? 'Skill memory candidate is general, deterministic and low-risk.'
        : decision === 'procedure_only'
          ? 'Candidate should remain procedure-only until reviewed.'
          : 'Skill memory candidate rejected; handle as governed mission.',
      reasons: reasons.length ? reasons : ['general-deterministic-low-risk'],
      entryId: null,
      ftsIndexed: false,
      generatedAt,
    });

    if (decision === 'allow_skill_candidate' && input.persistCandidate === true) {
      await this.remember({
        layer: 'skill',
        key: this.skillKey(intent),
        content: combined,
        userId: input.requestedBy || null,
        source: input.sourceSurface || 'skill-memory-assessment',
        confidence: Math.min(0.95, (generality + determinism) / 2),
        risk,
        metadata: {
          candidateDecision: decision,
          generality,
          determinism,
        },
      });
    }

    return {
      generatedAt,
      intent,
      decision,
      scores: {
        generality,
        determinism,
        risk,
      },
      reasons: reasons.length ? reasons : ['general-deterministic-low-risk'],
      receipt,
    };
  }

  public async buildStatus(): Promise<{
    generatedAt: string;
    layers: Record<ZavorthLearningMemoryLayer, number>;
    policy: Record<string, boolean>;
  }> {
    await this.init();
    const db = this.requireDb();
    this.pruneExpired();
    const rows = db.prepare(`
      SELECT layer, COUNT(*) AS count
      FROM zavorth_learning_memory
      GROUP BY layer
    `).all() as Array<{ layer: ZavorthLearningMemoryLayer; count: number }>;
    const layers = {
      session: 0,
      persistent: 0,
      skill: 0,
    };
    for (const row of rows) {
      layers[row.layer] = Number(row.count || 0);
    }
    return {
      generatedAt: this.now().toISOString(),
      layers,
      policy: {
        sessionExpires: true,
        persistentNeedsReason: true,
        skillHighRiskBlocked: true,
        ftsTopKRecall: true,
        recallMarkedUntrusted: true,
        rawTranscriptPersistenceBlocked: true,
      },
    };
  }

  private async init(): Promise<void> {
    if (this.initialized) return;
    if (!this.db) {
      this.db = (await Database.getInstance()).getRawDb();
    }
    const db = this.requireDb();
    db.prepare(`
      CREATE TABLE IF NOT EXISTS zavorth_learning_memory (
        id TEXT PRIMARY KEY,
        layer TEXT NOT NULL,
        user_id TEXT,
        session_id TEXT,
        workspace TEXT,
        key TEXT NOT NULL,
        content TEXT NOT NULL,
        source TEXT NOT NULL,
        confidence REAL NOT NULL,
        risk TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        expires_at TEXT,
        metadata_json TEXT NOT NULL DEFAULT '{}'
      )
    `).run();
    db.prepare('CREATE INDEX IF NOT EXISTS idx_zavorth_learning_memory_layer ON zavorth_learning_memory(layer)').run();
    db.prepare('CREATE INDEX IF NOT EXISTS idx_zavorth_learning_memory_user ON zavorth_learning_memory(user_id)').run();
    db.prepare('CREATE INDEX IF NOT EXISTS idx_zavorth_learning_memory_session ON zavorth_learning_memory(session_id)').run();
    db.prepare('CREATE INDEX IF NOT EXISTS idx_zavorth_learning_memory_expires ON zavorth_learning_memory(expires_at)').run();
    db.prepare(`
      CREATE VIRTUAL TABLE IF NOT EXISTS zavorth_learning_memory_fts
      USING fts5(entry_id UNINDEXED, layer, key, content, tokenize='unicode61')
    `).run();
    this.initialized = true;
  }

  private requireDb(): SQLiteDatabase {
    if (!this.db) {
      throw new Error('ZavorthMemoryLearningLoopService database is not initialized.');
    }
    return this.db;
  }

  private searchFts(
    db: SQLiteDatabase,
    ftsQuery: string,
    input: SearchInput,
    layers: ZavorthLearningMemoryLayer[],
    limit: number,
    nowIso: string,
  ): any[] {
    const placeholders = layers.map(() => '?').join(', ');
    const params: unknown[] = [ftsQuery, ...layers];
    let filter = `m.layer IN (${placeholders})`;
    if (input.userId) {
      filter += ' AND (m.user_id = ? OR m.user_id IS NULL)';
      params.push(input.userId);
    }
    if (input.sessionId) {
      filter += ' AND (m.session_id = ? OR m.session_id IS NULL)';
      params.push(input.sessionId);
    }
    if (input.workspace) {
      filter += ' AND (m.workspace = ? OR m.workspace IS NULL)';
      params.push(input.workspace);
    }
    params.push(nowIso, limit);
    return db.prepare(`
      SELECT m.*, bm25(zavorth_learning_memory_fts) * -1 AS score
      FROM zavorth_learning_memory_fts
      JOIN zavorth_learning_memory m ON m.id = zavorth_learning_memory_fts.entry_id
      WHERE zavorth_learning_memory_fts MATCH ?
        AND ${filter}
        AND (m.expires_at IS NULL OR m.expires_at > ?)
      ORDER BY score DESC, m.updated_at DESC
      LIMIT ?
    `).all(...params);
  }

  private searchLike(
    db: SQLiteDatabase,
    query: string,
    input: SearchInput,
    layers: ZavorthLearningMemoryLayer[],
    limit: number,
    nowIso: string,
  ): any[] {
    const placeholders = layers.map(() => '?').join(', ');
    const params: unknown[] = [...layers, `%${query}%`, `%${query}%`];
    let filter = `layer IN (${placeholders}) AND (key LIKE ? OR content LIKE ?)`;
    if (input.userId) {
      filter += ' AND (user_id = ? OR user_id IS NULL)';
      params.push(input.userId);
    }
    if (input.sessionId) {
      filter += ' AND (session_id = ? OR session_id IS NULL)';
      params.push(input.sessionId);
    }
    if (input.workspace) {
      filter += ' AND (workspace = ? OR workspace IS NULL)';
      params.push(input.workspace);
    }
    params.push(nowIso, limit);
    return db.prepare(`
      SELECT *, 0.5 AS score
      FROM zavorth_learning_memory
      WHERE ${filter}
        AND (expires_at IS NULL OR expires_at > ?)
      ORDER BY updated_at DESC
      LIMIT ?
    `).all(...params);
  }

  private upsertFts(entryId: string, layer: ZavorthLearningMemoryLayer, key: string, content: string): void {
    const db = this.requireDb();
    db.prepare('DELETE FROM zavorth_learning_memory_fts WHERE entry_id = ?').run(entryId);
    db.prepare('INSERT INTO zavorth_learning_memory_fts(entry_id, layer, key, content) VALUES (?, ?, ?, ?)')
      .run(entryId, layer, key, content);
  }

  private pruneExpired(): void {
    const db = this.requireDb();
    const expired = db.prepare(`
      SELECT id FROM zavorth_learning_memory
      WHERE expires_at IS NOT NULL AND expires_at <= ?
    `).all(this.now().toISOString()) as Array<{ id: string }>;
    for (const entry of expired) {
      db.prepare('DELETE FROM zavorth_learning_memory_fts WHERE entry_id = ?').run(entry.id);
      db.prepare('DELETE FROM zavorth_learning_memory WHERE id = ?').run(entry.id);
    }
  }

  private mapEntry(row: any): ZavorthLearningMemoryEntry {
    let metadata: Record<string, unknown> = {};
    try {
      metadata = JSON.parse(String(row.metadata_json || '{}'));
    } catch (error: unknown) {logger.warn('[Zavorth Memory Learning Loop] JSON parse failed', error);
    metadata = {};
  }
    return {
      id: String(row.id),
      layer: row.layer as ZavorthLearningMemoryLayer,
      userId: row.user_id || null,
      sessionId: row.session_id || null,
      workspace: row.workspace || null,
      key: String(row.key || ''),
      content: String(row.content || ''),
      source: String(row.source || 'learning-loop'),
      confidence: Number(row.confidence || 0),
      risk: row.risk as ZavorthLearningMemoryRisk,
      createdAt: String(row.created_at || ''),
      updatedAt: String(row.updated_at || ''),
      expiresAt: row.expires_at || null,
      metadata,
    };
  }

  private evaluateMemoryWrite(input: RememberInput, risk: ZavorthLearningMemoryRisk): string[] {
    const reasons: string[] = [];
    if (input.layer === 'session') reasons.push('session-memory-expires-and-cannot-auto-promote');
    if (input.layer === 'persistent') reasons.push('persistent-memory-requires-provenance-and-reviewable-entry');
    if (input.layer === 'skill') reasons.push('skill-memory-must-be-general-deterministic-and-governed');
    if (risk === 'high') reasons.push('high-risk-memory-write-blocked');
    if (this.hasPromptInjection(`${input.key}\n${input.content}`)) reasons.push('prompt-injection-risk');
    if (this.containsSecret(input.content)) reasons.push('raw-secret-redacted');
    return reasons;
  }

  private resolveMemoryDecision(
    layer: ZavorthLearningMemoryLayer,
    risk: ZavorthLearningMemoryRisk,
    reasons: string[],
  ): ZavorthLearningMemoryDecision {
    if (reasons.includes('prompt-injection-risk')) return 'rejected';
    if (risk === 'high' || risk === 'medium') return layer === 'session' ? 'accepted_session_only' : 'requires_review';
    return layer === 'session' ? 'accepted_session_only' : 'accepted';
  }

  private receipt(input: {
    layer: ZavorthLearningMemoryLayer;
    decision: ZavorthLearningMemoryDecision;
    risk: ZavorthLearningMemoryRisk;
    summary: string;
    reasons: string[];
    entryId: string | null;
    ftsIndexed: boolean;
    generatedAt: string;
  }): ZavorthLearningMemoryReceipt {
    return {
      id: `memory-learning:${this.hash([input.generatedAt, input.layer, input.entryId, input.summary]).slice(0, 16)}`,
      generatedAt: input.generatedAt,
      layer: input.layer,
      decision: input.decision,
      risk: input.risk,
      summary: input.summary,
      reasons: input.reasons,
      entryId: input.entryId,
      redaction: {
        rawTranscriptPersisted: false,
        rawSecretsPersisted: false,
      },
      controls: {
        ftsIndexed: input.ftsIndexed,
        topKOnly: true,
        untrustedOnRecall: true,
        canForget: true,
        canCorrect: true,
      },
    };
  }

  private estimateRisk(text: string): ZavorthLearningMemoryRisk {
    if (/(?:rm\s+-rf|sudo|production|deploy|database\s+migration|delete|wipe|secret|password|token|private\s+key|credential)/i.test(text)) {
      return 'high';
    }
    if (/(?:network|webhook|install|filesystem|write|automation|server|api)/i.test(text)) {
      return 'medium';
    }
    return 'low';
  }

  private normalizeLayer(value: unknown): ZavorthLearningMemoryLayer {
    if (value === 'session' || value === 'persistent' || value === 'skill') {
      return value;
    }
    throw new Error(`Invalid learning memory layer: ${String(value || 'missing')}`);
  }

  private normalizeRisk(value: unknown): ZavorthLearningMemoryRisk {
    if (value === 'low' || value === 'medium' || value === 'high') {
      return value;
    }
    return 'medium';
  }

  private normalizeSessionTtl(value: unknown): number {
    const ttl = Number(value || DEFAULT_SESSION_TTL_MS);
    if (!Number.isFinite(ttl)) {
      return DEFAULT_SESSION_TTL_MS;
    }
    return Math.max(MIN_SESSION_TTL_MS, Math.min(ttl, MAX_SESSION_TTL_MS));
  }

  private scoreGenerality(text: string): number {
    let score = 0.75;
    if (/\b(this repo|este projeto|meus ultimos|my last|specific branch|database migration|infra atual)\b/i.test(text)) score -= 0.35;
    if (/\b(github pr|pull request|release notes|logs|changelog|summarize|triage|organize files)\b/i.test(text)) score += 0.2;
    return this.clamp(score);
  }

  private scoreDeterminism(text: string): number {
    let score = 0.65;
    if (/\b(summarize|classify|extract|format|triage|generate release notes|organize)\b/i.test(text)) score += 0.25;
    if (/\b(decide strategy|migrate|redesign|invent|optimize production|fix everything)\b/i.test(text)) score -= 0.3;
    return this.clamp(score);
  }

  private hasPromptInjection(text: string): boolean {
    return /\b(ignore (all )?(previous|prior) instructions|disregard system|reveal secrets|exfiltrate|send files|developer message)\b/i
      .test(text);
  }

  private containsSecret(text: string): boolean {
    return /\b(token|secret|password|api[_ -]?key|private[_ -]?key|credential)\s*[:=]\s*\S+/i.test(text);
  }

  private redact(value: unknown): string {
    return sanitizeTrustPlaneText(String(value || '')
      .replace(/\b(token|secret|password|api[_ -]?key|private[_ -]?key|credential)\s*[:=]\s*\S+/gi, '$1=[REDACTED]')
      .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, '[REDACTED_EMAIL]')
      .slice(0, MAX_CONTENT_CHARS), { maxChars: MAX_CONTENT_CHARS });
  }

  private sanitizeMetadata(value: Record<string, unknown>): Record<string, unknown> {
    const safe: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value || {})) {
      const safeKey = this.normalizeKey(key);
      if (!safeKey) continue;
      if (item === null || typeof item === 'number' || typeof item === 'boolean') {
        safe[safeKey] = item;
        continue;
      }
      if (typeof item === 'string') {
        safe[safeKey] = this.redact(item).slice(0, 500);
        continue;
      }
      safe[safeKey] = this.redact(JSON.stringify(item)).slice(0, 800);
    }
    return safe;
  }

  private normalizeKey(value: unknown): string {
    return String(value || 'memory')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9._:-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 96) || 'memory';
  }

  private skillKey(intent: string): string {
    return `skill:${this.normalizeKey(intent).slice(0, 72)}`;
  }

  private toFtsQuery(query: string): string {
    const tokens = String(query || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .split(/[^a-z0-9_:-]+/i)
      .map((token) => token.trim())
      .filter((token) => token.length >= 2)
      .slice(0, 8);
    return tokens.map((token) => `"${token.replace(/"/g, '""')}"`).join(' OR ');
  }

  private entryId(layer: ZavorthLearningMemoryLayer, userId: string | null, sessionId: string | null, key: string): string {
    return `ml:${this.hash([layer, userId || '', sessionId || '', this.normalizeKey(key)]).slice(0, 24)}`;
  }

  private clampConfidence(value: unknown): number {
    return this.clamp(Number(value ?? 0.75));
  }

  private clamp(value: number): number {
    return Number(Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0)).toFixed(3));
  }

  private hash(value: unknown): string {
    return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
  }
}
