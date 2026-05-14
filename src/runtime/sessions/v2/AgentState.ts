export type AgentStatus = 'IDLE' | 'PROCESSING' | 'ERROR';

export interface AgentContext {
  cwd: string;
  env: Record<string, string>;
  activeTool: string | null;
}

export interface AgentState {
  id: string;
  status: AgentStatus;
  startedAt: string;
  lastActiveAt: string;
  context: AgentContext;
  logs: string[];
}

export interface SessionEventMap {
  'state:change': (newState: AgentState) => void;
  'pty:data': (data: string) => void;
  'pty:error': (error: string) => void;
  'pty:input': (data: string) => void;
  'pty:exit': (code: number | null) => void;
}

export type SessionPayload = {
  sessionId: string;
  state: AgentState;
};
