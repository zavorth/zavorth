import { config } from '../config/index.js';
import { canTelegramActorWriteLearning } from './ZavorthTelegramOperatorAuth.js';

export type LearningWriteAuthInput = {
  surface?: string | null;
  userId?: string | null;
  chatId?: string | null;
  /** Explicit override from the caller (e.g. ConversationalAgent options). */
  allowLearningWrite?: boolean | null;
};

/**
 * Multi-tenant public messaging surfaces require explicit allowLearningWrite === true
 * (or surface-specific allowlist for telegram/whatsapp). Do not default-write on userId alone.
 */
const PUBLIC_MULTI_TENANT_SURFACE_RE =
  /telegram|discord|whatsapp|slack|signal|matrix|teams|irc|line|feishu|mattermost|google?.chat|imessage|sms|twitch|wecom|weixin|nostr|qq|yuanbao|zalo|synology|nextcloud|home?.assistant|voice?.call|instagram/i;

/** True when surface looks like a multi-tenant public channel (not cli/desktop/control). */
export function isPublicMultiTenantLearningSurface(surface?: string | null): boolean {
  return PUBLIC_MULTI_TENANT_SURFACE_RE.test(String(surface || '').trim());
}

/**
 * Unified write gate for ExperienceSkill loop + product-surface post-turn learning.
 * Alias of canActorWriteLearning (same rules for both durable paths).
 */
export function isLearningWriteAllowed(input: LearningWriteAuthInput): boolean {
  return canActorWriteLearning(input);
}

/** local Control/Desktop UI identities allowed without authenticated session (loopback only). */
const LOCAL_UI_USER_IDS = new Set(['control', 'desktop', 'local-user']);

/**
 * True when the socket peer is classic loopback (not from client headers).
 * Used by routes to gate unauthenticated local UI userIds.
 */
export function isLoopbackRemoteAddress(remoteAddress?: string | null): boolean {
  const normalized = String(remoteAddress || '')
    .trim()
    .toLowerCase();
  return (
    normalized === '127.0.0.1' ||
    normalized === '::1' ||
    normalized === '::ffff:127.0.0.1' ||
    normalized === 'localhost'
  );
}

/**
 * Resolve userId for GET /api/learning-loop (and similar Control UI APIs).
 * Prefer session identity. local UI shortcut (control/desktop/local-user) only when
 * allowLocalUiWithoutAuth is true (route must set from socket loopback — fail closed by default).
 */
export function resolveLearningLoopApiUserId(input: {
  requestedUserId?: string | null;
  authUserId?: string | null;
  /** Only true when socket peer is loopback — set by route, never from client headers alone. */
  allowLocalUiWithoutAuth?: boolean;
}): { ok: true; userId: string } | { ok: false; error: 'forbidden_user_id' | 'auth_required' } {
  const authUserId = String(input.authUserId || '').trim();
  const requestedUserId = String(input.requestedUserId || '').trim();
  if (authUserId) {
    return { ok: true, userId: authUserId };
  }
  if (input.allowLocalUiWithoutAuth === true) {
    if (!requestedUserId || LOCAL_UI_USER_IDS.has(requestedUserId)) {
      return { ok: true, userId: requestedUserId || 'control' };
    }
    return { ok: false, error: 'forbidden_user_id' };
  }
  if (requestedUserId && !LOCAL_UI_USER_IDS.has(requestedUserId)) {
    return { ok: false, error: 'forbidden_user_id' };
  }
  return { ok: false, error: 'auth_required' };
}

/**
 * Decides whether durable learning may write for this actor/surface.
 * Prefer explicit allowLearningWrite when provided; otherwise apply surface rules.
 * Public multi-tenant channels use surface allowlists (telegram/whatsapp/discord/slack/signal);
 * other public multi-tenant surfaces require explicit allowLearningWrite === true.
 */
