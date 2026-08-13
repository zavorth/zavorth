/**
 * Shape-based SkillIR normalizer.
 * Inputs are file trees / directories — never third-party product names.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {
  ZAVORTH_SKILL_IR_CONTRACT_VERSION,
  type ZavorthSkillIr,
  type ZavorthSkillIrDeclaredTool,
  type ZavorthSkillIrNormalizeResult,
  type ZavorthSkillIrParserId,
  type ZavorthSkillIrPermission,
} from '../contracts/skill/ZavorthSkillIrContract.js';

export type SkillIrNormalizeInput = {
  /** Absolute path to skill package root (directory). */
  skillDir: string;
  /** Original source URI/path for provenance. */
  sourceUri?: string;
  sourceKind?: string;
  /** Optional preferred id override. */
  skillId?: string | null;
  now?: () => Date;
};

type FileMap = Map<string, string>;

export class SkillIrNormalizerService {
  public normalizeFromDir(input: SkillIrNormalizeInput): ZavorthSkillIrNormalizeResult {
    const skillDir = path.resolve(input.skillDir);
    // process-local SkillIR cache (mtime keyed). Bypass with ZAVORTH_SKILL_HOT_PATH_CACHE=0.
    try {
      const { getSkillHotPathCache } =
        require('../services/SkillHotPathCacheService.js') as typeof import('../services/SkillHotPathCacheService.js');
      const cache = getSkillHotPathCache();
      if (cache.isEnabled() && !input.now) {
        const cached = cache.getOrNormalizeIr(skillDir, () => this.normalizeFromDirUncached(input));
        const { cacheHit: _hit, ...result } = cached;
        return result;
      }
    } catch {
      /* soft — always fall through */
    }
    return this.normalizeFromDirUncached(input);
  }

