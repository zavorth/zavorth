import fs from 'fs';
import path from 'path';
import { logger } from '../../logger.js';

export interface MemoryEntry {
  id: string;
  content: string;
  category: 'fact' | 'preference' | 'event' | 'instruction' | 'context' | 'relationship';
  importance: number;
  access_count: number;
  last_accessed: string;
  created_at: string;
  expires_at: string | null;
  source: string;
  tags: string[];
  metadata: Record<string, unknown>;
}

export interface MemoryDecision {
  action: 'remember' | 'forget' | 'update' | 'promote' | 'demote';
  entry_id: string;
  reason: string;
  new_importance?: number;
}

export class ActiveMemoryService {
  private readonly storageDir: string;
  private entries: Map<string, MemoryEntry> = new Map();
  private readonly MAX_ENTRIES = 5000;
  private readonly IMPORTANCE_DECAY_RATE = 0.95;
  private readonly FORGET_THRESHOLD = 0.1;
  private dirty = false;
  private flushTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(options?: { storageDir?: string }) {
    this.storageDir = options?.storageDir || path.join(process.cwd(), 'data', 'runtime', 'active-memory');
    this.ensureStorageDir();
    this.loadEntries();
  }

  private ensureStorageDir(): void {
    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
    }
  }

  private loadEntries(): void {
    const filePath = path.join(this.storageDir, 'entries.json');
    if (!fs.existsSync(filePath)) return;
    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      const sanitized = this.sanitizeParsedData(data) as Record<string, MemoryEntry>;
      this.entries = new Map(Object.entries(sanitized));
    } catch (error: unknown) {/* ignore */ logger.warn('[Active Memory] JSON parse failed', error); }
  }

  private scheduleFlush(): void {
    this.dirty = true;
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      if (!this.dirty) return;
      this.dirty = false;
      try {
        if (!fs.existsSync(this.storageDir)) {
          fs.mkdirSync(this.storageDir, { recursive: true });
        }
        this.flushNow();
      } catch (error: unknown) {
        logger.warn('[DeferredFlush] deferred flush failed', error);
      }
    }, 2000);
    if (this.flushTimer && typeof this.flushTimer === 'object' && 'unref' in this.flushTimer) {
      (this.flushTimer as NodeJS.Timeout).unref();
    }
  }

  public flush(): void {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    if (this.dirty) {
      this.dirty = false;
      this.flushNow();
    }
  }

  private flushNow(): void {
    try {
      if (!fs.existsSync(this.storageDir)) return;
      fs.writeFileSync(
        path.join(this.storageDir, 'entries.json'),
        JSON.stringify(Object.fromEntries(this.entries), null, 2),
        'utf-8',
      );
    } catch (error: unknown) {if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }

  public remember(content: string, options?: {
    category?: MemoryEntry['category'];
    importance?: number;
    source?: string;
    tags?: string[];
    expires_at?: string;
    metadata?: Record<string, unknown>;
  }): string {
    const id = `mem_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const importance = typeof options?.importance === 'number' ? options.importance : this.estimateImportance(content);

    const entry: MemoryEntry = {
      id,
      content,
      category: options?.category || 'fact',
      importance,
      access_count: 0,
      last_accessed: new Date().toISOString(),
      created_at: new Date().toISOString(),
      expires_at: options?.expires_at || null,
      source: options?.source || 'user',
      tags: options?.tags || [],
      metadata: options?.metadata || {},
    };

    this.entries.set(id, entry);
    this.maybeEvict();
    this.scheduleFlush();

    return `Remembered [${id}]: "${content.slice(0, 80)}${content.length > 80 ? '...' : ''}" (importancia: ${importance.toFixed(2)})`;
  }

  public recall(query: string, options?: {
    category?: MemoryEntry['category'];
    min_importance?: number;
    limit?: number;
  }): string {
    const limit = options?.limit || 10;
    const minImportance = options?.min_importance || 0;

    const scored: Array<{ entry: MemoryEntry; score: number }> = [];

    for (const entry of this.entries.values()) {
      if (options?.category && entry.category !== options.category) continue;
      if (entry.importance < minImportance) continue;
      if (entry.expires_at && new Date(entry.expires_at) < new Date()) continue;

      const score = this.computeRelevance(query, entry);
      if (score > 0.1) {
        entry.access_count++;
        entry.last_accessed = new Date().toISOString();
        scored.push({ entry, score });
      }
    }

    scored.sort((a, b) => b.score - a.score);
    const top = scored.slice(0, limit);

    if (top.length === 0) return `No memories found para "${query}".`;

    const lines: string[] = [`Memorys para "${query}" (${top.length} results):`];
    for (const { entry, score } of top) {
      const cat = { fact: '📌', preference: '💜', event: '📅', instruction: '📋', context: '🔗', relationship: '👥' }[entry.category];
      lines.push(`  ${cat} [${entry.id}] ${entry.content.slice(0, 100)} (score:${score.toFixed(2)} imp:${entry.importance.toFixed(2)} acc:${entry.access_count})`);
    }

    this.scheduleFlush();
    return lines.join('\n');
  }

  public forget(entryId: string): string {
    if (!this.entries.has(entryId)) return `Memory "${entryId}" not found.`;
    this.entries.delete(entryId);
    this.scheduleFlush();
    return `Memory "${entryId}" forgotten.`;
  }

  public update(entryId: string, updates: { content?: string; importance?: number; tags?: string[] }): string {
    const entry = this.entries.get(entryId);
    if (!entry) return `Memory "${entryId}" not found.`;

    if (updates.content) entry.content = updates.content;
    if (typeof updates.importance === 'number') entry.importance = Math.max(0, Math.min(1, updates.importance));
    if (updates.tags) entry.tags = updates.tags;
    entry.last_accessed = new Date().toISOString();

    this.scheduleFlush();
    return `Memory "${entryId}" updated.`;
  }

  public promote(entryId: string, reason?: string): string {
    const entry = this.entries.get(entryId);
    if (!entry) return `Memory "${entryId}" not found.`;

    entry.importance = Math.min(1, entry.importance + 0.2);
    entry.metadata.promoted_at = new Date().toISOString();
    entry.metadata.promote_reason = reason || 'manual';

    this.scheduleFlush();
    return `Memory "${entryId}" promoted (importancia: ${entry.importance.toFixed(2)}).`;
  }

  public demote(entryId: string, reason?: string): string {
    const entry = this.entries.get(entryId);
    if (!entry) return `Memory "${entryId}" not found.`;

    entry.importance = Math.max(0, entry.importance - 0.2);
    entry.metadata.demoted_at = new Date().toISOString();
    entry.metadata.demote_reason = reason || 'manual';

    this.scheduleFlush();
    return `Memory "${entryId}" demoted (importancia: ${entry.importance.toFixed(2)}).`;
  }

  public consolidate(): string {
    const now = Date.now();
    let decayed = 0;
    let expired = 0;
    let forgotten = 0;

    for (const [id, entry] of this.entries) {
      if (entry.expires_at && new Date(entry.expires_at).getTime() < now) {
        this.entries.delete(id);
        expired++;
        continue;
      }

      const daysSinceAccess = (now - new Date(entry.last_accessed).getTime()) / 86400000;
      if (daysSinceAccess > 1) {
        entry.importance *= Math.pow(this.IMPORTANCE_DECAY_RATE, daysSinceAccess);
        decayed++;
      }

      if (entry.importance < this.FORGET_THRESHOLD && entry.access_count < 2) {
        this.entries.delete(id);
        forgotten++;
      }
    }

    this.scheduleFlush();
    return `Consolidation: ${decayed} importancias reduzidas, ${expired} expiradas, ${forgotten} forgottens. Total: ${this.entries.size}`;
  }

  public getStats(): string {
    const byCategory: Record<string, number> = {};
    let totalImportance = 0;
    let totalAccess = 0;

    for (const entry of this.entries.values()) {
      byCategory[entry.category] = (byCategory[entry.category] || 0) + 1;
      totalImportance += entry.importance;
      totalAccess += entry.access_count;
    }

    const avgImportance = this.entries.size > 0 ? totalImportance / this.entries.size : 0;
    const avgAccess = this.entries.size > 0 ? totalAccess / this.entries.size : 0;

    const lines: string[] = [
      'Statistics de Memory Ativa:',
      `  Total: ${this.entries.size}/${this.MAX_ENTRIES}`,
      `  Importancia media: ${avgImportance.toFixed(3)}`,
      `  Acessos medio: ${avgAccess.toFixed(1)}`,
      '',
      'Por Categoria:',
      ...Object.entries(byCategory).map(([cat, count]) => `  ${cat}: ${count}`),
    ];

    return lines.join('\n');
  }

  public listEntries(options?: { category?: string; min_importance?: number; limit?: number }): string {
    let entries = Array.from(this.entries.values());

    if (options?.category) entries = entries.filter((e) => e.category === options.category);
    if (options && typeof options.min_importance === 'number') {
      const minImp = options.min_importance;
      entries = entries.filter((e) => e.importance >= minImp);
    }

    entries.sort((a, b) => b.importance - a.importance);
    const limit = options?.limit || 20;
    entries = entries.slice(0, limit);

    if (entries.length === 0) return 'No memories found.';

    const lines: string[] = [`Memorys (${entries.length}):`];
    for (const e of entries) {
      const cat = { fact: '📌', preference: '💜', event: '📅', instruction: '📋', context: '🔗', relationship: '👥' }[e.category];
      lines.push(`  ${cat} [${e.id}] imp:${e.importance.toFixed(2)} acc:${e.access_count} — ${e.content.slice(0, 80)}`);
    }
    return lines.join('\n');
  }

  public processInteraction(userMessage: string, assistantResponse: string): MemoryDecision[] {
    void userMessage;
    void assistantResponse;
    return [];
  }
  private computeRelevance(query: string, entry: MemoryEntry): number {
    const queryWords = query.toLowerCase().split(/\s+/).filter(Boolean);
    const entryWords = entry.content.toLowerCase().split(/\s+/);
    const entryTags = entry.tags.map((t) => t.toLowerCase());

    let matchedWords = 0;
    for (const word of queryWords) {
      if (entryWords.some((ew) => ew.includes(word) || word.includes(ew))) matchedWords++;
      if (entryTags.some((t) => t.includes(word) || word.includes(t))) matchedWords += 0.5;
    }

    const wordScore = queryWords.length > 0 ? matchedWords / queryWords.length : 0;
    return wordScore * entry.importance * (1 + Math.log(1 + entry.access_count));
  }

  private estimateImportance(content: string): number {
    void content;
    return 0.5;
  }
  private maybeEvict(): void {
    if (this.entries.size <= this.MAX_ENTRIES) return;

    const sorted = Array.from(this.entries.entries()).sort((a, b) => {
      const scoreA = a[1].importance * (1 + a[1].access_count);
      const scoreB = b[1].importance * (1 + b[1].access_count);
      return scoreA - scoreB;
    });

    const toRemove = this.entries.size - this.MAX_ENTRIES;
    for (let i = 0; i < toRemove; i++) {
      this.entries.delete(sorted[i][0]);
    }
  }

  private sanitizeParsedData(data: unknown): unknown {
    if (Array.isArray(data)) return data.map((item) => this.sanitizeParsedData(item));
    if (data && typeof data === 'object') {
      const clean: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
        if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
        clean[key] = this.sanitizeParsedData(value);
      }
      return clean;
    }
    return data;
  }
}
