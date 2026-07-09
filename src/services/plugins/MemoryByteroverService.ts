import fs from 'fs';
import path from 'path';
import { logger } from '../../logger.js';export interface ByteroverEntity {
  name: string;
  type: 'person' | 'place' | 'concept' | 'tool' | 'project' | 'organization' | 'event';
  mentions: number;
  first_seen: string;
  last_seen: string;
}

export interface ByteroverRelation {
  source: string;
  target: string;
  type: string;
  strength: number;
  created_at: string;
}

export interface ByteroverMemory {
  id: string;
  content: string;
  category: string;
  tags: string[];
  entities: string[];
  relations: Array<{ source: string; target: string; type: string }>;
  importance: number;
  access_count: number;
  created_at: string;
  updated_at: string;
  metadata: Record<string, unknown>;
}

export class MemoryByteroverService {
  private readonly storageDir: string;
  private memories: Map<string, ByteroverMemory> = new Map();
  private entities: Map<string, ByteroverEntity> = new Map();
  private relations: ByteroverRelation[] = [];
  private readonly MAX_MEMORIES = 8000;
  private dirty = false;
  private flushTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(options?: { storageDir?: string }) {
    this.storageDir = options?.storageDir || path.join(process.cwd(), 'data', 'runtime', 'byterover');
    this.ensureStorageDir();
    this.loadData();
  }

