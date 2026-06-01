import { DASHBOARD_CAPABILITY_PLACEMENTS, sectorCapabilities, sectorLabel, type DashboardSectorId } from './dashboard-surface-registry';
import { escapeHtml } from './html-utils';

type PageHeroOptions = {
  eyebrow: string;
  title: string;
  subtitle: string;
  actionLabel?: string;
  actionSector?: DashboardSectorId;
  actionPrompt?: string;
};

type EmptyStateOptions = {
  title: string;
  detail: string;
  actionLabel?: string;
  actionSector?: DashboardSectorId;
  actionPrompt?: string;
};

function actionAttribute(options: Pick<PageHeroOptions, 'actionSector' | 'actionPrompt'>) {
  if (options.actionSector) return `data-dashboard-sector="${escapeHtml(options.actionSector)}"`;
  if (options.actionPrompt) return `data-dashboard-prompt="${escapeHtml(options.actionPrompt)}"`;
  return '';
}

function renderStateLabel(state: string) {
  if (state === 'live') return 'live';
  if (state === 'ready') return 'ready';
  if (state === 'gated') return 'approval';
  return 'setup';
}

export function renderPageHero(options: PageHeroOptions) {
  const action = options.actionLabel
    ? `<div class="premium-hero__actions"><button class="operator-primary-action" type="button" ${actionAttribute(options)}>${escapeHtml(options.actionLabel)}</button></div>`
    : '';
  return `
    <section class="premium-hero premium-hero--compact platform-hero--operator" aria-label="${escapeHtml(options.eyebrow)}">
      <div>
        <span class="dashboard-eyebrow"><span class="dashboard-live-dot"></span>${escapeHtml(options.eyebrow)}</span>
        <h1 class="premium-title">${escapeHtml(options.title)}</h1>
        <p class="premium-subtitle">${escapeHtml(options.subtitle)}</p>
      </div>
      ${action}
    </section>
  `;
}

export function renderEmptyState(options: EmptyStateOptions) {
  const action = options.actionLabel
    ? `<button type="button" ${actionAttribute(options)}>${escapeHtml(options.actionLabel)}</button>`
    : '';
  return `
    <div class="dashboard-empty-state">
      <strong>${escapeHtml(options.title)}</strong>
      <span>${escapeHtml(options.detail)}</span>
      ${action}
    </div>
  `;
}

export function renderCapabilityStrip(sectorId: DashboardSectorId, title = 'Available here') {
  const capabilities = sectorCapabilities(sectorId);
  if (!capabilities.length) return '';
  return `
    <section class="dashboard-surface-strip" aria-label="${escapeHtml(sectorLabel(sectorId))} capabilities">
      <div class="dashboard-surface-strip__header">
        <span>${escapeHtml(title)}</span>
        <small>${capabilities.length} connected</small>
      </div>
      <div class="dashboard-capability-list">
        ${capabilities.map((capability) => `
          <article class="dashboard-capability-item dashboard-capability-item--${escapeHtml(capability.state)}">
            <div>
              <strong>${escapeHtml(capability.label)}</strong>
              <span>${escapeHtml(capability.detail)}</span>
            </div>
            <small>${renderStateLabel(capability.state)}</small>
          </article>
        `).join('')}
      </div>
    </section>
  `;
}

export function renderSurfaceFlow() {
  return `
    <section class="dashboard-surface-flow" aria-label="Runtime flow">
      <span>Operator</span>
      <span>Dashboard</span>
      <span>Gateway</span>
      <span>Runtime</span>
      <span>Provider</span>
    </section>
  `;
}

export function renderGlobalCapabilityIndex() {
  return `
    <section class="dashboard-surface-strip dashboard-surface-strip--global" aria-label="Canonical dashboard capabilities">
      <div class="dashboard-surface-strip__header">
        <span>Canonical surface</span>
        <small>${DASHBOARD_CAPABILITY_PLACEMENTS.length} powers placed</small>
      </div>
      <div class="dashboard-capability-list">
        ${DASHBOARD_CAPABILITY_PLACEMENTS.map((capability) => `
          <article class="dashboard-capability-item dashboard-capability-item--${escapeHtml(capability.state)}">
            <div>
              <strong>${escapeHtml(capability.label)}</strong>
              <span>${escapeHtml(capability.detail)}</span>
            </div>
            <small>${escapeHtml(sectorLabel(capability.sector))}</small>
          </article>
        `).join('')}
      </div>
    </section>
  `;
}
