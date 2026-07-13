/**
 * F5e — Optional reaction-based approval shortcuts.
 * ✅ → once, ❌ → deny (session/always optional).
 * High-risk: does not auto-apply approve; requires explicit confirmation.
 */

import type { AgentPermissionChoice } from '../../../../../contracts/permission/AgentPermissionContract.js';
import type { SurfaceProfile } from '../../surface-affordance/index.js';
import { isSurfaceAffordanceEnabled } from '../../surface-affordance/index.js';
import {
  SEMANTIC_INTERACTION_CONTRACT_VERSION,
  type SemanticInteractionEvent,
} from './SemanticInteractionContract.js';

export const SURFACE_REACTION_CONTRACT_VERSION = 'surface-reactions/v1' as const;

export type SurfaceReactionMapping = {
  /** Canonical emoji (display). */
  emoji: string;
  choice: AgentPermissionChoice;
  /** Additional match tokens (emoji variants, shortcodes without :). */
  aliases?: string[];
  label?: string;
};

/** Default permission reaction set (Hermes/OpenClaw-style low friction). */
export const DEFAULT_PERMISSION_REACTIONS: SurfaceReactionMapping[] = [
  {
    emoji: '✅',
    choice: 'once',
    aliases: ['✔️', '✓', '☑', 'white_check_mark', 'heavy_check_mark', '+1', '👍'],
    label: 'Run once',
  },
  {
    emoji: '❌',
    choice: 'deny',
    aliases: ['✖️', '✕', 'x', 'negative_squared_cross_mark', 'no_entry', '👎'],
    label: 'Deny',
  },
  {
    emoji: '🔁',
    choice: 'session',
    aliases: ['🔄', 'repeat', 'arrows_counterclockwise'],
    label: 'Session',
  },
  {
    emoji: '📌',
    choice: 'always',
    aliases: ['📍', 'pushpin', 'round_pushpin'],
    label: 'Always',
  },
];

export type ParseReactionInput = {
  surface: string;
  /** Raw reaction: emoji, :shortcode:, or alias. */
  reaction: string;
  approvalId?: string | null;
  actorId?: string | null;
  sessionId?: string | null;
  /** When true, approving choices require a second confirmation step. */
  highRisk?: boolean;
  /** Profile — if reactions affordance is off, returns blocked event. */
  profile?: SurfaceProfile | null;
  mappings?: SurfaceReactionMapping[];
  metadata?: Record<string, unknown>;
};

function normalizeReactionToken(raw: string): string {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/^:|:$/g, '')
    .replace(/\s+/g, '');
}

/** Strip variation selectors / skin tones for loose emoji match. */
function stripEmojiModifiers(value: string): string {
  return value.replace(/[\uFE0F\u200D]/g, '');
}

export function matchReactionMapping(
  reaction: string,
  mappings: SurfaceReactionMapping[] = DEFAULT_PERMISSION_REACTIONS,
): SurfaceReactionMapping | null {
  const raw = String(reaction || '').trim();
  if (!raw) return null;
  const normalized = normalizeReactionToken(raw);
  const stripped = stripEmojiModifiers(raw);

  for (const mapping of mappings) {
    const candidates = [mapping.emoji, ...(mapping.aliases || [])];
    for (const candidate of candidates) {
      const c = String(candidate || '');
      if (!c) continue;
      if (c === raw || stripEmojiModifiers(c) === stripped) return mapping;
      if (normalizeReactionToken(c) === normalized) return mapping;
    }
  }
  return null;
}

export function isReactionsEnabled(profile?: SurfaceProfile | null): boolean {
  if (!profile) return true; // allow parse without profile; gate at apply time if needed
  return isSurfaceAffordanceEnabled(profile, 'reactions');
}

/**
 * Parse a reaction into a SemanticInteractionEvent.
 * High-risk + allow choice → requiresConfirmation=true (do not execute until confirmed).
 */
