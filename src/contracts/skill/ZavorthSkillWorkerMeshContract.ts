/**
 * Foundation contract — brand-agnostic Skill install + Worker mesh.
 *
 * Later capability layers MUST build services against these types (or narrow
 * extensions), not invent parallel shapes with different names for the same job.
 *
 * Glossary (30 seconds):
 * - **Skill** — instruction pack + metadata (SKILL.md / manifest). Not an executor alone.
 * - **Tool / Plugin** — real executable capability on the ToolRegistry / Plugin OS.
 * - **Worker** — runnable actor (external CLI/HTTP/ACP/MCP *or* internal subagent)
 *   that shares one invoke/health/receipt model.
 * - **Receipt** — durable proof of what was previewed, approved, installed, or invoked
 *   (never serializes raw secrets).
 */

import type { ZavorthExternalAgentAdapterKind } from '../external/ZavorthExternalAgentGatewayContract.js';
import type { ZavorthSkillIr, ZavorthSkillIrParserId } from './ZavorthSkillIrContract.js';

export const ZAVORTH_SKILL_WORKER_MESH_CONTRACT_VERSION = '2026-07-14.skill-worker-mesh' as const;

export type { ZavorthSkillIr, ZavorthSkillIrParserId } from './ZavorthSkillIrContract.js';
export { ZAVORTH_SKILL_IR_CONTRACT_VERSION } from './ZavorthSkillIrContract.js';

// ---------------------------------------------------------------------------
// Glossary tokens (stable ids for docs / UI / prompts)
// ---------------------------------------------------------------------------

export const ZAVORTH_SKILL_WORKER_GLOSSARY = {
  skill: {
    id: 'skill',
    en: 'Instruction pack + metadata; not an executor by itself.',
  },
  tool: {
    id: 'tool',
    en: 'Real executable capability registered on the agent ToolRegistry.',
  },
  plugin: {
    id: 'plugin',
    en: 'Packaged capability module (Plugin OS) that can bind tools/channels/providers.',
  },
  worker: {
    id: 'worker',
    en: 'Runnable actor (external process/service or internal subagent) with health + invoke.',
  },
  receipt: {
    id: 'receipt',
    en: 'Durable proof of preview/approve/install/invoke; no raw secrets.',
  },
} as const;

// ---------------------------------------------------------------------------
// Shared primitives
// ---------------------------------------------------------------------------

export type ZavorthSkillSourceKind =
  | 'git-repo'
  | 'git-url'
  | 'zip-url'
  | 'tarball-url'
  | 'npm-package'
  | 'registry-url'
  | 'local-path'
  | 'local-file'
  | 'unknown';

export type ZavorthTrustScoreBand = 'deny' | 'review' | 'allow-with-preview' | 'allow';

export type ZavorthSkillTrustScore = {
  /** 0..1 aggregate; policy layers interpret bands. */
  score: number;
  band: ZavorthTrustScoreBand;
  /** Human-readable reasons (no secret values). */
  reasons: string[];
  /** Presence-only signals (e.g. has_signature, scan_clean, first_seen_domain). */
  signals: Array<{ id: string; present: boolean; weight?: number }>;
};

export type ZavorthDeclaredSkillTool = {
  name: string;
  description?: string;
};

export type ZavorthSkillToolBindStatus = 'direct' | 'aliased' | 'gateway' | 'unresolved';

export type ZavorthSkillToolBinding = {
  declaredName: string;
  resolvedName: string | null;
  status: ZavorthSkillToolBindStatus;
  /** e.g. alias map hit, zavorth_action fallback, missing from registry */
  note?: string;
  /**
   * When true, the declared name has no executor: treat as procedure guidance only.
   * Unresolved binds set this so models never invent tools.
   */
  guidanceOnly?: boolean;
};

export type ZavorthSkillInstallRisk = {
  id: string;
  severity: 'info' | 'low' | 'medium' | 'high' | 'critical';
  title: string;
  detail: string;
  secretLike?: boolean;
};

// ---------------------------------------------------------------------------
// Skill install plan + receipt
// ---------------------------------------------------------------------------

/** Preview of a skill install (dry-run; no disk write). */
export type SkillInstallPlan = {
  contractVersion: typeof ZAVORTH_SKILL_WORKER_MESH_CONTRACT_VERSION;
  kind: 'skill-install-plan';
  generatedAt: string;
  source: {
    raw: string;
    detectedType: ZavorthSkillSourceKind;
    resolved?: string | null;
  };
  skillId: string | null;
  skillName: string | null;
  version: string | null;
  /** Relative paths discovered in the package (no absolute secret paths required). */
  files: string[];
  declaredTools: ZavorthDeclaredSkillTool[];
  risks: ZavorthSkillInstallRisk[];
  trust: ZavorthSkillTrustScore;
  /** Always true on plan — mutation only after explicit apply + policy. */
  previewOnly: true;
  applyBlockedWithoutConsent: true;
  nextSafeAction: string;
  /** Normalized pack snapshot (shape-based SkillIR). */
  skillIr?: ZavorthSkillIr | null;
  skillIrDigest?: string | null;
  /** Shape parser id when IR present. */
  parserId?: ZavorthSkillIrParserId | null;
};

