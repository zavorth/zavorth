import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { config } from '../config/index.js';
import { logger } from '../logger.js';

export const ZAVORTH_SKILL_EXPANSION_PACK_CONTRACT_VERSION = 'zavorth-skill-expansion-pack/1' as const;

export type ZavorthSkillExpansionStatus = 'ready' | 'attention' | 'blocked' | 'applied';
export type ZavorthSkillExpansionRisk = 'low' | 'medium' | 'high';
export type ZavorthSkillExpansionPermission = 'context-only' | 'approval-required' | 'sandbox-required';
export type ZavorthSkillExpansionCollection = 'core' | 'optional';

export type ZavorthSkillExpansionCandidate = {
  id: string;
  name: string;
  title: string;
  category: string;
  collection: ZavorthSkillExpansionCollection;
  sourceRelativePath: string;
  targetRelativePath: string;
  description: string;
  tags: string[];
  relatedSkills: string[];
  license: string | null;
  risk: ZavorthSkillExpansionRisk;
  permission: ZavorthSkillExpansionPermission;
  bodyHash: string;
};

export type ZavorthSkillExpansionMaterializedFile = {
  candidateId: string;
  relativePath: string;
  targetPath: string;
  sha256: string;
};

export type ZavorthSkillExpansionSnapshot = {
  contractVersion: typeof ZAVORTH_SKILL_EXPANSION_PACK_CONTRACT_VERSION;
  schemaVersion: 1;
  surface: 'skill-expansion-pack';
  generatedAt: string;
  status: ZavorthSkillExpansionStatus;
  mode: 'preview' | 'applied';
  source: {
    requestedPath: string | null;
    resolvedPath: string | null;
    exists: boolean;
    license: string | null;
    sourceRoots: string[];
  };
  target: {
    rootPath: string;
    packPath: string;
    statePath: string;
    receiptPath: string;
  };
  summary: {
    candidates: number;
    core: number;
    optional: number;
    categories: number;
    lowRisk: number;
    mediumRisk: number;
    highRisk: number;
    materializedCandidates: number;
    filesWritten: number;
    copiedUpstreamSkillBodies: 0;
    copiedUpstreamScripts: 0;
  };
  categories: Array<{ category: string; candidates: number; highRisk: number }>;
  candidates: ZavorthSkillExpansionCandidate[];
  materializedFiles: ZavorthSkillExpansionMaterializedFile[];
  apply: {
    requested: boolean;
    applied: boolean;
    approvalRequired: boolean;
    approvalSatisfied: boolean;
    approvalId: string | null;
    overwrite: boolean;
  };
  safety: {
    generatedZavorthNativeStubsOnly: true;
    noUpstreamSkillBodyCopy: true;
    noScriptCopy: true;
    noExecutionPerformed: true;
    noNetworkProbe: true;
    approvalRequiredForMaterialization: true;
    importedSkillsRemainReviewTrust: true;
    rawSecretsSerialized: false;
  };
  commands: {
    preview: 'zavorth skill-expansion-pack';
    json: 'zavorth skill-expansion-pack --json';
    apply: 'zavorth skill-expansion-pack --apply --approval-id <id>';
    check: 'npm run zavorth:skill-expansion-pack:check --silent';
  };
};

export type ZavorthSkillExpansionPackInput = {
  sourceRoot?: string | null;
  targetRoot?: string | null;
  apply?: boolean;
  approvalId?: string | null;
  includeCore?: boolean;
  includeOptional?: boolean;
  overwrite?: boolean;
  maxCandidates?: number | null;
};

type Runtime = {
  now?: () => Date;
  projectRoot?: string;
};

type ParsedSkill = {
  fields: Record<string, string>;
  tags: string[];
  relatedSkills: string[];
  body: string;
};

const SOURCE_COLLECTIONS: Array<{
  collection: ZavorthSkillExpansionCollection;
  dirName: string;
}> = [
  { collection: 'core', dirName: 'skills' },
  { collection: 'optional', dirName: 'optional-skills' },
];

const MAX_SKILL_BYTES = 192 * 1024;
const DEFAULT_MAX_CANDIDATES = 1000;

export class ZavorthSkillExpansionPackService {
  private readonly now: () => Date;
  private readonly projectRoot: string;

  public constructor(runtime: Runtime = {}) {
    this.now = runtime.now || (() => new Date());
    this.projectRoot = runtime.projectRoot || config.projectRoot;
  }

