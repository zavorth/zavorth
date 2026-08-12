export type ZavorthMobileTransport = {
  id: string;
  send: (payload: unknown) => void;
};

export type ZavorthMobileInboundMessage = {
  rawText: string;
  platform: string;
  userId: string;
};

export type ZavorthMobileSessionRecord = {
  sessionId: string;
  modelId: string;
  status: 'idle' | 'busy';
  messageCount: number;
};

export type ZavorthMobileDashboardState = {
  sessions: ZavorthMobileSessionRecord[];
  totalInboundMessages: number;
};

type ZavorthMobileSessionEntry = {
  sessionId: string;
  modelId: string;
  status: 'idle' | 'busy';
  messageCount: number;
  log: string[];
};

export class ZavorthMobileControlBridge {
  private readonly authorize: (client?: unknown) => boolean;
  private readonly transports = new Map<string, ZavorthMobileTransport>();
  private readonly sessions = new Map<string, ZavorthMobileSessionEntry>();
  private inboundMessageCount = 0;

  constructor(options: { authorize: (client?: unknown) => boolean }) {
    this.authorize = options.authorize;
  }

  public registerTransport(transport: ZavorthMobileTransport): void {
    if (!this.authorize({ clientId: transport.id })) {
      return;
    }
    this.transports.set(transport.id, transport);
  }

  public registerSession(sessionId: string, modelId: string): ZavorthMobileSessionRecord {
    const session: ZavorthMobileSessionEntry = {
      sessionId,
      modelId,
      status: 'idle',
      messageCount: 0,
      log: [],
    };
    this.sessions.set(sessionId, session);
    return {
      sessionId: session.sessionId,
      modelId: session.modelId,
      status: session.status,
      messageCount: session.messageCount,
    };
  }

  public async acceptInbound(transportId: string, sessionId: string, message: ZavorthMobileInboundMessage): Promise<void> {
    const transport = this.transports.get(transportId);
    if (!transport) {
      throw new Error(`Unknown mobile transport '${transportId}'`);
    }
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Unknown mobile session '${sessionId}'`);
    }
    session.messageCount += 1;
    session.log.push(`${sessionId} | ${message.userId} | ${message.platform} | ${message.rawText}`);
    this.inboundMessageCount += 1;
    transport.send({ sessionId, message: message.rawText });
  }

  public getMobileDashboardState(): ZavorthMobileDashboardState {
    return {
      sessions: Array.from(this.sessions.values()).map((session) => ({
        sessionId: session.sessionId,
        modelId: session.modelId,
        status: session.status,
        messageCount: session.messageCount,
      })),
      totalInboundMessages: this.inboundMessageCount,
    };
  }

  public getSessionLogs(sessionId: string): string[] {
    const session = this.sessions.get(sessionId);
    return session ? session.log : [];
  }
}
