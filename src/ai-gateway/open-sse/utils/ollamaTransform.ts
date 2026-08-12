export function transformToOllama(body: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = { ...body };
  if (result.messages && Array.isArray(result.messages)) {
    result.prompt = (result.messages as Record<string, unknown>[])
      .map((msg) => `${msg.role}: ${msg.content}`)
      .join("\n");
    delete result.messages;
  }
  if (result.max_tokens) {
    result.options = { ...(result.options as Record<string, unknown> || {}) };
    (result.options as Record<string, unknown>).num_predict = result.max_tokens;
    delete result.max_tokens;
  }
  if (result.temperature !== undefined) {
    result.options = { ...(result.options as Record<string, unknown> || {}) };
    (result.options as Record<string, unknown>).temperature = result.temperature;
    delete result.temperature;
  }
  return result;
}