export function canActorWriteLearning(input: LearningWriteAuthInput): boolean {
  if (input.allowLearningWrite === false) return false;
  if (input.allowLearningWrite === true) return true;

  const surface = String(input.surface || '')
    .trim()
    .toLowerCase();
  if (surface === 'telegram' || surface.includes('telegram')) {
    return canTelegramActorWriteLearning(input.userId);
  }
  if (surface === 'whatsapp' || surface.includes('whatsapp')) {
    return canWhatsAppActorWriteLearning(input.userId, input.chatId);
  }
  if (surface === 'discord' || surface.includes('discord')) {
    return canDiscordActorWriteLearning(input.userId);
  }
  if (surface === 'slack' || surface.includes('slack')) {
    return canSlackActorWriteLearning(input.userId, input.chatId);
  }
  if (surface === 'signal' || surface.includes('signal')) {
    return canSignalActorWriteLearning(input.userId, input.chatId);
  }

  // Other public multi-tenant surfaces: deny unless caller set allowLearningWrite true (handled above).
  if (isPublicMultiTenantLearningSurface(surface)) {
    return false;
  }

  // local/single-tenant surfaces write into the caller's per-user store when a userId is present.
  return Boolean(String(input.userId || '').trim());
}

/**
 * WhatsApp durable learning write is allowed when the chat/user is on the allowlist.
 * Empty allowlist (single-tenant bridge) allows any non-empty user or chat id.
 */
export function canWhatsAppActorWriteLearning(
  userId?: string | number | null,
  chatId?: string | number | null,
): boolean {
  const id = String(userId || '').trim();
  const chat = String(chatId || '').trim();
  if (!id && !chat) return false;

  const allowed = (Array.isArray(config.whatsappAllowedChatIds) ? config.whatsappAllowedChatIds : [])
    .map((entry) => String(entry || '').trim())
    .filter(Boolean);

  if (allowed.length === 0) return true;
  return allowed.includes(chat) || allowed.includes(id);
}

/**
 * Discord durable learning write is owner/operator-only.
 * Empty owner and operator lists deny (stricter multi-tenant default).
 */
export function canDiscordActorWriteLearning(userId?: string | number | null): boolean {
  const id = String(userId || '').trim();
  if (!id) return false;

  const owners = (Array.isArray(config.discordOwnerUserIds) ? config.discordOwnerUserIds : [])
    .map((entry) => String(entry || '').trim())
    .filter(Boolean);
  const operators = (Array.isArray(config.discordOperatorUserIds) ? config.discordOperatorUserIds : [])
    .map((entry) => String(entry || '').trim())
    .filter(Boolean);

  if (owners.length === 0 && operators.length === 0) return false;
  return owners.includes(id) || operators.includes(id);
}

/**
 * Slack durable learning write is allowed when user or chat is on the channel allowlist.
 * Empty allowlist denies (multi-tenant safety).
 */
export function canSlackActorWriteLearning(userId?: string | number | null, chatId?: string | number | null): boolean {
  const id = String(userId || '').trim();
  const chat = String(chatId || '').trim();
  if (!id && !chat) return false;

  const allowed = (Array.isArray(config.slackAllowedChannelIds) ? config.slackAllowedChannelIds : [])
    .map((entry) => String(entry || '').trim())
    .filter(Boolean);

  if (allowed.length === 0) return false;
  return allowed.includes(chat) || allowed.includes(id);
}

/**
 * Signal durable learning write is allowed when user or chat is on the recipient allowlist.
 * Empty allowlist denies (multi-tenant safety).
 */
export function canSignalActorWriteLearning(userId?: string | number | null, chatId?: string | number | null): boolean {
  const id = String(userId || '').trim();
  const chat = String(chatId || '').trim();
  if (!id && !chat) return false;

  const allowed = (Array.isArray(config.signalAllowedRecipients) ? config.signalAllowedRecipients : [])
    .map((entry) => String(entry || '').trim())
    .filter(Boolean);

  if (allowed.length === 0) return false;
  return allowed.includes(chat) || allowed.includes(id);
}
