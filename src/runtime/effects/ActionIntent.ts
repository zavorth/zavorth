import type { ResourceRef } from './EffectScope.js';

export type ActionIntentKind =
  | 'answer'
  | 'observation'
  | 'draft'
  | 'tool_call'
  | 'workspace_mutation'
  | 'external_egress'
  | 'credential_or_config'
  | 'irreversible_or_destructive';

export type ActionIntentSourceTrust =
  | 'trusted-system'
  | 'trusted-user'
  | 'trusted-runtime'
  | 'tool-output'
  | 'untrusted-content'
  | 'unknown';

export type ActionIntent = {
  id: string;
  kind: ActionIntentKind;
  toolName?: string;
  operation: string;
  args?: Record<string, unknown>;
  summary: string;
  sourceTrust: ActionIntentSourceTrust;
  targetScope: ResourceRef[];
  batchKey?: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
};

export function createActionIntent(input: {
  id: string;
  kind: ActionIntentKind;
  operation: string;
  summary: string;
  sourceTrust?: ActionIntentSourceTrust;
  targetScope?: ResourceRef[];
  toolName?: string;
  args?: Record<string, unknown>;
  batchKey?: string;
  createdAt?: string;
  metadata?: Record<string, unknown>;
}): ActionIntent {
  return {
    id: normalizeIntentId(input.id),
    kind: input.kind,
    operation: String(input.operation || '').trim(),
    summary: String(input.summary || '').trim(),
    sourceTrust: input.sourceTrust || 'unknown',
    targetScope: input.targetScope || [],
    createdAt: input.createdAt || new Date().toISOString(),
    ...(input.toolName ? { toolName: input.toolName } : {}),
    ...(input.args ? { args: input.args } : {}),
    ...(input.batchKey ? { batchKey: input.batchKey } : {}),
    ...(input.metadata ? { metadata: input.metadata } : {}),
  };
}

export function normalizeIntentId(value: string): string {
  return String(value || '').trim();
}

export function isObservationIntent(intent: Pick<ActionIntent, 'kind'>): boolean {
  return intent.kind === 'answer' || intent.kind === 'observation' || intent.kind === 'draft';
}
