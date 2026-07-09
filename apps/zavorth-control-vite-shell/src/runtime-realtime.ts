type RuntimeRealtimeOptions = {
  state: any;
  authHeaders: () => Record<string, string>;
  realtimePath: (sessionId: string) => string;
  resolveRealtimeSessionId: () => string;
  updatePulse: () => void;
  refreshRuntime: () => Promise<unknown>;
  hydrateCurrentSession: () => Promise<unknown>;
  fetchCurrentApprovals: () => Promise<unknown>;
  fetchCurrentArtifacts: () => Promise<unknown>;
  fetchDashboardEvents: () => Promise<unknown>;
  renderMessagesFromPayload: (payload: any, ui?: any, options?: any) => unknown;
  renderApprovalsFromPayload: (payload: any, ui?: any) => unknown;
  renderRemoteMeshApprovalsFromPayload: (payload: any, ui?: any) => unknown;
  renderArtifactsFromPayload: (payload: any, ui?: any, options?: any) => unknown;
};

declare global {
  interface Window {
    ZavorthControlChat?: any;
  }
}

function dashboardEventTime(value: unknown) {
  const normalized = String(value || '').trim();
  return normalized || new Date().toISOString();
}

function dashboardEventFromRealtimeEvent(event: any) {
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
  if (type === 'agent-stream') {
    const runtimeType = String(payload?.eventType || '').trim() || 'agent.stream';
    const phase = String(payload?.phase || payload?.streamStatus || payload?.status || 'event').trim();
    if (runtimeType === 'agent.stream.assistant' && phase === 'delta') {
      return null;
    }
    const done = payload?.done === true || phase === 'done';
    return {
      id: `sse:agent-stream:${eventId}:${runtimeType}:${phase}:${payload?.chunkIndex ?? ''}`,
      type: done ? 'reply' : 'step',
      title: payload?.title || (runtimeType === 'agent.stream.assistant' ? 'Assistant stream' : 'Agent stream'),
      detail: payload?.summary || payload?.accumulated || payload?.delta || '',
      meta: runtimeType,
      status: done ? 'done' : phase,
      time: dashboardEventTime(event?.createdAt),
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

export function createRuntimeRealtime({
  state,
  authHeaders,
  realtimePath,
  resolveRealtimeSessionId,
  updatePulse,
  refreshRuntime,
  hydrateCurrentSession,
  fetchCurrentApprovals,
  fetchCurrentArtifacts,
  fetchDashboardEvents,
  renderMessagesFromPayload,
  renderApprovalsFromPayload,
  renderRemoteMeshApprovalsFromPayload,
  renderArtifactsFromPayload,
}: RuntimeRealtimeOptions) {
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

  function markRealtimeConnected(transport: string, eventType = 'open') {
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

  function markRealtimeConnecting(transport: string, sessionId: string) {
    const realtime = state.realtime;
    realtime.connected = false;
    realtime.connecting = true;
    realtime.sessionId = sessionId;
    realtime.transport = transport;
    realtime.lastError = null;
    updatePulse();
  }

  function markRealtimeDisconnected(error: any) {
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
      connectRealtime();
    }, delay);
  }

  function scheduleRealtimeRefresh(reason = 'event', delayMs = 350) {
    const realtime = state.realtime;
    realtime.lastEventType = reason;
    if (realtime.refreshTimer) return;
    realtime.refreshTimer = setTimeout(async () => {
      realtime.refreshTimer = null;
      await refreshRuntime().catch(() => undefined);
      await hydrateCurrentSession().catch(() => undefined);
      await fetchCurrentApprovals().catch(() => undefined);
      await fetchCurrentArtifacts().catch(() => undefined);
      await fetchDashboardEvents().catch(() => undefined);
    }, delayMs);
  }

  function emitDashboardEvents(events: any[], source = 'runtime-history') {
    const ui = window.ZavorthControlChat || {};
    if (!Array.isArray(events) || typeof ui.ingestRuntimeEvents !== 'function') {
      return false;
    }
    return ui.ingestRuntimeEvents(events, { source });
  }

  function emitAgentStreamEvent(event: any) {
    const ui = window.ZavorthControlChat || {};
    if (typeof ui.ingestAgentStreamEvent !== 'function') {
      return false;
    }
    return ui.ingestAgentStreamEvent(event, { source: 'sse' });
  }

  function handleRealtimeEvent(event: any) {
    const eventType = String(event?.type || 'message').trim() || 'message';
    markRealtimeConnected(state.realtime.transport === 'eventsource' ? 'eventsource' : 'fetch-sse', eventType);
    if (eventType === 'ping') return;

    if (eventType === 'agent-stream') {
      emitAgentStreamEvent(event);
    }

    const dashboardEvent = dashboardEventFromRealtimeEvent(event);
    if (dashboardEvent) emitDashboardEvents([dashboardEvent], 'sse');

    if (eventType === 'snapshot') {
      const payload = { snapshot: event?.payload || {} };
      renderMessagesFromPayload(payload, window.ZavorthControlChat || {}, { reason: 'realtime-snapshot' });
      renderApprovalsFromPayload(payload, window.ZavorthControlChat || {});
      renderRemoteMeshApprovalsFromPayload(payload, window.ZavorthControlChat || {});
      renderArtifactsFromPayload(payload, window.ZavorthControlChat || {}, { display: false, reason: 'realtime-snapshot' });
      void fetchDashboardEvents().catch(() => undefined);
    }

    scheduleRealtimeRefresh(eventType, eventType === 'snapshot' ? 250 : 500);
  }

  function consumeSseBlock(block: string) {
    const lines = String(block || '').split('\n');
    let eventType = 'message';
    const data: string[] = [];
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
      if (heartbeat) markRealtimeConnected(state.realtime.transport === 'eventsource' ? 'eventsource' : 'fetch-sse', 'heartbeat');
      return;
    }

    try {
      const parsed = JSON.parse(data.join('\n'));
      handleRealtimeEvent({
        ...parsed,
        type: parsed?.type || eventType,
      });
    } catch (error: unknown) {
      state.realtime.lastError = error?.message || 'Invalid realtime event.';
    }
  }

  function consumeSseBuffer(buffer: string) {
    const normalized = String(buffer || '').replace(/\r\n/g, '\n');
    const parts = normalized.split('\n\n');
    const rest = parts.pop() || '';
    for (const part of parts) consumeSseBlock(part);
    return rest;
  }

  async function startFetchEventStream(sessionId: string) {
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

      if (!response.ok) throw new Error(`/api/web/events returned HTTP ${response.status}`);
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
    } catch (error: unknown) {
      if (controller.signal.aborted || state.realtime.stopped) return;
      markRealtimeDisconnected(error);
      scheduleRealtimeReconnect();
    }
  }

  function startEventSourceStream(sessionId: string) {
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

    ['snapshot', 'message', 'task', 'tool', 'workflow', 'permission', 'agent-stream', 'ping'].forEach((type) => {
      source.addEventListener(type, (event) => {
        try {
          const parsed = JSON.parse((event as MessageEvent).data || '{}');
          handleRealtimeEvent({
            ...parsed,
            type: parsed?.type || type,
          });
        } catch (error: unknown) {
          state.realtime.lastError = error?.message || 'Invalid realtime event.';
        }
      });
    });

    return true;
  }

  function connectRealtime() {
    const sessionId = resolveRealtimeSessionId();
    if (!sessionId || !state.zavorthControl?.live || state.zavorthControl?.authRequired) {
      disconnectRealtime('not-ready');
      return false;
    }

    const realtime = state.realtime;
    if ((realtime.connected || realtime.connecting) && realtime.sessionId === sessionId) return true;

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

  return {
    connectRealtime,
    disconnectRealtime,
  };
}
