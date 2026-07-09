/**
 * Light workboard (P2-19) — Pending / Running / Done lists from live runs.
 */

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

export function updateWorkboardLite(runs: WorkboardRun[] = []) {
  const board = document.querySelector<HTMLElement>('[data-workboard-lite]');
  if (!board) return;

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
        return `<li data-workboard-item="${id}"><strong>${title}</strong><small>${status}</small></li>`;
      })
      .join('');
  });
}