  public buildSnapshot(input: ZavorthSkillExpansionPackInput = {}): ZavorthSkillExpansionSnapshot {
    const requestedPath = input.sourceRoot ? path.resolve(input.sourceRoot) : null;
    const resolvedPath = requestedPath || findDefaultReferenceSkillRoot(this.projectRoot);
    const sourceExists = Boolean(resolvedPath && fs.existsSync(resolvedPath));
    const targetRoot = path.resolve(input.targetRoot || path.join(this.projectRoot, 'skill-library', 'imported'));
    const packPath = path.join(targetRoot, 'zavorth-expansion-pack');
    const statePath = path.join(this.projectRoot, 'data', 'skill-expansion-pack', 'skill-expansion-state.json');
    const receiptPath = path.join(this.projectRoot, 'data', 'skill-expansion-pack', 'skill-expansion-receipt.json');
    const sourceRoots = sourceExists && resolvedPath
      ? SOURCE_COLLECTIONS
        .filter((entry) => entry.collection === 'core' ? input.includeCore !== false : input.includeOptional !== false)
        .map((entry) => path.join(resolvedPath, entry.dirName))
        .filter((entry) => fs.existsSync(entry))
      : [];
    const candidates = sourceExists && resolvedPath
      ? this.scanCandidates({
        sourceRoot: resolvedPath,
        includeCore: input.includeCore !== false,
        includeOptional: input.includeOptional !== false,
      }).slice(0, positive(input.maxCandidates, DEFAULT_MAX_CANDIDATES))
      : [];

    const applyRequested = input.apply === true;
    const approvalId = normalizeApprovalId(input.approvalId);
    const approvalSatisfied = Boolean(approvalId);
    const materializedFiles = applyRequested && approvalSatisfied && sourceExists
      ? this.materialize({
        candidates,
        sourceRoot: resolvedPath || '',
        packPath,
        statePath,
        receiptPath,
        approvalId: approvalId || '',
        overwrite: input.overwrite === true,
      })
      : [];
    const materializedCandidateIds = new Set(materializedFiles
      .filter((entry) => entry.candidateId.startsWith('zxp:'))
      .map((entry) => entry.candidateId));
    const categories = categorySummary(candidates);
    const status = resolveStatus({
      sourceExists,
      applyRequested,
      approvalSatisfied,
      materializedFiles,
      candidates,
    });

    return {
      contractVersion: ZAVORTH_SKILL_EXPANSION_PACK_CONTRACT_VERSION,
      schemaVersion: 1,
      surface: 'skill-expansion-pack',
      generatedAt: this.now().toISOString(),
      status,
      mode: materializedFiles.length > 0 ? 'applied' : 'preview',
      source: {
        requestedPath,
        resolvedPath,
        exists: sourceExists,
        license: resolvedPath ? readLicenseName(resolvedPath) : null,
        sourceRoots,
      },
      target: {
        rootPath: targetRoot,
        packPath,
        statePath,
        receiptPath,
      },
      summary: {
        candidates: candidates.length,
        core: candidates.filter((entry) => entry.collection === 'core').length,
        optional: candidates.filter((entry) => entry.collection === 'optional').length,
        categories: categories.length,
        lowRisk: candidates.filter((entry) => entry.risk === 'low').length,
        mediumRisk: candidates.filter((entry) => entry.risk === 'medium').length,
        highRisk: candidates.filter((entry) => entry.risk === 'high').length,
        materializedCandidates: materializedCandidateIds.size,
        filesWritten: materializedFiles.length,
        copiedUpstreamSkillBodies: 0,
        copiedUpstreamScripts: 0,
      },
      categories,
      candidates,
      materializedFiles,
      apply: {
        requested: applyRequested,
        applied: materializedFiles.length > 0,
        approvalRequired: applyRequested,
        approvalSatisfied,
        approvalId,
        overwrite: input.overwrite === true,
      },
      safety: {
        generatedZavorthNativeStubsOnly: true,
        noUpstreamSkillBodyCopy: true,
        noScriptCopy: true,
        noExecutionPerformed: true,
        noNetworkProbe: true,
        approvalRequiredForMaterialization: true,
        importedSkillsRemainReviewTrust: true,
        rawSecretsSerialized: false,
      },
      commands: {
        preview: 'zavorth skill-expansion-pack',
        json: 'zavorth skill-expansion-pack --json',
        apply: 'zavorth skill-expansion-pack --apply --approval-id <id>',
        check: 'npm run zavorth:skill-expansion-pack:check --silent',
      },
    };
  }

