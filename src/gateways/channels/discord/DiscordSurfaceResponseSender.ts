/**
 * Discord surface response sender — projects SurfaceResponse for Discord,
 * strips non-API keys, optionally replies, and registers pending approvals.
 */

import type {
  SurfaceRenderOptions,
  SurfaceResponse,
} from '../../../domain/surface/application/surface-response/index.js';
import { resolveSurfaceProfileForChannel } from '../../../domain/surface/application/surface-affordance/index.js';
import {
  explainSurfaceProjection,
  projectResponseForChannel,
  recordSurfaceProjectionTelemetry,
  registerPendingSurfaceApproval,
  type SurfaceProjectorOutput,
} from '../../../domain/surface/application/surface-projection/index.js';

/** Discord API-safe reply keys only (no suggestedReactions / selectMenu flags). */
export type DiscordSurfaceApiReplyOptions = {
  components?: unknown[];
  allowedMentions?: { parse: string[] };
};

export type DiscordSurfaceProjectResult = {
  text: string;
  replyOptions: DiscordSurfaceApiReplyOptions | null;
  output: SurfaceProjectorOutput;
  usedNativeButtons: boolean;
};

export type DiscordSurfaceReplyContext = {
  /**
   * When provided, send the projected text + API-safe options.
   * May return a message id for pending-approval registration.
   */
  reply?: (
    text: string,
    options?: DiscordSurfaceApiReplyOptions,
  ) => Promise<{ messageId?: string | number | null } | void>;
  chatId?: string | null;
  messageId?: string | number | null;
};

export type DiscordSurfaceReplyResult = {
  text: string;
  replyOptions: DiscordSurfaceApiReplyOptions | null;
  messageId: string | null;
  chatId: string | null;
  tracked: boolean;
  usedNativeButtons: boolean;
};

/**
 * Keep only keys Discord.js / REST accept on message create/edit.
 * Drops suggestedReactions, selectMenu, numberedOptions, etc.
 */
export function extractDiscordApiSafeReplyOptions(
  output: SurfaceProjectorOutput,
): DiscordSurfaceApiReplyOptions | null {
  const opts = (output.replyOptions || {}) as Record<string, unknown>;
  if (!opts || typeof opts !== 'object') {
    return null;
  }

  const components = Array.isArray(opts.components) ? (opts.components as unknown[]) : [];
  const allowedMentions =
    opts.allowedMentions && typeof opts.allowedMentions === 'object'
      ? (opts.allowedMentions as { parse: string[] })
      : undefined;

  if (components.length === 0 && !allowedMentions) {
    return null;
  }

  return {
    allowedMentions: allowedMentions || { parse: [] },
    ...(components.length > 0 ? { components } : {}),
  };
}

/**
 * Project a SurfaceResponse for Discord and record F7 telemetry.
 * Does not send; returns text + API-safe replyOptions.
 */
export function projectDiscordSurfaceResponse(
  response: SurfaceResponse,
  options: SurfaceRenderOptions = {},
): DiscordSurfaceProjectResult {
  const profile = resolveSurfaceProfileForChannel('discord');
  const output = projectResponseForChannel('discord', response, options, { profile });

  const explain = explainSurfaceProjection({
    channel: 'discord',
    profile,
    projectorOutput: output,
  });
  recordSurfaceProjectionTelemetry({
    channel: 'discord',
    profileId: profile.id,
    usedNativeButtons: output.usedNativeButtons,
    intent: response.intent,
    responseId: response.id,
    reasons: explain.reasons.slice(0, 4),
  });

  return {
    text: output.text,
    replyOptions: extractDiscordApiSafeReplyOptions(output),
    output,
    usedNativeButtons: output.usedNativeButtons,
  };
}

/**
 * Project + optionally reply on Discord. Registers pending surface approval
 * when trackApprovalId (or response.metadata.approvalId), chatId, and messageId are present.
 */
export async function replyWithDiscordSurfaceResponse(
  ctx: DiscordSurfaceReplyContext,
  response: SurfaceResponse,
  options: SurfaceRenderOptions & {
    trackApprovalId?: string | null;
    highRisk?: boolean;
  } = {},
): Promise<DiscordSurfaceReplyResult> {
  const projected = projectDiscordSurfaceResponse(response, options);

  let messageId: string | null =
    ctx.messageId != null && String(ctx.messageId).trim()
      ? String(ctx.messageId).trim()
      : null;

  if (ctx.reply) {
    const sent = await ctx.reply(
      projected.text,
      projected.replyOptions || undefined,
    );
    if (sent && typeof sent === 'object' && sent.messageId != null) {
      messageId = String(sent.messageId).trim() || messageId;
    }
  }

  const chatId = ctx.chatId != null ? String(ctx.chatId).trim() || null : null;
  const trackId = String(
    options.trackApprovalId || response.metadata?.approvalId || '',
  ).trim();

  let tracked = false;
  if (trackId && chatId && messageId) {
    registerPendingSurfaceApproval({
      approvalId: trackId,
      surface: 'discord',
      chatId,
      messageId,
      highRisk: Boolean(options.highRisk || response.metadata?.highRisk),
      numberedOptions: (response.actions || []).map((a) => a.id),
    });
    tracked = true;
  }

  return {
    text: projected.text,
    replyOptions: projected.replyOptions,
    messageId,
    chatId,
    tracked,
    usedNativeButtons: projected.usedNativeButtons,
  };
}
