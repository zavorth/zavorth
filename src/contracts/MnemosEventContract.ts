export const MNEMOS_EVENT_BUS_VERSION = 'mnemos-event-bus-v1';

export type MnemosEventType =
  | 'session.started'
  | 'session.ended'
  | 'user.prompt.submitted'
  | 'tool.previewed'
  | 'tool.used'
  | 'tool.completed'
  | 'approval.requested'
  | 'approval.granted'
  | 'approval.denied'
  | 'artifact.created'
  | 'receipt.emitted'
  | 'decision.confirmed'
  | 'memory.candidate.created'
  | 'message'
  | 'task'
  | 'tool'
  | 'workflow'
  | 'permission'
  | 'snapshot'
  | 'agent-stream';

export type MnemosSessionEvent = {
  id: string;
  timestamp: string;
  sessionId: string;
  type: MnemosEventType;
  payload: Record<string, any>;
  source?: {
    surface: 'dashboard' | 'cli' | 'telegram' | 'api' | 'runtime-adapter' | 'runtime' | 'unknown';
    agent?: string | null;
    provider?: string | null;
    channel?: string | null;
  };
  trust?: {
    level: 'raw' | 'derived' | 'receipt-backed' | 'operator-approved';
    durableTruth: boolean;
    approvalId?: string | null;
    receiptId?: string | null;
  };
};

export type MnemosEventBusManifest = {
  version: string;
  updatedAt: string;
  events: MnemosSessionEvent[];
};
