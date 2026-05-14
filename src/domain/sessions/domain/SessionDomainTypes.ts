export type SessionPlaneStatusInput = {
  userId: string;
  platform?: string | null;
  chatId?: string | null;
  sessionId?: string | null;
  sourceUserId?: string | null;
  limit?: number;
};

export type SessionPlanePort = {
  buildStatusSummaryFast(input: SessionPlaneStatusInput): {
    generatedAt: string;
    summary: {
      sessions: number;
      historyItems: number;
      sendReady: boolean;
      spawnReady: boolean;
    };
    narrative: {
      headline: string;
      operatorSummary: string;
    };
  };
  buildSnapshot?: (input: SessionPlaneStatusInput) => Promise<unknown>;
  sendToSession?: (input: unknown) => Promise<unknown>;
  spawnSession?: (input: unknown) => Promise<unknown>;
};

export type SessionsDomainReadModel = {
  generatedAt: string;
  sessions: number;
  historyItems: number;
  sendReady: boolean;
  spawnReady: boolean;
  headline: string;
  operatorSummary: string;
  source: 'session-plane' | 'empty';
};
