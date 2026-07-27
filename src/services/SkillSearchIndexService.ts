/**
 * local skill search index — offline by default.
 * Scans installed skills, skill-sources paths, and optional install receipts.
 * No third-party product hubs; remote is opt-in via discovery layer.
 */

import fs from 'node:fs';
import path from 'node:path';
import { SkillIrNormalizerService } from '../skills/SkillIrNormalizerService.js';

export type SkillSearchDocument = {
  id: string;
  name: string;
  description: string;
  tools: string[];
  tags: string[];
  source: 'skills-dir' | 'skill-sources' | 'receipt' | 'registry';
  sourcePath: string | null;
  sourceUrl: string | null;
  installed: boolean;
  parserId: string | null;
  score: number;
};

export type SkillSearchIndexRuntime = {
  projectRoot?: string;
  skillsDir?: string;
  skillSourcesPath?: string;
  receiptsDir?: string;
  now?: () => Date;
  existsSync?: typeof fs.existsSync;
  readdirSync?: typeof fs.readdirSync;
  readFileSync?: typeof fs.readFileSync;
  statSync?: typeof fs.statSync;
};

type SkillSourceConfigFile = {
  sources?: Array<{
    id?: string;
    enabled?: boolean;
    path?: string;
    kind?: string;
    ingestionMode?: string;
    tags?: string[];
  }>;
};

export class SkillSearchIndexService {
  private readonly projectRoot: string;
  private readonly skillsDir: string;
  private readonly skillSourcesPath: string;
  private readonly receiptsDir: string;
  private readonly existsSync: typeof fs.existsSync;
  private readonly readdirSync: typeof fs.readdirSync;
  private readonly readFileSync: typeof fs.readFileSync;
  private readonly statSync: typeof fs.statSync;
  private readonly normalizer = new SkillIrNormalizerService();
  private cache: SkillSearchDocument[] | null = null;

  constructor(runtime: SkillSearchIndexRuntime = {}) {
    this.projectRoot = runtime.projectRoot || process.cwd();
    this.skillsDir = runtime.skillsDir || path.join(this.projectRoot, 'skills');
    this.skillSourcesPath = runtime.skillSourcesPath || path.join(this.projectRoot, 'config', 'skill-sources.json');
    this.receiptsDir = runtime.receiptsDir || path.join(this.projectRoot, 'data', 'runtime', 'skill-install-receipts');
    this.existsSync = runtime.existsSync || fs.existsSync.bind(fs);
    this.readdirSync = runtime.readdirSync || fs.readdirSync.bind(fs);
    this.readFileSync = runtime.readFileSync || fs.readFileSync.bind(fs);
    this.statSync = runtime.statSync || fs.statSync.bind(fs);
  }

  /** Drop cached documents (call after install). */
  public invalidate(): void {
    this.cache = null;
  }

  public listDocuments(): SkillSearchDocument[] {
    if (this.cache) return this.cache;
    const docs: SkillSearchDocument[] = [];
    const seen = new Set<string>();

    this.scanSkillTree(this.skillsDir, 'skills-dir', docs, seen, true);

    for (const root of this.resolveSkillSourceRoots()) {
      this.scanSkillTree(root, 'skill-sources', docs, seen, true);
    }

    this.scanReceipts(docs, seen);

    this.cache = docs;
    return docs;
  }

  /**
   * Deterministic local search. Empty query returns installed docs (capped).
   */
  public search(query: string, limit = 20): SkillSearchDocument[] {
    const started = Date.now();
    const q = String(query || '')
      .trim()
      .toLowerCase();
    const docs = this.listDocuments();
    const scored = docs.map((doc) => {
      if (!q) {
        return { ...doc, score: doc.installed ? 0.5 : 0.2 };
      }
      const blob = [doc.id, doc.name, doc.description, doc.tools.join(' '), doc.tags.join(' '), doc.parserId || '']
        .join(' ')
        .toLowerCase();
      const score =
        scoreText(q, blob) + (doc.installed ? 0.15 : 0) + (doc.tools.some((t) => t.toLowerCase() === q) ? 0.35 : 0);
      return { ...doc, score };
    });
    const out = scored
      .filter((d) => (q ? d.score > 0 : true))
      .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
      .slice(0, Math.max(1, Math.min(50, limit)));
    try {
      const { getSkillHotPathCache } =
        require('./SkillHotPathCacheService.js') as typeof import('./SkillHotPathCacheService.js');
      getSkillHotPathCache().recordSearchLatency(Date.now() - started);
    } catch {
      /* soft */
    }
    return out;
  }

