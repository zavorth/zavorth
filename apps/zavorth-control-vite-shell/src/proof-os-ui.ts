/**
 * Proof OS panel HTML for the Control Vite shell.
 * Presentation only — pure classification/format lives in proof-os-model.
 */

import { translate } from './locale';
import { escapeHtml } from './html-utils';
import {
  formatProofLine,
  formatRiskBudgetLine,
  type ControlProofEvent,
  type ControlReadinessBadge,
  type ControlRiskBudgetView,
  type ProofOsPanelModel,
} from './proof-os-model';

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
    return `<p class="daily-muted" data-proof-os-empty>${escapeHtml(translate('No proof events yet.'))}</p>`;
  }
  return `
    <ul class="proof-os-list" data-proof-os-list>
      ${proofs.map((event) => {
        const line = escapeHtml(formatProofLine(event));
        const status = escapeHtml(String(event.status || 'info'));
        return `<li class="proof-os-list__item" data-proof-id="${escapeHtml(event.id)}" data-proof-status="${status}"><span class="mono">${line}</span></li>`;
      }).join('')}
    </ul>
  `;
}

function riskBudgetChipHtml(view: ControlRiskBudgetView | null | undefined): string {
  const line = formatRiskBudgetLine(view || null);
  const frozen = view?.frozen ? 'is-frozen' : '';
  const tone = view?.frozen ? 'danger' : view ? 'info' : 'muted';
  return `<span class="badge badge--${tone} proof-os-risk-chip ${frozen}" data-risk-budget-chip title="${escapeHtml(line)}"><span class="badge__dot"></span>${escapeHtml(line)}</span>`;
}

/**
 * Full Proof OS panel section for the Proof / receipts sector.
 */
export function renderProofOsPanelHtml(model: ProofOsPanelModel): string {
  const proofs = Array.isArray(model?.proofs) ? model.proofs : [];
  const readiness = Array.isArray(model?.readinessItems) ? model.readinessItems : [];
  const riskLine = formatRiskBudgetLine(model?.riskBudget || null);

  return `
    <section class="daily-panel proof-os-panel" data-proof-os-panel aria-label="${escapeHtml(translate('Proof OS'))}">
      <div class="daily-panel__head">
        <div>
          <span>${escapeHtml(translate('Proof OS'))}</span>
          <h2>${escapeHtml(translate('Receipts, budget, honesty'))}</h2>
        </div>
        <div class="proof-os-panel__chips">
          ${riskBudgetChipHtml(model?.riskBudget)}
        </div>
      </div>
      <p class="daily-muted proof-os-panel__risk-line" data-risk-budget-line>${escapeHtml(riskLine)}</p>
      ${readiness.length
        ? `<div class="proof-os-panel__readiness" data-proof-os-readiness aria-label="${escapeHtml(translate('Readiness'))}">
            ${readiness.map(readinessBadgeHtml).join('')}
            <small class="daily-muted">${escapeHtml(translate('Catalog is not live proof.'))}</small>
          </div>`
        : `<p class="daily-muted">${escapeHtml(translate('Catalog is not live proof.'))}</p>`
      }
      <div class="proof-os-panel__list-wrap">
        <div class="daily-panel__head proof-os-panel__list-head">
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
export function renderProofOsChromeHtml(model: Pick<ProofOsPanelModel, 'riskBudget' | 'readinessItems'>): string {
  const readiness = Array.isArray(model?.readinessItems) ? model.readinessItems : [];
  return `
    <div class="proof-os-chrome" data-proof-os-chrome>
      ${riskBudgetChipHtml(model?.riskBudget)}
      ${readiness.slice(0, 3).map(readinessBadgeHtml).join('')}
    </div>
  `;
}

/** Mount or replace full panel hosts (`[data-proof-os-host]`). */
export function mountProofOsPanel(model: ProofOsPanelModel, root: ParentNode = document): void {
  const hosts = root.querySelectorAll<HTMLElement>('[data-proof-os-host]');
  if (!hosts.length) return;
  const html = renderProofOsPanelHtml(model);
  hosts.forEach((host) => {
    host.innerHTML = html;
    host.hidden = false;
  });
}

/** Mount compact chrome near next-action (`[data-proof-os-chrome-host]`). */
export function mountProofOsChrome(
  model: Pick<ProofOsPanelModel, 'riskBudget' | 'readinessItems'>,
  root: ParentNode = document,
): void {
  const hosts = root.querySelectorAll<HTMLElement>('[data-proof-os-chrome-host]');
  if (!hosts.length) return;
  const html = renderProofOsChromeHtml(model);
  hosts.forEach((host) => {
    host.innerHTML = html;
    host.hidden = false;
  });
}

/** Convenience: refresh panel + chrome from one model. */
export function refreshProofOsUi(model: ProofOsPanelModel, root: ParentNode = document): void {
  mountProofOsPanel(model, root);
  mountProofOsChrome(model, root);
}
