/**
 * C2 — Next best action (action-first, no essays).
 * Picks one primary CTA from live signals.
 */

export type NextActionKind =
  | 'review'
  | 'errors'
  | 'running'
  | 'doctor'
  | 'auth'
  | 'chat'
  | 'clear';

export type NextActionModel = {
  kind: NextActionKind;
  title: string;
  detail: string;
  cta: string;
  sector?: string;
  doctor?: boolean;
  prompt?: string;
  tone: 'ok' | 'info' | 'warn' | 'danger';
};

export type NextActionInput = {
  pendingApprovals?: number;
  activeApprovals?: number;
  errorEvents?: number;
  thinking?: boolean;
  runActive?: boolean;
  runTitle?: string;
  authRequired?: boolean;
  live?: boolean;
  providerReady?: boolean | null;
};

export function computeNextAction(input: NextActionInput = {}): NextActionModel {
  const pending = Math.max(0, Number(input.pendingApprovals || input.activeApprovals || 0));
  const errors = Math.max(0, Number(input.errorEvents || 0));

  if (input.authRequired) {
    return {
      kind: 'auth',
      title: 'Unlock runtime',
      detail: 'Auth required before live work.',
      cta: 'Doctor',
      doctor: true,
      tone: 'warn',
    };
  }

  if (pending > 0) {
    return {
      kind: 'review',
      title: `${pending} approval${pending === 1 ? '' : 's'} waiting`,
      detail: 'Decide before risky work continues.',
      cta: 'Review',
      sector: 'sales-os',
      tone: 'warn',
    };
  }

  if (errors > 0) {
    return {
      kind: 'errors',
      title: `${errors} error${errors === 1 ? '' : 's'} in trail`,
      detail: 'Check proof / receipts.',
      cta: 'Proof',
      sector: 'instances',
      tone: 'danger',
    };
  }

  if (input.thinking || input.runActive) {
    return {
      kind: 'running',
      title: input.runTitle?.trim() || 'Task running',
      detail: input.thinking ? 'Working…' : 'Active run',
      cta: 'Open chat',
      sector: 'terminal',
      tone: 'info',
    };
  }

  if (input.live === false || input.providerReady === false) {
    return {
      kind: 'doctor',
      title: 'Runtime needs a check',
      detail: input.providerReady === false ? 'Provider not ready.' : 'Not live yet.',
      cta: 'Doctor',
      doctor: true,
      tone: 'warn',
    };
  }

  return {
    kind: 'chat',
    title: 'Ready for a request',
    detail: 'Start in Inbox.',
    cta: 'New chat',
    sector: 'terminal',
    tone: 'ok',
  };
}

export function renderNextActionBar(model: NextActionModel): void {
  const roots = document.querySelectorAll<HTMLElement>('[data-next-action]');
  if (!roots.length) return;

  const sectorAttr = model.sector ? `data-dashboard-sector="${model.sector}"` : '';
  const doctorAttr = model.doctor ? 'data-dashboard-doctor' : '';
  const promptAttr = model.prompt ? `data-prompt="${escapeAttr(model.prompt)}"` : '';

  const html = `
    <div class="next-action next-action--${model.tone}" data-next-action-kind="${model.kind}">
      <div class="next-action__copy">
        <span class="next-action__eyebrow">Next</span>
        <strong class="next-action__title">${escapeHtml(model.title)}</strong>
        <small class="next-action__detail">${escapeHtml(model.detail)}</small>
      </div>
      <button
        type="button"
        class="next-action__cta daily-button daily-button--primary"
        ${sectorAttr}
        ${doctorAttr}
        ${promptAttr}
      >${escapeHtml(model.cta)}</button>
    </div>
  `;

  roots.forEach((root) => {
    root.innerHTML = html;
    root.dataset.nextKind = model.kind;
    root.dataset.nextTone = model.tone;
    root.hidden = false;
  });

  // Compact badge for dock / bridge
  document.querySelectorAll<HTMLElement>('[data-attention-count]').forEach((node) => {
    const n =
      model.kind === 'review' || model.kind === 'errors' || model.kind === 'doctor' || model.kind === 'auth'
        ? 1
        : 0;
    // Prefer real pending when review
    const pending = model.kind === 'review' ? parseInt(String(model.title), 10) || 1 : n;
    const show = model.kind === 'review' || model.kind === 'errors' || model.kind === 'doctor' || model.kind === 'auth';
    node.hidden = !show;
    node.textContent = model.kind === 'review' ? String(pending) : show ? '!' : '';
    node.dataset.tone = model.tone;
  });
}

function escapeHtml(value: string): string {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(value: string): string {
  return escapeHtml(value).replace(/'/g, '&#39;');
}