export function parseReactionInteraction(input: ParseReactionInput): SemanticInteractionEvent | null {
  const reaction = String(input.reaction || '').trim();
  if (!reaction) return null;

  const surface = String(input.surface || 'plain').trim().toLowerCase() || 'plain';
  const approvalId = String(input.approvalId || input.metadata?.approvalId || '').trim() || null;
  const mappings = input.mappings || DEFAULT_PERMISSION_REACTIONS;

  if (input.profile && !isReactionsEnabled(input.profile)) {
    return {
      version: SEMANTIC_INTERACTION_CONTRACT_VERSION,
      surface,
      kind: 'reaction',
      controlId: 'agent-permission-choices',
      optionId: null,
      approvalId,
      choice: null,
      action: 'unknown',
      raw: reaction,
      actorId: input.actorId ?? null,
      sessionId: input.sessionId ?? null,
      metadata: {
        ...(input.metadata || {}),
        blocked: true,
        reason: 'reactions_affordance_disabled',
        reaction,
      },
    };
  }

  const mapping = matchReactionMapping(reaction, mappings);
  if (!mapping) {
    return {
      version: SEMANTIC_INTERACTION_CONTRACT_VERSION,
      surface,
      kind: 'reaction',
      controlId: 'agent-permission-choices',
      optionId: null,
      approvalId,
      choice: null,
      action: 'unknown',
      raw: reaction,
      actorId: input.actorId ?? null,
      sessionId: input.sessionId ?? null,
      metadata: {
        ...(input.metadata || {}),
        unmatchedReaction: true,
        reaction,
      },
    };
  }

  const highRisk = Boolean(input.highRisk || input.metadata?.highRisk);
  const isAllow = mapping.choice !== 'deny';
  const requiresConfirmation = highRisk && isAllow;

  return {
    version: SEMANTIC_INTERACTION_CONTRACT_VERSION,
    surface,
    kind: 'reaction',
    controlId: 'agent-permission-choices',
    optionId: `agent-perm-${mapping.choice}`,
    approvalId,
    choice: mapping.choice,
    action: mapping.choice === 'deny' ? 'reject' : 'approve',
    raw: reaction,
    actorId: input.actorId ?? null,
    sessionId: input.sessionId ?? null,
    metadata: {
      ...(input.metadata || {}),
      reaction: mapping.emoji,
      reactionLabel: mapping.label || mapping.choice,
      highRisk,
      requiresConfirmation,
      confirmationPrompt: requiresConfirmation
        ? `High-risk action. Confirm "${mapping.choice}" by replying: yes ${approvalId || '<id>'} ${mapping.choice}`
        : null,
      taskId: approvalId,
      surfaceReactionContract: SURFACE_REACTION_CONTRACT_VERSION,
    },
  };
}

/** Suggested reactions to attach on approval prompts when affordance is on. */
export function buildSuggestedPermissionReactions(
  mappings: SurfaceReactionMapping[] = DEFAULT_PERMISSION_REACTIONS,
): Array<{ emoji: string; choice: AgentPermissionChoice; label: string }> {
  return mappings.map((m) => ({
    emoji: m.emoji,
    choice: m.choice,
    label: m.label || m.choice,
  }));
}

/**
 * Confirm a high-risk reaction: user replies "yes <id> once" or just "yes" with context.
 */
export function parseReactionConfirmation(
  raw: string,
  pending: { approvalId: string; choice: AgentPermissionChoice },
): boolean {
  const text = String(raw || '').trim().toLowerCase();
  if (!text) return false;
  if (/^(yes|y|confirm|ok|sim)\b/.test(text)) {
    if (text === 'yes' || text === 'y' || text === 'confirm' || text === 'ok' || text === 'sim') {
      return true;
    }
    // yes <id> [choice]
    const m = /^(?:yes|y|confirm|ok|sim)\s+(\S+)(?:\s+(once|session|always|deny))?$/i.exec(
      String(raw || '').trim(),
    );
    if (!m) return true;
    const id = m[1];
    if (id && id !== pending.approvalId && !pending.approvalId.startsWith(id)) {
      return false;
    }
    if (m[2] && m[2].toLowerCase() !== pending.choice) {
      return false;
    }
    return true;
  }
  return false;
}

export function isReactionDecisionReady(event: SemanticInteractionEvent): boolean {
  if (event.kind !== 'reaction') return false;
  if (event.metadata?.blocked || event.metadata?.unmatchedReaction) return false;
  if (event.metadata?.requiresConfirmation) return false;
  return Boolean(event.choice && (event.approvalId || event.metadata?.taskId));
}
