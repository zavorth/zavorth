/** Lite workboard columns from live runs. */

import { translate } from './locale';

export type WorkboardRun = {
  id?: string;
  title?: string;
  summary?: string;
  status?: string;
  nextAction?: string;
};

const DONE = new Set(['done', 'completed', 'complete', 'success', 'succeeded', 'failed', 'error', 'cancelled', 'canceled']);
const RUNNING = new Set(['running', 'active', 'in_progress', 'in-progress', 'working', 'streaming', 'executing']);
const PENDING = new Set(['pending', 'queued', 'waiting', 'approval', 'blocked', 'paused']);

function bucketFor(run: WorkboardRun): 'pending' | 'running' | 'done' {
  const status = String(run.status || run.nextAction || '').toLowerCase();
  if (DONE.has(status) || /fail|error|cancel|complete|success|done/.test(status)) return 'done';
  if (RUNNING.has(status) || /run|active|work|stream|exec/.test(status)) return 'running';
  if (PENDING.has(status) || /wait|queue|approv|block|pend/.test(status)) return 'pending';
  if (!status) return 'pending';
  return 'running';
}

function escapeLite(value: string): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function labelFor(run: WorkboardRun): string {
  return String(run.title || run.summary || run.id || 'Run').slice(0, 64);
}

function openWorkboardRunFromLite(runId: string, title: string): void {
  const detail = { runId, title };
  // Prefer the control chat bridge when present (deep-links into transcript/trace).
  try {
    if (typeof window.ZavorthControlChat?.openWorkboardRun === 'function') {
      window.ZavorthControlChat.openWorkboardRun(detail);
      return;
    }
  } catch {
    // fall through
  }
  try {
    window.ZavorthControlChat?.activateDashboardSector?.('terminal')
      || document.querySelector<HTMLElement>('[data-dashboard-sector="terminal"]')?.click();
  } catch {
    // optional navigation
  }
  try {
    window.dispatchEvent(new CustomEvent('zavorth-workboard-open', { detail }));
  } catch {
    // ignore
  }
  try {
    window.emitSignal?.(
      'info',
      translate('Workboard'),
      runId ? translate('Opening run…') : title,
    );
  } catch {
    // optional toast
  }
}

function bindWorkboardClicks(): void {
  if (typeof document === 'undefined') return;
  if (document.documentElement.dataset.zavorthWorkboardLiteBound === '1') return;
  document.documentElement.dataset.zavorthWorkboardLiteBound = '1';

  const activate = (item: HTMLElement) => {
    const runId = String(item.getAttribute('data-workboard-item') || '').trim();
    const title = String(item.querySelector('strong')?.textContent || runId || translate('Open run'));
    openWorkboardRunFromLite(runId, title);
  };

  document.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const item = target?.closest?.('[data-workboard-item]') as HTMLElement | null;
    if (!item) return;
    event.preventDefault();
    activate(item);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const target = event.target instanceof HTMLElement ? event.target : null;
    if (!target?.matches?.('[data-workboard-item]')) return;
    event.preventDefault();
    activate(target);
  });
}

export function updateWorkboardLite(runs: WorkboardRun[] = []) {
  const board = document.querySelector<HTMLElement>('[data-workboard-lite]');
  if (!board) return;

  bindWorkboardClicks();

  const buckets: Record<'pending' | 'running' | 'done', WorkboardRun[]> = {
    pending: [],
    running: [],
    done: [],
  };

  (Array.isArray(runs) ? runs : []).slice(0, 24).forEach((run) => {
    buckets[bucketFor(run)].push(run);
  });

  (['pending', 'running', 'done'] as const).forEach((key) => {
    const list = board.querySelector<HTMLElement>(`[data-workboard-list="${key}"]`);
    if (!list) return;
    const items = buckets[key];
    if (!items.length) {
      list.innerHTML = '<li class="daily-muted">—</li>';
      return;
    }
    list.innerHTML = items
      .slice(0, 8)
      .map((run) => {
        const id = escapeLite(String(run.id || ''));
        const title = escapeLite(labelFor(run));
        const status = escapeLite(String(run.status || key));
        return `<li data-workboard-item="${id}" role="button" tabindex="0" title="${escapeLite(translate('Open run'))}"><strong>${title}</strong><small>${status}</small></li>`;
      })
      .join('');
  });
}

declare global {
  interface Window {
    emitSignal?: (type: string, title: string, detail?: string) => void;
    ZavorthControlChat?: {
      activateDashboardSector?: (sector: string) => void;
      refreshDashboard?: () => void;
      openWorkboardRun?: (detail: { runId?: string; title?: string }) => void;
    };
  }
}
