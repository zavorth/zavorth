/**
 * Optional named migration profiles layered on UniversalWorkspaceImportService.
 *
 * Brand-agnostic workspace detection: identifies agent workspaces by structural markers
 * and builds a risk migration report. Never serializes raw secret values.
 */

import fs from 'node:fs';
import path from 'node:path';

import type { ProofEventAppendInput } from '../proof/ProofLedgerService.js';
import type { UniversalWorkspaceImportSnapshot } from '../../contracts/UniversalCapabilityFabricContract.js';
import {
  WORKSPACE_MIGRATION_PROFILE_CONTRACT_VERSION,
  type MigrationRiskFinding,
  type WorkspaceMigrationProfileId,
  type WorkspaceMigrationProfileRequest,
  type WorkspaceMigrationReport,
  type WorkspaceMigrationSignal,
} from '../../contracts/migration/WorkspaceMigrationProfileContract.js';
import { UniversalWorkspaceImportService } from '../UniversalWorkspaceImportService.js';

export type MigrationFsAdapters = {
  existsSync?: typeof fs.existsSync;
  readdirSync?: typeof fs.readdirSync;
  statSync?: typeof fs.statSync;
  readFileSync?: typeof fs.readFileSync;
};

export type ProfileDetectionResult = {
  profileId: WorkspaceMigrationProfileId;
  confidence: number;
  signals: WorkspaceMigrationSignal[];
};

export type BuildMigrationReportInput = {
  sourcePath: string;
  profile?: WorkspaceMigrationProfileRequest | WorkspaceMigrationProfileId | string;
  importSnapshot?: UniversalWorkspaceImportSnapshot;
  includeSecretLike?: boolean;
};

type Runtime = MigrationFsAdapters & {
  projectRoot?: string;
  now?: () => Date;
  importer?: UniversalWorkspaceImportService;
};

const EXECUTABLE_RE = /\.(js|mjs|cjs|ts|tsx|py|sh|bash|ps1|bat|cmd|exe|dll|so|dylib)$/i;

function normalizeProfileRequest(
  raw?: string | null,
): WorkspaceMigrationProfileId {
  const value = String(raw || 'auto').trim().toLowerCase();
  if (value === 'auto' || value === '') return 'auto';
  if (value === 'generic' || value === 'agent-home') return 'agent-home';
  if (value === 'unknown') return 'unknown';
  return 'auto';
}

export class WorkspaceMigrationProfileService {
  private readonly projectRoot: string;
  private readonly now: () => Date;
  private readonly existsSync: typeof fs.existsSync;
  private readonly readdirSync: typeof fs.readdirSync;
  private readonly statSync: typeof fs.statSync;
  private readonly readFileSync: typeof fs.readFileSync;
  private readonly importer: UniversalWorkspaceImportService;

  constructor(runtime: Runtime = {}) {
    this.projectRoot = runtime.projectRoot || process.cwd();
    this.now = runtime.now || (() => new Date());
    this.existsSync = runtime.existsSync || fs.existsSync.bind(fs);
    this.readdirSync = runtime.readdirSync || fs.readdirSync.bind(fs);
    this.statSync = runtime.statSync || fs.statSync.bind(fs);
    this.readFileSync = runtime.readFileSync || fs.readFileSync.bind(fs);
    this.importer =
      runtime.importer ||
      new UniversalWorkspaceImportService({
        projectRoot: this.projectRoot,
        now: this.now,
        existsSync: this.existsSync,
        readdirSync: this.readdirSync,
        statSync: this.statSync,
        readFileSync: this.readFileSync,
      });
  }

