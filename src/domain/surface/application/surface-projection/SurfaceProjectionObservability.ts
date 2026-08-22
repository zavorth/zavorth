/**
 * F7 — Projection observability: why native buttons / fallbacks were chosen.
 */

import type { SurfaceProfile } from '../surface-affordance/index.js';
import { isAffordanceEnabled } from '../surface-affordance/index.js';
import type { SurfaceProjectorOutput } from './projectors/SurfaceProjectorContract.js';
import type { ProjectedSurfaceMessage } from './projectSemanticCard.js';

export const SURFACE_PROJECTION_OBS_VERSION = 'surface-projection-obs/v1' as const;

export type SurfaceProjectionExplainResult = {
  version: typeof SURFACE_PROJECTION_OBS_VERSION;
  channel: string;
  profileId: string | null;
  preset: string | null;
  usedNativeButtons: boolean;
  hasReplyOptions: boolean;
  reasons: string[];
  affordances: {
    inline_buttons: boolean;
    select_menu: boolean;
    slash_commands: boolean;
    reactions: boolean;
    voice_reply: boolean;
  };
  projectionModes: string[];
  recommendation: string | null;
};

export type SurfaceProjectionTelemetryEvent = {
  at: string;
  channel: string;
  profileId?: string | null;
  usedNativeButtons: boolean;
  mode?: string | null;
  intent?: string | null;
  responseId?: string | null;
  reasons?: string[];
};

const telemetryLog: SurfaceProjectionTelemetryEvent[] = [];
const MAX_TELEMETRY = 200;

export function explainSurfaceProjection(input: {
  channel: string;
  profile?: SurfaceProfile | null;
  projectorOutput?: SurfaceProjectorOutput | null;
  projected?: ProjectedSurfaceMessage | null;
}): SurfaceProjectionExplainResult {
  const profile = input.profile || null;
  const out = input.projectorOutput || null;
  const projected = input.projected || null;
  const usedNativeButtons = Boolean(
    out?.usedNativeButtons ?? projected?.usedNativeButtons,
  );
  const hasReplyOptions = Boolean(
    out?.replyOptions && Object.keys(out.replyOptions).length > 0,
  );

  const affordances = {
    inline_buttons: profile ? isAffordanceEnabled(profile, 'inline_buttons') : false,
    select_menu: profile ? isAffordanceEnabled(profile, 'select_menu') : false,
    slash_commands: profile ? isAffordanceEnabled(profile, 'slash_commands') : false,
    reactions: profile ? isAffordanceEnabled(profile, 'reactions') : false,
    voice_reply: profile ? isAffordanceEnabled(profile, 'voice_reply') : false,
  };

  const reasons: string[] = [];
  if (!profile) {
    reasons.push('No surface profile resolved; plain/text fallback likely.');
  } else {
    reasons.push(`Profile ${profile.id} uses preset ${profile.preset}.`);
  }

  if (usedNativeButtons) {
    if (affordances.inline_buttons) {
      reasons.push('inline_buttons affordance enabled → native clickable controls.');
    }
    if (affordances.select_menu) {
      reasons.push('select_menu affordance available for long choice lists.');
    }
  } else {
    if (!affordances.inline_buttons) {
      reasons.push('inline_buttons disabled on profile → no native button payload.');
    }
    if (affordances.slash_commands) {
      reasons.push('slash_commands enabled → command hints in text.');
    } else {
      reasons.push('slash_commands disabled → numbered/text options only.');
    }
  }

  if (hasReplyOptions && (out?.replyOptions as unknown as Record<string, unknown>)?.numberedPrompt) {
    reasons.push('Messaging fallback attached numberedOptions for reply 1-N.');
  }
  if (hasReplyOptions && (out?.replyOptions as unknown as Record<string, unknown>)?.suggestedReactions) {
    reasons.push('Reactions suggested on reply payload (parse via reaction handler).');
  }
  if (hasReplyOptions && (out?.replyOptions as unknown as Record<string, unknown>)?.selectMenu) {
    reasons.push('Discord select menu payload present.');
  }

  const projectionModes = (projected?.projection || []).map((p) => `${p.controlId}:${p.mode}`);

  let recommendation: string | null = null;
  if (!usedNativeButtons && profile && !affordances.inline_buttons) {
    recommendation =
      'Enable preset chat-interactive or set affordances.inline_buttons=true to get native buttons.';
  } else if (usedNativeButtons) {
    recommendation = null;
  } else if (!hasReplyOptions) {
    recommendation = 'Text-only projection; user must use slash/commands or numbered reply.';
  }

  return {
    version: SURFACE_PROJECTION_OBS_VERSION,
    channel: String(input.channel || 'plain'),
    profileId: profile?.id || out?.profileId || projected?.profileId || null,
    preset: profile?.preset || null,
    usedNativeButtons,
    hasReplyOptions,
    reasons,
    affordances,
    projectionModes,
    recommendation,
  };
}

export function recordSurfaceProjectionTelemetry(
  event: Omit<SurfaceProjectionTelemetryEvent, 'at'> & { at?: string },
): SurfaceProjectionTelemetryEvent {
  const entry: SurfaceProjectionTelemetryEvent = {
    at: event.at || new Date().toISOString(),
    channel: event.channel,
    profileId: event.profileId ?? null,
    usedNativeButtons: event.usedNativeButtons,
    mode: event.mode ?? null,
    intent: event.intent ?? null,
    responseId: event.responseId ?? null,
    reasons: event.reasons,
  };
  telemetryLog.push(entry);
  if (telemetryLog.length > MAX_TELEMETRY) {
    telemetryLog.splice(0, telemetryLog.length - MAX_TELEMETRY);
  }
  return entry;
}

export function listSurfaceProjectionTelemetry(limit = 50): SurfaceProjectionTelemetryEvent[] {
  const n = Math.max(1, Math.min(200, limit));
  return telemetryLog.slice(-n);
}

export function resetSurfaceProjectionTelemetryForTests(): void {
  telemetryLog.length = 0;
}

/** Human-readable one-liner for operators. */
export function formatProjectionExplain(result: SurfaceProjectionExplainResult): string {
  const lines = [
    `Surface projection (${result.channel})`,
    `profile=${result.profileId || 'none'} preset=${result.preset || 'none'}`,
    `nativeButtons=${result.usedNativeButtons} replyOptions=${result.hasReplyOptions}`,
    ...result.reasons.map((r) => `- ${r}`),
    result.recommendation ? `next: ${result.recommendation}` : null,
  ].filter(Boolean);
  return lines.join('\n');
}