  private resolveSkillSourceRoots(): string[] {
    const roots: string[] = [];
    if (!this.existsSync(this.skillSourcesPath)) return roots;
    try {
      const raw = JSON.parse(this.readFileSync(this.skillSourcesPath, 'utf8')) as SkillSourceConfigFile;
      for (const src of raw.sources || []) {
        if (src.enabled === false) continue;
        const p = String(src.path || '').trim();
        if (!p) continue;
        const abs = path.isAbsolute(p) ? p : path.join(this.projectRoot, p);
        if (this.existsSync(abs)) roots.push(abs);
      }
    } catch {
      /* soft */
    }
    return roots;
  }

  private scanSkillTree(
    root: string,
    source: SkillSearchDocument['source'],
    docs: SkillSearchDocument[],
    seen: Set<string>,
    installed: boolean,
  ): void {
    if (!this.existsSync(root)) return;
    const visit = (dir: string, depth: number) => {
      if (depth > 5) return;
      const skillMd = path.join(dir, 'SKILL.md');
      const manifest = path.join(dir, 'manifest.json');
      const hasPack =
        this.existsSync(skillMd) ||
        this.existsSync(manifest) ||
        this.existsSync(path.join(dir, 'README.md')) ||
        this.existsSync(path.join(dir, 'package.json'));
      if (hasPack && (this.existsSync(skillMd) || this.existsSync(manifest) || depth > 0)) {
        try {
          const ir = this.normalizer.normalizeFromDir({
            skillDir: dir,
            sourceUri: dir,
            sourceKind: 'local-path',
          });
          const id = ir.skillIr.id;
          if (id && !seen.has(id)) {
            seen.add(id);
            docs.push({
              id,
              name: ir.skillIr.title || id,
              description: ir.skillIr.description || '',
              tools: ir.skillIr.declaredTools.map((t) => t.name),
              tags: [],
              source,
              sourcePath: dir,
              sourceUrl: null,
              installed,
              parserId: ir.skillIr.parserId,
              score: 0,
            });
          }
        } catch {
          /* soft */
        }
        // Do not descend into a pack root
        if (this.existsSync(skillMd) || this.existsSync(manifest)) return;
      }
      let entries: fs.Dirent[];
      try {
        entries = this.readdirSync(dir, { withFileTypes: true });
      } catch {
        return;
      }
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        if (entry.name === 'node_modules' || entry.name === '.git') continue;
        visit(path.join(dir, entry.name), depth + 1);
      }
    };
    try {
      if (this.statSync(root).isDirectory()) visit(root, 0);
    } catch {
      /* soft */
    }
  }

  private scanReceipts(docs: SkillSearchDocument[], seen: Set<string>): void {
    if (!this.existsSync(this.receiptsDir)) return;
    let files: string[];
    try {
      files = this.readdirSync(this.receiptsDir).filter((f) => f.endsWith('.json'));
    } catch {
      return;
    }
    for (const f of files.slice(0, 200)) {
      try {
        const raw = JSON.parse(this.readFileSync(path.join(this.receiptsDir, f), 'utf8')) as {
          skillId?: string;
          status?: string;
          targetDir?: string | null;
          skillIr?: {
            title?: string;
            description?: string;
            declaredTools?: Array<{ name?: string }>;
            parserId?: string;
          };
          source?: { raw?: string };
        };
        if (raw.status !== 'applied' && raw.status !== 'partial') continue;
        const id = String(raw.skillId || '').trim();
        if (!id || seen.has(id)) continue;
        seen.add(id);
        docs.push({
          id,
          name: raw.skillIr?.title || id,
          description: raw.skillIr?.description || '',
          tools: (raw.skillIr?.declaredTools || []).map((t) => String(t.name || '')).filter(Boolean),
          tags: ['receipt'],
          source: 'receipt',
          sourcePath: raw.targetDir || null,
          sourceUrl: raw.source?.raw || null,
          installed: true,
          parserId: raw.skillIr?.parserId || null,
          score: 0,
        });
      } catch {
        /* skip */
      }
    }
  }
}

function scoreText(query: string, blob: string): number {
  const q = query.toLowerCase().trim();
  if (!q) return 0;
  if (blob.includes(q)) return 1;
  const tokens = q.split(/[^a-z0-9_./-]+/i).filter((t) => t.length > 1);
  if (!tokens.length) return 0;
  let hits = 0;
  for (const t of tokens) {
    if (blob.includes(t)) hits += 1;
  }
  return hits / tokens.length;
}