  public renderText(snapshot: ZavorthSkillExpansionSnapshot): string {
    return [
      'Zavorth Skill Expansion Pack',
      `status=${snapshot.status} mode=${snapshot.mode}`,
      `source=${snapshot.source.resolvedPath || 'not-found'} exists=${snapshot.source.exists}`,
      `candidates=${snapshot.summary.candidates} core=${snapshot.summary.core} optional=${snapshot.summary.optional} categories=${snapshot.summary.categories}`,
      `risk=low:${snapshot.summary.lowRisk} medium:${snapshot.summary.mediumRisk} high:${snapshot.summary.highRisk}`,
      `materialized=${snapshot.summary.materializedCandidates} files=${snapshot.summary.filesWritten}`,
      '',
      'Top categories',
      ...(snapshot.categories.slice(0, 12).map((entry) => `- ${entry.category}: ${entry.candidates} skills | highRisk=${entry.highRisk}`)),
      '',
      'Sample capabilities',
      ...(snapshot.candidates.slice(0, 12).map((entry) => `- ${entry.id}: ${entry.permission} | ${entry.targetRelativePath}`)),
      '',
      snapshot.apply.requested
        ? snapshot.apply.applied
          ? `Applied generated expansion pack: ${snapshot.target.packPath}`
          : 'Apply blocked: provide --approval-id <id> and a valid local source.'
        : `Apply governed: ${snapshot.commands.apply}`,
      'Safety: generated Zavorth-native stubs only; no upstream scripts, no runtime execution, no network probes.',
      '',
    ].join('\n');
  }

  private scanCandidates(input: {
    sourceRoot: string;
    includeCore: boolean;
    includeOptional: boolean;
  }): ZavorthSkillExpansionCandidate[] {
    const candidates: ZavorthSkillExpansionCandidate[] = [];
    for (const collection of SOURCE_COLLECTIONS) {
      if (collection.collection === 'core' && !input.includeCore) continue;
      if (collection.collection === 'optional' && !input.includeOptional) continue;
      const root = path.join(input.sourceRoot, collection.dirName);
      for (const skillFilePath of findSkillFiles(root)) {
        const relativeSkillPath = normalizePath(path.relative(input.sourceRoot, path.dirname(skillFilePath)));
        const parts = relativeSkillPath.split('/');
        const category = normalizeSlug(parts[1] || 'general');
        const text = readLimited(skillFilePath);
        const parsed = parseSkill(text);
        const name = normalizeSlug(parsed.fields.name || path.basename(path.dirname(skillFilePath)));
        const title = titleCase(name);
        const description = normalizeDescription(parsed.fields.description || title);
        const tags = uniqueStrings([
          category,
          ...parsed.tags,
          ...tokensFrom(`${name} ${title} ${description}`).slice(0, 8),
        ]).slice(0, 16);
        const relatedSkills = parsed.relatedSkills.map(normalizeSlug).filter(Boolean).slice(0, 12);
        const risk = riskForSkill(category, text, tags);
        const permission = permissionForRisk(risk, text);
        const targetRelativePath = normalizePath(path.join('skill-library', 'imported', 'zavorth-expansion-pack', category, name));
        candidates.push({
          id: `zxp:${category}:${name}`,
          name,
          title,
          category,
          collection: collection.collection,
          sourceRelativePath: relativeSkillPath,
          targetRelativePath,
          description,
          tags,
          relatedSkills,
          license: parsed.fields.license || null,
          risk,
          permission,
          bodyHash: sha256(text),
        });
      }
    }
    return candidates.sort((a, b) => a.id.localeCompare(b.id));
  }

