/**
 * Experience skill learning loop (Zavorth):
 * after a successful multi-tool turn, materialize a reviewable skill draft
 * and return a short user-visible nudge.
 *
 * Conservative defaults (cognitive cost without heaviness):
 * - Never auto-installs to SkillLoader / `.agents/skills` — only explicit promote
 *   installs a runtime skill (optional `--dry-run` / previewPromote first).
 * - Nudges are rate-limited (default <=1 per 15 min via ZAVORTH_SKILL_LEARN_NUDGE_COOLDOWN_MS).
 * - This is the light experience-skill-drafts plane, not the preference/spine learning plane.
 *
 * On reuse: merge tools / revisions. Optional LLM compaction of Procedure
 * when ZAVORTH_SKILL_LEARN_LLM_COMPACT=1 (or input.llmCompact=true).
 */

import crypto from 'node:crypto';
import type { ILlmProvider } from '../../providers/ILlmProvider.js';

export type ExperienceSkillLearningTurnInput = {
  userId?: string | null;
  sessionId?: string | null;
  surface?: string | null;
  userMessage: string;
  assistantText: string;
  toolsCalled: string[];
  toolCallCount?: number;
  toolFailures?: string[];
  outcome?: 'success' | 'failure';
  projectRoot?: string | null;
  /** Minimum tool receipts to trigger (default 5). */
  minToolCalls?: number;
  /**
   * Optional LLM compaction of the Procedure section after improve/create.
   * Default: env ZAVORTH_SKILL_LEARN_LLM_COMPACT=1|true.
   */
  llmCompact?: boolean;
  /** Injected LLM for compaction (tests / custom). */
  compactLlm?: Pick<ILlmProvider, 'chat'> | null;
};

export type ExperienceSkillLearningResult = {
  triggered: boolean;
  reason: string;
  skillDraftId: string | null;
  skillTitle: string | null;
  skillPath: string | null;
  userNudge: string | null;
  toolsRecorded: string[];
  improved: boolean;
  llmCompacted: boolean;
};

export type ExperienceSkillDraftSummary = {
  id: string;
  title: string;
  path: string;
  tools: string[];
  surface: string;
  createdAt: string;
  updatedAt?: string;
  useCount: number;
  revisions?: number;
  eventIds?: string[];
  fingerprint?: string;
  /** ISO timestamp of last reinforce / create / failure touch / governed run. */
  lastUsedAt?: string;
  /** Successful reinforce/create events (feeds successRate / reuse score). */
  successCount?: number;
  /** Matched turn failures for this goal/fingerprint (feeds successRate). */
  failureCount?: number;
  /**
   * Computed: successCount / max(successCount + failureCount, 1), clamped 0..1.
   * Populated by listDrafts; optional on raw meta.
   */
  successRate?: number;
  /** Redacted search snippet (~200 chars). Populated by searchDrafts. */
  snippet?: string;
  /** FTS-like rank from searchDrafts (unique token matches + title boost). */
  searchScore?: number;
};

/** Ranked hit from local cross-draft search (same fields as summary + snippet/score). */
export type ExperienceSkillDraftSearchHit = ExperienceSkillDraftSummary & {
  snippet: string;
  searchScore: number;
};

/**
 * Light per-user learning profile derived from local drafts + activity.
 * Zavorth-native stats only — not an external preference/memory product.
 */
export type UserLearningProfile = {
  userId: string;
  topTools: Array<{ tool: string; count: number }>;
  topSurfaces: Array<{ surface: string; count: number }>;
  /** Preferred skill titles ranked by reuse score. */
  preferredSkillTitles: string[];
  drafts: number;
  promoted: number;
  weekMetrics: ExperienceSkillWeeklyMetrics;
  /** One EN paragraph for optional agent inject. */
  summary: string;
};

export type ExperienceSkillWeeklyMetrics = {
  weekKey: string;
  draftsCreated: number;
  promotes: number;
  reuses: number;
};