  private ensureStorageDir(): void {
    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
    }
  }

  private loadData(): void {
    const memoriesPath = path.join(this.storageDir, 'memories.json');
    const entitiesPath = path.join(this.storageDir, 'entities.json');
    const relationsPath = path.join(this.storageDir, 'relations.json');

    if (fs.existsSync(memoriesPath)) {
      try {
        const data = JSON.parse(fs.readFileSync(memoriesPath, 'utf-8'));
        for (const [id, mem] of Object.entries(data as Record<string, ByteroverMemory>)) {
          this.memories.set(id, mem);
        }
      } catch (error: unknown) {/* ignore */ logger.warn('[Memory Byterover] JSON parse failed', error); }
    }

    if (fs.existsSync(entitiesPath)) {
      try {
        const data = JSON.parse(fs.readFileSync(entitiesPath, 'utf-8'));
        for (const [name, ent] of Object.entries(data as Record<string, ByteroverEntity>)) {
          this.entities.set(name, ent);
        }
      } catch (error: unknown) {/* ignore */ logger.warn('[Memory Byterover] JSON parse failed', error); }
    }

    if (fs.existsSync(relationsPath)) {
      try {
        this.relations = JSON.parse(fs.readFileSync(relationsPath, 'utf-8'));
      } catch (error: unknown) {/* ignore */ logger.warn('[Memory Byterover] JSON parse failed', error); }
    }
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
        fs.writeFileSync(path.join(this.storageDir, 'memories.json'), JSON.stringify(Object.fromEntries(this.memories), null, 2), 'utf-8');
        fs.writeFileSync(path.join(this.storageDir, 'entities.json'), JSON.stringify(Object.fromEntries(this.entities), null, 2), 'utf-8');
        fs.writeFileSync(path.join(this.storageDir, 'relations.json'), JSON.stringify(this.relations, null, 2), 'utf-8');
      } catch (error: unknown) {
        logger.warn('[DeferredFlush] deferred flush failed', error);
      }
    }, 2000);
    if (this.flushTimer && typeof this.flushTimer === 'object' && 'unref' in this.flushTimer) {
      (this.flushTimer as NodeJS.Timeout).unref();
    }
  }

  public store(content: string, options?: { category?: string; tags?: string[]; importance?: number; metadata?: Record<string, unknown> }): string {
    if (this.memories.size >= this.MAX_MEMORIES) {
      this.evictOldest();
    }

    const id = `br_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const entities = this.extractEntities(content);
    const extractedRelations = this.extractRelations(content, entities);
    const autoCategory = options?.category || this.categorizeContent(content);
    const autoTags = options?.tags || this.autoTag(content, entities);

    for (const entityName of entities) {
      this.registerEntity(entityName);
    }

    for (const rel of extractedRelations) {
      this.registerRelation(rel.source, rel.target, rel.type);
    }

    const memory: ByteroverMemory = {
      id,
      content,
      category: autoCategory,
      tags: autoTags,
      entities,
      relations: extractedRelations,
      importance: options?.importance ?? 0.5,
      access_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      metadata: options?.metadata || {},
    };

    this.memories.set(id, memory);
    this.scheduleFlush();
    return `Memory stored: ${id} | Category: ${autoCategory} | Entities: ${entities.join(', ')} | Tags: ${autoTags.join(', ')}`;
  }

  public retrieve(query: string, limit: number = 5): ByteroverMemory[] {
    const queryLower = query.toLowerCase();
    const scored: Array<{ memory: ByteroverMemory; score: number }> = [];

    for (const memory of this.memories.values()) {
      let score = 0;
      const contentLower = memory.content.toLowerCase();

      if (contentLower.includes(queryLower)) score += 3;
      const queryWords = queryLower.split(/\s+/);
      for (const word of queryWords) {
        if (contentLower.includes(word)) score += 0.5;
      }

      for (const entity of memory.entities) {
        if (queryLower.includes(entity.toLowerCase())) score += 2;
      }

      for (const tag of memory.tags) {
        if (queryLower.includes(tag.toLowerCase())) score += 1;
      }

      score += memory.importance * 0.5;
      score += Math.min(memory.access_count * 0.1, 1);

      if (score > 0) scored.push({ memory, score });
    }

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit).map((s) => {
      s.memory.access_count++;
      s.memory.updated_at = new Date().toISOString();
      return s.memory;
    });
  }

  public retrieveAsString(query: string, limit: number = 5): string {
    const results = this.retrieve(query, limit);
    if (results.length === 0) return 'No memories found.';

    const lines: string[] = [`Retrieved ${results.length} memories for "${query}":`];
    for (const mem of results) {
      lines.push(`  ${mem.id} [${mem.category}]: ${mem.content.slice(0, 100)}${mem.content.length > 100 ? '...' : ''}`);
      lines.push(`    Tags: ${mem.tags.join(', ')} | Entities: ${mem.entities.join(', ')}`);
    }
    return lines.join('\n');
  }

  public getEntities(type?: string): string {
    let filtered = Array.from(this.entities.values());
    if (type) filtered = filtered.filter((e) => e.type === type);

    if (filtered.length === 0) return 'No entities found.';

    const lines: string[] = [`Entities (${filtered.length}):`];
    for (const entity of filtered.sort((a, b) => b.mentions - a.mentions).slice(0, 30)) {
      lines.push(`  ${entity.name} [${entity.type}]: ${entity.mentions} mentions`);
    }
    return lines.join('\n');
  }

  public getRelations(entityName?: string): string {
    let filtered = this.relations;
    if (entityName) {
      filtered = filtered.filter((r) => r.source === entityName || r.target === entityName);
    }

    if (filtered.length === 0) return 'No relations found.';

    const lines: string[] = [`Relations (${filtered.length}):`];
    for (const rel of filtered.sort((a, b) => b.strength - a.strength).slice(0, 30)) {
      lines.push(`  ${rel.source} --[${rel.type}]--> ${rel.target} (strength: ${rel.strength.toFixed(2)})`);
    }
    return lines.join('\n');
  }

  public getByCategory(category: string): string {
    const filtered = Array.from(this.memories.values()).filter((m) => m.category === category);
    if (filtered.length === 0) return `No memories in category "${category}".`;

    const lines: string[] = [`Memories in "${category}" (${filtered.length}):`];
    for (const mem of filtered.slice(0, 20)) {
      lines.push(`  ${mem.id}: ${mem.content.slice(0, 80)}${mem.content.length > 80 ? '...' : ''}`);
    }
    return lines.join('\n');
  }

  public getByTag(tag: string): string {
    const filtered = Array.from(this.memories.values()).filter((m) => m.tags.includes(tag));
    if (filtered.length === 0) return `No memories with tag "${tag}".`;

    const lines: string[] = [`Memories tagged "${tag}" (${filtered.length}):`];
    for (const mem of filtered.slice(0, 20)) {
      lines.push(`  ${mem.id}: ${mem.content.slice(0, 80)}`);
    }
    return lines.join('\n');
  }

  public delete(memoryId: string): string {
    const memory = this.memories.get(memoryId);
    if (!memory) return `Error: memory "${memoryId}" not found.`;

    // Clean up entities associated with this memory
    for (const entity of memory.entities) {
      this.entities.delete(entity);
    }

    // Clean up relations involving this memory
    this.relations = this.relations.filter(
      (r) => r.source !== memoryId && r.target !== memoryId,
    );

    this.memories.delete(memoryId);
    this.scheduleFlush();
    return `Memory "${memoryId}" deleted.`;
  }

  public getStats(): string {
    const categoryCounts: Record<string, number> = {};
    const tagCounts: Record<string, number> = {};
    let totalEntities = 0;

    for (const mem of this.memories.values()) {
      categoryCounts[mem.category] = (categoryCounts[mem.category] || 0) + 1;
      for (const tag of mem.tags) tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      totalEntities += mem.entities.length;
    }

    const topCategories = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([c, n]) => `    ${c}: ${n}`).join('\n');
    const topTags = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([t, n]) => `    ${t}: ${n}`).join('\n');

    return [
      `Byterover Memory Stats:`,
      `  Total memories: ${this.memories.size}/${this.MAX_MEMORIES}`,
      `  Total entities: ${this.entities.size}`,
      `  Total relations: ${this.relations.length}`,
      `  Avg entities per memory: ${this.memories.size > 0 ? (totalEntities / this.memories.size).toFixed(1) : 0}`,
      `  Top categories:\n${topCategories}`,
      `  Top tags:\n${topTags}`,
    ].join('\n');
  }

  private extractEntities(content: string): string[] {
    const entities: string[] = [];
    const capitalizedWords = content.match(/\b[A-Z][a-z]{2,}\b/g) || [];
    const stopNames = new Set(['The', 'This', 'That', 'What', 'When', 'Where', 'How', 'Why', 'Which', 'Who', 'And', 'But', 'For', 'Not', 'You', 'All', 'Can', 'Had', 'Her', 'Was', 'One', 'Our', 'Out', 'Day', 'Get', 'Has', 'Him', 'His', 'How', 'Its', 'May', 'New', 'Now', 'Old', 'See', 'Way', 'Who', 'Boy', 'Did', 'Does', 'Let', 'Put', 'Say', 'She', 'Too', 'Use']);

    for (const word of capitalizedWords) {
      if (!stopNames.has(word) && !entities.includes(word)) entities.push(word);
    }

    const quotedPhrases = content.match(/"([^"]+)"/g) || [];
    for (const phrase of quotedPhrases) {
      const clean = phrase.replace(/"/g, '').trim();
      if (clean.length > 2 && clean.length < 50 && !entities.includes(clean)) entities.push(clean);
    }

    return entities.slice(0, 15);
  }

  private extractRelations(content: string, entities: string[]): Array<{ source: string; target: string; type: string }> {
    const relations: Array<{ source: string; target: string; type: string }> = [];
    const lower = content.toLowerCase();

    const relationPatterns = [
      { pattern: /(\w+)\s+(?:uses|utilizes|employs)\s+(\w+)/i, type: 'uses' },
      { pattern: /(\w+)\s+(?:depends on|requires|needs)\s+(\w+)/i, type: 'depends_on' },
      { pattern: /(\w+)\s+(?:contains|includes|has)\s+(\w+)/i, type: 'contains' },
      { pattern: /(\w+)\s+(?:creates|generates|produces)\s+(\w+)/i, type: 'creates' },
      { pattern: /(\w+)\s+(?:sends|transmits|passes)\s+(\w+)/i, type: 'sends' },
      { pattern: /(\w+)\s+(?:is part of|belongs to|belongs in)\s+(\w+)/i, type: 'part_of' },
    ];

    for (const { pattern, type } of relationPatterns) {
      const match = lower.match(pattern);
      if (match) {
        const source = entities.find((e) => e.toLowerCase() === match[1]) || match[1];
        const target = entities.find((e) => e.toLowerCase() === match[2]) || match[2];
        if (source !== target) relations.push({ source, target, type });
      }
    }

    for (let i = 0; i < entities.length - 1; i++) {
      for (let j = i + 1; j < entities.length; j++) {
        const idxA = content.indexOf(entities[i]);
        const idxB = content.indexOf(entities[j]);
        if (idxA >= 0 && idxB >= 0 && Math.abs(idxA - idxB) < 100) {
          if (!relations.find((r) => r.source === entities[i] && r.target === entities[j])) {
            relations.push({ source: entities[i], target: entities[j], type: 'co_occurs' });
          }
        }
      }
    }

    return relations.slice(0, 10);
  }

  private categorizeContent(content: string): string {
    const lower = content.toLowerCase();
    const categories: Record<string, string[]> = {
      'code': ['function', 'class', 'import', 'export', 'const', 'let', 'var', 'return', 'async', 'await'],
      'config': ['config', 'setting', 'environment', 'env', 'option', 'parameter'],
      'decision': ['decided', 'chose', 'selected', 'picked', 'concluded', 'determined'],
      'learning': ['learned', 'discovered', 'found', 'realized', 'understood', 'figured'],
      'task': ['todo', 'task', 'need to', 'must', 'should', 'action', 'implement'],
      'bug': ['error', 'bug', 'issue', 'problem', 'fix', 'broken', 'fail', 'crash'],
      'documentation': ['document', 'readme', 'guide', 'tutorial', 'example', 'reference'],
    };

    let bestCategory = 'general';
    let bestScore = 0;

    for (const [category, keywords] of Object.entries(categories)) {
      let score = 0;
      for (const keyword of keywords) {
        if (lower.includes(keyword)) score++;
      }
      if (score > bestScore) {
        bestScore = score;
        bestCategory = category;
      }
    }

    return bestCategory;
  }

  private autoTag(content: string, entities: string[]): string[] {
    const tags: Set<string> = new Set();
    const lower = content.toLowerCase();

    if (lower.includes('typescript') || lower.includes('.ts')) tags.add('typescript');
    if (lower.includes('javascript') || lower.includes('.js')) tags.add('javascript');
    if (lower.includes('python') || lower.includes('.py')) tags.add('python');
    if (lower.includes('api') || lower.includes('endpoint')) tags.add('api');
    if (lower.includes('database') || lower.includes('sql') || lower.includes('query')) tags.add('database');
    if (lower.includes('test') || lower.includes('spec') || lower.includes('assert')) tags.add('testing');
    if (lower.includes('deploy') || lower.includes('ci/cd') || lower.includes('pipeline')) tags.add('devops');
    if (lower.includes('security') || lower.includes('auth') || lower.includes('token')) tags.add('security');
    if (lower.includes('performance') || lower.includes('optimize') || lower.includes('cache')) tags.add('performance');

    for (const entity of entities.slice(0, 3)) {
      tags.add(entity.toLowerCase());
    }

    return Array.from(tags).slice(0, 8);
  }

  private registerEntity(name: string): void {
    const existing = this.entities.get(name);
    if (existing) {
      existing.mentions++;
      existing.last_seen = new Date().toISOString();
    } else {
      this.entities.set(name, {
        name,
        type: this.guessEntityType(name),
        mentions: 1,
        first_seen: new Date().toISOString(),
        last_seen: new Date().toISOString(),
      });
    }
  }

  private guessEntityType(name: string): ByteroverEntity['type'] {
    const lower = name.toLowerCase();
    if (lower.includes('service') || lower.includes('tool') || lower.includes('engine')) return 'tool';
    if (lower.includes('project') || lower.includes('app') || lower.includes('system')) return 'project';
    if (lower.includes('team') || lower.includes('company') || lower.includes('corp')) return 'organization';
    if (lower.includes('meeting') || lower.includes('event') || lower.includes('conference')) return 'event';
    if (lower.includes('concept') || lower.includes('pattern') || lower.includes('principle')) return 'concept';
    return 'concept';
  }

  private registerRelation(source: string, target: string, type: string): void {
    const existing = this.relations.find((r) => r.source === source && r.target === target && r.type === type);
    if (existing) {
      existing.strength = Math.min(1, existing.strength + 0.1);
    } else {
      this.relations.push({ source, target, type, strength: 0.5, created_at: new Date().toISOString() });
    }
  }

  private evictOldest(): void {
    const sorted = Array.from(this.memories.entries()).sort((a, b) => new Date(a[1].created_at).getTime() - new Date(b[1].created_at).getTime());
    const toRemove = Math.max(1, Math.floor(this.MAX_MEMORIES * 0.1));
    for (let i = 0; i < toRemove && i < sorted.length; i++) {
      this.memories.delete(sorted[i][0]);
    }
  }
}
