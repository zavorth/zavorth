/**
 * Control hub: four Learned Knowledge pillars + story timeline story events + Advanced.
 * API returns English-canonical labels/summaries; UI translates via locale.ts (device locale + EN fallback).
 */
import { escapeHtml } from './html-utils';
import { createShellLogger } from './shell-debug';
import { translate } from './locale';

const log = createShellLogger('learned-knowledge-hub');

type HubCard = {
 id: string;
 label: string;
 ready: boolean;
 summary: string;
 cli: string;
 slash: string;
 metrics?: Record<string, string | number | boolean | null>;
};

type StoryEvent = {
 id?: string;
 pillar?: string;
 at?: string;
 title?: string;
 snippet?: string;
 sourceId?: string;
};

type StoryPreview = {
 summary?: string;
 cli?: string;
 slash?: string;
 days?: number;
 eventCount?: number;
 events?: StoryEvent[];
};

type AdvancedBlock = {
 fileIndex?: {
 label?: string;
 summary?: string;
 cli?: string;
 available?: boolean;
 vaultPath?: string | null;
 fileCount?: number | null;
 directoryCount?: number | null;
 lastModifiedAt?: string | null;
 truncatedScan?: boolean;
 setupHint?: string;
 dockerConsentPath?: string;
 };
 dreamCycle?: {
 label?: string;
 summary?: string;
 cli?: string;
 slash?: string;
 schedulerCli?: string;
 previewOnly?: boolean;
 lastRunAt?: string | null;
 lastRunMode?: string | null;
 lastCandidateCount?: number | null;
 lastQuarantineCount?: number | null;
 lastStatus?: string | null;
 nextEligibleHint?: string;
 };
 preferenceNote?: string;
 preferenceSpineNote?: string;
};

type DraftItem = {
 id?: string;
 title?: string;
 useCount?: number;
 revisions?: number;
 tools?: string[];
};

const PILLAR_LABEL_KEYS: Record<string, string> = {
 workflows: 'Workflows',
 conversation: 'Conversation',
 'about-you': 'About you',
 knowledge: 'Knowledge',
};

function pillarLabel(pillar: string): string {
 const key = PILLAR_LABEL_KEYS[pillar] || pillar;
 return translate(key);
}

function formatWhen(iso: string | undefined): string {
 if (!iso) return '';
 try {
 const d = new Date(iso);
 if (Number.isNaN(d.getTime())) return String(iso).slice(0, 16);
 return d.toLocaleString(undefined, {
 month: 'short',
 day: 'numeric',
 hour: '2-digit',
 minute: '2-digit',
 });
 } catch {
 return String(iso).slice(0, 16);
 }
}

async function copyCommand(text: string): Promise<boolean> {
 try {
 if (navigator.clipboard?.writeText) {
 await navigator.clipboard.writeText(text);
 return true;
 }
 } catch {
 // fall through
 }
 try {
 const ta = document.createElement('textarea');
 ta.value = text;
 ta.setAttribute('readonly', '');
 ta.style.position = 'fixed';
 ta.style.left = '-9999px';
 document.body.appendChild(ta);
 ta.select();
 const ok = document.execCommand('copy');
 document.body.removeChild(ta);
 return ok;
 } catch {
 return false;
 }
}

type PromoteApiResult = {
 ok?: boolean;
 dryRun?: boolean;
 text?: string;
 title?: string | null;
 skillName?: string | null;
 error?: string;
 detail?: string;
 fallbackCommand?: string;
};

/** Real one-click promote via control-local API; returns result or throws. */
async function promoteDraftViaApi(input: {
 userId?: string;
 ordinal: number;
 dryRun?: boolean;
}): Promise<PromoteApiResult> {
 const res = await fetch('/api/learning-loop/promote', {
 method: 'POST',
 headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
 body: JSON.stringify({
 userId: input.userId || 'control',
 ordinal: input.ordinal,
 dryRun: Boolean(input.dryRun),
 }),
 });
 const data = (await res.json().catch(() => ({}))) as PromoteApiResult;
 if (!res.ok || data?.ok === false) {
 const err = new Error(String(data?.detail || data?.error || `HTTP ${res.status}`)) as Error & {
 fallbackCommand?: string;
 status?: number;
 };
 err.fallbackCommand = data?.fallbackCommand || `/learn promote ${input.ordinal}${input.dryRun ? ' --dry-run' : ''}`;
 err.status = res.status;
 throw err;
 }
 return data;
}

function flashButton(btn: HTMLElement, label: string, restoreMs = 1600): void {
 const prev = btn.textContent;
 btn.textContent = label;
 window.setTimeout(() => {
 if (prev != null) btn.textContent = prev;
 }, restoreMs);
}