export type ExperienceSkillLearningStatusSnapshot = {
  userId: string;
  enabled: boolean;
  drafts: number;
  improved: number;
  promoted: number;
  workflowsLearned: number;
  badge: string;
  topTools: Array<{ tool: string; count: number }>;
  lastTriggerAt: string | null;
  lastTriggerReason: string | null;
  lastSkillTitle: string | null;
  latest: Array<{ id: string; title: string; useCount: number; revisions: number }>;
  oneLiner: string;
  /** Effective nudge cooldown (ms). Default 15 min; env ZAVORTH_SKILL_LEARN_NUDGE_COOLDOWN_MS. */
  nudgeCooldownMs: number;
  /** Light loop plane id — distinct from heavy spine/preference learning. */
  plane: 'experience-skill-drafts';
  /** Short UX note separating this loop from the preference/spine learning plane. */
  planeNote: string;
  /** Weekly drafts created / promotes / reuses for this ISO week. */
  metrics: ExperienceSkillWeeklyMetrics;
};

export type ExperienceSkillPromoteKind = 'skill' | 'plugin' | 'both';

export type ExperienceSkillPromoteResult = {
  ok: boolean;
  text: string;
  promotedPath?: string;
  runtimeSkillPath?: string;
  skillName?: string;
  loaderReady?: boolean;
  draftId?: string;
  title?: string;
  auditDest?: string;
  skillMdPreview?: string;
  dryRun?: boolean;
  /** skill | plugin | both (default skill). */
  kind?: ExperienceSkillPromoteKind;
  /** skill pack under skills/ (search index). */
  skillPath?: string;
  /** plugin package id when kind=plugin|both. */
  pluginId?: string;
  pluginPath?: string;
  pluginReady?: boolean;
  skillIrDigest?: string | null;
  receiptPath?: string | null;
  skillId?: string | null;
  autoPromote?: false;
};

export type ExperienceSkillPromotePreview = {
  ok: boolean;
  text: string;
  draftId?: string;
  title?: string;
  auditDest?: string;
  runtimeSkillPath?: string;
  skillName?: string;
  /** First ~40 lines or 2k chars of loader SKILL.md that WOULD be written. */
  skillMdPreview?: string;
  dryRun: true;
  kind?: ExperienceSkillPromoteKind;
  skillPath?: string;
  pluginId?: string;
  pluginPath?: string;
};

export type DraftMeta = ExperienceSkillDraftSummary & {
  userMessagePreview?: string;
  fingerprint: string;
  variants?: Array<{ at: string; tools: string[]; note: string }>;
};

export type WeeklyMetricKey = 'draftsCreated' | 'promotes' | 'reuses';

/**
 * Secret scrub patterns for learning-loop redact() only (draft store, inject, runSkill, compact).
 * Expanded beyond thin key=value labels: Bearer, private keys, common vendor token prefixes, JWTs.
 */
const SECRET_LABEL_RE =
  /\b(?:api[_-]?key|access[_-]?key|secret[_-]?key|client[_-]?secret|auth[_-]?token|access[_-]?token|refresh[_-]?token|id[_-]?token|password|passwd|pwd|token|secret|authorization|credentials?)\s*[:=]\s*(?:"[^"]*"|'[^']*'|\S+)/gi;
const SECRET_BEARER_RE = /\bBearer\s+[A-Za-z0-9._~+/=-]+/gi;
const SECRET_BASIC_AUTH_RE = /\bBasic\s+[A-Za-z0-9+/=]{8,}/gi;
const SECRET_VENDOR_TOKEN_RE =
  /\b(?:sk-proj-|sk-ant-|sk-or-|sk-|hf_|AIza|xox[baprs]-|ghp_|gho_|ghu_|ghs_|ghr_|github_pat_|glpat-|xai-|AKIA[0-9A-Z]{8,}|ya29\.|xoxe\.|npm_[A-Za-z0-9]{10,}|pypi-[A-Za-z0-9_-]{20,})[A-Za-z0-9_-]*/g;