  public detectProfile(
    sourcePath: string,
    fsAdapters?: MigrationFsAdapters,
  ): ProfileDetectionResult {
    const existsSync = fsAdapters?.existsSync || this.existsSync;
    const readdirSync = fsAdapters?.readdirSync || this.readdirSync;
    const statSync = fsAdapters?.statSync || this.statSync;
    const readFileSync = fsAdapters?.readFileSync || this.readFileSync;

    const resolved = path.resolve(sourcePath || '');
    if (!resolved || !existsSync(resolved)) {
      return {
        profileId: 'unknown',
        confidence: 0,
        signals: [{ id: 'source_exists', present: false, weight: 1 }],
      };
    }

    const isDir = (rel: string): boolean => {
      const full = path.join(resolved, rel);
      try {
        return existsSync(full) && statSync(full).isDirectory();
      } catch {
        return false;
      }
    };

    const isFile = (rel: string): boolean => {
      const full = path.join(resolved, rel);
      try {
        return existsSync(full) && statSync(full).isFile();
      } catch {
        return false;
      }
    };

    (name: string): boolean => {
      const pkgPath = path.join(resolved, 'package.json');
      if (!existsSync(pkgPath)) return false;
      try {
        const raw = readFileSync(pkgPath, 'utf8');
        const parsed = JSON.parse(raw) as { name?: string };
        return typeof parsed.name === 'string' && parsed.name.toLowerCase().includes(name);
      } catch {
        return false;
      }
    };

    const hasAgentsSoulLayout = (): boolean => {
      if (!isDir('agents')) return false;
      try {
        const agentsRoot = path.join(resolved, 'agents');
        const entries = readdirSync(agentsRoot, { withFileTypes: true }) as fs.Dirent[];
        for (const entry of entries) {
          if (entry.isDirectory()) {
            if (existsSync(path.join(agentsRoot, entry.name, 'SOUL.md'))) return true;
          }
        }
        return existsSync(path.join(agentsRoot, 'SOUL.md'));
      } catch {
        return false;
      }
    };

    // Brand-agnostic structural signals for agent workspaces
    const agentSignals: WorkspaceMigrationSignal[] = [
      { id: 'identity_md', present: isFile('IDENTITY.md'), weight: 3 },
      { id: 'agents_md', present: isFile('AGENTS.md'), weight: 3 },
      { id: 'soul_md', present: isFile('SOUL.md'), weight: 2 },
      { id: 'user_md', present: isFile('USER.md'), weight: 2 },
      { id: 'memory_md', present: isFile('MEMORY.md'), weight: 2 },
      { id: 'rules_md', present: isFile('RULES.md'), weight: 2 },
      { id: 'tools_md', present: isFile('TOOLS.md'), weight: 1 },
      { id: 'skills_dir', present: isDir('skills') || isDir('skill-library'), weight: 3 },
      { id: 'memory_dir', present: isDir('memory') || isDir('memories'), weight: 2 },
      { id: 'config_yaml', present: isFile('config.yaml'), weight: 2 },
      { id: 'agents_soul_layout', present: hasAgentsSoulLayout(), weight: 3 },
      { id: 'config_json', present: isFile('config.json'), weight: 1 },
    ];

    const score = (signals: WorkspaceMigrationSignal[]): number => {
      const total = signals.reduce((sum, s) => sum + (s.weight || 1), 0) || 1;
      const hit = signals.filter((s) => s.present).reduce((sum, s) => sum + (s.weight || 1), 0);
      return hit / total;
    };

    const agentScore = score(agentSignals);
    const hasStrongFingerprint =
      agentSignals.find((s) => s.id === 'agents_md')?.present &&
      agentSignals.find((s) => s.id === 'skills_dir')?.present;

    let profileId: WorkspaceMigrationProfileId = 'unknown';
    let confidence = 0;
    let usedSignals: WorkspaceMigrationSignal[] = agentSignals;

    const agentConf = hasStrongFingerprint ? Math.max(agentScore, 0.7) : agentScore;

    const candidates: Array<{ id: WorkspaceMigrationProfileId; conf: number; hard: boolean }> = [
      {
        id: 'agent-home',
        conf: agentConf,
        hard: Boolean(hasStrongFingerprint),
      },
    ];

    candidates.sort((a, b) => {
      if (a.hard !== b.hard) return a.hard ? -1 : 1;
      return b.conf - a.conf;
    });

    const top = candidates[0];
    if (top && top.conf > 0) {
      if (top.conf < 0.15 && !top.hard) {
        profileId = 'unknown';
        confidence = top.conf;
      } else {
        profileId = top.id;
        confidence = Math.max(0, Math.min(1, top.conf));
      }
    }

    // Prefer highest confidence among non-unknown
    if (profileId !== 'unknown') {
      usedSignals = usedSignals.map((s) => ({ id: s.id, present: s.present, weight: s.weight }));
    }

    return {
      profileId,
      confidence,
      signals: usedSignals,
    };
  }

