import { escapeHtml, renderMarkdown } from './html-utils';

export function buildEchoQuickActions(role: string) {
  if (role !== 'core') return '';
  return `
    <div class="echo-action-row" aria-label="Response actions">
      <button type="button" data-prompt="Show the trace for the latest response in simple language.">Trace</button>
      <button type="button" data-prompt="Show pending approvals with approve and reject actions.">Approvals</button>
      <button type="button" data-prompt="Show the latest receipt or explain why none exists yet.">Receipt</button>
    </div>
  `;
}

export function buildConversationStateCard(kind: unknown, title: unknown, summary: unknown, items: unknown[] = [], options: any = {}) {
  const normalizedKind = String(kind || 'info').replace(/[^\w-]/g, '') || 'info';
  const safeTitle = escapeHtml(title || 'Zavorth update');
  const safeSummary = escapeHtml(summary || '');
  const safeBadge = escapeHtml(options.badge || normalizedKind);
  const safeMeta = escapeHtml(options.meta || '');
  const safeItems = Array.isArray(items) ? items.filter(Boolean).slice(0, 5) : [];
  return `
    <article class="conversation-state-card conversation-state-card--${normalizedKind}" aria-label="${safeTitle}">
      <div class="conversation-state-card__rail">
        <span class="conversation-state-card__pulse"></span>
      </div>
      <div class="conversation-state-card__body">
        <div class="conversation-state-card__topline">
          <span>${safeBadge}</span>
          ${safeMeta ? `<small>${safeMeta}</small>` : ''}
        </div>
        <strong>${safeTitle}</strong>
        ${safeSummary ? `<p>${safeSummary}</p>` : ''}
        ${safeItems.length ? `
          <ol class="conversation-state-card__steps">
            ${safeItems.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
          </ol>
        ` : ''}
      </div>
    </article>
  `;
}

export function buildEchoGroupHtml({ role, text, logicCells, timestamp, modelLabel, routeLabel }: {
  role: string;
  text: unknown;
  logicCells?: string;
  timestamp: string;
  modelLabel: string;
  routeLabel: string;
}) {
  const avatarClass = role === 'operator' ? 'operator' : 'core';
  const avatarLabel = role === 'operator' ? 'You' : 'Z';
  const actionRow = buildEchoQuickActions(role);

  return `
    <div class="echo-avatar ${avatarClass}">${avatarLabel}</div>
    <div class="echo-group__messages">
      <div class="echo-group__header">
        <span class="echo-sender">${role === 'operator' ? 'You' : 'Zavorth'}</span>
        <span class="echo-timestamp">${escapeHtml(timestamp)}</span>
        ${role === 'core' ? `<span class="echo-meta"><span class="echo-meta__model">${escapeHtml(modelLabel)}</span><span class="echo-meta__cost">${escapeHtml(routeLabel)}</span></span>` : ''}
      </div>
      <div class="echo-bubble b-fade-in">
        ${renderMarkdown(text)}
      </div>
      ${logicCells ? logicCells : ''}
      ${actionRow}
    </div>
  `;
}

export function buildEchoDividerHtml(label: unknown) {
  const safeLabel = escapeHtml(label || 'Session');
  return `
    <span class="echo-divider__line"></span>
    <span class="echo-divider__label">${safeLabel}</span>
    <span class="echo-divider__line"></span>
  `;
}

export function buildThinkingStateHtml({ timestamp, modelLabel, stateCardHtml }: {
  timestamp: string;
  modelLabel: string;
  stateCardHtml: string;
}) {
  return `
    <div class="echo-avatar core">Z</div>
    <div class="echo-group__messages">
      <div class="echo-group__header">
        <span class="echo-sender">Zavorth</span>
        <span class="echo-timestamp">${escapeHtml(timestamp)}</span>
        <span class="echo-meta"><span class="echo-meta__model">${escapeHtml(modelLabel)}</span><span class="echo-meta__cost">working</span></span>
      </div>
      <div class="thinking-indicator">
        <div class="thinking-indicator__dots">
          <span></span><span></span><span></span>
        </div>
        <div class="thinking-indicator__copy">
          <strong>Planning the next safe step</strong>
          <small>Preview, approval and receipt stay visible here.</small>
        </div>
      </div>
      ${stateCardHtml}
    </div>
  `;
}

