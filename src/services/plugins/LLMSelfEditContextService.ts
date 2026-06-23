import fs from 'fs';
import path from 'path';

export interface ContextEntry {
  id: string;
  type: 'system' | 'user' | 'assistant' | 'tool' | 'memory' | 'fact';
  content: string;
  importance: number;
  tokens: number;
  created_at: string;
  last_accessed: string;
  access_count: number;
  editable: boolean;
}

export class LLMSelfEditContextService {
  private readonly storageDir: string;
  private context: ContextEntry[] = [];
  private readonly maxTokens: number;
  private editHistory: Array<{ action: string; entry_id: string; reason: string; timestamp: string }> = [];

  constructor(options?: { storageDir?: string; maxTokens?: number }) {
    this.storageDir = options?.storageDir || path.join(process.cwd(), 'data', 'runtime', 'context-edit');
    this.maxTokens = options?.maxTokens || 128000;
    if (!fs.existsSync(this.storageDir)) fs.mkdirSync(this.storageDir, { recursive: true });
  }

  public addEntry(type: ContextEntry['type'], content: string, importance: number = 0.5): string {
    const id = `ctx_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const tokens = this.estimateTokens(content);
    this.context.push({
      id, type, content, importance, tokens,
      created_at: new Date().toISOString(),
      last_accessed: new Date().toISOString(),
      access_count: 0,
      editable: type !== 'system',
    });
    this.autoEdit();
    return id;
  }

  public getContext(): ContextEntry[] {
    return [...this.context];
  }

  public getCompiledContext(): string {
    const sorted = [...this.context].sort((a, b) => {
      const sa = a.importance * (1 + a.access_count) * (a.type === 'system' ? 10 : 1);
      const sb = b.importance * (1 + b.access_count) * (b.type === 'system' ? 10 : 1);
      return sb - sa;
    });

    const lines: string[] = [];
    let totalTokens = 0;
    for (const entry of sorted) {
      if (totalTokens + entry.tokens > this.maxTokens) break;
      lines.push(entry.content);
      totalTokens += entry.tokens;
      entry.access_count++;
      entry.last_accessed = new Date().toISOString();
    }

    return lines.join('\n');
  }

  public editEntry(entryId: string, newContent: string): string {
    const entry = this.context.find((e) => e.id === entryId);
    if (!entry) return `Entry "${entryId}" not found.`;
    if (!entry.editable) return `Entry "${entryId}" is not editable (system entry).`;

    const oldTokens = entry.tokens;
    entry.content = newContent;
    entry.tokens = this.estimateTokens(newContent);
    entry.last_accessed = new Date().toISOString();

    this.editHistory.push({
      action: 'edit',
      entry_id: entryId,
      reason: `Content updated (${oldTokens} -> ${entry.tokens} tokens)`,
      timestamp: new Date().toISOString(),
    });

    this.autoEdit();
    return `Entry "${entryId}" edited. Tokens: ${oldTokens} -> ${entry.tokens}`;
  }

  public removeEntry(entryId: string): string {
    const index = this.context.findIndex((e) => e.id === entryId);
    if (index === -1) return `Entry "${entryId}" not found.`;
    if (!this.context[index].editable) return `Entry "${entryId}" is not removable (system entry).`;

    const removed = this.context.splice(index, 1)[0];
    this.editHistory.push({
      action: 'remove',
      entry_id: entryId,
      reason: `Removed: ${removed.content.slice(0, 50)}`,
      timestamp: new Date().toISOString(),
    });

    return `Entry "${entryId}" removed (${removed.tokens} tokens freed).`;
  }

  public summarize(entries: ContextEntry[]): string {
    if (entries.length === 0) return '';
    const topics = entries.map((e) => e.content.slice(0, 30)).join('; ');
    return `[Summary of ${entries.length} entries: ${topics.slice(0, 200)}]`;
  }

  public autoEdit(): void {
    const totalTokens = this.context.reduce((sum, e) => sum + e.tokens, 0);
    if (totalTokens <= this.maxTokens) return;

    const removable = this.context
      .filter((e) => e.editable && e.type !== 'system')
      .sort((a, b) => {
        const sa = a.importance * (1 + a.access_count);
        const sb = b.importance * (1 + b.access_count);
        return sa - sb;
      });

    let freed = 0;
    const needed = totalTokens - this.maxTokens;
    for (const entry of removable) {
      if (freed >= needed) break;
      this.context = this.context.filter((e) => e.id !== entry.id);
      freed += entry.tokens;
      this.editHistory.push({
        action: 'auto_remove',
        entry_id: entry.id,
        reason: `Auto-removed low-importance entry to free ${entry.tokens} tokens`,
        timestamp: new Date().toISOString(),
      });
    }
  }

  public getStats(): string {
    const totalTokens = this.context.reduce((sum, e) => sum + e.tokens, 0);
    const byType: Record<string, number> = {};
    for (const e of this.context) byType[e.type] = (byType[e.type] || 0) + 1;

    return [
      'Self-Edit Context Stats:',
      `  Entries: ${this.context.length}`,
      `  Tokens: ${totalTokens}/${this.maxTokens} (${((totalTokens / this.maxTokens) * 100).toFixed(1)}%)`,
      `  Edits: ${this.editHistory.length}`,
      '  By type:',
      ...Object.entries(byType).map(([t, c]) => `    ${t}: ${c}`),
    ].join('\n');
  }

  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }
}
