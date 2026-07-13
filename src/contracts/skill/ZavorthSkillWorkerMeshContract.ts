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

export const ZAVORTH_SKILL_WORKER_MESH_CONTRACT_VERSION =
  '2026-07-13.skill-worker-mesh-w0' as const;

// ---------------------------------------------------------------------------
// Glossary tokens (stable ids for docs / UI / prompts)
// ---------------------------------------------------------------------------

export const ZAVORTH_SKILL_WORKER_GLOSSARY = {
  skill: {
    id: 'skill',
    en: 'Instruction pack + metadata; not an executor by itself.',
    pt: 'Pacote de instrução + metadados; não é executor sozinho.',
  },
  tool: {
    id: 'tool',
    en: 'Real executable capability registered on the agent ToolRegistry.',
    pt: 'Capacidade executável real registrada no ToolRegistry do agent.',
  },
  plugin: {
    id: 'plugin',
    en: 'Packaged capability module (Plugin OS) that can bind tools/channels/providers.',
    pt: 'Módulo de capability (Plugin OS) que pode ligar tools/canais/providers.',
  },
  worker: {
    id: 'worker',
    en: 'Runnable actor (external process/service or internal subagent) with health + invoke.',
    pt: 'Ator executável (processo/serviço externo ou subagent interno) com health + invoke.',
  },
  receipt: {
    id: 'receipt',
    en: 'Durable proof of preview/approve/install/invoke; no raw secrets.',
    pt: 'Prova durável de preview/approve/install/invoke; sem secrets em claro.',
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

export type ZavorthSkillToolBindStatus =
  | 'direct'
  | 'aliased'
  | 'gateway'
  | 'unresolved';

export type ZavorthSkillToolBinding = {
  declaredName: string;
  resolvedName: string | null;
  status: ZavorthSkillToolBindStatus;
  /** e.g. alias map hit, zavorth_action fallback, missing from registry */
  note?: string;
};

export type ZavorthSkillInstallRisk = {
  id: string;
  severity: 'info' | 'low' | 'medium' | 'high' | 'critical';
  title: string;
  detail: string;
  secretLike?: boolean;
};

// ---------------------------------------------------------------------------
// Skill install plan + receipt (W1–W3 implement against these)
// ---------------------------------------------------------------------------

/**
 * Preview of a skill install (dry). W1 `preview(source)` returns this shape.
 */
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
  /** Tool binds after reconcile (W3); empty on pure preview. */
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
};

// ---------------------------------------------------------------------------
// Worker profile + invoke receipt (W4–W5 implement against these)
// ---------------------------------------------------------------------------

export type ZavorthWorkerAdapterKind =
  | ZavorthExternalAgentAdapterKind
  | 'internal';

export type ZavorthWorkerHealthStatus =
  | 'unknown'
  | 'healthy'
  | 'degraded'
  | 'unreachable'
  | 'disabled';

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

// ---------------------------------------------------------------------------
// Capability gate checklist tokens (services may import for product gates)
// ---------------------------------------------------------------------------

export const ZAVORTH_SKILL_WORKER_WAVE_IDS = [
  'W0',
  'W1',
  'W2',
  'W3',
  'W4',
  'W5',
  'W6',
  'W7',
  'W8',
  'W9',
  'W10',
] as const;

export type ZavorthSkillWorkerWaveId = (typeof ZAVORTH_SKILL_WORKER_WAVE_IDS)[number];

export type ZavorthSkillWorkerWaveGate = {
  waveId: ZavorthSkillWorkerWaveId;
  /** Human-readable done criteria for this wave (product language). */
  doneWhen: string[];
};

/**
 * Canonical "done when" lines — keep in sync with the temporary wave doc.
 */
export const ZAVORTH_SKILL_WORKER_WAVE_GATES: ZavorthSkillWorkerWaveGate[] = [
  {
    waveId: 'W0',
    doneWhen: [
      'SkillInstallPlan, SkillInstallReceipt, WorkerProfile, WorkerInvokeReceipt exist as shared types',
      'Glossary skill/tool/plugin/worker/receipt is documented in-contract',
      'Later waves import these types instead of inventing parallel shapes',
    ],
  },
  {
    waveId: 'W1',
    doneWhen: [
      'preview → approve → apply → receipt for skill install shares one service for CLI and tool',
    ],
  },
  {
    waveId: 'W2',
    doneWhen: ['Trust score is evidence-based; no competitor publisher defaults'],
  },
  {
    waveId: 'W3',
    doneWhen: ['Post-install tool binds resolve direct/alias/gateway/unresolved with receipt'],
  },
  {
    waveId: 'W4',
    doneWhen: ['Workers list/health/invoke use WorkerProfile + WorkerInvokeReceipt'],
  },
  {
    waveId: 'W5',
    doneWhen: ['Router chooses local tools vs worker without brand hardcoding'],
  },
  {
    waveId: 'W6',
    doneWhen: ['Search/discover for skills and workers works offline for local fixtures'],
  },
  {
    waveId: 'W7',
    doneWhen: ['Daily-ops exposure includes skill + worker tools with brand-agnostic help'],
  },
  {
    waveId: 'W8',
    doneWhen: ['Focused QA green; gate before Telegram agent-first'],
  },
  {
    waveId: 'W9',
    doneWhen: [
      'Telegram natural text goes to LLM; slash commands stay deterministic; mesh tools stable first',
    ],
  },
  {
    waveId: 'W10',
    doneWhen: ['Temporary planning docs removed after essentials migrated to permanent product docs'],
  },
];

/** Thirty-second pitch for operators / prompts. */
export function formatSkillWorkerMeshPitch(locale: 'en' | 'pt' = 'en'): string {
  if (locale === 'pt') {
    return [
      'Skill = instrução (não executa sozinha).',
      'Tool/Plugin = o que de fato executa no Zavorth.',
      'Worker = processo externo ou subagent com health + invoke + receipt.',
      'Install de skill e register de worker são genéricos: path, URL ou comando — sem marca de concorrente.',
    ].join(' ');
  }
  return [
    'Skill = instructions (not an executor alone).',
    'Tool/Plugin = what actually runs inside Zavorth.',
    'Worker = external process or subagent with health + invoke + receipt.',
    'Skill install and worker register are generic: path, URL, or command — no competitor branding.',
  ].join(' ');
}