  private normalizeFromDirUncached(input: SkillIrNormalizeInput): ZavorthSkillIrNormalizeResult {
    const skillDir = path.resolve(input.skillDir);
    const now = input.now || (() => new Date());
    const fetchedAt = now().toISOString();
    const sourceUri = String(input.sourceUri || skillDir).trim() || skillDir;
    const sourceKind = String(input.sourceKind || 'local-path').trim() || 'local-path';

    if (!fs.existsSync(skillDir) || !fs.statSync(skillDir).isDirectory()) {
      const ir = this.buildOpaque(
        path.basename(skillDir) || 'unknown',
        'Path missing or not a directory.',
        [],
        sourceUri,
        sourceKind,
        fetchedAt,
        ['path missing or not a directory'],
      );
      return this.withDigest(ir);
    }

    const files = this.listRelativeFiles(skillDir, 120);
    const fileMap = this.loadTextFiles(skillDir, files);
    const skillMd = fileMap.get('SKILL.md') || fileMap.get('skill.md');
    const readme = fileMap.get('README.md') || fileMap.get('readme.md');
    const packageJsonRaw = fileMap.get('package.json');
    const manifestRaw = fileMap.get('manifest.json');

    if (skillMd) {
      return this.withDigest(
        this.fromSkillMd({
          skillMd,
          manifestRaw,
          files,
          skillDir,
          sourceUri,
          sourceKind,
          fetchedAt,
          skillId: input.skillId,
        }),
      );
    }

    if (packageJsonRaw) {
      const pkgIr = this.fromPackageJson({
        packageJsonRaw,
        readme,
        files,
        skillDir,
        sourceUri,
        sourceKind,
        fetchedAt,
        skillId: input.skillId,
      });
      if (pkgIr) return this.withDigest(pkgIr);
    }

    if (readme) {
      return this.withDigest(
        this.fromReadmeTools({
          readme,
          files,
          skillDir,
          sourceUri,
          sourceKind,
          fetchedAt,
          skillId: input.skillId,
        }),
      );
    }

    const id = sanitizeId(input.skillId || path.basename(skillDir) || 'opaque-skill');
    return this.withDigest(
      this.buildOpaque(
        id,
        `Guidance pack from ${path.basename(skillDir)} (no SKILL.md).`,
        files,
        sourceUri,
        sourceKind,
        fetchedAt,
        ['No SKILL.md / package.json skill entry / README tools block; treated as guidance-only'],
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // Parsers
  // ---------------------------------------------------------------------------

  private fromSkillMd(input: {
    skillMd: string;
    manifestRaw?: string;
    files: string[];
    skillDir: string;
    sourceUri: string;
    sourceKind: string;
    fetchedAt: string;
    skillId?: string | null;
  }): ZavorthSkillIr {
    const fm = parseFrontmatter(input.skillMd);
    const body = stripFrontmatter(input.skillMd);
    const warnings: string[] = [];

    let manifest: Record<string, unknown> | null = null;
    if (input.manifestRaw) {
      try {
        manifest = JSON.parse(input.manifestRaw) as Record<string, unknown>;
      } catch {
        warnings.push('manifest.json present but not valid JSON');
      }
    }

    const nameFromFm = stringOrNull(fm.name) || stringOrNull(fm.title);
    const nameFromManifest = manifest ? stringOrNull(manifest.name) : null;
    const id = sanitizeId(input.skillId || nameFromFm || nameFromManifest || path.basename(input.skillDir) || 'skill');
    const title = nameFromFm || nameFromManifest || extractMarkdownTitle(body) || id;
    const description =
      stringOrNull(fm.description) ||
      (manifest ? stringOrNull(manifest.description) : null) ||
      firstParagraph(body) ||
      title;
    const version = stringOrNull(fm.version) || (manifest ? stringOrNull(manifest.version) : null);

    const toolsFromFm = extractToolsFromUnknown(fm.tools);
    const toolsFromManifest = manifest ? extractToolsFromUnknown(manifest.tools || manifest.toolDefinitions) : [];
    const toolsFromBody = extractToolsFromMarkdown(body);
    const declaredTools = mergeTools(toolsFromFm, toolsFromManifest, toolsFromBody);

    const declaredAliases = extractAliasMap(fm, declaredTools);
    const permissions = extractPermissions(fm, manifest);
    const digest = digestDirFiles(input.skillDir, input.files);

    return {
      contractVersion: ZAVORTH_SKILL_IR_CONTRACT_VERSION,
      parserId: 'skill-md-v1',
      id,
      title,
      description,
      version,
      procedureMarkdown: body.trim(),
      declaredTools,
      declaredAliases,
      permissions,
      entrypoints: [],
      files: input.files,
      provenance: {
        uri: input.sourceUri,
        kind: input.sourceKind,
        digest,
        fetchedAt: input.fetchedAt,
      },
      guidanceOnly: declaredTools.length === 0,
      warnings,
    };
  }

  private fromPackageJson(input: {
    packageJsonRaw: string;
    readme?: string;
    files: string[];
    skillDir: string;
    sourceUri: string;
    sourceKind: string;
    fetchedAt: string;
    skillId?: string | null;
  }): ZavorthSkillIr | null {
    let pkg: Record<string, unknown>;
    try {
      pkg = JSON.parse(input.packageJsonRaw) as Record<string, unknown>;
    } catch {
      return null;
    }
    const skillField = pkg.zavorthSkill || pkg.skill || pkg['skill.md'];
    const hasSkillKeyword =
      Array.isArray(pkg.keywords) && (pkg.keywords as unknown[]).some((k) => /skill/i.test(String(k)));
    if (!skillField && !hasSkillKeyword && !input.readme) {
      return null;
    }

    const warnings: string[] = [];
    const id = sanitizeId(input.skillId || stringOrNull(pkg.name) || path.basename(input.skillDir) || 'pkg-skill');
    const title = stringOrNull(pkg.name) || id;
    const description = stringOrNull(pkg.description) || title;
    const version = stringOrNull(pkg.version);
    const declaredTools = mergeTools(
      extractToolsFromUnknown(
        typeof skillField === 'object' && skillField ? (skillField as Record<string, unknown>).tools : undefined,
      ),
      extractToolsFromMarkdown(input.readme || ''),
    );
    if (declaredTools.length === 0) {
      warnings.push('package.json skill shape without declared tools');
    }
    const digest = digestDirFiles(input.skillDir, input.files);

    return {
      contractVersion: ZAVORTH_SKILL_IR_CONTRACT_VERSION,
      parserId: 'package-json-skill-v1',
      id,
      title,
      description,
      version,
      procedureMarkdown: (input.readme || description).trim(),
      declaredTools,
      declaredAliases: {},
      permissions: [],
      entrypoints: [],
      files: input.files,
      provenance: {
        uri: input.sourceUri,
        kind: input.sourceKind,
        digest,
        fetchedAt: input.fetchedAt,
      },
      guidanceOnly: declaredTools.length === 0,
      warnings,
    };
  }

  private fromReadmeTools(input: {
    readme: string;
    files: string[];
    skillDir: string;
    sourceUri: string;
    sourceKind: string;
    fetchedAt: string;
    skillId?: string | null;
  }): ZavorthSkillIr {
    const tools = extractToolsFromMarkdown(input.readme);
    const id = sanitizeId(input.skillId || path.basename(input.skillDir) || 'readme-skill');
    const title = extractMarkdownTitle(input.readme) || id;
    const digest = digestDirFiles(input.skillDir, input.files);
    return {
      contractVersion: ZAVORTH_SKILL_IR_CONTRACT_VERSION,
      parserId: 'readme-tools-v1',
      id,
      title,
      description: firstParagraph(input.readme) || title,
      version: null,
      procedureMarkdown: input.readme.trim(),
      declaredTools: tools,
      declaredAliases: {},
      permissions: [],
      entrypoints: [],
      files: input.files,
      provenance: {
        uri: input.sourceUri,
        kind: input.sourceKind,
        digest,
        fetchedAt: input.fetchedAt,
      },
      guidanceOnly: tools.length === 0,
      warnings: tools.length === 0 ? ['README without tool list markers'] : [],
    };
  }

  private buildOpaque(
    id: string,
    description: string,
    files: string[],
    sourceUri: string,
    sourceKind: string,
    fetchedAt: string,
    warnings: string[],
  ): ZavorthSkillIr {
    return {
      contractVersion: ZAVORTH_SKILL_IR_CONTRACT_VERSION,
      parserId: 'opaque-guidance-v1',
      id: sanitizeId(id),
      title: sanitizeId(id),
      description,
      version: null,
      procedureMarkdown: description,
      declaredTools: [],
      declaredAliases: {},
      permissions: [],
      entrypoints: [],
      files,
      provenance: {
        uri: sourceUri,
        kind: sourceKind,
        digest: crypto
          .createHash('sha256')
          .update(description + files.join('|'))
          .digest('hex'),
        fetchedAt,
      },
      guidanceOnly: true,
      warnings,
    };
  }

  private withDigest(skillIr: ZavorthSkillIr): ZavorthSkillIrNormalizeResult {
    const skillIrDigest = computeSkillIrDigest(skillIr);
    return {
      ok: true,
      skillIr: {
        ...skillIr,
        provenance: {
          ...skillIr.provenance,
          digest: skillIr.provenance.digest || skillIrDigest,
        },
      },
      skillIrDigest,
    };
  }

  private listRelativeFiles(skillDir: string, max: number): string[] {
    const out: string[] = [];
    const walk = (dir: string) => {
      if (out.length >= max) return;
      let entries: fs.Dirent[];
      try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
      } catch {
        return;
      }
      for (const entry of entries) {
        if (out.length >= max) break;
        if (entry.name === 'node_modules' || entry.name === '.git') continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(full);
        } else {
          out.push(path.relative(skillDir, full).replace(/\\/g, '/'));
        }
      }
    };
    walk(skillDir);
    return out;
  }

  private loadTextFiles(skillDir: string, files: string[]): FileMap {
    const map: FileMap = new Map();
    for (const rel of files) {
      if (rel.length > 200) continue;
      if (!/\.(md|json|txt|yml|yaml)$/i.test(rel) && path.posix.basename(rel) !== 'SKILL.md') {
        continue;
      }
      try {
        const full = path.join(skillDir, rel);
        const stat = fs.statSync(full);
        if (stat.size > 512_000) continue;
        map.set(rel.replace(/\\/g, '/'), fs.readFileSync(full, 'utf8'));
      } catch {
        /* skip */
      }
    }
    return map;
  }
}

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

export function computeSkillIrDigest(skillIr: ZavorthSkillIr): string {
  const canonical = {
    contractVersion: skillIr.contractVersion,
    parserId: skillIr.parserId,
    id: skillIr.id,
    title: skillIr.title,
    description: skillIr.description,
    version: skillIr.version,
    procedureMarkdown: skillIr.procedureMarkdown,
    declaredTools: skillIr.declaredTools,
    declaredAliases: skillIr.declaredAliases,
    permissions: skillIr.permissions,
    guidanceOnly: skillIr.guidanceOnly,
  };
  return crypto.createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
}

function digestDirFiles(skillDir: string, files: string[]): string {
  const h = crypto.createHash('sha256');
  for (const rel of [...files].sort()) {
    h.update(rel);
    try {
      h.update(fs.readFileSync(path.join(skillDir, rel)));
    } catch {
      h.update('...');
    }
  }
  return h.digest('hex');
}

function sanitizeId(value: string): string {
  return (
    String(value || 'skill')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'skill'
  );
}

function stringOrNull(value: unknown): string | null {
  const s = String(value ?? '').trim();
  return s ? s : null;
}

function parseFrontmatter(text: string): Record<string, unknown> {
  const match = String(text || '').match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) return {};
  return parseSimpleYaml(match[1]);
}

