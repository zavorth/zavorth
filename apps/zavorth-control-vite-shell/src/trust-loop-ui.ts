/**
 * Trust Loop panel HTML for the Control Vite shell.
 * Presentation only — pure classification/format lives in trust-loop-model.
 */

import { translate } from './locale';
import { escapeHtml } from './html-utils';
import {
  formatProofLine,
  formatRiskBudgetLine,
  type ControlProofEvent,
  type ControlReadinessBadge,
  type ControlRiskBudgetView,
  type TrustLoopPanelModel,
} from './trust-loop-model';

function toneClass(tone: ControlReadinessBadge['tone'] | string | undefined): string {
  switch (tone) {
    case 'ready':
      return 'ok';
    case 'warning':
      return 'warn';
    case 'danger':
      return 'danger';
    default:
      return 'muted';
  }
}

function readinessBadgeHtml(badge: ControlReadinessBadge): string {
  const tone = toneClass(badge.tone);
  const label = escapeHtml(translate(badge.label));
  const title = escapeHtml(badge.detail || badge.label);
  return `<span class="badge badge--${tone}" data-readiness-badge data-readiness-state="${escapeHtml(badge.state)}" title="${title}"><span class="badge__dot"></span>${label}</span>`;
}

function proofListHtml(proofs: ControlProofEvent[]): string {
  if (!proofs.length) {
    return `<p class="daily-muted" data-trust-loop-empty>${escapeHtml(translate('No proof events yet.'))}</p>`;
  }
  return `
    <ul class="trust-loop-list" data-trust-loop-list>
      ${proofs.map((event) => {
        const line = escapeHtml(formatProofLine(event));
        const status = escapeHtml(String(event.status || 'info'));
        return `<li class="trust-loop-list__item" data-proof-id="${escapeHtml(event.id)}" data-proof-status="${status}"><span class="mono">${line}</span></li>`;
      }).join('')}
    </ul>
  `;
}

function riskBudgetChipHtml(view: ControlRiskBudgetView | null | undefined): string {
  const line = formatRiskBudgetLine(view || null);
  const frozen = view?.frozen ? 'is-frozen' : '';
  const tone = view?.frozen ? 'danger' : view ? 'info' : 'muted';
  return `<span class="badge badge--${tone} trust-loop-risk-chip ${frozen}" data-risk-budget-chip title="${escapeHtml(line)}"><span class="badge__dot"></span>${escapeHtml(line)}</span>`;
}

/**
 * Full Trust Loop panel section for the Proof / receipts sector.
 */
export function renderTrustLoopPanelHtml(model: TrustLoopPanelModel): string {
  const proofs = Array.isArray(model?.proofs) ? model.proofs : [];
  const readiness = Array.isArray(model?.readinessItems) ? model.readinessItems : [];
  const riskLine = formatRiskBudgetLine(model?.riskBudget || null);

  return `
    <section class="daily-panel trust-loop-panel" data-trust-loop-panel aria-label="${escapeHtml(translate('Trust Loop'))}">
      <div class="daily-panel__head">
        <div>
          <span>${escapeHtml(translate('Trust Loop'))}</span>
          <h2>${escapeHtml(translate('Receipts, budget, honesty'))}</h2>
        </div>
        <div class="trust-loop-panel__chips">
          ${riskBudgetChipHtml(model?.riskBudget)}
        </div>
      </div>
      <p class="daily-muted trust-loop-panel__risk-line" data-risk-budget-line>${escapeHtml(riskLine)}</p>
      ${readiness.length
        ? `<div class="trust-loop-panel__readiness" data-trust-loop-readiness aria-label="${escapeHtml(translate('Readiness'))}">
            ${readiness.map(readinessBadgeHtml).join('')}
            <small class="daily-muted">${escapeHtml(translate('Catalog is not live proof.'))}</small>
          </div>`
        : `<p class="daily-muted">${escapeHtml(translate('Catalog is not live proof.'))}</p>`
      }
      <div class="trust-loop-panel__list-wrap">
        <div class="daily-panel__head trust-loop-panel__list-head">
          <div><span>${escapeHtml(translate('Recent proof'))}</span></div>
        </div>
        ${proofListHtml(proofs)}
      </div>
    </section>
  `;
}

/**
 * Compact chrome strip: risk-budget chip + readiness badges (near next-action).
 */
export function renderTrustLoopChromeHtml(model: Pick<TrustLoopPanelModel, 'riskBudget' | 'readinessItems'>): string {
  const readiness = Array.isArray(model?.readinessItems) ? model.readinessItems : [];
  return `
    <div class="trust-loop-chrome" data-trust-loop-chrome>
      ${riskBudgetChipHtml(model?.riskBudget)}
      ${readiness.slice(0, 3).map(readinessBadgeHtml).join('')}
    </div>
  `;
}

/** Mount or replace full panel hosts (`[data-trust-loop-host]`). */
export function mountTrustLoopPanel(model: TrustLoopPanelModel, root: ParentNode = document): void {
  const hosts = root.querySelectorAll<HTMLElement>('[data-trust-loop-host]');
  if (!hosts.length) return;
  const html = renderTrustLoopPanelHtml(model);
  hosts.forEach((host) => {
    host.innerHTML = html;
    host.hidden = false;
  });
}

/** Mount compact chrome near next-action (`[data-trust-loop-chrome-host]`). */
export function mountTrustLoopChrome(
  model: Pick<TrustLoopPanelModel, 'riskBudget' | 'readinessItems'>,
  root: ParentNode = document,
): void {
  const hosts = root.querySelectorAll<HTMLElement>('[data-trust-loop-chrome-host]');
  if (!hosts.length) return;
  const html = renderTrustLoopChromeHtml(model);
  hosts.forEach((host) => {
    host.innerHTML = html;
    host.hidden = false;
  });
}

/** Convenience: refresh panel + chrome from one model. */
export function refreshTrustLoopUi(model: TrustLoopPanelModel, root: ParentNode = document): void {
  mountTrustLoopPanel(model, root);
  mountTrustLoopChrome(model, root);
}
