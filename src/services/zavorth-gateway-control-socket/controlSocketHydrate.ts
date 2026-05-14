import type {
  GatewayControlReplayMode,
  GatewayControlSocketDeps,
  GatewayControlSocketEvent,
} from './controlSocketTypes.js';

export async function buildGatewayControlHydrateEvent(input: {
  sessionId: string;
  replayMode: GatewayControlReplayMode;
  deps: GatewayControlSocketDeps;
}): Promise<GatewayControlSocketEvent | null> {
  if (input.replayMode === 'none') {
    return null;
  }

  const state = await input.deps.buildCanonicalState(input.sessionId);
  const history = input.replayMode === 'full'
    ? await input.deps.buildCanonicalHistory(input.sessionId)
    : null;
  return {
    type: 'hydrate',
    sessionId: input.sessionId,
    replayMode: input.replayMode,
    state,
    history,
  };
}

export async function buildGatewayControlResourceEvent(input: {
  sessionId: string;
  deps: GatewayControlSocketDeps;
}): Promise<GatewayControlSocketEvent | null> {
  if (!input.deps.readDesktopResources) {
    return null;
  }

  const resourceSnapshot = await input.deps.readDesktopResources({
    sessionId: input.sessionId,
    preferCachedWithinMs: 15_000,
  }).catch(() => null);
  if (!resourceSnapshot) {
    return null;
  }

  return {
    type: 'event',
    sessionId: input.sessionId,
    channel: 'realtime',
    event: {
      id: `resource-${Date.now()}`,
      type: 'resource',
      createdAt: resourceSnapshot.generatedAt,
      kind: 'health.resource',
      payload: resourceSnapshot,
    },
  };
}