function stripFrontmatter(text: string): string {
  return String(text || '').replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '');
}

/** Minimal YAML-ish parser for skill frontmatter (keys, lists, nested tools). */
function parseSimpleYaml(block: string): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const lines = block.split(/\r?\n/);
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const keyMatch = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!keyMatch) {
      i += 1;
      continue;
    }
    const key = keyMatch[1];
    const rest = keyMatch[2].trim();
    if (rest === '' || rest === '|' || rest === '>') {
      // Possibly a list or block
      const items: unknown[] = [];
      let j = i + 1;
      while (j < lines.length) {
        const l2 = lines[j];
        if (/^\S/.test(l2) && !/^\s/.test(l2)) break;
        const listItem = l2.match(/^\s+-\s+(.*)$/);
        if (listItem) {
          const v = listItem[1].trim();
          if (v.includes(':') && !v.startsWith('{')) {
            // object list item like `- name: foo`
            const obj: Record<string, string> = {};
            const nm = v.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
            if (nm) obj[nm[1]] = stripQuotes(nm[2]);
            // continuation lines for same object
            let k = j + 1;
            while (k < lines.length) {
              const cont = lines[k].match(/^\s{4}([A-Za-z0-9_-]+):\s*(.*)$/);
              if (!cont) break;
              obj[cont[1]] = stripQuotes(cont[2]);
              k += 1;
            }
            items.push(obj);
            j = k;
            continue;
          }
          items.push(stripQuotes(v));
        } else if (/^\s+[A-Za-z0-9_-]+:/.test(l2) && items.length === 0) {
          // nested map under key
          break;
        }
        j += 1;
      }
      if (items.length) {
        out[key] = items;
        i = j;
        continue;
      }
      out[key] = rest === '|' || rest === '>' ? '' : rest;
      i += 1;
      continue;
    }
    // inline list [a, b]
    if (rest.startsWith('[') && rest.endsWith(']')) {
      out[key] = rest
        .slice(1, -1)
        .split(',')
        .map((s) => stripQuotes(s.trim()))
        .filter(Boolean);
      i += 1;
      continue;
    }
    out[key] = stripQuotes(rest);
    i += 1;
  }
  return out;
}

