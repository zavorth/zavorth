const LIVE_MULTI_STEP_TOKEN = 'ZAVORTH_LIVE_MS_OK';

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Strict multi-step finish: token + marker only (optional surrounding quotes/punctuation).
 * Rejects long prose that merely embeds the token string.
 */
export function multiStepTextPasses(text: string, markerValue: string): boolean {
  const normalized = String(text || '').replace(/\s+/g, ' ').trim();
  if (!normalized) return false;
  const pattern = new RegExp(
    `^["'\`]*${escapeRegExp(LIVE_MULTI_STEP_TOKEN)}\\s+${escapeRegExp(markerValue)}["'\`.,!;:]*$`,
    'i',
  );
  return pattern.test(normalized);
}

export function extractGeminiText(body: string): string {
  try {
    const parsed = JSON.parse(body);
    const parts = parsed?.candidates?.[0]?.content?.parts;
    if (!Array.isArray(parts)) return '';
    return parts.map((part: { text?: string }) => String(part?.text || '')).join('\n');
  } catch {
    return '';
  }
}

export function extractGeminiFunctionCall(body: string): { name: string; args: Record<string, unknown> } | null {
  try {
    const parsed = JSON.parse(body);
    const parts = parsed?.candidates?.[0]?.content?.parts;
    if (!Array.isArray(parts)) return null;
    for (const part of parts) {
      if (part?.functionCall?.name === 'zavorth_live_marker') {
        return {
          name: String(part.functionCall.name),
          args: (part.functionCall.args && typeof part.functionCall.args === 'object')
            ? part.functionCall.args
            : {},
        };
      }
    }
  } catch {
    return null;
  }
  return null;
}

export function extractOpenAiText(body: string): string {
  try {
    const parsed = JSON.parse(body);
    return String(parsed?.choices?.[0]?.message?.content || '');
  } catch {
    return '';
  }
}

export function extractOpenAiToolCall(body: string): { id: string; name: string; raw: unknown } | null {
  try {
    const parsed = JSON.parse(body);
    const toolCalls = parsed?.choices?.[0]?.message?.tool_calls;
    if (!Array.isArray(toolCalls) || toolCalls.length === 0) return null;
    const match = toolCalls.find(
      (entry: { function?: { name?: string } }) => String(entry?.function?.name || '') === 'zavorth_live_marker',
    ) || null;
    if (!match) return null;
    return {
      id: String(match.id || 'tool_call_0'),
      name: String(match.function?.name || ''),
      raw: match,
    };
  } catch {
    return null;
  }
}

export function extractAnthropicText(body: string): string {
  try {
    const parsed = JSON.parse(body);
    const content = parsed?.content;
    if (!Array.isArray(content)) return '';
    return content
      .filter((part: { type?: string }) => part?.type === 'text')
      .map((part: { text?: string }) => String(part?.text || ''))
      .join('\n');
  } catch {
    return '';
  }
}

export function extractAnthropicToolUse(body: string): { id: string; name: string; raw: unknown } | null {
  try {
    const parsed = JSON.parse(body);
    const content = parsed?.content;
    if (!Array.isArray(content)) return null;
    const tool = content.find(
      (part: { type?: string; name?: string }) => part?.type === 'tool_use' && part?.name === 'zavorth_live_marker',
    );
    if (!tool) return null;
    return {
      id: String(tool.id || 'tool_use_0'),
      name: String(tool.name || ''),
      raw: tool,
    };
  } catch {
    return null;
  }
}
