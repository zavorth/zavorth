export interface CompatLayer {
  readonly providerId: string;
  transformRequest(request: Record<string, unknown>, model: string): Record<string, unknown>;
  transformResponse(response: Record<string, unknown>): {
    content: string | null;
    toolCalls: Array<{ id: string; name: string; arguments: Record<string, unknown> }>;
    finishReason: string;
    thinking?: string;
  };
  buildThinkingPayload(level: { level: string; budgetTokens?: number; enabled?: boolean }): Record<string, unknown>;
  buildReasoningPayload(effort: string): Record<string, unknown>;
}