  public buildReport(input: BuildMigrationReportInput): WorkspaceMigrationReport {
    const sourcePath = path.resolve(input.sourcePath || '');
    const requested = normalizeProfileRequest(input.profile);
    const detected = this.detectProfile(sourcePath);

    const profileId: WorkspaceMigrationProfileId =
      requested === 'auto' ? detected.profileId : requested;

    // Forced profile that matches detection earns high confidence; mismatch is capped (never inflated).
    const profileForced = requested !== 'auto';
    const profileMismatch = profileForced && requested !== detected.profileId;
    const confidence =
      requested === 'auto'
        ? detected.confidence
        : !profileMismatch
          ? Math.max(detected.confidence, 0.85)
          : Math.min(detected.confidence * 0.5, 0.4);

    const snapshot =
      input.importSnapshot ||
      this.importer.buildSnapshot({
        sourcePath,
        // Migration report is always dry-run / preview. Apply only happens in the import CLI path.
        apply: false,
        includeSecretLike: input.includeSecretLike === true,
      });

    const findings = this.buildFindings(sourcePath, snapshot, detected, {
      requestedProfileId: requested,
      profileId,
      profileMismatch,
    });
    const itemCounts = {
      total: snapshot.summary?.items ?? snapshot.items?.length ?? 0,
      secretLike: snapshot.summary?.secretLike ?? snapshot.items?.filter((i) => i.secretLike).length ?? 0,
      skills: snapshot.summary?.skills ?? snapshot.items?.filter((i) => i.kind === 'skill').length ?? 0,
      memory: snapshot.summary?.memory ?? snapshot.items?.filter((i) => i.kind === 'memory').length ?? 0,
      config: snapshot.summary?.config ?? snapshot.items?.filter((i) => i.kind === 'config').length ?? 0,
      other: 0,
    };
    itemCounts.other = Math.max(
      0,
      itemCounts.total - itemCounts.skills - itemCounts.memory - itemCounts.config,
    );

    const secretLikePresent = itemCounts.secretLike > 0 || findings.some((f) => f.secretLike);

    const summaryBullets = this.buildSummaryBullets({
      profileId,
      detectedProfileId: detected.profileId,
      confidence,
      itemCounts,
      secretLikePresent,
      findings,
      snapshotStatus: snapshot.status,
    });

    return {
      contractVersion: WORKSPACE_MIGRATION_PROFILE_CONTRACT_VERSION,
      profileId,
      detectedProfileId: detected.profileId,
      confidence,
      sourcePath,
      signals: detected.signals,
      findings,
      itemCounts,
      summaryBullets,
      secretLikePresent,
      safeToPreview: true,
      applyBlockedWithoutConsent: true,
      nextSafeAction: secretLikePresent ? 'Review secret-like findings, then re-run with --apply --consent. Use --include-secret-like only when intentionally importing secret references (values stay redacted in reports).'
        : 'Review the migration report, then re-run with --apply --consent to copy non-secret items.',
      generatedAt: this.now().toISOString(),
    };
  }

  public toMarkdown(report: WorkspaceMigrationReport): string {
    const lines: string[] = [
      '# Workspace Migration Report',
      '',
      `- contract: ${report.contractVersion}`,
      `- profile: ${report.profileId}`,
      `- detected: ${report.detectedProfileId}`,
      `- confidence: ${Math.round(report.confidence * 100)}%`,
      `- source: ${report.sourcePath}`,
      `- generatedAt: ${report.generatedAt}`,
      `- secretLikePresent: ${report.secretLikePresent ? 'yes (presence only; values redacted)' : 'no'}`,
      `- safeToPreview: yes`,
      `- applyBlockedWithoutConsent: yes`,
      '',
      '## Item counts',
      '',
      `- total: ${report.itemCounts.total}`,
      `- skills: ${report.itemCounts.skills}`,
      `- memory: ${report.itemCounts.memory}`,
      `- config: ${report.itemCounts.config}`,
      `- secret-like: ${report.itemCounts.secretLike} (presence only)`,
      `- other: ${report.itemCounts.other}`,
      '',
      '## Signals',
      '',
    ];

    for (const signal of report.signals.filter((s) => s.present)) {
      lines.push(`- [x] ${signal.id}${signal.weight != null ? ` (weight ${signal.weight})` : ''}`);
    }
    const absent = report.signals.filter((s) => !s.present);
    if (absent.length) {
      lines.push(`- (${absent.length} signal(s) not present)`);
    }

    lines.push('', '## Findings', '');
    if (report.findings.length === 0) {
      lines.push('- No elevated risk findings.');
    } else {
      for (const finding of report.findings) {
        const secretTag = finding.secretLike ? ' · secret-like' : '';
        lines.push(`- **[${finding.severity}]** ${finding.title}${secretTag}`);
        lines.push(`  ${this.redactSecretLikeText(finding.detail)}`);
      }
    }

    lines.push('', '## Summary', '');
    for (const bullet of report.summaryBullets) {
      lines.push(`- ${this.redactSecretLikeText(bullet)}`);
    }

    lines.push('', `**Next:** ${report.nextSafeAction}`, '');
    return lines.join('\n');
  }

