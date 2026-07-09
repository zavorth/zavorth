/**
 * Pure composer/agent-run status derivation (no React).
 * Labels are i18n keys; UI resolves them via the desktop i18n layer.
 */

export type ComposerPhase =
  | 'idle'
  | 'thinking'
  | 'tools'
  | 'writing'
  | 'awaiting_approval'
  | 'done'
  | 'error';

export type ComposerStatusStep = {
  id: string;
  phase: ComposerPhase;
  active: boolean;
  done: boolean;
};

export type ComposerStatusSnapshot = {
  phase: ComposerPhase;
  label: string;
  detail: string;
  steps: ComposerStatusStep[];
};

/** Fixed pipeline order for the status stack (error/idle are out-of-band). */
export const COMPOSER_STATUS_STEP_PHASES: ReadonlyArray<
  Exclude<ComposerPhase, 'idle' | 'error'>
> = ['thinking', 'tools', 'writing', 'awaiting_approval', 'done'];

export function composerStatusLabelKey(phase: ComposerPhase): string {
  return `composer.status.${phase}`;
}

export function composerStatusDetailKey(phase: ComposerPhase): string {
  return `composer.status.${phase}.detail`;
}

function buildSteps(phase: ComposerPhase): ComposerStatusStep[] {
  const order = COMPOSER_STATUS_STEP_PHASES;
  const idx = order.indexOf(phase as (typeof order)[number]);

  if (idx < 0) {
    // idle / error: no pipeline progress
    return order.map((p) => ({
      id: p,
      phase: p,
      active: false,
      done: false,
    }));
  }

  return order.map((p, i) => ({
    id: p,
    phase: p,
    active: i === idx,
    done: i < idx,
  }));
}

function resolvePhase(input: {
  busy: boolean;
  pendingApprovals: number;
  activeToolCount?: number;
  streamingAssistant?: boolean;
  lastError?: string | null;
  justCompleted?: boolean;
}): ComposerPhase {
  const {
    busy,
    pendingApprovals,
    activeToolCount = 0,
    streamingAssistant = false,
    lastError,
    justCompleted = false,
  } = input;

  const hasError = Boolean(lastError && String(lastError).trim());

  if (hasError && !busy) return 'error';
  if (pendingApprovals > 0) return 'awaiting_approval';
  if (busy && activeToolCount > 0) return 'tools';
  if (busy && streamingAssistant) return 'writing';
  if (busy) return 'thinking';
  if (justCompleted && !busy) return 'done';
  return 'idle';
}

function resolveDetail(
  phase: ComposerPhase,
  input: {
    pendingApprovals: number;
    activeToolCount?: number;
    lastError?: string | null;
  },
): string {
  switch (phase) {
    case 'error':
      return String(input.lastError || '').trim();
    case 'awaiting_approval': {
      const n = input.pendingApprovals;
      return n === 1 ? '1 approval pending' : `${n} approvals pending`;
    }
    case 'tools': {
      const n = input.activeToolCount ?? 0;
      return n === 1 ? '1 tool running' : `${n} tools running`;
    }
    case 'writing':
      return 'Streaming response';
    case 'thinking':
      return 'Reasoning';
    case 'done':
      return 'Completed';
    case 'idle':
    default:
      return '';
  }
}

export function deriveComposerStatus(input: {
  busy: boolean;
  pendingApprovals: number;
  activeToolCount?: number;
  streamingAssistant?: boolean;
  lastError?: string | null;
  justCompleted?: boolean;
}): ComposerStatusSnapshot {
  const phase = resolvePhase(input);
  return {
    phase,
    label: composerStatusLabelKey(phase),
    detail: resolveDetail(phase, input),
    steps: buildSteps(phase),
  };
}
