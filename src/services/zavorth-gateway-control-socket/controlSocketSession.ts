import type { WebSocket } from 'ws';
import {
  buildGatewayControlHeartbeatEvent,
  buildGatewayControlReadyEvent,
  mapGatewayControlRealtimeEventKind,
  normalizeGatewayControlReplayMode,
} from './controlSocketProtocol.js';
import {
  buildGatewayControlHydrateEvent,
  buildGatewayControlResourceEvent,
} from './controlSocketHydrate.js';

import type {
  GatewayConnectionState,
  GatewayControlReplayMode,
  GatewayControlSocketDeps,
  GatewayControlSocketSend,
} from './controlSocketTypes.js';

export async function initializeGatewayControlConnection(input: {
  ws: WebSocket;
  sessionId: string;
  url: URL;
  deps: GatewayControlSocketDeps;
  send: GatewayControlSocketSend;
  activateSession: (
    state: GatewayConnectionState,
    sessionId: string,
    replayMode: GatewayControlReplayMode,
  ) => Promise<void>;
  onMessage: (state: GatewayConnectionState, rawMessage: string) => Promise<void>;
}): Promise<void> {
  const state: GatewayConnectionState = {
    sessionId: input.sessionId,
    heartbeat: null,
    unsubscribe: null,
  };

  const heartbeatIntervalMs = Number(input.deps.heartbeatIntervalMs || 15_000) || 15_000;
  const replayMode = normalizeGatewayControlReplayMode(input.url.searchParams.get('replay'));

  await input.activateSession(state, input.sessionId, replayMode);

  state.heartbeat = setInterval(() => {
    input.send(buildGatewayControlHeartbeatEvent(state.sessionId));
  }, heartbeatIntervalMs);

  input.ws.on('message', (message) => {
    void input.onMessage(state, message.toString());
  });

  input.ws.on('close', () => {
    if (state.heartbeat) {
      clearInterval(state.heartbeat);
    }
    if (state.unsubscribe) {
      state.unsubscribe();
    }
  });
}

export async function activateGatewayControlSession(input: {
  state: GatewayConnectionState;
  sessionId: string;
  deps: GatewayControlSocketDeps;
  replayMode: GatewayControlReplayMode;
  send: GatewayControlSocketSend;
}): Promise<void> {
  if (input.state.unsubscribe) {
    input.state.unsubscribe();
    input.state.unsubscribe = null;
  }

  input.deps.ensureSession(input.sessionId);
  input.state.sessionId = input.sessionId;
  await input.deps.captureBaseline(input.sessionId);

  const chatId = input.deps.getChatId(input.sessionId);
  const runtime = await input.deps.buildRuntime({
    sessionId: input.sessionId,
    chatId,
    userId: input.deps.getUserId(),
  });

  input.send(buildGatewayControlReadyEvent({
    sessionId: input.sessionId,
    chatId,
    controlPlane: runtime.controlPlane,
  }));

  input.send({
    type: 'runtime',
    sessionId: input.sessionId,
    payload: runtime,
  });

  const hydrateEvent = await buildGatewayControlHydrateEvent({
    sessionId: input.sessionId,
    replayMode: input.replayMode,
    deps: input.deps,
  });
  if (hydrateEvent) {
    input.send(hydrateEvent);
  }

  const resourceEvent = await buildGatewayControlResourceEvent({
    sessionId: input.sessionId,
    deps: input.deps,
  });
  if (resourceEvent) {
    input.send(resourceEvent);
  }

  input.state.unsubscribe = input.deps.subscribeRealtime(input.sessionId, (event) => {
    input.send({
      type: 'event',
      sessionId: input.state.sessionId,
      channel: 'realtime',
      event: {
        ...event,
        kind: mapGatewayControlRealtimeEventKind(event),
      },
    });
  });
}
