import { escapeHtml } from './html-utils';
import {
  renderA2UICanvasHtml,
  selectA2UISurface,
  type A2UISnapshot,
  type A2UIStreamSnapshot,
} from './a2ui-renderer';

type EngineId = 'lite' | 'velocity' | 'shield';

type EnginePolicy = {
  id: EngineId;
  label: string;
  audience: string;
  latencyTarget: string;
  sandboxPolicy: string;
  approvalPolicy: string;
  diffPolicy: string;
  traceVisibility: string;
  summary: string;
  allowedActions: string[];
  blockedActions: string[];
};

type EngineAvailability = {
  engineId: EngineId;
  available: boolean;
  reason: string | null;
  nextSafeAction: string | null;
};

type EngineSnapshot = {
  ok: boolean;
  activeEngineId: EngineId;
  policies: EnginePolicy[];
  availability: EngineAvailability[];
  traces?: Array<Record<string, any>>;
  decision?: {
    engineId: EngineId;
    mode: string;
    status: string;
    express: boolean;
    reason: string;
    nextSafeAction: string;
  } | null;
};

type TrustedWorkspacePolicy = {
  id: string;
  path: string;
  label: string;
  state: string;
};

type CanvasAttempt = {
  id: string;
  round: number;
  status: string;
  summary: string;
  diffs: string[];
  logs: string[];
  previewUrl: string | null;
};

type CanvasSession = {
  sessionId: string;
  engineId: EngineId;
  attempts: CanvasAttempt[];
  activeAttemptId: string | null;
  previewUrl: string | null;
  diffs: string[];
  logs: string[];
  egressEvents: Array<{ id: string; url: string; reason: string }>;
};

type A2UIRuntimeState = {
  snapshot: A2UISnapshot;
  stream: A2UIStreamSnapshot | null;
};

declare global {
  interface Window {
    emitSignal?: (type: string, title: string, message?: string) => void;
    ZavorthLocale?: { t?: (value: string) => string };
    ZavorthRuntimeEngines?: {
      getActiveEngineId: () => EngineId;
      decidePrompt: (prompt: string, options?: { operation?: string; targetPath?: string | null }) => Promise<EngineSnapshot | undefined>;
      recommendCanvas: (prompt: string, options?: { autoOpen?: boolean; reason?: string }) => Promise<boolean>;
      requestNaturalEngineSwitch: (prompt: string) => Promise<boolean>;
      selectEngine: (engineId: EngineId) => Promise<EngineSnapshot>;
    };
    ZavorthControlChat?: {
      ingestRuntimeEvents?: (events: Array<Record<string, any>>, options?: Record<string, any>) => void;
      recordTraceEvent?: (event: Record<string, any>) => void;
      openTraceSheet?: (query?: Record<string, any>) => void;
    };
  }
}

let cachedEngineSnapshot: EngineSnapshot | null = null;
let cachedCanvasSession: CanvasSession | null = null;
let cachedA2UIState: A2UIRuntimeState | null = null;
let cachedA2UISurfaceId: string | null = null;
const ENGINE_STORAGE_KEY = 'zavorth.control.engine';

class TransportFallbackError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TransportFallbackError';
  }
}

function isTransportFallbackError(error: unknown): boolean {
  return error instanceof TransportFallbackError
    || String((error as Error)?.name || '').trim() === 'TransportFallbackError';
}

function errorMessage(value: unknown, fallback = 'Request failed.'): string {
  if (value instanceof Error && value.message) return value.message;
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const direct = record.error || record.message || record.reason;
    if (typeof direct === 'string' && direct.trim()) return direct.trim();
    try {
      return JSON.stringify(value);
    } catch {
      return fallback;
    }
  }
  return fallback;
}

function readStoredEngineId(): EngineId | null {
  try {
    const value = window.localStorage?.getItem(ENGINE_STORAGE_KEY);
    return value === 'lite' || value === 'velocity' || value === 'shield' ? value : null;
  } catch {
    return null;
  }
}

function persistEngineId(engineId: EngineId) {
  try {
    window.localStorage?.setItem(ENGINE_STORAGE_KEY, engineId);
  } catch {
    // Ignore storage failures; the runtime remains the source of truth.
  }
}

function localDecisionForPrompt(body: Record<string, any>, activeEngineId: EngineId) {
  const prompt = String(body.prompt || '').toLowerCase();
  const operation = String(body.operation || '').toLowerCase();
  const risky = /\b(rm\s+-rf|delete|remove|secret|token|deploy|publish|payment|external|network|shell|terminal)\b/.test(prompt)
    || ['delete', 'shell', 'network', 'deploy', 'transaction'].includes(operation);
  const write = risky || /\b(create|edit|write|modify|patch|apply|rename|move|criar|editar|alterar)\b/.test(prompt)
    || operation === 'write';
  if (risky || write) {
    return {
      engineId: 'shield',
      mode: 'sandbox',
      status: 'needs-approval',
      express: false,
      reason: 'Local decision selected Shield for risky or mutating work.',
      nextSafeAction: 'Review in Shield before changing files, tools, or external state.',
    };
  }
  return {
    engineId: activeEngineId,
    mode: 'express',
    status: 'ready',
    express: true,
    reason: 'Local UI fallback selected Express.',
    nextSafeAction: 'Start streaming immediately.',
  };
}

