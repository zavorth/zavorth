/**
 * Resolve multi-model consensus panels from the user's own stack.
 *
 * Never invents product vendors (no gpt-4o / claude defaults).
 * Sources (in order for strategy=auto):
 *  1) Explicit reviewers on the tool call (user/agent chose this turn)
 *  2) Saved consensus profile (data/runtime/consensus-preferences.json)
 *  3) User provider selection: primary + secondary + fallback providers
 *  4) Session model route (optional extra diversity)
 *
 * If the user has not configured enough models, returns ok=false with guidance.
 */

import fs from 'node:fs';
import path from 'node:path';
import {
  readProviderPreference,
  resolveUserProviderSelection,
  type UserProviderSelection,
} from './UserSelectionResolver.js';
import { SessionModelRouteService } from './SessionModelRouteService.js';

export type ConsensusReviewerSpec = {
  provider: string;
  model: string;
  temperature?: number;
  source: string;
};

export type ConsensusProfile = {
  /** User must opt in before auto-run without explicit reviewers. */
  enabled?: boolean;
  defaultMode?: 'plain' | 'fallback';
  reviewers?: Array<{ provider: string; model: string; temperature?: number }>;
  synthesizer?: { provider: string; model: string } | null;
  minReviewers?: number;
  updatedAt?: string;
};

export type ConsensusPanelResolution = {
  ok: boolean;
  strategy: string;
  reviewers: ConsensusReviewerSpec[];
  synthesizer: ConsensusReviewerSpec | null;
  modeDefault: 'plain' | 'fallback';
  userSelection: UserProviderSelection;
  availableFromUserStack: ConsensusReviewerSpec[];
  profile: ConsensusProfile | null;
  reason: string;
  guidance: string[];
};

export type ResolveConsensusPanelInput = {
  projectRoot?: string;
  env?: NodeJS.ProcessEnv;
  sessionId?: string | null;
  /** explicit | profile | user_stack | auto */
  strategy?: string | null;
  explicitReviewers?: unknown;
  explicitSynthesizer?: unknown;
  /** When true, only list candidates — never require run readiness. */
  previewOnly?: boolean;
  isProviderAvailable?: (providerName: string) => boolean;
  /** Optional model resolver when preference only has provider id. */
  resolveDefaultModel?: (providerName: string) => string | null;
};

const PROFILE_FILE = 'consensus-preferences.json';

export function consensusProfilePath(projectRoot?: string): string {
  const root = projectRoot || process.cwd();
  return path.join(root, 'data', 'runtime', PROFILE_FILE);
}

