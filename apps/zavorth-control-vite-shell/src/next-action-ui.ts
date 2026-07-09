/**
 * Primary next-action CTA from live signals.
 */

import { translate, translateCount } from './locale';

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
      title: translate('Unlock runtime'),
      detail: translate('Auth required before live work.'),
      cta: translate('Doctor'),
      doctor: true,
      tone: 'warn',
    };
  }

  if (pending > 0) {
    return {
      kind: 'review',
      title: translateCount('1 approval waiting', '{n} approvals waiting', pending),
      detail: translate('Decide before risky work continues.'),
      cta: translate('Review'),
      sector: 'sales-os',
      tone: 'warn',
    };
  }

  if (errors > 0) {
    return {
      kind: 'errors',
      title: translateCount('1 error in trail', '{n} errors in trail', errors),
      detail: translate('Check proof / receipts.'),
      cta: translate('Proof'),
      sector: 'instances',
      tone: 'danger',
    };
  }

  if (input.thinking || input.runActive) {
    return {
      kind: 'running',
      title: input.runTitle?.trim() || translate('Task running'),
      detail: input.thinking ? translate('Working…') : translate('Active run'),
      cta: translate('Open chat'),
      sector: 'terminal',
      tone: 'info',
    };
  }

  if (input.live === false || input.providerReady === false) {
    return {
      kind: 'doctor',
      title: translate('Runtime needs a check'),
      detail: input.providerReady === false
        ? translate('Provider not ready.')
        : translate('Not live yet.'),
      cta: translate('Doctor'),
      doctor: true,
      tone: 'warn',
    };
  }

  return {
    kind: 'chat',
    title: translate('Ready for a request'),
    detail: translate('Start in Inbox.'),
    cta: translate('New chat'),
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
        <span class="next-action__eyebrow">${escapeHtml(translate('Next'))}</span>
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

  document.querySelectorAll<HTMLElement>('[data-attention-count]').forEach((node) => {
    const pending = model.kind === 'review' ? parseInt(String(model.title), 10) || 1 : 0;
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
