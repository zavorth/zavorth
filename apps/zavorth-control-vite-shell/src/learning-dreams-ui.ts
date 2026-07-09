import { escapeHtml } from './html-utils';
import { messageFromErrorPayload } from './runtime-http';

const AUTH_STORAGE_KEY = 'zavorth.zavorthControl.webToken';

type LearningSummary = {
  total?: number;
  pending?: number;
  approved?: number;
  rejected?: number;
  promoted?: number;
  published?: number;
  quarantined?: number;
  highConfidence?: number;
  fromHooks?: number;
};

type LearningCandidate = {
  id: string;
  title?: string;
  kind?: string;
  summary?: string;
  score?: number;
  reviewState?: string;
  lifecycle?: string;
  steps?: string[];
  details?: string[];
  source?: {
    workflow?: string;
    workspace?: string;
    objective?: string;
  };
};

type LearningPayload = {
  generatedAt?: string;
  summary?: LearningSummary;
  data?: LearningCandidate[];
  learning?: {
    candidates?: LearningCandidate[];
    summary?: LearningSummary;
    pending?: number;
  };
  memory?: {
    summary?: string;
    signals?: unknown[];
  };
};

type MemoryStatusPayload = {
  generatedAt?: string;
  summary?: {
    total?: number;
    episodic?: number;
    semantic?: number;
    procedural?: number;
  };
};

function readToken(): string {
  try {
    return String(sessionStorage.getItem(AUTH_STORAGE_KEY) || '').trim();
  } catch {
    return '';
  }
}

async function readJson(path: string, options: RequestInit = {}) {
  const token = readToken();
  const response = await fetch(path, {
    ...options,
    headers: {
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { 'X-Zavorth-Token': token } : {}),
      ...(options.headers || {}),
    },
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(messageFromErrorPayload(payload, `${path} returned HTTP ${response.status}`));
    (error as any).status = response.status;
    throw error;
  }
  return payload;
}

function unwrap<T>(payload: any): T {
  return (payload && payload.ok === true && 'data' in payload ? payload.data : payload) as T;
}

function numberLabel(value: unknown): string {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? String(parsed) : '0';
}

function confidenceLabel(score: unknown): string {
  const parsed = Number(score || 0);
  if (!Number.isFinite(parsed) || parsed <= 0) return 'draft';
  return `${Math.round(parsed * 100)}%`;
}

function learningState(summary: LearningSummary = {}) {
  if ((summary.quarantined || 0) > 0) return { label: 'Needs review', tone: 'warn' };
  if ((summary.pending || 0) > 0) return { label: 'Review ready', tone: 'info' };
  if ((summary.promoted || 0) > 0 || (summary.approved || 0) > 0) return { label: 'Learning active', tone: 'ok' };
  return { label: 'Idle', tone: 'muted' };
}

function renderCandidates(candidates: LearningCandidate[]) {
  const top = candidates.slice(0, 8);
  if (top.length === 0) {
    return `<div class="learning-empty"><strong>No candidates</strong></div>`;
  }
  return top.map((candidate) => {
    const state = String(candidate.lifecycle || candidate.reviewState || 'draft').replace(/_/g, ' ');
    const canPromote = candidate.reviewState !== 'rejected' && candidate.lifecycle !== 'trusted_local' && candidate.lifecycle !== 'published';
    const applyAction = canPromote ? 'promote' : 'approve';
    return `
      <article class="learning-candidate" data-learning-candidate="${escapeHtml(candidate.id)}">
        <div class="learning-candidate__main">
          <span>${escapeHtml(candidate.kind || 'learning')}</span>
          <strong>${escapeHtml(candidate.title || 'Candidate')}</strong>
          <p>${escapeHtml(candidate.summary || candidate.source?.objective || '')}</p>
        </div>
        <div class="learning-candidate__side">
          <small>${escapeHtml(confidenceLabel(candidate.score))}</small>
          <em>${escapeHtml(state)}</em>
          <div class="learning-candidate__actions">
            <button type="button" data-learning-action="${applyAction}" data-learning-id="${escapeHtml(candidate.id)}">Apply</button>
            <button type="button" data-learning-action="reject" data-learning-id="${escapeHtml(candidate.id)}">Forget</button>
          </div>
        </div>
      </article>
    `;
  }).join('');
}