const SECRET_PEM_PRIVATE_KEY_RE =
  /-----BEGIN (?:RSA |EC |OPENSSH |DSA |ENCRYPTED )...PRIVATE KEY-----[\s\S]*...-----END (?:RSA |EC |OPENSSH |DSA |ENCRYPTED )...PRIVATE KEY-----/g;
const SECRET_JWT_RE =
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g;
const SECRET_ENV_ASSIGN_RE =
  /\b(?:[A-Z][A-Z0-9_]*(?:API[_-]...KEY|ACCESS[_-]...KEY|SECRET|TOKEN|PASSWORD|PASSWD|AUTHORIZATION|PRIVATE[_-]...KEY)[A-Z0-9_]*)\s*=\s*(?:"[^"]*"|'[^']*'|\S+)/g;

const MIN_TOOLS_DEFAULT = 5;
export const PREFERENCE_ONLY = /^(ok|thanks|yes|no|hi)\b/i;
export const TRIVIAL_GOAL = /^.{0,11}$/;
/** Default per-user nudge cooldown (15 minutes). Override via ZAVORTH_SKILL_LEARN_NUDGE_COOLDOWN_MS. */
const NUDGE_COOLDOWN_MS_DEFAULT = 15 * 60 * 1000;
/** Soft-match requires this many shared slug prefix chars (or equal first-N). */
export const SIMILAR_GOAL_SLUG_CHARS = 24;
/** Soft-match Jaccard threshold (tools overlap). */
export const SIMILAR_TOOL_JACCARD = 0.85;
/** Goal slug soft-match threshold used for runtime recall (tool-less). */
export const GOAL_SIMILARITY_MATCH_MIN = 0.35;

export function cleanUserId(userId?: string | null): string {
  const raw = String(userId || '').trim();
  if (!raw) return 'local-user';
  // Allow only safe path segment chars; strip traversal / relative segments.
  let cleaned = raw
    .replace(/[^a-zA-Z0-9._@+-]+/g, '_')
    .replace(/\.{2,}/g, '_')
    .replace(/^\.+|\.+$/g, '')
    .slice(0, 120);
  if (!cleaned || cleaned === '.' || cleaned === '..') return 'local-user';
  return cleaned;
}

/**
 * Tokenize a free-text search query for local FTS-like draft search.
 * Lowercases, strips punctuation, splits on whitespace; drops empty tokens.
 */
