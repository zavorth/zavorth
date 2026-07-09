import { describe, expect, it } from 'vitest';
import {
  generateDesktopSessionId,
  normalizeSessionCreateInput,
  resolveCreatedSessionId,
  resolveApprovalItemId,
  isApprovalDecision,
} from '../src/session/sessionHelpers';

describe('session helpers', () => {
  it('generates deterministic desktop session ids with injected clocks', () => {
    const id = generateDesktopSessionId(() => 1_700_000_000_000, () => 'abc12345');
    expect(id).toBe(`desktop-${(1_700_000_000_000).toString(36)}-abc12345`);
    expect(id.startsWith('desktop-')).toBe(true);
  });

  it('normalizes create-session input with defaults', () => {
    const created = normalizeSessionCreateInput(
      { workspaceId: 'folder:C:/proj' },
      () => 'desktop-fixed',
    );
    expect(created).toEqual({
      sessionId: 'desktop-fixed',
      label: 'New Chat',
      surface: 'folder:C:/proj',
      workspaceId: 'folder:C:/proj',
    });
  });

  it('resolves session id from nested API payloads', () => {
    expect(resolveCreatedSessionId({ sessionId: 's-1' }, 'fallback')).toBe('s-1');
    expect(resolveCreatedSessionId({ data: { sessionId: 's-2' } }, 'fallback')).toBe('s-2');
    expect(resolveCreatedSessionId({ id: 's-3' }, 'fallback')).toBe('s-3');
    expect(resolveCreatedSessionId(null, 'fallback')).toBe('fallback');
  });
});

describe('approval helpers', () => {
  it('resolves approval ids with fallbacks', () => {
    expect(resolveApprovalItemId({ id: 'a1' }, 'fb')).toBe('a1');
    expect(resolveApprovalItemId({ approvalId: 'a2' }, 'fb')).toBe('a2');
    expect(resolveApprovalItemId({}, 'fb')).toBe('fb');
    expect(resolveApprovalItemId(null, 'fb')).toBe('fb');
  });

  it('validates approval decisions', () => {
    expect(isApprovalDecision('approve')).toBe(true);
    expect(isApprovalDecision('reject')).toBe(true);
    expect(isApprovalDecision('maybe')).toBe(false);
  });
});
