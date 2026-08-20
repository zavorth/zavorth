export type CompanionConnectionStatus =
  | 'connecting'
  | 'connected'
  | 'authenticated'
  | 'disconnected';

export type CompanionClientMessageType =
  | 'auth'
  | 'permission_response'
  | 'steering_prompt'
  | 'ping';

export interface CompanionAuthMessage {
  readonly type: 'auth';
  readonly pairingToken: string;
  readonly deviceName: string;
}

export interface CompanionPermissionResponseMessage {
  readonly type: 'permission_response';
  readonly requestId: string;
  readonly decision: 'allow' | 'deny' | 'always_allow';
}

export interface CompanionSteeringPromptMessage {
  readonly type: 'steering_prompt';
  readonly text: string;
  readonly priority?: 'normal' | 'interrupt';
}

export interface CompanionPingMessage {
  readonly type: 'ping';
}

export type CompanionClientMessage =
  | CompanionAuthMessage
  | CompanionPermissionResponseMessage
  | CompanionSteeringPromptMessage
  | CompanionPingMessage;

export type CompanionServerEventType =
  | 'auth_success'
  | 'auth_failed'
  | 'agent_stream_chunk'
  | 'permission_request'
  | 'status_update'
  | 'pong';

export interface CompanionAuthSuccessEvent {
  readonly type: 'auth_success';
  readonly sessionId: string;
  readonly agentName: string;
  readonly connectedClientsCount: number;
}

export interface CompanionAuthFailedEvent {
  readonly type: 'auth_failed';
  readonly reason: string;
}

export interface CompanionAgentStreamChunkEvent {
  readonly type: 'agent_stream_chunk';
  readonly text: string;
  readonly phase: 'thinking' | 'reply' | 'tool_call';
  readonly timestamp: number;
}

export interface CompanionPermissionRequestEvent {
  readonly type: 'permission_request';
  readonly requestId: string;
  readonly toolName: string;
  readonly params: Record<string, unknown>;
  readonly riskLevel: 'safe' | 'review' | 'critical';
  readonly expiresAt: number;
}

export interface CompanionStatusUpdateEvent {
  readonly type: 'status_update';
  readonly status: 'idle' | 'running' | 'waiting_approval' | 'paused';
  readonly activeModel?: string;
  readonly currentTurn?: number;
}

export interface CompanionPongEvent {
  readonly type: 'pong';
  readonly timestamp: number;
}

export type CompanionServerEvent =
  | CompanionAuthSuccessEvent
  | CompanionAuthFailedEvent
  | CompanionAgentStreamChunkEvent
  | CompanionPermissionRequestEvent
  | CompanionStatusUpdateEvent
  | CompanionPongEvent;