function stripQuotes(value: string): string {
  const s = String(value || '').trim();
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1);
  }
  return s;
}

function extractMarkdownTitle(text: string): string | null {
  const m = String(text || '').match(/^#\s+(.+)$/m);
  return m ? m[1].trim() : null;
}

function firstParagraph(text: string): string {
  const body = stripFrontmatter(text).replace(/^#.*$/m, '').trim();
  const para = body.split(/\n\s*\n/)[0] || body;
  return para.replace(/\s+/g, ' ').trim().slice(0, 400);
}

function extractToolsFromUnknown(value: unknown): ZavorthSkillIrDeclaredTool[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === 'string') {
          const name = item.trim();
          return name ? { name } : null;
        }
        if (item && typeof item === 'object') {
          const rec = item as Record<string, unknown>;
          const name = String(rec.name || rec.id || rec.tool || '').trim();
          if (!name) return null;
          const aliases = Array.isArray(rec.aliases)
            ? rec.aliases.map((a) => String(a).trim()).filter(Boolean)
            : undefined;
          return {
            name,
            description: rec.description ? String(rec.description) : undefined,
            aliases,
          };
        }
        return null;
      })
      .filter(Boolean) as ZavorthSkillIrDeclaredTool[];
  }
  return [];
}

function extractToolsFromMarkdown(text: string): ZavorthSkillIrDeclaredTool[] {
  const tools: ZavorthSkillIrDeclaredTool[] = [];
  const seen = new Set<string>();
  const add = (raw: string) => {
    const name = String(raw || '')
      .replace(/[`'"]/g, '')
      .trim();
    if (!name || name.length < 2 || seen.has(name.toLowerCase())) return;
    if (!/^[a-z][a-z0-9_.-]*$/i.test(name)) return;
    // Skip common english words that look like tokens
    if (/^(and|the|for|when|with|from|tool|tools|use|uses)$/i.test(name)) return;
    seen.add(name.toLowerCase());
    tools.push({ name });
  };
  // Any backtick tool-like token
  for (const m of String(text || '').matchAll(/`([a-z][a-z0-9_.-]{1,64})`/gi)) {
    add(m[1]);
  }
  // tools: a, b
  for (const m of String(text || '').matchAll(/(?:^|\n)\s*tools?\s*:\s*([a-z0-9_.,\s`-]+)/gi)) {
    for (const part of m[1].split(/[,\s]+/)) add(part);
  }
  return tools;
}

