import { asErrorLike } from '../utils/errorLike';
/**
 * Universal Workspace Import
 *
 * Imports identity, memory, skills, plugins, and config from *any* local
 * agent/workspace home using structural fingerprints only.
 *
 * No third-party product names. Profiles are structural shapes:
 * identity-markdown-home, skill-centric-home, memory-centric-home, etc.
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import type {
  CapabilityFabricRiskLevel,
  UniversalWorkspaceImportItem,
  UniversalWorkspaceImportItemKind,
  UniversalWorkspaceImportReceipt,
  UniversalWorkspaceImportSnapshot,
  UniversalWorkspaceProfileId,
  UniversalWorkspaceSignal,
  UniversalWorkspaceSignalId,
} from '../contracts/UniversalCapabilityFabricContract.js';

export type UniversalWorkspaceImportInput = {
  sourcePath: string;
  apply?: boolean;
  consent?: boolean;
  overwrite?: boolean;
  includeSecretLike?: boolean;
  projectRoot?: string;
  targetRoot?: string;
};

type Runtime = {
  projectRoot?: string;
  now?: () => Date;
  existsSync?: typeof fs.existsSync;
  mkdirSync?: typeof fs.mkdirSync;
  readdirSync?: typeof fs.readdirSync;
  statSync?: typeof fs.statSync;
  readFileSync?: typeof fs.readFileSync;
  writeFileSync?: typeof fs.writeFileSync;
  copyFileSync?: typeof fs.copyFileSync;
  cpSync?: typeof fs.cpSync;
};

const SECRET_LIKE = [
  /api[_-]?key/i,
  /secret/i,
  /token/i,
  /password/i,
  /credential/i,
  /BEGIN (RSA |OPENSSH )?PRIVATE KEY/i,
  /sk-[a-z0-9]{10,}/i,
];

const SIGNAL_SPECS: Array<{
  id: UniversalWorkspaceSignalId;
  rel: string;
  weight: number;
  dir?: boolean;
}> = [
  { id: 'identity_markdown', rel: 'IDENTITY.md', weight: 3 },
  { id: 'soul_markdown', rel: 'SOUL.md', weight: 3 },
  { id: 'user_markdown', rel: 'USER.md', weight: 2 },
  { id: 'agents_markdown', rel: 'AGENTS.md', weight: 2 },
  { id: 'memory_markdown', rel: 'MEMORY.md', weight: 2 },
  { id: 'tools_markdown', rel: 'TOOLS.md', weight: 1 },
  { id: 'rules_markdown', rel: 'RULES.md', weight: 1 },
  { id: 'memory_directory', rel: 'memory', weight: 3, dir: true },
  { id: 'memory_directory', rel: 'memories', weight: 3, dir: true },
  { id: 'skills_directory', rel: 'skills', weight: 3, dir: true },
  { id: 'skill_library_directory', rel: 'skill-library', weight: 3, dir: true },
  { id: 'plugins_directory', rel: 'plugins', weight: 2, dir: true },
  { id: 'config_directory', rel: 'config', weight: 2, dir: true },
  { id: 'config_json', rel: 'config.json', weight: 2 },
  { id: 'config_yaml', rel: 'config.yaml', weight: 2 },
  { id: 'config_yaml', rel: 'config.yml', weight: 2 },
  { id: 'workspace_json', rel: 'workspace.json', weight: 2 },
  { id: 'package_manifest', rel: 'package.json', weight: 1 },
  { id: 'mcp_manifest', rel: 'mcp.json', weight: 2 },
  { id: 'mcp_manifest', rel: 'mcp-servers.json', weight: 2 },
];

export class UniversalWorkspaceImportService {
  private readonly projectRoot: string;
  private readonly now: () => Date;
  private readonly existsSync: typeof fs.existsSync;
  private readonly mkdirSync: typeof fs.mkdirSync;
  private readonly readdirSync: typeof fs.readdirSync;
  private readonly statSync: typeof fs.statSync;
  private readonly readFileSync: typeof fs.readFileSync;
  private readonly writeFileSync: typeof fs.writeFileSync;
  private readonly copyFileSync: typeof fs.copyFileSync;
  private readonly cpSync: typeof fs.cpSync;

  constructor(runtime: Runtime = {}) {
    this.projectRoot = runtime.projectRoot || process.cwd();
    this.now = runtime.now || (() => new Date());
    this.existsSync = runtime.existsSync || fs.existsSync.bind(fs);
    this.mkdirSync = runtime.mkdirSync || fs.mkdirSync.bind(fs);
    this.readdirSync = runtime.readdirSync || fs.readdirSync.bind(fs);
    this.statSync = runtime.statSync || fs.statSync.bind(fs);
    this.readFileSync = runtime.readFileSync || fs.readFileSync.bind(fs);
    this.writeFileSync = runtime.writeFileSync || fs.writeFileSync.bind(fs);
    this.copyFileSync = runtime.copyFileSync || fs.copyFileSync.bind(fs);
    this.cpSync = runtime.cpSync || fs.cpSync.bind(fs);
  }

  public buildSnapshot(input: UniversalWorkspaceImportInput): UniversalWorkspaceImportSnapshot {
    const apply = input.apply === true;
    const sourcePath = path.resolve(input.sourcePath || '');
    const targetRoot = path.resolve(
      input.targetRoot || path.join(this.projectRoot, '.zavorth', 'workspace-imports', path.basename(sourcePath) || 'workspace'),
    );
    const warnings: string[] = [];
    const receipts: UniversalWorkspaceImportReceipt[] = [];

    if (!sourcePath || !this.existsSync(sourcePath)) {
      return this.blocked(sourcePath, targetRoot, apply, `Source workspace not found: ${sourcePath || '(empty)'}`);
    }

    const signals = this.collectSignals(sourcePath);
    // also detect hidden agent-home style dirs by presence of common markdown + skills
    const profileId = this.profileFromSignals(signals);
    const confidence = this.confidenceFromSignals(signals);
    const items = this.planItems(sourcePath, targetRoot, signals, warnings);

    let copied = 0;
    let skipped = 0;
    let denied = 0;

    for (const item of items) {
      item.status = 'previewed';
      if (item.secretLike && input.includeSecretLike !== true) {
        item.status = 'denied';
        item.reason = 'Secret-like content held; pass includeSecretLike with explicit consent to import refs only.';
        denied += 1;
        receipts.push(this.receipt('deny', item, item.reason));
        continue;
      }

      if (!apply) {
        receipts.push(this.receipt('preview', item, 'Preview only — no files copied.'));
        continue;
      }

      if (apply && input.consent !== true) {
        item.status = 'denied';
        item.reason = 'Apply requires explicit consent.';
        denied += 1;
        receipts.push(this.receipt('deny', item, item.reason));
        continue;
      }

      try {
        const parent = path.dirname(item.targetPath);
        this.mkdirSync(parent, { recursive: true });
        if (this.existsSync(item.targetPath) && input.overwrite !== true) {
          item.status = 'skipped';
          item.reason = 'Target exists; use overwrite to replace.';
          skipped += 1;
          receipts.push(this.receipt('skip', item, item.reason));
          continue;
        }
        const stat = this.statSync(item.sourcePath);
        if (stat.isDirectory()) {
          this.cpSync(item.sourcePath, item.targetPath, { recursive: true });
        } else {
          this.copyFileSync(item.sourcePath, item.targetPath);
        }
        item.status = 'copied';
        copied += 1;
        receipts.push(this.receipt('import', item, `Imported ${item.kind} → ${item.targetPath}`));
      } catch (error: unknown) {
        const err = asErrorLike(error);
        item.status = 'error';
        item.reason = error instanceof Error ? err.message : String(error);
        denied += 1;
        receipts.push(this.receipt('deny', item, item.reason));
      }
    }

    // Write import map receipt
    if (apply && input.consent === true) {
      this.mkdirSync(targetRoot, { recursive: true });
      this.writeFileSync(
        path.join(targetRoot, 'IMPORT_MAP.json'),
        JSON.stringify({
          importedAt: this.now().toISOString(),
          sourcePath,
          profileId,
          confidence,
          itemCount: items.length,
          copied,
        }, null, 2),
        'utf8',
      );
    }

    const summary = {
      items: items.length,
      secretLike: items.filter((i) => i.secretLike).length,
      skills: items.filter((i) => i.kind === 'skill').length,
      memory: items.filter((i) => i.kind === 'memory').length,
      config: items.filter((i) => i.kind === 'config').length,
      plugins: items.filter((i) => i.kind === 'plugin').length,
      copied,
      skipped,
      denied,
    };

    const status: UniversalWorkspaceImportSnapshot['status'] = !apply
      ? 'preview-only'
      : copied > 0 && denied === 0
        ? 'passed'
        : copied > 0
          ? 'partial'
          : items.length === 0
            ? 'blocked'
            : 'blocked';

    return {
      contractVersion: 'zavorth-universal-workspace-import/v1',
      generatedAt: this.now().toISOString(),
      status,
      apply,
      sourcePath,
      profileId,
      confidence,
      signals,
      items,
      receipts,
      warnings,
      summary,
      policy: {
        brandAgnostic: true,
        structuralDetectionOnly: true,
        previewBeforeApply: true,
        secretLikeNeverAutoImported: true,
        rawSecretsSerialized: false,
      },
      narrative: {
        headline: apply ? `Workspace import ${status}` : 'Workspace import preview',
        operatorSummary: `Profile ${profileId} (${Math.round(confidence * 100)}% confidence). ${items.length} item(s): ${summary.skills} skills, ${summary.memory} memory, ${summary.config} config.`,
        nextSafeAction: apply
          ? 'Review IMPORT_MAP.json and enable absorbed skills/plugins through governed actions.'
          : 'Re-run with --apply --consent after reviewing the preview.',
      },
    };
  }

  public detect(sourcePath: string): {
    path: string;
    profileId: UniversalWorkspaceProfileId;
    confidence: number;
    signals: UniversalWorkspaceSignal[];
  } | null {
    const resolved = path.resolve(sourcePath || '');
    if (!resolved || !this.existsSync(resolved)) return null;
    const signals = this.collectSignals(resolved);
    return {
      path: resolved,
      profileId: this.profileFromSignals(signals),
      confidence: this.confidenceFromSignals(signals),
      signals,
    };
  }

  public detectFromHomeHints(hint?: string): {
    path: string;
    profileId: UniversalWorkspaceProfileId;
    confidence: number;
    signals: UniversalWorkspaceSignal[];
  } | null {
    const home = process.env.USERPROFILE || process.env.HOME || '';
    const names = hint
      ? [hint, `.${hint}`]
      : ['.zavorth', 'agent-home', 'agent', 'workspace', '.agent', '.config/agent'];
    const roots = [
      process.cwd(),
      home,
      path.join(home, '.config'),
      path.join(home, 'AppData', 'Roaming'),
      path.join(home, '.local', 'share'),
    ].filter(Boolean);

    let best: ReturnType<UniversalWorkspaceImportService['detect']> = null;
    for (const root of roots) {
      for (const name of names) {
        const candidate = path.join(root, name);
        const detected = this.detect(candidate);
        if (!detected) continue;
        if (!best || detected.confidence > best.confidence) best = detected;
      }
    }
    return best;
  }

  private collectSignals(sourcePath: string): UniversalWorkspaceSignal[] {
    const byId = new Map<UniversalWorkspaceSignalId, UniversalWorkspaceSignal>();
    for (const spec of SIGNAL_SPECS) {
      const full = path.join(sourcePath, spec.rel);
      const present = this.existsSync(full) && (
        spec.dir ? this.safeIsDir(full) : this.safeIsFile(full)
      );
      const existing = byId.get(spec.id);
      if (present) {
        byId.set(spec.id, {
          id: spec.id,
          present: true,
          path: full,
          weight: Math.max(existing?.weight || 0, spec.weight),
        });
      } else if (!existing) {
        byId.set(spec.id, {
          id: spec.id,
          present: false,
          path: null,
          weight: spec.weight,
        });
      }
    }

    // Dot agent-home: any directory starting with "." that contains skills or identity files
    try {
      for (const entry of this.readdirSync(sourcePath, { withFileTypes: true }) as fs.Dirent[]) {
        if (!entry.isDirectory() || !entry.name.startsWith('.')) continue;
        const nested = path.join(sourcePath, entry.name);
        if (
          this.existsSync(path.join(nested, 'skills'))
          || this.existsSync(path.join(nested, 'SOUL.md'))
          || this.existsSync(path.join(nested, 'IDENTITY.md'))
        ) {
          byId.set('dot_agent_home', {
            id: 'dot_agent_home',
            present: true,
            path: nested,
            weight: 2,
          });
        }
      }
    } catch {
      // ignore
    }
    if (!byId.has('dot_agent_home')) {
      byId.set('dot_agent_home', { id: 'dot_agent_home', present: false, path: null, weight: 2 });
    }

    return [...byId.values()];
  }

  private profileFromSignals(signals: UniversalWorkspaceSignal[]): UniversalWorkspaceProfileId {
    const on = (id: UniversalWorkspaceSignalId) => signals.some((s) => s.id === id && s.present);
    const skillScore = (on('skills_directory') ? 2 : 0) + (on('skill_library_directory') ? 2 : 0);
    const memoryScore = (on('memory_directory') ? 2 : 0) + (on('memory_markdown') ? 1 : 0);
    const identityScore = (on('identity_markdown') ? 1 : 0) + (on('soul_markdown') ? 1 : 0) + (on('agents_markdown') ? 1 : 0) + (on('user_markdown') ? 1 : 0);
    const configScore = (on('config_directory') ? 1 : 0) + (on('config_json') ? 1 : 0) + (on('config_yaml') ? 1 : 0) + (on('workspace_json') ? 1 : 0);
    const pluginScore = (on('plugins_directory') ? 2 : 0) + (on('mcp_manifest') ? 1 : 0);

    const scores: Array<{ id: UniversalWorkspaceProfileId; score: number }> = [
      { id: 'skill-centric-home', score: skillScore },
      { id: 'memory-centric-home', score: memoryScore },
      { id: 'identity-markdown-home', score: identityScore },
      { id: 'config-centric-home', score: configScore },
      { id: 'plugin-centric-home', score: pluginScore },
    ];
    scores.sort((a, b) => b.score - a.score);
    const top = scores[0];
    const presentCount = signals.filter((s) => s.present).length;
    if (!top || top.score === 0) return 'opaque-or-empty';
    if (presentCount >= 4 && scores.filter((s) => s.score > 0).length >= 2) return 'mixed-agent-home';
    return top.id;
  }

  private confidenceFromSignals(signals: UniversalWorkspaceSignal[]): number {
    const totalWeight = signals.reduce((sum, s) => sum + s.weight, 0) || 1;
    const hitWeight = signals.filter((s) => s.present).reduce((sum, s) => sum + s.weight, 0);
    return Math.max(0, Math.min(1, hitWeight / totalWeight));
  }

  private planItems(
    sourcePath: string,
    targetRoot: string,
    signals: UniversalWorkspaceSignal[],
    warnings: string[],
  ): UniversalWorkspaceImportItem[] {
    const items: UniversalWorkspaceImportItem[] = [];
    const seen = new Set<string>();

    const addFile = (
      kind: UniversalWorkspaceImportItemKind,
      name: string,
      source: string,
      targetRel: string,
      risk: CapabilityFabricRiskLevel = 'low',
    ) => {
      if (!this.existsSync(source) || seen.has(source)) return;
      seen.add(source);
      const secretLike = this.isSecretLike(source);
      if (secretLike) warnings.push(`${name} looks secret-like and will not auto-import.`);
      items.push({
        id: `${kind}:${this.safeId(name)}`,
        kind,
        name,
        sourcePath: source,
        targetPath: path.join(targetRoot, targetRel),
        risk: secretLike ? 'critical' : risk,
        secretLike,
        status: 'pending',
      });
    };

    const addDirFiles = (
      kind: UniversalWorkspaceImportItemKind,
      dir: string,
      targetRel: string,
      risk: CapabilityFabricRiskLevel,
      limit = 80,
    ) => {
      if (!this.existsSync(dir) || !this.safeIsDir(dir)) return;
      let count = 0;
      const stack = [dir];
      while (stack.length && count < limit) {
        const current = stack.pop()!;
        let entries: fs.Dirent[] = [];
        try {
          entries = this.readdirSync(current, { withFileTypes: true }) as fs.Dirent[];
        } catch {
          continue;
        }
        for (const entry of entries) {
          if (entry.name === 'node_modules' || entry.name === '.git') continue;
          const full = path.join(current, entry.name);
          if (entry.isDirectory()) {
            stack.push(full);
            continue;
          }
          const rel = path.relative(dir, full);
          addFile(kind, rel, full, path.join(targetRel, rel), risk);
          count += 1;
          if (count >= limit) break;
        }
      }
    };

    for (const signal of signals.filter((s) => s.present && s.path)) {
      switch (signal.id) {
        case 'identity_markdown':
        case 'soul_markdown':
        case 'user_markdown':
        case 'agents_markdown':
        case 'tools_markdown':
        case 'rules_markdown':
          addFile('identity', path.basename(signal.path!), signal.path!, path.join('identity', path.basename(signal.path!)));
          break;
        case 'memory_markdown':
          addFile('memory', path.basename(signal.path!), signal.path!, path.join('memory', path.basename(signal.path!)));
          break;
        case 'memory_directory':
          addDirFiles('memory', signal.path!, 'memory/files', 'low');
          break;
        case 'skills_directory':
        case 'skill_library_directory':
          addDirFiles('skill', signal.path!, 'skills', 'medium');
          break;
        case 'plugins_directory':
          addDirFiles('plugin', signal.path!, 'plugins', 'high', 40);
          break;
        case 'config_directory':
          addDirFiles('config', signal.path!, 'config', 'medium', 40);
          break;
        case 'config_json':
        case 'config_yaml':
        case 'workspace_json':
        case 'package_manifest':
        case 'mcp_manifest':
          addFile(
            signal.id === 'mcp_manifest' ? 'plugin' : 'config',
            path.basename(signal.path!),
            signal.path!,
            path.join('config', path.basename(signal.path!)),
            'medium',
          );
          break;
        case 'dot_agent_home':
          addDirFiles('preference', signal.path!, 'dot-home', 'medium', 40);
          break;
        default:
          break;
      }
    }

    // Fallback: scan top-level markdown and json if almost empty
    if (items.length === 0) {
      try {
        for (const entry of this.readdirSync(sourcePath, { withFileTypes: true }) as fs.Dirent[]) {
          if (!entry.isFile()) continue;
          if (!/\.(md|json|ya?ml)$/i.test(entry.name)) continue;
          addFile('unknown', entry.name, path.join(sourcePath, entry.name), path.join('misc', entry.name), 'low');
        }
      } catch {
        // ignore
      }
    }

    return items;
  }

  private isSecretLike(filePath: string): boolean {
    try {
      const stat = this.statSync(filePath);
      if (stat.isDirectory()) return false;
      if (stat.size > 256_000) return /secret|credential|token|\.env/i.test(filePath);
      if (/\.env/i.test(path.basename(filePath))) return true;
      const text = this.readFileSync(filePath, 'utf8');
      return SECRET_LIKE.some((re) => re.test(text));
    } catch {
      return false;
    }
  }

  private receipt(
    kind: UniversalWorkspaceImportReceipt['kind'],
    item: UniversalWorkspaceImportItem,
    summary: string,
  ): UniversalWorkspaceImportReceipt {
    return {
      id: `ws_${crypto.randomBytes(6).toString('hex')}`,
      kind,
      itemId: item.id,
      status: kind === 'deny' ? 'deny' : kind === 'skip' ? 'skip' : 'pass',
      summary,
      createdAt: this.now().toISOString(),
      rawSecretsSerialized: false,
    };
  }

  private safeIsDir(p: string): boolean {
    try {
      return this.statSync(p).isDirectory();
    } catch {
      return false;
    }
  }

  private safeIsFile(p: string): boolean {
    try {
      return this.statSync(p).isFile();
    } catch {
      return false;
    }
  }

  private safeId(value: string): string {
    return String(value || 'item')
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'item';
  }

  private blocked(
    sourcePath: string,
    targetRoot: string,
    apply: boolean,
    message: string,
  ): UniversalWorkspaceImportSnapshot {
    return {
      contractVersion: 'zavorth-universal-workspace-import/v1',
      generatedAt: this.now().toISOString(),
      status: 'blocked',
      apply,
      sourcePath,
      profileId: 'opaque-or-empty',
      confidence: 0,
      signals: [],
      items: [],
      receipts: [],
      warnings: [message],
      summary: {
        items: 0,
        secretLike: 0,
        skills: 0,
        memory: 0,
        config: 0,
        plugins: 0,
        copied: 0,
        skipped: 0,
        denied: 0,
      },
      policy: {
        brandAgnostic: true,
        structuralDetectionOnly: true,
        previewBeforeApply: true,
        secretLikeNeverAutoImported: true,
        rawSecretsSerialized: false,
      },
      narrative: {
        headline: 'Workspace import blocked',
        operatorSummary: message,
        nextSafeAction: 'Pass an existing workspace path that contains identity, skills, memory, or config files.',
      },
    };
  }
}
