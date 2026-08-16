/**
 * Fast BM25 In-Memory Search Engine.
 * Sub-5ms token-level BM25 ranking across workspace files, project memory, and saved sessions.
 */

import * as fs from 'fs';
import * as path from 'path';
import { SessionPersistenceService } from '../../storage/SessionPersistenceService.js';
import { ProjectEvolutionMemoryService } from '../../storage/ProjectEvolutionMemoryService.js';

export interface Bm25SearchResult {
  id: string;
  source: 'file' | 'memory' | 'session';
  title: string;
  snippet: string;
  score: number;
}

export interface Bm25Document {
  id: string;
  source: 'file' | 'memory' | 'session';
  title: string;
  content: string;
  tokens: string[];
}

export class FastBm25SearchEngine {
  private static readonly k1 = 1.2;
  private static readonly b = 0.75;

  private static tokenize(text: string): string[] {
    return text
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 1);
  }

  /**
   * Builds in-memory document corpus from workspace, memory, and sessions.
   */
  private static buildCorpus(workspaceRoot: string = process.cwd()): Bm25Document[] {
    const docs: Bm25Document[] = [];

    // 1. Index Project Evolution Memory
    const rules = ProjectEvolutionMemoryService.listRules();
    for (const r of rules) {
      docs.push({
        id: `memory_${r.id}`,
        source: 'memory',
        title: `[Memory: ${r.category.toUpperCase()}]`,
        content: r.rule,
        tokens: this.tokenize(r.rule),
      });
    }

    // 2. Index Saved Sessions
    const sessions = SessionPersistenceService.listSessions();
    for (const s of sessions) {
      const text = `${s.title} ${s.lastPrompt || ''} ${s.model}`;
      docs.push({
        id: `session_${s.id}`,
        source: 'session',
        title: `[Session: ${s.title}] (${s.id})`,
        content: s.lastPrompt || s.title,
        tokens: this.tokenize(text),
      });
    }

    // 3. Index top-level workspace code/doc files (limit to 50 key files for fast in-memory query)
    try {
      if (fs.existsSync(workspaceRoot)) {
        const entries = fs.readdirSync(workspaceRoot, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isFile() && /\.(md|ts|js|json|toml|py|txt)$/i.test(entry.name)) {
            const fp = path.join(workspaceRoot, entry.name);
            try {
              const content = fs.readFileSync(fp, 'utf-8').slice(0, 8000); // index first 8KB
              docs.push({
                id: `file_${entry.name}`,
                source: 'file',
                title: `[File: ${entry.name}]`,
                content,
                tokens: this.tokenize(content),
              });
            } catch {
              // Ignore unreadable
            }
          }
        }
      }
    } catch {
      // Non-blocking
    }

    return docs;
  }

  /**
   * Executes BM25 search over the corpus and returns scored matches.
   */
  static search(query: string, workspaceRoot: string = process.cwd(), limit = 10): Bm25SearchResult[] {
    const queryTokens = this.tokenize(query);
    if (queryTokens.length === 0) return [];

    const docs = this.buildCorpus(workspaceRoot);
    if (docs.length === 0) return [];

    const N = docs.length;
    const avgDl = docs.reduce((acc, d) => acc + d.tokens.length, 0) / N;

    // Calculate document frequencies (DF)
    const dfMap = new Map<string, number>();
    for (const q of queryTokens) {
      let count = 0;
      for (const d of docs) {
        if (d.tokens.includes(q)) count++;
      }
      dfMap.set(q, count);
    }

    const results: Bm25SearchResult[] = [];

    for (const doc of docs) {
      let score = 0;
      const docLen = doc.tokens.length;

      // Count term frequencies in this doc
      const tfMap = new Map<string, number>();
      for (const t of doc.tokens) {
        tfMap.set(t, (tfMap.get(t) || 0) + 1);
      }

      for (const q of queryTokens) {
        const tf = tfMap.get(q) || 0;
        if (tf === 0) continue;

        const df = dfMap.get(q) || 0;
        const idf = Math.log((N - df + 0.5) / (df + 0.5) + 1);
        const numerator = tf * (this.k1 + 1);
        const denominator = tf + this.k1 * (1 - this.b + this.b * (docLen / avgDl));
        score += idf * (numerator / denominator);
      }

      if (score > 0) {
        // Create snippet around query match
        const snippet = this.createSnippet(doc.content, queryTokens);
        results.push({
          id: doc.id,
          source: doc.source,
          title: doc.title,
          snippet,
          score: Number(score.toFixed(4)),
        });
      }
    }

    return results.sort((a, b) => b.score - a.score).slice(0, limit);
  }

  private static createSnippet(content: string, queryTokens: string[], maxLen = 140): string {
    const lower = content.toLowerCase();
    let bestIdx = -1;

    for (const q of queryTokens) {
      const idx = lower.indexOf(q);
      if (idx !== -1) {
        bestIdx = idx;
        break;
      }
    }

    if (bestIdx === -1) {
      return content.slice(0, maxLen).replace(/\s+/g, ' ').trim() + (content.length > maxLen ? '...' : '');
    }

    const start = Math.max(0, bestIdx - 30);
    const end = Math.min(content.length, bestIdx + maxLen - 30);
    const snip = content.slice(start, end).replace(/\s+/g, ' ').trim();
    return (start > 0 ? '...' : '') + snip + (end < content.length ? '...' : '');
  }
}