  /**
   * Build a ProofLedger append input. Never includes secret values in metadata.
   */
  public toProofEventInput(report: WorkspaceMigrationReport): ProofEventAppendInput {
    const maxSeverity = this.maxFindingSeverity(report.findings);
    const riskLevel =
      maxSeverity === 'critical'
        ? 'critical'
        : maxSeverity === 'high'
          ? 'high'
          : maxSeverity === 'medium'
            ? 'medium'
            : maxSeverity === 'low'
              ? 'low'
              : 'none';

    return {
      runId: null,
      kind: report.secretLikePresent ? 'marketplace' : 'system',
      surface: 'cli',
      title: `Workspace migration profile: ${report.profileId}`,
      summary: [
        `Detected ${report.detectedProfileId} (${Math.round(report.confidence * 100)}%).`,
        `${report.itemCounts.total} item(s); secret-like present: ${report.secretLikePresent ? 'yes' : 'no'}.`,
        'Values never serialized.',
      ].join(' '),
      status: 'info',
      riskLevel,
      approvalId: null,
      artifacts: [],
      createdAt: report.generatedAt,
      source: 'workspace-migration-profile',
      metadata: {
        contractVersion: report.contractVersion,
        profileId: report.profileId,
        detectedProfileId: report.detectedProfileId,
        confidence: report.confidence,
        // path basename only — avoid leaking full home layout secrets in ledger
        sourceBasename: path.basename(report.sourcePath),
        itemCounts: { ...report.itemCounts },
        secretLikePresent: report.secretLikePresent,
        findingIds: report.findings.map((f) => f.id),
        findingSeverities: report.findings.map((f) => f.severity),
        safeToPreview: true,
        applyBlockedWithoutConsent: true,
      },
    };
  }

  private buildFindings(
    sourcePath: string,
    snapshot: UniversalWorkspaceImportSnapshot,
    detected: ProfileDetectionResult,
    profileContext?: {
      requestedProfileId?: WorkspaceMigrationProfileId;
      profileId?: WorkspaceMigrationProfileId;
      profileMismatch?: boolean;
    },
  ): MigrationRiskFinding[] {
    const findings: MigrationRiskFinding[] = [];

    if (profileContext?.profileMismatch) {
      findings.push({
        id: 'forced-profile-mismatch',
        severity: 'medium',
        title: 'Forced profile differs from detection',
        detail:
          `Operator requested '${profileContext.requestedProfileId}' but structural detection found '${detected.profileId}'. ` +
          'Confidence is capped; review the home layout before apply.',
      });
    }

    const secretItems = (snapshot.items || []).filter((i) => i.secretLike);
    if (secretItems.length > 0) {
      const names = secretItems
        .slice(0, 8)
        .map((i) => i.name)
        .join(', ');
      findings.push({
        id: 'secret-like-items',
        severity: 'high',
        title: 'Secret-like items detected',
        detail: `${secretItems.length} secret-like item(s) held from auto-import (names: ${names}${secretItems.length > 8 ? ', …' : ''}). Values are not included in this report.`,
        secretLike: true,
      });
    }

    // Standalone .env presence (even if not in snapshot plan)
    const envPath = path.join(sourcePath, '.env');
    if (this.existsSync(envPath)) {
      findings.push({
        id: 'dotenv-present',
        severity: 'high',
        title: '.env file present',
        detail: 'A .env file was found. Secret-like content is treated as present-only; values are never copied into reports.',
        secretLike: true,
      });
    }

    // Large memory directories
    for (const rel of ['memory', 'memories']) {
      const memDir = path.join(sourcePath, rel);
      if (!this.existsSync(memDir)) continue;
      try {
        if (!this.statSync(memDir).isDirectory()) continue;
        const fileCount = this.countFiles(memDir, 500);
        if (fileCount >= 50) {
          findings.push({
            id: `large-memory-dir-${rel}`,
            severity: fileCount >= 200 ? 'medium' : 'low',
            title: `Large memory directory (${rel})`,
            detail: `Approximately ${fileCount}+ files under ${rel}/. Review before bulk import.`,
          });
        }
      } catch {
        // ignore
      }
    }

    // Executable plugins
    const pluginItems = (snapshot.items || []).filter((i) => i.kind === 'plugin');
    const executablePlugins = pluginItems.filter((i) => EXECUTABLE_RE.test(i.name) || EXECUTABLE_RE.test(i.sourcePath));
    if (executablePlugins.length > 0) {
      findings.push({
        id: 'executable-plugins',
        severity: 'high',
        title: 'Executable plugin material detected',
        detail: `${executablePlugins.length} plugin item(s) look executable. They remain held until explicit higher-trust enable.`,
      });
    } else {
      // Also scan plugins/ for executables even if not planned
      const pluginsDir = path.join(sourcePath, 'plugins');
      if (this.existsSync(pluginsDir)) {
        const execCount = this.countMatchingFiles(pluginsDir, EXECUTABLE_RE, 40);
        if (execCount > 0) {
          findings.push({
            id: 'executable-plugins-scan',
            severity: 'high',
            title: 'Executable files under plugins/',
            detail: `${execCount}+ executable-like file(s) under plugins/. Quarantine and review before enable.`,
          });
        }
      }
    }

    if (detected.profileId === 'unknown' && detected.confidence < 0.15) {
      findings.push({
        id: 'low-confidence-profile',
        severity: 'info',
        title: 'Low-confidence profile detection',
        detail: 'No strong agent-home fingerprint matched. Universal structural import still applies.',
      });
    }

    if (snapshot.status === 'blocked') {
      findings.push({
        id: 'import-blocked',
        severity: 'medium',
        title: 'Structural import snapshot blocked',
        detail: (snapshot.warnings || []).slice(0, 3).join(' ') || 'Source path may be empty or missing.',
      });
    }

    // Ensure no secret values leak into finding text
    return findings.map((f) => ({
      ...f,
      title: this.redactSecretLikeText(f.title),
      detail: this.redactSecretLikeText(f.detail),
    }));
  }