function localFallbackJson<T>(url: string, init?: RequestInit): T {
  const body = typeof init?.body === 'string' ? JSON.parse(init.body || '{}') : {};
  if (url.includes('/api/web/execution-engines')) {
    const activeEngineId = (body.engineId || cachedEngineSnapshot?.activeEngineId || readStoredEngineId() || 'lite') as EngineId;
    return {
      ok: true,
      activeEngineId,
      policies: [
        { id: 'lite', label: 'Zavorth Lite', audience: 'personal', latencyTarget: 'instant', sandboxPolicy: 'none', approvalPolicy: 'none', diffPolicy: 'not-applicable', traceVisibility: 'hidden', summary: 'Fast chat, documents and API help without touching the operating system.', allowedActions: [], blockedActions: [] },
        { id: 'velocity', label: 'Zavorth Velocity', audience: 'developer', latencyTarget: 'fast', sandboxPolicy: 'trusted-workspace-only', approvalPolicy: 'risk-based', diffPolicy: 'interactive-direct-if-trusted', traceVisibility: 'compact-operational', summary: 'Fast review and apply for simple work inside trusted folders. Runtime policy keeps final execution authority.', allowedActions: [], blockedActions: [] },
        { id: 'shield', label: 'Zavorth Shield', audience: 'business', latencyTarget: 'governed', sandboxPolicy: 'sandbox-required', approvalPolicy: 'always-for-impact', diffPolicy: 'interactive-approval-required', traceVisibility: 'full-operational', summary: 'Sandbox, policy broker, approvals and receipts.', allowedActions: [], blockedActions: [] },
      ],
      availability: [
        { engineId: 'lite', available: true, reason: null, nextSafeAction: null },
        { engineId: 'velocity', available: true, reason: null, nextSafeAction: null },
        { engineId: 'shield', available: true, reason: null, nextSafeAction: null },
      ],
      decision: body.action === 'decide'
        ? localDecisionForPrompt(body, activeEngineId)
        : null,
    } as T;
  }
  if (url.includes('/api/web/trusted-workspaces')) {
    return { ok: true, policies: [] } as T;
  }
  if (url.includes('/api/web/canvas/session')) {
    const html = encodeURIComponent('<!doctype html><html><body style="margin:0;display:grid;place-items:center;min-height:100vh;background:#07140f;color:#effaf3;font-family:system-ui"><main style="text-align:center"><p style="color:#00e88f;text-transform:uppercase;letter-spacing:.12em">Sandbox preview</p><h1>Z-Canvas is ready</h1><p>Preview, diffs and logs stay isolated before host apply.</p></main></body></html>');
    const session: CanvasSession = cachedCanvasSession || {
      sessionId: 'canvas:local-fallback',
      engineId: 'lite',
      activeAttemptId: 'attempt:1',
      previewUrl: `data:text/html;charset=utf-8,${html}`,
      attempts: [{ id: 'attempt:1', round: 1, status: 'ready', summary: 'Local sandbox preview', diffs: [], logs: ['Canvas UI fallback is active.'], previewUrl: `data:text/html;charset=utf-8,${html}` }],
      diffs: [],
      logs: ['Canvas UI fallback is active.'],
      egressEvents: [],
    };
    return { ok: true, session } as T;
  }
  if (url.includes('/api/web/diff/review')) {
    return { ok: true, review: { status: 'recorded', summary: 'Diff decision recorded locally.' } } as T;
  }
  if (url.includes('/api/v2/a2ui/snapshot')) {
    return {
      ok: true,
      data: {
        generatedAt: new Date().toISOString(),
        protocolVersion: 'a2ui.v1',
        capabilities: ['snapshot', 'action', 'event', 'stream', 'asset'],
        allowedComponents: [],
        surfaceId: null,
        surfaces: [],
        commands: {
          snapshot: '/api/v2/a2ui/snapshot',
          action: '/api/v2/a2ui/action',
          events: '/api/v2/a2ui/events',
          stream: '/api/v2/a2ui/stream',
          assets: '/api/v2/a2ui/assets',
        },
      },
    } as T;
  }
  if (url.includes('/api/v2/a2ui/stream')) {
    return {
      ok: true,
      data: {
        generatedAt: new Date().toISOString(),
        protocolVersion: 'a2ui.v1',
        surfaceId: null,
        items: [],
      },
    } as T;
  }
  throw new Error(`No local fallback for ${url}`);
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  if (typeof window.fetch !== 'function' && typeof XMLHttpRequest === 'undefined') {
    return localFallbackJson<T>(url, init);
  }
  if (typeof window.fetch !== 'function') {
    return new Promise<T>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open(init?.method || 'GET', url, true);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.onload = () => {
        let payload: any = null;
        try {
          payload = JSON.parse(xhr.responseText || '{}');
        } catch {
          reject(new Error(`Invalid JSON response from ${url}`));
          return;
        }
        if (xhr.status >= 400 || payload?.ok === false) {
          reject(new Error(errorMessage(payload?.error || payload?.selection?.availability?.reason, `Request failed: ${xhr.status}`)));
          return;
        }
        resolve(payload as T);
      };
      xhr.onerror = () => reject(new TransportFallbackError(`Network request failed: ${url}`));
      xhr.send(typeof init?.body === 'string' ? init.body : null);
    });
  }
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers || {}),
      },
    });
  } catch (error) {
    throw new TransportFallbackError(errorMessage(error, `Network request failed: ${url}`));
  }
  let payload: any = null;
  try {
    payload = await response.json();
  } catch {
    if (response.ok) return localFallbackJson<T>(url, init);
    throw new Error(`Request failed: ${response.status}`);
  }
  if (!response.ok || payload?.ok === false) {
    throw new Error(errorMessage(payload?.error || payload?.selection?.availability?.reason, `Request failed: ${response.status}`));
  }
  return payload as T;
}

function availabilityFor(snapshot: EngineSnapshot, engineId: EngineId): EngineAvailability {
  return snapshot.availability.find((entry) => entry.engineId === engineId) ?? {
    engineId,
    available: false,
    reason: 'Availability unknown.',
    nextSafeAction: 'Use Shield.',
  };
}

function t(value: string): string {
  return window.ZavorthLocale?.t?.(value) || value;
}

function traceTypeFromEngineKind(kind: unknown): string {
  const normalized = String(kind || '').toLowerCase();
  if (normalized === 'receipt') return 'receipt';
  if (normalized === 'approval') return 'approval';
  if (normalized === 'egress-blocked') return 'error';
  if (normalized === 'canvas') return 'artifact';
  return 'step';
}

function ingestEngineTraces(events: Array<Record<string, any>> = []) {
  if (!events.length) return;
  const mapped = events.map((event) => ({
    id: event.id,
    type: traceTypeFromEngineKind(event.kind),
    title: event.title || event.kind || 'Runtime event',
    detail: event.detail || '',
    status: event.status || '',
    createdAt: event.createdAt,
    meta: [
      event.engineId ? `engine:${event.engineId}` : '',
      event.metadata?.targetPath ? `file:${event.metadata.targetPath}` : '',
      event.metadata?.policy ? `policy:${event.metadata.policy}` : '',
    ].filter(Boolean).join(' · '),
    receipt: event.kind === 'receipt'
      ? {
        id: event.id,
        status: event.status || 'recorded',
        summary: event.detail,
        artifact: event.metadata?.targetPath,
        rollback: event.metadata?.beforeHash ? 'hash-backed replay available' : '',
      }
      : null,
    replay: {
      runId: event.metadata?.runId || '',
      traceId: event.id || '',
      sessionId: event.metadata?.sessionId || '',
      policy: event.metadata?.policy || event.engineId || '',
    },
  }));
  if (typeof window.ZavorthControlChat?.ingestRuntimeEvents === 'function') {
    window.ZavorthControlChat.ingestRuntimeEvents(mapped, { source: 'runtime-engines' });
    return;
  }
  mapped.forEach((event) => window.ZavorthControlChat?.recordTraceEvent?.(event));
}

