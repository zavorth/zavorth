/**
 * List external-agent capabilities (cli|http|acp|mcp) and import to SkillIR.
 * Default path is offline (profile-declared / capabilities file). No process spawn during import.
 * Live invoke remains approval-gated via ZavorthExternalAgentGatewayService.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

import {
  ZAVORTH_EXTERNAL_AGENT_CAPABILITY_IMPORT_CONTRACT_VERSION,
  type ExternalAgentCapabilityDescriptor,
  type ExternalAgentCapabilityImportReceipt,
  type ExternalAgentCapabilityImportResult,
  type ExternalAgentListCapabilitiesResult,
} from '../contracts/external/ZavorthExternalAgentCapabilityImportContract.js';
import type {
  ZavorthExternalAgentAdapterKind,
  ZavorthExternalAgentProfile,
} from '../contracts/external/ZavorthExternalAgentGatewayContract.js';
import { ZavorthExternalAgentGatewayService } from './ZavorthExternalAgentGatewayService.js';
import { SkillIrNormalizerService } from '../skills/SkillIrNormalizerService.js';
import { SkillSearchIndexService } from './SkillSearchIndexService.js';

export type ExternalAgentCapabilityImportRuntime = {
  projectRoot?: string;
  gateway?: ZavorthExternalAgentGatewayService;
  now?: () => Date;
  existsSync?: typeof fs.existsSync;
  readFileSync?: typeof fs.readFileSync;
  writeFileSync?: typeof fs.writeFileSync;
  mkdirSync?: typeof fs.mkdirSync;
  /** Test/fixture capabilities keyed by profile id. */
  fixtureCapabilities?: Record<string, ExternalAgentCapabilityDescriptor[]>;
};

export class ExternalAgentCapabilityImportService {
  private readonly projectRoot: string;
  private readonly gateway: ZavorthExternalAgentGatewayService;
  private readonly now: () => Date;
  private readonly existsSync: typeof fs.existsSync;
  private readonly readFileSync: typeof fs.readFileSync;
  private readonly writeFileSync: typeof fs.writeFileSync;
  private readonly mkdirSync: typeof fs.mkdirSync;
  private readonly fixtureCapabilities: Record<string, ExternalAgentCapabilityDescriptor[]>;
  private readonly irNormalizer = new SkillIrNormalizerService();

  constructor(runtime: ExternalAgentCapabilityImportRuntime = {}) {
    this.projectRoot = path.resolve(runtime.projectRoot || process.cwd());
    this.gateway = runtime.gateway || new ZavorthExternalAgentGatewayService({ projectRoot: this.projectRoot });
    this.now = runtime.now || (() => new Date());
    this.existsSync = runtime.existsSync || fs.existsSync.bind(fs);
    this.readFileSync = runtime.readFileSync || fs.readFileSync.bind(fs);
    this.writeFileSync = runtime.writeFileSync || fs.writeFileSync.bind(fs);
    this.mkdirSync = runtime.mkdirSync || fs.mkdirSync.bind(fs);
    this.fixtureCapabilities = runtime.fixtureCapabilities || {};
  }