export function readConsensusProfile(projectRoot?: string): ConsensusProfile | null {
  try {
    const filePath = consensusProfilePath(projectRoot);
    if (!fs.existsSync(filePath)) return null;
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as ConsensusProfile;
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

export function writeConsensusProfile(
  profile: ConsensusProfile,
  projectRoot?: string,
): ConsensusProfile {
  const filePath = consensusProfilePath(projectRoot);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const next: ConsensusProfile = {
    ...profile,
    updatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(filePath, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
  return next;
}

export function resolveConsensusPanel(input: ResolveConsensusPanelInput = {}): ConsensusPanelResolution {
  const env = input.env || process.env;
  const projectRoot = input.projectRoot || process.cwd();
  const strategy = normalizeStrategy(input.strategy);
  const selection = resolveUserProviderSelection({ projectRoot, env });
  const profile = readConsensusProfile(projectRoot);
  const isAvailable = input.isProviderAvailable || (() => true);
  const resolveModel = input.resolveDefaultModel || (() => null);

  const availableFromUserStack = buildUserStackCandidates({
    selection,
    sessionId: input.sessionId,
    projectRoot,
    isAvailable,
    resolveModel,
  });

  const guidance = baseGuidance(selection, availableFromUserStack, profile);

  // Explicit reviewers always win when provided.
  const explicit = parseReviewerList(input.explicitReviewers, 'explicit');
  if (explicit.length > 0 && (strategy === 'auto' || strategy === 'explicit')) {
    const synthesizer = parseReviewer(input.explicitSynthesizer, 'explicit')
      || (profile?.synthesizer
        ? toSpec(profile.synthesizer.provider, profile.synthesizer.model, 'profile.synthesizer')
        : null)
      || explicit[0];
    return finish({
      ok: true,
      strategy: 'explicit',
      reviewers: filterAvailable(explicit, isAvailable),
      synthesizer,
      modeDefault: profile?.defaultMode === 'fallback' ? 'fallback' : 'plain',
      userSelection: selection,
      availableFromUserStack,
      profile,
      reason: 'Using reviewers supplied on this call (user/agent choice for this turn).',
      guidance,
      previewOnly: input.previewOnly,
      minReviewers: profile?.minReviewers,
    });
  }

  if (strategy === 'profile' || strategy === 'auto') {
    const fromProfile = parseReviewerList(profile?.reviewers, 'profile');
    // enabled defaults to true when reviewers are saved
    if (fromProfile.length > 0 && profile?.enabled !== false) {
      const synthesizer = parseReviewer(input.explicitSynthesizer, 'explicit')
        || (profile?.synthesizer
          ? toSpec(profile.synthesizer.provider, profile.synthesizer.model, 'profile.synthesizer')
          : null)
        || fromProfile[0];
      return finish({
        ok: true,
        strategy: 'profile',
        reviewers: filterAvailable(fromProfile, isAvailable),
        synthesizer,
        modeDefault: profile?.defaultMode === 'fallback' ? 'fallback' : 'plain',
        userSelection: selection,
        availableFromUserStack,
        profile,
        reason: 'Using saved consensus profile (user-configured reviewers).',
        guidance,
        previewOnly: input.previewOnly,
        minReviewers: profile?.minReviewers,
      });
    }
  }

  if (strategy === 'user_stack' || strategy === 'auto') {
    if (availableFromUserStack.length >= 2) {
      const synthesizer = parseReviewer(input.explicitSynthesizer, 'explicit')
        || (profile?.synthesizer
          ? toSpec(profile.synthesizer.provider, profile.synthesizer.model, 'profile.synthesizer')
          : null)
        || availableFromUserStack[0];
      return finish({
        ok: true,
        strategy: 'user_stack',
        reviewers: availableFromUserStack,
        synthesizer,
        modeDefault: profile?.defaultMode === 'fallback' ? 'fallback' : 'plain',
        userSelection: selection,
        availableFromUserStack,
        profile,
        reason:
          'Built panel from your provider selection (primary, secondary model, fallbacks'
          + (input.sessionId ? ', session model' : '')
          + '). No product-default models were invented.',
        guidance,
        previewOnly: input.previewOnly,
        minReviewers: profile?.minReviewers,
      });
    }
  }

  // Not enough configuration
  return {
    ok: false,
    strategy,
    reviewers: [],
    synthesizer: null,
    modeDefault: profile?.defaultMode === 'fallback' ? 'fallback' : 'plain',
    userSelection: selection,
    availableFromUserStack,
    profile,
    reason: availableFromUserStack.length === 1
      ? 'Only one model is available from your stack. Consensus needs at least two distinct reviewers that you chose.'
      : 'No consensus panel: pass reviewers explicitly, save a consensus profile, or configure secondary/fallback providers in your selection.',
    guidance,
  };
}

/**
 * Fallback candidates for ConsensusWithFallback — only from the user stack.
 */
export function resolveUserFallbackCandidates(input: {
  projectRoot?: string;
  env?: NodeJS.ProcessEnv;
  exclude?: { provider: string; model: string };
  isProviderAvailable?: (providerName: string) => boolean;
  resolveDefaultModel?: (providerName: string) => string | null;
}): Array<{ provider: string; model: string }> {
  const panel = resolveConsensusPanel({
    ...input,
    strategy: 'user_stack',
    previewOnly: true,
  });
  const excludeKey = input.exclude
    ? keyOf(input.exclude.provider, input.exclude.model)
    : null;
  return panel.availableFromUserStack
    .filter((c) => keyOf(c.provider, c.model) !== excludeKey)
    .map((c) => ({ provider: c.provider, model: c.model }));
}

// ── internals ────────────────────────────────────────────────────────

function finish(input: {
  ok: boolean;
  strategy: string;
  reviewers: ConsensusReviewerSpec[];
  synthesizer: ConsensusReviewerSpec | null;
  modeDefault: 'plain' | 'fallback';
  userSelection: UserProviderSelection;
  availableFromUserStack: ConsensusReviewerSpec[];
  profile: ConsensusProfile | null;
  reason: string;
  guidance: string[];
  previewOnly?: boolean;
  minReviewers?: number;
}): ConsensusPanelResolution {
  const min = Math.max(2, Math.floor(input.minReviewers || 2));
  // Dedupe reviewers by provider/model
  const seen = new Set<string>();
  const reviewers = input.reviewers.filter((r) => {
    const k = keyOf(r.provider, r.model);
    if (seen.has(k)) return false;
    seen.add(k);
    return Boolean(r.provider && r.model);
  });

  if (!input.previewOnly && reviewers.length < min) {
    return {
      ...input,
      ok: false,
      reviewers,
      reason:
        `Need at least ${min} distinct user-chosen reviewers; got ${reviewers.length}. `
        + 'Pass more reviewers, add secondary/fallback providers, or save a consensus profile.',
    };
  }

  // Diversity: if only one distinct model, fail on run (preview can still show it)
  if (!input.previewOnly && reviewers.length >= min) {
    return { ...input, ok: true, reviewers };
  }

  return { ...input, reviewers };
}

function buildUserStackCandidates(input: {
  selection: UserProviderSelection;
  sessionId?: string | null;
  projectRoot: string;
  isAvailable: (name: string) => boolean;
  resolveModel: (providerName: string) => string | null;
}): ConsensusReviewerSpec[] {
  const out: ConsensusReviewerSpec[] = [];
  const push = (provider: string | null | undefined, model: string | null | undefined, source: string) => {
    const p = clean(provider);
    const m = clean(model) || (p ? clean(input.resolveModel(p)) : null);
    if (!p || !m) return;
    if (!input.isAvailable(p)) return;
    if (out.some((x) => keyOf(x.provider, x.model) === keyOf(p, m))) return;
    out.push({ provider: p, model: m, source });
  };

  push(input.selection.providerId, input.selection.modelId, 'user.primary');
  push(input.selection.providerId, input.selection.secondaryModelId, 'user.secondary_model');

  for (const fb of input.selection.fallbackProviderIds || []) {
    // Fallback list may be "provider" or "provider:model"
    const [prov, mod] = String(fb).split(':').map((s) => s.trim());
    push(prov, mod || null, 'user.fallback');
  }

  // Preference file may hold extra fields already covered by selection.

  if (input.sessionId) {
    try {
      const route = SessionModelRouteService.getInstance().getSessionModel(input.sessionId);
      if (route?.modelName) {
        push(route.providerName || input.selection.providerId, route.modelName, 'session.model');
      }
    } catch {
      // session store optional
    }
  }

  return out;
}

function baseGuidance(
  selection: UserProviderSelection,
  stack: ConsensusReviewerSpec[],
  profile: ConsensusProfile | null,
): string[] {
  const lines: string[] = [
    'Consensus never invents product-default models (no fixed gpt-4o/claude list).',
    'You choose when to run it (tool call / slash) and which reviewers to use.',
  ];
  if (!selection.configured) {
    lines.push('Configure a primary provider first (settings / zavorth providers / preference file).');
  } else {
    lines.push(
      `Primary selection: ${selection.providerId || '...'}${selection.modelId ? ` / ${selection.modelId}` : ' (no model id yet)'}.`,
    );
  }
  if (stack.length < 2) {
    lines.push(
      'Add a secondary model and/or fallback providers in your selection, or save a consensus profile with 2+ reviewers.',
    );
    lines.push(
      'Example tool call: action=run reviewers=[{provider,model},{provider,model}] synthesizer={provider,model}.',
    );
    lines.push(
      'Or: action=save_profile enabled=true reviewers=[...] then action=run strategy=profile.',
    );
  } else {
    lines.push(`User stack currently yields ${stack.length} candidate reviewer(s).`);
  }
  if (profile?.reviewers?.length) {
    lines.push(`Saved consensus profile has ${profile.reviewers.length} reviewer(s) (enabled=${profile.enabled !== false}).`);
  }
  return lines;
}

function filterAvailable(
  reviewers: ConsensusReviewerSpec[],
  isAvailable: (name: string) => boolean,
): ConsensusReviewerSpec[] {
  return reviewers.filter((r) => isAvailable(r.provider));
}

function parseReviewerList(raw: unknown, source: string): ConsensusReviewerSpec[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => parseReviewer(item, source))
    .filter((r): r is ConsensusReviewerSpec => Boolean(r));
}

function parseReviewer(raw: unknown, source: string): ConsensusReviewerSpec | null {
  if (!raw || typeof raw !== 'object') return null;
  const rec = raw as Record<string, unknown>;
  const provider = clean(rec.provider);
  const model = clean(rec.model);
  if (!provider || !model) return null;
  const temperature = Number(rec.temperature);
  return {
    provider,
    model,
    source,
    ...(Number.isFinite(temperature) ? { temperature } : {}),
  };
}

function toSpec(provider: string, model: string, source: string): ConsensusReviewerSpec {
  return { provider: clean(provider)!, model: clean(model)!, source };
}

function clean(value: unknown): string | null {
  const s = String(value ?? '').trim();
  if (!s || s === 'null' || s === 'undefined' || s === 'none') return null;
  return s;
}

function keyOf(provider: string, model: string): string {
  return `${provider.trim().toLowerCase()}::${model.trim().toLowerCase()}`;
}

function normalizeStrategy(raw: unknown): 'auto' | 'explicit' | 'profile' | 'user_stack' {
  const s = String(raw || 'auto').trim().toLowerCase();
  if (s === 'explicit' || s === 'profile' || s === 'user_stack' || s === 'auto') return s;
  return 'auto';
}
