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

function phaseStatus(summary: LearningSummary = {}, memory?: MemoryStatusPayload) {
  const recent = (memory?.summary?.episodic || 0) + (summary.total || 0);
  const patterns = (memory?.summary?.procedural || 0) + (summary.highConfidence || 0);
  const trusted = (summary.promoted || 0) + (summary.published || 0);
  return [
    {
      id: 'light',
      label: 'Light',
      text: recent > 0 ? `${recent} signal(s) ready to inspect` : 'Waiting for useful activity',
      active: recent > 0,
    },
    {
      id: 'rem',
      label: 'REM',
      text: patterns > 0 ? `${patterns} pattern(s) detected` : 'No repeated pattern yet',
      active: patterns > 0,
    },
    {
      id: 'deep',
      label: 'Deep',
      text: trusted > 0 ? `${trusted} trusted memory item(s)` : 'Nothing promoted silently',
      active: trusted > 0,
    },
  ];
}

function renderPhases(summary: LearningSummary, memory?: MemoryStatusPayload) {
  return phaseStatus(summary, memory).map((phase) => `
    <button class="learning-phase ${phase.active ? 'is-active' : ''}" type="button" data-learning-phase="${escapeHtml(phase.id)}">
      <span>${escapeHtml(phase.label)}</span>
      <small>${escapeHtml(phase.text)}</small>
    </button>
  `).join('');
}

function renderCandidates(candidates: LearningCandidate[]) {
  const top = candidates.slice(0, 5);
  if (top.length === 0) {
    return `
      <div class="learning-empty">
        <strong>No learning candidates yet</strong>
        <span>After useful work, Zavorth will suggest what can become memory, a procedure, or a reusable skill.</span>
      </div>
    `;
  }
  return top.map((candidate) => {
    const state = String(candidate.lifecycle || candidate.reviewState || 'draft').replace(/_/g, ' ');
    const steps = Array.isArray(candidate.steps) ? candidate.steps.slice(0, 3) : [];
    const canPromote = candidate.reviewState !== 'rejected' && candidate.lifecycle !== 'trusted_local' && candidate.lifecycle !== 'published';
    const sourceKind = String((candidate.source as any)?.sourceKind || '').trim();
    const sourceSurface = String((candidate.source as any)?.sourceSurface || candidate.source?.workflow || 'runtime').trim();
    const trustLevel = String((candidate.source as any)?.trustLevel || '').trim();
    return `
      <article class="learning-candidate" data-learning-candidate="${escapeHtml(candidate.id)}">
        <div class="learning-candidate__main">
          <span>${escapeHtml(candidate.kind || 'learning')}${sourceKind === 'lifecycle-hook' ? ' - hook' : ''}</span>
          <strong>${escapeHtml(candidate.title || 'Learning candidate')}</strong>
          <p>${escapeHtml(candidate.summary || candidate.source?.objective || 'Review before this changes future behavior.')}</p>
          <div class="learning-candidate__meta">${escapeHtml(sourceSurface)}${trustLevel ? ` - ${escapeHtml(trustLevel)}` : ''}</div>
          ${steps.length ? `<ol>${steps.map((step) => `<li>${escapeHtml(step)}</li>`).join('')}</ol>` : ''}
        </div>
        <div class="learning-candidate__side">
          <small>${escapeHtml(confidenceLabel(candidate.score))}</small>
          <em>${escapeHtml(state)}</em>
          <div class="learning-candidate__actions">
            <button type="button" data-learning-action="approve" data-learning-id="${escapeHtml(candidate.id)}">Keep</button>
            ${canPromote ? `<button type="button" data-learning-action="promote" data-learning-id="${escapeHtml(candidate.id)}">Trust</button>` : ''}
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
          <p>Review what Zavorth wants to remember or promote.</p>
        </div>
        <button class="daily-button daily-button--primary" type="button" data-learning-refresh>Refresh</button>
      </section>
      <section class="daily-stat-row" aria-label="Learning summary">
        <article class="daily-metric"><span>Review</span><strong>${numberLabel(summary.pending)}</strong><small>waiting</small></article>
        <article class="daily-metric"><span>Trusted</span><strong>${numberLabel(summary.promoted)}</strong><small>promoted</small></article>
        <article class="daily-metric"><span>Hooks</span><strong>${numberLabel(summary.fromHooks)}</strong><small>session signals</small></article>
      </section>

      <section class="learning-phases" aria-label="Learning phases">
        ${renderPhases(summary, memory)}
      </section>

      <section class="daily-panel learning-review" aria-label="Learning review">
        <div class="daily-panel__head learning-review__header">
          <div>
            <span>Review queue</span>
            <h3>What Zavorth wants to remember</h3>
          </div>
        </div>
        <div class="learning-candidates">
          ${renderCandidates(candidates)}
        </div>
      </section>

      <footer class="learning-footer">
        <span>Updated ${escapeHtml(updated)}</span>
        <span>${memory?.summary
          ? `Memory layers: ${numberLabel(memory.summary.episodic)} episodic, ${numberLabel(memory.summary.semantic)} semantic, ${numberLabel(memory.summary.procedural)} procedural`
          : learning.memory?.summary
            ? `Memory layers: ${numberLabel(learning.memory.summary.episodic)} episodic, ${numberLabel(learning.memory.summary.semantic)} semantic, ${numberLabel(learning.memory.summary.procedural)} procedural`
            : 'Memory is ready for reviewed learning.'}</span>
      </footer>
    </div>
  `;
}

function renderLearningError(root: HTMLElement, error: unknown) {
  root.innerHTML = `
    <div class="daily-page learning-shell">
      <section class="daily-header">
        <div>
          <span class="daily-kicker">Locked</span>
          <h1>Learning needs access</h1>
          <p>${escapeHtml(String((error as Error)?.message || 'Unlock this dashboard with the local token to review learning candidates.'))}</p>
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
          <p>Review memory and skill suggestions before they change future behavior.</p>
        </div>
        <button class="daily-button daily-button--primary" type="button" data-learning-refresh>Refresh</button>
      </section>
      <div class="learning-loading">Checking learning...</div>
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
      memory: {
        summary: 'Learning service is warming up. Zavorth will show candidates here after completed work.',
      },
    });
    window.emitSignal?.('info', 'Learning warming up', String((error as Error)?.message || 'The learning service is not ready yet.'));
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
