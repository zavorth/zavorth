// Dynamic host bag: dozens of flow modules attach and read prototype members.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AgentRunFlowHost = Record<string, any>;

import type { UniversalAgentRequest } from './UniversalAgentRuntimeTypes.js';

export type SelfModificationActionOperation = 'apply' | 'rollback';
export type SelfModificationActionRequest = {
  operation: SelfModificationActionOperation;
  toolId: 'selfmod.apply' | 'selfmod.rollback';
  targetId: string;
  targetField: 'previewId' | 'changeId';
  targetLabel: 'preview' | 'changeset';
};

export type WatchModeVisualRequest = {
  toolId: 'watchmode.control';
  objective: string;
  targetWindow: string;
  siteUrl: string | null;
  policyAllowlisted: boolean;
  policySource: string;
};

export function normalizeText(value: unknown, fallback = ''): string {
  const text = String(value ?? '').trim();
  return text || fallback;
}

export function normalizeStringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return Array.from(new Set(value.map((item) => normalizeText(item)).filter(Boolean)));
}

export function recordOrNull(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

export function hasRequestedTool(input: Pick<UniversalAgentRequest, 'requestedTools'>, toolId: string): boolean {
  const normalized = normalizeText(toolId).toLowerCase();
  return Array.isArray(input.requestedTools)
    && input.requestedTools.some((tool) => normalizeText(tool).toLowerCase() === normalized);
}