function mergeTools(...lists: ZavorthSkillIrDeclaredTool[][]): ZavorthSkillIrDeclaredTool[] {
  const map = new Map<string, ZavorthSkillIrDeclaredTool>();
  for (const list of lists) {
    for (const t of list) {
      const key = t.name.toLowerCase();
      const prev = map.get(key);
      if (!prev) {
        map.set(key, { ...t });
      } else {
        map.set(key, {
          name: prev.name,
          description: prev.description || t.description,
          aliases: Array.from(new Set([...(prev.aliases || []), ...(t.aliases || [])])),
        });
      }
    }
  }
  return Array.from(map.values());
}

function extractAliasMap(fm: Record<string, unknown>, tools: ZavorthSkillIrDeclaredTool[]): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  const aliasesField = fm.aliases;
  if (aliasesField && typeof aliasesField === 'object' && !Array.isArray(aliasesField)) {
    for (const [k, v] of Object.entries(aliasesField as Record<string, unknown>)) {
      const key = String(k).trim();
      if (!key) continue;
      if (Array.isArray(v)) {
        out[key] = v.map((x) => String(x).trim()).filter(Boolean);
      } else if (typeof v === 'string') {
        out[key] = [v.trim()].filter(Boolean);
      }
    }
  }
  for (const t of tools) {
    if (t.aliases?.length) {
      out[t.name] = Array.from(new Set([...(out[t.name] || []), ...t.aliases]));
    }
  }
  return out;
}

function extractPermissions(
  fm: Record<string, unknown>,
  manifest: Record<string, unknown> | null,
): ZavorthSkillIrPermission[] {
  const raw = fm.permissions || manifest?.permissions;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (typeof item === 'string') return { kind: item.trim() };
      if (item && typeof item === 'object') {
        const rec = item as Record<string, unknown>;
        const kind = String(rec.kind || rec.name || rec.id || '').trim();
        if (!kind) return null;
        return {
          kind,
          reason: rec.reason ? String(rec.reason) : undefined,
          required: rec.required === true,
        };
      }
      return null;
    })
    .filter(Boolean) as ZavorthSkillIrPermission[];
}

export type { ZavorthSkillIrParserId };
