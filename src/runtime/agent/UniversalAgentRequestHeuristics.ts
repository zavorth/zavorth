/**
 * Structured tool hints only (capability ids / fallback tool from the caller).
 * Free-text is never scanned for keywords — the LLM chooses tools.
 */

export type UniversalAgentToolInferenceInput = {
  text: string;
  capabilityIds?: string[] | null;
  fallbackTool?: string | null;
};

export function inferUniversalAgentRequestedTools(input: UniversalAgentToolInferenceInput): string[] {
  const tools = new Set<string>();

  for (const capabilityId of input.capabilityIds || []) {
    const id = String(capabilityId || '').trim();
    if (id) tools.add(id);
  }

  const fallback = String(input.fallbackTool || '').trim();
  if (fallback) tools.add(fallback);

  return Array.from(tools);
}
