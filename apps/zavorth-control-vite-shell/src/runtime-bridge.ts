/**
 * Zavorth Dashboard - Runtime Bridge
 *
 * Non-invasive data bridge for the real Zavorth runtime.
 * Rule: do not redesign the dashboard here. Only replace demo text inside
 * existing components/classes that already belong to this dashboard surface.
 */
import { createRuntimeAuthSession } from './runtime-auth-session';
import { basename, createRuntimeArtifactUtils, extensionOf } from './runtime-artifact-utils';
import { createRuntimeHttp, messageFromCaughtError, messageFromErrorPayload } from './runtime-http';
import { createRuntimeModelProfile, normalizeModelProfile } from './runtime-model-profile';
import { createRuntimeOperationsPanels } from './runtime-operations-panels';
import { createRuntimeProviderPanels } from './runtime-provider-panels';
import { createRuntimeRefresh } from './runtime-refresh';
import { createRuntimeRealtime } from './runtime-realtime';
import { createRuntimeRunReplay } from './runtime-run-replay';
import { createRuntimeSessionUi } from './runtime-session-ui';

export function initRuntimeBridge() {

  const AUTH_STORAGE_KEY = 'zavorth.zavorthControl.webToken';
  const SESSION_STORAGE_KEY = 'zavorth.zavorthControl.sessionId';
  const RUN_STORAGE_KEY = 'zavorth.zavorthControl.runId';
  const state = {
    auth: null,
    zavorthControl: null,
    providerModelCatalog: null,
    providerActivation: null,
    catalog: null,
    companions: null,
    gatewayRuntime: null,
    sessionId: null,
    lastHydratedSessionId: null,
    artifacts: [],
    artifactsById: new Map(),
    remoteMeshApprovals: [],
    remoteMeshApprovalsById: new Map(),
    realtime: {
      connected: false,
      connecting: false,
      sessionId: null,
      transport: 'idle',
      lastEventAt: null,
      lastEventType: null,
      lastError: null,
      retryCount: 0,
      reconnectTimer: null,
      refreshTimer: null,
      abortController: null,
      eventSource: null,
      stopped: true,
    },
    lastError: null,
    updatedAt: null,
    transcriptRenderSuppressedUntil: 0,
  };

  const {
    authHeaders,
    buildZavorthControlQueryString,
    clearStoredToken,
    hasStoredToken,
    readRunId,
    readSessionId,
    readToken,
    readUrlParam,
    realtimePath,
    replaceZavorthControlUrlParams,
    writeRunId,
    writeSessionId,
  } = createRuntimeAuthSession({
    state,
    authStorageKey: AUTH_STORAGE_KEY,
    sessionStorageKey: SESSION_STORAGE_KEY,
    runStorageKey: RUN_STORAGE_KEY,
  });
  const { readBlob, readJson } = createRuntimeHttp({ authHeaders });
  let refresh: (options?: any) => Promise<void> = async () => {};

  function resolveRealtimeSessionId() {
    const stored = readSessionId();
    if (stored) return stored;

    const snapshot = state.zavorthControl?.snapshot || {};
    const activeRun = getActiveRun();
    const candidate = String(
      activeRun?.sessionId
      || snapshot.activeSessionId
      || state.zavorthControl?.sessionId
      || '',
    ).trim();
    if (candidate) {
      writeSessionId(candidate);
    }
    return candidate;
  }


  async function fetchDashboardEvents(ui = window.ZavorthControlChat || {}, query = {}) {
    const sessionId = String(query.sessionId || readSessionId() || '').trim();
    if (!sessionId) return null;
    const params = new URLSearchParams({ sessionId });
    if (String(query.runId || '').trim()) params.set('runId', String(query.runId).trim());
    if (String(query.traceId || '').trim()) params.set('traceId', String(query.traceId).trim());
    if (String(query.status || '').trim()) params.set('status', String(query.status).trim());
    if (String(query.limit || '').trim()) params.set('limit', String(query.limit).trim());
    const path = `/api/web/dashboard/events?${params.toString()}`;
    const payload = await readJson(path, {
      headers: authHeaders(),
    });
    if (typeof ui.ingestRuntimeEvents === 'function') {
      ui.ingestRuntimeEvents(payload?.events || [], {
        source: 'persistent-session-history',
        runId: query.runId || payload?.query?.runId,
        traceId: query.traceId || payload?.query?.traceId,
        sessionId,
      });
    }
    return payload;
  }

  async function openPersistentTrace(query = {}, ui = window.ZavorthControlChat || {}) {
    const normalized = {
      runId: String(query?.runId || readRunId() || '').trim(),
      traceId: String(query?.traceId || readUrlParam('traceId') || '').trim(),
      sessionId: String(query?.sessionId || readSessionId() || '').trim(),
      source: 'persistent-session-history',
    };
    await fetchDashboardEvents(ui, normalized).catch(() => undefined);
    if (typeof ui.openTraceSheet === 'function') {
      ui.openTraceSheet(normalized);
    }
    if (normalized.runId || normalized.traceId || normalized.sessionId) {
      replaceZavorthControlUrlParams({
        runId: normalized.runId,
        traceId: normalized.traceId,
        sessionId: normalized.sessionId,
      });
    }
    return normalized;
  }

  function suppressTranscriptRender(durationMs = 5000) {
    state.transcriptRenderSuppressedUntil = Date.now() + Math.max(0, Number(durationMs) || 0);
  }

  function isTranscriptRenderSuppressed(options = {}) {
    if (options.forceTranscriptRender === true) return false;
    if (options.renderTranscript === false) return true;
    return Date.now() < Number(state.transcriptRenderSuppressedUntil || 0);
  }

  const {
    extractApprovals,
    extractRemoteMeshApprovalCards,
    extractTranscriptMessages,
    renderApprovalsFromPayload,
    renderMessagesFromPayload,
    renderRemoteMeshApprovalsFromPayload,
  } = createRuntimeSessionUi({
    state,
    isTranscriptRenderSuppressed,
  });
  const {
    connectRealtime,
    disconnectRealtime,
  } = createRuntimeRealtime({
    state,
    authHeaders,
    realtimePath,
    resolveRealtimeSessionId,
    updatePulse,
    refreshRuntime: () => refresh({ fromRealtime: true }),
    hydrateCurrentSession: () => hydrateCurrentSession(),
    fetchCurrentApprovals: () => fetchCurrentApprovals(),
    fetchCurrentArtifacts: () => fetchCurrentArtifacts(),
    fetchDashboardEvents: () => fetchDashboardEvents(),
    renderMessagesFromPayload,
    renderApprovalsFromPayload,
    renderRemoteMeshApprovalsFromPayload,
    renderArtifactsFromPayload,
  });

  function text(value, fallback = '---') {
    if (typeof value === 'number' && !Number.isFinite(value)) return fallback;
    const normalized = String(value ?? '').trim();
    if (/^(nan|null|undefined)$/i.test(normalized)) return fallback;
    return normalized || fallback;
  }

  const {
    artifactPolicyAllowsChatDisplay,
    extractArtifacts,
    extractDiffPreviews,
    hasDirectExecutionArtifactContext,
    hasExecutionArtifactContext,
    shouldDisplayArtifactsInChat,
  } = createRuntimeArtifactUtils({
    state,
    text,
    readRunId,
    readSessionId,
  });

  function numberLabel(value, fallback = '0') {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return fallback;
    return numeric.toLocaleString('en-US');
  }

  function formatDate(value) {
    const date = new Date(String(value || ''));
    if (!Number.isFinite(date.getTime())) return 'now';
    return date.toLocaleString('en-US', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function statusBadge(status, label) {
    const normalized = String(status || '').toLowerCase();
    const tone = normalized.includes('ready') || normalized.includes('online') || normalized.includes('connected') || normalized.includes('true') || normalized.includes('completed') || normalized.includes('done')
      ? 'ok'
      : normalized.includes('degraded') || normalized.includes('protected') || normalized.includes('auth') || normalized.includes('queued') || normalized.includes('waiting') || normalized.includes('pending')
        ? 'warn'
        : normalized.includes('offline') || normalized.includes('blocked') || normalized.includes('false') || normalized.includes('failed') || normalized.includes('error') || normalized.includes('cancelled') || normalized.includes('rejected')
          ? 'danger'
          : 'info';
    return `<span class="badge badge--${tone}"><span class="badge__dot"></span>${label}</span>`;
  }

  const {
    getCurrentModelLabel,
    getCurrentModelRouteLabel,
    getCurrentProviderLabel,
    publishCurrentModelProfile,
    resolveCurrentModelProfile,
  } = createRuntimeModelProfile({
    state,
    getRuns,
    getActiveRun,
    text,
  });

  function escapeHtml(value) {
    return String(value - '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function findSummaryCard(label) {
    const cards = Array.from(document.querySelectorAll('.summary-card'));
    return cards.find((card) => {
      const cardLabel = card.querySelector('.summary-card__label');
      return cardLabel && cardLabel.textContent.trim().toLowerCase() === label.toLowerCase();
    }) || null;
  }

  function updateSummaryCard(label, value, sub) {
    const card = findSummaryCard(label);
    if (!card) return;
    const valueEl = card.querySelector('.summary-card__value');
    const subEl = card.querySelector('.summary-card__sub');
    if (valueEl) valueEl.textContent = value;
    if (subEl) subEl.textContent = sub;
  }

  function updatePremiumMetric(label, value, sub) {
    const normalized = String(label || '').trim().toLowerCase();
    const cards = Array.from(document.querySelectorAll('.premium-metric, .platform-stat'));
    const matches = cards.filter((entry) => {
      const labelNode = entry.querySelector(':scope > span');
      return String(labelNode?.textContent || '').trim().toLowerCase() === normalized;
    });
    if (matches.length === 0) return false;
    for (const card of matches) {
      const valueNode = card.querySelector(':scope > strong');
      const subNode = card.querySelector(':scope > small');
      if (valueNode) valueNode.textContent = String(value);
      if (subNode) subNode.textContent = String(sub || '');
    }
    return true;
  }

  function updatePremiumStatus(label, value, tone = 'info') {
    const normalized = String(label || '').trim().toLowerCase();
    const entries = Array.from(document.querySelectorAll('.premium-status'));
    const matches = entries.filter((candidate) => {
      const labelNode = candidate.querySelector(':scope > span');
      return String(labelNode?.textContent || '').trim().toLowerCase() === normalized;
    });
    if (matches.length === 0) return false;
    for (const entry of matches) {
      entry.className = `premium-status premium-status--${tone}`;
      const valueNode = entry.querySelector(':scope > strong');
      if (valueNode) valueNode.textContent = String(value || '');
    }
    return true;
  }

  function setDashboardPrompt(selector, prompt) {
    const node = document.querySelector(selector);
    if (node && prompt) node.setAttribute('data-dashboard-prompt', String(prompt));
  }

  function setControlTelemetry(key, value) {
    document.querySelectorAll(`[data-control-telemetry="${key}"]`).forEach((node) => {
      node.textContent = String(value);
    });
  }

  function getGatewaySnapshot() {
    return state.zavorthControl?.snapshot || {};
  }

  function getRuns() {
    const snapshot = getGatewaySnapshot();
    return Array.isArray(snapshot.runs) ? snapshot.runs : [];
  }

  function getWorkflowJobs() {
    const snapshot = getGatewaySnapshot();
    return Array.isArray(snapshot.workflowJobs) ? snapshot.workflowJobs : [];
  }

  function getActiveRun() {
    const snapshot = getGatewaySnapshot();
    return snapshot.activeRun || getRuns()[0] || null;
  }

  function normalizeRunStatus(status) {
    return String(status || 'unknown').trim().toLowerCase();
  }

  function isRunLive(run) {
    const status = normalizeRunStatus(run?.status);
    return ['queued', 'thinking', 'running', 'waiting_approval'].includes(status);
  }

  function findWorkflowJobForRun(run) {
    const runId = String(run?.id || '').trim();
    if (!runId) return null;
    return getWorkflowJobs().find((job) => String(job?.runId || '').trim() === runId) || null;
  }

  function pendingRunApprovals(run) {
    const approvals = Array.isArray(run?.approvals) ? run.approvals : [];
    return approvals.filter((approval) => String(approval?.status || '').trim().toLowerCase() === 'pending');
  }

  function deriveRunError(run) {
    const events = Array.isArray(run?.events) ? run.events : [];
    const errorEvent = events.slice().reverse().find((event) => {
      const kind = String(event?.kind || '').toLowerCase();
      const status = String(event?.status || '').toLowerCase();
      return kind === 'error' || status === 'failed';
    });
    return String(errorEvent?.detail || errorEvent?.title || run?.error || '').trim();
  }

  function deriveNextRunAction(run) {
    if (!run) return 'No active run';
    const status = normalizeRunStatus(run.status);
    const approvals = pendingRunApprovals(run);
    const job = findWorkflowJobForRun(run);
    if (approvals.length > 0 || status === 'waiting_approval') {
      return 'Approve or deny';
    }
    if (status === 'queued') {
      return job?.nextRunAt ? `Wait for queue (${formatDate(job.nextRunAt)})` : 'Wait for executor';
    }
    if (status === 'thinking' || status === 'running') {
      return 'Track execution';
    }
    if (status === 'failed') {
      return 'Review error';
    }
    if (status === 'cancelled') {
      return 'Run cancelled';
    }
    if (status === 'completed') {
      return Array.isArray(run.artifacts) && run.artifacts.length > 0 ? 'Open artifacts' : 'Review replay';
    }
    return 'Review state';
  }

  function latestRunEvent(run) {
    const events = Array.isArray(run?.events) ? run.events : [];
    return events.slice().sort((a, b) => String(b?.createdAt || '').localeCompare(String(a?.createdAt || '')))[0] || null;
  }

  function runEventRows(limit = 8) {
    const rows = [];
    for (const run of getRuns()) {
      const events = Array.isArray(run?.events) ? run.events : [];
      if (events.length === 0) {
        rows.push({
          run,
          event: {
            createdAt: run?.updatedAt || run?.createdAt,
            title: run?.summary || run?.title || 'Run recorded',
            detail: deriveNextRunAction(run),
            kind: 'status',
            status: run?.status || 'unknown',
          },
        });
        continue;
      }
      for (const event of events) rows.push({ run, event });
    }
    return rows
      .sort((a, b) => String(b.event?.createdAt || b.run?.updatedAt || '').localeCompare(String(a.event?.createdAt || a.run?.updatedAt || '')))
      .slice(0, limit);
  }

  function eventCountMatching(pattern) {
    const matcher = pattern instanceof RegExp ? pattern : new RegExp(String(pattern || ''), 'i');
    return getRuns().reduce((count, run) => {
      const events = Array.isArray(run?.events) ? run.events : [];
      return count + events.filter((event) => {
        const haystack = `${event?.kind || ''} ${event?.status || ''} ${event?.title || ''} ${event?.detail || ''}`;
        return matcher.test(haystack);
      }).length;
    }, 0);
  }

  function numericFromPath(object, path) {
    const value = String(path || '').split('.').reduce((current, key) => current?.[key], object);
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : 0;
  }

  function sumRunNumbers(paths) {
    const list = Array.isArray(paths) ? paths : [paths];
    return getRuns().reduce((sum, run) => {
      for (const path of list) {
        const value = numericFromPath(run, path);
        if (value) return sum + value;
      }
      return sum;
    }, 0);
  }

  function formattedMoney(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) return '$0.00';
    return numeric.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 4 });
  }

  function configuredChannelIds() {
    const ids = new Set(['web', 'dashboard', 'local']);
    const candidates = [
      state.catalog?.channels,
      state.catalog?.catalog?.channels,
      state.gatewayRuntime?.channels,
      state.gatewayRuntime?.snapshot?.channels,
      state.zavorthControl?.snapshot?.channels,
    ];
    for (const list of candidates) {
      if (!Array.isArray(list)) continue;
      for (const entry of list) {
        const id = String(entry?.id || entry?.kind || entry?.channel || entry?.name || '').trim().toLowerCase();
        if (id) ids.add(id);
      }
    }
    for (const run of getRuns()) {
      const channel = String(run?.channel || '').trim().toLowerCase();
      if (channel) ids.add(channel);
    }
    return ids;
  }

  function channelReadinessLabel(id) {
    const normalized = String(id || '').trim().toLowerCase();
    const ids = configuredChannelIds();
    if (ids.has(normalized)) return normalized === 'web' ? 'ready' : 'connected';
    return 'configurable';
  }

  function channelReadinessTone(id) {
    return /ready|connected/i.test(channelReadinessLabel(id)) ? 'ok' : 'info';
  }

  function updatePlatformAction(sectionId, title, detail, prompt) {
    const normalized = String(title || '').trim().toLowerCase();
    const section = document.getElementById(sectionId);
    const button = Array.from(section?.querySelectorAll('.platform-action-list button') || []).find((candidate) => {
      const strong = candidate.querySelector('strong');
      return String(strong?.textContent || '').trim().toLowerCase() === normalized;
    });
    if (!button) return false;
    const span = button.querySelector('span');
    if (span && detail) span.textContent = String(detail);
    if (prompt) button.setAttribute('data-dashboard-prompt', String(prompt));
    return true;
  }

  function setLiveStripValue(selector, value) {
    document.querySelectorAll(selector).forEach((node) => {
      node.textContent = window.ZavorthLocale?.t(String(value)) || String(value);
      if (selector.includes('-state')) {
        node.dataset.liveValue = String(value || '').toLowerCase();
      }
    });
  }

  function updateLiveStripFromRuntime(runtimeState, runtimeDetail, gatewayState, gatewayDetail) {
    setLiveStripValue('[data-live-runtime-state]', runtimeState);
    setLiveStripValue('[data-live-runtime-detail]', runtimeDetail);
    setLiveStripValue('[data-live-gateway-state]', gatewayState);
    setLiveStripValue('[data-live-gateway-detail]', gatewayDetail);
    setLiveStripValue('[data-live-sync-state]', 'Last sync');
    setLiveStripValue('[data-live-sync-detail]', state.updatedAt ? formatDate(state.updatedAt) : 'Just now');
  }

  function updatePulse() {
    const pulse = document.getElementById('core-pulse');
    const label = pulse?.querySelector('.bridge__pulse-label');
    if (!pulse || !label) return;
    const setPulseLabel = (value) => {
      label.textContent = window.ZavorthLocale?.t(String(value)) || String(value);
    };

    if (state.lastError) {
      setPulseLabel('Core checking');
      pulse.title = state.lastError;
      setPulseAccessState('checking');
      updateLiveStripFromRuntime('Checking', state.lastError, 'Gateway', 'Retrying local status');
      wireUnlockPulse(false);
      return;
    }

    const auth = state.auth;
    const command = state.zavorthControl;
    if (command?.live) {
      if (state.realtime.connected) {
        label.textContent = 'Core live';
        pulse.title = `Tab unlocked. Live runtime connected (${state.realtime.lastEventType || 'stream'}).`;
        setPulseAccessState('unlocked');
        updateLiveStripFromRuntime('Runtime live', 'Tab unlocked and streaming', 'Gateway connected', state.realtime.lastEventType || 'live events');
        wireUnlockPulse(false);
        return;
      }
      if (state.realtime.connecting) {
        setPulseLabel('Connecting');
        pulse.title = 'Tab unlocked. Opening live runtime stream.';
        setPulseAccessState('unlocked');
        updateLiveStripFromRuntime('Runtime live', 'Opening event stream', 'Gateway connecting', 'Preparing live updates');
        wireUnlockPulse(false);
        return;
      }
      setPulseLabel('Ready');
      pulse.title = state.realtime.lastError
        ? `Tab unlocked. Live runtime connected; live stream reconnecting: ${state.realtime.lastError}`
        : 'Tab unlocked. Live runtime connected to the dashboard.';
      setPulseAccessState('unlocked');
      updateLiveStripFromRuntime('Runtime unlocked', 'Live requests are available', 'Gateway ready', state.realtime.lastError ? 'Stream reconnecting' : 'Live route');
      wireUnlockPulse(false);
      return;
    }

    if (command?.authRequired) {
      setPulseLabel('Protected');
      pulse.title = hasStoredToken()
        ? 'Token saved in this tab, but the runtime still requires validation. Click to review.'
        : 'The dashboard is protected. Live data requires the local token. Click to unlock.';
      setPulseAccessState('protected');
      updateLiveStripFromRuntime('Token required', hasStoredToken() ? 'Saved token needs validation' : 'Unlock to send live messages', 'Gateway protected', 'Local token required');
      wireUnlockPulse(true);
      return;
    }

    if (auth?.webReady || auth?.gatewayReady) {
      setPulseLabel('Ready');
      pulse.title = 'Dashboard connected to the local server.';
      setPulseAccessState('local');
      updateLiveStripFromRuntime('Runtime connected', 'Local server responding', 'Gateway ready', 'Dashboard route');
      wireUnlockPulse(false);
      return;
    }

    setPulseLabel('Local');
    pulse.title = 'Waiting for runtime state.';
    setPulseAccessState('local');
    updateLiveStripFromRuntime('Runtime local', 'Waiting for live state', 'Gateway local', 'Dashboard route');
    wireUnlockPulse(false);
  }

  function setPulseAccessState(accessState) {
    const pulse = document.getElementById('core-pulse');
    if (!pulse) return;
    pulse.dataset.authState = String(accessState || 'local');
  }

  function wireUnlockPulse(enabled) {
    const pulse = document.getElementById('core-pulse');
    if (!pulse) return;
    pulse.style.cursor = 'pointer';
    pulse.setAttribute('aria-label', enabled ? 'Unlock live runtime' : 'View runtime access state');
    pulse.setAttribute('role', 'button');
    if (pulse.dataset.unlockWired === 'true') return;
    pulse.dataset.unlockWired = 'true';
    pulse.addEventListener('click', () => {
      if (state.zavorthControl?.authRequired) {
        openUnlockModal('Enter the local token to read live runs and send messages to Zavorth.');
        return;
      }
      openAccessStatusModal();
    });
  }

  function updateOverview() {
    const snapshot = state.zavorthControl?.snapshot || {};
    const runs = getRuns();
    const activeRun = getActiveRun();
    const jobs = getWorkflowJobs();
    const live = Boolean(state.zavorthControl?.live);
    const authRequired = Boolean(state.zavorthControl?.authRequired);
    const runtimeLabel = live ? 'live runtime' : authRequired ? 'protected access' : 'fallback local';
    const activeSessions = new Set(runs.map((run) => run.sessionId || run.id).filter(Boolean)).size;
    const pendingApprovals = runs.reduce((count, run) => {
      const approvals = Array.isArray(run.approvals) ? run.approvals : [];
      return count + approvals.filter((approval) => approval.status === 'pending').length;
    }, 0);

    updateSummaryCard('Total Messages', numberLabel(runs.length), `${runtimeLabel} - runs registered`);
    updateSummaryCard('Tokens Used', '-', 'token telemetry is not connected yet');
    updateSummaryCard('Total Cost', '-', 'live costs are not connected yet');
    updateSummaryCard('Active Sessions', numberLabel(activeSessions), activeRun ? `active: ${text(activeRun.title, activeRun.id)}` : 'no active run now');
    updateSummaryCard('Uptime', state.auth?.webReady ? 'Online' : 'Local', state.auth?.gatewayReady ? 'gateway ready' : 'local dashboard responding');
    updateSummaryCard('Average Latency', activeRun ? text(activeRun.status, 'run') : '0', pendingApprovals ? `${pendingApprovals} approval(s) pending` : deriveNextRunAction(activeRun));

    const activeRunStatus = String(activeRun?.status || '').toLowerCase();
    const hasActiveWork = Boolean(activeRun && !['done', 'completed', 'complete', 'success', 'succeeded', 'failed', 'error', 'cancelled', 'canceled'].includes(activeRunStatus));
    const runtimeTitle = document.querySelector('[data-dashboard-runtime-title]');
    const runtimeText = document.querySelector('[data-dashboard-runtime-text]');
    if (runtimeTitle) runtimeTitle.textContent = hasActiveWork ? text(activeRun.title || activeRun.summary, activeRun.id) : 'No task running';
    if (runtimeText) {
      runtimeText.textContent = hasActiveWork
        ? `${text(activeRun.status, 'running')} - ${deriveNextRunAction(activeRun)}`
        : 'Ask Zavorth in the Inbox. When a request could change files, call tools, or touch external state, Zavorth will preview the risk and ask for approval.';
    }

    const approvalTitle = document.querySelector('[data-dashboard-approval-title]');
    const approvalText = document.querySelector('[data-dashboard-approval-text]');
    if (approvalTitle) approvalTitle.textContent = pendingApprovals ? `${pendingApprovals} pending approval${pendingApprovals === 1 ? '' : 's'}` : 'No pending approvals';
    if (approvalText) {
      approvalText.textContent = pendingApprovals
        ? 'Review before allowing changes or tool access.'
        : 'When Zavorth needs a decision, it appears here with approve, deny, or adjust scope.';
    }

    const inboxApprovalBanner = document.getElementById('approval-context-banner');
    if (inboxApprovalBanner) inboxApprovalBanner.hidden = pendingApprovals <= 0;
    const inboxApprovalTitle = document.querySelector('[data-inbox-approval-title]');
    const inboxApprovalText = document.querySelector('[data-inbox-approval-text]');
    if (inboxApprovalTitle) inboxApprovalTitle.textContent = pendingApprovals ? `${pendingApprovals} pending approval${pendingApprovals === 1 ? '' : 's'}` : 'No pending approvals';
    if (inboxApprovalText) {
      inboxApprovalText.textContent = pendingApprovals
        ? 'Review before Zavorth changes files, tools, or external state.'
        : 'Risky actions appear here before Zavorth acts.';
    }

    updatePremiumStatus('Dashboard', state.auth?.webReady ? 'online' : 'local', state.auth?.webReady ? 'ok' : 'info');
    updatePremiumStatus('Sensitive actions', pendingApprovals ? 'waiting' : 'approval gated', pendingApprovals ? 'warn' : 'ok');
  }

  function updateRecentActivityTable() {
    const section = document.getElementById('sector-overview');
    const tables = Array.from(section?.querySelectorAll('table.data-table') || []);
    const tbody = tables[tables.length - 1]?.querySelector('tbody');
    if (!tbody) return;

    const rows = runEventRows(8);
    if (rows.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td class="mono">${formatDate(state.zavorthControl?.generatedAt || state.updatedAt)}</td>
          <td>No live run registered yet</td>
          <td class="mono">agent-gateway</td>
          <td>${statusBadge(state.zavorthControl?.authRequired ? 'auth' : 'ready', state.zavorthControl?.authRequired ? 'Protected' : 'Ready')}</td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = rows.map(({ run, event }) => `
      <tr data-zavorth-run-id="${escapeHtml(run.id || '')}" data-zavorth-trace-id="${escapeHtml(run.traceId || event.traceId || '')}" data-zavorth-session-id="${escapeHtml(run.sessionId || event.sessionId || '')}" title="Open this run replay">
        <td class="mono">${formatDate(event.createdAt || run.updatedAt || run.createdAt)}</td>
        <td>${escapeHtml(text(event.title || event.detail || run.summary, run.title || run.id))}</td>
        <td class="mono">${escapeHtml(text(run.title, run.id))}</td>
        <td>${statusBadge(event.status || run.status || event.kind, text(event.status || run.status || event.kind, 'event'))}</td>
        <td><button class="bcc-trace-link" type="button" data-zavorth-trace-action="open" data-run-id="${escapeHtml(run.id || '')}" data-trace-id="${escapeHtml(run.traceId || event.traceId || '')}" data-session-id="${escapeHtml(run.sessionId || event.sessionId || '')}">View trace</button></td>
      </tr>
    `).join('');
  }

  function updateSessionsTable() {
    const section = document.getElementById('sector-sessions');
    const tbody = section?.querySelector('tbody');
    if (!tbody) return;
    const headers = Array.from(section?.querySelectorAll('thead th') || []);
    ['Run', 'Channel', 'Events', 'Artifacts', 'Next action', 'Updated', 'Status'].forEach((label, index) => {
      if (headers[index]) headers[index].textContent = label;
    });

    const runs = getRuns();

    if (runs.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td class="mono">runtime local</td>
          <td>Web</td>
          <td>0</td>
          <td>---</td>
          <td>${state.zavorthControl?.authRequired ? 'Unlock runtime' : 'Wait for first run'}</td>
          <td>${formatDate(state.zavorthControl?.generatedAt || state.updatedAt)}</td>
          <td>${statusBadge(state.zavorthControl?.authRequired ? 'auth' : 'ready', state.zavorthControl?.authRequired ? 'Protected' : 'Ready')}</td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = runs.slice(0, 8).map((run) => `
      <tr data-zavorth-run-id="${escapeHtml(run.id || '')}" data-zavorth-trace-id="${escapeHtml(run.traceId || '')}" data-zavorth-session-id="${escapeHtml(run.sessionId || '')}" title="Open this run replay">
        <td class="mono">${escapeHtml(text(run.title, run.id))}</td>
        <td>${text(run.channel, 'Web')}</td>
        <td>${Array.isArray(run.events) ? run.events.length : 0}</td>
        <td>${Array.isArray(run.artifacts) ? run.artifacts.length : 0}</td>
        <td>${escapeHtml(deriveNextRunAction(run))}</td>
        <td>${formatDate(run.updatedAt || run.createdAt)}</td>
        <td>${statusBadge(run.status, text(run.status, 'Ready'))}</td>
        <td><button class="bcc-trace-link" type="button" data-zavorth-trace-action="open" data-run-id="${escapeHtml(run.id || '')}" data-trace-id="${escapeHtml(run.traceId || '')}" data-session-id="${escapeHtml(run.sessionId || '')}">View trace</button></td>
      </tr>
    `).join('');
  }

  function updateInstancesTable() {
    const section = document.getElementById('sector-instances');
    const tbody = section?.querySelector('tbody');
    if (!tbody) return;
    const headers = Array.from(section?.querySelectorAll('thead th') || []);
    ['Item', 'Source', 'Artifacts', 'Decision', 'Updated', 'Status'].forEach((label, index) => {
      if (headers[index]) headers[index].textContent = label;
    });

    const runs = getRuns();
    const historyTitle = section.querySelector('[data-history-title]');
    const historySummary = section.querySelector('[data-history-summary]');
    if (historyTitle) {
      historyTitle.textContent = runs.length ? `${numberLabel(runs.length)} recorded run${runs.length === 1 ? '' : 's'}` : 'No completed work yet';
    }
    if (historySummary) {
      historySummary.textContent = runs.length
        ? 'Recent runs show status, decisions, artifacts and replay links in one readable place.'
        : 'After a mission, this area shows files touched, tools used, approvals, blocked risks, cost and rollback notes.';
    }

    if (runs.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td class="mono">none yet</td>
          <td>Web</td>
          <td>0</td>
          <td>${state.zavorthControl?.authRequired ? 'Unlock runtime' : 'Ask Zavorth first'}</td>
          <td>${formatDate(state.updatedAt)}</td>
          <td>${statusBadge(state.zavorthControl?.authRequired ? 'auth' : 'waiting', state.zavorthControl?.authRequired ? 'Protected' : 'Waiting')}</td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = runs.slice(0, 8).map((run) => {
      const approvals = pendingRunApprovals(run);
      const decision = approvals.length ? `${approvals.length} approval${approvals.length === 1 ? '' : 's'} pending` : deriveNextRunAction(run);
      return `
        <tr data-zavorth-run-id="${escapeHtml(run.id || '')}" data-zavorth-trace-id="${escapeHtml(run.traceId || '')}" data-zavorth-session-id="${escapeHtml(run.sessionId || '')}" title="Open this run replay">
          <td class="mono">${escapeHtml(runTitle(run, 'run'))}</td>
          <td>${escapeHtml(text(run.channel || run.source || run.surface, 'Web'))}</td>
          <td>${numberLabel(runArtifactCount(run))}</td>
          <td>${escapeHtml(decision)}</td>
          <td>${formatDate(run.updatedAt || run.createdAt)}</td>
          <td>${statusBadge(run.status, text(run.status, 'Ready'))}</td>
        </tr>
      `;
    }).join('');
  }

  function updateConfig() {
    const configSection = document.getElementById('sector-config');
    if (!configSection) return;
    const modelProfile = resolveCurrentModelProfile();
    const rows = Array.from(configSection.querySelectorAll('.info-row'));
    rows.forEach((row) => {
      const label = row.querySelector('.info-row__label')?.textContent.trim().toLowerCase();
      const value = row.querySelector('.info-row__value');
      if (!value) return;
      if (label === 'endpoint') value.textContent = `${location.origin}/api`;
      if (label === 'auth') value.textContent = state.zavorthControl?.authRequired ? 'Local token required' : 'Local session';
      if (label === 'status') value.innerHTML = statusBadge(state.auth?.webReady ? 'ready' : 'degraded', state.auth?.webReady ? 'Connected' : 'Local');
      if (label === 'chat') value.textContent = modelProfile.modelLabel;
      if (label === 'agents') value.textContent = modelProfile.modelLabel;
      if (label === 'fallback') value.textContent = modelProfile.fallbackModelLabel || 'not configured';
      if (label === 'protocol') value.textContent = `${modelProfile.providerLabel} - ${getCurrentModelRouteLabel()}`;
    });

    updatePremiumStatus('Auto approvals', pendingApprovalCount() ? 'attention' : 'limited', pendingApprovalCount() ? 'warn' : 'info');
    updatePremiumStatus('Break-glass', 'locked', 'warn');
    updatePremiumStatus('Receipts', totalArtifactCount() ? `${totalArtifactCount()} visible` : 'on', 'ok');
    updatePremiumStatus('Secrets', 'redacted', 'ok');
  }

  function badgeToneForStatus(status) {
    const normalized = String(status || '').trim().toLowerCase();
    if (['ok', 'ready', 'online', 'connected', 'running', 'active', 'completed', 'done', 'success'].some((entry) => normalized.includes(entry))) {
      return 'ok';
    }
    if (['warn', 'pending', 'waiting', 'queued', 'protected', 'auth', 'standby', 'idle'].some((entry) => normalized.includes(entry))) {
      return 'warn';
    }
    if (['error', 'fail', 'blocked', 'offline', 'cancelled', 'rejected', 'danger'].some((entry) => normalized.includes(entry))) {
      return 'danger';
    }
    return 'info';
  }

  function entityCardHtml(input) {
    const title = escapeHtml(text(input?.title, 'Runtime'));
    const id = escapeHtml(text(input?.id, ''));
    const status = escapeHtml(text(input?.status, 'Waiting'));
    const tone = input?.tone || badgeToneForStatus(status);
    const detail = escapeHtml(text(input?.detail, 'No real data published yet.'));
    const meta = input?.meta ? `<div class="entity-card__meta">${input.meta}</div>` : '';
    return `
      <div class="entity-card">
        <div class="entity-card__header">
          <div>
            <div class="entity-card__name">${title}</div>
            ${id ? `<div class="entity-card__id">${id}</div>` : ''}
          </div>
          <span class="badge badge--${tone}"><span class="badge__dot"></span>${status}</span>
        </div>
        <div class="entity-card__desc">${detail}</div>
        ${meta}
      </div>
    `;
  }

  function setCardGrid(sectionId, html) {
    const grid = document.querySelector(`#${sectionId} .card-grid`);
    if (grid) grid.innerHTML = html;
  }

  function setTableHeaders(sectionId, labels) {
    const headers = Array.from(document.querySelectorAll(`#${sectionId} thead th`));
    labels.forEach((label, index) => {
      if (headers[index]) headers[index].textContent = label;
    });
  }

  function setTableBody(sectionId, html) {
    const tbody = document.querySelector(`#${sectionId} tbody`);
    if (tbody) tbody.innerHTML = html;
  }

  function pendingApprovalCount() {
    return getRuns().reduce((count, run) => count + pendingRunApprovals(run).length, 0);
  }

  function runArtifactCount(run) {
    return Array.isArray(run?.artifacts) ? run.artifacts.length : 0;
  }

  function totalArtifactCount() {
    const runArtifacts = getRuns().reduce((count, run) => count + runArtifactCount(run), 0);
    return Math.max(runArtifacts, Array.isArray(state.artifacts) ? state.artifacts.length : 0);
  }

  function firstReadyChannelLabel() {
    const ids = configuredChannelIds();
    const priority = ['web', 'dashboard', 'local'];
    const match = priority.find((id) => ids.has(id));
    if (!match) return ids.size > 3 ? 'Remote' : 'Local';
    if (match === 'web' || match === 'dashboard') return 'Web';
    return match.charAt(0).toUpperCase() + match.slice(1);
  }

  function memoryTelemetryLabel() {
    const tools = collectToolExposures();
    const hasMnemos = tools.some((tool) => /mnemos|memory|file understanding/i.test(`${tool.id} ${tool.title} ${tool.summary}`));
    const snapshot = state.gatewayRuntime?.snapshot || state.gatewayRuntime || {};
    const memoryStatus = String(
      snapshot?.memory?.status
      || snapshot?.mnemos?.status
      || state.zavorthControl?.snapshot?.memory?.status
      || state.zavorthControl?.snapshot?.mnemos?.status
      || '',
    ).trim();
    if (memoryStatus) return memoryStatus;
    return hasMnemos ? 'Ready' : 'Scope needed';
  }

  function controlCostLabel() {
    const total = sumRunNumbers([
      'usage.cost',
      'usage.totalCost',
      'cost',
      'totalCost',
      'billing.costUsd',
      'billing.totalCostUsd',
    ]);
    return formattedMoney(total);
  }

  function updateControlTelemetryRail() {
    const modelProfile = resolveCurrentModelProfile();
    const pending = pendingApprovalCount();
    const receipts = totalArtifactCount();
    const skillCount = getAvailableSkills().filter((skill) => !/disabled/i.test(String(skill.status || ''))).length;
    const live = Boolean(state.zavorthControl?.live);
    const protectedRuntime = Boolean(state.zavorthControl?.authRequired);
    const gatewayLabel = state.realtime.connected
      ? 'Live'
      : live
        ? 'Unlocked'
        : protectedRuntime
          ? 'Protected'
          : state.auth?.webReady
            ? 'Ready'
            : 'Local';

    setControlTelemetry('model', modelProfile.modelLabel || 'Auto');
    setControlTelemetry('provider', `${modelProfile.providerLabel || 'Provider'} - ${getCurrentModelRouteLabel()}`);
    setControlTelemetry('gateway', gatewayLabel);
    setControlTelemetry('approvals', pending ? `${pending} pending` : '0');
    setControlTelemetry('receipts', String(receipts || 0));
    setControlTelemetry('channel', firstReadyChannelLabel());
    setControlTelemetry('memory', memoryTelemetryLabel());
    setControlTelemetry('skills', skillCount > 0 ? `${skillCount} ready` : 'Checking');
    setControlTelemetry('cost', controlCostLabel());
  }

  function runTitle(run, fallback = 'Workspace session') {
    const candidates = [
      run?.title,
      run?.name,
      run?.summary,
      run?.goal,
      run?.prompt,
      run?.id,
    ];
    const value = candidates.map((candidate) => String(candidate || '').trim()).find(Boolean);
    if (!value) return fallback;
    return value.length > 38 ? `${value.slice(0, 35).trim()}...` : value;
  }

  function runSubtitle(run) {
    const status = text(run?.status, 'ready');
    const next = deriveNextRunAction(run);
    const channel = text(run?.channel || run?.source || run?.surface, firstReadyChannelLabel());
    if (next && next !== 'No active run') return `${status} - ${next}`;
    return `${status} - ${channel}`;
  }

  function runPrompt(run) {
    const id = text(run?.id || run?.runId || run?.traceId, 'current');
    return `Open run ${id}. Show status, next action, approvals, receipts and trace.`;
  }

  function controlSessionItemHtml(run, isActive) {
    const status = normalizeRunStatus(run?.status);
    const tone = badgeToneForStatus(status);
    const live = isRunLive(run) || tone === 'warn';
    const attrs = [
      ['data-prompt', runPrompt(run)],
      ['data-run-id', run?.id || run?.runId || ''],
      ['data-session-id', run?.sessionId || run?.session?.id || ''],
      ['data-trace-id', run?.traceId || run?.trace?.id || ''],
      ['data-run-status', status],
    ]
      .filter(([, value]) => String(value || '').trim())
      .map(([key, value]) => `${key}="${escapeHtml(value)}"`)
      .join(' ');

    return `
      <button class="control-session-item${isActive ? ' is-active' : ''}" type="button" ${attrs}>
        <span class="control-session-item__dot${live ? '' : ' control-session-item__dot--muted'} control-session-item__dot--${tone}"></span>
        <span>
          <strong>${escapeHtml(runTitle(run))}</strong>
          <small>${escapeHtml(runSubtitle(run))}</small>
        </span>
      </button>
    `;
  }

  function fallbackControlSessionItemsHtml() {
    return [
      {
        title: 'Main workspace',
        subtitle: state.realtime.connected ? 'Live gateway connected' : 'Local gateway ready',
        prompt: 'Show the current main session status.',
        active: true,
      },
      {
        title: 'Documents',
        subtitle: `${memoryTelemetryLabel()} memory`,
        prompt: 'Show recent document and Mnemos work.',
      },
      {
        title: 'Review queue',
        subtitle: `${pendingApprovalCount()} approvals - ${totalArtifactCount()} receipts`,
        prompt: 'Show recent reviews, approvals and receipts.',
      },
    ].map((item) => `
      <button class="control-session-item${item.active ? ' is-active' : ''}" type="button" data-prompt="${escapeHtml(item.prompt)}">
        <span class="control-session-item__dot${item.active ? '' : ' control-session-item__dot--muted'}"></span>
        <span>
          <strong>${escapeHtml(item.title)}</strong>
          <small>${escapeHtml(item.subtitle)}</small>
        </span>
      </button>
    `).join('');
  }

  function controlRailLinkHtml(label, prompt, attention = false) {
    return `
      <button class="control-rail-link" type="button" data-attention="${attention ? 'true' : 'false'}" data-prompt="${escapeHtml(prompt)}">
        ${escapeHtml(label)}
      </button>
    `;
  }

  function updateControlSessionRail() {
    const list = document.querySelector('[data-control-session-list]');
    if (list) {
      const runs = getRuns()
        .slice()
        .sort((a, b) => new Date(b?.updatedAt || b?.createdAt || 0).getTime() - new Date(a?.updatedAt || a?.createdAt || 0).getTime())
        .slice(0, 5);
      const active = getActiveRun();
      list.innerHTML = runs.length
        ? runs.map((run, index) => controlSessionItemHtml(run, String(run?.id || '') === String(active?.id || '') || (!active && index === 0))).join('')
        : fallbackControlSessionItemsHtml();
    }

    const shortcuts = document.querySelector('[data-control-session-shortcuts]');
    if (!shortcuts) return;
    const approvals = pendingApprovalCount();
    const receipts = totalArtifactCount();
    const skillCount = getAvailableSkills().filter((skill) => !/disabled/i.test(String(skill.status || ''))).length;
    shortcuts.innerHTML = [
      controlRailLinkHtml(
        approvals ? `Approvals (${approvals})` : 'Approvals',
        'Show pending approvals with accept or reject actions.',
        approvals > 0,
      ),
      controlRailLinkHtml(
        receipts ? `Receipts (${receipts})` : 'Receipts',
        'Show recent receipts and what changed.',
        receipts > 0,
      ),
      controlRailLinkHtml(
        skillCount ? `Tools (${skillCount})` : 'Tools',
        'Open tools and suggest what is useful for this workspace.',
        skillCount > 0,
      ),
      controlRailLinkHtml(
        `Input (${firstReadyChannelLabel()})`,
        'Show active input routes and suggest the next safe setup step.',
        firstReadyChannelLabel() !== 'Local',
      ),
    ].join('');
  }

  function collectChannelStats() {
    const stats = new Map();
    for (const run of getRuns()) {
      const channel = text(run?.channel, 'Web');
      const key = channel.toLowerCase();
      const current = stats.get(key) || {
        title: channel,
        runs: 0,
        lastStatus: 'Ready',
        lastUpdatedAt: run?.updatedAt || run?.createdAt,
      };
      current.runs += 1;
      current.lastStatus = text(run?.status, current.lastStatus);
      current.lastUpdatedAt = run?.updatedAt || run?.createdAt || current.lastUpdatedAt;
      stats.set(key, current);
    }
    return Array.from(stats.values());
  }

  function updateChannels() {
    const channels = collectChannelStats();
    const baseCards = [
      entityCardHtml({
        title: 'Dashboard',
        id: 'web:/dashboard',
        status: state.zavorthControl?.live ? 'Online' : state.zavorthControl?.authRequired ? 'Protected' : 'Local',
        detail: state.zavorthControl?.authRequired
          ? 'Live data requires the local token before it appears here.'
          : 'Dashboard connected to the local web surface.',
      }),
      entityCardHtml({
        title: 'Realtime',
        id: '/api/web/events',
        status: state.realtime.connected ? 'Live' : state.realtime.connecting ? 'Connecting' : 'Waiting for session',
        detail: state.realtime.connected
          ? `Latest event: ${text(state.realtime.lastEventType, 'stream')}`
          : 'The live stream starts when there is an unlocked live session.',
      }),
    ];

    const channelCards = channels.map((channel) => entityCardHtml({
      title: channel.title,
      id: `${channel.runs} run(s)`,
      status: channel.lastStatus,
      detail: `Latest signal: ${formatDate(channel.lastUpdatedAt)}`,
    }));

    setCardGrid('sector-channels', [...baseCards, ...channelCards].join(''));
  }

  function salesPackSnapshot() {
    const payload = state.salesPack || {};
    return payload?.data || payload?.snapshot || payload || {};
  }

  function channelIoSnapshot() {
    const payload = state.salesPackChannelIo || {};
    return payload?.data || payload?.channelIo || payload || {};
  }

  function latestSalesSignal() {
    const crm = salesPackSnapshot()?.sourceSnapshots?.crm;
    return Array.isArray(crm) && crm.length > 0 ? crm[0] : null;
  }

  function setSalesOsText(selector, value) {
    document.querySelectorAll(selector).forEach((node) => {
      node.textContent = String(value);
    });
  }

  function updateSalesOs() {
    const sales = salesPackSnapshot();
    const channel = channelIoSnapshot();
    const summary = sales?.summary || {};
    const channelSummary = channel?.summary || {};
    const signal = latestSalesSignal();
    const inbox = Array.isArray(sales?.sourceSnapshots?.inbox) ? sales.sourceSnapshots.inbox : [];
    const events = Array.isArray(channel?.sourceSnapshots?.recentEvents)
      ? channel.sourceSnapshots.recentEvents
      : [];

    setSalesOsText('[data-sales-os-metric="conversations"]', numberLabel(summary.conversations || inbox.length || 0));
    setSalesOsText('[data-sales-os-meta="conversations"]', inbox.length ? `${inbox.length} conversation(s) in inbox` : 'no conversation received');
    setSalesOsText('[data-sales-os-metric="score"]', numberLabel(signal?.leadScore || 0));
    setSalesOsText('[data-sales-os-meta="score"]', signal?.nextAction || 'waiting for a sales signal');
    setSalesOsText('[data-sales-os-metric="processed"]', numberLabel(channelSummary.processed || 0));
    setSalesOsText('[data-sales-os-meta="processed"]', `${numberLabel(channelSummary.inboundReceived || 0)} inbound received`);
    setSalesOsText('[data-sales-os-metric="approvals"]', numberLabel(summary.pendingApprovals || 0));
    setSalesOsText('[data-sales-os-meta="approvals"]', summary.pendingApprovals ? 'approval required before sensitive action' : 'no pending approvals');

    const grid = document.querySelector('[data-sales-os-grid]');
    if (!grid) return;
    grid.innerHTML = [
      entityCardHtml({
        title: 'Unified Inbox',
        id: inbox[0]?.id || 'conversations',
        status: inbox[0]?.status || (inbox.length ? 'Open' : 'Demo ready'),
        detail: inbox[0]?.summary || 'Receive local inbound or WhatsApp Cloud API events and track the lead in Sales Pack.',
      }),
      entityCardHtml({
        title: 'Smart CRM',
        id: signal?.customerId || 'lead score',
        status: signal?.stage || 'Waiting for signal',
        detail: signal?.explanation || 'Intent, objection, risk and next action appear here after the first conversation.',
      }),
      entityCardHtml({
        title: 'Channel I/O',
        id: `${channel?.mode || 'demo'} / ${channelSummary.knownMessageIds || 0} ids`,
        status: `${numberLabel(channelSummary.processed || 0)} processed`,
        detail: channel?.narrative?.operatorSummary || 'Idempotency, status and receipts stay visible in the channel ledger.',
      }),
      entityCardHtml({
        title: 'Agent Builder',
        id: 'AgentProfile',
        status: `${numberLabel(summary.agentProfiles || 5)} profiles`,
        detail: 'Sales, support, recovery, CRM and supervisor profiles enter through core contracts.',
      }),
      entityCardHtml({
        title: 'Policy Simulator',
        id: 'dry-run',
        status: summary.pendingApprovals ? 'Approval required' : 'Governed',
        detail: 'Sensitive actions go through preview before live execution.',
      }),
      entityCardHtml({
        title: 'Agent Mesh',
        id: 'Maestro',
        status: state.zavorthControl?.snapshot?.agentMesh ? 'Connected' : 'Auditable',
        detail: 'External agents appear as governed arms of Zavorth.',
      }),
      entityCardHtml({
        title: 'Audit Trail',
        id: `${numberLabel(events.length)} event(s)`,
        status: events[0]?.kind || 'Append-only',
        detail: events[0]?.summary || 'Channel, agent and decision events stay ready for debug and replay.',
      }),
    ].join('');
  }

  function updateAgents() {
    const runs = getRuns();
    if (runs.length === 0) {
      setCardGrid('sector-agents', entityCardHtml({
        title: 'Agent Gateway',
        id: getCurrentModelLabel(),
        status: state.zavorthControl?.authRequired ? 'Protected' : 'Waiting',
        detail: state.zavorthControl?.authRequired
          ? 'Unlock with the local token to list live runs.'
          : 'No live run has been registered yet. When you talk to Zavorth, executions appear here.',
        meta: `<span class="badge badge--muted">${escapeHtml(getCurrentModelLabel())}</span>`,
      }));
      return;
    }

    setCardGrid('sector-agents', runs.slice(0, 6).map((run) => {
      const event = latestRunEvent(run);
      return entityCardHtml({
        title: text(run.title, run.id),
        id: text(run.id, 'agent-run'),
        status: text(run.status, 'Ready'),
        detail: text(event?.title || event?.detail || run.summary || run.objective, deriveNextRunAction(run)),
        meta: `<span class="badge badge--muted">${escapeHtml(normalizeModelProfile(run.modelProfile)?.modelLabel || getCurrentModelLabel())}</span>`,
      });
    }).join(''));
  }

  function normalizeToolEntry(entry) {
    if (!entry) return null;
    const id = String(entry?.id || entry?.name || entry?.tool || entry?.capabilityId || '').trim();
    if (!id) return null;
    return {
      id,
      title: String(entry?.title || entry?.name || entry?.tool || id).trim(),
      summary: String(entry?.summary || entry?.description || entry?.reason || 'Tool exposed by a live run.').trim(),
      status: String(entry?.status || entry?.mode || entry?.risk || 'available').trim(),
      enabled: entry?.enabled !== false,
    };
  }

  function collectToolExposures() {
    const candidates = [];
    for (const run of getRuns()) {
      if (Array.isArray(run?.toolExposure?.tools)) candidates.push(...run.toolExposure.tools);
      if (Array.isArray(run?.tools)) candidates.push(...run.tools);
      if (Array.isArray(run?.capabilities)) candidates.push(...run.capabilities);
      const approvals = Array.isArray(run?.approvals) ? run.approvals : [];
      for (const approval of approvals) {
        candidates.push({
          id: approval?.tool || approval?.capabilityId || approval?.title || approval?.id,
          title: approval?.tool || approval?.title || 'approval',
          summary: approval?.summary || approval?.reason || 'Tool is waiting for the operator decision.',
          status: approval?.status || 'pending',
        });
      }
    }

    const catalogEntries = [
      state.catalog?.tools,
      state.catalog?.skills,
      state.catalog?.catalog?.tools,
      state.catalog?.catalog?.skills,
    ];
    for (const entryList of catalogEntries) {
      if (Array.isArray(entryList)) candidates.push(...entryList);
    }

    const byId = new Map();
    for (const candidate of candidates) {
      const tool = normalizeToolEntry(candidate);
      if (tool) byId.set(tool.id, tool);
    }
    return Array.from(byId.values());
  }

  function getAvailableSkills() {
    return collectToolExposures().map((tool) => ({
      id: tool.id,
      title: tool.title,
      summary: tool.summary,
      status: tool.enabled ? tool.status : 'disabled',
      prompt: `Use ${tool.title || tool.id} in this request, respecting the required approvals.`,
    }));
  }

  function updateSkills() {
    const tools = collectToolExposures();
    const premiumList = document.querySelector('#sector-skills .premium-skill-list');
    const skillFilterFor = (tool) => {
      const haystack = `${tool.status || ''} ${tool.summary || ''}`.toLowerCase();
      if (!tool.enabled || /setup|scope|consent|config|credential|token/.test(haystack)) return 'setup';
      if (/approval|preview|blocked|gated|simulation|simulate/.test(haystack)) return 'approval';
      return 'ready';
    };
    const renderSkillRow = (tool) => {
      const filter = skillFilterFor(tool);
      const title = text(tool.title || tool.id, 'Tool');
      const summary = text(tool.summary, 'No description published yet.');
      const status = text(tool.enabled ? text(tool.status, 'ready') : 'disabled', 'ready');
      const prompt = `Use ${title} in this request, respecting approvals and scope.`;
      const search = `${title} ${summary} ${status}`.toLowerCase();
      return `
      <article class="skill-row skill-row--${tool.enabled ? 'ok' : 'info'}" data-skill-row data-skill-status="${escapeHtml(filter)}" data-skill-search-text="${escapeHtml(search)}">
        <div>
          <h2>${escapeHtml(title)}</h2>
          <p>${escapeHtml(summary)}</p>
        </div>
        <span>${escapeHtml(status)}</span>
        <button type="button" class="skill-row__use" data-dashboard-prompt="${escapeHtml(prompt)}">Use</button>
      </article>
    `;
    };

    if (premiumList) {
      const rows = tools.length > 0 ? tools.slice(0, 12) : [
        {
          title: 'Review workspace',
          summary: 'Reads the project in read-only mode and highlights clear risks.',
          status: state.auth?.webReady ? 'ready' : 'local',
          enabled: true,
        },
        {
          title: 'Understand files',
          summary: 'Uses only approved folders to explain documents.',
          status: 'needs scope',
          enabled: true,
        },
        {
          title: 'Tool curator',
          summary: 'Suggests improvements without changing anything before approval.',
          status: 'preview first',
          enabled: true,
        },
        {
          title: 'Connect external agent',
          summary: 'Creates a profile only from a path you provide.',
          status: 'consent required',
          enabled: true,
        },
      ];
      premiumList.innerHTML = rows.map(renderSkillRow).join('');
    }

    const readyCount = tools.filter((tool) => tool.enabled && skillFilterFor(tool) === 'ready').length;
    const approvalCount = tools.filter((tool) => skillFilterFor(tool) === 'approval').length;
    const latestTool = runEventRows(20).find(({ event }) => /tool|capability|terminal|artifact|mcp/i.test(`${event?.title || ''} ${event?.detail || ''}`));
    setLiveStripValue('[data-tools-live-count]', tools.length || 0);
    setLiveStripValue('[data-tools-live-ready]', tools.length ? `${readyCount} ready / ${approvalCount} gated` : state.zavorthControl?.authRequired ? 'unlock required' : 'waiting');
    setLiveStripValue('[data-tools-live-last]', latestTool ? text(latestTool.event?.title || latestTool.event?.detail, 'tool event') : 'no tool yet');

    updatePremiumStatus('New tools', 'approval gated', 'ok');
    updatePremiumStatus('Changes', eventCountMatching(/skill.*merge|curator/i) ? 'available' : 'preview first', 'info');
    updatePremiumStatus('External sources', 'blocked', 'ok');
    updatePremiumStatus('Undo', totalArtifactCount() ? 'receipt backed' : 'ready', 'ok');

    if (tools.length === 0) {
      setCardGrid('sector-skills', entityCardHtml({
        title: 'Active run tools',
        id: 'live runtime',
        status: state.zavorthControl?.authRequired ? 'Protected' : 'Waiting',
        detail: state.zavorthControl?.authRequired
          ? 'Unlock the dashboard to read live tools.'
          : 'No tool is exposed by an active run right now.',
      }));
      return;
    }
    setCardGrid('sector-skills', tools.slice(0, 12).map((tool) => entityCardHtml({
      title: tool.title,
      id: tool.id,
      status: tool.enabled ? tool.status : 'disabled',
      detail: tool.summary,
    })).join(''));
  }

  const {
    updateProviderActivation,
    updateProviderModelCatalog,
  } = createRuntimeProviderPanels({
    entityCardHtml,
    escapeHtml,
    numberLabel,
    state,
  });

  const {
    updateCron,
    updateNodes,
    updateUsage,
  } = createRuntimeOperationsPanels({
    collectToolExposures,
    escapeHtml,
    eventCountMatching,
    formatDate,
    formattedMoney,
    getCurrentModelLabel,
    getCurrentModelRouteLabel,
    getCurrentProviderLabel,
    getRuns,
    getWorkflowJobs,
    numberLabel,
    pendingApprovalCount,
    resolveCurrentModelProfile,
    runArtifactCount,
    setLiveStripValue,
    setTableBody,
    setTableHeaders,
    state,
    statusBadge,
    sumRunNumbers,
    text,
    totalArtifactCount,
    updatePlatformAction,
    updatePremiumMetric,
    updatePremiumStatus,
    updateSummaryCard,
  });

  function renderArtifactsFromPayload(payload, ui = {}, options = {}) {
    const artifacts = extractArtifacts(payload);
    state.artifacts = artifacts;
    state.artifactsById = new Map(artifacts.map((artifact) => [artifact.id, artifact]));
    if (typeof ui.renderArtifacts !== 'function' || !shouldDisplayArtifactsInChat(payload, options)) {
      return false;
    }
    return ui.renderArtifacts(artifacts, {
      reason: options.reason || 'execution-result',
      source: options.source || 'runtime',
    });
  }

  function diffPreviewBodyHtml(preview) {
    const receipt = preview.diffReceiptText
      ? preview.diffReceiptText.split('\n').slice(0, 10).join('\n')
      : preview.summary;
    const runLine = preview.runId ? `<div class="zavorth-permission-card__meta">Run: ${escapeHtml(preview.runId)}</div>` : '';
    const planLine = preview.planId ? `<div class="zavorth-permission-card__meta">Plan: ${escapeHtml(preview.planId)}</div>` : '';
    return `
      <div class="zavorth-permission-card__panel">
        <div class="zavorth-permission-card__request">
          <span class="zavorth-permission-card__eyebrow">Intelligence Fabric</span>
          <span class="zavorth-permission-card__risk">Risk 3</span>
        </div>
        <div class="zavorth-permission-card__title">${escapeHtml(preview.title)}</div>
        <div class="zavorth-permission-card__summary">${escapeHtml(preview.summary)}</div>
        <pre class="logic-cell__block-content" style="white-space:pre-wrap;max-height:220px;overflow:auto;margin:6px 0 0;">${escapeHtml(receipt)}</pre>
        ${planLine}
        ${runLine}
        <div class="zavorth-permission-card__meta">${escapeHtml(preview.actions.rollbackLabel)}: ${escapeHtml(preview.actions.rollbackInstruction)}</div>
      </div>
    `;
  }

  function renderDiffPreviewsFromPayload(payload = state.zavorthControl || {}) {
    const neuralFeed = document.getElementById('neural-feed');
    if (!neuralFeed) return false;
    neuralFeed.querySelectorAll('#zavorth-diff-previews-group').forEach((node) => node.remove());
    const previews = extractDiffPreviews(payload).slice(0, 3);
    if (previews.length === 0) return false;

    const terminalView = document.getElementById('terminal-view');
    if (terminalView) terminalView.classList.remove('is-empty');

    const group = document.createElement('div');
    group.id = 'zavorth-diff-previews-group';
    group.className = 'echo-group core b-fade-in';
    group.innerHTML = `
      <div class="echo-avatar core">Z</div>
      <div class="echo-group__messages">
        <div class="echo-group__header">
          <span class="echo-sender">Zavorth</span>
          <span class="echo-timestamp">${formatDate(new Date().toISOString())}</span>
          <span class="echo-meta"><span class="echo-meta__model">Run Observatory</span></span>
        </div>
        <div class="echo-bubble">
          Change preview ready for review. The apply action below calls the live Mutation Plane.
        </div>
        ${previews.map((preview) => `
          <div class="zavorth-permission-card zavorth-diff-preview-card" data-status="${preview.applied ? 'applied' : 'pending'}" data-zavorth-diff-preview-id="${escapeHtml(preview.id)}">
            <div class="zavorth-permission-card__state">${preview.applied ? 'Applied' : 'Waiting for controlled apply'}</div>
            ${diffPreviewBodyHtml(preview)}
            <div class="zavorth-permission-card__actions">
              <button
                class="zavorth-permission-card__btn zavorth-permission-card__btn--primary"
                type="button"
                data-zavorth-diff-apply="true"
                data-plan-id="${escapeHtml(preview.planId)}"
                data-run-id="${escapeHtml(preview.runId)}"
                data-session-id="${escapeHtml(preview.sessionId)}"
                ${preview.applied || !preview.planId ? 'disabled' : ''}
              >${preview.applied ? 'Applied' : escapeHtml(preview.actions.approveApplyLabel)}</button>
              <button class="zavorth-permission-card__btn" type="button" data-zavorth-diff-run="${escapeHtml(preview.runId)}">run</button>
              <button class="zavorth-permission-card__btn zavorth-permission-card__btn--caret" type="button" disabled>OK</button>
            </div>
          </div>
        `).join('')}
      </div>
    `;
    neuralFeed.appendChild(group);
    window.ZavorthControlChat?.scrollFeedToEnd?.();
    return true;
  }

  function isTextArtifact(artifact) {
    const extension = extensionOf(artifact?.path || artifact?.name || artifact?.title);
    return ['txt', 'md', 'json', 'csv', 'ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs', 'py', 'html', 'css', 'yml', 'yaml', 'toml', 'ini', 'log', 'sql', 'xml', 'svg', 'sh', 'ps1'].includes(extension);
  }

  function isVisualAsset(artifact) {
    const extension = extensionOf(artifact?.path || artifact?.name || artifact?.title);
    return ['pdf', 'png', 'jpg', 'jpeg', 'gif', 'webp'].includes(extension);
  }

  function artifactMetadataHtml(artifact) {
    const rows = [
      ['Type', artifact.kind],
      ['Source', artifact.source],
      ['Path', artifact.path],
      ['Run', artifact.runId || artifact.toolRunId],
      ['Status', artifact.status],
    ].filter(([, value]) => String(value || '').trim());
    if (rows.length === 0) return '';
    return `<div class="artifact-render">${rows.map(([label, value]) => `${escapeHtml(label)}: ${escapeHtml(value)}`).join('\n')}</div>`;
  }

  function artifactFallbackHtml(artifact, message = '') {
    const summary = message || artifact.summary || artifact.path || 'Zavorth registered this artifact, but no text preview is available.';
    return [
      `<div class="empty-state"><div class="empty-state__icon">Doc</div><div class="empty-state__title">${escapeHtml(artifact.title || 'Artifact')}</div><div class="empty-state__desc">${escapeHtml(summary)}</div></div>`,
      artifactMetadataHtml(artifact),
    ].join('');
  }

  async function buildArtifactPaneHtml(artifact) {
    if (artifact.kind === 'diff' || artifact.diff) {
      let diffPayload = artifact.diff;
      if (artifact.toolRunId) {
        const sessionId = artifact.sessionId || readSessionId();
        const suffix = artifact.path ? `&path=${encodeURIComponent(artifact.path)}` : '';
        const payload = await readJson(`/api/web/tool-runs/${encodeURIComponent(artifact.toolRunId)}/diff?sessionId=${encodeURIComponent(sessionId)}${suffix}`, {
          headers: authHeaders(),
        });
        diffPayload = payload?.diff || diffPayload;
      }
      const consolidated = String(
        diffPayload?.consolidatedDiff
        || (Array.isArray(diffPayload?.patches)
          ? diffPayload.patches.map((entry) => String(entry?.diff || '').trim()).filter(Boolean).join('\n\n')
          : '')
        || diffPayload?.summary
        || 'Diff without text content.',
      );
      return [
        artifactMetadataHtml(artifact),
        `<pre class="artifact-render"><code class="language-diff">${escapeHtml(consolidated)}</code></pre>`,
      ].join('');
    }

    if (artifact.path && isTextArtifact(artifact)) {
      const payload = await readJson(`/api/web/file-preview?path=${encodeURIComponent(artifact.path)}`, {
        headers: authHeaders(),
      });
      const content = String(payload?.preview?.content || payload?.content || '').trim();
      return [
        artifactMetadataHtml(artifact),
        `<pre class="artifact-render"><code>${escapeHtml(content || 'File without text content.')}</code></pre>`,
        payload?.preview?.truncated ? '<div class="callout info">Preview was truncated to keep this panel light.</div>' : '',
      ].join('');
    }

    if (artifact.path && isVisualAsset(artifact)) {
      const blob = await readBlob(`/api/web/file-asset?path=${encodeURIComponent(artifact.path)}`, {
        headers: authHeaders(),
      });
      const objectUrl = URL.createObjectURL(blob);
      const extension = extensionOf(artifact.path);
      const visual = extension === 'pdf'
        ? `<iframe class="artifact-render__frame" title="${escapeHtml(artifact.title || 'PDF')}" src="${objectUrl}"></iframe>`
        : `<img class="artifact-render__media" src="${objectUrl}" alt="${escapeHtml(artifact.title || 'Artifact')}" />`;
      return [
        artifactMetadataHtml(artifact),
        visual,
      ].join('');
    }

    if (artifact.content) {
      return [
        artifactMetadataHtml(artifact),
        `<pre class="artifact-render"><code>${escapeHtml(artifact.content)}</code></pre>`,
      ].join('');
    }

    return artifactFallbackHtml(artifact);
  }

  async function fetchCurrentArtifacts(ui = window.ZavorthControlChat || {}) {
    const sessionId = readSessionId();
    if (!sessionId) {
      renderArtifactsFromPayload(state.zavorthControl || {}, ui, { display: false, reason: 'state-sync' });
      return null;
    }
    const payload = await readJson(`/api/web/artifacts?sessionId=${encodeURIComponent(sessionId)}`, {
      headers: authHeaders(),
    });
    renderArtifactsFromPayload(payload, ui, { display: false, reason: 'state-sync' });
    return payload;
  }

  async function openArtifact(id, ui = window.ZavorthControlChat || {}) {
    const artifact = state.artifactsById.get(String(id || '').trim());
    if (!artifact) {
      throw new Error('Artifact not found in the current dashboard state.');
    }
    const html = await buildArtifactPaneHtml(artifact);
    ui.openArtifactPane?.(artifact.title || 'Artifact', html);
    return artifact;
  }

  const {
    buildRunReplayHtml,
    openRunDetails,
    wireRunReplayRows,
  } = createRuntimeRunReplay({
    deriveNextRunAction,
    deriveRunError,
    escapeHtml,
    findWorkflowJobForRun,
    formatDate,
    getRuns,
    openPersistentTrace,
    pendingRunApprovals,
    statusBadge,
    text,
  });

  function closeCoreModal() {
    document.getElementById('overlay-shade')?.classList.remove('active');
    const modal = document.getElementById('core-modal');
    modal?.classList.remove('active');
    modal?.classList.remove('core-modal--unlock');
    const cancel = document.getElementById('core-modal-cancel');
    const confirm = document.getElementById('core-modal-confirm');
    if (cancel) {
      cancel.textContent = 'Cancel';
      cancel.onclick = null;
    }
    if (confirm) {
      confirm.textContent = 'Confirm';
      confirm.disabled = false;
      confirm.onclick = null;
    }
  }

  function setUnlockFeedback(message, tone = 'muted') {
    const feedback = document.getElementById('zavorth-unlock-feedback');
    if (!feedback) return;
    feedback.textContent = String(message || '');
    feedback.classList.toggle('is-danger', tone === 'danger');
  }

  function openAccessStatusModal() {
    const unlocked = Boolean(state.zavorthControl?.live && !state.zavorthControl?.authRequired);
    const protectedMode = Boolean(state.zavorthControl?.authRequired);
    const statusLabel = unlocked ? 'Unlocked' : protectedMode ? 'Protected' : 'Local';
    const statusTone = unlocked ? 'ok' : protectedMode ? 'warn' : 'info';
    const detail = unlocked
      ? 'This tab is authorized to read live runs, send messages and track Zavorth approvals.'
      : protectedMode
        ? 'The dashboard gateway is protected. Live data requires this installation local token.'
        : 'The dashboard is connected locally, but has not received an unlocked live runtime yet.';
    const content = `
      <div class="config-form">
        <div class="config-form-section">
          <span class="config-form-section__title">Dashboard Access</span>
          <div class="info-grid">
            <div class="info-row">
              <span class="info-row__label">State</span>
              <span class="info-row__value">${statusBadge(statusTone, statusLabel)}</span>
            </div>
            <div class="info-row">
              <span class="info-row__label">Token</span>
              <span class="info-row__value mono">${hasStoredToken() ? 'saved in this tab' : 'not saved'}</span>
            </div>
            <div class="info-row">
              <span class="info-row__label">Session</span>
              <span class="info-row__value mono">${escapeHtml(readSessionId() || 'no active session')}</span>
            </div>
            <div class="info-row">
              <span class="info-row__label">Model</span>
              <span class="info-row__value mono">${escapeHtml(getCurrentModelLabel())}</span>
            </div>
          </div>
          <p style="margin:0;color:var(--b-signal-muted);line-height:1.6">${escapeHtml(detail)}</p>
        </div>
      </div>
    `;

    if (typeof window.openCoreModal !== 'function') return;
    window.openCoreModal('Access status', content);

    const cancel = document.getElementById('core-modal-cancel');
    const confirm = document.getElementById('core-modal-confirm');
    if (cancel) {
      cancel.textContent = 'Close';
      cancel.onclick = closeCoreModal;
    }
    if (confirm) {
      confirm.textContent = unlocked || hasStoredToken() ? 'Lock this tab' : 'Unlock';
      confirm.disabled = false;
      confirm.onclick = unlocked || hasStoredToken()
        ? lockZavorthControlTab
        : () => openUnlockModal('Enter the local token to read live runs and send messages to Zavorth.');
    }
  }

  async function lockZavorthControlTab() {
    clearStoredToken();
    disconnectRealtime('locked');
    closeCoreModal();
    window.emitSignal?.('info', 'Tab locked', 'The local token was removed from this tab.');
    await refresh({ skipRealtime: true }).catch(() => undefined);
  }

  function openUnlockModal(reason = '') {
    const content = `
      <form id="zavorth-unlock-form" class="zavorth-unlock-card" autocomplete="off">
        <div class="zavorth-unlock-card__header">
          <div class="zavorth-unlock-card__mark">Z</div>
          <div>
            <span class="zavorth-unlock-card__eyebrow">Local access</span>
            <h4>Connect to Zavorth runtime</h4>
          </div>
          ${statusBadge('warn', hasStoredToken() ? 'Revalidate token' : 'Token required')}
        </div>
        <p class="zavorth-unlock-card__reason">
          ${text(reason, 'Paste the local token to unlock live conversations, runs, approvals, and artifacts in this tab.')}
        </p>
        <div class="zavorth-unlock-status-grid" aria-label="Connection requirements">
          <span><strong>Runtime</strong><small>${state.auth?.webReady || state.auth?.gatewayReady ? 'Local server reachable' : 'Checking local server'}</small></span>
          <span><strong>Auth</strong><small>${hasStoredToken() ? 'Token saved in this tab' : 'Token required'}</small></span>
          <span><strong>Session</strong><small>${readSessionId() ? 'Existing session found' : 'New session ready'}</small></span>
        </div>
        <label class="zavorth-secret-field">
          <span>Dashboard token</span>
          <div class="zavorth-secret-field__row">
            <input id="zavorth-unlock-token" type="password" placeholder="Paste the Zavorth token" autocomplete="off" spellcheck="false" />
            <button id="zavorth-unlock-token-toggle" type="button" aria-label="Show token" aria-pressed="false">
              Show
            </button>
          </div>
        </label>
        <div class="zavorth-unlock-help">
          <strong>Quick fix</strong>
          <ol>
            <li>Open the dashboard with <span class="mono">zavorth dashboard</span> to receive an authenticated URL.</li>
            <li>To copy manually, run <span class="mono">zavorth dashboard token</span> in the local terminal.</li>
            <li>If the token fails, generate a new one and do not reuse an old token from another tab.</li>
          </ol>
          <div class="zavorth-unlock-help__path">
            <span>Current route</span>
            <code>${escapeHtml(window.location.origin)}</code>
          </div>
          <div class="zavorth-unlock-actions">
            <button id="zavorth-copy-token-command" type="button">Copy token command</button>
            <button id="zavorth-refresh-access" type="button">Refresh status</button>
            <button id="zavorth-reconnect-runtime" type="button">Reconnect</button>
          </div>
        </div>
        <p id="zavorth-unlock-feedback" class="zavorth-unlock-feedback">
          The token is stored only in this tab sessionStorage. After validation, the top status changes to Core Unlocked.
        </p>
      </form>
    `;

    if (typeof window.openCoreModal === 'function') {
      window.openCoreModal('Connect to Zavorth', content);
      document.getElementById('core-modal')?.classList.add('core-modal--unlock');
      window.ZavorthLocale?.apply(document.getElementById('core-modal') || document);
    } else {
      return;
    }

    const input = document.getElementById('zavorth-unlock-token');
    const toggle = document.getElementById('zavorth-unlock-token-toggle');
    const form = document.getElementById('zavorth-unlock-form');
    const cancel = document.getElementById('core-modal-cancel');
    const confirm = document.getElementById('core-modal-confirm');
    const copyCommand = document.getElementById('zavorth-copy-token-command');
    const refreshStatus = document.getElementById('zavorth-refresh-access');
    const reconnectRuntime = document.getElementById('zavorth-reconnect-runtime');

    if (toggle && input) {
      toggle.onclick = () => {
        const willShow = input.type === 'password';
        input.type = willShow ? 'text' : 'password';
        toggle.textContent = willShow ? 'Hide' : 'Show';
        toggle.setAttribute('aria-label', willShow ? 'Hide token' : 'Show token');
        toggle.setAttribute('aria-pressed', willShow ? 'true' : 'false');
      };
    }

    if (copyCommand) {
      copyCommand.onclick = async () => {
        const command = 'zavorth dashboard token';
        try {
          await navigator.clipboard?.writeText(command);
          setUnlockFeedback(`Copied: ${command}`);
        } catch {
          setUnlockFeedback(`Run this command: ${command}`);
        }
      };
    }
    if (refreshStatus) {
      refreshStatus.onclick = async () => {
        setUnlockFeedback('Refreshing local gateway status...');
        await refresh({ skipRealtime: true }).catch((error) => setUnlockFeedback(messageFromCaughtError(error, 'Refresh failed.'), 'danger'));
        setUnlockFeedback(state.lastError ? `Still checking: ${state.lastError}` : 'Status refreshed. Paste the token if live access is still protected.');
      };
    }
    if (reconnectRuntime) {
      reconnectRuntime.onclick = async () => {
        setUnlockFeedback('Reconnecting live runtime stream...');
        disconnectRealtime('manual-reconnect');
        await refresh().catch((error) => setUnlockFeedback(messageFromCaughtError(error, 'Reconnect failed.'), 'danger'));
        setUnlockFeedback(state.realtime.connected ? 'Realtime stream connected.' : 'Reconnect requested. If protected, paste a fresh token.');
      };
    }

    if (cancel) {
      cancel.textContent = 'Not now';
      cancel.onclick = closeCoreModal;
    }
    if (confirm) {
      confirm.textContent = 'Connect';
      confirm.disabled = false;
      confirm.onclick = () => validateUnlockToken(String(input?.value || '').trim());
    }
    if (form) {
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        validateUnlockToken(String(input?.value || '').trim());
      });
    }
    setTimeout(() => input?.focus(), 0);
  }

  async function validateUnlockToken(token) {
    if (!token) {
      setUnlockFeedback('Paste the local token before connecting.', 'danger');
      return false;
    }

    const confirm = document.getElementById('core-modal-confirm');
    if (confirm) {
      confirm.disabled = true;
      confirm.textContent = 'Validating...';
    }

    try {
      await readJson('/api/auth/validate', {
        method: 'POST',
        body: JSON.stringify({ token }),
      });
      try {
        sessionStorage.setItem(AUTH_STORAGE_KEY, token);
      } catch {
        // If sessionStorage is unavailable, the current validation still succeeded.
      }
      closeCoreModal();
      window.emitSignal?.('success', 'Runtime unlocked', 'This tab can now read and send live data.');
      await refresh();
      await hydrateCurrentSession().catch(() => undefined);
      await fetchCurrentApprovals().catch(() => undefined);
      await fetchCurrentArtifacts().catch(() => undefined);
      return true;
    } catch (error) {
      const recovery = error?.recovery?.primaryCommand || 'zavorth dashboard';
      setUnlockFeedback(
        `${messageFromCaughtError(error, 'Invalid or expired token.')} Open a fresh dashboard URL with ${recovery}, then paste the new token here.`,
        'danger',
      );
      if (confirm) {
        confirm.disabled = false;
        confirm.textContent = 'Connect';
      }
      return false;
    }
  }

  function applyRuntimeData() {
    updatePulse();
    updateControlTelemetryRail();
    updateControlSessionRail();
    updateOverview();
    updateRecentActivityTable();
    updateSessionsTable();
    updateInstancesTable();
    updateChannels();
    updateSalesOs();
    updateAgents();
    updateSkills();
    updateUsage();
    updateCron();
    updateNodes();
    updateConfig();
    updateProviderModelCatalog();
    updateProviderActivation();
    publishCurrentModelProfile();
    renderRemoteMeshApprovalsFromPayload(state.zavorthControl || {}, window.ZavorthControlChat || {});
    renderArtifactsFromPayload(state.zavorthControl || {}, window.ZavorthControlChat || {}, { display: false, reason: 'dashboard-refresh' });
    renderDiffPreviewsFromPayload(state.zavorthControl || {});
  }

  async function fetchCurrentApprovals(ui = window.ZavorthControlChat || {}) {
    const sessionId = readSessionId();
    if (!sessionId) return null;
    const payload = await readJson(`/api/web/permissions?sessionId=${encodeURIComponent(sessionId)}`, {
      headers: authHeaders(),
    });
    renderApprovalsFromPayload(payload, ui);
    return payload;
  }

  async function hydrateCurrentSession(ui = window.ZavorthControlChat || {}, options = {}) {
    const sessionId = String(options.sessionId || readSessionId() || '').trim();
    if (!sessionId) {
      return null;
    }

    const payload = await readJson(`/api/web/gateway/sessions/history?sessionId=${encodeURIComponent(sessionId)}`, {
      headers: authHeaders(),
    });
    writeSessionId(payload?.session?.sessionId || payload?.snapshot?.sessionId || sessionId);
    const rendered = renderMessagesFromPayload(payload, ui, options);
    renderApprovalsFromPayload(payload, ui);
    renderRemoteMeshApprovalsFromPayload(payload, ui);
    renderArtifactsFromPayload(payload, ui, { display: false, reason: 'state-sync' });
    renderDiffPreviewsFromPayload(state.zavorthControl || {});
    await fetchDashboardEvents(ui).catch(() => undefined);
    if (rendered) {
      state.lastHydratedSessionId = sessionId;
    }
    return payload;
  }

  function extractAssistantReply(payload) {
    const messages = Array.isArray(payload?.snapshot?.messages)
      ? payload.snapshot.messages
      : [];
    const latestAssistant = messages.slice().reverse().find((message) => {
      const role = String(message?.role || '').trim().toLowerCase();
      return role === 'assistant' && String(message?.content || '').trim();
    });
    if (latestAssistant) {
      return String(latestAssistant.content || '').trim();
    }

    const taskId = String(payload?.taskId || '').trim();
    if (taskId) {
      return `Request received and sent to supervised execution.\n\nReference: \`${taskId.slice(0, 8)}\``;
    }

    const modeSummary = String(payload?.modeEscalation?.request?.summary || '').trim();
    if (modeSummary) {
      return modeSummary;
    }

    return 'I received your request. The live runtime accepted the message and updated the session.';
  }

  function protectedRuntimeReply(error) {
    if (error?.status === 401) {
      return [
        'The dashboard is protected.',
        '',
        'To talk to the live runtime, unlock this tab with the local Zavorth token.',
        'Meanwhile, I kept the dashboard safe and did not send your request for execution.',
      ].join('\n');
    }
    return [
      'I could not send to the live runtime right now.',
      '',
      messageFromCaughtError(error),
    ].join('\n');
  }

  async function sendChat(message, ui = {}, composerPayload = {}) {
    const text = String(message || '').trim();
    if (!text) return null;
    const attachments = Array.isArray(composerPayload.attachments)
      ? composerPayload.attachments.slice(0, 5)
      : [];
    const selectedSkills = Array.isArray(composerPayload.selectedSkills)
      ? composerPayload.selectedSkills.slice(0, 8)
      : [];
    const voice = composerPayload.voice && typeof composerPayload.voice === 'object'
      ? composerPayload.voice
      : null;
    const composerSettings = composerPayload.composerSettings && typeof composerPayload.composerSettings === 'object'
      ? composerPayload.composerSettings
      : null;
    const engineId = typeof composerPayload.engineId === 'string'
      ? composerPayload.engineId
      : (window.ZavorthRuntimeEngines?.getActiveEngineId?.() || undefined);
    const engineDecision = composerPayload.engineDecision && typeof composerPayload.engineDecision === 'object'
      ? composerPayload.engineDecision
      : null;

    try {
      const payload = await readJson('/api/web/chat/send', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          message: text,
          sessionId: readSessionId() || undefined,
          platform: 'web',
          source: 'zavorth-control',
          attachments,
          selectedSkills,
          voice,
          composerSettings,
          engineId,
          engineDecision,
        }),
      });
      writeSessionId(payload?.sessionId || payload?.snapshot?.sessionId);
      ui.removeThinkingState?.();
      ui.appendEcho?.('core', extractAssistantReply(payload));
      suppressTranscriptRender(5000);
      renderApprovalsFromPayload(payload, ui);
      renderRemoteMeshApprovalsFromPayload(payload, ui);
      const shouldRefreshArtifacts = hasExecutionArtifactContext(payload);
      if (shouldRefreshArtifacts) {
        renderArtifactsFromPayload(payload, ui, { display: true, reason: 'send-response', source: 'chat-send' });
      }
      await refresh({ skipSessionHydrate: true }).catch(() => undefined);
      await fetchCurrentApprovals(ui).catch(() => undefined);
      await fetchDashboardEvents(ui).catch(() => undefined);
      if (shouldRefreshArtifacts) {
        await fetchCurrentArtifacts(ui).catch(() => undefined);
      }
      return payload;
    } catch (error) {
      ui.removeThinkingState?.();
      ui.appendEcho?.('core', protectedRuntimeReply(error));
      error.uiHandled = Boolean(ui.appendEcho);
      if (error?.status === 401) {
        openUnlockModal('To send live messages, unlock this tab with the local Zavorth token.');
      }
      if (error?.status !== 401) {
        ui.emitSignal?.('error', 'Runtime unavailable', messageFromCaughtError(error, 'Try again.'));
      }
      await refresh().catch(() => undefined);
      throw error;
    }
  }

  async function decideApproval(input, ui = {}) {
    const id = String(input?.id || '').trim();
    const kind = String(input?.kind || '').trim();
    const decision = String(input?.decision || '').trim().toLowerCase();
    const scope = String(input?.scope || 'once').trim() || 'once';
    const scopeNote = String(input?.scopeNote || '').trim();
    if (!id || !['approve', 'reject'].includes(decision)) {
      throw new Error('Invalid approval.');
    }
    const sessionId = readSessionId();
    const action = decision === 'approve' ? 'approve' : 'reject';
    const path = kind === 'agent-run'
      ? `/api/web/agent-runs/${action}`
      : kind === 'task'
        ? `/api/web/tasks/${action}`
        : `/api/web/permissions/${action}`;
    const body = kind === 'agent-run'
      ? { approvalId: id, sessionId, source: 'zavorth-control', scope, scopeNote }
      : kind === 'task'
        ? { taskId: id, sessionId, scope, scopeNote }
        : { permissionId: id, sessionId, scope, scopeNote };

    const payload = await readJson(path, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(body),
    });
    if (decision === 'approve') {
      ui.emitSignal?.(
        'success',
        'Authorized',
        'The decision was sent to the live runtime.',
      );
    }
    renderMessagesFromPayload(payload, ui);
    renderApprovalsFromPayload(payload, ui);
    renderRemoteMeshApprovalsFromPayload(payload, ui);
    renderArtifactsFromPayload(payload, ui, { display: hasDirectExecutionArtifactContext(payload), reason: 'approval-decision', source: 'approval' });
    await refresh().catch(() => undefined);
    await hydrateCurrentSession(ui).catch(() => undefined);
    await fetchCurrentApprovals(ui).catch(() => undefined);
    await fetchCurrentArtifacts(ui).catch(() => undefined);
    await fetchDashboardEvents(ui).catch(() => undefined);
    return payload;
  }

  async function sendSalesPackDemoInbound() {
    const providerMessageId = `sales-demo-${Date.now()}`;
    const payload = await readJson('/api/v2/sales-pack/channel-io/inbound', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        provider: 'stub',
        platform: 'whatsapp',
        tenantId: 'default-tenant',
        channelAccountId: 'sales-channel-whatsapp',
        providerMessageId,
        customerId: 'lead-zavorth-control',
        text: 'I think it is expensive, but I am still interested. Is there still availability?',
        traceId: `trace-${providerMessageId}`,
        metadata: { source: 'zavorth-control-sales-os' },
      }),
    });
    state.salesPack = payload?.snapshot ? { data: payload.snapshot } : state.salesPack;
    state.salesPackChannelIo = payload?.channelIo ? { data: payload.channelIo } : state.salesPackChannelIo;
    applyRuntimeData();
    return payload;
  }

  async function applyRemoteMeshApproval(input, ui = {}) {
    const id = String(input?.id || '').trim();
    if (!id) {
      throw new Error('Invalid MCP approval.');
    }
    const card = state.remoteMeshApprovalsById.get(id);
    if (!card) {
      throw new Error('MCP approval not found in the current snapshot.');
    }

    const payload = await readJson('/api/web/remote-mesh/notebook/mcp', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        toolName: card.applyToolName,
        arguments: card.applyArguments,
      }),
    });
    const receiptId = String(payload?.receipt?.structuredContent?.receiptId || '').trim();
    const receiptSummary = receiptId
      ? `Receipt ${receiptId} received from the MCP notebook.`
      : String(payload?.receipt?.contentText || payload?.error || '').trim();
    ui.emitSignal?.(
      payload?.ok ? 'success' : 'error',
      payload?.ok ? 'MCP applied' : 'MCP blocked',
      receiptSummary || 'The MCP proxy returned without a detailed summary.',
    );
    if (payload?.ok) {
      ui.appendEcho?.(
        'core',
        [
          `Remote Mesh applied: ${card.title}`,
          '',
          receiptSummary || 'Notebook MCP executed the approved action.',
        ].join('\n'),
      );
    }
    await refresh().catch(() => undefined);
    await fetchDashboardEvents(ui).catch(() => undefined);
    return payload;
  }

  async function applyDiffPreview(input, ui = {}) {
    const planId = String(input?.planId || '').trim();
    if (!planId) {
      throw new Error('Invalid draft plan.');
    }
    const sessionId = String(input?.sessionId || readSessionId() || '').trim();
    const runId = String(input?.runId || readRunId() || '').trim();
    const payload = await readJson('/api/web/agent-runs/apply-draft', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        planId,
        runId: runId || undefined,
        sessionId: sessionId || undefined,
        confirmOwnerControlledApply: true,
      }),
    });
    if (payload?.snapshot) {
      state.zavorthControl = {
        ...(state.zavorthControl || {}),
        live: state.zavorthControl?.live !== false,
        generatedAt: payload.generatedAt || state.zavorthControl?.generatedAt,
        snapshot: payload.snapshot,
      };
      writeRunId(payload.run?.id || payload.snapshot?.activeRun?.id || runId);
      writeSessionId(payload.run?.sessionId || payload.snapshot?.activeRun?.sessionId || sessionId);
      replaceZavorthControlUrlParams({
        runId: payload.run?.id || payload.snapshot?.activeRun?.id || runId,
        sessionId: payload.run?.sessionId || payload.snapshot?.activeRun?.sessionId || sessionId,
      });
    }
    ui.emitSignal?.('success', 'Draft applied', `Plan ${planId} sent to the Mutation Plane.`);
    ui.appendEcho?.('core', `Draft applied successfully.\n\nPlan: \`${planId}\``);
    renderMessagesFromPayload(payload, ui, { renderTranscript: false });
    renderApprovalsFromPayload(payload, ui);
    renderRemoteMeshApprovalsFromPayload(payload, ui);
    renderArtifactsFromPayload(payload, ui, { display: true, reason: 'diff-preview-apply', source: 'zavorth-control' });
    renderDiffPreviewsFromPayload(payload);
    await refresh({ skipSessionHydrate: true }).catch(() => undefined);
    await fetchDashboardEvents(ui).catch(() => undefined);
    return payload;
  }

  refresh = createRuntimeRefresh({
    applyRuntimeData,
    authHeaders,
    buildZavorthControlQueryString,
    connectRealtime,
    fetchCurrentArtifacts,
    fetchDashboardEvents,
    hasStoredToken,
    hydrateCurrentSession,
    readJson,
    readRunId,
    readSessionId,
    readToken,
    state,
    updatePulse,
    writeRunId,
  });
  window.ZavorthRuntimeBridge = {
    state,
    refresh,
    sendChat,
    decideApproval,
    applyRemoteMeshApproval,
    applyDiffPreview,
    openArtifact,
    openRunDetails,
    connectRealtime,
    disconnectRealtime,
    suppressTranscriptRender,
    getCurrentModelLabel,
    getCurrentProviderLabel,
    getCurrentModelRouteLabel,
    resolveCurrentModelProfile,
    getAvailableSkills,
    openUnlockModal,
    fetchCurrentApprovals,
    fetchCurrentArtifacts,
    fetchDashboardEvents,
    openPersistentTrace,
    hydrateCurrentSession,
    sendSalesPackDemoInbound,
  };

  document.addEventListener('click', (event) => {
    const action = event.target?.closest?.('[data-sales-os-action]');
    if (!action) return;
    if (action.getAttribute('data-sales-os-action') !== 'demo-inbound') return;
    action.disabled = true;
    const previousText = action.textContent;
    action.textContent = 'Creating...';
    sendSalesPackDemoInbound()
      .catch((error) => window.emitSignal?.('error', 'Approvals', error?.message || 'Failed to create local conversation.'))
      .finally(() => {
        action.disabled = false;
        action.textContent = previousText || 'Create local conversation';
      });
  });

  document.addEventListener('click', (event) => {
    const applyButton = event.target?.closest?.('[data-zavorth-diff-apply]');
    if (!applyButton) return;
    event.preventDefault();
    const card = applyButton.closest('.zavorth-diff-preview-card');
    if (card?.dataset?.status === 'applied') return;
    const runtimeBridge = window.ZavorthRuntimeBridge;
    if (!runtimeBridge || typeof runtimeBridge.applyDiffPreview !== 'function') return;
    const ui = window.ZavorthControlChat || {};
    applyButton.disabled = true;
    applyButton.textContent = 'Applying...';
    card?.querySelectorAll('button').forEach((button) => {
      button.disabled = true;
    });
    runtimeBridge.applyDiffPreview({
      planId: applyButton.dataset.planId,
      runId: applyButton.dataset.runId,
      sessionId: applyButton.dataset.sessionId,
    }, {
      appendEcho: ui.appendEcho,
      emitSignal: window.emitSignal,
      renderApprovals: ui.renderApprovals,
      renderRemoteMeshApprovals: ui.renderRemoteMeshApprovals,
      renderArtifacts: ui.renderArtifacts,
      renderTranscript: ui.renderTranscript,
    }).then((payload) => {
      if (payload?.ok) {
        if (card) card.dataset.status = 'applied';
        applyButton.textContent = 'Applied';
        return;
      }
      throw new Error(String(payload?.error || 'The runtime rejected the apply.'));
    }).catch((error) => {
      if (card) card.dataset.status = 'retryable';
      card?.querySelectorAll('button').forEach((button) => {
        button.disabled = false;
      });
      applyButton.textContent = 'Try again';
      window.emitSignal?.('error', 'Apply blocked', String(error?.message || 'Try again.'));
    });
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      wireRunReplayRows();
      refresh();
    }, { once: true });
  } else {
    wireRunReplayRows();
    refresh();
  }

  window.addEventListener('beforeunload', () => {
    disconnectRealtime('unload');
  });
}

initRuntimeBridge();
