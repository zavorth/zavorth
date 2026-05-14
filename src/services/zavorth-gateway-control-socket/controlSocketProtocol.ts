import type { GatewayControlEventKind } from '../../contracts/GatewayContract.js';
import {
  GATEWAY_CONTRACT_VERSION,
  GATEWAY_WS_PROTOCOL_VERSION,
} from '../../contracts/GatewayContract.js';
import type { ZavorthGatewayRuntimeSnapshot } from '../ZavorthGatewayRuntimeService.js';
import type { WebRealtimeEvent } from '../WebRealtimeService.js';
import type {
  GatewayControlReplayMode,
  GatewayControlSocketEvent,
  GatewayControlSocketReady,
} from './controlSocketTypes.js';

export const GATEWAY_CONTROL_SOCKET_METHODS = [
  'hello',
  'ping',
  'subscribe',
  'session.create',
  'session.list',
  'session.patch',
  'session.state',
  'chat.history',
  'chat.send',
  'chat.abort',
  'approval.list',
  'approval.resolve',
  'artifact.list',
  'artifact.diff',
  'memory.recall.preview',
  'memory.sources.list',
  'runtime.mode.get',
  'runtime.mode.set',
  'runtime.modeEscalation.get',
  'runtime.modeEscalation.resolve',
  'capability.list',
  'capability.enable',
  'capability.disable',
  'selfmod.preview',
  'selfmod.apply',
  'selfmod.rollback',
  'gateway.runtime',
] as const;

export const GATEWAY_CONTROL_SOCKET_REPLAY_MODES: GatewayControlReplayMode[] = [
  'none',
  'state',
  'full',
];

export function normalizeGatewayControlReplayMode(value: unknown): GatewayControlReplayMode {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'none' || normalized === 'state' || normalized === 'full') {
    return normalized;
  }
  return 'state';
}

export function buildGatewayControlReadyEvent(input: {
  sessionId: string;
  chatId: string;
  controlPlane: ZavorthGatewayRuntimeSnapshot['controlPlane'];
}): GatewayControlSocketReady {
  return {
    type: 'ready',
    protocolVersion: GATEWAY_WS_PROTOCOL_VERSION,
    contractVersion: GATEWAY_CONTRACT_VERSION,
    sessionId: input.sessionId,
    chatId: input.chatId,
    methods: [...GATEWAY_CONTROL_SOCKET_METHODS],
    replayModes: [...GATEWAY_CONTROL_SOCKET_REPLAY_MODES],
    controlPlane: input.controlPlane,
  };
}

export function buildGatewayControlHeartbeatEvent(sessionId: string): GatewayControlSocketEvent {
  return {
    type: 'heartbeat',
    sessionId,
    createdAt: new Date().toISOString(),
  };
}

export function mapGatewayControlRealtimeEventKind(event: WebRealtimeEvent): GatewayControlEventKind {
  switch (event.type) {
    case 'snapshot':
      return 'session';
    case 'message':
      return 'chat';
    case 'task':
    case 'workflow':
      return 'agent';
    case 'tool':
      return 'tool';
    case 'permission':
      return 'approval';
    case 'ping':
    default:
      return 'tick';
  }
}
