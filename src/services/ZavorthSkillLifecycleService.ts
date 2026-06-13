import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

import { config } from '../config/index.js';
import { ZavorthSandboxControlPlaneService } from './ZavorthSandboxControlPlaneService.js';

export type ZavorthSkillLifecycleState =
  | 'draft'
  | 'quarantine'
  | 'scan'
  | 'sandbox_smoke'
  | 'approval'
  | 'materialize'
  | 'enable'
  | 'rejected'
  | 'archived'
  | 'failed';

export type ZavorthSkillSourceKind = 'official' | 'github' | 'local' | 'learning-loop' | 'skill-creator' | 'unknown';

export type ZavorthSkillLifecycleSource = {
  kind: ZavorthSkillSourceKind;
  ref: string;
};

export type ZavorthSkillLifecycleReceipt = {
  id: string;
  action: string;
  state: ZavorthSkillLifecycleState;
  status: 'passed' | 'blocked' | 'pending' | 'recorded';
  createdAt: string;
  approvalId: string | null;
  summary: string;
  evidenceRefs: string[];
};

export type ZavorthSkillLifecycleSnapshot = {
  contractVersion: 'zavorth-skill-lifecycle/1';
  lifecycleId: string;
  skillId: string;
  name: string;
  summary: string;
  source: ZavorthSkillLifecycleSource;
  state: ZavorthSkillLifecycleState;
  risk: 'low' | 'medium' | 'high';
  scanResult: {
    status: 'passed' | 'blocked';
    issues: Array<{ code: string; severity: 'warn' | 'block'; evidence: string }>;
  };
  sandboxSmokeResult: {
    status: 'passed' | 'blocked';
    posture: string;
    command: string;
    hostExecutionPerformed: false;
  };
  approvalId: string | null;
  quarantinePath: string;
  proposalPath: string;
  materializedPath: string | null;
  enabled: boolean;
  dependencies: string[];
  evidenceRefs: string[];
  receipts: ZavorthSkillLifecycleReceipt[];
  createdAt: string;
  updatedAt: string;
};

export type ZavorthSkillLifecycleCandidateInput = {
  skillId: string;
  name?: string | null;
  summary?: string | null;
  source?: Partial<ZavorthSkillLifecycleSource> | null;
  dependencies?: string[];
  writeDraft?: boolean;
  contentMarkdown?: string | null;
};

type LifecycleRuntime = {
  projectRoot?: string | null;
  now?: () => Date;
  sandbox?: Pick<ZavorthSandboxControlPlaneService, 'buildSnapshot'>;
};

export class ZavorthSkillLifecycleService {
  private readonly projectRoot: string;
  private readonly now: () => Date;
  private readonly sandbox: Pick<ZavorthSandboxControlPlaneService, 'buildSnapshot'>;

  constructor(runtime: LifecycleRuntime = {}) {
    this.projectRoot = path.resolve(runtime.projectRoot || config.projectRoot || process.cwd());
    this.now = runtime.now || (() => new Date());
    this.sandbox = runtime.sandbox || new ZavorthSandboxControlPlaneService({ workspaceRoot: this.projectRoot });
  }