  private materialize(input: {
    candidates: ZavorthSkillExpansionCandidate[];
    sourceRoot: string;
    packPath: string;
    statePath: string;
    receiptPath: string;
    approvalId: string;
    overwrite: boolean;
  }): ZavorthSkillExpansionMaterializedFile[] {
    ensureWithin(path.join(this.projectRoot, 'skill-library', 'imported'), input.packPath);
    fs.mkdirSync(input.packPath, { recursive: true });
    fs.mkdirSync(path.dirname(input.statePath), { recursive: true });
    const written: ZavorthSkillExpansionMaterializedFile[] = [];
    for (const candidate of input.candidates) {
      const candidateDir = path.join(input.packPath, candidate.category, candidate.name);
      ensureWithin(input.packPath, candidateDir);
      if (fs.existsSync(candidateDir) && !input.overwrite && !isGeneratedExpansionDir(candidateDir)) {
        continue;
      }
      fs.mkdirSync(candidateDir, { recursive: true });
      this.writeGenerated(candidateDir, 'SKILL.md', buildSkillStub(candidate), candidate.id, written);
      this.writeGenerated(candidateDir, 'ORIGIN.json', `${JSON.stringify(buildOrigin(candidate, {
        sourceRoot: input.sourceRoot,
        approvalId: input.approvalId,
        generatedAt: this.now().toISOString(),
      }), null, 2)}\n`, candidate.id, written);
    }
    this.writeGenerated(input.packPath, 'registry.json', `${JSON.stringify({
      version: 1,
      generatedAt: this.now().toISOString(),
      approvalId: input.approvalId,
      candidates: input.candidates.map((candidate) => ({
        id: candidate.id,
        targetRelativePath: candidate.targetRelativePath,
        category: candidate.category,
        risk: candidate.risk,
        permission: candidate.permission,
      })),
      safety: {
        generatedStubsOnly: true,
        noUpstreamSkillBodyCopy: true,
        noScriptCopy: true,
      },
    }, null, 2)}\n`, 'registry', written);
    this.writeGenerated(input.packPath, 'THIRD_PARTY_NOTICES.md', buildNotice(input.sourceRoot), 'notice', written);
    const receipt = {
      contractVersion: ZAVORTH_SKILL_EXPANSION_PACK_CONTRACT_VERSION,
      generatedAt: this.now().toISOString(),
      approvalId: input.approvalId,
      sourceRoot: 'zavorth-native-pack://',
      packPath: input.packPath,
      candidates: input.candidates.length,
      filesWritten: written.length,
      materialization: 'generated-zavorth-native-stubs',
      safety: {
        noExecutionPerformed: true,
        noNetworkProbe: true,
        noScriptCopy: true,
        noUpstreamSkillBodyCopy: true,
      },
    };
    fs.writeFileSync(input.statePath, `${JSON.stringify(receipt, null, 2)}\n`, 'utf8');
    fs.writeFileSync(input.receiptPath, `${JSON.stringify({ ...receipt, receiptKind: 'skill-expansion-pack' }, null, 2)}\n`, 'utf8');
    return written;
  }

  private writeGenerated(
    root: string,
    relativePath: string,
    text: string,
    candidateId: string,
    written: ZavorthSkillExpansionMaterializedFile[],
  ): void {
    const target = path.join(root, relativePath);
    ensureWithin(root, target);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, text, 'utf8');
    written.push({
      candidateId,
      relativePath: normalizePath(path.relative(path.join(this.projectRoot, 'skill-library', 'imported'), target)),
      targetPath: target,
      sha256: sha256(text),
    });
  }
}

function buildSkillStub(candidate: ZavorthSkillExpansionCandidate): string {
  const useWhen = [
    `the user asks for ${candidate.title}`,
    `the task belongs to the ${candidate.category} capability area`,
    candidate.relatedSkills.length > 0 ? `nearby skills include ${candidate.relatedSkills.slice(0, 5).join(', ')}` : null,
  ].filter((entry): entry is string => Boolean(entry));
  return [
    '---',
    `name: ${candidate.name}`,
    `description: Zavorth-native capability route for ${candidate.title}.`,
    '---',
    '',
    `# ${candidate.title}`,
    '',
    'ZAVORTH_EXPANSION_GENERATED: true',
    '',
    'This skill is a Zavorth-native capability stub. It gives the agent routing context and operating guardrails, but it does not copy or execute upstream skill scripts.',
    '',
    '## When To Use',
    '',
    ...useWhen.map((entry) => `- ${entry}.`),
    '',
    '## Operating Contract',
    '',
    '- Route through Natural First Runtime before any tool use.',
    '- Treat external services, account changes, writes, payments, messaging, code execution and system changes as approval-required.',
    '- Use typed Zavorth connectors when available; otherwise produce a preview and ask for operator approval.',
    '- Do not run upstream scripts directly from this skill.',
    '- Record receipts for actions, denials and fallbacks.',
    '',
    '## Capability Metadata',
    '',
    `- Category: ${candidate.category}`,
    `- Permission: ${candidate.permission}`,
    `- Risk: ${candidate.risk}`,
    `- Tags: ${candidate.tags.join(', ') || 'workflow'}`,
    '',
  ].join('\n');
}

