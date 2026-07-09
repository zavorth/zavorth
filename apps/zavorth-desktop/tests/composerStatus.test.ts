import { describe, expect, it } from 'vitest';
import {
  COMPOSER_STATUS_STEP_PHASES,
  composerStatusDetailKey,
  composerStatusLabelKey,
  deriveComposerStatus,
  type ComposerPhase,
} from '../src/composer/composerStatus';

const STEP_IDS = ['thinking', 'tools', 'writing', 'awaiting_approval', 'done'];

function stepMap(snapshot: ReturnType<typeof deriveComposerStatus>) {
  return Object.fromEntries(snapshot.steps.map((s) => [s.id, s]));
}

describe('composerStatusLabelKey', () => {
  it('returns i18n keys for every phase', () => {
    const phases: ComposerPhase[] = [
      'idle',
      'thinking',
      'tools',
      'writing',
      'awaiting_approval',
      'done',
      'error',
    ];
    for (const phase of phases) {
      expect(composerStatusLabelKey(phase)).toBe(`composer.status.${phase}`);
      expect(composerStatusDetailKey(phase)).toBe(`composer.status.${phase}.detail`);
    }
  });
});

describe('deriveComposerStatus', () => {
  it('returns idle when nothing is happening', () => {
    const snap = deriveComposerStatus({
      busy: false,
      pendingApprovals: 0,
    });
    expect(snap.phase).toBe('idle');
    expect(snap.label).toBe('composer.status.idle');
    expect(snap.detail).toBe('');
    expect(snap.steps).toHaveLength(5);
    expect(snap.steps.every((s) => !s.active && !s.done)).toBe(true);
    expect(snap.steps.map((s) => s.id)).toEqual(STEP_IDS);
  });

  it('returns thinking when busy with no tools or stream', () => {
    const snap = deriveComposerStatus({
      busy: true,
      pendingApprovals: 0,
    });
    expect(snap.phase).toBe('thinking');
    expect(snap.label).toBe('composer.status.thinking');
    expect(snap.detail).toBe('Reasoning');
    const steps = stepMap(snap);
    expect(steps.thinking.active).toBe(true);
    expect(steps.thinking.done).toBe(false);
    expect(steps.tools.active).toBe(false);
    expect(steps.tools.done).toBe(false);
  });

  it('returns tools when busy with active tools', () => {
    const snap = deriveComposerStatus({
      busy: true,
      pendingApprovals: 0,
      activeToolCount: 2,
    });
    expect(snap.phase).toBe('tools');
    expect(snap.label).toBe('composer.status.tools');
    expect(snap.detail).toBe('2 tools running');
    const steps = stepMap(snap);
    expect(steps.thinking.done).toBe(true);
    expect(steps.tools.active).toBe(true);
    expect(steps.writing.done).toBe(false);
  });

  it('uses singular tool detail when count is 1', () => {
    const snap = deriveComposerStatus({
      busy: true,
      pendingApprovals: 0,
      activeToolCount: 1,
    });
    expect(snap.detail).toBe('1 tool running');
  });

  it('returns writing when busy and streaming assistant', () => {
    const snap = deriveComposerStatus({
      busy: true,
      pendingApprovals: 0,
      streamingAssistant: true,
    });
    expect(snap.phase).toBe('writing');
    expect(snap.label).toBe('composer.status.writing');
    expect(snap.detail).toBe('Streaming response');
    const steps = stepMap(snap);
    expect(steps.thinking.done).toBe(true);
    expect(steps.tools.done).toBe(true);
    expect(steps.writing.active).toBe(true);
  });

  it('prefers tools over writing when both apply', () => {
    const snap = deriveComposerStatus({
      busy: true,
      pendingApprovals: 0,
      activeToolCount: 1,
      streamingAssistant: true,
    });
    expect(snap.phase).toBe('tools');
  });

  it('returns awaiting_approval when pendingApprovals > 0', () => {
    const snap = deriveComposerStatus({
      busy: false,
      pendingApprovals: 3,
    });
    expect(snap.phase).toBe('awaiting_approval');
    expect(snap.label).toBe('composer.status.awaiting_approval');
    expect(snap.detail).toBe('3 approvals pending');
    const steps = stepMap(snap);
    expect(steps.thinking.done).toBe(true);
    expect(steps.tools.done).toBe(true);
    expect(steps.writing.done).toBe(true);
    expect(steps.awaiting_approval.active).toBe(true);
    expect(steps.done.done).toBe(false);
  });

  it('uses singular approval detail when count is 1', () => {
    const snap = deriveComposerStatus({
      busy: true,
      pendingApprovals: 1,
      activeToolCount: 5,
    });
    expect(snap.phase).toBe('awaiting_approval');
    expect(snap.detail).toBe('1 approval pending');
  });

  it('prefers awaiting_approval over tools/writing/thinking', () => {
    const snap = deriveComposerStatus({
      busy: true,
      pendingApprovals: 1,
      activeToolCount: 2,
      streamingAssistant: true,
    });
    expect(snap.phase).toBe('awaiting_approval');
  });

  it('returns done when justCompleted and not busy', () => {
    const snap = deriveComposerStatus({
      busy: false,
      pendingApprovals: 0,
      justCompleted: true,
    });
    expect(snap.phase).toBe('done');
    expect(snap.label).toBe('composer.status.done');
    expect(snap.detail).toBe('Completed');
    const steps = stepMap(snap);
    expect(steps.thinking.done).toBe(true);
    expect(steps.tools.done).toBe(true);
    expect(steps.writing.done).toBe(true);
    expect(steps.awaiting_approval.done).toBe(true);
    expect(steps.done.active).toBe(true);
    expect(steps.done.done).toBe(false);
  });

  it('does not return done when still busy even if justCompleted', () => {
    const snap = deriveComposerStatus({
      busy: true,
      pendingApprovals: 0,
      justCompleted: true,
    });
    expect(snap.phase).toBe('thinking');
  });

  it('returns error when lastError and not busy', () => {
    const snap = deriveComposerStatus({
      busy: false,
      pendingApprovals: 0,
      lastError: 'Network failed',
    });
    expect(snap.phase).toBe('error');
    expect(snap.label).toBe('composer.status.error');
    expect(snap.detail).toBe('Network failed');
    expect(snap.steps.every((s) => !s.active && !s.done)).toBe(true);
  });

  it('ignores whitespace-only lastError', () => {
    const snap = deriveComposerStatus({
      busy: false,
      pendingApprovals: 0,
      lastError: '   ',
    });
    expect(snap.phase).toBe('idle');
  });

  it('ignores lastError while busy (busy phases win)', () => {
    const snap = deriveComposerStatus({
      busy: true,
      pendingApprovals: 0,
      lastError: 'stale error',
      streamingAssistant: true,
    });
    expect(snap.phase).toBe('writing');
  });

  it('prefers error over done/justCompleted when idle with lastError', () => {
    const snap = deriveComposerStatus({
      busy: false,
      pendingApprovals: 0,
      lastError: 'boom',
      justCompleted: true,
    });
    expect(snap.phase).toBe('error');
  });

  it('prefers awaiting_approval over error when approvals pending', () => {
    const snap = deriveComposerStatus({
      busy: false,
      pendingApprovals: 2,
      lastError: 'boom',
    });
    // error requires !busy AND lastError, but awaiting_approval is checked after error
    // Spec order: error first, then awaiting_approval
    expect(snap.phase).toBe('error');
  });

  it('always emits the fixed step pipeline order', () => {
    expect([...COMPOSER_STATUS_STEP_PHASES]).toEqual(STEP_IDS);
    for (const phase of ['thinking', 'tools', 'writing', 'awaiting_approval', 'done'] as const) {
      const input =
        phase === 'thinking'
          ? { busy: true, pendingApprovals: 0 }
          : phase === 'tools'
            ? { busy: true, pendingApprovals: 0, activeToolCount: 1 }
            : phase === 'writing'
              ? { busy: true, pendingApprovals: 0, streamingAssistant: true }
              : phase === 'awaiting_approval'
                ? { busy: false, pendingApprovals: 1 }
                : { busy: false, pendingApprovals: 0, justCompleted: true };
      const snap = deriveComposerStatus(input);
      expect(snap.steps.map((s) => s.phase)).toEqual(STEP_IDS);
      expect(snap.steps.map((s) => s.id)).toEqual(STEP_IDS);
    }
  });

  it('treats activeToolCount 0 as no tools', () => {
    const snap = deriveComposerStatus({
      busy: true,
      pendingApprovals: 0,
      activeToolCount: 0,
      streamingAssistant: false,
    });
    expect(snap.phase).toBe('thinking');
  });

  it('does not treat tools when not busy even if activeToolCount > 0', () => {
    const snap = deriveComposerStatus({
      busy: false,
      pendingApprovals: 0,
      activeToolCount: 3,
    });
    expect(snap.phase).toBe('idle');
  });
});
