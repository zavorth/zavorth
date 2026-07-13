/**
 * Dominant discovery for skills + workers (brand-agnostic).
 *
 * - Skills: local registry + workspace skill dirs + optional remote (awaited)
 * - Ranking: relevance + trust + installed
 * - Install-from-URL detection in free text / clipboard-like strings
 * - Workers: scan workspace for bins / AGENTS.md / MCP configs; suggest register (preview)
 */

import fs from 'node:fs';
import path from 'node:path';
import { SkillLocalRegistry } from '../skills/marketplace/SkillLocalRegistry.js';
import {
  searchGitHubReposBroad,
} from '../skills/marketplace/SkillGitHubSearch.js';
import type { GitHubRepoInfo } from '../skills/marketplace/SkillPackageTypes.js';
import { detectSource } from '../skills/marketplace/SkillSourceDetector.js';
import { WorkerMeshService } from './WorkerMeshService.js';
import type { WorkerProfile } from '../contracts/skill/ZavorthSkillWorkerMeshContract.js';
import { SkillTrustScoreService } from './SkillTrustScoreService.js';

export type SkillDiscoveryHit = {
  kind: 'skill';
  id: string;
  name: string;
  description: string;
  source: 'local-registry' | 'workspace' | 'remote' | 'url';
  sourceUrl: string | null;
  installed: boolean;
  category: string;
  tags: string[];
  score: number;
  trustBand: string | null;
  installHint: string;
};

export type WorkerDiscoveryHit = {
  kind: 'worker-candidate';
  id: string;
  label: string;
  adapter: 'cli' | 'http' | 'mcp' | 'acp';
  command: string | null;
  endpoint: string | null;
  root: string | null;
  evidence: string[];
  score: number;
  alreadyRegistered: boolean;
  registerPreview: string;
};

export type SkillWorkerDiscoveryResult = {
  query: string;
  skills: SkillDiscoveryHit[];
  workers: WorkerDiscoveryHit[];
  registeredWorkers: Array<{
    id: string;
    label: string;
    adapter: string;
    health: string;
  }>;
  urlInstall: {
    detected: boolean;
    source: string | null;
    previewHint: string | null;
  };
  offline: boolean;
  formatText(): string;
};

export type SkillWorkerDiscoveryRuntime = {
  projectRoot?: string;
  skillsDir?: string;
  registry?: SkillLocalRegistry;
  mesh?: WorkerMeshService;
  trust?: SkillTrustScoreService;
  /** Inject for tests; default searchGitHubReposBroad */
  remoteSearch?: (query: string) => Promise<GitHubRepoInfo[]>;
  existsSync?: typeof fs.existsSync;
  readdirSync?: typeof fs.readdirSync;
  readFileSync?: typeof fs.readFileSync;
  statSync?: typeof fs.statSync;
};