  public createCandidate(input: ZavorthSkillLifecycleCandidateInput): ZavorthSkillLifecycleSnapshot {
    const createdAt = this.now().toISOString();
    const skillId = normalizeSkillId(input.skillId || input.name || 'learned-skill');
    const name = sanitizeLine(input.name || titleFromId(skillId));
    const summary = sanitizeLine(input.summary || 'Governed skill candidate.');
    const source = normalizeSource(input.source, skillId);
    const dependencies = Array.from(new Set((input.dependencies || []).map(String).filter(Boolean)));
    const quarantinePath = path.join(this.projectRoot, '.zavorth', 'skills', 'quarantine', skillId);
    const proposalPath = path.join(quarantinePath, 'proposal.json');
    const lifecycleId = `skill-life-${hash(`${skillId}:${source.kind}:${source.ref}`).slice(0, 16)}`;
    const skillMarkdown = input.contentMarkdown || renderSkillMarkdown(name, summary, dependencies);
    const scanResult = scanSkillCandidate(`${name}\n${summary}\n${skillMarkdown}\n${dependencies.join('\n')}`);
    const sandboxSnapshot = this.sandbox.buildSnapshot({
      command: `node -e "console.log('skill:${skillId}:smoke')"`,
      preferredProfile: 'auto',
      networkPolicy: 'none',
      requestedBy: 'skill-lifecycle',
      sourceSurface: 'zavorth-skill-lifecycle',
    });
    const sandboxSmokeResult = {
      status: sandboxSnapshot.envelopePreview && scanResult.status === 'passed' ? 'passed' as const : 'blocked' as const,
      posture: sandboxSnapshot.summary.posture,
      command: `node -e "console.log('skill:${skillId}:smoke')"`,
      hostExecutionPerformed: false as false,
    };
    const evidenceRefs = [
      `source:${source.kind}:${source.ref}`,
      `dependencies:${dependencies.length}`,
      `quarantine:${relativePath(this.projectRoot, quarantinePath)}`,
      `sandbox:${sandboxSmokeResult.posture}`,
    ];
    const receipts = [
      receipt('skill.lifecycle.draft', 'draft', 'recorded', 'Skill draft metadata normalized.', createdAt, null, evidenceRefs),
      receipt('skill.lifecycle.quarantine', 'quarantine', 'recorded', 'Skill candidate kept outside runtime exposure.', createdAt, null, evidenceRefs),
      receipt('skill.lifecycle.scan', 'scan', scanResult.status, scanResult.status === 'passed' ? 'Static scan passed.' : 'Static scan blocked the candidate.', createdAt, null, evidenceRefs),
      receipt('skill.lifecycle.sandbox_smoke', 'sandbox_smoke', sandboxSmokeResult.status, 'Sandbox smoke preview recorded without host dependency installation.', createdAt, null, evidenceRefs),
      receipt('skill.install.candidate', 'approval', 'pending', 'Install created a governed candidate; approval is required before materialization.', createdAt, null, evidenceRefs),
    ];
    const snapshot: ZavorthSkillLifecycleSnapshot = {
      contractVersion: 'zavorth-skill-lifecycle/1',
      lifecycleId,
      skillId,
      name,
      summary,
      source,
      state: scanResult.status === 'passed' && sandboxSmokeResult.status === 'passed' ? 'approval' : 'failed',
      risk: scanResult.issues.some((issue) => issue.severity === 'block') ? 'high' : dependencies.length > 0 ? 'medium' : 'low',
      scanResult,
      sandboxSmokeResult,
      approvalId: null,
      quarantinePath,
      proposalPath,
      materializedPath: null,
      enabled: false,
      dependencies,
      evidenceRefs,
      receipts,
      createdAt,
      updatedAt: createdAt,
    };

    if (input.writeDraft === true) {
      fs.mkdirSync(quarantinePath, { recursive: true });
      fs.writeFileSync(path.join(quarantinePath, 'SKILL.md'), skillMarkdown, 'utf8');
      fs.writeFileSync(proposalPath, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
      this.writeSnapshot(snapshot);
      this.appendReceipts(snapshot.receipts);
    }

    return snapshot;
  }

  public materialize(skillId: string, input: { approvalId?: string | null } = {}): ZavorthSkillLifecycleSnapshot {
    const approvalId = sanitizeLine(input.approvalId || '');
    if (!approvalId) {
      throw new Error('An approval id is required before materialization.');
    }
    const snapshot = this.readSnapshot(skillId);
    if (!snapshot) {
      throw new Error(`No lifecycle candidate found for skill: ${skillId}`);
    }
    if (snapshot.scanResult.status !== 'passed' || snapshot.sandboxSmokeResult.status !== 'passed') {
      throw new Error(`Skill cannot be materialized before scan and sandbox smoke pass: ${skillId}`);
    }
    const updatedAt = this.now().toISOString();
    const materializedPath = path.join(this.projectRoot, 'skill-library', 'native', snapshot.skillId);
    const skillFile = path.join(snapshot.quarantinePath, 'SKILL.md');
    if (!fs.existsSync(skillFile)) {
      fs.mkdirSync(snapshot.quarantinePath, { recursive: true });
      fs.writeFileSync(skillFile, renderSkillMarkdown(snapshot.name, snapshot.summary, snapshot.dependencies), 'utf8');
    }
    fs.mkdirSync(materializedPath, { recursive: true });
    fs.copyFileSync(skillFile, path.join(materializedPath, 'SKILL.md'));
    fs.writeFileSync(path.join(materializedPath, 'ZAVORTH_NATIVE_SKILL.json'), `${JSON.stringify({
      id: snapshot.skillId,
      name: snapshot.name,
      summary: snapshot.summary,
      source: snapshot.source,
      lifecycleId: snapshot.lifecycleId,
      approvalId,
      materializedAt: updatedAt,
      enabled: false,
      executionPerformedDuringMaterialization: false,
      hostDependencyInstallPerformed: false,
    }, null, 2)}\n`, 'utf8');

    const next = {
      ...snapshot,
      state: 'materialize' as const,
      approvalId,
      materializedPath,
      enabled: false,
      updatedAt,
      receipts: snapshot.receipts.concat(receipt(
        'skill.lifecycle.materialize',
        'materialize',
        'recorded',
        'Approved skill candidate was materialized without enabling runtime behavior.',
        updatedAt,
        approvalId,
        snapshot.evidenceRefs.concat(`materialized:${relativePath(this.projectRoot, materializedPath)}`),
      )),
    };
    this.writeSnapshot(next);
    this.appendReceipts(next.receipts.slice(snapshot.receipts.length));
    return next;
  }

  public canEnable(skillId: string): { ok: true; snapshot: ZavorthSkillLifecycleSnapshot } | { ok: false; reason: string; snapshot: ZavorthSkillLifecycleSnapshot | null } {
    const snapshot = this.readSnapshot(skillId);
    if (!snapshot) {
      return { ok: false, reason: 'Skill is not materialized through an approved lifecycle receipt.', snapshot: null };
    }
    if (!snapshot.approvalId || !snapshot.materializedPath) {
      return { ok: false, reason: 'Skill is not materialized through an approved lifecycle receipt.', snapshot };
    }
    if (!fs.existsSync(path.join(snapshot.materializedPath, 'SKILL.md'))) {
      return { ok: false, reason: 'Skill materialization receipt exists but SKILL.md is missing.', snapshot };
    }
    return { ok: true, snapshot };
  }

  public markEnabled(skillId: string): ZavorthSkillLifecycleSnapshot {
    const allowed = this.canEnable(skillId);
    if (!allowed.ok) {
      throw new Error(allowed.reason);
    }
    const updatedAt = this.now().toISOString();
    const next = {
      ...allowed.snapshot,
      state: 'enable' as const,
      enabled: true,
      updatedAt,
      receipts: allowed.snapshot.receipts.concat(receipt(
        'skill.lifecycle.enable',
        'enable',
        'recorded',
        'Skill enabled after approved materialization.',
        updatedAt,
        allowed.snapshot.approvalId,
        allowed.snapshot.evidenceRefs,
      )),
    };
    this.writeSnapshot(next);
    this.appendReceipts(next.receipts.slice(allowed.snapshot.receipts.length));
    return next;
  }

  public recordProof(skillId: string, input: { ok: boolean; summary: string }): ZavorthSkillLifecycleSnapshot | null {
    const snapshot = this.readSnapshot(skillId);
    if (!snapshot) return null;
    const updatedAt = this.now().toISOString();
    const next = {
      ...snapshot,
      updatedAt,
      receipts: snapshot.receipts.concat(receipt(
        'skill.lifecycle.proof',
        snapshot.state,
        input.ok ? 'passed' : 'blocked',
        sanitizeLine(input.summary || 'Skill proof recorded.'),
        updatedAt,
        snapshot.approvalId,
        snapshot.evidenceRefs,
      )),
    };
    this.writeSnapshot(next);
    this.appendReceipts(next.receipts.slice(snapshot.receipts.length));
    return next;
  }

  public archive(skillId: string): ZavorthSkillLifecycleSnapshot | null {
    const snapshot = this.readSnapshot(skillId);
    if (!snapshot) return null;
    const updatedAt = this.now().toISOString();
    const next = {
      ...snapshot,
      state: 'archived' as const,
      enabled: false,
      updatedAt,
      receipts: snapshot.receipts.concat(receipt(
        'skill.lifecycle.archive',
        'archived',
        'recorded',
        'Skill lifecycle archived and removed from runtime exposure.',
        updatedAt,
        snapshot.approvalId,
        snapshot.evidenceRefs,
      )),
    };
    this.writeSnapshot(next);
    this.appendReceipts(next.receipts.slice(snapshot.receipts.length));
    return next;
  }

  public readSnapshot(skillId: string): ZavorthSkillLifecycleSnapshot | null {
    const file = this.snapshotPath(skillId);
    try {
      return JSON.parse(fs.readFileSync(file, 'utf8')) as ZavorthSkillLifecycleSnapshot;
    } catch {
      return null;
    }
  }

  private writeSnapshot(snapshot: ZavorthSkillLifecycleSnapshot): void {
    const file = this.snapshotPath(snapshot.skillId);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
  }

  private appendReceipts(receipts: ZavorthSkillLifecycleReceipt[]): void {
    if (receipts.length === 0) return;
    const file = path.join(this.projectRoot, '.zavorth', 'receipts', 'skill-lifecycle.json');
    let existing: unknown[] = [];
    try {
      const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
      existing = Array.isArray(parsed) ? parsed : [];
    } catch {
      existing = [];
    }
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, `${JSON.stringify(existing.concat(receipts), null, 2)}\n`, 'utf8');
  }

