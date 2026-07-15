/**
 * Zavorth Control pages.
 * Static placeholders stay honest; runtime-bridge replaces them with live data.
 * runtime adapter control remains an explicit setup/advanced surface, not a chat-first nag.
 *
 * Work / Review / Proof / Channels / Sessions / Cron / Agents /
 * Skills / Config are React SSR islands (see react/DashboardReactIslands).
 */
import { initLearningDreamsUi } from './learning-dreams-ui';
import { initMemoryBrowserUi } from './memory-browser-ui';
import { initPolicySimulatorUi } from './policy-simulator-ui';
import { initRuntimeEngineUi } from './runtime-engines-ui';
import { bindModelPreferenceEvents } from './model-preference-actions';
import { bindLearningLoopStatusCard } from './learning-loop-status';
import { bindLearnedKnowledgeHub } from './learned-knowledge-hub';
import { mountDashboardReactIslands } from './react/mountDashboardReactIslands';
import { initSkillRegistryOpsUi } from './skill-registry-ops-ui';

declare global {
 interface Window {
 ZavorthControlChat?: {
 refreshDashboard?: () => void;
 };
 emitSignal?: (type: string, title: string, message?: string) => void;
 }
}

export function initControlPages() {
 // / 8.1 / 8.2: React islands for Work / Review / Proof / Channels /
 // Sessions / Cron / Agents / Skills / Config (data-* hooks preserved for live bridge).
 mountDashboardReactIslands();

 // Skill registry ops panel (sector-skills) — GET/POST /api/skill-registry
 try {
 initSkillRegistryOpsUi();
 } catch {
 /* optional surface */
 }

 // sector-overview + sector-sales-os + sector-instances + sector-channels +
 // sector-sessions + sector-cron + sector-agents + sector-skills + sector-config:
 // mounted via React islands

 populate(
 'sector-usage',
 `
 <div class="daily-page">
 ${dailyHeader('Models', '', '<button class="daily-button daily-button--primary" type="button" data-dashboard-prompt="Test the active provider route with a sanitized request.">Test route</button>')}
 <section class="daily-stat-row daily-stat-row--compact" aria-label="Model status">
 ${dailyMetric('Active route', 'Auto', '<span data-provider-picker="active">Configured</span>')}
 ${dailyMetric('Fallbacks', '<span data-provider-picker="fallbacks">Live</span>', 'Ready routes')}
 ${dailyMetric('Proof', '<span data-provider-picker="proof">Sanitized</span>', 'Redacted')}
 </section>
 <section class="daily-panel daily-panel--list daily-panel--flush">
 <div class="daily-panel__head">
 <div><span>Catalog</span><h2>Routes</h2></div>
 <button class="daily-button" type="button" data-dashboard-prompt="Show the active model route, fallback, and anything that still needs setup.">Details</button>
 </div>
 <div class="daily-provider-summary" data-provider-model-catalog-summary>
 <div class="info-row"><span class="info-row__label">Routes</span><span class="info-row__value mono">loading</span></div>
 <div class="info-row"><span class="info-row__label">Ready</span><span class="info-row__value mono">loading</span></div>
 <div class="info-row"><span class="info-row__label">Models</span><span class="info-row__value mono">loading</span></div>
 <div class="info-row"><span class="info-row__label">Media</span><span class="info-row__value mono">loading</span></div>
 </div>
 <div class="daily-card-feed" data-provider-model-catalog-list></div>
 </section>
 </div>
 `,
 );

 // sector-agents + sector-skills: mounted via React islands

 populate(
 'sector-nodes',
 `
 <div class="daily-page">
 ${dailyHeader('Memory', '', '<button class="daily-button daily-button--primary" type="button" data-prompt="Search Zavorth memory and show facts with provenance.">Search</button>')}
 <section class="daily-panel daily-panel--search">
 <input type="search" placeholder="Search memory" aria-label="Search memory" data-memory-search>
 <button class="daily-button" type="button" data-memory-search-run data-prompt="Search Zavorth memory for the typed topic and show provenance.">Search</button>
 </section>
 <section class="daily-action-row" aria-label="Memory actions">
 <button type="button" data-prompt="Search Zavorth memory and show facts with provenance.">Search</button>
 <button type="button" data-prompt="Forget a memory fact by id with receipt.">Forget</button>
 <button type="button" data-prompt="Correct a memory fact with receipt.">Correct</button>
 </section>
 <section class="daily-panel daily-panel--list daily-panel--flush" aria-label="Memory browser">
 <div class="daily-panel__head"><div><span>Mnemos</span><h2>Facts</h2></div></div>
 <ul class="memory-browser-list" data-memory-list>
 <li class="memory-browser-item" data-memory-item data-memory-search-text="facts provenance trust vault">
 <strong>Facts</strong><span>Provenance / trust</span>
 <div class="memory-browser-actions">
 <button type="button" data-prompt="Search Zavorth memory and show facts with provenance.">Search</button>
 <button type="button" data-prompt="Forget a memory fact by id with receipt.">Forget</button>
 <button type="button" data-prompt="Correct a memory fact with receipt.">Correct</button>
 </div>
 </li>
 <li class="memory-browser-item" data-memory-item data-memory-search-text="recall local search mnemos fts">
 <strong>Recall</strong><span>Local search</span>
 <div class="memory-browser-actions">
 <button type="button" data-prompt="Recall useful memory with provenance.">Search</button>
 <button type="button" data-prompt="Forget a memory fact by id with receipt.">Forget</button>
 <button type="button" data-prompt="Correct a memory fact with receipt.">Correct</button>
 </div>
 </li>
 <li class="memory-browser-item" data-memory-item data-memory-search-text="folders workspaces scope">
 <strong>Folders</strong><span>Allowed scope</span>
 <div class="memory-browser-actions">
 <button type="button" data-prompt="Show trusted folder scopes for memory.">Search</button>
 <button type="button" data-prompt="Forget a memory fact by id with receipt.">Forget</button>
 <button type="button" data-prompt="Correct a memory fact with receipt.">Correct</button>
 </div>
 </li>
 </ul>
 </section>
 <section class="daily-layout daily-layout--main">
 <article class="daily-panel daily-panel--primary">
 <div class="daily-panel__head">
 <div><span>Scopes</span><h2>Active memory</h2></div>
 </div>
 <div class="zavorth-memory-mesh-panel">
 <div id="zavorth-memory-tree" class="zavorth-memory-tree">
 <div class="zavorth-memory-scope-list" role="list" aria-label="Memory scopes">
 <button class="zavorth-mem-node is-inspected" id="mem-node-vault" type="button"><strong>Facts</strong><span>Provenance and trust</span></button>
 <button class="zavorth-mem-node" id="mem-node-recall" type="button"><strong>Recall</strong><span>Local search</span></button>
 <button class="zavorth-mem-node" id="mem-node-workspaces" type="button"><strong>Folders</strong><span>Allowed scope</span></button>
 <button class="zavorth-mem-node" id="mem-node-agents" type="button"><strong>Agents</strong><span>Consented links</span></button>
 <button class="zavorth-mem-node" id="mem-node-environments" type="button"><strong>Execution</strong><span>Safety boundary</span></button>
 </div>
 </div>
 <div id="zavorth-memory-inspection-panel" class="zavorth-memory-inspection-panel">
 <div class="zavorth-memory-inspection-header">
 <span class="zavorth-memory-inspection-dot"></span>
 <span>Inspector</span>
 </div>
 <div class="zavorth-memory-inspection-body" id="zavorth-memory-inspection-body">
 <div class="zavorth-memory-inspection-empty">
 <span>Select a scope</span>
 </div>
 </div>
 </div>
 </div>
 </article>
 <aside class="daily-stack">
 <article class="daily-panel">
 <div class="daily-panel__head"><div><span>Status</span><h2>Memory</h2></div></div>
 <div class="daily-key-value">
 ${dailyKeyValue('File memory', '<span data-memory-live-files>Configurable</span>')}
 ${dailyKeyValue('Linked agents', '<span data-memory-live-agents>0</span>')}
 ${dailyKeyValue('Execution', '<span data-memory-live-env>Approval gated</span>')}
 </div>
 </article>
 <article class="daily-panel">
 <div class="daily-panel__head"><div><span>Pairing</span><h2>Trusted device</h2></div></div>
 <button class="daily-button daily-button--wide" id="zavorth-otp-generate-btn" type="button">Generate key</button>
 <div class="zavorth-otp-display" id="zavorth-otp-key-display" style="display: none;">
 <span class="zavorth-otp-code" id="zavorth-otp-code-val">000-000</span>
 <span class="zavorth-otp-timer" id="zavorth-otp-timer-val">Expires in 60s</span>
 </div>
 <div class="zavorth-pairing-status" id="zavorth-otp-status" style="display: none;">
 <span class="zavorth-pairing-status-dot"></span>
 <span id="zavorth-otp-status-text">Ready to pair.</span>
 </div>
 </article>
 </aside>
 </section>
 </div>
 `,
 );

 populate(
 'sector-dreams',
 `
 <div class="daily-page learning-page" data-learning-dreams-root>
 ${dailyHeader('Learning candidates', '/learning = candidates · /learn = skill drafts', '<button class="daily-button daily-button--primary" type="button" data-learning-refresh>Refresh</button>')}
 <div class="learning-loading">Loading candidates…</div>
 </div>
 `,
 );

 populate(
 'sector-canvas',
 `
 <div class="daily-page z-canvas-page">
 ${dailyHeader('Canvas', 'Preview UI, diffs and sandbox output before applying changes.', '<button class="daily-button daily-button--primary" type="button" data-dashboard-prompt="Open Z-Canvas for the current request and show preview, diff, logs and risks before applying anything.">Open preview</button>')}
 <section class="daily-stat-row daily-stat-row--compact" aria-label="Canvas status">
 ${dailyMetric('Preview', 'Sandbox', 'isolated frame')}
 ${dailyMetric('Diff', 'Gated', 'approval before apply')}
 ${dailyMetric('Network', 'Blocked', 'unless allowed')}
 ${dailyMetric('Receipt', 'On', 'every apply')}
 </section>
 <section class="z-canvas-shell" data-canvas-root>
 <div class="z-canvas-loading">Open a preview from chat or a pending action.</div>
 </section>
 </div>
 `,
 );

 // sector-config: mounted via React islands

 populate(
 'sector-docs',
 `
 <div class="premium-page">
 <section class="premium-hero premium-hero--compact">
 <div>
 <span class="dashboard-eyebrow"><span class="dashboard-live-dot"></span>Docs</span>
 <h1 class="premium-title">Use the product first, docs second.</h1>
 <p class="premium-subtitle">Short references explain setup, models, approvals, memory, tools, and safe execution.</p>
 </div>
 <button class="operator-primary-action" type="button" data-dashboard-prompt="Tell me the shortest path to use Zavorth today.">Quickstart</button>
 </section>
 <section class="premium-grid">
 ${surfaceCard('Quickstart', '2 minutes', 'ok', 'Open, choose a goal, verify provider and run the first safe task.')}
 ${surfaceCard('Approvals', 'Important', 'warn', 'Understand allow always, scoped approvals and break-glass mode.')}
 ${surfaceCard('Mnemos', 'Guided', 'info', 'Configure folders and ask about files safely.')}
 ${surfaceCard('Models', 'Catalog', 'info', 'See which routes are configured, provable and live.')}
 </section>
 </div>
 `,
 );

 // sector-cron: mounted via React islands

 window.ZavorthControlChat?.refreshDashboard?.();
 bindPromptActions();
 bindSkillFilters();
 bindLocaleSettings();
 initRuntimeEngineUi();
 initPolicySimulatorUi();
 initMemoryBrowserUi();
 normalizeStaticEmptyStates();
 window.ZavorthLocale?.apply();

 function populate(id, html) {
 const el = document.getElementById(id);
 if (el) el.innerHTML = html;
 }

 function normalizeStaticEmptyStates() {
 const memoryEmpty = document.querySelector('#zavorth-memory-inspection-body .zavorth-memory-inspection-empty');
 if (memoryEmpty) {
 memoryEmpty.innerHTML = '<span>Select a scope</span>';
 }
 }

 // Support compact data-prompt buttons (Memory browser + elsewhere) alongside data-dashboard-prompt.
 if (document.documentElement.dataset.zavorthDataPromptBound !== '1') {
 document.documentElement.dataset.zavorthDataPromptBound = '1';
 document.addEventListener('click', (event) => {
 const target = event.target instanceof Element ? event.target : null;
 if (target?.closest?.('[data-dashboard-prompt]')) return;
 const promptButton = target?.closest?.('[data-prompt]');
 if (!promptButton || promptButton.closest('#neural-feed, .compose-dock, #suggestion-chips')) return;
 const prompt = promptButton.getAttribute('data-prompt') || '';
 if (!prompt) return;
 event.preventDefault();
 const input = document.getElementById('compose-input');
 document.querySelector('[data-sector="terminal"]')?.click();
 if (input instanceof HTMLTextAreaElement || input instanceof HTMLInputElement) {
 input.value = prompt;
 input.dispatchEvent(new Event('input', { bubbles: true }));
 input.focus();
 }
 });
 }

 function bindPromptActions() {
 if (document.documentElement.dataset.zavorthDashboardActionsBound === '1') return;
 document.documentElement.dataset.zavorthDashboardActionsBound = '1';
 document.addEventListener('click', (event) => {
 const target = event.target instanceof Element ? event.target : null;
 const sectorButton = target?.closest?.('[data-dashboard-sector]');
 if (sectorButton) {
 const sector = sectorButton.getAttribute('data-dashboard-sector');
 if (sector) {
 event.preventDefault();
 document.querySelector(`[data-sector="${sector}"]`)?.click();
 window.emitSignal?.('info', 'Opened', `${sector.replace(/-/g, ' ')} is now active.`);
 }
 return;
 }

 const promptButton = target?.closest?.('[data-dashboard-prompt]');
 if (!promptButton) return;
 const prompt = promptButton.getAttribute('data-dashboard-prompt') || '';
 if (!prompt) return;
 event.preventDefault();
 const input = document.getElementById('compose-input');
 document.querySelector('[data-sector="terminal"]')?.click();
 if (input instanceof HTMLTextAreaElement || input instanceof HTMLInputElement) {
 input.value = prompt;
 input.dispatchEvent(new Event('input', { bubbles: true }));
 input.focus();
 window.emitSignal?.('success', 'Action ready', 'Review or send the prepared prompt from Inbox.');
 }
 });
 }

 function bindSkillFilters() {
 if (document.documentElement.dataset.zavorthSkillFiltersBound === '1') return;
 document.documentElement.dataset.zavorthSkillFiltersBound = '1';
 document.addEventListener('input', (event) => {
 const target = event.target instanceof Element ? event.target : null;
 if (target?.matches?.('[data-skill-search]')) applySkillFilter();
 });
 document.addEventListener('click', (event) => {
 const target = event.target instanceof Element ? event.target : null;
 const filter = target?.closest?.('[data-skill-filter]');
 if (!filter) return;
 event.preventDefault();
 const toolbar = filter.closest('.skill-toolbar');
 toolbar?.querySelectorAll('[data-skill-filter]').forEach((button) => {
 button.classList.toggle('is-active', button === filter);
 });
 applySkillFilter();
 });
 const skillList = document.querySelector('#sector-skills .premium-skill-list');
 if (skillList && typeof MutationObserver !== 'undefined') {
 new MutationObserver(() => applySkillFilter()).observe(skillList, { childList: true });
 }
 }

 function bindLocaleSettings() {
 if (document.documentElement.dataset.zavorthLocaleSettingsBound === '1') return;
 document.documentElement.dataset.zavorthLocaleSettingsBound = '1';
 document.addEventListener('click', (event) => {
 const target = event.target instanceof Element ? event.target : null;
 const button = target?.closest?.('[data-zavorth-locale-apply]');
 if (!button) return;
 const select = document.querySelector('[data-zavorth-locale-select]');
 if (!(select instanceof HTMLSelectElement)) return;
 window.ZavorthLocale?.set(select.value as any);
 window.emitSignal?.('success', 'Language updated', 'The dashboard language was applied.');
 });
 }

 function applySkillFilter() {
 const root = document.getElementById('sector-skills');
 if (!root) return;
 const query = String(root.querySelector('[data-skill-search]')?.value || '')
 .trim()
 .toLowerCase();
 const active = root.querySelector('[data-skill-filter].is-active')?.getAttribute('data-skill-filter') || 'all';
 root.querySelectorAll('[data-skill-row]').forEach((row) => {
 const haystack = String(row.getAttribute('data-skill-search-text') || row.textContent || '').toLowerCase();
 const status = String(row.getAttribute('data-skill-status') || '').toLowerCase();
 const matchesQuery = !query || haystack.includes(query);
 const matchesStatus = active === 'all' || status === active;
 if (row instanceof HTMLElement) row.hidden = !(matchesQuery && matchesStatus);
 });
 }

 function dailyHeader(title, subtitle, actions = '') {
 return `<section class="daily-header">
 <div>
 <span class="daily-kicker"><span class="dashboard-live-dot"></span>${title}</span>
 <h1>${title}</h1>
 ${subtitle ? `<p>${subtitle}</p>` : ''}
 </div>
 ${actions ? `<div class="daily-header__actions">${actions}</div>` : ''}
 </section>`;
 }

 function dailyMetric(label, value, sub) {
 return `<article class="daily-metric"><span>${label}</span><strong>${value}</strong><small>${sub}</small></article>`;
 }

 function dailyKeyValue(label, value) {
 return `<div class="daily-key-value__row"><span>${label}</span><strong>${value}</strong></div>`;
 }

 function channelRow(name, subtitle, status, tone, primary, secondary, prompt) {
 return `<article class="daily-channel-row daily-channel-row--${tone}">
 <span class="daily-status-dot" aria-hidden="true"></span>
 <div class="daily-row__main">
 <h2>${name}<small>${subtitle}</small></h2>
 </div>
 <span class="daily-status daily-status--${tone}">${status}</span>
 <div class="daily-row__actions">
 <button type="button" class="daily-button" data-dashboard-prompt="${prompt}">${primary}</button>
 <button type="button" class="daily-button daily-button--ghost" data-dashboard-prompt="Show setup status, last error and next step for ${name}.">${secondary}</button>
 </div>
 </article>`;
 }

 function premiumMetric(label, value, sub, tone) {
 return `<article class="premium-metric premium-metric--${tone}"><span>${label}</span><strong>${value}</strong><small>${sub}</small></article>`;
 }

 function platformStat(label, value, sub, tone) {
 return `<article class="platform-stat platform-stat--${tone}"><span>${label}</span><strong>${value}</strong><small>${sub}</small></article>`;
 }

 function premiumStep(index, title, detail) {
 return `<div><span>${index}</span><strong>${title}</strong><small>${detail}</small></div>`;
 }

 function premiumStatus(name, state, tone) {
 return `<div class="premium-status premium-status--${tone}"><span>${name}</span><strong>${state}</strong></div>`;
 }

 function surfaceCard(name, status, tone, detail) {
 return `<article class="premium-card premium-card--${tone}"><div class="premium-card__top"><h2>${name}</h2><span>${status}</span></div><p>${detail}</p></article>`;
 }

 function plainPanel(title, detail) {
 return `<article class="premium-panel"><div class="premium-panel__header"><div><span>Control</span><h2>${title}</h2></div><span class="dashboard-pill">ready</span></div><p>${detail}</p></article>`;
 }

 function setupStep(title, state, detail) {
 return `<article class="setup-step"><span>${title}</span><strong>${state}</strong><small>${detail}</small></article>`;
 }

 function decisionCard(title, state, detail, tone, action) {
 return `<article class="decision-card decision-card--${tone}"><div><span>${title}</span><strong>${state}</strong><p>${detail}</p></div><button type="button" data-dashboard-sector="terminal">${action}</button></article>`;
 }

 function receiptStory(label, value) {
 return `<div class="receipt-story"><span>${label}</span><strong>${value}</strong></div>`;
 }
}

initControlPages();
initLearningDreamsUi();
bindModelPreferenceEvents(() => window.ZavorthControlChat?.refreshDashboard?.());
try {
 bindLearnedKnowledgeHub();
} catch {
 /* optional surface */
}
try {
 // Legacy single-card (hidden when hub renders successfully)
 bindLearningLoopStatusCard();
} catch {
 /* optional surface */
}