function engineShortLabel(engineId: EngineId, fallback: string): string {
  if (engineId === 'lite') return t('Chat');
  if (engineId === 'velocity') return t('Fast');
  if (engineId === 'shield') return t('Safe');
  return fallback;
}

function engineModeLabel(engineId: EngineId, fallback: string): string {
  const label = `${engineShortLabel(engineId, fallback)} mode`;
  return t(label);
}

function engineSummaryLabel(policy: EnginePolicy): string {
  const fallback = policy.id === 'lite'
    ? 'Fast chat and documents. No system changes.'
    : policy.id === 'velocity'
      ? 'Fast diffs in trusted folders.'
      : 'Sandbox and approval for risky work.';
  return t(fallback);
}

function engineLatencyLabel(value: string): string {
  if (value === 'instant') return t('Instant');
  if (value === 'fast') return t('Fast');
  if (value === 'governed') return t('Governed');
  return t(value);
}

function engineButtonLabel(active: boolean, available: boolean, compact = false): string {
  if (active) return t('Active');
  if (!available) return t('Locked');
  return compact ? t('Use') : t('Use engine');
}

function shouldRecommendCanvas(prompt: string, snapshot?: EngineSnapshot | null): boolean {
  const text = prompt.toLowerCase();
  const visualWork = /\b(canvas|preview|ui|ux|interface|layout|screen|mobile|desktop|website|site|page|component|react|vite|css|animation|visual|diff|iframe|mockup|dashboard)\b/.test(text);
  const mutatingWork = Boolean(snapshot?.decision && !snapshot.decision.express);
  return visualWork || mutatingWork;
}

function engineStatusLabel(snapshot: EngineSnapshot): string {
  const active = snapshot.policies.find((policy) => policy.id === snapshot.activeEngineId);
  const activeLabel = engineShortLabel(snapshot.activeEngineId, active?.label || snapshot.activeEngineId);
  const decision = snapshot.decision;
  if (!decision) return activeLabel;
  if (decision.express) return `Express · ${activeLabel}`;
  if (decision.engineId !== snapshot.activeEngineId) {
    return `${engineShortLabel(decision.engineId, decision.engineId)} required`;
  }
  if (decision.mode === 'trusted-workspace') return `Trusted · ${activeLabel}`;
  if (decision.mode === 'sandbox') return `Sandbox · ${activeLabel}`;
  if (decision.status === 'needs-approval') return `Approval · ${activeLabel}`;
  return activeLabel;
}

function localizedEngineStatusLabel(snapshot: EngineSnapshot): string {
  const active = snapshot.policies.find((policy) => policy.id === snapshot.activeEngineId);
  const activeLabel = engineShortLabel(snapshot.activeEngineId, active?.label || snapshot.activeEngineId);
  const decision = snapshot.decision;
  if (!decision) return activeLabel;
  if (decision.express) return `${t('Express')} - ${activeLabel}`;
  if (decision.engineId !== snapshot.activeEngineId) {
    return `${engineShortLabel(decision.engineId, decision.engineId)} ${t('required')}`;
  }
  if (decision.mode === 'trusted-workspace') return `${t('Trusted')} - ${activeLabel}`;
  if (decision.mode === 'sandbox') return `${t('Sandbox')} - ${activeLabel}`;
  if (decision.status === 'needs-approval') return `${t('Approval')} - ${activeLabel}`;
  return activeLabel;
}

function summarizeCanvasAttempt(session: CanvasSession, attempt: CanvasAttempt | null) {
  const diffCount = attempt?.diffs?.length || session.diffs.length || 0;
  const logCount = attempt?.logs?.length || session.logs.length || 0;
  const blockedCount = session.egressEvents.length;
  const status = attempt?.status || 'ready';
  const action = diffCount > 0
    ? 'Review the diff before applying.'
    : status === 'failed' || status === 'blocked'
      ? 'Inspect the failed attempt before continuing.'
      : 'Preview is isolated; no host files changed.';
  return { diffCount, logCount, blockedCount, action };
}

function updateExpressPill(snapshot: EngineSnapshot) {
  const pill = document.getElementById('engine-mode-pill');
  const active = snapshot.policies.find((policy) => policy.id === snapshot.activeEngineId);
  document.querySelectorAll('[data-runtime-engine-active]').forEach((node) => {
    node.textContent = engineShortLabel(snapshot.activeEngineId, active?.label || snapshot.activeEngineId);
  });
  document.querySelectorAll('[data-engine-select]').forEach((node) => {
    const selected = node.getAttribute('data-engine-select') === snapshot.activeEngineId;
    node.classList.toggle('is-selected', selected);
    node.setAttribute('aria-pressed', selected ? 'true' : 'false');
  });
  if (!pill) return;
  const decision = snapshot.decision;
  pill.textContent = localizedEngineStatusLabel(snapshot);
  pill.classList.toggle('is-express', Boolean(decision?.express));
  pill.classList.toggle('is-promoted', Boolean(decision && decision.engineId !== snapshot.activeEngineId));
  if (decision?.reason) {
    pill.setAttribute('title', decision.reason);
  } else {
    pill.removeAttribute('title');
  }
}
function renderEngineCards(snapshot: EngineSnapshot) {
  const root = document.querySelector('[data-runtime-engine-cards]');
  if (!root) return;
  const compact = root.getAttribute('data-runtime-engine-layout') === 'compact';
  root.innerHTML = snapshot.policies.map((policy) => {
    const availability = availabilityFor(snapshot, policy.id);
    const active = snapshot.activeEngineId === policy.id;
    if (compact) {
      return `
        <article class="runtime-engine-row ${active ? 'is-active' : ''} ${availability.available ? '' : 'is-locked'}">
          <div class="runtime-engine-row__copy">
            <span>${escapeHtml(policy.audience)}</span>
            <strong>${escapeHtml(engineModeLabel(policy.id, policy.label))}</strong>
            <p>${escapeHtml(engineSummaryLabel(policy))}</p>
            ${availability.available ? '' : `<small>${escapeHtml(t(availability.reason || 'Locked by policy.'))}</small>`}
          </div>
          <div class="runtime-engine-row__state">
            <span>${escapeHtml(engineLatencyLabel(policy.latencyTarget))}</span>
            <button type="button" data-engine-select="${policy.id}" ${availability.available ? '' : 'disabled'}>
              ${engineButtonLabel(active, availability.available, true)}
            </button>
          </div>
        </article>
      `;
    }
    return `
      <article class="runtime-engine-card ${active ? 'is-active' : ''} ${availability.available ? '' : 'is-locked'}">
        <div class="runtime-engine-card__head">
          <span>${escapeHtml(policy.audience)}</span>
          <strong>${escapeHtml(policy.label)}</strong>
        </div>
        <p>${escapeHtml(engineSummaryLabel(policy))}</p>
        ${policy.id === 'velocity' ? `<small class="runtime-engine-card__authority">${escapeHtml(t('Dashboard reviews; runtime policy decides execution.'))}</small>` : ''}
        <div class="runtime-engine-card__facts">
          <span>${escapeHtml(engineLatencyLabel(policy.latencyTarget))}</span>
        </div>
        ${availability.available ? '' : `<small class="runtime-engine-card__lock">${escapeHtml(t(availability.reason || 'Locked by policy.'))}</small>`}
        <button type="button" data-engine-select="${policy.id}" ${availability.available ? '' : 'disabled'}>
          ${engineButtonLabel(active, availability.available)}
        </button>
      </article>
    `;
  }).join('');
}

