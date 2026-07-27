import { config } from '../config/index.js';

export function isZavorthTelegramOperator(userId: string | number | null | undefined): boolean {
  const id = String(userId || '').trim();
  if (!id) return false;
  const allowed = Array.isArray(config.allowedUserIds) ? config.allowedUserIds : [];
  return allowed.some((entry) => String(entry || '').trim() === id);
}

/**
 * Durable learning write is allowed for allowlisted operators.
 * When no allowlist is configured (single-user host), any non-empty userId may write
 * into their own per-user store.
 */
export function canTelegramActorWriteLearning(userId: string | number | null | undefined): boolean {
  const id = String(userId || '').trim();
  if (!id) return false;
  const allowed = (Array.isArray(config.allowedUserIds) ? config.allowedUserIds : [])
    .map((entry) => String(entry || '').trim())
    .filter(Boolean);
  if (allowed.length === 0) return true;
  return isZavorthTelegramOperator(id);
}

export function isTelegramHostMutationCommand(text: string): boolean {
  const normalized = String(text || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  if (!normalized) return false;
  return normalized === '/setup skip'
    || normalized === '/setup reset'
    || normalized === '/learning forget';
}
