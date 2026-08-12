export interface HandoffContext {
  fromAccount: string;
  toAccount: string;
  sessionId: string;
  messages?: unknown[];
  systemPrompt?: string;
}

export function injectHandoffIntoBody(
  body: Record<string, unknown>,
  handoff: HandoffContext
): Record<string, unknown> {
  const messages = Array.isArray(body.messages) ? [...body.messages as unknown[]] : [];
  const handoffMessage = {
    role: "system",
    content: `Context handoff from ${handoff.fromAccount} to ${handoff.toAccount} for session ${handoff.sessionId}.`,
  };
  if (handoff.messages && handoff.messages.length > 0) {
    messages.push(...handoff.messages);
  }
  messages.unshift(handoffMessage);
  return { ...body, messages };
}