async function loadEngines() {
  try {
    cachedEngineSnapshot = await fetchJson<EngineSnapshot>('/api/web/execution-engines');
  } catch (error) {
    if (!isTransportFallbackError(error)) throw error;
    cachedEngineSnapshot = localFallbackJson<EngineSnapshot>('/api/web/execution-engines');
  }
  ingestEngineTraces(cachedEngineSnapshot.traces || []);
  persistEngineId(cachedEngineSnapshot.activeEngineId);
  renderEngineCards(cachedEngineSnapshot);
  updateExpressPill(cachedEngineSnapshot);
}

async function selectEngine(engineId: EngineId) {
  const request = {
    method: 'POST',
    body: JSON.stringify({ engineId }),
  };
  try {
    cachedEngineSnapshot = await fetchJson<EngineSnapshot>('/api/web/execution-engines', request);
  } catch (error) {
    if (!isTransportFallbackError(error)) throw error;
    cachedEngineSnapshot = localFallbackJson<EngineSnapshot>('/api/web/execution-engines', request);
  }
  ingestEngineTraces(cachedEngineSnapshot.traces || []);
  persistEngineId(cachedEngineSnapshot.activeEngineId);
  renderEngineCards(cachedEngineSnapshot);
  updateExpressPill(cachedEngineSnapshot);
  window.emitSignal?.('success', 'Engine updated', `${engineShortLabel(engineId, engineId)} is now active.`);
  return cachedEngineSnapshot;
}

async function decidePrompt(prompt: string, options: { operation?: string; targetPath?: string | null } = {}) {
  if (!prompt.trim()) return;
  const body = JSON.stringify({
      action: 'decide',
      prompt,
      operation: options.operation,
      targetPath: options.targetPath,
      engineId: cachedEngineSnapshot?.activeEngineId,
  });
  try {
    cachedEngineSnapshot = await fetchJson<EngineSnapshot>('/api/web/execution-engines', {
      method: 'POST',
      body,
    });
  } catch (error) {
    if (!isTransportFallbackError(error)) throw error;
    cachedEngineSnapshot = localFallbackJson<EngineSnapshot>('/api/web/execution-engines', {
      method: 'POST',
      body,
    });
  }
  ingestEngineTraces(cachedEngineSnapshot.traces || cachedEngineSnapshot.decision?.events || []);
  renderEngineCards(cachedEngineSnapshot);
  updateExpressPill(cachedEngineSnapshot);
  if (cachedEngineSnapshot.decision) {
    document.dispatchEvent(new CustomEvent('zavorth:engine-decision', {
      detail: cachedEngineSnapshot.decision,
    }));
    renderEnginePromotionConfirmation(cachedEngineSnapshot);
  }
  if (shouldRecommendCanvas(prompt, cachedEngineSnapshot)) {
    renderCanvasRecommendation(prompt, cachedEngineSnapshot);
  }
  return cachedEngineSnapshot;
}

async function decideCurrentPrompt() {
  const input = document.getElementById('compose-input');
  const prompt = input instanceof HTMLTextAreaElement || input instanceof HTMLInputElement ? input.value : '';
  return decidePrompt(prompt);
}

function requestedEngineFromText(prompt: string): EngineId | null {
  const text = prompt.trim().toLowerCase();
  if (!/\b(use|switch|change|select|activate|ativar|usar|trocar|mudar|selecionar|cambiar)\b/.test(text)) return null;
  if (/\b(velocity|velocidade|developer|dev|fast)\b/.test(text)) return 'velocity';
  if (/\b(shield|safe|seguro|segurança|governed|business|enterprise)\b/.test(text)) return 'shield';
  if (/\b(lite|personal|simples|light|leve)\b/.test(text)) return 'lite';
  return null;
}

function renderEngineSwitchConfirmation(engineId: EngineId, availability: EngineAvailability): boolean {
  const terminalView = document.getElementById('terminal-view');
  const label = engineShortLabel(engineId, engineId);
  const locked = !availability.available;
  const message = locked
    ? `${label} ${t('is locked by policy.')} ${t(availability.reason || availability.nextSafeAction || 'Use another engine.')}`
    : `${t('Switch to')} ${label}? ${t('Runtime policy still decides what can execute.')}`;
  const unlock = locked && /auth|token|unlock/i.test(`${availability.reason || ''} ${availability.nextSafeAction || ''}`);
  const html = `
    <div class="engine-switch-card b-fade-in" data-engine-switch-card data-engine-id="${engineId}">
      <div>
        <span>${locked ? t('Engine locked') : t('Engine switch')}</span>
        <strong>${escapeHtml(message)}</strong>
      </div>
      <div class="engine-switch-card__actions">
        ${locked ? '' : `<button type="button" data-engine-switch-confirm="${engineId}">${t('Switch')}</button>`}
        ${unlock ? `<button type="button" data-engine-switch-unlock>${t('Unlock runtime')}</button>` : ''}
        <button type="button" data-engine-switch-dismiss>${t('Keep current')}</button>
      </div>
    </div>
  `;
  if (terminalView) {
    terminalView.insertAdjacentHTML('beforeend', html);
    terminalView.scrollTop = terminalView.scrollHeight;
  } else {
    window.emitSignal?.(locked ? 'info' : 'success', locked ? 'Engine locked' : 'Engine switch', message);
  }
  return true;
}