  private snapshotPath(skillId: string): string {
    return path.join(this.projectRoot, '.zavorth', 'skills', 'lifecycle', `${normalizeSkillId(skillId)}.json`);
  }
}

function normalizeSource(source: Partial<ZavorthSkillLifecycleSource> | null | undefined, skillId: string): ZavorthSkillLifecycleSource {
  const kind = String(source?.kind || 'official').trim().toLowerCase();
  const allowed: ZavorthSkillSourceKind[] = ['official', 'github', 'local', 'learning-loop', 'skill-creator', 'unknown'];
  return {
    kind: allowed.includes(kind as ZavorthSkillSourceKind) ? kind as ZavorthSkillSourceKind : 'unknown',
    ref: sanitizeLine(source?.ref || skillId),
  };
}

function scanSkillCandidate(text: string): ZavorthSkillLifecycleSnapshot['scanResult'] {
  const checks: Array<{ code: string; severity: 'warn' | 'block'; pattern: RegExp; evidence: string }> = [
    {
      code: 'policy-bypass',
      severity: 'block',
      pattern: /\b(ignore|disable|bypass|skip)\s+(approval|policy|safety|firewall)\b/i,
      evidence: 'Attempts to bypass approval, policy or safety controls.',
    },
    {
      code: 'destructive-shell',
      severity: 'block',
      pattern: /\b(rm\s+-rf|remove-item\b[\s\S]{0,80}\b-recurse\b[\s\S]{0,80}\b-force|del\s+\/[qsf]|format\s+[a-z]:)\b/i,
      evidence: 'Contains destructive shell behavior.',
    },
    {
      code: 'metadata-service-access',
      severity: 'block',
      pattern: /https?:\/\/(?:169\.254\.169\.254|metadata\.google\.internal|metadata\.azure\.com)\b/i,
      evidence: 'Attempts to access cloud metadata services.',
    },
    {
      code: 'host-dependency-install',
      severity: 'warn',
      pattern: /\b(npm|pnpm|yarn|pip|cargo)\s+(install|add)\b/i,
      evidence: 'Dependency installation must remain sandboxed and approval-gated.',
    },
  ];
  const issues = checks
    .filter((check) => check.pattern.test(text))
    .map(({ code, severity, evidence }) => ({ code, severity, evidence }));
  return {
    status: issues.some((issue) => issue.severity === 'block') ? 'blocked' : 'passed',
    issues,
  };
}