function buildOrigin(candidate: ZavorthSkillExpansionCandidate, input: {
  sourceRoot: string;
  approvalId: string;
  generatedAt: string;
}): Record<string, unknown> {
  return {
    version: 1,
    importedAt: input.generatedAt,
    importMode: 'generated-zavorth-native-stub',
    approvalId: input.approvalId,
    skillName: candidate.name,
    source: {
      id: 'zavorth-native-skill-library',
      label: 'Zavorth Native Skill Library',
      kind: 'repository',
      trust: 'review',
      registrySource: 'zavorth:skill-expansion-pack',
      upstream: null,
      pinnedRevision: null,
      license: candidate.license,
      ownership: 'native',
    },
    originalSkillPath: `zavorth-native-pack://${candidate.sourceRelativePath.replace(/\\/g, '/')}`,
    originalRelativePath: candidate.sourceRelativePath,
    copiedFiles: [],
    reference: {
      sourceRoot: 'zavorth-native-pack://',
      bodyHash: candidate.bodyHash,
    },
    governance: {
      permission: candidate.permission,
      risk: candidate.risk,
      noExecutionPerformed: true,
      noUpstreamSkillBodyCopy: true,
      noScriptCopy: true,
    },
  };
}

function buildNotice(sourceRoot: string): string {
  return [
    '# Third Party Notices',
    '',
    'This expansion pack was generated from a Zavorth native skill library.',
    '',
    '- Generated output contains Zavorth-native stubs only.',
    '- Upstream skill bodies and scripts were not copied into the runtime stubs.',
    '- Source path: zavorth-native-pack://',
    '- Source license detected: unknown',
    '',
    'If this pack is redistributed with source-derived materials, preserve the applicable upstream license notices.',
    '',
  ].join('\n');
}