function renderEnginePromotionConfirmation(snapshot: EngineSnapshot): boolean {
  const decision = snapshot.decision;
  if (!decision || decision.engineId === snapshot.activeEngineId || decision.express) return false;
  const terminalView = document.getElementById('terminal-view');
  if (!terminalView) return false;
  if (terminalView.querySelector(`[data-engine-promotion-card][data-engine-id="${decision.engineId}"]`)) return true;
  const availability = availabilityFor(snapshot, decision.engineId);
  const label = engineShortLabel(decision.engineId, decision.engineId);
  const locked = !availability.available;
  const unlock = locked && /auth|token|unlock/i.test(`${availability.reason || ''} ${availability.nextSafeAction || ''}`);
  const message = locked
    ? `${label} ${t('is required, but locked.')} ${t(availability.reason || availability.nextSafeAction || 'Unlock runtime to continue safely.')}`
    : `${t('This needs')} ${label}. ${t('Continue safely?')}`;
  const detail = decision.nextSafeAction || decision.reason || '';
  terminalView.insertAdjacentHTML('beforeend', `
    <div class="engine-switch-card b-fade-in" data-engine-promotion-card data-engine-id="${decision.engineId}">
      <div>
        <span>${t('Engine promotion')}</span>
        <strong>${escapeHtml(message)}</strong>
        ${detail ? `<small>${escapeHtml(t(detail))}</small>` : ''}
      </div>
      <div class="engine-switch-card__actions">
        ${locked ? '' : `<button type="button" data-engine-promote-confirm="${decision.engineId}">${escapeHtml(t(`Continue with ${label}`))}</button>`}
        ${unlock ? `<button type="button" data-engine-switch-unlock>${t('Unlock runtime')}</button>` : ''}
        <button type="button" data-engine-switch-dismiss>${t('Keep current')}</button>
      </div>
    </div>
  `);
  terminalView.scrollTop = terminalView.scrollHeight;
  return true;
}

function renderCanvasRecommendation(prompt: string, snapshot: EngineSnapshot): boolean {
  const terminalView = document.getElementById('terminal-view');
  if (!terminalView) return false;
  if (terminalView.querySelector('[data-canvas-recommendation-card]')) return true;
  const decision = snapshot.decision;
  const engine = decision?.engineId || snapshot.activeEngineId;
  const detail = decision?.nextSafeAction || 'Open a sandbox preview before applying visual or file changes.';
  terminalView.insertAdjacentHTML('beforeend', `
    <div class="engine-switch-card b-fade-in" data-canvas-recommendation-card>
      <div>
        <span>${escapeHtml(t('Canvas recommended'))}</span>
        <strong>${escapeHtml(t('Preview this safely before applying.'))}</strong>
        <small>${escapeHtml(t(detail))}</small>
      </div>
      <div class="engine-switch-card__actions">
        <button type="button" data-canvas-open-recommended data-canvas-prompt="${escapeHtml(prompt)}" data-canvas-engine="${escapeHtml(engine)}">${escapeHtml(t('Open Canvas'))}</button>
        <button type="button" data-engine-switch-dismiss>${escapeHtml(t('Keep in chat'))}</button>
      </div>
    </div>
  `);
  terminalView.scrollTop = terminalView.scrollHeight;
  return true;
}

function promptShouldUseCanvas(prompt: string): boolean {
  return /\b(canvas|preview|visual|ui|ux|interface|layout|screen|page|site|website|frontend|react|vite|css|html|style|design|figma|diff|patch|component|tela|apar[eê]ncia|visual|p[aá]gina|estilo)\b/i.test(prompt);
}

export async function recommendCanvasForPrompt(prompt: string, options: { autoOpen?: boolean; reason?: string } = {}): Promise<boolean> {
  const cleanPrompt = String(prompt || '').trim();
  if (!cleanPrompt) return false;
  if (!promptShouldUseCanvas(cleanPrompt) && !options.autoOpen) return false;
  if (!cachedEngineSnapshot) {
    await loadEngines().catch(() => undefined);
  }
  const snapshot = cachedEngineSnapshot || localFallbackJson<EngineSnapshot>('/api/web/execution-engines');
  const rendered = renderCanvasRecommendation(options.reason || cleanPrompt, snapshot);
  window.ZavorthControlChat?.recordTraceEvent?.({
    type: 'step',
    title: options.autoOpen ? 'Canvas opened' : 'Canvas recommended',
    detail: options.reason || 'Visual, preview, or diff work is safer in the sandbox canvas.',
    meta: snapshot.activeEngineId,
    status: options.autoOpen ? 'running' : 'queued',
  });
  if (options.autoOpen) {
    await openCanvasFromRecommendation();
    document.querySelector('[data-canvas-recommendation-card]')?.remove();
  }
  return rendered || Boolean(options.autoOpen);
}

export async function requestNaturalEngineSwitch(prompt: string): Promise<boolean> {
  const engineId = requestedEngineFromText(prompt);
  if (!engineId) return false;
  if (!cachedEngineSnapshot) {
    await loadEngines();
  }
  const snapshot = cachedEngineSnapshot || localFallbackJson<EngineSnapshot>('/api/web/execution-engines');
  if (snapshot.activeEngineId === engineId) {
    window.emitSignal?.('info', 'Engine already active', `${engineShortLabel(engineId, engineId)} is already selected.`);
    return true;
  }
  return renderEngineSwitchConfirmation(engineId, availabilityFor(snapshot, engineId));
}

function renderTrustedWorkspaces(policies: TrustedWorkspacePolicy[]) {
  const root = document.querySelector('[data-trusted-workspaces-list]');
  if (!root) return;
  root.innerHTML = policies.length > 0
    ? policies.map((policy) => `
      <article class="trusted-workspace-card">
        <div>
          <strong>${escapeHtml(policy.label)}</strong>
          <span>${escapeHtml(policy.path)}</span>
        </div>
        <small>${escapeHtml(policy.state)}</small>
        <button type="button" data-trusted-workspace-remove="${escapeHtml(policy.id)}">Remove</button>
      </article>
    `).join('')
    : '<div class="trusted-workspace-empty">No trusted folders yet. Velocity can review quickly, but direct apply stays disabled until you trust a folder.</div>';
}

async function loadTrustedWorkspaces() {
  let payload: { ok: boolean; policies: TrustedWorkspacePolicy[] };
  try {
    payload = await fetchJson<{ ok: boolean; policies: TrustedWorkspacePolicy[] }>('/api/web/trusted-workspaces');
  } catch {
    payload = localFallbackJson<{ ok: boolean; policies: TrustedWorkspacePolicy[] }>('/api/web/trusted-workspaces');
  }
  renderTrustedWorkspaces(payload.policies);
}

