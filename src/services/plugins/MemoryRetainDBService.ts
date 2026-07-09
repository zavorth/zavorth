import fs from 'fs';
import path from 'path';
import { logger } from '../../logger.js';

export type RetentionPolicy = { type: 'forever' } | { type: 'expire'; days: number } | { type: 'keep_last'; count: number };

export interface RetainedMemory {
  id: string;
  content: string;
  category: string;
  policy: RetentionPolicy;
  importance: number;
  access_count: number;
  created_at: string;
  updated_at: string;
  expires_at: string | null;
  tags: string[];
  metadata: Record<string, unknown>;
}

export class MemoryRetainDBService {
  private readonly storageDir: string;
  private memories: Map<string, RetainedMemory> = new Map();
  private readonly MAX_MEMORIES = 15000;
  private defaultPolicy: RetentionPolicy = { type: 'forever' };
  private dirty = false;
  private flushTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(options?: { storageDir?: string; defaultPolicy?: RetentionPolicy }) {
    this.storageDir = options?.storageDir || path.join(process.cwd(), 'data', 'runtime', 'retaindb');
    if (options?.defaultPolicy) this.defaultPolicy = options.defaultPolicy;
    this.ensureStorageDir();
    this.loadData();
  }

  private ensureStorageDir(): void {
    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
    }
  }

  private loadData(): void {
    const filePath = path.join(this.storageDir, 'memories.json');
    if (!fs.existsSync(filePath)) return;
    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      for (const [id, mem] of Object.entries(data as Record<string, RetainedMemory>)) {
        this.memories.set(id, mem);
      }
    } catch (error: unknown) {/* ignore */ logger.warn('[Memory Retain D B] JSON parse failed', error); }
  }

  private scheduleFlush(): void {
    this.dirty = true;
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      if (this.dirty) {
        this.dirty = false;
        fs.writeFileSync(path.join(this.storageDir, 'memories.json'), JSON.stringify(Object.fromEntries(this.memories), null, 2), 'utf-8');
      }
    }, 2000);
    if (this.flushTimer && typeof this.flushTimer === 'object' && 'unref' in this.flushTimer) {
      (this.flushTimer as NodeJS.Timeout).unref();
    }
  }

  public store(content: string, options?: { category?: string; policy?: RetentionPolicy; importance?: number; tags?: string[]; metadata?: Record<string, unknown> }): string {
    if (this.memories.size >= this.MAX_MEMORIES) {
      this.enforceRetentionPolicy();
    }

    const id = `ret_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const policy = options?.policy || this.defaultPolicy;
    const expiresAt = this.calculateExpiry(policy);

    const memory: RetainedMemory = {
      id,
      content,
      category: options?.category || 'general',
      policy,
      importance: options?.importance ?? 0.5,
      access_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      expires_at: expiresAt,
      tags: options?.tags || [],
      metadata: options?.metadata || {},
    };

    this.memories.set(id, memory);
    this.applyKeepLastPolicy(memory.category, policy);
    this.scheduleFlush();

    const policyDesc = this.describePolicy(policy);
    return `Memory stored: ${id} | Category: ${memory.category} | Policy: ${policyDesc}`;
  }

  public retrieve(query: string, limit: number = 5, categoryFilter?: string): RetainedMemory[] {
    this.cleanExpired();

    const queryLower = query.toLowerCase();
    const scored: Array<{ memory: RetainedMemory; score: number }> = [];

    for (const memory of this.memories.values()) {
      if (categoryFilter && memory.category !== categoryFilter) continue;
      let score = 0;
      const contentLower = memory.content.toLowerCase();

      if (contentLower.includes(queryLower)) score += 3;
      for (const word of queryLower.split(/\s+/)) {
        if (contentLower.includes(word)) score += 0.5;
      }
      for (const tag of memory.tags) {
        if (queryLower.includes(tag.toLowerCase())) score += 1;
      }
      score += memory.importance * 0.5;
      score += Math.min(memory.access_count * 0.05, 0.5);

      if (score > 0) scored.push({ memory, score });
    }

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit).map((s) => {
      s.memory.access_count++;
      s.memory.updated_at = new Date().toISOString();
      return s.memory;
    });
  }

  public retrieveAsString(query: string, limit: number = 5, categoryFilter?: string): string {
    const results = this.retrieve(query, limit, categoryFilter);
    if (results.length === 0) return 'No memories found.';

    const lines: string[] = [`Retrieved ${results.length} memories for "${query}":`];
    for (const mem of results) {
      const expiry = mem.expires_at ? ` | Expires: ${mem.expires_at.slice(0, 10)}` : ' | Never expires';
      lines.push(`  ${mem.id} [${mem.category}]: ${mem.content.slice(0, 80)}${mem.content.length > 80 ? '...' : ''}`);
      lines.push(`    Policy: ${this.describePolicy(mem.policy)}${expiry}`);
    }
    return lines.join('\n');
  }

  public setPolicy(memoryId: string, policy: RetentionPolicy): string {
    const memory = this.memories.get(memoryId);
    if (!memory) return `Error: memory "${memoryId}" not found.`;

    memory.policy = policy;
    memory.expires_at = this.calculateExpiry(policy);
    memory.updated_at = new Date().toISOString();
    this.applyKeepLastPolicy(memory.category, policy);
    this.scheduleFlush();
    return `Policy updated for "${memoryId}": ${this.describePolicy(policy)}`;
  }

  public setCategoryPolicy(category: string, policy: RetentionPolicy): string {
    let count = 0;
    for (const memory of this.memories.values()) {
      if (memory.category === category) {
        memory.policy = policy;
        memory.expires_at = this.calculateExpiry(policy);
        memory.updated_at = new Date().toISOString();
        count++;
      }
    }
    this.applyKeepLastPolicy(category, policy);
    this.scheduleFlush();
    return `Policy updated for ${count} memories in category "${category}": ${this.describePolicy(policy)}`;
  }

  public cleanExpired(): number {
    const now = Date.now();
    let cleaned = 0;
    for (const [id, memory] of this.memories) {
      if (memory.expires_at && new Date(memory.expires_at).getTime() <= now) {
        this.memories.delete(id);
        cleaned++;
      }
    }
    if (cleaned > 0) this.scheduleFlush();
    return cleaned;
  }

  public forceCleanup(): string {
    const expired = this.cleanExpired();
    const before = this.memories.size;
    this.enforceRetentionPolicy();
    const evicted = before - this.memories.size - expired;
    return `Cleanup complete: ${expired} expired, ${evicted} evicted by capacity. Remaining: ${this.memories.size}`;
  }

  public getByCategory(category: string): string {
    const filtered = Array.from(this.memories.values()).filter((m) => m.category === category);
    if (filtered.length === 0) return `No memories in category "${category}".`;

    const lines: string[] = [`Memories in "${category}" (${filtered.length}):`];
    for (const mem of filtered.slice(0, 20)) {
      const expiry = mem.expires_at ? `expires ${mem.expires_at.slice(0, 10)}` : 'forever';
      lines.push(`  ${mem.id}: ${mem.content.slice(0, 60)}... | ${expiry}`);
    }
    return lines.join('\n');
  }

  public delete(memoryId: string): string {
    if (!this.memories.has(memoryId)) return `Error: memory "${memoryId}" not found.`;
    this.memories.delete(memoryId);
    this.scheduleFlush();
    return `Memory "${memoryId}" deleted.`;
  }

  public getStats(): string {
    this.cleanExpired();

    const categoryCounts: Record<string, number> = {};
    const policyCounts: Record<string, number> = { forever: 0, expire: 0, keep_last: 0 };
    let expiringCount = 0;

    for (const mem of this.memories.values()) {
      categoryCounts[mem.category] = (categoryCounts[mem.category] || 0) + 1;
      policyCounts[mem.policy.type]++;
      if (mem.expires_at) expiringCount++;
    }

    const topCategories = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([c, n]) => `    ${c}: ${n}`).join('\n');

    return [
      `RetainDB Stats:`,
      `  Total memories: ${this.memories.size}/${this.MAX_MEMORIES}`,
      `  With expiry: ${expiringCount}`,
      `  Forever: ${policyCounts.forever}`,
      `  Expire after N days: ${policyCounts.expire}`,
      `  Keep last N: ${policyCounts.keep_last}`,
      `  Default policy: ${this.describePolicy(this.defaultPolicy)}`,
      `  Categories:\n${topCategories}`,
    ].join('\n');
  }

  private calculateExpiry(policy: RetentionPolicy): string | null {
    switch (policy.type) {
      case 'forever':
        return null;
      case 'expire': {
        const expiry = new Date();
        expiry.setDate(expiry.getDate() + policy.days);
        return expiry.toISOString();
      }
      case 'keep_last':
        return null;
    }
  }

  private describePolicy(policy: RetentionPolicy): string {
    switch (policy.type) {
      case 'forever': return 'Keep forever';
      case 'expire': return `Expire after ${policy.days} days`;
      case 'keep_last': return `Keep last ${policy.count} entries`;
    }
  }

  private applyKeepLastPolicy(category: string, policy: RetentionPolicy): void {
    if (policy.type !== 'keep_last') return;
    const inCategory = Array.from(this.memories.values())
      .filter((m) => m.category === category && m.policy.type === 'keep_last')
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    if (inCategory.length > policy.count) {
      const toRemove = inCategory.slice(policy.count);
      for (const mem of toRemove) {
        this.memories.delete(mem.id);
      }
    }
  }

  private enforceRetentionPolicy(): void {
    this.cleanExpired();

    if (this.memories.size < this.MAX_MEMORIES) return;

    const sorted = Array.from(this.memories.entries()).sort((a, b) => {
      const aScore = a[1].importance * 0.6 + Math.min(a[1].access_count * 0.05, 0.4);
      const bScore = b[1].importance * 0.6 + Math.min(b[1].access_count * 0.05, 0.4);
      return aScore - bScore;
    });

    const toRemove = Math.max(1, Math.floor(this.MAX_MEMORIES * 0.1));
    for (let i = 0; i < toRemove && i < sorted.length; i++) {
      this.memories.delete(sorted[i][0]);
    }
  }
}
