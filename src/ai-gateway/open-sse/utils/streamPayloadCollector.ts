export function compactStructuredStreamPayload(payload: unknown): unknown {
  if (payload === null || payload === undefined) return payload;
  if (typeof payload === "string") {
    return payload.length > 2_000 ? `${payload.slice(0, 500)}...[truncated ${payload.length - 1_000} chars]...${payload.slice(-500)}` : payload;
  }
  if (Array.isArray(payload)) {
    return payload.length > 20 ? [...payload.slice(0, 5), `...[${payload.length - 10} items omitted]`, ...payload.slice(-5)] : payload.map(compactStructuredStreamPayload);
  }
  if (typeof payload === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(payload as Record<string, unknown>)) {
      result[key] = compactStructuredStreamPayload(value);
    }
    return result;
  }
  return payload;
}