const URL_IN_TEXT =
  /(?:https?:\/\/[^\s<>"']+|git@[^\s:]+:[^\s]+)/i;

export class SkillWorkerDiscoveryService {
  private readonly projectRoot: string;
  private readonly skillsDir: string;
  private readonly registry: SkillLocalRegistry;
  private readonly mesh: WorkerMeshService | null;
  private readonly trust: SkillTrustScoreService;
  private readonly remoteSearch: (query: string) => Promise<GitHubRepoInfo[]>;
  private readonly existsSync: typeof fs.existsSync;
  private readonly readdirSync: typeof fs.readdirSync;
  private readonly readFileSync: typeof fs.readFileSync;
  private readonly statSync: typeof fs.statSync;

  constructor(runtime: SkillWorkerDiscoveryRuntime = {}) {
    this.projectRoot = runtime.projectRoot || process.cwd();
    this.skillsDir = runtime.skillsDir || path.join(this.projectRoot, 'skills');
    this.registry = runtime.registry || new SkillLocalRegistry();
    this.mesh = runtime.mesh ?? null;
    this.trust =
      runtime.trust ||
      new SkillTrustScoreService({ projectRoot: this.projectRoot });
    this.remoteSearch = runtime.remoteSearch || ((q) => searchGitHubReposBroad(q));
    this.existsSync = runtime.existsSync || fs.existsSync.bind(fs);
    this.readdirSync = runtime.readdirSync || fs.readdirSync.bind(fs);
    this.readFileSync = runtime.readFileSync || fs.readFileSync.bind(fs);
    this.statSync = runtime.statSync || fs.statSync.bind(fs);
  }

  /**
   * Full discovery: skills (+ optional remote) and worker candidates.
   */
  public async discover(input: {
    query: string;
    remote?: boolean;
    includeWorkers?: boolean;
    scanWorkspace?: boolean;
    limit?: number;
  }): Promise<SkillWorkerDiscoveryResult> {
    const query = String(input.query || '').trim();
    const limit = Math.max(1, Math.min(50, input.limit || 15));
    const includeWorkers = input.includeWorkers !== false;
    const scanWorkspace = input.scanWorkspace !== false;
    const wantRemote = input.remote === true;

    const urlInstall = this.detectUrlInstall(query);
    const skillQuery = urlInstall.detected
      ? query.replace(URL_IN_TEXT, ' ').trim() || query
      : query;

    const skills = this.searchSkillsLocal(skillQuery, limit);
    let offline = true;

    if (wantRemote && skillQuery) {
      try {
        const remote = await this.remoteSearch(skillQuery);
        offline = false;
        for (const repo of remote) {
          const id = repo.fullName.replace(/\//g, '--');
          if (skills.some((s) => s.sourceUrl === repo.url || s.id === id)) continue;
          const relevance = textScore(
            skillQuery,
            `${repo.fullName} ${repo.description}`,
          );
          const score =
            relevance * 0.55 +
            Math.min(0.25, Math.log10((repo.stars || 0) + 1) / 20) +
            0.05;
          skills.push({
            kind: 'skill',
            id,
            name: repo.fullName,
            description: repo.description || '',
            source: 'remote',
            sourceUrl: repo.url,
            installed: false,
            category: 'other',
            tags: [],
            score,
            trustBand: 'review',
            installHint: `zavorth skill preview ${repo.url}  →  install --consent`,
          });
        }
      } catch {
        offline = true;
      }
    }

    if (urlInstall.detected && urlInstall.source) {
      skills.unshift({
        kind: 'skill',
        id: `url:${hashId(urlInstall.source)}`,
        name: 'URL install candidate',
        description: `Detected installable source in query: ${urlInstall.source}`,
        source: 'url',
        sourceUrl: urlInstall.source,
        installed: false,
        category: 'other',
        tags: ['url'],
        score: 1,
        trustBand: null,
        installHint: `zavorth skill preview ${urlInstall.source}`,
      });
    }

    skills.sort((a, b) => b.score - a.score);
    const topSkills = skills.slice(0, limit);

    let workers: WorkerDiscoveryHit[] = [];
    if (includeWorkers && scanWorkspace) {
      workers = this.scanWorkerCandidates(skillQuery || query, limit);
    }

    const registeredWorkers = (this.mesh?.listWorkers() || []).map((w) => ({
      id: w.id,
      label: w.label,
      adapter: w.adapter,
      health: w.health.status,
    }));

    // Filter registered by query if present
    const registeredFiltered =
      query && !urlInstall.detected
        ? registeredWorkers.filter((w) =>
            textScore(query, `${w.id} ${w.label} ${w.adapter}`) > 0,
          )
        : registeredWorkers;

    const result: SkillWorkerDiscoveryResult = {
      query,
      skills: topSkills,
      workers: workers.slice(0, limit),
      registeredWorkers: registeredFiltered.slice(0, limit),
      urlInstall,
      offline: wantRemote ? offline : true,
      formatText: () => formatDiscoveryText(result),
    };
    return result;
  }

  /** Local-only sync helper for CLI/tests. */
  public searchSkillsLocal(query: string, limit = 15): SkillDiscoveryHit[] {
    const q = String(query || '').trim().toLowerCase();
    const hits: SkillDiscoveryHit[] = [];
    const seen = new Set<string>();

    // Registry (empty query → list all)
    const regEntries = this.registry.search(q || '');

    for (const e of regEntries || []) {
      const entry = e as {
        id: string;
        name?: string;
        description?: string;
        sourceUrl?: string | null;
        installedAt?: string | null;
        category?: string;
        tags?: string[];
        trustLevel?: string;
        author?: string;
      };
      const id = String(entry.id || entry.name || '');
      if (!id || seen.has(id)) continue;
      seen.add(id);
      const blob = `${entry.name || ''} ${entry.description || ''} ${(entry.tags || []).join(' ')} ${entry.category || ''} ${entry.author || ''}`;
      const relevance = q ? textScore(q, blob) : 0.3;
      if (q && relevance <= 0) continue;
      const installed = Boolean(entry.installedAt);
      const score =
        relevance * 0.5 +
        (installed ? 0.25 : 0) +
        trustLevelBoost(entry.trustLevel) +
        0.1;
      hits.push({
        kind: 'skill',
        id,
        name: String(entry.name || id),
        description: String(entry.description || ''),
        source: 'local-registry',
        sourceUrl: entry.sourceUrl || null,
        installed,
        category: String(entry.category || 'other'),
        tags: Array.isArray(entry.tags) ? entry.tags.map(String) : [],
        score,
        trustBand: entry.trustLevel || null,
        installHint: installed
          ? `already installed: ${id}`
          : entry.sourceUrl
            ? `zavorth skill preview ${entry.sourceUrl}`
            : `zavorth skill info ${id}`,
      });
    }

    // Workspace skills/ dir
    for (const hit of this.scanWorkspaceSkills(q)) {
      if (seen.has(hit.id)) continue;
      seen.add(hit.id);
      hits.push(hit);
    }

    hits.sort((a, b) => b.score - a.score);
    return hits.slice(0, limit);
  }

  public scanWorkerCandidates(query: string, limit = 15): WorkerDiscoveryHit[] {
    const q = String(query || '').trim().toLowerCase();
    const hits: WorkerDiscoveryHit[] = [];
    const registered = new Set((this.mesh?.listWorkers() || []).map((w) => w.id));

    const roots = [
      this.projectRoot,
      path.join(this.projectRoot, 'apps'),
      path.join(this.projectRoot, 'packages'),
    ].filter((r) => this.existsSync(r));

    for (const root of roots) {
      this.walkForWorkers(root, 0, 2, hits, registered, q);
      if (hits.length >= limit * 2) break;
    }

    // MCP config hints at project root
    for (const mcpFile of [
      path.join(this.projectRoot, '.mcp.json'),
      path.join(this.projectRoot, 'mcp.json'),
      path.join(this.projectRoot, '.zavorth', 'mcp.json'),
    ]) {
      if (!this.existsSync(mcpFile)) continue;
      try {
        const raw = JSON.parse(this.readFileSync(mcpFile, 'utf8')) as {
          mcpServers?: Record<string, { command?: string; url?: string }>;
        };
        const servers = raw.mcpServers || {};
        for (const [name, cfg] of Object.entries(servers)) {
          const id = `mcp-${name}`.toLowerCase().replace(/[^a-z0-9-]/g, '-');
          if (q && textScore(q, `${name} mcp ${cfg.command || cfg.url || ''}`) <= 0) continue;
          hits.push({
            kind: 'worker-candidate',
            id,
            label: 'MCP worker',
            adapter: cfg.url ? 'http' : 'mcp',
            command: cfg.command || null,
            endpoint: cfg.url || null,
            root: path.dirname(mcpFile),
            evidence: [`MCP config ${path.basename(mcpFile)} server=${name}`],
            score: 0.7 + (q ? textScore(q, name) : 0.1),
            alreadyRegistered: registered.has(id),
            registerPreview: cfg.url
              ? `agent_manager register target=${cfg.url} id=${id} (preview — dry until approval)`
              : `agent_manager register target=${cfg.command || name} id=${id} adapter=mcp (preview)`,
          });
        }
      } catch {
        /* soft */
      }
    }

    hits.sort((a, b) => b.score - a.score);
    return hits.slice(0, limit);
  }

  public detectUrlInstall(text: string): {
    detected: boolean;
    source: string | null;
    previewHint: string | null;
  } {
    const m = String(text || '').match(URL_IN_TEXT);
    if (!m) {
      return { detected: false, source: null, previewHint: null };
    }
    const source = m[0].replace(/[),.;]+$/, '');
    const detected = detectSource(source);
    if (
      detected.type === 'unknown' &&
      !source.startsWith('http') &&
      !source.startsWith('git@')
    ) {
      return { detected: false, source: null, previewHint: null };
    }
    return {
      detected: true,
      source,
      previewHint: `zavorth skill preview ${source}`,
    };
  }

  // ---------------------------------------------------------------------------

  private scanWorkspaceSkills(q: string): SkillDiscoveryHit[] {
    const hits: SkillDiscoveryHit[] = [];
    if (!this.existsSync(this.skillsDir)) return hits;

    let dirs: string[] = [];
    try {
      dirs = this.readdirSync(this.skillsDir, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name);
    } catch {
      return hits;
    }

    for (const name of dirs) {
      const dir = path.join(this.skillsDir, name);
      const skillMd = path.join(dir, 'SKILL.md');
      const manifestPath = path.join(dir, 'manifest.json');
      if (!this.existsSync(skillMd) && !this.existsSync(manifestPath)) continue;

      let description = '';
      let tags: string[] = [];
      let category = 'other';
      let author = '';
      if (this.existsSync(manifestPath)) {
        try {
          const m = JSON.parse(this.readFileSync(manifestPath, 'utf8')) as {
            description?: string;
            tags?: string[];
            category?: string;
            author?: string;
            name?: string;
          };
          description = String(m.description || '');
          tags = Array.isArray(m.tags) ? m.tags.map(String) : [];
          category = String(m.category || 'other');
          author = String(m.author || '');
        } catch {
          /* soft */
        }
      }
      const blob = `${name} ${description} ${tags.join(' ')} ${category} ${author}`;
      const relevance = q ? textScore(q, blob) : 0.4;
      if (q && relevance <= 0) continue;

      hits.push({
        kind: 'skill',
        id: name,
        name,
        description,
        source: 'workspace',
        sourceUrl: null,
        installed: true,
        category,
        tags,
        score: relevance * 0.5 + 0.35,
        trustBand: author.toLowerCase().includes('zavorth') ? 'allow' : 'review',
        installHint: `workspace skill already present: skills/${name}`,
      });
    }
    return hits;
  }

  private walkForWorkers(
    dir: string,
    depth: number,
    maxDepth: number,
    hits: WorkerDiscoveryHit[],
    registered: Set<string>,
    q: string,
  ): void {
    if (depth > maxDepth) return;
    let entries: fs.Dirent[];
    try {
      entries = this.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    const base = path.basename(dir);
    if (['node_modules', '.git', 'dist', 'coverage'].includes(base)) return;

    const pkgPath = path.join(dir, 'package.json');
    if (this.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(this.readFileSync(pkgPath, 'utf8')) as {
          name?: string;
          bin?: string | Record<string, string>;
          description?: string;
        };
        const bin = pkg.bin;
        const binEntries =
          typeof bin === 'string'
            ? { [pkg.name || base]: bin }
            : bin && typeof bin === 'object'
              ? bin
              : {};
        for (const binName of Object.keys(binEntries)) {
          const id = binName.toLowerCase().replace(/[^a-z0-9-]/g, '-') || base;
          if (q && textScore(q, `${binName} ${pkg.description || ''} cli`) <= 0 && q.length > 1) {
            continue;
          }
          hits.push({
            kind: 'worker-candidate',
            id,
            label: 'CLI worker',
            adapter: 'cli',
            command: binName,
            endpoint: null,
            root: dir,
            evidence: [`package.json bin in ${path.relative(this.projectRoot, dir) || '.'}`],
            score: 0.65 + (q ? textScore(q, binName) : 0.1),
            alreadyRegistered: registered.has(id),
            registerPreview: `agent_manager register target=${dir} (or command=${binName}) — preview until approval`,
          });
        }
      } catch {
        /* soft */
      }
    }

    for (const marker of ['AGENTS.md', 'IDENTITY.md', 'SOUL.md']) {
      if (this.existsSync(path.join(dir, marker))) {
        const id = base.toLowerCase().replace(/[^a-z0-9-]/g, '-') || 'agent-project';
        if (!q || textScore(q, `${base} agent ${marker}`) > 0 || q.length <= 1) {
          hits.push({
            kind: 'worker-candidate',
            id,
            label: 'Agent project',
            adapter: 'cli',
            command: null,
            endpoint: null,
            root: dir,
            evidence: [`Found ${marker}`],
            score: 0.6,
            alreadyRegistered: registered.has(id),
            registerPreview: `agent_manager register target=${dir} — structural agent home (preview)`,
          });
        }
        break;
      }
    }

    if (depth >= maxDepth) return;
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      this.walkForWorkers(
        path.join(dir, entry.name),
        depth + 1,
        maxDepth,
        hits,
        registered,
        q,
      );
    }
  }
}

function textScore(query: string, text: string): number {
  const q = query.toLowerCase().trim();
  const t = text.toLowerCase();
  if (!q) return 0.2;
  if (t.includes(q)) return 1;
  const parts = q.split(/\s+/).filter((p) => p.length > 1);
  if (parts.length === 0) return 0;
  let hit = 0;
  for (const p of parts) {
    if (t.includes(p)) hit += 1;
  }
  return hit / parts.length;
}

function trustLevelBoost(level: string | undefined): number {
  switch (String(level || '').toLowerCase()) {
    case 'verified':
    case 'trusted':
      return 0.2;
    case 'community':
      return 0.05;
    default:
      return 0;
  }
}

function hashId(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36).slice(0, 10);
}

