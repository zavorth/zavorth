/** Session trust score from live signals. */

import { translate } from './locale';

export type SessionTrustInput = {
  pendingApprovals?: number;
  activeApprovals?: number;
  errorEvents?: number;
  receiptEvents?: number;
  gatedActions?: number;
};

export type SessionTrustResult = {
  score: number;
  label: string;
  tone: 'ok' | 'info' | 'warn' | 'danger';
};

export function computeSessionTrustScore(input: SessionTrustInput = {}): SessionTrustResult {
  const pending = Math.max(0, Number(input.pendingApprovals || input.activeApprovals || 0));
  const errors = Math.max(0, Number(input.errorEvents || 0));
  const receipts = Math.max(0, Number(input.receiptEvents || 0));
  const gated = Math.max(0, Number(input.gatedActions ?? pending));

  let score = 100;
  score -= Math.min(40, pending * 10);
  score -= Math.min(36, errors * 12);
  score -= Math.min(15, Math.max(0, gated - pending) * 5);
  if (receipts > 0 && errors === 0 && pending === 0) {
    score = Math.min(100, score + Math.min(5, receipts));
  }
  score = Math.max(0, Math.min(100, Math.round(score)));

  if (score < 40) return { score, label: translate('At risk'), tone: 'danger' };
  if (pending > 0 || score < 70) return { score, label: translate('Needs review'), tone: 'warn' };
  if (score < 90) return { score, label: translate('Stable'), tone: 'info' };
  return { score, label: translate('Governed'), tone: 'ok' };
}

export function renderSessionTrustScore(input: SessionTrustInput = {}): SessionTrustResult {
  const result = computeSessionTrustScore(input);
  const roots = document.querySelectorAll<HTMLElement>('#session-trust-score, [data-session-trust-score]');
  roots.forEach((root) => {
    root.dataset.trustTone = result.tone;
    root.dataset.trustScore = String(result.score);
    const value = root.querySelector('[data-session-trust-value]');
    const label = root.querySelector('[data-session-trust-label]');
    if (value) value.textContent = String(result.score);
    if (label) label.textContent = result.label;
    if (!value && !label) {
      root.innerHTML = `<strong data-session-trust-value>${result.score}</strong><span data-session-trust-label>${result.label}</span>`;
    }
  });
  return result;
}
