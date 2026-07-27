/**
 * Pure composer/agent-run status derivation (no React).
 * Labels are i18n keys; UI resolves them via the desktop i18n layer.
 */

export type ComposerState =
  | 'idle'
  | 'thinking'
  | 'tools'
  | 'writing'
  | 'awaiting_approval'
  | 'done'
  | 'error';

export type ComposerStatusStep = {
  id: string;
  state: ComposerState;
  active: boolean;
  done: boolean;
};

export type ComposerStatusSnapshot = {
  state: ComposerState;
  label: string;
  detail: string;
  steps: ComposerStatusStep[];
};

/** Fixed pipeline order for the status stack (error/idle are out-of-band). */
export const COMPOSER_STATUS_STEP_STATES: ReadonlyArray<
  Exclude<ComposerState, 'idle' | 'error'>
> = ['thinking', 'tools', 'writing', 'awaiting_approval', 'done'];

export function composerStatusLabelKey(state: ComposerState): string {
  return `composer.status.${state}`;
}

export function composerStatusDetailKey(state: ComposerState): string {
  return `composer.status.${state}.detail`;
}

function buildSteps(state: ComposerState): ComposerStatusStep[] {
  const order = COMPOSER_STATUS_STEP_STATES;
  const idx = order.indexOf(state as (typeof order)[number]);

  if (idx < 0) {
    // idle / error: no pipeline progress
    return order.map((p) => ({
      id: p,
      state: p,
      active: false,
      done: false,
    }));
  }

  return order.map((p, i) => ({
    id: p,
    state: p,
    active: i === idx,
    done: i < idx,
  }));
}

function resolveState(input: {
  busy: boolean;
  pendingApprovals: number;
  activeToolCount?: number;
  streamingAssistant?: boolean;
  lastError?: string | null;
  justCompleted?: boolean;
}): ComposerState {
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
  state: ComposerState,
  input: {
    pendingApprovals: number;
    activeToolCount?: number;
    lastError?: string | null;
  },
): string {
  switch (state) {
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
  const state = resolveState(input);
  return {
    state,
    label: composerStatusLabelKey(state),
    detail: resolveDetail(state, input),
    steps: buildSteps(state),
  };
}