function formatDiscoveryText(r: SkillWorkerDiscoveryResult): string {
  const lines = [
    `Discovery for "${r.query || '(all)'}"${r.offline ? ' [offline/local]' : ' [remote+local]'}`,
    '',
    `Skills (${r.skills.length}):`,
  ];
  if (r.skills.length === 0) {
    lines.push('  (none)');
  } else {
    for (const s of r.skills.slice(0, 12)) {
      lines.push(
        `  - [${s.source}] ${s.name} score=${s.score.toFixed(2)}${s.installed ? ' [installed]' : ''}`,
      );
      if (s.description) lines.push(`      ${s.description.slice(0, 120)}`);
      lines.push(`      ${s.installHint}`);
    }
  }

  if (r.urlInstall.detected) {
    lines.push('', `URL install detected: ${r.urlInstall.source}`);
    lines.push(`  ${r.urlInstall.previewHint}`);
  }

  lines.push('', `Worker candidates (${r.workers.length}):`);
  if (r.workers.length === 0) {
    lines.push('  (none in workspace scan)');
  } else {
    for (const w of r.workers.slice(0, 10)) {
      lines.push(
        `  - ${w.id} [${w.adapter}] ${w.label}${w.alreadyRegistered ? ' [registered]' : ''}`,
      );
      lines.push(`      ${w.registerPreview}`);
      lines.push(`      evidence: ${w.evidence.join('; ')}`);
    }
  }

  lines.push('', `Registered workers (${r.registeredWorkers.length}):`);
  if (r.registeredWorkers.length === 0) {
    lines.push('  (none — internal:* always via agent_manager workers)');
  } else {
    for (const w of r.registeredWorkers.slice(0, 10)) {
      lines.push(`  - ${w.id} [${w.adapter}] health=${w.health}`);
    }
  }

  lines.push(
    '',
    'Journeys: (1) skill URL → preview → install --consent  (2) worker path → register → health → invoke dry-run  (3) route task → local tools or worker',
  );
  return lines.join('\n');
}
