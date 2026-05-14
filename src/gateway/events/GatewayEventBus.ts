import { PublicSseEvent } from '../../contracts/public/events/sse';
import { PublicWsMessage } from '../../contracts/public/ws/ws';

export type InternalGatewayEvent = 
  | { type: 'gateway_starting' }
  | { type: 'gateway_ready'; uptime: number }
  | { type: 'channel_registered'; channelId: string }
  | { type: 'session_routed'; sessionId: string; channelId: string }
  | { type: 'client_connected'; connectionId: string; transport: 'sse' | 'ws' };

export type GatewayEvent = InternalGatewayEvent | { type: 'public_sse'; payload: PublicSseEvent } | { type: 'public_ws'; payload: PublicWsMessage };

type EventHandler = (event: GatewayEvent) => void | Promise<void>;

export class GatewayEventBus {
  private handlers: Map<string, Set<EventHandler>> = new Map();

  subscribe(eventType: string, handler: EventHandler): void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
    }
    this.handlers.get(eventType)!.add(handler);
  }

  unsubscribe(eventType: string, handler: EventHandler): void {
    const handlers = this.handlers.get(eventType);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  async emit(event: GatewayEvent): Promise<void> {
    const eventType = event.type;
    const handlers = this.handlers.get(eventType);
    
    if (handlers) {
      const promises = Array.from(handlers).map(handler => handler(event));
      await Promise.allSettled(promises);
    }
  }
}
