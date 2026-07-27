import { GatewayEventBus } from '../events/GatewayEventBus';

export interface GatewayClientSession {
  id: string; // The active session ID (chat)
  connectionId: string; // Connection socket or client ID
  channelId: string; // e.g., 'web', 'telegram', 'cli'
  tenantId?: string;
}

export class GatewaySessionRouter {
  private activeSessions: Map<string, GatewayClientSession> = new Map();

  constructor(private eventBus: GatewayEventBus) {}

  async registerSession(session: GatewayClientSession): Promise<void> {
    this.activeSessions.set(session.connectionId, session);
    await this.eventBus.emit({
      type: 'session_routed',
      sessionId: session.id,
      channelId: session.channelId
    });
  }

  getSessionByConnectionId(connectionId: string): GatewayClientSession | undefined {
    return this.activeSessions.get(connectionId);
  }

  removeSession(connectionId: string): void {
    this.activeSessions.delete(connectionId);
  }

  getSessionsByChannel(channelId: string): GatewayClientSession[] {
    return Array.from(this.activeSessions.values()).filter(s => s.channelId === channelId);
  }

  listSessions(): GatewayClientSession[] {
    return Array.from(this.activeSessions.values());
  }
}