  private buildSummaryBullets(input: {
    profileId: WorkspaceMigrationProfileId;
    detectedProfileId: WorkspaceMigrationProfileId;
    confidence: number;
    itemCounts: WorkspaceMigrationReport['itemCounts'];
    secretLikePresent: boolean;
    findings: MigrationRiskFinding[];
    snapshotStatus: string;
  }): string[] {
    const bullets: string[] = [
      `Using migration profile \`${input.profileId}\` (detected \`${input.detectedProfileId}\`, ${Math.round(input.confidence * 100)}% confidence).`,
      `Structural import snapshot status: ${input.snapshotStatus} (preview; no files copied by the report).`,
      `Planned items: ${input.itemCounts.total} total · ${input.itemCounts.skills} skills · ${input.itemCounts.memory} memory · ${input.itemCounts.config} config.`,
    ];
    if (input.profileId !== input.detectedProfileId) {
      bullets.push(
        `Forced profile \`${input.profileId}\` differs from detected \`${input.detectedProfileId}\` — treat labels carefully.`,
      );
    }
    if (input.secretLikePresent) {
      bullets.push(
        `Secret-like material present (${input.itemCounts.secretLike} item(s)); values redacted — not auto-imported without --include-secret-like.`,
      );
    } else {
      bullets.push('No secret-like items flagged in the structural plan.');
    }
    const elevated = input.findings.filter((f) => f.severity === 'high' || f.severity === 'critical');
    if (elevated.length) {
      bullets.push(`${elevated.length} high/critical finding(s) require operator review before apply.`);
    }
    bullets.push('Apply remains blocked without explicit --consent.');
    return bullets;
  }

  private maxFindingSeverity(
    findings: MigrationRiskFinding[],
  ): MigrationRiskFinding['severity'] | 'none' {
    const order: Array<MigrationRiskFinding['severity']> = [
      'critical',
      'high',
      'medium',
      'low',
      'info',
    ];
    for (const level of order) {
      if (findings.some((f) => f.severity === level)) return level;
    }
    return 'none';
  }

  /**
   * Redact common secret-shaped substrings so reports never exfiltrate values.
   */
  private redactSecretLikeText(text: string): string {
    let out = String(text || '');
    // key=value secret patterns
    out = out.replace(
      /\b(api[_-]?key|secret|token|password|credential|auth)\s*[=:]\s*['"]?[^\s'"]+/gi,
      '$1=[REDACTED]',
    );
    // sk?... tokens
    out = out.replace(/\bsk-[a-zA-Z0-9_-]{8,}\b/g, 'sk-[REDACTED]');
    // bare secret123-style leftovers from fixtures if ever embedded
    out = out.replace(/\bsecret\d+\b/gi, '[REDACTED]');
    // fixture / synthetic values that must never appear in report bodies
    out = out.replace(/\bshould-never-appear[^\s'"]*/gi, '[REDACTED]');
    return out;
  }

  private countFiles(dir: string, limit: number): number {
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
        } else {
          count += 1;
          if (count >= limit) return count;
        }
      }
    }
    return count;
  }

  private countMatchingFiles(dir: string, re: RegExp, limit: number): number {
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
        if (re.test(entry.name)) {
          count += 1;
          if (count >= limit) return count;
        }
      }
    }
    return count;
  }
}