  /**
   * List capabilities for a registered profile.
   * Offline by default: profile.allowedCapabilities + optional capabilities file.
   * Does not spawn processes or open network (onboarding invariant).
   */
  public listCapabilities(input: {
    profileId: string;
    /** Optional relative/absolute JSON file with { capabilities: [...] }. */
    capabilitiesFile?: string | null;
  }): ExternalAgentListCapabilitiesResult {
    const profileId = String(input.profileId || '').trim();
    const findings: string[] = [];
    const snapshot = this.gateway.buildRegistrySnapshot();
    const profile = snapshot.profiles.find((p) => p.id === profileId) || null;

    if (!profile) {
      return finishList({
        ok: false,
        profileId,
        adapter: null,
        capabilities: [],
        offline: true,
        findings: [`profile not found: ${profileId}`, 'Register first: zavorth external-agent register --id …'],
      });
    }

    const byId = new Map<string, ExternalAgentCapabilityDescriptor>();

    // 1) Fixture (tests)
    for (const cap of this.fixtureCapabilities[profileId] || []) {
      byId.set(cap.id, { ...cap, adapter: profile.adapter });
    }
    if (this.fixtureCapabilities[profileId]?.length) {
      findings.push(`fixture capabilities=${this.fixtureCapabilities[profileId].length}`);
    }

    // 2) Profile-declared allowedCapabilities (all adapters)
    for (const raw of profile.allowedCapabilities || []) {
      const id = String(raw || '').trim();
      if (!id || byId.has(id)) continue;
      byId.set(id, descriptorFromName(id, profile.adapter, 'profile-declared'));
    }
    findings.push(`profile-declared=${(profile.allowedCapabilities || []).length}`);

    // 3) Optional capabilities file (no network)
    const filePath = resolveCapabilitiesFile(this.projectRoot, profile, input.capabilitiesFile, this.existsSync);
    if (filePath && this.existsSync(filePath)) {
      try {
        const parsed = JSON.parse(this.readFileSync(filePath, 'utf8')) as unknown;
        const list = extractCapabilityList(parsed);
        for (const item of list) {
          const cap = normalizeCapability(item, profile.adapter, 'capabilities-file');
          if (cap && !byId.has(cap.id)) byId.set(cap.id, cap);
        }
        findings.push(`capabilities-file=${filePath} count=${list.length}`);
      } catch (error: unknown) {
        findings.push(`capabilities-file parse failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    } else if (input.capabilitiesFile) {
      findings.push(`capabilities-file missing: ${input.capabilitiesFile}`);
    }

    // 4) Adapter-specific offline hints (no live probe)
    findings.push(...adapterOfflineHints(profile));

    const capabilities = Array.from(byId.values()).sort((a, b) => a.id.localeCompare(b.id));

    return finishList({
      ok: capabilities.length > 0,
      profileId,
      adapter: profile.adapter,
      capabilities,
      offline: true,
      findings,
    });
  }

  /**
   * Import listed capabilities into a local SkillIR pack under skills/.
   * Requires consent=true. Never auto-imports. No process execution.
   */
  public importCapabilities(input: {
    profileId: string;
    consent?: boolean;
    capabilitiesFile?: string | null;
    skillId?: string | null;
    targetDir?: string | null;
  }): ExternalAgentCapabilityImportResult {
    const profileId = String(input.profileId || '').trim();
    const list = this.listCapabilities({
      profileId,
      capabilitiesFile: input.capabilitiesFile,
    });
    const generatedAt = this.now().toISOString();
    const receiptId = `ext-cap-import-${generatedAt.replace(/[:.]/g, '-')}-${profileId.slice(0, 24)}`;

    if (!list.ok || !list.capabilities.length) {
      const receipt = baseReceipt({
        id: receiptId,
        generatedAt,
        profileId,
        adapter: list.adapter,
        consent: input.consent === true,
        status: 'blocked',
        skillId: null,
        skillPath: null,
        skillIrDigest: null,
        capabilityIds: [],
        declaredTools: [],
        findings: ['no capabilities to import', ...list.findings],
        nextCommands: [
          `zavorth external-agent list-capabilities --id ${profileId}`,
          `zavorth external-agent register --id ${profileId} --adapter cli --approve-registration`,
        ],
      });
      return finishImport({ ok: false, consentRequired: input.consent !== true, receipt, list });
    }

    if (input.consent !== true) {
      const skillId = String(input.skillId || '').trim() || `external-${sanitizeId(profileId)}`;
      const receipt = baseReceipt({
        id: receiptId,
        generatedAt,
        profileId,
        adapter: list.adapter,
        consent: false,
        status: 'preview',
        skillId,
        skillPath: path.join(this.projectRoot, 'skills', skillId),
        skillIrDigest: null,
        capabilityIds: list.capabilities.map((c) => c.id),
        declaredTools: list.capabilities.map((c) => c.toolName || c.id),
        findings: [
          'consent_required',
          `Would import ${list.capabilities.length} capabilities into skills/${skillId}`,
          ...list.findings.slice(0, 6),
        ],
        nextCommands: [
          `zavorth external-agent import-capabilities --id ${profileId} --consent`,
          `zavorth external-agent run --id ${profileId} --prompt "<task>" --approve-external-execution`,
        ],
      });
      return finishImport({ ok: false, consentRequired: true, receipt, list });
    }

    try {
      const skillId = String(input.skillId || '').trim() || `external-${sanitizeId(profileId)}`;
      const skillPath = path.resolve(input.targetDir || path.join(this.projectRoot, 'skills', skillId));
      if (!isInside(this.projectRoot, skillPath)) {
        throw new Error('Refusing to write skill pack outside project root.');
      }

      this.mkdirSync(skillPath, { recursive: true });
      const tools = list.capabilities.map((c) => ({
        name: sanitizeToolName(c.toolName || c.id),
        description: c.summary || c.name,
      }));
      const title = `External agent: ${profileId}`;
      const description =
        `Imported declared capabilities from external profile ${profileId} ` +
        `(adapter=${list.adapter || 'unknown'}). Live invoke stays approval-gated.`;

      const skillMd = [
        '---',
        `name: ${skillId}`,
        `description: ${description.replace(/"/g, "'").slice(0, 200)}`,
        'tools:',
        ...tools.map((t) => ` ? name: ${t.name}`),
        '---',
        '',
        `# ${title}`,
        '',
        'Brand-agnostic SkillIR pack generated from an external-agent profile.',
        'These tools are **declared** only — runtime execution goes through the',
        'external agent gateway with per-call approval.',
        '',
        '## Capabilities',
        '',
        ...list.capabilities.map(
          (c) => `- \`${c.id}\` (${c.kind || 'tool'}) — ${c.summary || c.name} [via ${c.adapter}/${c.source}]`,
        ),
        '',
        '## Procedure (guidance)',
        '',
        '1. Confirm the external profile is registered and live-enabled.',
        '2. Prefer `zavorth external-agent run --id <profile> --prompt "..." --approve-external-execution`.',
        '3. Do not invent tool names beyond the declared list.',
        '4. Free-text chat never auto-imports or auto-invokes external agents.',
        '',
        '## Safety',
        '',
        '- Import does not spawn the external process.',
        '- Live invoke remains approval-gated (existing gateway rules).',
        '',
      ].join('\n');

      atomicWrite(path.join(skillPath, 'SKILL.md'), skillMd.endsWith('\n') ? skillMd : `${skillMd}\n`);
      atomicWrite(
        path.join(skillPath, 'manifest.json'),
        `${JSON.stringify(
          {
            name: skillId,
            version: '1.0.0',
            description,
            author: 'external-agent-capability-import',
            fromProfileId: profileId,
            adapter: list.adapter,
            importedAt: generatedAt,
            tools: tools.map((t) => ({ name: t.name, description: t.description })),
            capabilities: list.capabilities.map((c) => ({
              id: c.id,
              name: c.name,
              kind: c.kind,
              source: c.source,
            })),
          },
          null,
          2,
        )}\n`,
      );
      atomicWrite(
        path.join(skillPath, 'ORIGIN.json'),
        `${JSON.stringify(
          {
            kind: 'external-agent-capability-import',
            profileId,
            adapter: list.adapter,
            importedAt: generatedAt,
            autoImport: false,
            liveInvokeStillApprovalGated: true,
            processExecutedDuringImport: false,
          },
          null,
          2,
        )}\n`,
      );

      const ir = this.irNormalizer.normalizeFromDir({
        skillDir: skillPath,
        sourceUri: `external-agent://${profileId}`,
        sourceKind: 'external-agent-import',
        skillId,
        now: this.now,
      });
      atomicWrite(
        path.join(skillPath, 'skill.ir.json'),
        `${JSON.stringify(
          {
            skillIr: ir.skillIr,
            skillIrDigest: ir.skillIrDigest,
            fromProfileId: profileId,
            importedAt: generatedAt,
          },
          null,
          2,
        )}\n`,
      );

      const receipt = baseReceipt({
        id: receiptId,
        generatedAt,
        profileId,
        adapter: list.adapter,
        consent: true,
        status: 'applied',
        skillId,
        skillPath,
        skillIrDigest: ir.skillIrDigest,
        capabilityIds: list.capabilities.map((c) => c.id),
        declaredTools: tools.map((t) => t.name),
        findings: [
          `imported capabilities=${list.capabilities.length}`,
          `skillPath=${path.relative(this.projectRoot, skillPath).replace(/\\/g, '/')}`,
          `skillIrDigest=${ir.skillIrDigest.slice(0, 16)}…`,
          ...list.findings.slice(0, 4),
        ],
        nextCommands: [
          `zavorth skill search ${tools[0]?.name || skillId}`,
          `zavorth external-agent run --id ${profileId} --prompt "<task>" --approve-external-execution`,
        ],
      });

      this.persistReceipt(receipt);

      // Soft invalidate search index if present in-process
      try {
        new SkillSearchIndexService({ projectRoot: this.projectRoot }).invalidate();
      } catch {
        /* soft */
      }

      return finishImport({ ok: true, consentRequired: false, receipt, list });
    } catch (error: unknown) {
      const receipt = baseReceipt({
        id: receiptId,
        generatedAt,
        profileId,
        adapter: list.adapter,
        consent: true,
        status: 'failed',
        skillId: null,
        skillPath: null,
        skillIrDigest: null,
        capabilityIds: list.capabilities.map((c) => c.id),
        declaredTools: list.capabilities.map((c) => c.toolName || c.id),
        findings: [`import_failed=${error instanceof Error ? error.message : String(error)}`],
        nextCommands: [`zavorth external-agent import-capabilities --id ${profileId} --consent`],
      });
      return finishImport({ ok: false, consentRequired: false, receipt, list });
    }
  }

  private persistReceipt(receipt: ExternalAgentCapabilityImportReceipt): void {
    try {
      const dir = path.join(this.projectRoot, 'data', 'runtime', 'external-agent-capability-imports');
      this.mkdirSync(dir, { recursive: true });
      atomicWrite(path.join(dir, `${receipt.id}.json`), `${JSON.stringify(receipt, null, 2)}\n`);
    } catch {
      /* soft */
    }
  }
}

function finishList(partial: {
  ok: boolean;
  profileId: string;
  adapter: ZavorthExternalAgentAdapterKind | null;
  capabilities: ExternalAgentCapabilityDescriptor[];
  offline: boolean;
  findings: string[];
}): ExternalAgentListCapabilitiesResult {
  const capabilities = partial.capabilities;
  return {
    contractVersion: ZAVORTH_EXTERNAL_AGENT_CAPABILITY_IMPORT_CONTRACT_VERSION,
    ok: partial.ok,
    profileId: partial.profileId,
    adapter: partial.adapter,
    capabilities,
    offline: partial.offline,
    processExecuted: false,
    findings: partial.findings,
    formatText() {
      const lines = [
        `External agent capabilities: ${partial.profileId}`,
        `adapter=${partial.adapter || '—'} offline=${partial.offline} processExecuted=false count=${capabilities.length}`,
        ...capabilities.slice(0, 40).map((c) => ` ? ${c.id} | ${c.name} | ${c.kind || 'tool'} | ${c.source}`),
        ...partial.findings.map((f) => `  note: ${f}`),
      ];
      if (!capabilities.length) lines.push('  (none — set allowedCapabilities or a capabilities file)');
      return lines.join('\n');
    },
  };
}

function finishImport(partial: {
  ok: boolean;
  consentRequired: boolean;
  receipt: ExternalAgentCapabilityImportReceipt;
  list: ExternalAgentListCapabilitiesResult | null;
}): ExternalAgentCapabilityImportResult {
  const { ok, consentRequired, receipt, list } = partial;
  return {
    ok,
    autoImport: false,
    consentRequired,
    receipt,
    list,
    formatText() {
      return [
        `External agent capability import: ${receipt.profileId}`,
        `status=${receipt.status} consent=${receipt.consent} autoImport=false`,
        `skillId=${receipt.skillId || '—'}`,
        receipt.skillPath ? `skillPath=${receipt.skillPath}` : null,
        receipt.skillIrDigest ? `skillIrDigest=${receipt.skillIrDigest.slice(0, 24)}…` : null,
        `tools=${receipt.declaredTools.join(', ') || '—'}`,
        `liveInvokeStillApprovalGated=true processExecutedDuringImport=false`,
        ...receipt.findings.map((f) => `  ${f}`),
        ...receipt.nextCommands.map((c) => `  next: ${c}`),
        list ? list.formatText() : null,
      ]
        .filter(Boolean)
        .join('\n');
    },
  };
}

function baseReceipt(input: {
  id: string;
  generatedAt: string;
  profileId: string;
  adapter: ZavorthExternalAgentAdapterKind | null;
  consent: boolean;
  status: ExternalAgentCapabilityImportReceipt['status'];
  skillId: string | null;
  skillPath: string | null;
  skillIrDigest: string | null;
  capabilityIds: string[];
  declaredTools: string[];
  findings: string[];
  nextCommands: string[];
}): ExternalAgentCapabilityImportReceipt {
  return {
    schemaVersion: 'zavorth.external-agent-capability-import-receipt.v1',
    contractVersion: ZAVORTH_EXTERNAL_AGENT_CAPABILITY_IMPORT_CONTRACT_VERSION,
    id: input.id,
    generatedAt: input.generatedAt,
    profileId: input.profileId,
    adapter: input.adapter,
    consent: input.consent,
    status: input.status,
    skillId: input.skillId,
    skillPath: input.skillPath,
    skillIrDigest: input.skillIrDigest,
    capabilityIds: input.capabilityIds,
    declaredTools: input.declaredTools,
    autoImport: false,
    liveInvokeStillApprovalGated: true,
    processExecutedDuringImport: false,
    findings: input.findings,
    nextCommands: input.nextCommands,
  };
}

function descriptorFromName(
  id: string,
  adapter: ZavorthExternalAgentAdapterKind,
  source: ExternalAgentCapabilityDescriptor['source'],
): ExternalAgentCapabilityDescriptor {
  return {
    id,
    name: id,
    toolName: sanitizeToolName(id),
    kind: 'tool',
    adapter,
    source,
    summary: `Declared capability ${id}`,
  };
}

function normalizeCapability(
  item: unknown,
  adapter: ZavorthExternalAgentAdapterKind,
  source: ExternalAgentCapabilityDescriptor['source'],
): ExternalAgentCapabilityDescriptor | null {
  if (typeof item === 'string') {
    const id = item.trim();
    return id ? descriptorFromName(id, adapter, source) : null;
  }
  if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
  const rec = item as Record<string, unknown>;
  const id = String(rec.id || rec.name || rec.tool || '').trim();
  if (!id) return null;
  return {
    id,
    name: String(rec.name || id),
    summary: rec.summary != null ? String(rec.summary) : rec.description != null ? String(rec.description) : undefined,
    toolName: sanitizeToolName(String(rec.toolName || rec.tool || id)),
    kind: normalizeKind(rec.kind),
    adapter,
    source,
    permissions: Array.isArray(rec.permissions) ? rec.permissions.map(String) : undefined,
    metadata:
      typeof rec.metadata === 'object' && rec.metadata && !Array.isArray(rec.metadata)
        ? (rec.metadata as Record<string, unknown>)
        : undefined,
  };
}

function normalizeKind(value: unknown): ExternalAgentCapabilityDescriptor['kind'] {
  const k = String(value || 'tool').toLowerCase();
  if (k === 'skill' || k === 'resource' || k === 'prompt' || k === 'tool') return k;
  return 'unknown';
}

function extractCapabilityList(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === 'object') {
    const o = raw as { capabilities?: unknown; tools?: unknown; entries?: unknown };
    if (Array.isArray(o.capabilities)) return o.capabilities;
    if (Array.isArray(o.tools)) return o.tools;
    if (Array.isArray(o.entries)) return o.entries;
  }
  return [];
}

function resolveCapabilitiesFile(
  projectRoot: string,
  profile: ZavorthExternalAgentProfile,
  explicit: string | null | undefined,
  existsSync: typeof fs.existsSync,
): string | null {
  if (explicit) {
    const p = String(explicit).trim();
    if (!p) return null;
    return path.isAbsolute(p) ? p : path.join(projectRoot, p);
  }
  // Convention: data/runtime/external-agent-capabilities/<id>.json
  const conventional = path.join(projectRoot, 'data', 'runtime', 'external-agent-capabilities', `${profile.id}.json`);
  if (existsSync(conventional)) return conventional;
  if (profile.root) {
    const beside = path.join(profile.root, 'capabilities.json');
    if (existsSync(beside)) return beside;
  }
  return null;
}

function adapterOfflineHints(profile: ZavorthExternalAgentProfile): string[] {
  switch (profile.adapter) {
    case 'cli':
      return ['cli: offline list uses allowedCapabilities + optional capabilities file (no spawn)'];
    case 'http':
      return ['http: offline list uses declared capabilities (live tools/list requires separate approved probe)'];
    case 'acp':
      return ['acp: offline list uses allowedCapabilities (ACP session not started during list)'];
    case 'mcp':
      return ['mcp: offline list uses allowedCapabilities (tools/list not called during import)'];
    default:
      return [];
  }
}

function sanitizeId(value: string): string {
  return (
    String(value || '')
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 64) || 'agent'
  );
}

function sanitizeToolName(value: string): string {
  return (
    String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_./-]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 80) || 'external_tool'
  );
}

function isInside(root: string, target: string): boolean {
  const resolvedRoot = path.resolve(root);
  const resolvedTarget = path.resolve(target);
  const relative = path.relative(resolvedRoot, resolvedTarget);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function atomicWrite(file: string, content: string): void {
  const dir = path.dirname(file);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = path.join(dir, `.${path.basename(file)}.${crypto.randomBytes(4).toString('hex')}.tmp`);
  fs.writeFileSync(tmp, content, 'utf8');
  fs.renameSync(tmp, file);
}