function renderSkillMarkdown(name: string, summary: string, dependencies: string[] = []): string {
  return [
    '---',
    `name: ${name}`,
    `description: ${summary}`,
    'risk: governed',
    dependencies.length ? `dependencies: ${dependencies.join(', ')}` : 'dependencies: none',
    '---',
    '',
    '# Governed Skill Candidate',
    '',
    summary,
    '',
    'This skill is inert until Zavorth records scan, sandbox smoke, approval, materialization and enable receipts.',
    '',
  ].join('\n');
}

function receipt(
  action: string,
  state: ZavorthSkillLifecycleState,
  status: ZavorthSkillLifecycleReceipt['status'],
  summary: string,
  createdAt: string,
  approvalId: string | null,
  evidenceRefs: string[],
): ZavorthSkillLifecycleReceipt {
  return {
    id: `${action}-${hash(`${action}:${summary}:${createdAt}:${approvalId || ''}`).slice(0, 12)}`,
    action,
    state,
    status,
    summary,
    createdAt,
    approvalId,
    evidenceRefs,
  };
}

function normalizeSkillId(value: string): string {
  return String(value || 'learned-skill')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    || 'learned-skill';
}

function titleFromId(skillId: string): string {
  return skillId.split('-').filter(Boolean).map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`).join(' ');
}

function sanitizeLine(value: unknown): string {
  return String(value || '')
    .replace(/\b(api[_-]?key|token|secret|password)\s*[:=]\s*["']?[^"'\s,;]+/gi, '$1=[REDACTED_SECRET]')
    .replace(/[\r\n]+/g, ' ')
    .trim();
}

function relativePath(root: string, target: string): string {
  return path.relative(root, target).replace(/\\/g, '/') || '.';
}

function hash(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