function bindPromoteActions(root: HTMLElement, onPromoted?: () => void): void {
 root.querySelectorAll<HTMLElement>('[data-learn-copy]').forEach((btn) => {
 // Promote buttons carry data-learn-copy as clipboard fallback only — bound below.
 if (btn.hasAttribute('data-learn-promote-ordinal')) return;
 if (btn.dataset.bound === '1') return;
 btn.dataset.bound = '1';
 btn.addEventListener('click', async () => {
 const cmd = btn.getAttribute('data-learn-copy') || '';
 if (!cmd) return;
 const ok = await copyCommand(cmd);
 flashButton(btn, ok ? translate('Copied') : cmd);
 });
 });

 root.querySelectorAll<HTMLElement>('[data-learn-promote-ordinal]').forEach((btn) => {
 if (btn.dataset.bound === '1') return;
 btn.dataset.bound = '1';
 btn.addEventListener('click', async () => {
 const ordinal = Number(btn.getAttribute('data-learn-promote-ordinal') || 0);
 if (!Number.isFinite(ordinal) || ordinal < 1) return;
 const dryRun = btn.getAttribute('data-learn-promote-dry-run') === '1';
 const fallback = btn.getAttribute('data-learn-copy') || `/learn promote ${ordinal}${dryRun ? ' --dry-run' : ''}`;
 const prevDisabled = btn.hasAttribute('disabled');
 btn.setAttribute('disabled', 'true');
 try {
 const result = await promoteDraftViaApi({ userId: 'control', ordinal, dryRun });
 const title = result.title ? String(result.title).slice(0, 48) : `draft ${ordinal}`;
 const msg = dryRun
 ? result.text || `Dry-run promote ${ordinal} ok`
 : result.skillName
 ? `${translate('Promoted')}: ${title} → ${result.skillName}`
 : `${translate('Promoted')}: ${title}`;
 flashButton(btn, dryRun ? translate('Preview ok') : translate('Promoted'));
 window.emitSignal?.(dryRun ? 'info' : 'success', translate('Learning loop'), msg.slice(0, 240));
 if (!dryRun) onPromoted?.();
 } catch (error: unknown) {
 const err = error as { message?: string; fallbackCommand?: string };
 const cmd = String(err?.fallbackCommand || fallback);
 const copied = await copyCommand(cmd);
 flashButton(btn, copied ? translate('Copied') : cmd, 2200);
 window.emitSignal?.(
 'error',
 translate('Promote failed'),
 `${String(err?.message || 'Promote failed')}${copied ? ` · ${translate('Command copied')}: ${cmd}` : ` · ${cmd}`}`,
 );
 } finally {
 if (!prevDisabled) btn.removeAttribute('disabled');
 }
 });
 });
}

function renderPromoteStrip(drafts: number, items: DraftItem[]): string {
 if (drafts <= 0) return '';
 const cap = Math.min(5, Math.max(drafts, items.length));
 const buttons: string[] = [];
 for (let i = 1; i <= Math.min(cap, 5); i += 1) {
 const item = items[i - 1];
 const title = item?.title ? String(item.title).slice(0, 36) : `${translate('Draft')} ${i}`;
 const cmd = `/learn promote ${i}`;
 buttons.push(
 `<button type="button" class="daily-route-result__meta" data-learn-promote-ordinal="${i}" data-learn-copy="${escapeHtml(cmd)}" title="${escapeHtml(cmd)}" style="cursor:pointer;margin:2px 4px 2px 0;padding:3px 8px;border-radius:8px;border:1px solid currentColor;background:transparent;font:inherit;font-size:11px">
 ${escapeHtml(translate('Promote'))} ${i}${item?.title ? ` · ${escapeHtml(title)}` : ''}
 </button>`,
 );
 }
 return `
 <div data-lk-promote="1" style="margin-top:8px;padding-top:6px;border-top:1px dashed currentColor">
 <p style="margin:0 0 4px 0;font-size:12px">
 <strong>${escapeHtml(String(drafts))}</strong>
 ${escapeHtml(drafts === 1 ? translate('skill draft ready to promote') : translate('skill drafts ready to promote'))}
 </p>
 <div style="display:flex;flex-wrap:wrap;align-items:center;gap:2px">
 ${buttons.join('')}
 <button type="button" class="daily-route-result__meta" data-learn-copy="/learn list" title="/learn list" style="cursor:pointer;margin:2px 4px 2px 0;padding:3px 8px;border-radius:8px;border:1px solid currentColor;background:transparent;font:inherit;font-size:11px">
 ${escapeHtml(translate('List drafts'))}
 </button>
 </div>
 <p class="mono" style="margin:6px 0 0 0;font-size:11px;opacity:0.8">/learn promote 1 · /learn list · not /learning (candidates)</p>
 </div>
 `;
}