async function addTrustedWorkspace(form: HTMLFormElement) {
  const formData = new FormData(form);
  const workspacePath = String(formData.get('path') || '').trim();
  if (!workspacePath) return;
  const payload = await fetchJson<{ ok: boolean; policies: TrustedWorkspacePolicy[] }>('/api/web/trusted-workspaces', {
    method: 'POST',
    body: JSON.stringify({
      path: workspacePath,
      label: String(formData.get('label') || '').trim() || undefined,
      state: String(formData.get('state') || 'trusted'),
    }),
  });
  form.reset();
  renderTrustedWorkspaces(payload.policies);
  window.emitSignal?.('success', 'Trusted folder added', 'Velocity can review and apply accepted low-risk diffs in this folder.');
}

function fileSystemEntryName(entry: any): string {
  return String(entry?.name || '').trim();
}

function droppedFolderPath(item: DataTransferItem, entry: any): string {
  const file = item.getAsFile();
  const directPath = String((file as any)?.path || '').trim();
  if (directPath) return directPath;
  const relative = String(file?.webkitRelativePath || '').trim();
  if (relative && relative.includes('/')) {
    return relative.split('/')[0] || relative;
  }
  return String(entry?.fullPath || '').trim().replace(/^\/+/, '');
}

async function removeTrustedWorkspace(id: string) {
  const payload = await fetchJson<{ ok: boolean; policies: TrustedWorkspacePolicy[] }>(`/api/web/trusted-workspaces/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  renderTrustedWorkspaces(payload.policies);
}

function activeAttempt(session: CanvasSession): CanvasAttempt | null {
  return session.attempts.find((attempt) => attempt.id === session.activeAttemptId) ?? session.attempts[0] ?? null;
}

function renderCanvas(session: CanvasSession) {
  const root = document.querySelector('[data-canvas-root]');
  if (!root) return;
  const a2uiHtml = cachedA2UIState
    ? renderA2UICanvasHtml({
      snapshot: cachedA2UIState.snapshot,
      stream: cachedA2UIState.stream,
      activeSurfaceId: cachedA2UISurfaceId,
    })
    : null;
  if (a2uiHtml) {
    root.innerHTML = a2uiHtml;
    return;
  }
  const attempt = activeAttempt(session);
  const summary = summarizeCanvasAttempt(session, attempt);
  const timeline = session.attempts.map((item) => `
    <button type="button" class="${item.id === session.activeAttemptId ? 'is-active' : ''}" data-canvas-attempt="${escapeHtml(item.id)}">
      ${item.round}
    </button>
  `).join('');
  root.innerHTML = `
    <div class="z-canvas-topbar">
      <div>
        <span>${escapeHtml(t('Z-Canvas'))}</span>
        <strong>${escapeHtml(engineShortLabel(session.engineId, session.engineId))} · ${escapeHtml(t(attempt?.status || 'ready'))}</strong>
        <small>${escapeHtml(t(summary.action))}</small>
      </div>
      <div class="z-canvas-timeline" aria-label="Canvas attempts">${timeline}</div>
      <div class="z-canvas-actions">
        <button type="button" data-canvas-create-attempt>${escapeHtml(t('New attempt'))}</button>
        <button type="button" data-canvas-diff-action="accept-file">${escapeHtml(t('Accept diff'))}</button>
        <button type="button" data-canvas-diff-action="reject-hunk">${escapeHtml(t('Reject hunk'))}</button>
      </div>
    </div>
    <div class="z-canvas-story" aria-label="Canvas status">
      <span><strong>${session.attempts.length}</strong>${escapeHtml(t('attempts'))}</span>
      <span><strong>${summary.diffCount}</strong>${escapeHtml(t('diffs'))}</span>
      <span><strong>${summary.logCount}</strong>${escapeHtml(t('logs'))}</span>
      <span class="${summary.blockedCount ? 'is-warning' : ''}"><strong>${summary.blockedCount}</strong>${escapeHtml(t('blocked requests'))}</span>
    </div>
    <div class="z-canvas-layout">
      <aside class="z-canvas-side">
        <section>
          <span>${escapeHtml(t('Attempt'))}</span>
          <h2>${escapeHtml(t(attempt?.summary || 'Sandbox preview'))}</h2>
        </section>
        <section>
          <span>${escapeHtml(t('Logs'))}</span>
          <ul>${(attempt?.logs || session.logs || []).map((log) => `<li>${escapeHtml(log)}</li>`).join('') || `<li>${escapeHtml(t('No logs yet'))}</li>`}</ul>
        </section>
        <section>
          <span>${escapeHtml(t('Diffs'))}</span>
          <pre>${escapeHtml((attempt?.diffs || session.diffs || []).join('\n\n') || t('No diff yet.'))}</pre>
        </section>
        <section>
          <span>${escapeHtml(t('Blocked network'))}</span>
          <ul>${session.egressEvents.map((event) => `<li>${escapeHtml(event.url)}</li>`).join('') || `<li>${escapeHtml(t('None'))}</li>`}</ul>
        </section>
      </aside>
      <div class="z-canvas-preview">
        ${session.previewUrl ? `<iframe src="${escapeHtml(session.previewUrl)}" title="Z-Canvas sandbox preview" sandbox="allow-scripts"></iframe>` : `<div class="z-canvas-preview__empty">${escapeHtml(t('Preview is starting.'))}</div>`}
      </div>
    </div>
  `;
}

function unwrapA2UIData<T>(payload: any): T {
  return (payload?.data || payload) as T;
}

async function loadA2UIState(): Promise<A2UIRuntimeState | null> {
  try {
    const snapshotPayload = await fetchJson<{ ok: boolean; data: A2UISnapshot } | A2UISnapshot>('/api/v2/a2ui/snapshot');
    const snapshot = unwrapA2UIData<A2UISnapshot>(snapshotPayload);
    const surface = selectA2UISurface(snapshot, cachedA2UISurfaceId);
    cachedA2UISurfaceId = surface?.surfaceId || cachedA2UISurfaceId || null;
    let stream: A2UIStreamSnapshot | null = null;
    if (surface?.surfaceId) {
      const streamPayload = await fetchJson<{ ok: boolean; data: A2UIStreamSnapshot } | A2UIStreamSnapshot>(
        `/api/v2/a2ui/stream?surfaceId=${encodeURIComponent(surface.surfaceId)}&limit=20`,
      );
      stream = unwrapA2UIData<A2UIStreamSnapshot>(streamPayload);
    }
    return { snapshot, stream };
  } catch {
    return null;
  }
}

async function loadCanvas() {
  let payload: { ok: boolean; session: CanvasSession };
  cachedA2UIState = await loadA2UIState();
  try {
    payload = await fetchJson<{ ok: boolean; session: CanvasSession }>('/api/web/canvas/session');
  } catch {
    payload = localFallbackJson<{ ok: boolean; session: CanvasSession }>('/api/web/canvas/session');
  }
  cachedCanvasSession = payload.session;
  renderCanvas(payload.session);
}

async function dispatchA2UIAction(surfaceId: string, actionId: string, payload: Record<string, unknown> = {}) {
  if (!surfaceId || !actionId) return;
  const result = await fetchJson<{ ok: boolean; status: string; summary: string }>('/api/v2/a2ui/action', {
    method: 'POST',
    body: JSON.stringify({
      surfaceId,
      actionId,
      requestedBy: 'zavorth-control',
      payload,
      correlation: {
        source: 'z-canvas',
        activeAttemptId: cachedCanvasSession?.activeAttemptId || null,
      },
    }),
  });
  window.emitSignal?.(result.ok ? 'success' : 'info', 'A2UI action', result.summary || result.status || actionId);
  await loadCanvas();
}

async function createCanvasAttempt() {
  if (!cachedCanvasSession) return;
  const round = cachedCanvasSession.attempts.length + 1;
  const payload = await fetchJson<{ ok: boolean; session: CanvasSession }>('/api/web/canvas/session', {
    method: 'POST',
    body: JSON.stringify({
      action: 'add-attempt',
      sessionId: cachedCanvasSession.sessionId,
      summary: `Sandbox attempt ${round}`,
      logs: [`Sandbox attempt ${round} recorded.`, 'Preview stayed isolated from the host workspace.'],
      diffs: [`diff --git a/canvas-attempt-${round}.txt b/canvas-attempt-${round}.txt\n@@ -0,0 +1 @@\n+Sandbox attempt ${round}`],
    }),
  });
  cachedCanvasSession = payload.session;
  renderCanvas(payload.session);
}

async function selectCanvasAttempt(attemptId: string) {
  if (!cachedCanvasSession) return;
  const payload = await fetchJson<{ ok: boolean; session: CanvasSession }>('/api/web/canvas/attempt/select', {
    method: 'POST',
    body: JSON.stringify({ sessionId: cachedCanvasSession.sessionId, attemptId }),
  });
  cachedCanvasSession = payload.session;
  renderCanvas(payload.session);
}

async function sendDiffAction(action: string) {
  const engineId = cachedEngineSnapshot?.activeEngineId || cachedCanvasSession?.engineId || 'lite';
  const payload = await fetchJson<{ ok: boolean; review: { summary: string; status: string; events?: Array<Record<string, any>> }; result?: { events?: Array<Record<string, any>> } }>('/api/web/diff/review', {
    method: 'POST',
    body: JSON.stringify({
      action,
      targetId: cachedCanvasSession?.activeAttemptId || 'canvas-attempt',
      engineId,
      targetPath: null,
    }),
  });
  ingestEngineTraces(payload.result?.events || payload.review?.events || []);
  window.emitSignal?.('info', 'Diff review', `${payload.review.status}: ${payload.review.summary}`);
}

async function openCanvasFromRecommendation() {
  const canvasDock = document.querySelector('.dock-node[data-sector="canvas"]')
    || Array.from(document.querySelectorAll('[data-sector], [data-drawer-sector], a, button'))
      .find((node) => node instanceof HTMLElement && (node.getAttribute('data-sector') === 'canvas'
        || node.getAttribute('data-drawer-sector') === 'canvas'
        || node.textContent?.trim() === 'Canvas'));
  if (canvasDock instanceof HTMLElement) {
    canvasDock.click();
  }
  await loadCanvas();
}

export function initRuntimeEngineUi() {
  loadEngines().catch((error) => window.emitSignal?.('info', 'Runtime engines', error.message));
  loadTrustedWorkspaces().catch(() => undefined);
  loadCanvas().catch(() => undefined);

  // Feature 6: Trusted Folders Drag & Drop
  setTimeout(() => {
    const trustedPanel = document.querySelector('.settings-trusted-panel');
    if (trustedPanel) {
      trustedPanel.addEventListener('dragover', (e) => {
        e.preventDefault();
        trustedPanel.classList.add('drag-active');
      });

      trustedPanel.addEventListener('dragleave', () => {
        trustedPanel.classList.remove('drag-active');
      });

      trustedPanel.addEventListener('drop', async (e: DragEvent) => {
        e.preventDefault();
        trustedPanel.classList.remove('drag-active');
        
        const items = e.dataTransfer?.items;
        if (!items || items.length === 0) return;
        
        const item = items[0];
        if (item.kind !== 'file') return;
        
        const entry = item.webkitGetAsEntry();
        if (entry && entry.isDirectory) {
          const pathInput = trustedPanel.querySelector('input[name="path"]') as HTMLInputElement;
          const labelInput = trustedPanel.querySelector('input[name="label"]') as HTMLInputElement;
          const selectState = trustedPanel.querySelector('select[name="state"]') as HTMLSelectElement;
          
          if (pathInput && labelInput) {
            const path = droppedFolderPath(item, entry);
            const label = fileSystemEntryName(entry) || path.split(/[\\/]/).filter(Boolean).pop() || 'Dropped folder';
            pathInput.value = path;
            labelInput.value = label;
            if (selectState) selectState.value = 'trusted';
            
            if (/^[a-z]:[\\/]|^\\\\|^\//i.test(path)) {
              const form = trustedPanel.querySelector('[data-trusted-workspace-form]') as HTMLFormElement | null;
              if (form) {
                await addTrustedWorkspace(form);
              } else {
                window.emitSignal?.('success', 'Folder drag detected', `Prepared ${label}.`);
              }
            } else {
              window.emitSignal?.('info', 'Folder path needed', `Browser did not expose an absolute path for ${label}. Paste the local path, then add it.`);
            }
            
            pathInput.classList.add('zavorth-input-pulse');
            labelInput.classList.add('zavorth-input-pulse');
            setTimeout(() => {
              pathInput.classList.remove('zavorth-input-pulse');
              labelInput.classList.remove('zavorth-input-pulse');
            }, 1000);
          }
        } else {
          window.emitSignal?.('info', 'Invalid drop item', 'Only folders can be dragged to Trusted Folders.');
        }
      });
    }
  }, 1200);

  window.ZavorthRuntimeEngines = {
    getActiveEngineId: () => cachedEngineSnapshot?.activeEngineId || 'lite',
    decidePrompt,
    recommendCanvas: recommendCanvasForPrompt,
    requestNaturalEngineSwitch,
    selectEngine,
  };

  if (document.documentElement.dataset.zavorthRuntimeEngineUiBound === '1') return;
  document.documentElement.dataset.zavorthRuntimeEngineUiBound = '1';

  document.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const engineButton = target?.closest?.('[data-engine-select]');
    if (engineButton) {
      event.preventDefault();
      selectEngine(engineButton.getAttribute('data-engine-select') as EngineId).catch((error) => {
        window.emitSignal?.('info', 'Engine locked', error.message);
      });
      return;
    }

    if (target?.closest?.('#send-btn')) {
      decideCurrentPrompt().catch(() => undefined);
      return;
    }

    const switchConfirm = target?.closest?.('[data-engine-switch-confirm]');
    if (switchConfirm) {
      event.preventDefault();
      const engineId = switchConfirm.getAttribute('data-engine-switch-confirm') as EngineId;
      selectEngine(engineId)
        .then(() => switchConfirm.closest('[data-engine-switch-card]')?.remove())
        .catch((error) => {
          const detail = errorMessage(error);
          window.emitSignal?.('info', 'Engine locked', detail);
          const card = switchConfirm.closest('[data-engine-switch-card]');
          const message = card?.querySelector('strong');
          if (message) {
            message.textContent = `${t('Cannot switch yet.')} ${t(detail)}`;
          }
          if (/auth|token|unlock/i.test(detail) && !card?.querySelector('[data-engine-switch-unlock]')) {
            card?.querySelector('.engine-switch-card__actions')?.insertAdjacentHTML(
              'afterbegin',
              `<button type="button" data-engine-switch-unlock>${t('Unlock runtime')}</button>`,
            );
          }
        });
      return;
    }

    const promotionConfirm = target?.closest?.('[data-engine-promote-confirm]');
    if (promotionConfirm) {
      event.preventDefault();
      const engineId = promotionConfirm.getAttribute('data-engine-promote-confirm') as EngineId;
      selectEngine(engineId)
        .then(() => promotionConfirm.closest('[data-engine-promotion-card]')?.remove())
        .catch((error) => {
          const detail = errorMessage(error);
          window.emitSignal?.('info', t('Engine locked'), detail);
          const card = promotionConfirm.closest('[data-engine-promotion-card]');
          const message = card?.querySelector('strong');
          if (message) {
            message.textContent = `${t('Cannot continue yet.')} ${t(detail)}`;
          }
          if (/auth|token|unlock/i.test(detail) && !card?.querySelector('[data-engine-switch-unlock]')) {
            card?.querySelector('.engine-switch-card__actions')?.insertAdjacentHTML(
              'afterbegin',
              `<button type="button" data-engine-switch-unlock>${t('Unlock runtime')}</button>`,
            );
          }
        });
      return;
    }

    if (target?.closest?.('[data-engine-switch-unlock]')) {
      event.preventDefault();
      window.ZavorthRuntimeBridge?.openUnlockModal?.(t('Unlock the local runtime before switching execution engines.'));
      return;
    }

    if (target?.closest?.('[data-a2ui-refresh]')) {
      event.preventDefault();
      loadCanvas().catch((error) => window.emitSignal?.('info', 'A2UI', errorMessage(error)));
      return;
    }

    const a2uiSurfaceButton = target?.closest?.('[data-a2ui-surface]');
    if (a2uiSurfaceButton) {
      event.preventDefault();
      cachedA2UISurfaceId = a2uiSurfaceButton.getAttribute('data-a2ui-surface') || null;
      loadCanvas().catch((error) => window.emitSignal?.('info', 'A2UI surface', errorMessage(error)));
      return;
    }

    const a2uiActionButton = target?.closest?.('[data-a2ui-action]:not(form)');
    if (a2uiActionButton) {
      event.preventDefault();
      dispatchA2UIAction(
        a2uiActionButton.getAttribute('data-a2ui-surface-id') || cachedA2UISurfaceId || '',
        a2uiActionButton.getAttribute('data-a2ui-action') || '',
        {
          componentId: a2uiActionButton.getAttribute('data-a2ui-component-id') || null,
        },
      ).catch((error) => window.emitSignal?.('info', 'A2UI action', errorMessage(error)));
      return;
    }

    if (target?.closest?.('[data-engine-switch-dismiss]')) {
      event.preventDefault();
      target.closest('[data-engine-switch-card], [data-engine-promotion-card], [data-canvas-recommendation-card]')?.remove();
      return;
    }

    const removeButton = target?.closest?.('[data-trusted-workspace-remove]');
    if (removeButton) {
      event.preventDefault();
      removeTrustedWorkspace(removeButton.getAttribute('data-trusted-workspace-remove') || '').catch(() => undefined);
      return;
    }

    const attemptButton = target?.closest?.('[data-canvas-attempt]');
    if (attemptButton) {
      event.preventDefault();
      selectCanvasAttempt(attemptButton.getAttribute('data-canvas-attempt') || '').catch(() => undefined);
      return;
    }

    if (target?.closest?.('[data-canvas-create-attempt]')) {
      event.preventDefault();
      createCanvasAttempt().catch(() => undefined);
      return;
    }

    const diffButton = target?.closest?.('[data-canvas-diff-action]');
    if (diffButton) {
      event.preventDefault();
      sendDiffAction(diffButton.getAttribute('data-canvas-diff-action') || 'accept-file').catch(() => undefined);
      return;
    }

    if (target?.closest?.('[data-canvas-open-recommended]')) {
      event.preventDefault();
      openCanvasFromRecommendation()
        .then(() => target.closest('[data-canvas-recommendation-card]')?.remove())
        .catch((error) => window.emitSignal?.('info', 'Canvas', errorMessage(error)));
    }
  });

  document.addEventListener('submit', (event) => {
    const form = event.target instanceof HTMLFormElement ? event.target : null;
    if (form?.matches('[data-a2ui-form]')) {
      event.preventDefault();
      const formData = new FormData(form);
      const payload: Record<string, unknown> = {};
      formData.forEach((value, key) => {
        payload[key] = typeof value === 'string' ? value : value.name;
      });
      dispatchA2UIAction(
        form.getAttribute('data-a2ui-surface-id') || cachedA2UISurfaceId || '',
        form.getAttribute('data-a2ui-action') || '',
        {
          componentId: form.getAttribute('data-a2ui-component-id') || null,
          fields: payload,
        },
      ).catch((error) => window.emitSignal?.('info', 'A2UI form', errorMessage(error)));
      return;
    }
    if (!form?.matches('[data-trusted-workspace-form]')) return;
    event.preventDefault();
    addTrustedWorkspace(form).catch((error) => window.emitSignal?.('info', 'Trusted workspace', error.message));
  });

  window.addEventListener('message', (event) => {
    if (event.data?.type !== 'zavorth.canvas.egress_blocked') return;
    window.emitSignal?.('info', 'Canvas network blocked', String(event.data.url || 'External request'));
  });
}
