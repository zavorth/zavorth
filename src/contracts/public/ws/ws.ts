export type WsMessageType = 'ping' | 'pong' | 'subscribe' | 'unsubscribe' | 'event' | 'command';

export interface BaseWsMessage<TType extends WsMessageType, TPayload> {
  id: string; // Message ID for correlation
  type: TType;
  payload: TPayload;
}

export interface WsSubscribePayload {
  channel: 'session' | 'node' | 'transport' | 'gateway';
  resourceId?: string; // e.g., sessionId if channel is 'session'
}
export type WsSubscribeMessage = BaseWsMessage<'subscribe', WsSubscribePayload>;

export interface WsEventPayload {
  topic: string;
  data: Record<string, unknown>;
}
export type WsEventMessage = BaseWsMessage<'event', WsEventPayload>;

export interface WsCommandPayload {
  command: string;
  arguments?: Record<string, unknown>;
}
export type WsCommandMessage = BaseWsMessage<'command', WsCommandPayload>;

// The master union type for WebSocket frames
export type PublicWsMessage =
  | WsSubscribeMessage
  | WsEventMessage
  | WsCommandMessage
  | BaseWsMessage<'ping', { timestamp: number }>
  | BaseWsMessage<'pong', { timestamp: number }>;