/**
 * Result of applying a skill install (or a pure-preview receipt).
 */
export type SkillInstallReceipt = {
  contractVersion: typeof ZAVORTH_SKILL_WORKER_MESH_CONTRACT_VERSION;
  kind: 'skill-install-receipt';
  id: string;
  generatedAt: string;
  status: 'preview' | 'applied' | 'blocked' | 'failed' | 'partial';
  source: SkillInstallPlan['source'];
  skillId: string | null;
  targetDir: string | null;
  materialized: boolean;
  /** Tool binds after install; empty on pure preview when not local. */
  toolBinds: ZavorthSkillToolBinding[];
  smoke: {
    ran: boolean;
    ok: boolean | null;
    detail: string | null;
  };
  trust: ZavorthSkillTrustScore;
  /** Presence-only; never raw secret material. */
  secretLikePresent: boolean;
  approvalGranted: boolean;
  reason: string;
  /** Normalized pack snapshot / digest for runtime consumers. */
  skillIr?: ZavorthSkillIr | null;
  skillIrDigest?: string | null;
  parserId?: ZavorthSkillIrParserId | null;
};

// ---------------------------------------------------------------------------
// Worker profile + invoke receipt
// ---------------------------------------------------------------------------

export type ZavorthWorkerAdapterKind = ZavorthExternalAgentAdapterKind | 'internal';

export type ZavorthWorkerHealthStatus = 'unknown' | 'healthy' | 'degraded' | 'unreachable' | 'disabled';

/**
 * Unified worker — external agent profile or internal subagent slot.
 * Brand-agnostic: identify by path, command, URL, or internal id — never by product marketing names.
 */
export type WorkerProfile = {
  contractVersion: typeof ZAVORTH_SKILL_WORKER_MESH_CONTRACT_VERSION;
  kind: 'worker-profile';
  id: string;
  label: string;
  adapter: ZavorthWorkerAdapterKind;
  /** How to run: CLI command, HTTP endpoint, ACP/MCP target, or internal role. */
  how: {
    command: string | null;
    args: string[];
    endpoint: string | null;
    root: string | null;
    internalRole: string | null;
  };
  capabilities: string[];
  health: {
    status: ZavorthWorkerHealthStatus;
    checkedAt: string | null;
    detail: string | null;
  };
  policy: {
    liveEnabled: boolean;
    requiresApprovalPerInvoke: boolean;
    allowNetwork: boolean;
    isolation: 'none' | 'local-supervised' | 'wsl' | 'docker' | 'internal';
  };
  createdAt: string;
  updatedAt: string;
};

/**
 * Proof of a worker invocation (dry-run or live).
 */
export type WorkerInvokeReceipt = {
  contractVersion: typeof ZAVORTH_SKILL_WORKER_MESH_CONTRACT_VERSION;
  kind: 'worker-invoke-receipt';
  id: string;
  generatedAt: string;
  workerId: string;
  mode: 'dry-run' | 'live';
  status: 'completed' | 'blocked' | 'failed' | 'approval-required' | 'timeout';
  exitCode: number | null;
  /** Truncated / redacted summary — not full secret-bearing streams. */
  stdoutSummary: string | null;
  stderrSummary: string | null;
  isolation: WorkerProfile['policy']['isolation'];
  approvalGranted: boolean;
  durationMs: number | null;
  reason: string;
};

/** Thirty-second pitch for operators / prompts. */
export function formatSkillWorkerMeshPitch(locale: 'en' | 'pt' = 'en'): string {
  if (locale === 'pt') {
    return [
      'Skill = instructions (not an executor alone).',
      'Tool/Plugin = what actually runs inside Zavorth.',
      'Worker = external process or subagent with health + invoke + receipt.',
      'Skill install and worker register are generic: path, URL, or command — no competitor branding.',
    ].join(' ');
  }
  return [
    'Skill = instructions (not an executor alone).',
    'Tool/Plugin = what actually runs inside Zavorth.',
    'Worker = external process or subagent with health + invoke + receipt.',
    'Skill install and worker register are generic: path, URL, or command — no competitor branding.',
  ].join(' ');
}