function renderLearningScene(root: HTMLElement, learning: LearningPayload, memory?: MemoryStatusPayload) {
  const summary = learning.learning?.summary || learning.summary || {};
  const state = learningState(summary);
  const candidates = Array.isArray(learning.learning?.candidates)
    ? learning.learning?.candidates || []
    : Array.isArray(learning.data) ? learning.data : [];
  const updated = learning.generatedAt ? new Date(learning.generatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'now';

  root.innerHTML = `
    <div class="daily-page learning-shell">
      <section class="daily-header">
        <div>
          <span class="daily-kicker">${escapeHtml(state.label)}</span>
          <h1>Learning</h1>
        </div>
        <button class="daily-button daily-button--primary" type="button" data-learning-refresh>Refresh</button>
      </section>
      <section class="daily-stat-row daily-stat-row--compact" aria-label="Learning summary">
        <article class="daily-metric"><span>Pending</span><strong>${numberLabel(summary.pending)}</strong><small>review</small></article>
        <article class="daily-metric"><span>Trusted</span><strong>${numberLabel(summary.promoted)}</strong><small>applied</small></article>
        <article class="daily-metric"><span>Hooks</span><strong>${numberLabel(summary.fromHooks)}</strong><small>signals</small></article>
      </section>

      <section class="daily-panel learning-review" aria-label="Learning candidates">
        <div class="daily-panel__head">
          <div><span>Queue</span><h2>Candidates</h2></div>
          <small class="daily-muted">${escapeHtml(updated)}</small>
        </div>
        <div class="learning-candidates" data-learning-candidates>
          ${renderCandidates(candidates)}
        </div>
      </section>
    </div>
  `;
}

function renderLearningError(root: HTMLElement, error: unknown) {
  root.innerHTML = `
    <div class="daily-page learning-shell">
      <section class="daily-header">
        <div>
          <span class="daily-kicker">Locked</span>
          <h1>Learning</h1>
          <p>${escapeHtml(String((error as Error)?.message || 'Token required.'))}</p>
        </div>
        <button class="daily-button daily-button--primary" type="button" data-dashboard-prompt="Help me unlock the local Zavorth dashboard token safely.">Unlock</button>
      </section>
    </div>
  `;
}

async function loadLearning(root: HTMLElement) {
  root.innerHTML = `
    <div class="daily-page learning-shell">
      <section class="daily-header">
        <div>
          <span class="daily-kicker">Learning</span>
          <h1>Learning</h1>
        </div>
        <button class="daily-button daily-button--primary" type="button" data-learning-refresh>Refresh</button>
      </section>
      <div class="learning-loading">Loading candidates…</div>
    </div>
  `;
  try {
    const [learningPayload, memoryPayload] = await Promise.all([
      readJson('/api/web/learning-dreams'),
      Promise.resolve(null),
    ]);
    renderLearningScene(
      root,
      unwrap<LearningPayload>(learningPayload),
      memoryPayload ? unwrap<MemoryStatusPayload>(memoryPayload) : undefined,
    );
  } catch (error) {
    const status = Number((error as any)?.status || 0);
    if (status === 401 || status === 403) {
      renderLearningError(root, error);
      return;
    }
    renderLearningScene(root, {
      generatedAt: new Date().toISOString(),
      summary: {
        total: 0,
        pending: 0,
        approved: 0,
        rejected: 0,
        promoted: 0,
        published: 0,
        quarantined: 0,
        highConfidence: 0,
      },
      data: [],
    });
    window.emitSignal?.('info', 'Learning', String((error as Error)?.message || 'Warming up.'));
  }
}

async function executeLearningAction(root: HTMLElement, candidateId: string, actionId: string) {
  const button = root.querySelector<HTMLButtonElement>(`[data-learning-id="${CSS.escape(candidateId)}"][data-learning-action="${CSS.escape(actionId)}"]`);
  if (button) button.disabled = true;
  try {
    await readJson('/api/web/learning-dreams/action', {
      method: 'POST',
      body: JSON.stringify({ candidateId, actionId }),
    });
    window.emitSignal?.('info', 'Learning updated', actionId === 'reject' ? 'The candidate was forgotten.' : 'The candidate was reviewed.');
    await loadLearning(root);
  } catch (error) {
    window.emitSignal?.('error', 'Learning action failed', String((error as Error)?.message || 'Try again.'));
    if (button) button.disabled = false;
  }
}

export function initLearningDreamsUi() {
  const root = document.querySelector<HTMLElement>('[data-learning-dreams-root]');
  if (!root) return;

  const maybeLoad = () => {
    const sector = document.getElementById('sector-dreams');
    if (sector?.classList.contains('active')) {
      loadLearning(root).catch(() => undefined);
    }
  };

  document.querySelectorAll<HTMLElement>('[data-sector="dreams"], [data-drawer-sector="dreams"]').forEach((trigger) => {
    trigger.addEventListener('click', () => {
      window.setTimeout(maybeLoad, 40);
    });
  });

  root.addEventListener('click', (event) => {
    const target = event.target as HTMLElement | null;
    const refresh = target?.closest('[data-learning-refresh]');
    if (refresh) {
      loadLearning(root).catch(() => undefined);
      return;
    }
    const action = target?.closest<HTMLElement>('[data-learning-action]');
    if (!action) return;
    const candidateId = action.getAttribute('data-learning-id') || '';
    const actionId = action.getAttribute('data-learning-action') || '';
    if (candidateId && actionId) {
      executeLearningAction(root, candidateId, actionId).catch(() => undefined);
    }
  });

  maybeLoad();
}