/**
 * Renders the unified Learned Knowledge hub (Workflows · Conversation · About you · Knowledge).
 * Hosts next to LLM roles / settings; also used when #learning-loop-status exists.
 */
export function bindLearnedKnowledgeHub(): void {
 if (document.documentElement.dataset.learnedKnowledgeHubBound === '1') return;
 document.documentElement.dataset.learnedKnowledgeHubBound = '1';

 const ensureHost = (): HTMLElement | null => {
 let host = document.getElementById('learned-knowledge-hub');
 if (host) return host;
 const loop = document.getElementById('learning-loop-status');
 const roles = document.getElementById('llm-roles-status');
 const parent =
 loop?.parentElement || roles?.parentElement || document.getElementById('model-preference-form')?.parentElement;
 if (!parent) return null;
 host = document.createElement('div');
 host.id = 'learned-knowledge-hub';
 host.className = 'daily-route-result';
 host.setAttribute('aria-live', 'polite');
 if (loop) parent.insertBefore(host, loop);
 else if (roles) parent.insertBefore(host, roles.nextSibling);
 else parent.appendChild(host);
 return host;
 };

 const host = ensureHost();
 if (!host) return;

 const loadHub = (opts?: { quiet?: boolean }): void => {
 if (!opts?.quiet) {
 host.innerHTML = `<p class="daily-route-result__meta">${escapeHtml(translate('Loading learned knowledge…'))}</p>`;
 }

 const hubPromise = fetch('/api/knowledge/hub?userId=control').then(async (res) => {
 if (!res.ok) throw new Error(String(res.status));
 return res.json();
 });

 const draftsPromise = fetch('/api/learning-loop?userId=control')
 .then(async (res) => {
 if (!res.ok) return { drafts: 0, items: [] as DraftItem[] };
 const data = await res.json();
 const items: DraftItem[] = Array.isArray(data?.items) ? data.items : [];
 const drafts = Number(data?.drafts ?? data?.count ?? items.length ?? 0) || 0;
 return { drafts, items };
 })
 .catch(() => ({ drafts: 0, items: [] as DraftItem[] }));

 Promise.all([hubPromise, draftsPromise])
 .then(([data, loop]) => {
 const cards: HubCard[] = Array.isArray(data?.cards) ? data.cards : [];
 const oneLiner = String(data?.oneLiner || '');
 const enabled = data?.enabled !== false;
 const draftItems = loop.items;
 const draftCountFromLoop = loop.drafts;

 const cardHtml = cards
 .map((c) => {
 // English keys from API → translate() for active Control locale (EN fallback).
 const label = translate(c.label || pillarLabel(c.id));
 const summary = String(c.summary || '');
 const tone = c.ready ? 'opacity:0.95' : 'opacity:0.7';
 const metricDrafts = Number(c.metrics?.drafts ?? 0) || 0;
 const drafts = c.id === 'workflows' ? Math.max(metricDrafts, draftCountFromLoop) : 0;
 const promote = c.id === 'workflows' ? renderPromoteStrip(drafts, draftItems) : '';
 return `
 <article class="daily-route-result__meta" data-lk-card="${escapeHtml(c.id)}" style="margin-top:10px;padding:8px 10px;border:1px solid currentColor;border-radius:10px;${tone}">
 <p style="margin:0 0 4px 0">
 <strong>${escapeHtml(label)}</strong>
 <span style="margin-left:8px;font-size:11px;padding:1px 8px;border-radius:999px;border:1px solid currentColor">
 ${escapeHtml(c.ready ? translate('Ready') : translate('Setup'))}
 </span>
 </p>
 <p style="margin:0 0 4px 0">${escapeHtml(summary)}</p>
 <p class="mono" style="margin:0;font-size:11px;opacity:0.85">${escapeHtml(c.cli)}</p>
 <p class="mono" style="margin:2px 0 0 0;font-size:11px;opacity:0.75">${escapeHtml(c.slash)}</p>
 ${promote}
 </article>
 `;
 })
 .join('');

 const story = data?.storyPreview as StoryPreview | undefined;
 let storyHtml = '';
 if (story && (story.summary || story.cli || (story.events && story.events.length))) {
 const storySummary = String(story.summary || '');
 const events = Array.isArray(story.events) ? story.events : [];
 const eventsHtml = events.length
 ? `<ul style="margin:8px 0 0 0;padding-left:18px;font-size:12px;list-style:disc">
 ${events
 .map((ev) => {
 const pillar = pillarLabel(String(ev.pillar || ''));
 const when = formatWhen(ev.at);
 return `<li style="margin:0 0 6px 0">
 <span style="font-size:10px;opacity:0.8;border:1px solid currentColor;border-radius:999px;padding:0 6px;margin-right:4px">${escapeHtml(pillar)}</span>
 <strong>${escapeHtml(String(ev.title || ''))}</strong>
 ${when ? `<span style="opacity:0.7;font-size:10px;margin-left:4px">${escapeHtml(when)}</span>` : ''}
 <div style="opacity:0.85;margin-top:2px">${escapeHtml(String(ev.snippet || ''))}</div>
 </li>`;
 })
 .join('')}
 </ul>`
 : `<p style="margin:6px 0 0 0;font-size:12px;opacity:0.8">${escapeHtml(translate('No events in this window yet.'))}</p>`;

 storyHtml = `
 <article class="daily-route-result__meta" data-lk-story="1" style="margin-top:12px;padding:8px 10px;border:1px dashed currentColor;border-radius:10px;opacity:0.95">
 <p style="margin:0 0 4px 0">
 <strong>${escapeHtml(translate('This week'))}</strong>
 ${typeof story.eventCount === 'number' ? `<span style="margin-left:6px;font-size:11px;opacity:0.8">${escapeHtml(String(story.eventCount))} ${escapeHtml(translate('events'))}</span>` : ''}
 ${story.days ? `<span style="margin-left:6px;font-size:11px;opacity:0.75">${escapeHtml(String(story.days))}d</span>` : ''}
 </p>
 <p style="margin:0 0 4px 0">${escapeHtml(storySummary)}</p>
 ${eventsHtml}
 ${story.cli ? `<p class="mono" style="margin:8px 0 0 0;font-size:11px;opacity:0.85">${escapeHtml(story.cli)}</p>` : ''}
 ${story.slash ? `<p class="mono" style="margin:2px 0 0 0;font-size:11px;opacity:0.75">${escapeHtml(story.slash)}</p>` : ''}
 </article>
 `;
 }

 const advanced = data?.advanced as AdvancedBlock | undefined;
 let advancedHtml = '';
 if (
 advanced &&
 (advanced.fileIndex || advanced.dreamCycle || advanced.preferenceNote || advanced.preferenceSpineNote)
 ) {
 const fi = advanced.fileIndex;
 const dc = advanced.dreamCycle;
 const fiLabel = fi ? translate(fi.label || 'File index') : '';
 const fiSummary = fi ? String(fi.summary || '') : '';
 const dcLabel = dc ? translate(dc.label || 'Dream cycle') : '';
 const dcSummary = dc ? String(dc.summary || '') : '';
 const prefNote = String(advanced.preferenceNote || advanced.preferenceSpineNote || '');

 const fiMetrics: string[] = [];
 if (fi) {
 if (fi.available === false) fiMetrics.push(translate('Vault missing'));
 if (fi.available && typeof fi.fileCount === 'number')
 fiMetrics.push(`${fi.fileCount} ${translate('files')}`);
 if (fi.available && typeof fi.directoryCount === 'number')
 fiMetrics.push(`${fi.directoryCount} ${translate('dirs')}`);
 if (fi.lastModifiedAt) fiMetrics.push(`${translate('Changed')} ${formatWhen(fi.lastModifiedAt)}`);
 if (fi.truncatedScan) fiMetrics.push(translate('scan capped'));
 }

 const dcMetrics: string[] = [];
 if (dc) {
 if (dc.previewOnly) dcMetrics.push(translate('Preview only'));
 if (dc.lastRunAt) dcMetrics.push(`${translate('Last run')} ${formatWhen(dc.lastRunAt)}`);
 if (typeof dc.lastCandidateCount === 'number') dcMetrics.push(`candidates=${dc.lastCandidateCount}`);
 if (typeof dc.lastQuarantineCount === 'number') dcMetrics.push(`quarantine=${dc.lastQuarantineCount}`);
 if (dc.lastStatus) dcMetrics.push(String(dc.lastStatus));
 }

 advancedHtml = `
 <details class="daily-route-result__meta" data-lk-advanced="1" open style="margin-top:12px;padding:8px 10px;border:1px solid currentColor;border-radius:10px">
 <summary style="cursor:pointer"><strong>${escapeHtml(translate('Advanced'))}</strong>
 <span style="margin-left:6px;font-size:11px;opacity:0.8">${escapeHtml(translate('Knowledge'))}</span>
 </summary>
 ${
 fi
 ? `
 <p style="margin:10px 0 2px 0"><strong>${escapeHtml(String(fiLabel))}</strong>
 <span style="margin-left:6px;font-size:11px;opacity:0.85">${escapeHtml(fi.available ? translate('Ready') : translate('Setup'))}</span>
 </p>
 ${fiMetrics.length ? `<p style="margin:0 0 4px 0;font-size:11px;opacity:0.85">${escapeHtml(fiMetrics.join(' · '))}</p>` : ''}
 <p style="margin:0 0 4px 0">${escapeHtml(String(fiSummary))}</p>
 ${fi.vaultPath ? `<p class="mono" style="margin:0 0 2px 0;font-size:11px;opacity:0.8">${escapeHtml(fi.vaultPath)}</p>` : ''}
 ${fi.setupHint ? `<p style="margin:0 0 4px 0;font-size:11px;opacity:0.8">${escapeHtml(fi.setupHint)}</p>` : ''}
 ${fi.dockerConsentPath ? `<p class="mono" style="margin:0 0 2px 0;font-size:10px;opacity:0.75">${escapeHtml(fi.dockerConsentPath)}</p>` : ''}
 ${fi.cli ? `<p class="mono" style="margin:0;font-size:11px;opacity:0.85">${escapeHtml(fi.cli)}</p>` : ''}
 `
 : ''
 }
 ${
 dc
 ? `
 <p style="margin:12px 0 2px 0"><strong>${escapeHtml(String(dcLabel))}</strong></p>
 ${dcMetrics.length ? `<p style="margin:0 0 4px 0;font-size:11px;opacity:0.85">${escapeHtml(dcMetrics.join(' · '))}</p>` : ''}
 <p style="margin:0 0 4px 0">${escapeHtml(String(dcSummary))}</p>
 ${dc.nextEligibleHint ? `<p style="margin:0 0 4px 0;font-size:11px;opacity:0.8">${escapeHtml(dc.nextEligibleHint)}</p>` : ''}
 ${dc.cli ? `<p class="mono" style="margin:0;font-size:11px;opacity:0.85">${escapeHtml(dc.cli)}</p>` : ''}
 ${dc.slash ? `<p class="mono" style="margin:2px 0 0 0;font-size:11px;opacity:0.75">${escapeHtml(dc.slash)}</p>` : ''}
 ${dc.schedulerCli ? `<p class="mono" style="margin:2px 0 0 0;font-size:11px;opacity:0.75">${escapeHtml(dc.schedulerCli)}</p>` : ''}
 `
 : ''
 }
 ${prefNote ? `<p style="margin:10px 0 0 0;font-size:12px;opacity:0.85">${escapeHtml(prefNote)}</p>` : ''}
 </details>
 `;
 }

 const oneLinerDisplay = oneLiner
 ? translate(oneLiner)
 : translate('Workflows, conversations, about you, and project knowledge.');

 host.innerHTML = `
 <p>
 <strong>${escapeHtml(translate('Learned knowledge'))}</strong>
 <span class="daily-route-result__meta" style="margin-left:8px;padding:2px 8px;border-radius:999px;border:1px solid currentColor;opacity:0.9">
 ${escapeHtml(enabled ? translate('On') : translate('Off'))}
 </span>
 </p>
 <p class="daily-route-result__meta">${escapeHtml(oneLinerDisplay)}</p>
 ${cardHtml}
 ${storyHtml}
 ${advancedHtml}
 <p class="daily-route-result__meta" style="margin-top:8px">
 ${escapeHtml(translate('/learn = skill drafts · /learning = candidates'))}
 </p>
 <p class="daily-route-result__meta mono" style="margin-top:4px">
 zavorth knowledge status · /knowledge · /learn list · /learn promote 1 · /learning list
 </p>
 `;

 bindPromoteActions(host, () => loadHub({ quiet: true }));

 const legacy = document.getElementById('learning-loop-status');
 if (legacy && legacy !== host) {
 legacy.style.display = 'none';
 legacy.setAttribute('aria-hidden', 'true');
 }
 })
 .catch((error) => {
 log.error('learned knowledge hub fallback', error);
 host.innerHTML = `
 <p><strong>${escapeHtml(translate('Learned knowledge'))}</strong></p>
 <p class="daily-route-result__meta">${escapeHtml(translate('Hub unavailable. Run zavorth knowledge status on this machine.'))}</p>
 <p class="daily-route-result__meta mono">zavorth knowledge status · /knowledge · /learn list · /learning list</p>
 `;
 });
 };

 loadHub();
}
