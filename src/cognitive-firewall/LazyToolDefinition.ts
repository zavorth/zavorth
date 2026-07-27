/**
 * LazyToolDefinition — compact tool definitions with on-demand parameter resolution.
 *
 * Instead of sending full JSON Schema parameters with every tool definition
 * (~150 tokens each), this module produces compact definitions (~30 tokens)
 * that contain only the name and a one-line description.
 *
 * Full parameters are resolved only when the LLM actually calls the tool.
 */

import type { ToolDefinition, CompactToolDefinition } from '../providers/ILlmProvider.js';

const MAX_SHORT_DESCRIPTION_LENGTH = 80;

/**
 * Converts a full ToolDefinition into a CompactToolDefinition.
 * Extracts the first sentence of the description, capped at 80 characters.
 */
export function toCompact(tool: ToolDefinition): CompactToolDefinition {
  return {
    name: tool.name,
    description: extractShortDescription(tool.description),
    compact: true,
    category: tool.category,
    metadata: tool.metadata,
  };
}

/**
 * Converts an array of full ToolDefinitions into CompactToolDefinitions.
 */
export function toCompactBatch(tools: ToolDefinition[]): CompactToolDefinition[] {
  return tools.map(toCompact);
}

/**
 * Type guard to check if a definition is compact.
 */
export function isCompact(def: ToolDefinition | CompactToolDefinition): def is CompactToolDefinition {
  return 'compact' in def && def.compact === true;
}

/**
 * Resolves a CompactToolDefinition back to a full ToolDefinition
 * using the provided registry. Returns null if the tool is not found.
 */
export function resolveFull(
  compact: CompactToolDefinition,
  fullRegistry: Map<string, ToolDefinition>,
): ToolDefinition | null {
  return fullRegistry.get(compact.name) ?? null;
}

/**
 * Resolves an array of CompactToolDefinitions to full ToolDefinitions.
 * Filters out any tools not found in the registry.
 */
export function resolveFullBatch(
  compacts: CompactToolDefinition[],
  fullRegistry: Map<string, ToolDefinition>,
): ToolDefinition[] {
  const resolved: ToolDefinition[] = [];
  for (const compact of compacts) {
    const full = resolveFull(compact, fullRegistry);
    if (full) {
      resolved.push(full);
    }
  }
  return resolved;
}

/**
 * Builds a lookup map from tool name to full ToolDefinition.
 */
export function buildToolRegistry(tools: ToolDefinition[]): Map<string, ToolDefinition> {
  const registry = new Map<string, ToolDefinition>();
  for (const tool of tools) {
    registry.set(tool.name, tool);
  }
  return registry;
}

/**
 * Extracts a short description from a full description string.
 * Takes the first sentence and caps at MAX_SHORT_DESCRIPTION_LENGTH.
 */
function extractShortDescription(fullDescription: string): string {
  const trimmed = fullDescription.trim();
  if (!trimmed) return '';

  // Try to extract first sentence (ends with . ! ...)
  const sentenceMatch = trimmed.match(/^[^.!...]*[.!...]/);
  let short = sentenceMatch ? sentenceMatch[0].trim() : trimmed;

  // Cap at max length
  if (short.length > MAX_SHORT_DESCRIPTION_LENGTH) {
    short = short.slice(0, MAX_SHORT_DESCRIPTION_LENGTH - 3).trimEnd() + '...';
  }

  return short;
}

/**
 * Calculates token savings from using compact mode.
 */
export function calculateSavings(tools: ToolDefinition[]): {
  fullTokens: number;
  compactTokens: number;
  savedTokens: number;
  savingsPercent: number;
} {
  // Rough estimate: 1 token per 4 characters
  const fullTokens = tools.reduce((sum, t) => {
    const fullJson = JSON.stringify({
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    });
    return sum + Math.ceil(fullJson.length / 4);
  }, 0);

  const compactTokens = tools.reduce((sum, t) => {
    const short = extractShortDescription(t.description);
    return sum + Math.ceil((t.name.length + short.length + 10) / 4); // +10 for JSON overhead
  }, 0);

  const savedTokens = fullTokens - compactTokens;

  return {
    fullTokens,
    compactTokens,
    savedTokens,
    savingsPercent: fullTokens > 0 ? Math.round((savedTokens / fullTokens) * 100) : 0,
  };
}
