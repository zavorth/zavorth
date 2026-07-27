import { escapeHtml } from './html-utils';
import { createShellLogger } from './shell-debug';
import { translate } from './locale';

const log = createShellLogger('learning-loop');

type DraftItem = {
  id?: string;
  title?: string;
  useCount?: number;
  revisions?: number;
  tools?: string[];
};

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
    // Skip pure promote buttons (they also carry data-learn-copy as fallback).
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
          : result.skillName ? `${translate('Promoted')}: ${title} → ${result.skillName}`
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

function renderPromoteBlock(drafts: number, items: DraftItem[]): string {
  if (drafts <= 0) {
    return `<p class="daily-route-result__meta mono">zavorth learn · /learn list · /learn promote 1</p>`;
  }
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
    <div data-learn-promote="1" style="margin-top:8px;padding:8px 10px;border:1px solid currentColor;border-radius:10px">
      <p style="margin:0 0 4px 0;font-size:12px">
        <strong>${escapeHtml(String(drafts))}</strong>
        ${escapeHtml(drafts === 1 ? translate('skill draft ready to promote') : translate('skill drafts ready to promote'))}
      </p>
      <div style="display:flex;flex-wrap:wrap;align-items:center;gap:2px">
        ${buttons.join('')}
        <button type="button" class="daily-route-result__meta" data-learn-copy="/learn list" title="/learn list" style="cursor:pointer;margin:2px 4px 2px 0;padding:3px 8px;border-radius:8px;border:1px solid currentColor;background:transparent;font:inherit;font-size:11px">
          ${escapeHtml(translate('List drafts'))}
        </button>
        <button type="button" class="daily-route-result__meta" data-learn-promote-ordinal="1" data-learn-promote-dry-run="1" data-learn-copy="/learn promote 1 --dry-run" title="/learn promote 1 --dry-run" style="cursor:pointer;margin:2px 4px 2px 0;padding:3px 8px;border-radius:8px;border:1px solid currentColor;background:transparent;font:inherit;font-size:11px">
          ${escapeHtml(translate('Preview promote 1'))}
        </button>
      </div>
      <p class="mono" style="margin:6px 0 0 0;font-size:11px;opacity:0.85">/learn promote 1 · /learn list · /learn forget 1</p>
    </div>
  `;
}

/**
 * Control card: learning loop badge + draft counts + promote affordances.
 * Narrative: Zavorth keeps multi-tool workflows as local drafts you promote.
 * Tips use ordinals (`/learn promote 1`), never long id placeholders.
 */
export function bindLearningLoopStatusCard(): void {
  if (document.documentElement.dataset.learningLoopBound === '1') return;
  document.documentElement.dataset.learningLoopBound = '1';

  const ensureHost = (): HTMLElement | null => {
    let host = document.getElementById('learning-loop-status');
    if (host) return host;
    const roles = document.getElementById('llm-roles-status');
    const parent = roles?.parentElement || document.getElementById('model-preference-form')?.parentElement;
    if (!parent) return null;
    host = document.createElement('div');
    host.id = 'learning-loop-status';
    host.className = 'daily-route-result';
    host.setAttribute('aria-live', 'polite');
    parent.insertBefore(host, roles?.nextSibling || null);
    return host;
  };

  const host = ensureHost();
  if (!host) return;

  const render = (opts: {
    badge: string;
    body: string;
    topTools?: string;
    lastTrigger?: string;
    metricsLine?: string;
    planeNote?: string;
    drafts?: number;
    items?: DraftItem[];
  }) => {
    const drafts = Number(opts.drafts || 0) || 0;
    const items = Array.isArray(opts.items) ? opts.items : [];
    host.innerHTML = `
      <p>
        <strong>${escapeHtml(translate('Learning loop'))}</strong>
        <span class="daily-route-result__meta" style="margin-left:8px;padding:2px 8px;border-radius:999px;border:1px solid currentColor;opacity:0.9">
          ${escapeHtml(opts.badge)}
        </span>
      </p>
      <div class="daily-route-result__meta">${opts.body}</div>
      ${opts.metricsLine ? `<p class="daily-route-result__meta">${escapeHtml(opts.metricsLine)}</p>` : ''}
      ${opts.planeNote ? `<p class="daily-route-result__meta">${escapeHtml(opts.planeNote)}</p>` : ''}
      ${opts.topTools ? `<p class="daily-route-result__meta">${escapeHtml(translate('Top tools'))}: ${escapeHtml(opts.topTools)}</p>` : ''}
      ${opts.lastTrigger ? `<p class="daily-route-result__meta">${escapeHtml(translate('Last trigger'))}: ${escapeHtml(opts.lastTrigger)}</p>` : ''}
      <p class="daily-route-result__meta">${escapeHtml(translate('Zavorth saves multi-tool workflows as local skill drafts; you promote when ready.'))}</p>
      ${renderPromoteBlock(drafts, items)}
    `;
    bindPromoteActions(host, () => loadStatus());
  };

  const loadStatus = (): void => {
    fetch('/api/learning-loop...userId=control')
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status));
        const data = await res.json();
        const items: DraftItem[] = Array.isArray(data?.items) ? data.items : [];
        const drafts = Number(data?.drafts ?? data?.count ?? items.length ?? 0);
        const improved = Number(data?.improved ?? 0);
        const promoted = Number(data?.promoted ?? 0);
        const badge = String(data?.badge || (drafts > 0 ? `${drafts} workflows learned` : 'No workflows learned yet'));
        const topTools = Array.isArray(data?.topTools)
          ? data.topTools
              .slice(0, 5)
              .map((t: { tool?: string; count?: number }) => `${t.tool}(${t.count})`)
              .join(', ')
          : '';
        const lastTrigger = data?.lastTriggerAt
          ? `${data.lastTriggerAt}${data.lastTriggerReason ? ` (${data.lastTriggerReason})` : ''}`
          : '';
        const m = data?.metrics;
        const metricsLine =
          m && typeof m === 'object' && m.weekKey ? `${translate('Week')} ${m.weekKey}: ${translate('created')} ${Number(m.draftsCreated || 0)} · ${translate('promotes')} ${Number(m.promotes || 0)} · ${translate('reuses')} ${Number(m.reuses || 0)}`
            : undefined;
        const planeNote =
          typeof data?.planeNote === 'string' && data.planeNote.trim() ? String(data.planeNote).trim() : undefined;
        render({
          badge,
          body: escapeHtml(
            `${translate('Drafts')}: ${drafts} · ${translate('Improved')}: ${improved} · ${translate('Promoted')}: ${promoted}`,
          ),
          topTools,
          lastTrigger,
          metricsLine,
          planeNote,
          drafts,
          items,
        });
      })
      .catch((error) => {
        log.error('learning loop status fallback', error);
        render({
          badge: translate('No workflows learned yet'),
          body: escapeHtml(translate('Run zavorth learn for draft counts on this machine.')),
          drafts: 0,
          items: [],
        });
      });
  };

  loadStatus();
}
