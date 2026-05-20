/**
 * Zavorth Dashboard - Runtime Bridge
 *
 * Non-invasive data bridge for the real Zavorth runtime.
 * Rule: do not redesign the dashboard here. Only replace demo text inside
 * existing components/classes that already belong to this dashboard surface.
 */
(function () {
  'use strict';

  const AUTH_STORAGE_KEY = 'zavorth.commandCenter.webToken';
  const SESSION_STORAGE_KEY = 'zavorth.commandCenter.sessionId';
  const RUN_STORAGE_KEY = 'zavorth.commandCenter.runId';
  const state = {
    auth: null,
    commandCenter: null,
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

  function readToken() {
    try {
      const url = new URL(window.location.href);
      const hashParams = new URLSearchParams(url.hash.startsWith('#') ? url.hash.slice(1) : url.hash);
      const tokenFromUrl = String(hashParams.get('token') || url.searchParams.get('token') || '').trim();
      if (tokenFromUrl) {
        sessionStorage.setItem(AUTH_STORAGE_KEY, tokenFromUrl);
        hashParams.delete('token');
        url.searchParams.delete('token');
        url.hash = hashParams.toString() ? `#${hashParams.toString()}` : '';
        history.replaceState(null, '', url);
        return tokenFromUrl;
      }
      return String(sessionStorage.getItem(AUTH_STORAGE_KEY) || '').trim();
    } catch {
      return '';
    }
  }

  function authHeaders() {
    const token = readToken();
    return token ? { 'X-Zavorth-Token': token } : {};
  }

  function hasStoredToken() {
    return Boolean(readToken());
  }

  function clearStoredToken() {
    try {
      sessionStorage.removeItem(AUTH_STORAGE_KEY);
    } catch {
      // Token storage is best-effort in restricted browsers.
    }
  }

  function readSessionId() {
    try {
      const urlSessionId = readUrlParam('sessionId');
      if (urlSessionId) {
        writeSessionId(urlSessionId);
        return urlSessionId;
      }
      return String(sessionStorage.getItem(SESSION_STORAGE_KEY) || '').trim();
    } catch {
      return '';
    }
  }

  function readUrlParam(name) {
    try {
      const url = new URL(window.location.href);
      const hashParams = new URLSearchParams(url.hash.startsWith('#') ? url.hash.slice(1) : url.hash);
      return String(url.searchParams.get(name) || hashParams.get(name) || '').trim();
    } catch {
      return '';
    }
  }

  function readRunId() {
    try {
      const urlRunId = readUrlParam('runId');
      if (urlRunId) {
        writeRunId(urlRunId);
        return urlRunId;
      }
      return String(sessionStorage.getItem(RUN_STORAGE_KEY) || '').trim();
    } catch {
      return '';
    }
  }

  function writeSessionId(sessionId) {
    const normalized = String(sessionId || '').trim();
    if (!normalized) return;
    state.sessionId = normalized;
    try {
      sessionStorage.setItem(SESSION_STORAGE_KEY, normalized);
    } catch {
      // Session continuity is best-effort in restricted browsers.
    }
  }

  function writeRunId(runId) {
    const normalized = String(runId || '').trim();
    if (!normalized) return;
    state.runId = normalized;
    try {
      sessionStorage.setItem(RUN_STORAGE_KEY, normalized);
    } catch {
      // Run continuity is best-effort in restricted browsers.
    }
  }

  function buildCommandCenterQueryString(extra = {}) {
    const params = new URLSearchParams();
    const sessionId = String(extra.sessionId || readSessionId() || '').trim();
    const runId = String(extra.runId || readRunId() || '').trim();
    const traceId = String(extra.traceId || readUrlParam('traceId') || '').trim();
    const status = String(extra.status || readUrlParam('status') || '').trim();
    const limit = String(extra.limit || readUrlParam('limit') || '').trim();
    if (sessionId) params.set('sessionId', sessionId);
    if (runId) params.set('runId', runId);
    if (traceId) params.set('traceId', traceId);
    if (status) params.set('status', status);
    if (limit) params.set('limit', limit);
    const query = params.toString();
    return query ? `?${query}` : '';
  }

  function replaceCommandCenterUrlParams(values = {}) {
    try {
      const url = new URL(window.location.href);
      for (const [key, value] of Object.entries(values)) {
        const normalized = String(value || '').trim();
        if (normalized) url.searchParams.set(key, normalized);
      }
      history.replaceState(null, '', url);
    } catch {
      // URL continuity is best-effort.
    }
  }

  function realtimePath(sessionId) {
    return `/api/web/events?sessionId=${encodeURIComponent(sessionId)}`;
  }

  function resolveRealtimeSessionId() {
    const stored = readSessionId();
    if (stored) return stored;

    const snapshot = state.commandCenter?.snapshot || {};
    const activeRun = getActiveRun();
    const candidate = String(
      activeRun?.sessionId
      || snapshot.activeSessionId
      || state.commandCenter?.sessionId
      || '',
    ).trim();
    if (candidate) {
      writeSessionId(candidate);
    }
    return candidate;
  }

  function closeRealtimeTransport() {
    const realtime = state.realtime;
    if (realtime.reconnectTimer) {
      clearTimeout(realtime.reconnectTimer);
      realtime.reconnectTimer = null;
    }
    if (realtime.abortController) {
      realtime.abortController.abort();
      realtime.abortController = null;
    }
    if (realtime.eventSource) {
      realtime.eventSource.close();
      realtime.eventSource = null;
    }
  }

  function markRealtimeConnected(transport, eventType = 'open') {
    const realtime = state.realtime;
    realtime.connected = true;
    realtime.connecting = false;
    realtime.transport = transport;
    realtime.lastEventAt = new Date().toISOString();
    realtime.lastEventType = eventType;
    realtime.lastError = null;
    realtime.retryCount = 0;
    updatePulse();
  }

  function markRealtimeConnecting(transport, sessionId) {
    const realtime = state.realtime;
    realtime.connected = false;
    realtime.connecting = true;
    realtime.sessionId = sessionId;
    realtime.transport = transport;
    realtime.lastError = null;
    updatePulse();
  }

  function markRealtimeDisconnected(error) {
    const realtime = state.realtime;
    realtime.connected = false;
    realtime.connecting = false;
    realtime.lastError = error?.message || String(error || 'Realtime stream disconnected.');
    updatePulse();
  }

  function scheduleRealtimeReconnect() {
    const realtime = state.realtime;
    if (realtime.stopped || realtime.reconnectTimer) return;
    const delay = Math.min(30_000, 1_000 * Math.max(1, 2 ** realtime.retryCount));
    realtime.retryCount += 1;
    realtime.reconnectTimer = setTimeout(() => {
      realtime.reconnectTimer = null;
      connectRealtime({ reconnect: true });
    }, delay);
  }

  function scheduleRealtimeRefresh(reason = 'event', delayMs = 350) {
    const realtime = state.realtime;
    realtime.lastEventType = reason;
    if (realtime.refreshTimer) return;
    realtime.refreshTimer = setTimeout(async () => {
      realtime.refreshTimer = null;
      await refresh({ fromRealtime: true }).catch(() => undefined);
      await hydrateCurrentSession().catch(() => undefined);
      await fetchCurrentApprovals().catch(() => undefined);
      await fetchCurrentArtifacts().catch(() => undefined);
      await fetchDashboardEvents().catch(() => undefined);
    }, delayMs);
  }

  function emitDashboardEvents(events, source = 'runtime-history') {
    const ui = window.ZavorthCommandCenterChat || {};
    if (!Array.isArray(events) || typeof ui.ingestRuntimeEvents !== 'function') {
      return false;
    }
    return ui.ingestRuntimeEvents(events, { source });
  }

  function dashboardEventTime(value) {
    const normalized = String(value || '').trim();
    return normalized || new Date().toISOString();
  }

  function dashboardEventFromRealtimeEvent(event) {
    const type = String(event?.type || '').trim();
    const payload = event?.payload || {};
    const eventId = String(event?.id || payload?.id || '').trim();
    if (!eventId || type === 'ping' || type === 'snapshot') return null;
    if (type === 'message') {
      const role = String(payload?.role || '').trim().toLowerCase();
      return {
        id: `sse:message:${eventId}`,
        type: role === 'user' ? 'request' : 'reply',
        title: role === 'user' ? 'Request received' : 'Reply recorded',
        detail: payload?.content || payload?.text || '',
        meta: payload?.kind || role || 'message',
        status: role || 'message',
        time: dashboardEventTime(payload?.createdAt || event?.createdAt),
      };
    }
    if (type === 'permission') {
      return {
        id: `sse:permission:${eventId}:${payload?.status || 'pending'}`,
        type: 'approval',
        title: payload?.kind || payload?.executor || 'Pending approval',
        detail: payload?.reason || payload?.requested_value || '',
        meta: payload?.scope || payload?.executor || 'permission',
        status: payload?.status || 'pending',
        time: dashboardEventTime(payload?.updated_at || event?.createdAt),
      };
    }
    if (type === 'tool') {
      const status = String(payload?.status || 'done').trim();
      return {
        id: `sse:tool:${eventId}:${status}`,
        type: /failed|error|blocked/i.test(status) ? 'error' : 'receipt',
        title: payload?.toolName || payload?.name || 'Tool receipt',
        detail: payload?.summary || payload?.resultSummary || payload?.error || '',
        meta: 'tool-run',
        status,
        time: dashboardEventTime(payload?.updatedAt || payload?.updated_at || event?.createdAt),
      };
    }
    if (type === 'task' || type === 'workflow') {
      const status = String(payload?.status || 'running').trim();
      return {
        id: `sse:${type}:${eventId}:${status}`,
        type: /failed|error|blocked|rejected|cancelled|canceled/i.test(status) ? 'error' : 'step',
        title: payload?.command_type || payload?.workflow_name || payload?.objective || `${type} update`,
        detail: payload?.result_summary || payload?.error_summary || payload?.raw_message || payload?.objective || '',
        meta: type,
        status,
        time: dashboardEventTime(payload?.updated_at || payload?.created_at || event?.createdAt),
      };
    }
    return {
      id: `sse:${type}:${eventId}`,
      type: 'step',
      title: `${type} update`,
      detail: '',
      meta: 'sse',
      status: 'event',
      time: dashboardEventTime(event?.createdAt),
    };
  }

  async function fetchDashboardEvents(ui = window.ZavorthCommandCenterChat || {}, query = {}) {
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

  async function openPersistentTrace(query = {}, ui = window.ZavorthCommandCenterChat || {}) {
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
      replaceCommandCenterUrlParams({
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

  function handleRealtimeEvent(event) {
    const eventType = String(event?.type || 'message').trim() || 'message';
    markRealtimeConnected(state.realtime.transport === 'eventsource' ? 'eventsource' : 'fetch-sse', eventType);
    if (eventType === 'ping') {
      return;
    }

    const dashboardEvent = dashboardEventFromRealtimeEvent(event);
    if (dashboardEvent) {
      emitDashboardEvents([dashboardEvent], 'sse');
    }

    if (eventType === 'snapshot') {
      const payload = { snapshot: event?.payload || {} };
      renderMessagesFromPayload(payload, window.ZavorthCommandCenterChat || {}, { reason: 'realtime-snapshot' });
      renderApprovalsFromPayload(payload, window.ZavorthCommandCenterChat || {});
      renderRemoteMeshApprovalsFromPayload(payload, window.ZavorthCommandCenterChat || {});
      renderArtifactsFromPayload(payload, window.ZavorthCommandCenterChat || {}, { display: false, reason: 'realtime-snapshot' });
      void fetchDashboardEvents().catch(() => undefined);
    }

    scheduleRealtimeRefresh(eventType, eventType === 'snapshot' ? 250 : 500);
  }

  function consumeSseBlock(block) {
    const lines = String(block || '').split('\n');
    let eventType = 'message';
    const data = [];
    let heartbeat = false;

    for (const rawLine of lines) {
      const line = rawLine.replace(/\r$/, '');
      if (!line.trim()) continue;
      if (line.startsWith(':')) {
        heartbeat = true;
        continue;
      }
      if (line.startsWith('event:')) {
        eventType = line.slice('event:'.length).trim() || eventType;
        continue;
      }
      if (line.startsWith('data:')) {
        data.push(line.slice('data:'.length).trimStart());
      }
    }

    if (data.length === 0) {
      if (heartbeat) {
        markRealtimeConnected(state.realtime.transport === 'eventsource' ? 'eventsource' : 'fetch-sse', 'heartbeat');
      }
      return;
    }

    try {
      const parsed = JSON.parse(data.join('\n'));
      handleRealtimeEvent({
        ...parsed,
        type: parsed?.type || eventType,
      });
    } catch (error) {
      state.realtime.lastError = error?.message || 'Invalid realtime event.';
    }
  }

  function consumeSseBuffer(buffer) {
    const normalized = String(buffer || '').replace(/\r\n/g, '\n');
    const parts = normalized.split('\n\n');
    const rest = parts.pop() || '';
    for (const part of parts) {
      consumeSseBlock(part);
    }
    return rest;
  }

  async function startFetchEventStream(sessionId) {
    const controller = new AbortController();
    state.realtime.abortController = controller;
    markRealtimeConnecting('fetch-sse', sessionId);

    try {
      const response = await fetch(realtimePath(sessionId), {
        headers: {
          Accept: 'text/event-stream',
          ...authHeaders(),
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`/api/web/events returned HTTP ${response.status}`);
      }
      if (!response.body || typeof response.body.getReader !== 'function') {
        throw new Error('This browser did not expose the SSE stream through fetch.');
      }

      markRealtimeConnected('fetch-sse', 'open');
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        buffer = consumeSseBuffer(buffer);
      }

      buffer += decoder.decode();
      consumeSseBuffer(`${buffer}\n\n`);
      throw new Error('Realtime stream ended.');
    } catch (error) {
      if (controller.signal.aborted || state.realtime.stopped) {
        return;
      }
      markRealtimeDisconnected(error);
      scheduleRealtimeReconnect();
    }
  }

  function startEventSourceStream(sessionId) {
    if (typeof window.EventSource !== 'function') {
      state.realtime.lastError = 'EventSource is unavailable in this browser.';
      return false;
    }

    markRealtimeConnecting('eventsource', sessionId);
    const source = new EventSource(realtimePath(sessionId));
    state.realtime.eventSource = source;

    source.onopen = () => markRealtimeConnected('eventsource', 'open');
    source.onerror = () => {
      if (state.realtime.stopped) return;
      markRealtimeDisconnected(new Error('Realtime stream disconnected.'));
      source.close();
      state.realtime.eventSource = null;
      scheduleRealtimeReconnect();
    };

    ['snapshot', 'message', 'task', 'tool', 'workflow', 'permission', 'ping'].forEach((type) => {
      source.addEventListener(type, (event) => {
        try {
          const parsed = JSON.parse(event.data || '{}');
          handleRealtimeEvent({
            ...parsed,
            type: parsed?.type || type,
          });
        } catch (error) {
          state.realtime.lastError = error?.message || 'Invalid realtime event.';
        }
      });
    });

    return true;
  }

  function connectRealtime() {
    const sessionId = resolveRealtimeSessionId();
    if (!sessionId || !state.commandCenter?.live || state.commandCenter?.authRequired) {
      disconnectRealtime('not-ready');
      return false;
    }

    const realtime = state.realtime;
    if ((realtime.connected || realtime.connecting) && realtime.sessionId === sessionId) {
      return true;
    }

    closeRealtimeTransport();
    realtime.stopped = false;
    realtime.sessionId = sessionId;
    realtime.connected = false;
    realtime.connecting = true;
    realtime.lastError = null;

    if (typeof window.AbortController === 'function' && typeof window.TextDecoder === 'function') {
      void startFetchEventStream(sessionId);
      return true;
    }

    return startEventSourceStream(sessionId);
  }

  function disconnectRealtime(reason = 'manual') {
    const realtime = state.realtime;
    realtime.stopped = true;
    closeRealtimeTransport();
    if (realtime.refreshTimer) {
      clearTimeout(realtime.refreshTimer);
      realtime.refreshTimer = null;
    }
    realtime.connected = false;
    realtime.connecting = false;
    realtime.sessionId = null;
    realtime.transport = reason;
    updatePulse();
  }

  async function readJson(path, options = {}) {
    const requestHeaders = {
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {}),
    };
    const response = await fetch(path, {
      ...options,
      headers: requestHeaders,
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const error = new Error(
        String(payload?.error || payload?.message || `${path} respondeu HTTP ${response.status}`),
      );
      error.status = response.status;
      error.payload = payload;
      error.recovery = payload?.recovery || null;
      throw error;
    }
    return payload;
  }

  async function readBlob(path, options = {}) {
    const response = await fetch(path, {
      ...options,
      headers: {
        Accept: '*/*',
        ...(options.headers || {}),
      },
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      const error = new Error(
        String(payload?.error || payload?.message || `${path} respondeu HTTP ${response.status}`),
      );
      error.status = response.status;
      error.payload = payload;
      throw error;
    }
    return response.blob();
  }

  function text(value, fallback = 'â€”') {
    const normalized = String(value ?? '').trim();
    return normalized || fallback;
  }

  function numberLabel(value, fallback = '0') {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return fallback;
    return numeric.toLocaleString('en-US');
  }

  function formatDate(value) {
    const date = new Date(String(value || ''));
    if (!Number.isFinite(date.getTime())) return 'agora';
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

  function isUnknownModelLabel(value) {
    const normalized = String(value || '').trim().toLowerCase();
    return !normalized || ['current model', 'model not informed'].includes(normalized);
  }

  function normalizeModelProfile(profile) {
    if (!profile || typeof profile !== 'object') return null;
    const modelLabel = String(profile.modelLabel || profile.model || '').trim();
    const providerLabel = String(profile.providerLabel || profile.provider || '').trim();
    if (isUnknownModelLabel(modelLabel) && !providerLabel) return null;
    return {
      providerLabel: providerLabel || 'Provider not informed',
      modelLabel: isUnknownModelLabel(modelLabel) ? 'current model not informed' : modelLabel,
      routingPolicy: String(profile.routingPolicy || profile.route || 'unknown').trim() || 'unknown',
      fallbackModelLabel: String(profile.fallbackModelLabel || profile.fallbackModel || '').trim() || null,
      supportsTools: profile.supportsTools,
      supportsVision: profile.supportsVision,
      supportsStreaming: profile.supportsStreaming,
    };
  }

  function resolveCurrentModelProfile() {
    const activeRun = getActiveRun();
    const runs = getRuns();
    const candidates = [
      activeRun?.modelProfile,
      state.commandCenter?.modelProfile,
      state.commandCenter?.snapshot?.modelProfile,
      ...runs.map((run) => run?.modelProfile),
    ];
    for (const candidate of candidates) {
      const profile = normalizeModelProfile(candidate);
      if (profile && !isUnknownModelLabel(profile.modelLabel)) {
        return profile;
      }
    }
    return normalizeModelProfile(state.commandCenter?.modelProfile)
      || normalizeModelProfile(state.commandCenter?.snapshot?.modelProfile)
      || {
        providerLabel: 'Provider not informed',
        modelLabel: 'current model not informed',
        routingPolicy: 'unknown',
        fallbackModelLabel: null,
      };
  }

  function getCurrentModelLabel() {
    return resolveCurrentModelProfile().modelLabel;
  }

  function getCurrentProviderLabel() {
    return resolveCurrentModelProfile().providerLabel;
  }

  function getCurrentModelRouteLabel() {
    const profile = resolveCurrentModelProfile();
    const route = String(profile.routingPolicy || '').trim().toLowerCase();
    if (route === 'gateway') return 'gateway';
    if (route === 'fallback') return 'fallback';
    if (route === 'direct') return 'direct';
    return text(profile.providerLabel, 'runtime');
  }

  function publishCurrentModelProfile() {
    const modelLabel = getCurrentModelLabel();
    const routeLabel = getCurrentModelRouteLabel();
    document.querySelectorAll('.echo-meta__model').forEach((node) => {
      node.textContent = modelLabel;
    });
    document.querySelectorAll('.echo-meta__cost').forEach((node) => {
      node.textContent = routeLabel;
    });

    const usageFirstModelCell = document.querySelector('#sector-usage table.data-table tbody tr:first-child td:first-child');
    if (usageFirstModelCell) {
      usageFirstModelCell.textContent = modelLabel;
    }

    document.querySelectorAll('#sector-agents .entity-card__meta .badge--muted').forEach((node) => {
      node.textContent = modelLabel;
    });
  }

  function escapeHtml(value) {
    return String(value ?? '')
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

  function getGatewaySnapshot() {
    return state.commandCenter?.snapshot || {};
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
      return 'Run cancelada';
    }
    if (status === 'completed') {
      return Array.isArray(run.artifacts) && run.artifacts.length > 0 ? 'Abrir artefatos' : 'Revisar replay';
    }
    return 'Revisar estado';
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
            title: run?.summary || run?.title || 'Run registrada',
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
      state.commandCenter?.snapshot?.channels,
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

  function updatePulse() {
    const pulse = document.getElementById('core-pulse');
    const label = pulse?.querySelector('.bridge__pulse-label');
    if (!pulse || !label) return;

    if (state.lastError) {
      label.textContent = 'Core verificando';
      pulse.title = state.lastError;
      setPulseAccessState('checking');
      wireUnlockPulse(false);
      return;
    }

    const auth = state.auth;
    const command = state.commandCenter;
    if (command?.live) {
      if (state.realtime.connected) {
        label.textContent = 'Core Ao Vivo';
        pulse.title = `Tab unlocked. Live runtime connected (${state.realtime.lastEventType || 'stream'}).`;
        setPulseAccessState('unlocked');
        wireUnlockPulse(false);
        return;
      }
      if (state.realtime.connecting) {
        label.textContent = 'Core Connecting';
        pulse.title = 'Tab unlocked. Opening live runtime stream.';
        setPulseAccessState('unlocked');
        wireUnlockPulse(false);
        return;
      }
      label.textContent = 'Core Unlocked';
      pulse.title = state.realtime.lastError
        ? `Tab unlocked. Live runtime connected; live stream reconnecting: ${state.realtime.lastError}`
        : 'Tab unlocked. Live runtime connected to the dashboard.';
      setPulseAccessState('unlocked');
      wireUnlockPulse(false);
      return;
    }

    if (command?.authRequired) {
      label.textContent = 'Core Protected';
      pulse.title = hasStoredToken()
        ? 'Token saved in this tab, but the runtime still requires validation. Click to review.'
        : 'The dashboard is protected. Live data requires the local token. Click to unlock.';
      setPulseAccessState('protected');
      wireUnlockPulse(true);
      return;
    }

    if (auth?.webReady || auth?.gatewayReady) {
      label.textContent = 'Core Connected';
      pulse.title = 'Dashboard conectado ao servidor local.';
      setPulseAccessState('local');
      wireUnlockPulse(false);
      return;
    }

    label.textContent = 'Core Local';
    pulse.title = 'Waiting for runtime state.';
    setPulseAccessState('local');
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
      if (state.commandCenter?.authRequired) {
        openUnlockModal('Enter the local token to read live runs and send messages to Zavorth.');
        return;
      }
      openAccessStatusModal();
    });
  }

  function updateOverview() {
    const snapshot = state.commandCenter?.snapshot || {};
    const runs = getRuns();
    const activeRun = getActiveRun();
    const jobs = getWorkflowJobs();
    const live = Boolean(state.commandCenter?.live);
    const authRequired = Boolean(state.commandCenter?.authRequired);
    const runtimeLabel = live ? 'live runtime' : authRequired ? 'protected access' : 'fallback local';
    const activeSessions = new Set(runs.map((run) => run.sessionId || run.id).filter(Boolean)).size;
    const pendingApprovals = runs.reduce((count, run) => {
      const approvals = Array.isArray(run.approvals) ? run.approvals : [];
      return count + approvals.filter((approval) => approval.status === 'pending').length;
    }, 0);

    updateSummaryCard('Total Messages', numberLabel(runs.length), `${runtimeLabel} · runs registered`);
    updateSummaryCard('Tokens Used', 'â€”', 'token telemetry is not connected yet');
    updateSummaryCard('Total Cost', 'â€”', 'live costs are not connected yet');
    updateSummaryCard('Active Sessions', numberLabel(activeSessions), activeRun ? `active: ${text(activeRun.title, activeRun.id)}` : 'no active run now');
    updateSummaryCard('Uptime', state.auth?.webReady ? 'Online' : 'Local', state.auth?.gatewayReady ? 'gateway ready' : 'local dashboard responding');
    updateSummaryCard('Average Latency', activeRun ? text(activeRun.status, 'run') : '0', pendingApprovals ? `${pendingApprovals} approval(s) pending` : deriveNextRunAction(activeRun));

    updatePremiumMetric('Missions', numberLabel(runs.length), activeRun ? deriveNextRunAction(activeRun) : 'waiting for first mission');
    updatePremiumMetric('Provider', getCurrentProviderLabel(), getCurrentModelLabel());
    updatePremiumMetric('Approvals', numberLabel(pendingApprovals), pendingApprovals ? 'waiting for decision' : 'no pending decision');
    updatePremiumMetric('Receipts', numberLabel(totalArtifactCount()), totalArtifactCount() ? 'receipt evidence available' : 'no receipt yet');

    const runtimeTitle = document.querySelector('[data-dashboard-runtime-title]');
    const runtimeText = document.querySelector('[data-dashboard-runtime-text]');
    if (runtimeTitle) runtimeTitle.textContent = activeRun ? text(activeRun.title || activeRun.summary, activeRun.id) : 'Waiting for a mission';
    if (runtimeText) {
      runtimeText.textContent = activeRun
        ? `${text(activeRun.status, 'running')} - ${deriveNextRunAction(activeRun)}`
        : 'Use Chat for natural requests. Zavorth previews risky actions, asks when needed and writes receipts after completion.';
    }

    updatePremiumStatus('Web dashboard', state.auth?.webReady ? 'ready' : 'local', state.auth?.webReady ? 'ok' : 'info');
    updatePremiumStatus('CLI/TUI', 'ready', 'ok');
    updatePremiumStatus('Telegram', channelReadinessLabel('telegram'), channelReadinessTone('telegram'));
    updatePremiumStatus('Mutable work', pendingApprovals ? 'approval waiting' : 'approval gated', pendingApprovals ? 'warn' : 'ok');

    updatePlatformAction('sector-overview', 'Ask Zavorth', `Current route: ${getCurrentProviderLabel()}`);
    updatePlatformAction('sector-overview', 'Review approvals', pendingApprovals ? `${pendingApprovals} waiting` : 'No pending decision.');
    updatePlatformAction('sector-overview', 'Inspect receipts', totalArtifactCount() ? `${totalArtifactCount()} receipt artifact(s)` : 'No receipt artifact yet.');
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
          <td class="mono">${formatDate(state.commandCenter?.generatedAt || state.updatedAt)}</td>
          <td>No live run registered yet</td>
          <td class="mono">agent-gateway</td>
          <td>${statusBadge(state.commandCenter?.authRequired ? 'auth' : 'ready', state.commandCenter?.authRequired ? 'Protected' : 'Ready')}</td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = rows.map(({ run, event }) => `
      <tr data-zavorth-run-id="${escapeHtml(run.id || '')}" data-zavorth-trace-id="${escapeHtml(run.traceId || event.traceId || '')}" data-zavorth-session-id="${escapeHtml(run.sessionId || event.sessionId || '')}" title="Abrir replay desta run">
        <td class="mono">${formatDate(event.createdAt || run.updatedAt || run.createdAt)}</td>
        <td>${escapeHtml(text(event.title || event.detail || run.summary, run.title || run.id))}</td>
        <td class="mono">${escapeHtml(text(run.title, run.id))}</td>
        <td>${statusBadge(event.status || run.status || event.kind, text(event.status || run.status || event.kind, 'evento'))}</td>
        <td><button class="bcc-trace-link" type="button" data-zavorth-trace-action="open" data-run-id="${escapeHtml(run.id || '')}" data-trace-id="${escapeHtml(run.traceId || event.traceId || '')}" data-session-id="${escapeHtml(run.sessionId || event.sessionId || '')}">Ver trace</button></td>
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
          <td>â€”</td>
          <td>${state.commandCenter?.authRequired ? 'Unlock runtime' : 'Wait for first run'}</td>
          <td>${formatDate(state.commandCenter?.generatedAt || state.updatedAt)}</td>
          <td>${statusBadge(state.commandCenter?.authRequired ? 'auth' : 'ready', state.commandCenter?.authRequired ? 'Protected' : 'Ready')}</td>
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

    const auth = state.auth || {};
    const gatewayReady = Boolean(auth.gatewayReady);
    const webReady = Boolean(auth.webReady);
    tbody.innerHTML = `
      <tr>
        <td class="mono">zavorth-web</td>
        <td class="mono">${location.hostname || 'localhost'}</td>
        <td class="mono">â€”</td>
        <td>â€”</td>
        <td>${formatDate(state.updatedAt)}</td>
        <td>${statusBadge(webReady ? 'ready' : 'degraded', webReady ? 'Running' : 'Local')}</td>
      </tr>
      <tr>
        <td class="mono">agent-gateway</td>
        <td class="mono">runtime</td>
        <td class="mono">â€”</td>
        <td>â€”</td>
        <td>${state.commandCenter?.live ? 'live' : 'protected'}</td>
        <td>${statusBadge(gatewayReady || state.commandCenter?.live ? 'ready' : 'degraded', gatewayReady || state.commandCenter?.live ? 'Connected' : 'Protected')}</td>
      </tr>
    `;
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
      if (label === 'auth') value.textContent = state.commandCenter?.authRequired ? 'Local token required' : 'Local session';
      if (label === 'status') value.innerHTML = statusBadge(state.auth?.webReady ? 'ready' : 'degraded', state.auth?.webReady ? 'Connected' : 'Local');
      if (label === 'chat') value.textContent = modelProfile.modelLabel;
      if (label === 'agents') value.textContent = modelProfile.modelLabel;
      if (label === 'fallback') value.textContent = modelProfile.fallbackModelLabel || 'not configured';
      if (label === 'protocol') value.textContent = `${modelProfile.providerLabel} · ${getCurrentModelRouteLabel()}`;
    });

    updatePremiumStatus('Auto approvals', pendingApprovalCount() ? 'attention' : 'limited', pendingApprovalCount() ? 'warn' : 'info');
    updatePremiumStatus('Break-glass', 'locked', 'warn');
    updatePremiumStatus('Receipts', totalArtifactCount() ? `${totalArtifactCount()} visible` : 'on', 'ok');
    updatePremiumStatus('Secrets', 'redacted', 'ok');
  }

  function updateProviderModelCatalog() {
    const catalog = state.providerModelCatalog?.providerModelCatalog || state.providerModelCatalog;
    const summaryGrid = document.querySelector('[data-provider-model-catalog-summary]');
    const list = document.querySelector('[data-provider-model-catalog-list]');
    if (!summaryGrid || !list) return;

    if (!catalog || catalog.surface !== 'provider-model-catalog') {
      summaryGrid.innerHTML = `
        <div class="info-row"><span class="info-row__label">Routes</span><span class="info-row__value mono">waiting</span></div>
        <div class="info-row"><span class="info-row__label">Live</span><span class="info-row__value mono">waiting</span></div>
        <div class="info-row"><span class="info-row__label">Models</span><span class="info-row__value mono">waiting</span></div>
        <div class="info-row"><span class="info-row__label">Media</span><span class="info-row__value mono">waiting</span></div>
      `;
      list.innerHTML = entityCardHtml({
        title: 'Catalog waiting',
        id: 'read-only',
        status: 'Waiting',
        detail: 'Provider and model catalog has not been published by the runtime yet.',
      });
      return;
    }

    const summary = catalog.summary || {};
    const sections = catalog.sections || {};
    summaryGrid.innerHTML = `
      <div class="info-row"><span class="info-row__label">Routes</span><span class="info-row__value mono">${numberLabel(summary.providerRoutes || 0)} total / ${numberLabel(summary.defaultRouteAllowed || 0)} default</span></div>
      <div class="info-row"><span class="info-row__label">Live</span><span class="info-row__value mono">${numberLabel(summary.liveReadyRoutes || 0)} proven / ${numberLabel(summary.catalogReadyButNotLive || 0)} needs proof</span></div>
      <div class="info-row"><span class="info-row__label">Models</span><span class="info-row__value mono">${numberLabel(summary.effectiveModelSurface || 0)} surface / ${numberLabel(summary.liveDiscoveredModels || 0)} live-listed</span></div>
      <div class="info-row"><span class="info-row__label">Media</span><span class="info-row__value mono">${numberLabel((sections.mediaCapable || []).length)} route(s)</span></div>
    `;

    const providers = Array.isArray(catalog.providers) ? catalog.providers : [];
    const topProviders = [
      ...providers.filter((provider) => provider.liveReady),
      ...providers.filter((provider) => !provider.liveReady && provider.catalogReady),
      ...providers.filter((provider) => !provider.catalogReady),
    ].slice(0, 6);
    list.innerHTML = topProviders.map((provider) => entityCardHtml({
      title: provider.label || provider.id,
      id: `${provider.id} - ${provider.routeKind || 'route'}`,
      status: provider.liveReady ? 'Live proven' : provider.catalogReady ? 'Needs proof' : 'Configure',
      detail: `${numberLabel(provider.effectiveModelCount || 0)} model(s). ${escapeHtml((provider.modelSample || []).slice(0, 3).join(', ') || provider.userAction || 'No model listed yet.')}`,
      meta: `<span class="badge badge--muted">${escapeHtml((provider.modalities || []).join(' / ') || 'text')}</span><span class="badge badge--muted">${escapeHtml(provider.defaultRouteAllowed ? 'default allowed' : 'readiness gated')}</span>`,
    })).join('') || entityCardHtml({
      title: 'No provider routes',
      id: 'catalog',
      status: 'Empty',
      detail: 'No provider route has been projected yet.',
    });
  }

  function updateProviderActivation() {
    const activation = state.providerActivation?.providerActivation || state.providerActivation;
    const summaryGrid = document.querySelector('[data-provider-activation-summary]');
    const list = document.querySelector('[data-provider-activation-list]');
    if (!summaryGrid || !list) return;

    if (!activation || activation.surface !== 'provider-activation') {
      summaryGrid.innerHTML = `
        <div class="info-row"><span class="info-row__label">Execution</span><span class="info-row__value mono">waiting</span></div>
        <div class="info-row"><span class="info-row__label">Proof</span><span class="info-row__value mono">waiting</span></div>
        <div class="info-row"><span class="info-row__label">Adapters</span><span class="info-row__value mono">waiting</span></div>
        <div class="info-row"><span class="info-row__label">Connectors</span><span class="info-row__value mono">waiting</span></div>
      `;
      list.innerHTML = entityCardHtml({
        title: 'Activation waiting',
        id: 'read-only',
        status: 'Waiting',
        detail: 'Provider activation has not been published by the runtime yet.',
      });
      return;
    }

    const summary = activation.summary || {};
    summaryGrid.innerHTML = `
      <div class="info-row"><span class="info-row__label">Execution</span><span class="info-row__value mono">${numberLabel(summary.executionReady || 0)} ready / ${numberLabel(summary.routes || 0)} route(s)</span></div>
      <div class="info-row"><span class="info-row__label">Proof</span><span class="info-row__value mono">${numberLabel(summary.liveReady || 0)} live / ${numberLabel(summary.needsLiveProof || 0)} need proof</span></div>
      <div class="info-row"><span class="info-row__label">Adapters</span><span class="info-row__value mono">${numberLabel(summary.nativeAdapters || 0)} native / ${numberLabel(summary.openAiCompatibleAdapters || 0)} compatible</span></div>
      <div class="info-row"><span class="info-row__label">Connectors</span><span class="info-row__value mono">${numberLabel(summary.needsConnector || 0)} gap(s)</span></div>
    `;

    const routes = Array.isArray(activation.routes) ? activation.routes : [];
    const topRoutes = [
      ...routes.filter((route) => route.executionReady),
      ...routes.filter((route) => !route.executionReady && route.liveReady),
      ...routes.filter((route) => !route.liveReady),
    ].slice(0, 8);
    list.innerHTML = topRoutes.map((route) => entityCardHtml({
      title: route.label || route.id,
      id: `${route.id} - ${route.adapterKind || 'adapter'}`,
      status: route.executionReady ? 'Executable' : route.liveReady ? 'Needs connector' : 'Needs proof',
      detail: `${numberLabel(route.modelCount || 0)} model(s). ${escapeHtml(route.setupAction || route.connectorAction || 'Review provider activation.')}`,
      meta: `<span class="badge badge--muted">${escapeHtml((route.modalities || []).join(' / ') || 'text')}</span><span class="badge badge--muted">${escapeHtml(route.liveProofCommand || 'live proof command unavailable')}</span>`,
    })).join('') || entityCardHtml({
      title: 'No activation routes',
      id: 'activation',
      status: 'Empty',
      detail: 'No provider activation route has been projected yet.',
    });
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
    const title = escapeHtml(input?.title || 'Runtime');
    const id = escapeHtml(input?.id || '');
    const status = escapeHtml(input?.status || 'Waiting');
    const tone = input?.tone || badgeToneForStatus(status);
    const detail = escapeHtml(input?.detail || 'Sem dados reais publicados ainda.');
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
        status: state.commandCenter?.live ? 'Online' : state.commandCenter?.authRequired ? 'Protected' : 'Local',
        detail: state.commandCenter?.authRequired
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
      detail: `Ultimo sinal: ${formatDate(channel.lastUpdatedAt)}`,
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
    setSalesOsText('[data-sales-os-meta="conversations"]', inbox.length ? `${inbox.length} conversa(s) na inbox` : 'nenhuma conversa recebida');
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
        title: 'CRM inteligente',
        id: signal?.customerId || 'lead score',
        status: signal?.stage || 'Waiting sinal',
        detail: signal?.explanation || 'Intencao, objecao, risco e proxima acao aparecem aqui apos a primeira conversa.',
      }),
      entityCardHtml({
        title: 'Channel I/O',
        id: `${channel?.mode || 'demo'} / ${channelSummary.knownMessageIds || 0} ids`,
        status: `${numberLabel(channelSummary.processed || 0)} processadas`,
        detail: channel?.narrative?.operatorSummary || 'Idempotencia, status e receipts ficam visiveis no ledger de canal.',
      }),
      entityCardHtml({
        title: 'Agent Builder',
        id: 'AgentProfile',
        status: `${numberLabel(summary.agentProfiles || 5)} perfis`,
        detail: 'Sales, support, recovery, crm e supervisor entram por contratos do core.',
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
        status: state.commandCenter?.snapshot?.agentMesh ? 'Connected' : 'Auditable',
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
        status: state.commandCenter?.authRequired ? 'Protected' : 'Waiting',
        detail: state.commandCenter?.authRequired
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
      summary: String(entry?.summary || entry?.description || entry?.reason || 'Ferramenta exposta por uma run real.').trim(),
      status: String(entry?.status || entry?.mode || entry?.risk || 'disponivel').trim(),
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
    const renderSkillRow = (tool) => `
      <article class="skill-row skill-row--${tool.enabled ? 'ok' : 'info'}">
        <div>
          <h2>${escapeHtml(tool.title)}</h2>
          <p>${escapeHtml(tool.summary)}</p>
        </div>
        <span>${escapeHtml(tool.enabled ? text(tool.status, 'ready') : 'disabled')}</span>
      </article>
    `;

    if (premiumList) {
      const rows = tools.length > 0 ? tools.slice(0, 12) : [
        {
          title: 'Workspace review',
          summary: 'Available through the governed review surface when a repository is selected.',
          status: state.auth?.webReady ? 'ready' : 'local',
          enabled: true,
        },
        {
          title: 'Mnemos file understanding',
          summary: 'Reads only approved folders and files, then returns explanations with receipts.',
          status: 'scope required',
          enabled: true,
        },
        {
          title: 'Skill curator',
          summary: 'Uses runtime evidence to suggest quality improvements, merges and rollback-safe patches.',
          status: 'preview first',
          enabled: true,
        },
        {
          title: 'External agent onboarding',
          summary: 'Creates profiles from user-provided paths without silent scanning or live execution.',
          status: 'consent required',
          enabled: true,
        },
      ];
      premiumList.innerHTML = rows.map(renderSkillRow).join('');
    }

    updatePremiumStatus('Draft creation', 'approval gated', 'ok');
    updatePremiumStatus('Merge proposals', eventCountMatching(/skill.*merge|curator/i) ? 'available' : 'preview first', 'info');
    updatePremiumStatus('External sources', 'blocked by default', 'ok');
    updatePremiumStatus('Rollback', totalArtifactCount() ? 'receipt backed' : 'ready', 'ok');

    if (tools.length === 0) {
      setCardGrid('sector-skills', entityCardHtml({
        title: 'Active run tools',
        id: 'live runtime',
        status: state.commandCenter?.authRequired ? 'Protected' : 'Waiting',
        detail: state.commandCenter?.authRequired
          ? 'Unlock the dashboard to read live tools.'
          : 'No tool is exposed by an active run right now.',
      }));
      return;
    }
    setCardGrid('sector-skills', tools.slice(0, 12).map((tool) => entityCardHtml({
      title: tool.title,
      id: tool.id,
      status: tool.enabled ? tool.status : 'desativada',
      detail: tool.summary,
    })).join(''));
  }

  function groupRunsByModel() {
    const groups = new Map();
    for (const run of getRuns()) {
      const profile = normalizeModelProfile(run?.modelProfile) || resolveCurrentModelProfile();
      const key = profile.modelLabel || 'modelo atual';
      const current = groups.get(key) || {
        model: key,
        runs: 0,
        events: 0,
        artifacts: 0,
        status: 'Ready',
      };
      current.runs += 1;
      current.events += Array.isArray(run?.events) ? run.events.length : 0;
      current.artifacts += runArtifactCount(run);
      current.status = text(run?.status, current.status);
      groups.set(key, current);
    }
    return Array.from(groups.values());
  }

  function updateUsage() {
    const runs = getRuns();
    const models = groupRunsByModel();
    const tokenTotal = sumRunNumbers(['usage.totalTokens', 'usage.tokens', 'tokenUsage.totalTokens', 'tokens.total', 'tokensUsed', 'totalTokens']);
    const costTotal = sumRunNumbers(['usage.costUsd', 'costUsd', 'cost.usd', 'billing.costUsd']);
    const toolCalls = eventCountMatching(/tool|executor|command|mcp/i);
    const errors = eventCountMatching(/failed|error|blocked|rejected|cancelled|canceled/i);

    updatePremiumMetric('Tokens', numberLabel(tokenTotal), tokenTotal ? 'measured from run usage' : 'no measured usage yet');
    updatePremiumMetric('Cost', formattedMoney(costTotal), costTotal ? 'reported by provider/runtime' : 'provider cost proof pending');
    updatePremiumMetric('Tool calls', numberLabel(toolCalls), toolCalls ? 'from run events' : 'no execution recorded');
    updatePremiumMetric('Errors', numberLabel(errors), errors ? 'review reliability events' : 'no visible errors');
    updatePremiumStatus('Usage ledger', state.commandCenter?.live ? 'live' : 'local', state.commandCenter?.live ? 'ok' : 'info');
    updatePremiumStatus('Provider costs', costTotal ? 'reported' : 'when reported', costTotal ? 'ok' : 'info');
    updatePremiumStatus('Secrets', 'redacted', 'ok');
    updatePremiumStatus('Exports', totalArtifactCount() ? 'available' : 'manual', totalArtifactCount() ? 'ok' : 'info');
    updatePlatformAction('sector-usage', 'Today', `${numberLabel(runs.length)} run(s), ${numberLabel(tokenTotal)} token(s)`);
    updatePlatformAction('sector-usage', 'Reliability', `${numberLabel(errors)} issue event(s), ${numberLabel(toolCalls)} tool event(s)`);
    updatePlatformAction('sector-usage', 'Cost proof', costTotal ? formattedMoney(costTotal) : 'Waiting for provider cost data.');

    updateSummaryCard('Runs', numberLabel(runs.length), runs.length ? 'live executions registered' : 'no execution registered');
    updateSummaryCard('Current Model', getCurrentModelLabel(), getCurrentProviderLabel());
    updateSummaryCard('Artifacts', numberLabel(totalArtifactCount()), totalArtifactCount() ? 'generated by runtime' : 'no file generated in this session');
    updateSummaryCard('Approvals', numberLabel(pendingApprovalCount()), pendingApprovalCount() ? 'waiting for decision' : 'no pending approvals');

    setTableHeaders('sector-usage', ['Model', 'Runs', 'Events', 'Artifacts', 'Status']);
    if (models.length === 0) {
      setTableBody('sector-usage', `
        <tr>
          <td class="mono">${escapeHtml(getCurrentModelLabel())}</td>
          <td>0</td>
          <td>0</td>
          <td>0</td>
          <td>${statusBadge(state.commandCenter?.authRequired ? 'auth' : 'ready', state.commandCenter?.authRequired ? 'Protected' : 'Waiting run')}</td>
        </tr>
      `);
      return;
    }

    setTableBody('sector-usage', models.map((entry) => `
      <tr>
        <td class="mono">${escapeHtml(entry.model)}</td>
        <td>${numberLabel(entry.runs)}</td>
        <td>${numberLabel(entry.events)}</td>
        <td>${numberLabel(entry.artifacts)}</td>
        <td>${statusBadge(entry.status, text(entry.status, 'Ready'))}</td>
      </tr>
    `).join(''));
  }

  function updateCron() {
    const jobs = getWorkflowJobs();
    setTableHeaders('sector-cron', ['Job', 'Tipo', 'Tentativas', 'Proxima', 'Atualizada', 'Status']);
    if (jobs.length === 0) {
      setTableBody('sector-cron', `
        <tr>
          <td class="mono">workflow queue</td>
          <td>duravel local</td>
          <td>0</td>
          <td>â€”</td>
          <td>${formatDate(state.updatedAt)}</td>
          <td>${statusBadge(state.commandCenter?.authRequired ? 'auth' : 'ready', state.commandCenter?.authRequired ? 'Protected' : 'No live jobs')}</td>
        </tr>
      `);
      return;
    }

    setTableBody('sector-cron', jobs.slice(0, 8).map((job) => `
      <tr>
        <td class="mono">${escapeHtml(text(job.id || job.jobId || job.runId, 'job'))}</td>
        <td>${escapeHtml(text(job.type || job.kind, 'workflow'))}</td>
        <td>${numberLabel(job.attempts || job.attempt || 0)}</td>
        <td>${job.nextRunAt ? formatDate(job.nextRunAt) : 'â€”'}</td>
        <td>${formatDate(job.updatedAt || job.createdAt)}</td>
        <td>${statusBadge(job.status, text(job.status, 'Ready'))}</td>
      </tr>
    `).join(''));
  }

  function extractCompanions() {
    const candidates = [
      state.companions?.snapshot?.companions,
      state.companions?.companions,
      state.gatewayRuntime?.snapshot?.companions,
      state.gatewayRuntime?.companions,
    ];
    for (const candidate of candidates) {
      if (Array.isArray(candidate)) return candidate;
    }
    return [];
  }

  function updateNodes() {
    const companions = extractCompanions();
    const tools = collectToolExposures();
    const haystack = [
      ...tools.map((tool) => `${tool.id} ${tool.title} ${tool.summary}`),
      ...companions.map((node) => `${node?.id || ''} ${node?.label || ''} ${node?.type || ''} ${node?.kind || ''} ${node?.summary || ''}`),
    ].join(' ').toLowerCase();
    const hasMnemos = /mnemos|memory|vault/.test(haystack);
    const hasSwarm = /swarm|worker|subagent/.test(haystack) || Boolean(state.commandCenter?.snapshot?.swarmV2);
    const hasAcp = /\bacp\b|agent communication protocol/.test(haystack) || Boolean(state.commandCenter?.snapshot?.acp);
    const backendCount = companions.length;

    updatePremiumStatus('Mnemos', hasMnemos ? 'ready' : 'configurable', hasMnemos ? 'ok' : 'info');
    updatePremiumStatus('Swarm v2', hasSwarm ? 'ready' : 'ready', 'ok');
    updatePremiumStatus('ACP', hasAcp ? 'configured' : 'opt-in', hasAcp ? 'ok' : 'info');
    updatePremiumStatus('Backends', backendCount ? `${backendCount} visible` : 'policy gated', backendCount ? 'ok' : 'warn');
    updatePremiumStatus('External agents', companions.length ? `${companions.length} profile(s)` : 'consent required', companions.length ? 'ok' : 'info');
    updatePlatformAction('sector-nodes', 'Mnemos', hasMnemos ? 'Memory tools visible in runtime.' : 'Memory vault scope is configurable.');
    updatePlatformAction('sector-nodes', 'Swarm v2', hasSwarm ? 'Parallel work is ready with budget guard.' : 'Ready when a swarm task is requested.');
    updatePlatformAction('sector-nodes', 'ACP', hasAcp ? 'ACP adapter is configured.' : 'Universal ACP remains opt-in and policy-gated.');
    updatePlatformAction('sector-nodes', 'Execution backends', backendCount ? `${backendCount} backend/profile signal(s) visible.` : 'Backends require explicit configuration.');
    updatePlatformAction('sector-nodes', 'External agents', companions.length ? `${companions.length} consented profile(s).` : 'User-provided paths only; no silent discovery.');

    setTableHeaders('sector-nodes', ['Node', 'Type', 'Processes', 'Memory', 'Summary', 'Actions', 'Status']);
    if (companions.length === 0) {
      setTableBody('sector-nodes', `
        <tr>
          <td class="mono">companions</td>
          <td>Runtime</td>
          <td>0</td>
          <td>â€”</td>
          <td>${state.commandCenter?.authRequired ? 'Unlock to read live nodes' : 'No live companion/node connected'}</td>
          <td>â€”</td>
          <td>${statusBadge(state.commandCenter?.authRequired ? 'auth' : 'ready', state.commandCenter?.authRequired ? 'Protected' : 'Waiting')}</td>
        </tr>
      `);
      return;
    }

    setTableBody('sector-nodes', companions.slice(0, 8).map((node) => {
      const actions = Array.isArray(node?.actions) ? node.actions.length : 0;
      return `
        <tr>
          <td class="mono">${escapeHtml(text(node.id, node.label))}</td>
          <td>${escapeHtml(text(node.type || node.kind || node.label, 'Companion'))}</td>
          <td>${numberLabel(node.processCount || node.processes || 0)}</td>
          <td>${node.workingSetMb ? `${numberLabel(node.workingSetMb)} MB` : 'â€”'}</td>
          <td>${escapeHtml(text(node.summary || node.details, 'Sem resumo publicado'))}</td>
          <td>${numberLabel(actions)}</td>
          <td>${statusBadge(node.status, text(node.status, 'Ready'))}</td>
        </tr>
      `;
    }).join(''));
  }

  function basename(value) {
    return String(value || '').trim().replace(/\\/g, '/').split('/').filter(Boolean).pop() || '';
  }

  function extensionOf(value) {
    const name = basename(value).toLowerCase();
    const dot = name.lastIndexOf('.');
    return dot >= 0 ? name.slice(dot + 1) : '';
  }

  function inferArtifactKind(entry) {
    const explicit = String(entry?.kind || entry?.type || '').trim().toLowerCase();
    if (explicit) return explicit;
    const extension = extensionOf(entry?.path || entry?.name || entry?.title);
    if (extension === 'pdf') return 'pdf';
    if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(extension)) return 'image';
    if (['diff', 'patch'].includes(extension)) return 'diff';
    if (['md', 'txt', 'log', 'json', 'csv'].includes(extension)) return 'report';
    return 'file';
  }

  function normalizeArtifact(entry, defaults = {}) {
    const pathValue = String(entry?.path || entry?.filePath || defaults.path || '').trim();
    const name = String(entry?.name || entry?.title || basename(pathValue) || defaults.name || '').trim();
    const id = String(
      entry?.id
      || entry?.key
      || defaults.id
      || `${defaults.source || 'artifact'}:${defaults.toolRunId || defaults.runId || 'runtime'}:${pathValue || name}`,
    ).trim();
    if (!id) return null;
    return {
      id,
      source: String(entry?.source || defaults.source || 'runtime').trim(),
      kind: inferArtifactKind(entry),
      title: name || text(pathValue, id),
      name: name || null,
      path: pathValue || null,
      status: String(entry?.status || defaults.status || 'ready').trim(),
      summary: String(entry?.summary || entry?.description || defaults.summary || '').trim() || null,
      sessionId: String(entry?.sessionId || defaults.sessionId || '').trim() || null,
      runId: String(entry?.runId || defaults.runId || '').trim() || null,
      toolRunId: String(entry?.toolRunId || defaults.toolRunId || '').trim() || null,
      createdAt: entry?.createdAt || entry?.created_at || defaults.createdAt || null,
      content: entry?.content || entry?.output || entry?.body || null,
      diff: entry?.diff || defaults.diff || null,
      raw: entry,
    };
  }

  function extractArtifacts(payload) {
    const artifacts = [];
    const directArtifacts = [
      payload?.artifacts,
      payload?.artifactPlane?.artifacts,
      payload?.snapshot?.artifacts,
      payload?.session?.artifacts,
    ];
    for (const candidate of directArtifacts) {
      if (!Array.isArray(candidate)) continue;
      for (const entry of candidate) {
        const artifact = normalizeArtifact(entry, { sessionId: payload?.sessionId, source: entry?.source || 'runtime' });
        if (artifact) artifacts.push(artifact);
      }
    }

    const toolRuns = [
      payload?.toolRuns,
      payload?.snapshot?.toolRuns,
      payload?.session?.toolRuns,
    ];
    for (const candidate of toolRuns) {
      if (!Array.isArray(candidate)) continue;
      for (const run of candidate) {
        const toolRunId = String(run?.runId || run?.id || '').trim();
        const runArtifacts = Array.isArray(run?.artifacts) ? run.artifacts : [];
        for (const entry of runArtifacts) {
          const artifact = normalizeArtifact(entry, {
            source: 'tool-run',
            sessionId: payload?.sessionId,
            toolRunId,
            summary: entry?.summary || run?.summary,
          });
          if (artifact) artifacts.push(artifact);
        }
        const filesTouched = Array.isArray(run?.filesTouched) ? run.filesTouched : [];
        for (const pathValue of filesTouched) {
          const normalizedPath = String(pathValue || '').trim();
          const artifact = normalizeArtifact({
            id: `file:${toolRunId || 'session'}:${normalizedPath}`,
            kind: 'file',
            path: normalizedPath,
            title: basename(normalizedPath) || normalizedPath,
            summary: 'File touched by a live execution.',
          }, {
            source: 'file',
            sessionId: payload?.sessionId,
            toolRunId,
          });
          if (artifact) artifacts.push(artifact);
        }
        if (run?.diff && (Array.isArray(run.diff?.patches) || run.diff?.summary)) {
          const artifact = normalizeArtifact({
            id: `diff:${toolRunId || payload?.sessionId || 'session'}`,
            kind: 'diff',
            title: `Diff ${toolRunId || 'session'}`,
            summary: run.diff.summary || 'Changes generated by Zavorth.',
            diff: run.diff,
          }, {
            source: 'tool-run',
            sessionId: payload?.sessionId,
            toolRunId,
          });
          if (artifact) artifacts.push(artifact);
        }
      }
    }

    const runs = [
      payload?.snapshot?.runs,
      payload?.commandCenter?.snapshot?.runs,
      state.commandCenter?.snapshot?.runs,
    ];
    for (const candidate of runs) {
      if (!Array.isArray(candidate)) continue;
      for (const run of candidate) {
        const runArtifacts = Array.isArray(run?.artifacts) ? run.artifacts : [];
        for (const entry of runArtifacts) {
          const artifact = normalizeArtifact(entry, {
            source: 'agent-run',
            sessionId: entry?.sessionId || run?.sessionId,
            runId: run?.id,
            summary: entry?.summary || run?.summary,
          });
          if (artifact) artifacts.push(artifact);
        }
      }
    }

    return Array.from(new Map(artifacts.map((artifact) => [artifact.id, artifact])).values());
  }

  function hasDirectExecutionArtifactContext(payload) {
    if (!payload || typeof payload !== 'object') return false;
    if (String(payload.taskId || payload.runId || payload.approvalId || '').trim()) return true;
    if (Array.isArray(payload.artifacts) && payload.artifacts.length > 0) return true;
    if (Array.isArray(payload.artifactIds) && payload.artifactIds.length > 0) return true;
    return Boolean(payload.agentRun || payload.activeRun || payload.run);
  }

  function extractResponseDecision(payload) {
    const snapshot = payload?.snapshot || payload?.commandCenter?.snapshot || state.commandCenter?.snapshot || null;
    const candidates = [
      payload?.responseDecision,
      payload?.agentRun?.metadata?.responseDecision,
      payload?.activeRun?.metadata?.responseDecision,
      payload?.run?.metadata?.responseDecision,
      snapshot?.activeRun?.metadata?.responseDecision,
      snapshot?.agentRun?.metadata?.responseDecision,
      snapshot?.run?.metadata?.responseDecision,
    ];
    return candidates.find((candidate) => candidate && typeof candidate === 'object') || null;
  }

  function extractArtifactPolicy(payload) {
    const responseDecision = extractResponseDecision(payload);
    const snapshot = payload?.snapshot || payload?.commandCenter?.snapshot || state.commandCenter?.snapshot || null;
    const candidates = [
      payload?.artifactPolicy,
      responseDecision?.artifactPolicy,
      payload?.agentRun?.metadata?.artifactPolicy,
      payload?.activeRun?.metadata?.artifactPolicy,
      payload?.run?.metadata?.artifactPolicy,
      snapshot?.activeRun?.metadata?.artifactPolicy,
      snapshot?.agentRun?.metadata?.artifactPolicy,
      snapshot?.run?.metadata?.artifactPolicy,
    ];
    return candidates.find((candidate) => candidate && typeof candidate === 'object') || null;
  }

  function artifactPolicyAllowsChatDisplay(payload) {
    const policy = extractArtifactPolicy(payload);
    if (!policy) return true;
    return policy.shouldShowArtifactInChat === true;
  }

  function shouldDisplayArtifactsInChat(payload, options = {}) {
    if (options.display !== true) return false;
    if (!artifactPolicyAllowsChatDisplay(payload)) return false;
    return hasDirectExecutionArtifactContext(payload);
  }

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

  function normalizeDiffPreview(preview) {
    if (!preview || typeof preview !== 'object') return null;
    const planId = String(preview.planId || preview.plan_id || '').trim();
    const id = String(preview.id || planId || '').trim();
    if (!id) return null;
    const actions = preview.actions && typeof preview.actions === 'object' ? preview.actions : {};
    return {
      id,
      planId,
      runId: String(preview.runId || preview.run_id || readRunId() || '').trim(),
      sessionId: String(preview.sessionId || preview.session_id || readSessionId() || '').trim(),
      title: text(preview.title, 'Change preview'),
      summary: text(preview.summary || preview.diffReceiptText, 'Reversible draft prepared by the Intelligence Fabric.'),
      diffReceiptText: String(preview.diffReceiptText || preview.receiptText || preview.summary || '').trim(),
      approvalRequired: preview.approvalRequired === true,
      applied: preview.applied === true || String(preview.status || '').trim().toLowerCase() === 'applied',
      rollbackArtifactPath: String(preview.rollbackArtifactPath || '').trim(),
      actions: {
        approveApplyLabel: text(actions.approveApplyLabel, 'Approve/apply'),
        approveApplyInstruction: text(actions.approveApplyInstruction, 'Applies this draft to the workspace using the approved plan.'),
        rollbackLabel: text(actions.rollbackLabel, 'Rollback'),
        rollbackInstruction: text(actions.rollbackInstruction, 'Rollback is available through the Mutation Plane after apply.'),
      },
    };
  }

  function extractDiffPreviews(payload = state.commandCenter || {}) {
    const candidates = [
      payload?.snapshot?.diffPreviews,
      payload?.snapshot?.runObservatory?.diffPreviews,
      payload?.diffPreviews,
      payload?.commandCenter?.snapshot?.diffPreviews,
      payload?.commandCenter?.snapshot?.runObservatory?.diffPreviews,
      state.commandCenter?.snapshot?.diffPreviews,
      state.commandCenter?.snapshot?.runObservatory?.diffPreviews,
    ];
    const previews = [];
    for (const candidate of candidates) {
      if (!Array.isArray(candidate)) continue;
      for (const entry of candidate) {
        const preview = normalizeDiffPreview(entry);
        if (preview) previews.push(preview);
      }
    }
    const byPlan = new Map();
    for (const preview of previews) {
      const key = preview.planId || preview.id;
      const current = byPlan.get(key);
      if (!current || preview.applied || (!current.applied && preview.runId === readRunId())) {
        byPlan.set(key, preview);
      }
    }
    return Array.from(byPlan.values());
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

  function renderDiffPreviewsFromPayload(payload = state.commandCenter || {}) {
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
    window.ZavorthCommandCenterChat?.scrollFeedToEnd?.();
    return true;
  }


  function hasExecutionArtifactContext(payload) {
    if (!payload || typeof payload !== 'object') return false;
    if (!artifactPolicyAllowsChatDisplay(payload)) return false;
    if (String(payload.taskId || payload.runId || payload.approvalId || '').trim()) return true;
    if (Array.isArray(payload.artifacts) && payload.artifacts.length > 0) return true;
    if (Array.isArray(payload.artifactIds) && payload.artifactIds.length > 0) return true;
    if (payload.agentRun || payload.activeRun || payload.run) return true;
    const snapshot = payload.snapshot || payload.commandCenter || null;
    if (snapshot && typeof snapshot === 'object') {
      if (snapshot.activeRun || snapshot.agentRun || snapshot.run) return true;
      if (Array.isArray(snapshot.tasks) && snapshot.tasks.length > 0) return true;
      if (Array.isArray(snapshot.workflowRuns) && snapshot.workflowRuns.length > 0) return true;
      if (Array.isArray(snapshot.artifacts) && snapshot.artifacts.length > 0) return true;
    }
    return false;
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
      ['Tipo', artifact.kind],
      ['Origem', artifact.source],
      ['Caminho', artifact.path],
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
        payload?.preview?.truncated ? '<div class="callout info">Preview truncado para manter o painel leve.</div>' : '',
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

  async function fetchCurrentArtifacts(ui = window.ZavorthCommandCenterChat || {}) {
    const sessionId = readSessionId();
    if (!sessionId) {
      renderArtifactsFromPayload(state.commandCenter || {}, ui, { display: false, reason: 'state-sync' });
      return null;
    }
    const payload = await readJson(`/api/web/artifacts?sessionId=${encodeURIComponent(sessionId)}`, {
      headers: authHeaders(),
    });
    renderArtifactsFromPayload(payload, ui, { display: false, reason: 'state-sync' });
    return payload;
  }

  async function openArtifact(id, ui = window.ZavorthCommandCenterChat || {}) {
    const artifact = state.artifactsById.get(String(id || '').trim());
    if (!artifact) {
      throw new Error('Artifact not found in the current dashboard state.');
    }
    const html = await buildArtifactPaneHtml(artifact);
    ui.openArtifactPane?.(artifact.title || 'Artifact', html);
    return artifact;
  }

  function buildRunReplayHtml(run) {
    const events = Array.isArray(run?.events) ? run.events : [];
    const approvals = pendingRunApprovals(run);
    const artifacts = Array.isArray(run?.artifacts) ? run.artifacts : [];
    const job = findWorkflowJobForRun(run);
    const error = deriveRunError(run);
    const replay = events.length > 0
      ? events
        .map((event, index) => {
          const line = [
            `${String(index + 1).padStart(2, '0')}.`,
            `[${formatDate(event.createdAt)}]`,
            `${event.kind || 'evento'}:${event.status ? ` ${event.status}` : ''}`,
            `â€” ${event.title || event.detail || 'evento registrado'}`,
            event.detail && event.detail !== event.title ? `\n    ${event.detail}` : '',
          ].join(' ');
          return line;
        })
        .join('\n')
      : 'No granular event has been registered for this run yet.';

    return `
      <div class="logic-cell">
        <div class="logic-cell__header">
          <div class="logic-cell__title">
            <span class="logic-cell__icon"><svg viewBox="0 0 24 24"><path d="M4 4h16v16H4z"/><path d="M8 9h8M8 13h5"/></svg></span>
            ${escapeHtml(text(run.title, run.id))}
          </div>
          ${statusBadge(run.status, text(run.status, 'run'))}
        </div>
        <div class="logic-cell__detail">${escapeHtml(run.summary || run.input || 'Run registrada pelo gateway universal.')}</div>
        <div class="logic-cell__block">
          <div class="logic-cell__block-header"><span class="logic-cell__block-label">Next action</span></div>
          <pre class="logic-cell__block-content">${escapeHtml(deriveNextRunAction(run))}</pre>
        </div>
      </div>
      ${error ? `<div class="callout info">Recorded error: ${escapeHtml(error)}</div>` : ''}
      <div class="artifact-render">${[
        `Run: ${run.id || 'â€”'}`,
        `Session: ${run.sessionId || '—'}`,
        `Channel: ${run.channel || '—'}`,
        `Model: ${run.modelProfile?.modelLabel || 'not informed'}`,
        `Pending approvals: ${approvals.length}`,
        `Artifacts: ${artifacts.length}`,
        `Workflow job: ${job?.status || 'â€”'}`,
        `Atualizada: ${formatDate(run.updatedAt || run.createdAt)}`,
      ].map(escapeHtml).join('\n')}</div>
      <pre class="artifact-render"><code>${escapeHtml(replay)}</code></pre>
    `;
  }

  function openRunDetails(runId) {
    const id = String(runId || '').trim();
    const run = getRuns().find((candidate) => String(candidate?.id || '').trim() === id) || null;
    if (!run) {
      throw new Error('Run not found in the current dashboard snapshot.');
    }
    const html = buildRunReplayHtml(run);
    if (typeof window.openCoreModal === 'function') {
    window.openCoreModal(`Replay · ${text(run.title, run.id)}`, html);
      return run;
    }
    window.ZavorthCommandCenterChat?.openArtifactPane?.(`Replay · ${text(run.title, run.id)}`, html);
    return run;
  }

  function wireRunReplayRows() {
    if (document.body?.dataset.zavorthRunReplayWired === 'true') return;
    if (document.body) document.body.dataset.zavorthRunReplayWired = 'true';
    document.addEventListener('click', (event) => {
      const traceButton = event.target?.closest?.('[data-zavorth-trace-action="open"]');
      if (traceButton) {
        event.preventDefault();
        event.stopPropagation();
        openPersistentTrace({
          runId: traceButton.dataset.runId || traceButton.dataset.zavorthRunId || '',
          traceId: traceButton.dataset.traceId || traceButton.dataset.zavorthTraceId || '',
          sessionId: traceButton.dataset.sessionId || traceButton.dataset.zavorthSessionId || '',
        }, window.ZavorthCommandCenterChat || {}).catch((error) => {
          window.emitSignal?.('error', 'Trace unavailable', String(error?.message || 'Run not found.'));
        });
        return;
      }
      const row = event.target?.closest?.('[data-zavorth-run-id]');
      if (!row) return;
      const runId = row.dataset.zavorthRunId;
      try {
        openRunDetails(runId);
      } catch (error) {
        window.emitSignal?.('error', 'Replay unavailable', String(error?.message || 'Run not found.'));
      }
    });
  }

  function closeCoreModal() {
    document.getElementById('overlay-shade')?.classList.remove('active');
    document.getElementById('core-modal')?.classList.remove('active');
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
    feedback.style.color = tone === 'danger' ? 'var(--b-danger)' : 'var(--b-signal-muted)';
  }

  function openAccessStatusModal() {
    const unlocked = Boolean(state.commandCenter?.live && !state.commandCenter?.authRequired);
    const protectedMode = Boolean(state.commandCenter?.authRequired);
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
        ? lockCommandCenterTab
        : () => openUnlockModal('Enter the local token to read live runs and send messages to Zavorth.');
    }
  }

  async function lockCommandCenterTab() {
    clearStoredToken();
    disconnectRealtime('locked');
    closeCoreModal();
    window.emitSignal?.('info', 'Tab locked', 'The local token was removed from this tab.');
    await refresh({ skipRealtime: true }).catch(() => undefined);
  }

  function openUnlockModal(reason = '') {
    const content = `
      <form id="zavorth-unlock-form" class="config-form" autocomplete="off">
        <div class="config-form-section">
          <span class="config-form-section__title">Protected access</span>
          <div class="info-row">
            <span class="info-row__label">Estado</span>
            <span class="info-row__value">${statusBadge('warn', hasStoredToken() ? 'Revalidate token' : 'Token required')}</span>
          </div>
          <p style="margin:0;color:var(--b-signal-muted);line-height:1.6">
            ${text(reason, 'Enter the local token to connect this tab to the live runtime.')}
          </p>
          <div class="info-row">
            <span class="info-row__label">Jeito facil</span>
            <span class="info-row__value mono">zavorth dashboard</span>
          </div>
          <p style="margin:0;color:var(--b-signal-muted);font-size:12px;line-height:1.5">
            In the terminal, this command opens the dashboard already unlocked. To copy it manually,
            use <span class="mono">zavorth dashboard token</span>.
          </p>
          <label class="core-field">
            <span>Token local</span>
            <input id="zavorth-unlock-token" type="password" placeholder="Paste the Zavorth token" autocomplete="off" />
          </label>
          <p id="zavorth-unlock-feedback" style="margin:0;color:var(--b-signal-muted);font-size:12px;line-height:1.5">
            O token fica salvo apenas no sessionStorage desta aba. Depois de validar, o topo muda para Core Unlocked.
          </p>
        </div>
      </form>
    `;

    if (typeof window.openCoreModal === 'function') {
      window.openCoreModal('Unlock live runtime', content);
    } else {
      return;
    }

    const input = document.getElementById('zavorth-unlock-token');
    const form = document.getElementById('zavorth-unlock-form');
    const cancel = document.getElementById('core-modal-cancel');
    const confirm = document.getElementById('core-modal-confirm');

    if (cancel) {
      cancel.textContent = 'Not now';
      cancel.onclick = closeCoreModal;
    }
    if (confirm) {
      confirm.textContent = 'Unlock';
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
      setUnlockFeedback('Paste the local token before unlocking.', 'danger');
      return false;
    }

    const confirm = document.getElementById('core-modal-confirm');
    if (confirm) {
      confirm.disabled = true;
      confirm.textContent = 'Validando...';
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
        `${error?.message || 'Invalid or old token.'} Open a new tab with ${recovery}.`,
        'danger',
      );
      if (confirm) {
        confirm.disabled = false;
        confirm.textContent = 'Unlock';
      }
      return false;
    }
  }

  function applyRuntimeData() {
    updatePulse();
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
    renderRemoteMeshApprovalsFromPayload(state.commandCenter || {}, window.ZavorthCommandCenterChat || {});
    renderArtifactsFromPayload(state.commandCenter || {}, window.ZavorthCommandCenterChat || {}, { display: false, reason: 'dashboard-refresh' });
    renderDiffPreviewsFromPayload(state.commandCenter || {});
  }

  function normalizeTranscriptEntry(message) {
    const content = String(message?.content || message?.text || message?.message || '').trim();
    if (!content) return null;
    const role = String(message?.role || message?.source || '').trim().toLowerCase();
    return {
      id: String(message?.id || message?.messageId || `${role}:${content}`).trim(),
      role: ['user', 'operator', 'human'].includes(role) ? 'user' : 'assistant',
      content,
      createdAt: message?.createdAt || message?.created_at || null,
      kind: message?.kind || null,
    };
  }

  function extractTranscriptMessages(payload) {
    const candidates = [
      payload?.snapshot?.messages,
      payload?.session?.transcript,
      payload?.gatewaySessionTools?.history?.transcript,
      payload?.session?.messages,
    ];
    for (const candidate of candidates) {
      if (!Array.isArray(candidate) || candidate.length === 0) {
        continue;
      }
      return candidate.map(normalizeTranscriptEntry).filter(Boolean);
    }
    return [];
  }

  function renderMessagesFromPayload(payload, ui = {}, options = {}) {
    if (isTranscriptRenderSuppressed(options)) {
      return false;
    }
    const messages = extractTranscriptMessages(payload);
    if (messages.length === 0 || typeof ui.renderTranscript !== 'function') {
      return false;
    }
    return ui.renderTranscript(messages, { label: 'Live history' });
  }

  function normalizeApproval(entry, kind) {
    const id = String(
      entry?.id
      || entry?.permission_id
      || entry?.task_id
      || entry?.approvalId
      || entry?.requestId
      || '',
    ).trim();
    if (!id) return null;

    const status = String(entry?.status || entry?.approval_status || 'pending').trim().toLowerCase();
    const pending = status === 'pending'
      || status === 'waiting'
      || status === 'waiting_approval'
      || status === 'requested'
      || status === 'null';
    if (!pending) return null;

    return {
      id,
      kind,
      status: 'pending',
      title: String(
        entry?.title
        || entry?.kind
        || entry?.command_type
        || (kind === 'task' ? 'Task waiting for approval' : 'Permission waiting for approval'),
      ).trim(),
      summary: String(
        entry?.reason
        || entry?.requested_value
        || entry?.raw_message
        || entry?.summary
        || 'Review before authorizing.',
      ).trim(),
      risk: String(entry?.risk_level || entry?.scope || entry?.executor || 'review').trim(),
      taskId: String(entry?.task_id || '').trim() || null,
      runId: String(entry?.runId || entry?.agentRunId || entry?.correlation?.runId || '').trim() || null,
      traceId: String(entry?.traceId || entry?.correlation?.traceId || '').trim() || null,
      sessionId: String(entry?.sessionId || entry?.correlation?.sessionId || '').trim() || null,
      capability: entry?.capability || entry?.tool || entry?.permission || null,
    };
  }

  function extractApprovals(payload) {
    const approvals = [];
    const permissions = [
      payload?.permissions,
      payload?.snapshot?.permissions,
      payload?.session?.permissions,
      payload?.gatewaySessionTools?.history?.permissions,
    ];
    for (const candidate of permissions) {
      if (!Array.isArray(candidate)) continue;
      for (const entry of candidate) {
        const approval = normalizeApproval(entry, 'permission');
        if (approval) approvals.push(approval);
      }
    }

    const tasks = [
      payload?.snapshot?.tasks,
      payload?.session?.tasks,
      payload?.gatewaySessionTools?.history?.tasks,
    ];
    for (const candidate of tasks) {
      if (!Array.isArray(candidate)) continue;
      for (const entry of candidate) {
        const requiresApproval = entry?.requires_approval === true
          || String(entry?.approval_status || '').toLowerCase() === 'pending';
        if (!requiresApproval) continue;
        const approval = normalizeApproval({
          ...entry,
          approval_status: entry?.approval_status || 'pending',
        }, 'task');
        if (approval) approvals.push(approval);
      }
    }

    const runs = [
      payload?.snapshot?.runs,
      payload?.commandCenter?.snapshot?.runs,
      state.commandCenter?.snapshot?.runs,
    ];
    for (const candidate of runs) {
      if (!Array.isArray(candidate)) continue;
      for (const run of candidate) {
        const runApprovals = Array.isArray(run?.approvals) ? run.approvals : [];
        for (const approvalEntry of runApprovals) {
          const approval = normalizeApproval({
            ...approvalEntry,
            runId: approvalEntry?.runId || approvalEntry?.agentRunId || run?.id || run?.runId,
            traceId: approvalEntry?.traceId || run?.traceId,
            sessionId: approvalEntry?.sessionId || run?.sessionId,
            title: approvalEntry?.title || run?.title || 'Run waiting for approval',
            summary: approvalEntry?.summary || approvalEntry?.reason || run?.objective || run?.text,
          }, 'agent-run');
          if (approval) approvals.push(approval);
        }
      }
    }

    const byKey = new Map();
    for (const approval of approvals) {
      byKey.set(approval.id, approval);
    }
    return Array.from(byKey.values());
  }

  function renderApprovalsFromPayload(payload, ui = {}) {
    const approvals = extractApprovals(payload);
    if (typeof ui.renderApprovals !== 'function') {
      return false;
    }
    return ui.renderApprovals(approvals);
  }

  function normalizeRemoteMeshApprovalCard(card) {
    const approval = card?.approval && typeof card.approval === 'object' ? card.approval : null;
    const approvalId = String(approval?.approvalId || '').trim();
    if (!approvalId) return null;
    const applyToolName = String(approval?.applyToolName || '').trim();
    const applyArguments = approval?.applyArguments && typeof approval.applyArguments === 'object' && !Array.isArray(approval.applyArguments)
      ? approval.applyArguments
      : null;
    if (!applyToolName || !applyArguments) return null;
    const stateValue = String(card?.state || '').trim().toLowerCase();
    if (stateValue && stateValue !== 'approval-required' && stateValue !== 'pending') return null;
    const surface = String(card?.surface || 'command-center').trim().toLowerCase();
    if (surface && surface !== 'command-center') return null;

    return {
      id: approvalId,
      status: 'pending',
      title: String(card?.title || 'Remote Mesh approval').trim(),
      summary: String(card?.body || 'Revise a acao remota antes de aplicar no notebook MCP.').trim(),
      risk: String(card?.riskLabel || 'medium').trim(),
      targetKind: String(card?.targetKind || 'notebook').trim(),
      targetLabel: String(card?.targetLabel || 'Notebook MCP').trim(),
      badge: String(card?.commandCenter?.badge || 'Needs approval').trim(),
      primaryActionLabel: String(card?.commandCenter?.primaryActionLabel || 'Aplicar no MCP').trim(),
      applyToolName,
      applyArguments,
      approvalPhrase: String(approval?.approvalPhrase || '').trim(),
      expiresAt: String(approval?.expiresAt || '').trim(),
    };
  }

  function collectRemoteMeshUxSnapshots(payload) {
    const snapshots = [
      payload?.remoteMeshApprovalUx,
      payload?.remoteMeshNotebookApprovalUx,
      payload?.snapshot?.remoteMeshApprovalUx,
      payload?.snapshot?.remoteMeshNotebookApprovalUx,
      payload?.commandCenter?.remoteMeshApprovalUx,
      payload?.commandCenter?.remoteMeshNotebookApprovalUx,
      payload?.commandCenter?.snapshot?.remoteMeshApprovalUx,
      payload?.commandCenter?.snapshot?.remoteMeshNotebookApprovalUx,
      payload?.snapshot?.activeRun?.metadata?.remoteMeshApprovalUx,
      payload?.snapshot?.activeRun?.metadata?.remoteMeshNotebookApprovalUx,
      payload?.activeRun?.metadata?.remoteMeshApprovalUx,
      payload?.activeRun?.metadata?.remoteMeshNotebookApprovalUx,
    ];

    const runs = [
      payload?.snapshot?.runs,
      payload?.commandCenter?.snapshot?.runs,
      state.commandCenter?.snapshot?.runs,
    ];
    for (const candidate of runs) {
      if (!Array.isArray(candidate)) continue;
      for (const run of candidate) {
        snapshots.push(run?.metadata?.remoteMeshApprovalUx);
        snapshots.push(run?.metadata?.remoteMeshNotebookApprovalUx);
      }
    }
    return snapshots.filter((snapshot) => snapshot && typeof snapshot === 'object');
  }

  function extractRemoteMeshApprovalCards(payload) {
    const cards = [];
    for (const snapshot of collectRemoteMeshUxSnapshots(payload)) {
      const rawCards = Array.isArray(snapshot?.cards) ? snapshot.cards : [];
      for (const rawCard of rawCards) {
        const card = normalizeRemoteMeshApprovalCard(rawCard);
        if (card) cards.push(card);
      }
    }
    const byId = new Map();
    for (const card of cards) {
      byId.set(card.id, card);
    }
    return Array.from(byId.values());
  }

  function renderRemoteMeshApprovalsFromPayload(payload, ui = {}) {
    const cards = extractRemoteMeshApprovalCards(payload);
    state.remoteMeshApprovals = cards;
    state.remoteMeshApprovalsById = new Map(cards.map((card) => [card.id, card]));
    if (typeof ui.renderRemoteMeshApprovals !== 'function') {
      return false;
    }
    return ui.renderRemoteMeshApprovals(cards);
  }

  async function fetchCurrentApprovals(ui = window.ZavorthCommandCenterChat || {}) {
    const sessionId = readSessionId();
    if (!sessionId) return null;
    const payload = await readJson(`/api/web/permissions?sessionId=${encodeURIComponent(sessionId)}`, {
      headers: authHeaders(),
    });
    renderApprovalsFromPayload(payload, ui);
    return payload;
  }

  async function hydrateCurrentSession(ui = window.ZavorthCommandCenterChat || {}, options = {}) {
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
    renderDiffPreviewsFromPayload(state.commandCenter || {});
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
      String(error?.message || 'Tente novamente em instantes.'),
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

    try {
      const payload = await readJson('/api/web/chat/send', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          message: text,
          sessionId: readSessionId() || undefined,
          platform: 'web',
          source: 'command-center',
          attachments,
          selectedSkills,
          voice,
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
      if (error?.status === 401) {
        openUnlockModal('To send live messages, unlock this tab with the local Zavorth token.');
      }
      if (error?.status !== 401) {
        ui.emitSignal?.('error', 'Runtime unavailable', error?.message || 'Try again.');
      }
      await refresh().catch(() => undefined);
      throw error;
    }
  }

  async function decideApproval(input, ui = {}) {
    const id = String(input?.id || '').trim();
    const kind = String(input?.kind || '').trim();
    const decision = String(input?.decision || '').trim().toLowerCase();
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
      ? { approvalId: id, sessionId, source: 'command-center' }
      : kind === 'task'
        ? { taskId: id, sessionId }
        : { permissionId: id, sessionId, scope: 'once' };

    const payload = await readJson(path, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(body),
    });
    if (decision === 'approve') {
      ui.emitSignal?.(
        'success',
        'Autorizado',
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
        customerId: 'lead-command-center',
        text: 'Achei caro, mas ainda tenho interesse. Ainda tem vaga?',
        traceId: `trace-${providerMessageId}`,
        metadata: { source: 'command-center-sales-os' },
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
      state.commandCenter = {
        ...(state.commandCenter || {}),
        live: state.commandCenter?.live !== false,
        generatedAt: payload.generatedAt || state.commandCenter?.generatedAt,
        snapshot: payload.snapshot,
      };
      writeRunId(payload.run?.id || payload.snapshot?.activeRun?.id || runId);
      writeSessionId(payload.run?.sessionId || payload.snapshot?.activeRun?.sessionId || sessionId);
      replaceCommandCenterUrlParams({
        runId: payload.run?.id || payload.snapshot?.activeRun?.id || runId,
        sessionId: payload.run?.sessionId || payload.snapshot?.activeRun?.sessionId || sessionId,
      });
    }
    ui.emitSignal?.('success', 'Draft applied', `Plan ${planId} sent to the Mutation Plane.`);
    ui.appendEcho?.('core', `Draft applied successfully.\n\nPlan: \`${planId}\``);
    renderMessagesFromPayload(payload, ui, { renderTranscript: false });
    renderApprovalsFromPayload(payload, ui);
    renderRemoteMeshApprovalsFromPayload(payload, ui);
    renderArtifactsFromPayload(payload, ui, { display: true, reason: 'diff-preview-apply', source: 'command-center' });
    renderDiffPreviewsFromPayload(payload);
    await refresh({ skipSessionHydrate: true }).catch(() => undefined);
    await fetchDashboardEvents(ui).catch(() => undefined);
    return payload;
  }

  async function refresh(options = {}) {
    try {
      const [auth, commandCenter, providerModelCatalog, providerActivation, salesPack, salesPackChannelIo] = await Promise.all([
        readJson('/api/auth/status'),
        readJson(`/api/web/command-center${buildCommandCenterQueryString()}`, { headers: authHeaders() }),
        readJson('/api/providers/model-catalog', { headers: authHeaders() }).catch(() => null),
        readJson('/api/providers/activation', { headers: authHeaders() }).catch(() => null),
        readJson('/api/v2/sales-pack/snapshot').catch(() => null),
        readJson('/api/v2/sales-pack/channel-io/snapshot').catch(() => null),
      ]);
      state.auth = auth;
      state.commandCenter = commandCenter;
      state.providerModelCatalog = providerModelCatalog?.providerModelCatalog || providerModelCatalog || null;
      state.providerActivation = providerActivation?.providerActivation || providerActivation || null;
      state.salesPack = salesPack;
      state.salesPackChannelIo = salesPackChannelIo;
      writeRunId(commandCenter?.snapshot?.activeRun?.id || commandCenter?.activeRun?.id || readRunId());
      if (commandCenter?.live && !commandCenter?.authRequired) {
        const sessionId = readSessionId();
        const sessionQuery = sessionId ? `?sessionId=${encodeURIComponent(sessionId)}` : '';
        const [catalog, companions, gatewayRuntime] = await Promise.all([
          readJson(`/api/web/catalog${sessionQuery}`, { headers: authHeaders() }).catch(() => null),
          readJson('/api/web/runtime/companions', { headers: authHeaders() }).catch(() => null),
          readJson(`/api/web/gateway/runtime${sessionQuery}`, { headers: authHeaders() }).catch(() => null),
        ]);
        state.catalog = catalog;
        state.companions = companions;
        state.gatewayRuntime = gatewayRuntime;
      } else {
        state.catalog = null;
        state.companions = null;
        state.gatewayRuntime = null;
      }
      state.lastError = null;
      state.updatedAt = new Date().toISOString();
      applyRuntimeData();
      if (!options.skipSessionHydrate && commandCenter?.live && readSessionId()) {
        hydrateCurrentSession().catch(() => undefined);
        fetchCurrentArtifacts().catch(() => undefined);
      }
      if (commandCenter?.live && readSessionId()) {
        fetchDashboardEvents().catch(() => undefined);
      }
      if (!options.skipRealtime) {
        connectRealtime();
      }
    } catch (error) {
      state.lastError = error?.message || String(error);
      state.updatedAt = new Date().toISOString();
      updatePulse();
    }
  }

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
    action.textContent = 'Criando...';
    sendSalesPackDemoInbound()
      .catch((error) => window.emitSignal?.('error', 'Sales OS', error?.message || 'Falha ao criar conversa local.'))
      .finally(() => {
        action.disabled = false;
        action.textContent = previousText || 'Criar conversa local';
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
    const ui = window.ZavorthCommandCenterChat || {};
    applyButton.disabled = true;
    applyButton.textContent = 'Aplicando...';
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
      applyButton.textContent = 'Tentar novamente';
      window.emitSignal?.('error', 'Apply bloqueado', String(error?.message || 'Tente novamente.'));
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
})();
