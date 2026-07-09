import { describe, expect, it } from 'vitest';
import {
  canAutoApproveRisk,
  DESKTOP_TRUST_MODE_KEY,
  loadTrustedOperator,
  saveTrustedOperator,
  toggleTrustedOperator,
  TRUSTED_OPERATOR_KEY,
  trustedOperatorBadge,
} from '../src/trust/trustedOperator';

function memoryStorage(seed: Record<string, string> = {}) {
  const map = new Map(Object.entries(seed));
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
    dump: () => Object.fromEntries(map.entries()),
  };
}

describe('loadTrustedOperator', () => {
  it('returns false for null storage', () => {
    expect(loadTrustedOperator(null)).toBe(false);
  });

  it('reads canonical key', () => {
    expect(loadTrustedOperator(memoryStorage({ [TRUSTED_OPERATOR_KEY]: 'true' }))).toBe(true);
    expect(loadTrustedOperator(memoryStorage({ [TRUSTED_OPERATOR_KEY]: 'false' }))).toBe(false);
  });

  it('migrates legacy DESKTOP_TRUST_MODE_KEY when canonical missing', () => {
    const store = memoryStorage({ [DESKTOP_TRUST_MODE_KEY]: 'true' });
    expect(loadTrustedOperator(store)).toBe(true);
    expect(store.getItem(TRUSTED_OPERATOR_KEY)).toBe('true');
  });

  it('prefers canonical over legacy', () => {
    const store = memoryStorage({
      [TRUSTED_OPERATOR_KEY]: 'false',
      [DESKTOP_TRUST_MODE_KEY]: 'true',
    });
    expect(loadTrustedOperator(store)).toBe(false);
  });

  it('treats 1/0 as booleans', () => {
    expect(loadTrustedOperator(memoryStorage({ [TRUSTED_OPERATOR_KEY]: '1' }))).toBe(true);
    expect(loadTrustedOperator(memoryStorage({ [TRUSTED_OPERATOR_KEY]: '0' }))).toBe(false);
  });

  it('returns false for empty / garbage values', () => {
    expect(loadTrustedOperator(memoryStorage({}))).toBe(false);
    expect(loadTrustedOperator(memoryStorage({ [TRUSTED_OPERATOR_KEY]: 'yes' }))).toBe(false);
  });
});

describe('saveTrustedOperator / toggleTrustedOperator', () => {
  it('saves both canonical and legacy keys', () => {
    const store = memoryStorage();
    saveTrustedOperator(store, true);
    expect(store.getItem(TRUSTED_OPERATOR_KEY)).toBe('true');
    expect(store.getItem(DESKTOP_TRUST_MODE_KEY)).toBe('true');
    saveTrustedOperator(store, false);
    expect(store.getItem(TRUSTED_OPERATOR_KEY)).toBe('false');
    expect(store.getItem(DESKTOP_TRUST_MODE_KEY)).toBe('false');
  });

  it('no-ops on null storage', () => {
    expect(() => saveTrustedOperator(null, true)).not.toThrow();
    expect(toggleTrustedOperator(null, false)).toBe(true);
  });

  it('toggles from current argument', () => {
    const store = memoryStorage();
    expect(toggleTrustedOperator(store, false)).toBe(true);
    expect(loadTrustedOperator(store)).toBe(true);
    expect(toggleTrustedOperator(store, true)).toBe(false);
    expect(loadTrustedOperator(store)).toBe(false);
  });

  it('toggles from stored value when current omitted', () => {
    const store = memoryStorage({ [TRUSTED_OPERATOR_KEY]: 'true' });
    expect(toggleTrustedOperator(store)).toBe(false);
    expect(toggleTrustedOperator(store)).toBe(true);
  });
});

describe('trustedOperatorBadge', () => {
  it('returns on keys when enabled', () => {
    expect(trustedOperatorBadge(true)).toEqual({
      enabled: true,
      labelKey: 'trust.operator.on',
      riskNoteKey: 'trust.operator.risk.low_auto',
    });
  });

  it('returns off keys when disabled', () => {
    expect(trustedOperatorBadge(false)).toEqual({
      enabled: false,
      labelKey: 'trust.operator.off',
      riskNoteKey: 'trust.operator.risk.manual',
    });
  });
});

describe('canAutoApproveRisk', () => {
  it('never auto-approves when disabled', () => {
    expect(canAutoApproveRisk(false, 'low')).toBe(false);
    expect(canAutoApproveRisk(false, null)).toBe(false);
    expect(canAutoApproveRisk(false, undefined)).toBe(false);
    expect(canAutoApproveRisk(false, '')).toBe(false);
  });

  it('allows low or empty risk when enabled', () => {
    expect(canAutoApproveRisk(true, 'low')).toBe(true);
    expect(canAutoApproveRisk(true, 'LOW')).toBe(true);
    expect(canAutoApproveRisk(true, ' low ')).toBe(true);
    expect(canAutoApproveRisk(true, null)).toBe(true);
    expect(canAutoApproveRisk(true, undefined)).toBe(true);
    expect(canAutoApproveRisk(true, '')).toBe(true);
    expect(canAutoApproveRisk(true, 'none')).toBe(true);
  });

  it('never auto-approves medium/high/critical', () => {
    expect(canAutoApproveRisk(true, 'medium')).toBe(false);
    expect(canAutoApproveRisk(true, 'high')).toBe(false);
    expect(canAutoApproveRisk(true, 'critical')).toBe(false);
    expect(canAutoApproveRisk(true, 'MEDIUM')).toBe(false);
    expect(canAutoApproveRisk(true, 'High')).toBe(false);
  });
});
