export const STRUCTURED_AGENT_RUN_ACTION_TYPE = 'structured_agent_run' as const;

export type StructuredAgentRunActionType = typeof STRUCTURED_AGENT_RUN_ACTION_TYPE;

export type StructuredAgentRunAction = {
  type: StructuredAgentRunActionType;
  payload: string;
  metadata?: Record<string, unknown>;
};

export type AgentRunAction = StructuredAgentRunAction;

export function createStructuredAgentRunAction(input: {
  payload: string;
  metadata?: Record<string, unknown>;
}): StructuredAgentRunAction {
  return {
    type: STRUCTURED_AGENT_RUN_ACTION_TYPE,
    payload: input.payload,
    metadata: input.metadata,
  };
}

export function isStructuredAgentRunAction(value: unknown): value is StructuredAgentRunAction {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as { type?: unknown; payload?: unknown };
  return candidate.type === STRUCTURED_AGENT_RUN_ACTION_TYPE
    && typeof candidate.payload === 'string'
    && candidate.payload.trim().length > 0;
}