export function tokenizeSearchQuery(query?: string | null): string[] {
  const raw = String(query || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}_.-]+/gu, ' ')
    .trim();
  if (!raw) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(/\s+/)) {
    const t = part.replace(/^[._-]+|[._-]+$/g, '');
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

/** True when haystack contains token as substring or as a split word/tool segment. */
export function textMatchesToken(haystack: string, token: string): boolean {
  const h = String(haystack || '').toLowerCase();
  const t = String(token || '').toLowerCase();
  if (!h || !t) return false;
  if (h.includes(t)) return true;
  // Underscore/hyphen-aware: "web" matches "web_search"
  const parts = h.split(/[^a-z0-9]+/i).filter(Boolean);
  return parts.some((p) => p === t || p.startsWith(t) || t.startsWith(p));
}

/** Redact secrets from learning-loop text (store, inject, runSkill, compact, show). */
export function redact(text: string): string {
  return String(text || '')
    .replace(SECRET_PEM_PRIVATE_KEY_RE, '[REDACTED]')
    .replace(SECRET_JWT_RE, '[REDACTED]')
    .replace(SECRET_BEARER_RE, 'Bearer [REDACTED]')
    .replace(SECRET_BASIC_AUTH_RE, 'Basic [REDACTED]')
    .replace(SECRET_ENV_ASSIGN_RE, (m) => {
      const eq = m.indexOf('=');
      return eq >= 0 ? `${m.slice(0, eq + 1)}[REDACTED]` : '[REDACTED]';
    })
    .replace(SECRET_LABEL_RE, (m) => {
      const sep = m.search(/[:=]/);
      return sep >= 0 ? `${m.slice(0, sep + 1)} [REDACTED]` : '[REDACTED]';
    })
    .replace(SECRET_VENDOR_TOKEN_RE, '[REDACTED]')
    .trim();
}

export function slugify(value: string): string {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'skill';
}

export function titleFromGoal(userMessage: string, tools: string[]): string {
  const goal = redact(userMessage).replace(/\s+/g, ' ').slice(0, 80).trim();
  if (goal.length >= 12) {
    return goal.charAt(0).toUpperCase() + goal.slice(1);
  }
  return `Workflow: ${tools.slice(0, 4).join(' + ')}`;
}

export function resolveMinTools(explicit?: number): number {
  const fromEnv = Number(
    process.env.ZAVORTH_SKILL_LEARN_MIN_TOOLS
    || process.env.ZAVORTH_LEARNING_LOOP_MIN_TOOLS
    || MIN_TOOLS_DEFAULT,
  );
  const n = Number(explicit ?? fromEnv);
  return Math.max(2, Number.isFinite(n) ? n : MIN_TOOLS_DEFAULT);
}

export function emptyResult(reason: string, tools: string[]): ExperienceSkillLearningResult {
  return {
    triggered: false,
    reason,
    skillDraftId: null,
    skillTitle: null,
    skillPath: null,
    userNudge: null,
    toolsRecorded: tools,
    improved: false,
    llmCompacted: false,
  };
}

export function skillLearnLlmCompactEnabled(explicit?: boolean): boolean {
  if (typeof explicit === 'boolean') return explicit;
  const raw = String(process.env.ZAVORTH_SKILL_LEARN_LLM_COMPACT || '').trim().toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on';
}

export function resolveNudgeCooldownMs(env: NodeJS.ProcessEnv = process.env): number {
  const raw = Number(env.ZAVORTH_SKILL_LEARN_NUDGE_COOLDOWN_MS);
  if (Number.isFinite(raw) && raw >= 0) return raw;
  return NUDGE_COOLDOWN_MS_DEFAULT;
}

/** Common prefix length of two strings (used for goal slug soft-match). */
export function commonPrefixLength(a: string, b: string): number {
  const n = Math.min(a.length, b.length);
  let i = 0;
  while (i < n && a[i] === b[i]) i += 1;
  return i;
}

/** ISO week key like `2026-group-28` (week starts Monday, ISO-8601). */
export function getIsoWeekKey(date: Date = new Date()): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  // Thursday in current week decides the year.
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

/**
 * successRate = successCount / max(successCount + failureCount, 1), clamped 0..1.
 */
export function computeSuccessRate(d: {
  successCount?: number;
  failureCount?: number;
}): number {
  const successCount = Math.max(0, Number(d.successCount || 0) || 0);
  const failureCount = Math.max(0, Number(d.failureCount || 0) || 0);
  return Math.min(1, Math.max(0, successCount / Math.max(successCount + failureCount, 1)));
}

/**
 * Reuse score for runtime recall ranking.
 * score = useCount * 0.4 + successRate * 30 + recencyBoost (0–20)
 * successRate = successCount / max(successCount + failureCount, 1) clamped 0..1
 * recency: lastUsedAt within 7d -> +20, 30d -> +10, else +0
 */
export function computeReuseScore(d: {
  useCount?: number;
  successCount?: number;
  failureCount?: number;
  successRate?: number;
  lastUsedAt?: string;
  updatedAt?: string;
}, nowMs: number = Date.now()): number {
  const useCount = Math.max(0, Number(d.useCount || 0) || 0);
  const successRate = typeof d.successRate === 'number' && Number.isFinite(d.successRate)
    ? Math.min(1, Math.max(0, d.successRate))
    : computeSuccessRate(d);
  const lastRaw = d.lastUsedAt || d.updatedAt || '';
  const lastMs = lastRaw ? Date.parse(lastRaw) : NaN;
  let recencyBoost = 0;
  if (Number.isFinite(lastMs)) {
    const ageMs = Math.max(0, nowMs - lastMs);
    const dayMs = 24 * 60 * 60 * 1000;
    if (ageMs <= 7 * dayMs) recencyBoost = 20;
    else if (ageMs <= 30 * dayMs) recencyBoost = 10;
  }
  return useCount * 0.4 + successRate * 30 + recencyBoost;
}

/**
 * Tool-less goal similarity between a free-text message and a draft title/fingerprint.
 * Returns 0..1; higher means stronger goal alignment for runtime recall.
 */
export function goalSimilarity(
  userMessage: string,
  draft: { title?: string; fingerprint?: string; id?: string; userMessagePreview?: string },
): number {
  const msg = String(userMessage || '').trim();
  if (!msg) return 0;
  const goalSlug = slugify(msg);
  if (!goalSlug || goalSlug === 'skill') return 0;

  const fingerprint = crypto
    .createHash('sha256')
    .update(`|${goalSlug}`)
    .digest('hex')
    .slice(0, 16);
  // Note: createDraft fingerprints include userId; inject compares slug/title primarily.
  if (draft.fingerprint && draft.id && draft.id.includes(draft.fingerprint)) {
    // keep fingerprint field available for soft boosts below
  }
  void fingerprint;

  const titleSlug = slugify(draft.title || '');
  const previewSlug = slugify(draft.userMessagePreview || '');
  let best = 0;

  for (const other of [titleSlug, previewSlug]) {
    if (!other || other === 'skill') continue;
    if (other === goalSlug) {
      best = Math.max(best, 1);
      continue;
    }
    const prefixShared = commonPrefixLength(goalSlug, other);
    const first24Equal = goalSlug.length >= SIMILAR_GOAL_SLUG_CHARS
      && other.length >= SIMILAR_GOAL_SLUG_CHARS
      && goalSlug.slice(0, SIMILAR_GOAL_SLUG_CHARS) === other.slice(0, SIMILAR_GOAL_SLUG_CHARS);
    const containsHit = (goalSlug.length >= SIMILAR_GOAL_SLUG_CHARS
        && other.includes(goalSlug.slice(0, SIMILAR_GOAL_SLUG_CHARS)))
      || (other.length >= SIMILAR_GOAL_SLUG_CHARS
        && goalSlug.includes(other.slice(0, SIMILAR_GOAL_SLUG_CHARS)));
    if (first24Equal) {
      best = Math.max(best, 0.95);
    } else if (prefixShared >= SIMILAR_GOAL_SLUG_CHARS || containsHit) {
      best = Math.max(best, 0.85);
    } else if (prefixShared >= 12) {
      best = Math.max(best, Math.min(0.8, prefixShared / Math.max(goalSlug.length, other.length, 1)));
    } else {
      // Token overlap on slug parts (tool-less title similarity)
      const a = new Set(goalSlug.split('-').filter((t) => t.length >= 3));
      const b = new Set(other.split('-').filter((t) => t.length >= 3));
      if (a.size > 0 && b.size > 0) {
        let inter = 0;
        for (const t of a) if (b.has(t)) inter += 1;
        const union = new Set([...a, ...b]).size || 1;
        const j = inter / union;
        if (j >= 0.45) best = Math.max(best, 0.35 + j * 0.5);
      }
    }
  }

  // Exact fingerprint match when caller stored user-scoped fp on draft
  if (draft.fingerprint && msg) {
    // soft: if message slug is embedded in draft id
    if (draft.id && draft.fingerprint && draft.id.includes(draft.fingerprint)) {
      // already accounted via title; leave as-is
    }
  }

  return Math.min(1, Math.max(0, best));
}

/**
 * Master switch for the experience skill learning loop (nudge + inject + draft writes).
 * Default: enabled. Set ZAVORTH_SKILL_LEARN_LOOP=0|false|off to disable without removing code.
 */
export function isExperienceSkillLearningLoopEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const raw = String(env.ZAVORTH_SKILL_LEARN_LOOP ?? env.ZAVORTH_LEARNING_LOOP ?? '1').trim().toLowerCase();
  if (!raw) return true;
  return !(raw === '0' || raw === 'false' || raw === 'off' || raw === 'no' || raw === 'disabled');
}
