/**
 * Trusted Operator local preference for Desktop chrome.
 * Hint only — never bypasses red-lane gates.
 */

/** Canonical storage key. */
export const TRUSTED_OPERATOR_KEY = 'zvd:trusted-operator';

/** Legacy onboarding key — still written for compatibility. */
export const DESKTOP_TRUST_MODE_KEY = 'zvd:trusted-operator-hint';

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

function resolveStorage(storage?: StorageLike | null): StorageLike | null {
  if (storage === null) return null;
  if (storage) return storage;
  if (typeof localStorage !== 'undefined') return localStorage;
  return null;
}

function parseBool(raw: string | null | undefined): boolean | null {
  if (raw == null) return null;
  const value = String(raw).trim().toLowerCase();
  if (value === 'true' || value === '1') return true;
  if (value === 'false' || value === '0') return false;
  return null;
}

/** Read Trusted Operator preference (default false). Migrates legacy key. */
export function loadTrustedOperator(storage?: StorageLike | null): boolean {
  const store = resolveStorage(storage);
  if (!store) return false;

  const canonical = parseBool(store.getItem(TRUSTED_OPERATOR_KEY));
  if (canonical != null) return canonical;

  const legacy = parseBool(store.getItem(DESKTOP_TRUST_MODE_KEY));
  if (legacy != null) {
    store.setItem(TRUSTED_OPERATOR_KEY, legacy ? 'true' : 'false');
    return legacy;
  }
  return false;
}

/** Persist preference to both canonical and legacy keys. */
export function saveTrustedOperator(storage: StorageLike | null | undefined, enabled: boolean): void {
  const store = resolveStorage(storage ?? null);
  if (!store) return;
  const value = enabled ? 'true' : 'false';
  store.setItem(TRUSTED_OPERATOR_KEY, value);
  store.setItem(DESKTOP_TRUST_MODE_KEY, value);
}

/** Toggle and persist; returns the new value. */
export function toggleTrustedOperator(
  storage?: StorageLike | null,
  current?: boolean,
): boolean {
  const store = resolveStorage(storage ?? null);
  const next = !(typeof current === 'boolean' ? current : loadTrustedOperator(store));
  saveTrustedOperator(store, next);
  return next;
}

export type TrustedOperatorBadge = {
  enabled: boolean;
  labelKey: string;
  riskNoteKey: string;
};

export function trustedOperatorBadge(enabled: boolean): TrustedOperatorBadge {
  if (enabled) {
    return {
      enabled: true,
      labelKey: 'trust.operator.on',
      riskNoteKey: 'trust.operator.risk.low_auto',
    };
  }
  return {
    enabled: false,
    labelKey: 'trust.operator.off',
    riskNoteKey: 'trust.operator.risk.manual',
  };
}

/**
 * Green-lane helper only: low / empty risk may auto when mode is on.
 * Medium/high/critical never auto-approve.
 */
export function canAutoApproveRisk(
  enabled: boolean,
  risk?: string | null,
): boolean {
  if (!enabled) return false;
  const value = String(risk ?? '').trim().toLowerCase();
  if (!value || value === 'low' || value === 'none') return true;
  return false;
}