function parseSkill(text: string): ParsedSkill {
  const frontmatter = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const body = frontmatter ? text.slice(frontmatter[0].length) : text;
  const fields: Record<string, string> = {};
  const tags: string[] = [];
  const relatedSkills: string[] = [];
  if (frontmatter) {
    const yaml = frontmatter[1];
    for (const line of yaml.split(/\r?\n/)) {
      const match = line.match(/^([a-zA-Z0-9_-]+):\s*(.+)$/);
      if (match) {
        fields[match[1]] = unquote(match[2].trim());
      }
      if (/tags:\s*\[/.test(line)) {
        tags.push(...parseInlineList(line));
      }
      if (/related_skills:\s*\[/.test(line)) {
        relatedSkills.push(...parseInlineList(line));
      }
    }
  }
  return { fields, tags, relatedSkills, body };
}

function parseInlineList(line: string): string[] {
  const inside = line.match(/\[(.*)\]/)?.[1] || '';
  return inside.split(',').map((entry) => unquote(entry.trim())).filter(Boolean);
}

function unquote(value: string): string {
  return value.replace(/^['"]|['"]$/g, '').trim();
}

function findDefaultReferenceSkillRoot(projectRoot: string): string | null {
  const candidates: string[] = [];
  let cursor = path.resolve(projectRoot);
  for (let depth = 0; depth < 4; depth += 1) {
    candidates.push(...safeListDirs(cursor));
    cursor = path.dirname(cursor);
  }
  return candidates.find((candidate) =>
    fs.existsSync(path.join(candidate, 'skills'))
    && fs.existsSync(path.join(candidate, 'optional-skills'))
  ) || null;
}

function safeListDirs(root: string): string[] {
  try {
    return fs.readdirSync(root, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => path.join(root, entry.name));
  } catch (error: any) { logger.warn('[Zavorth Skill Expansion Pack] filesystem operation failed', error); return []; }
}

function findSkillFiles(root: string): string[] {
  const results: string[] = [];
  const visit = (dir: string, depth: number): void => {
    if (depth > 6) return;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (error: any) {
    logger.warn('[Zavorth Skill Expansion Pack] filesystem operation failed', error);
    return;
  }
    for (const entry of entries) {
      const next = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!entry.name.startsWith('.') && entry.name !== 'node_modules') visit(next, depth + 1);
      } else if (entry.name === 'SKILL.md') {
        results.push(next);
      }
    }
  };
  visit(root, 0);
  return results;
}

function riskForSkill(category: string, text: string, tags: string[]): ZavorthSkillExpansionRisk {
  const lower = `${category} ${tags.join(' ')} ${text.slice(0, 4000)}`.toLowerCase();
  if (/(blockchain|finance|payment|trade|trading|wallet|email|imessage|sms|telegram|slack|whatsapp|shell|docker|kubernetes|ssh|token|oauth|api key|password|browser|computer-use)/.test(lower)) {
    return 'high';
  }
  if (/(github|devops|mcp|database|jupyter|webhook|scrap|scrape|file|write|excel|pptx|notion|google-workspace)/.test(lower)) {
    return 'medium';
  }
  return 'low';
}

function permissionForRisk(risk: ZavorthSkillExpansionRisk, text: string): ZavorthSkillExpansionPermission {
  if (risk === 'high') return 'sandbox-required';
  if (risk === 'medium' || /```|command|script|install|run\b/i.test(text)) return 'approval-required';
  return 'context-only';
}

function categorySummary(candidates: ZavorthSkillExpansionCandidate[]): Array<{ category: string; candidates: number; highRisk: number }> {
  const counts = new Map<string, { category: string; candidates: number; highRisk: number }>();
  for (const candidate of candidates) {
    const current = counts.get(candidate.category) || { category: candidate.category, candidates: 0, highRisk: 0 };
    current.candidates += 1;
    if (candidate.risk === 'high') current.highRisk += 1;
    counts.set(candidate.category, current);
  }
  return Array.from(counts.values()).sort((a, b) => b.candidates - a.candidates || a.category.localeCompare(b.category));
}

function resolveStatus(input: {
  sourceExists: boolean;
  applyRequested: boolean;
  approvalSatisfied: boolean;
  materializedFiles: ZavorthSkillExpansionMaterializedFile[];
  candidates: ZavorthSkillExpansionCandidate[];
}): ZavorthSkillExpansionStatus {
  if (!input.sourceExists || input.candidates.length === 0) return 'blocked';
  if (input.materializedFiles.length > 0) return 'applied';
  if (input.applyRequested && !input.approvalSatisfied) return 'blocked';
  return input.candidates.some((candidate) => candidate.risk === 'high') ? 'attention' : 'ready';
}

function readLimited(filePath: string): string {
  try {
    const fd = fs.openSync(filePath, 'r');
    try {
      const stat = fs.fstatSync(fd);
      const buffer = Buffer.alloc(Math.min(stat.size, MAX_SKILL_BYTES));
      fs.readSync(fd, buffer, 0, buffer.length, 0);
      return buffer.toString('utf8');
    } finally {
      fs.closeSync(fd);
    }
  } catch (error: any) { logger.warn('[Zavorth Skill Expansion Pack] filesystem operation failed', error); return ''; }
}

function readLicenseName(sourceRoot: string): string | null {
  const text = readLimited(path.join(sourceRoot, 'LICENSE'));
  if (/MIT License/i.test(text)) return 'MIT';
  if (/Apache License/i.test(text)) return 'Apache';
  return text ? 'unknown' : null;
}

function isGeneratedExpansionDir(dir: string): boolean {
  const skill = readLimited(path.join(dir, 'SKILL.md'));
  return skill.includes('ZAVORTH_EXPANSION_GENERATED: true');
}

function normalizeDescription(value: string): string {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .replace(/[^\x20-\x7E]/g, ' ')
    .trim()
    .slice(0, 220);
}

function tokensFrom(value: string): string[] {
  return String(value || '').toLowerCase().match(/[a-z0-9][a-z0-9_-]{2,}/g) || [];
}

function normalizeSlug(value: string): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function titleCase(value: string): string {
  return normalizeSlug(value)
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(' ');
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.map((entry) => normalizeSlug(entry)).filter(Boolean)));
}

function positive(value: number | null | undefined, fallback: number): number {
  return Number.isFinite(value) && Number(value) > 0 ? Number(value) : fallback;
}

function normalizeApprovalId(value: string | null | undefined): string | null {
  const text = String(value || '').trim();
  return text.length >= 4 ? text : null;
}

function normalizePath(value: string): string {
  return value.replace(/\\/g, '/');
}

function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function ensureWithin(root: string, target: string): void {
  const relative = path.relative(path.resolve(root), path.resolve(target));
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Unsafe expansion target: ${target}`);
  }
}
