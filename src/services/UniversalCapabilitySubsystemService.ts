import { asErrorLike } from '../utils/errorLike';
import { SkillWebScraper } from '../skills/marketplace/SkillWebScraper.js';
/**
 * Universal Capability Fabric Service
 *
 * Discovers, classifies, quarantines, and optionally materializes
 * skills / plugins / MCP packs from path, archive, or HTTPS URL.
 *
 * Design rules:
 * - brand-agnostic (no third-party product profiles)
 * - preview-first
 * - executable code is higher trust than instruction packs
 * - MCP always materializes disabled
 * - receipts never carry raw secrets
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  UNIVERSAL_CAPABILITY_FABRIC_CONTRACT_VERSION,
  type CapabilityFabricCandidate,
  type CapabilityFabricIssue,
  type CapabilityFabricKind,
  type CapabilityFabricReceipt,
  type CapabilityFabricRiskLevel,
  type CapabilityFabricSnapshot,
  type CapabilityFabricSourceKind,
  type CapabilityFabricSourceRef,
  type CapabilityFabricSummary,
} from '../contracts/UniversalCapabilityFabricContract.js';

import { UniversalSkillTrustImportService } from '../skills/UniversalSkillTrustImportService.js';
import { assertPathUnderProjectRoot } from './UniversalWorkspaceImportService.js';

export type UniversalCapabilityFabricInput = {
  source: string;
  kind?: CapabilityFabricKind | 'auto';
  sourceKind?: CapabilityFabricSourceKind;
  apply?: boolean;
  allowExecutable?: boolean;
  allowAllCandidates?: boolean;
  overwrite?: boolean;
  label?: string;
  projectRoot?: string;
  quarantineRoot?: string;
};

type Runtime = {
  projectRoot?: string;
  now?: () => Date;
  fetchImpl?: typeof fetch;
  skillImport?: Pick<UniversalSkillTrustImportService, 'buildSnapshot'>;
  webScraper?: Pick<SkillWebScraper, 'scrape'>;
  existsSync?: typeof fs.existsSync;
  mkdirSync?: typeof fs.mkdirSync;
  readdirSync?: typeof fs.readdirSync;
  statSync?: typeof fs.statSync;
  readFileSync?: typeof fs.readFileSync;
  writeFileSync?: typeof fs.writeFileSync;
  cpSync?: typeof fs.cpSync;
  rmSync?: typeof fs.rmSync;
};

const SECRET_LIKE = [/api[_-]?key/i, /secret/i, /token/i, /password/i, /credential/i, /BEGIN (RSA |OPENSSH )?PRIVATE KEY/i];
const EXEC_EXTENSIONS = new Set(['.js', '.mjs', '.cjs', '.ts', '.tsx', '.py', '.sh', '.ps1', '.bat', '.exe', '.dll']);
const SKILL_MARKERS = new Set(['skill.md', 'skills.md']);
const PLUGIN_MARKERS = new Set(['plugin.json', 'extension.json', 'zavorth.plugin.json']);
const MCP_MARKERS = new Set(['mcp.json', 'mcp-servers.json', 'servers.json']);

export class UniversalCapabilitySubsystemService {
  private readonly projectRoot: string;
  private readonly now: () => Date;
  private readonly skillImport: Pick<UniversalSkillTrustImportService, 'buildSnapshot'>;
  private readonly webScraper: Pick<SkillWebScraper, 'scrape'>;
  private readonly existsSync: typeof fs.existsSync;
  private readonly mkdirSync: typeof fs.mkdirSync;
  private readonly readdirSync: typeof fs.readdirSync;
  private readonly statSync: typeof fs.statSync;
  private readonly readFileSync: typeof fs.readFileSync;
  private readonly writeFileSync: typeof fs.writeFileSync;
  private readonly cpSync: typeof fs.cpSync;
  private readonly rmSync: typeof fs.rmSync;

  constructor(runtime: Runtime = {}) {
    this.projectRoot = runtime.projectRoot || process.cwd();
    this.now = runtime.now || (() => new Date());
    this.skillImport = runtime.skillImport || new UniversalSkillTrustImportService({ projectRoot: this.projectRoot });
    this.webScraper = runtime.webScraper || new SkillWebScraper();
    this.existsSync = runtime.existsSync || fs.existsSync.bind(fs);
    this.mkdirSync = runtime.mkdirSync || fs.mkdirSync.bind(fs);
    this.readdirSync = runtime.readdirSync || fs.readdirSync.bind(fs);
    this.statSync = runtime.statSync || fs.statSync.bind(fs);
    this.readFileSync = runtime.readFileSync || fs.readFileSync.bind(fs);
    this.writeFileSync = runtime.writeFileSync || fs.writeFileSync.bind(fs);
    this.cpSync = runtime.cpSync || fs.cpSync.bind(fs);
    this.rmSync = runtime.rmSync || fs.rmSync.bind(fs);
  }

  public async buildSnapshot(input: UniversalCapabilityFabricInput): Promise<CapabilityFabricSnapshot> {
    const apply = input.apply === true;
    const issues: CapabilityFabricIssue[] = [];
    const receipts: CapabilityFabricReceipt[] = [];
    const quarantineRoot = assertPathUnderProjectRoot(
      this.projectRoot,
      input.quarantineRoot
        || path.join(this.projectRoot, '.zavorth', 'capability-quarantine'),
      'quarantineRoot',
    );

    const source = await this.resolveSource(input, quarantineRoot, issues);
    if (!source.resolvedLocalPath) {
      return this.emptyBlocked(source, quarantineRoot, issues, apply, 'Source could not be resolved for intake.');
    }

    const candidates = this.discoverCandidates(source, input.kind || 'auto', quarantineRoot, issues);
    let materialized = 0;
    let denied = 0;
    let held = 0;

    for (const candidate of candidates) {
      candidate.trustState = 'previewed';
      const allow = this.decideAllow(candidate, input);
      if (!allow.ok) {
        candidate.trustState = 'denied';
        denied += 1;
        receipts.push(this.receipt('deny', candidate, allow.reason, null));
        continue;
      }

      if (!apply) {
        held += 1;
        candidate.trustState = 'quarantined';
        receipts.push(this.receipt('preview', candidate, allow.reason, null));
        continue;
      }

      const target = this.materializeCandidate(candidate, source, quarantineRoot, input.overwrite === true, issues);
      if (!target) {
        candidate.trustState = 'denied';
        denied += 1;
        receipts.push(this.receipt('deny', candidate, 'Materialization failed.', null));
        continue;
      }

      // Skills can use the existing trust importer when applying for real library placement.
      if (candidate.kind === 'skill' && input.allowAllCandidates) {
        try {
          const skillSnap = await this.skillImport.buildSnapshot({
            sourcePath: source.resolvedLocalPath,
            apply: true,
            overwrite: input.overwrite === true,
            allowSource: true,
            allowAllCandidates: true,
            sourceLabel: source.label,
          });
          if (skillSnap.summary.materialized > 0) {
            materialized += skillSnap.summary.materialized;
            candidate.trustState = 'enabled';
            receipts.push(this.receipt('materialize', candidate, `Skill import status=${skillSnap.status}`, skillSnap.targetRootPath));
            continue;
          }
        } catch {
          // Fall through to quarantine materialization.
        }
      }

      if (candidate.kind === 'mcp') {
        candidate.trustState = 'approved'; // quarantined/disabled enable hold
        held += 1;
        receipts.push(this.receipt('enable-hold', candidate, 'MCP pack materialised disabled; enable requires separate approval.', target));
        materialized += 1;
        continue;
      }

      if (candidate.executableCodeDetected && !input.allowExecutable) {
        candidate.trustState = 'approved';
        held += 1;
        receipts.push(this.receipt('enable-hold', candidate, 'Executable pack held for higher-trust enable.', target));
        materialized += 1;
        continue;
      }

      candidate.trustState = 'enabled';
      materialized += 1;
      receipts.push(this.receipt('materialize', candidate, allow.reason, target));
    }

    const summary = this.summarize(candidates, materialized, denied, held);
    const status = this.statusOf(apply, summary, issues);
    return {
      contractVersion: UNIVERSAL_CAPABILITY_FABRIC_CONTRACT_VERSION,
      generatedAt: this.now().toISOString(),
      status,
      apply,
      source,
      candidates,
      issues,
      receipts,
      summary,
      policy: {
        previewBeforeMutate: true,
        approvalRequiredForEnable: true,
        executablePluginsHigherTrust: true,
        mcpStartsDisabled: true,
        instructionSkillsDefault: true,
        catalogIsNotLive: true,
        rawSecretsSerialized: false,
        brandAgnostic: true,
      },
      quarantineRoot,
      narrative: this.narrative(status, summary, apply),
    };
  }

  private async resolveSource(
    input: UniversalCapabilityFabricInput,
    quarantineRoot: string,
    issues: CapabilityFabricIssue[],
  ): Promise<CapabilityFabricSourceRef> {
    const raw = String(input.source || '').trim();
    const label = input.label || raw || 'unknown-source';
    if (!raw) {
      issues.push({ severity: 'blocked', code: 'source.missing', message: 'No source provided.' });
      return {
        raw,
        kind: 'auto',
        label,
        resolvedLocalPath: null,
        remoteUrl: null,
        contentHash: null,
      };
    }

    const kind = input.sourceKind && input.sourceKind !== 'auto'
      ? input.sourceKind
      : this.detectSourceKind(raw);

    if (kind === 'path' || kind === 'archive') {
      const resolved = path.resolve(raw);
      if (!this.existsSync(resolved)) {
        issues.push({ severity: 'blocked', code: 'source.not_found', message: `Path not found: ${resolved}` });
        return {
          raw,
          kind,
          label,
          resolvedLocalPath: null,
          remoteUrl: null,
          contentHash: null,
        };
      }
      return {
        raw,
        kind,
        label,
        resolvedLocalPath: resolved,
        remoteUrl: null,
        contentHash: this.hashPath(resolved),
      };
    }

    if (kind === 'https-url' || kind === 'git-url') {
      const remoteUrl = raw.startsWith('http') ? raw : `https://${raw}`;
      try {
        const scrape = await this.webScraper.scrape(remoteUrl);
        const stageDir = path.join(quarantineRoot, 'remote-stage', this.safeId(label));
        this.mkdirSync(stageDir, { recursive: true });
        const metaPath = path.join(stageDir, 'SOURCE.json');
        const skillMd = path.join(stageDir, 'SKILL.md');
        const body = [
          '---',
          `name: ${scrape.skill?.name || path.basename(remoteUrl) || 'remote-skill'}`,
          `description: ${scrape.skill?.description || 'Absorbed from remote capability source.'}`,
          '---',
          '',
          `# ${scrape.skill?.name || 'Remote capability'}`,
          '',
          scrape.skill?.description || 'Remote capability source staged for governed review.',
          '',
          scrape.success && scrape.rawContent
            ? scrape.rawContent.slice(0, 6000)
            : `_Source fetch note: ${scrape.error || 'ok'}_`,
          '',
          '## Origin',
          '',
          `- url: ${remoteUrl}`,
          `- install_hints: ${(scrape.skill?.installUrls || []).map((u) => u.url).slice(0, 5).join(', ') || 'none'}`,
          '',
        ].join('\n');
        this.writeFileSync(skillMd, body, 'utf8');
        this.writeFileSync(metaPath, JSON.stringify({
          source: remoteUrl,
          scrapedAt: this.now().toISOString(),
          success: scrape.success,
          error: scrape.error || null,
          installUrls: scrape.skill?.installUrls || [],
        }, null, 2), 'utf8');
        if (!scrape.success) {
          issues.push({
            severity: 'warn',
            code: 'source.remote_partial',
            message: scrape.error || 'Remote scrape incomplete; staged for manual review.',
          });
        }
        return {
          raw,
          kind,
          label: scrape.skill?.name || label,
          resolvedLocalPath: stageDir,
          remoteUrl,
          contentHash: crypto.createHash('sha256').update(body).digest('hex'),
        };
      } catch (error: unknown) {
        const err = asErrorLike(error);
        issues.push({
          severity: 'blocked',
          code: 'source.remote_failed',
          message: error instanceof Error ? err.message : String(error),
        });
        return {
          raw,
          kind,
          label,
          resolvedLocalPath: null,
          remoteUrl,
          contentHash: null,
        };
      }
    }

    // inline-text fallback: write a temporary skill markdown
    const stageDir = path.join(quarantineRoot, 'inline-stage', this.safeId(label));
    this.mkdirSync(stageDir, { recursive: true });
    const skillMd = path.join(stageDir, 'SKILL.md');
    this.writeFileSync(skillMd, `# Inline capability\n\n${raw.slice(0, 8000)}\n`, 'utf8');
    return {
      raw: raw.slice(0, 200),
      kind: 'inline-text',
      label,
      resolvedLocalPath: stageDir,
      remoteUrl: null,
      contentHash: crypto.createHash('sha256').update(raw).digest('hex'),
    };
  }

  private detectSourceKind(raw: string): CapabilityFabricSourceKind {
    if (/^https:\/\//i.test(raw)) {
      if (/\.git(\b|$)/i.test(raw) || /github\.com\/.+\/.+/i.test(raw) || /gitlab\.com\/.+\/.+/i.test(raw)) {
        return /github\.com|gitlab\.com/i.test(raw) && !/\.zip(\b|$)/i.test(raw) ? 'git-url' : 'https-url';
      }
      return 'https-url';
    }
    if (/\.(zip|tgz|tar\.gz)$/i.test(raw)) return 'archive';
    if (this.existsSync(path.resolve(raw))) return 'path';
    if (raw.includes('\n') || raw.length > 400) return 'inline-text';
    return 'path';
  }

  private discoverCandidates(
    source: CapabilityFabricSourceRef,
    requestedKind: CapabilityFabricKind | 'auto',
    quarantineRoot: string,
    issues: CapabilityFabricIssue[],
  ): CapabilityFabricCandidate[] {
    const root = source.resolvedLocalPath!;
    const files = this.walkFiles(root, 400);
    const lowerNames = files.map((f) => path.basename(f).toLowerCase());
    const hasSkill = lowerNames.some((n) => SKILL_MARKERS.has(n)) || files.some((f) => /skill\.md$/i.test(f));
    const hasPlugin = lowerNames.some((n) => PLUGIN_MARKERS.has(n));
    const hasMcp = lowerNames.some((n) => MCP_MARKERS.has(n));
    const exec = files.some((f) => EXEC_EXTENSIONS.has(path.extname(f).toLowerCase()));
    const secretLike = files.some((f) => {
      try {
        if (this.statSync(f).size > 256_000) return false;
        const text = this.readFileSync(f, 'utf8');
        return SECRET_LIKE.some((re) => re.test(text));
      } catch {
        return false;
      }
    });

    const kinds: CapabilityFabricKind[] = [];
    if (requestedKind !== 'auto') {
      kinds.push(requestedKind);
    } else {
      if (hasSkill) kinds.push('skill');
      if (hasPlugin) kinds.push('plugin');
      if (hasMcp) kinds.push('mcp');
      if (kinds.length === 0) kinds.push(exec ? 'plugin' : 'skill');
    }

    if (secretLike) {
      issues.push({
        severity: 'warn',
        code: 'source.secret_like',
        message: 'Secret-like content detected; values will not be serialised into receipts.',
      });
    }

    return kinds.map((kind, index) => {
      const risk = this.riskFor(kind, exec, secretLike);
      const name = path.basename(root) || `${kind}-candidate`;
      const id = `${kind}:${this.safeId(name)}:${index}`;
      return {
        id,
        kind,
        name,
        title: `${kind} · ${name}`,
        description: `Discovered ${kind} pack from ${source.label}`,
        relativeEntry: this.entryFor(kind, files, root),
        trustState: 'discovered',
        risk,
        reasons: [
          hasSkill ? 'skill-marker' : '',
          hasPlugin ? 'plugin-marker' : '',
          hasMcp ? 'mcp-marker' : '',
          exec ? 'executable-code' : 'instruction-or-data',
          secretLike ? 'secret-like-present' : '',
        ].filter(Boolean),
        tags: [kind, source.kind, risk],
        executableCodeDetected: exec && kind !== 'skill',
        instructionOnly: kind === 'skill' || !exec,
        targetDirHint: path.join(quarantineRoot, kind, this.safeId(name)),
      };
    });
  }

  private entryFor(kind: CapabilityFabricKind, files: string[], root: string): string | null {
    const prefer = kind === 'skill'
      ? SKILL_MARKERS
      : kind === 'plugin'
        ? PLUGIN_MARKERS
        : kind === 'mcp'
          ? MCP_MARKERS
          : new Set<string>();
    for (const file of files) {
      if (prefer.has(path.basename(file).toLowerCase())) {
        return path.relative(root, file).replace(/\\/g, '/');
      }
    }
    return files[0] ? path.relative(root, files[0]).replace(/\\/g, '/') : null;
  }

  private riskFor(kind: CapabilityFabricKind, exec: boolean, secretLike: boolean): CapabilityFabricRiskLevel {
    if (secretLike) return 'critical';
    if (kind === 'mcp') return exec ? 'high' : 'medium';
    if (kind === 'plugin' && exec) return 'high';
    if (kind === 'plugin') return 'medium';
    if (kind === 'skill') return exec ? 'medium' : 'low';
    return 'medium';
  }

  private decideAllow(
    candidate: CapabilityFabricCandidate,
    input: UniversalCapabilityFabricInput,
  ): { ok: boolean; reason: string } {
    if (candidate.risk === 'critical' && input.allowAllCandidates !== true) {
      return { ok: false, reason: 'Critical risk candidate denied without explicit allow-all confirmation.' };
    }
    if (candidate.executableCodeDetected && input.allowExecutable !== true && input.apply === true && input.allowAllCandidates !== true) {
      // Still allow quarantine materialize; enable held later
      return { ok: true, reason: 'Executable candidate accepted into quarantine only.' };
    }
    return { ok: true, reason: `Candidate accepted for ${input.apply ? 'materialization' : 'preview'}.` };
  }

  private materializeCandidate(
    candidate: CapabilityFabricCandidate,
    source: CapabilityFabricSourceRef,
    quarantineRoot: string,
    overwrite: boolean,
    issues: CapabilityFabricIssue[],
  ): string | null {
    if (!source.resolvedLocalPath) return null;
    const rawTarget = candidate.targetDirHint || path.join(quarantineRoot, candidate.kind, this.safeId(candidate.name));
    // Materialize targets must stay under the pinned quarantine root (S2).
    const target = assertPathUnderProjectRoot(quarantineRoot, rawTarget, 'materializeTarget');
    try {
      if (this.existsSync(target)) {
        if (!overwrite) {
          // merge-safe: write into timestamped subdir
          const alt = assertPathUnderProjectRoot(
            quarantineRoot,
            `${target}-${Date.now()}`,
            'materializeTarget',
          );
          this.mkdirSync(path.dirname(alt), { recursive: true });
          this.cpSync(source.resolvedLocalPath, alt, { recursive: true });
          this.writeManifest(alt, candidate, source);
          if (candidate.kind === 'mcp') this.writeMcpDisabledManifest(alt, candidate);
          return alt;
        }
        this.rmSync(target, { recursive: true, force: true });
      }
      this.mkdirSync(path.dirname(target), { recursive: true });
      this.cpSync(source.resolvedLocalPath, target, { recursive: true });
      this.writeManifest(target, candidate, source);
      if (candidate.kind === 'mcp') this.writeMcpDisabledManifest(target, candidate);
      return target;
    } catch (error: unknown) {
      const err = asErrorLike(error);
      issues.push({
        severity: 'error',
        code: 'materialize.failed',
        message: error instanceof Error ? err.message : String(error),
        candidateId: candidate.id,
      });
      return null;
    }
  }

  private writeManifest(
    target: string,
    candidate: CapabilityFabricCandidate,
    source: CapabilityFabricSourceRef,
  ): void {
    const manifest = {
      contractVersion: UNIVERSAL_CAPABILITY_FABRIC_CONTRACT_VERSION,
      candidate,
      source: {
        raw: source.raw,
        kind: source.kind,
        label: source.label,
        remoteUrl: source.remoteUrl,
        contentHash: source.contentHash,
      },
      absorbedAt: this.now().toISOString(),
      enabled: candidate.kind === 'skill' && candidate.instructionOnly,
      live: false,
    };
    this.writeFileSync(path.join(target, 'ZAVORTH_ABSORB.json'), JSON.stringify(manifest, null, 2), 'utf8');
  }

  private writeMcpDisabledManifest(target: string, candidate: CapabilityFabricCandidate): void {
    const mcpPath = path.join(target, 'mcp-servers.disabled.json');
    this.writeFileSync(mcpPath, JSON.stringify({
      enabled: false,
      servers: [
        {
          id: candidate.id,
          name: candidate.name,
          enabled: false,
          trustState: 'quarantined',
          note: 'Absorbed by Universal Capability Fabric. Enable requires explicit approval.',
        },
      ],
    }, null, 2), 'utf8');
  }

  private walkFiles(root: string, limit: number): string[] {
    const out: string[] = [];
    const stack = [root];
    while (stack.length && out.length < limit) {
      const current = stack.pop()!;
      let entries: fs.Dirent[];
      try {
        entries = this.readdirSync(current, { withFileTypes: true }) as fs.Dirent[];
      } catch {
        continue;
      }
      for (const entry of entries) {
        if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist') continue;
        const full = path.join(current, entry.name);
        if (entry.isDirectory()) stack.push(full);
        else out.push(full);
        if (out.length >= limit) break;
      }
    }
    return out;
  }

  private hashPath(target: string): string {
    try {
      if (this.statSync(target).isFile()) {
        return crypto.createHash('sha256').update(this.readFileSync(target)).digest('hex');
      }
      const names = this.readdirSync(target).slice(0, 50).join('|');
      return crypto.createHash('sha256').update(`${target}|${names}`).digest('hex');
    } catch {
      return crypto.createHash('sha256').update(target).digest('hex');
    }
  }

  private safeId(value: string): string {
    return String(value || 'item')
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 64) || 'item';
  }

  private receipt(
    kind: CapabilityFabricReceipt['kind'],
    candidate: CapabilityFabricCandidate,
    summary: string,
    targetPath: string | null,
  ): CapabilityFabricReceipt {
    return {
      id: `rcpt_${crypto.randomBytes(6).toString('hex')}`,
      kind,
      candidateId: candidate.id,
      capabilityKind: candidate.kind,
      status: kind === 'deny' ? 'deny' : kind === 'enable-hold' ? 'hold' : 'pass',
      summary,
      targetPath,
      noLiveExecution: true,
      rawSecretsSerialized: false,
      createdAt: this.now().toISOString(),
    };
  }

  private summarize(
    candidates: CapabilityFabricCandidate[],
    materialized: number,
    denied: number,
    held: number,
  ): CapabilityFabricSummary {
    return {
      sources: 1,
      candidates: candidates.length,
      skills: candidates.filter((c) => c.kind === 'skill').length,
      plugins: candidates.filter((c) => c.kind === 'plugin').length,
      mcp: candidates.filter((c) => c.kind === 'mcp').length,
      unknown: candidates.filter((c) => c.kind === 'unknown').length,
      highRisk: candidates.filter((c) => c.risk === 'high' || c.risk === 'critical').length,
      executableCode: candidates.filter((c) => c.executableCodeDetected).length,
      materialized,
      denied,
      heldForApproval: held,
    };
  }

  private statusOf(
    apply: boolean,
    summary: CapabilityFabricSummary,
    issues: CapabilityFabricIssue[],
  ): CapabilityFabricSnapshot['status'] {
    if (issues.some((i) => i.severity === 'blocked') && summary.candidates === 0) return 'blocked';
    if (!apply) return 'preview-only';
    if (summary.materialized > 0 && summary.denied === 0) return 'passed';
    if (summary.materialized > 0) return 'partial';
    return 'blocked';
  }

  private narrative(
    status: CapabilityFabricSnapshot['status'],
    summary: CapabilityFabricSummary,
    apply: boolean,
  ): CapabilityFabricSnapshot['narrative'] {
    if (!apply) {
      return {
        headline: 'Capability intake preview ready',
        operatorSummary: `Found ${summary.candidates} candidate(s): ${summary.skills} skill, ${summary.plugins} plugin, ${summary.mcp} mcp.`,
        nextSafeAction: 'Review candidates, then re-run with apply/approval to quarantine or enable.',
      };
    }
    return {
      headline: `Capability intake ${status}`,
      operatorSummary: `Materialized ${summary.materialized}, held ${summary.heldForApproval}, denied ${summary.denied}.`,
      nextSafeAction: summary.heldForApproval > 0
        ? 'Approve enable for held packs (especially executable plugins / MCP).'
        : 'Use the absorbed capability through governed actions only.',
    };
  }

  private emptyBlocked(
    source: CapabilityFabricSourceRef,
    quarantineRoot: string,
    issues: CapabilityFabricIssue[],
    apply: boolean,
    headline: string,
  ): CapabilityFabricSnapshot {
    return {
      contractVersion: UNIVERSAL_CAPABILITY_FABRIC_CONTRACT_VERSION,
      generatedAt: this.now().toISOString(),
      status: 'blocked',
      apply,
      source,
      candidates: [],
      issues,
      receipts: [],
      summary: {
        sources: 1,
        candidates: 0,
        skills: 0,
        plugins: 0,
        mcp: 0,
        unknown: 0,
        highRisk: 0,
        executableCode: 0,
        materialized: 0,
        denied: 0,
        heldForApproval: 0,
      },
      policy: {
        previewBeforeMutate: true,
        approvalRequiredForEnable: true,
        executablePluginsHigherTrust: true,
        mcpStartsDisabled: true,
        instructionSkillsDefault: true,
        catalogIsNotLive: true,
        rawSecretsSerialized: false,
        brandAgnostic: true,
      },
      quarantineRoot,
      narrative: {
        headline,
        operatorSummary: issues.map((i) => i.message).join(' ') || headline,
        nextSafeAction: 'Provide a local path, archive, or HTTPS URL to a capability pack.',
      },
    };
  }
}

export function isRemoteCapabilitySource(value: string): boolean {
  return /^https:\/\//i.test(String(value || '').trim());
}

export function capabilitySourceFileUrl(localPath: string): string {
  return pathToFileURL(path.resolve(localPath)).href;
}

export function defaultCapabilityQuarantineRoot(projectRoot = process.cwd()): string {
  return path.join(projectRoot, '.zavorth', 'capability-quarantine');
}

export function defaultWorkspaceImportRoot(projectRoot = process.cwd()): string {
  return path.join(projectRoot, '.zavorth', 'workspace-imports');
}

export { UniversalCapabilitySubsystemService as UniversalCapabilityFabricService };
export type { UniversalCapabilityFabricInput as UniversalCapabilitySubsystemInput };


