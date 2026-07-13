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
 * Decides whether durable learning may write for this actor/surface.
 * Prefer explicit allowLearningWrite when provided; otherwise apply surface rules.
 */
export function canActorWriteLearning(input: LearningWriteAuthInput): boolean {
  if (input.allowLearningWrite === false) return false;
  if (input.allowLearningWrite === true) return true;

  const surface = String(input.surface || '').trim().toLowerCase();
  if (surface === 'telegram') {
    return canTelegramActorWriteLearning(input.userId);
  }
  if (surface === 'whatsapp') {
    return canWhatsAppActorWriteLearning(input.userId, input.chatId);
  }

  // Other surfaces write into the caller's per-user store when a userId is present.
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
