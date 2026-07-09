import type { ChatMessage, ToolDefinition } from '../../providers/ILlmProvider.js';

export function normalizeText(value: unknown, fallback = ''): string {
  const text = String(value ?? '').trim();
  return text || fallback;
}

export function recordOrNull(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

export function clampText(value: unknown, maxChars = 4000): string {
  const text = String(value ?? '').trim();
  const limit = Math.max(120, maxChars);
  return text.length <= limit ? text : `${text.slice(0, limit - 20).trim()}\n[truncated]`;
}

export function truthy(value: unknown): boolean {
  if (value === true) return true;
  const text = normalizeText(value).toLowerCase();
  return ['1', 'true', 'yes', 'sim', 'on', 'enabled'].includes(text);
}

export function numberFromUnknown(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const text = normalizeText(value);
  if (!text) return 0;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function matchesAnyAlias(aliases: string[], entries: string[]): boolean {
  const normalizedAliases = new Set(aliases.map((alias) => normalizeToolKey(alias)));
  return entries.some((entry) => normalizedAliases.has(normalizeToolKey(entry)));
}

export function uniqueToolDefinitions(tools: ToolDefinition[]): ToolDefinition[] {
  const seen = new Set<string>();
  const output: ToolDefinition[] = [];
  for (const tool of tools) {
    const key = normalizeToolKey(tool.name);
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(tool);
  }
  return output;
}

export function normalizeToolArguments(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value === 'string') {
    const parsed = parseJsonObject(value);
    if (parsed) return parsed;
    return { value };
  }
  if (value === null || value === undefined) {
    return {};
  }
  return { value };
}

export function normalizeToolKey(value: unknown): string {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

export function similarityScore(left: string, right: string): number {
  if (!left || !right) return 0;
  if (left === right) return 1;
  if (left.includes(right) || right.includes(left)) return 0.78;
  const leftTokens = new Set(toBigrams(left));
  const rightTokens = new Set(toBigrams(right));
  const intersection = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  const union = new Set([...leftTokens, ...rightTokens]).size || 1;
  return intersection / union;
}

export function summarizeToolDefinition(tool: ToolDefinition): Record<string, unknown> {
  return {
    name: tool.name,
    description: clampText(tool.description || tool.name, 500),
    category: tool.category || null,
    dangerLevel: tool.dangerLevel || null,
    requiresPermission: tool.requiresPermission === true,
  };
}

export function estimateMessagesChars(messages: ChatMessage[]): number {
  return messages.reduce((total, message) => total + normalizeText(message.content).length, 0);
}

export function isTransientToolError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '');
  return /\b(timeout|timed out|temporar|rate limit|429|503|502|econnreset|enetunreach|network|busy|try again)\b/i.test(message);
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseJsonObject(value: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null;
  } catch (error: any) { const err = error; const e = error;
    return null;
  }
}

function toBigrams(value: string): string[] {
  if (value.length <= 2) return [value];
  const grams: string[] = [];
  for (let index = 0; index < value.length - 1; index += 1) {
    grams.push(value.slice(index, index + 2));
  }
  return grams;
}
