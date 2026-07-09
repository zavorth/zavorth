import type { ToolCall } from '../../providers/ILlmProvider.js';
import {
  createActionIntent,
  type ActionIntent,
  type ActionIntentSourceTrust,
} from '../../runtime/effects/ActionIntent.js';
import { createResourceRef, type ResourceRef } from '../../runtime/effects/EffectScope.js';

import type { ToolEffectDescriptor } from './ToolEffectDescriptor.js';
import { ToolEffectRegistry } from './ToolEffectRegistry.js';

export type ToolCallToActionIntentInput = {
  toolCall: ToolCall | {
    id?: string;
    name: string;
    arguments?: Record<string, unknown>;
  };
  sourceTrust?: ActionIntentSourceTrust;
  registry?: ToolEffectRegistry;
  createdAt?: string;
  batchKey?: string;
  metadata?: Record<string, unknown>;
};

export function toolCallToActionIntent(input: ToolCallToActionIntentInput): ActionIntent {
  const registry = input.registry || new ToolEffectRegistry();
  const descriptor = registry.resolve(input.toolCall.name);
  const args = normalizeArgs(input.toolCall.arguments);
  const targetScope = inferTargetScope(descriptor, args);
  return createActionIntent({
    id: input.toolCall.id || buildToolCallIntentId(input.toolCall.name, args),
    kind: descriptor.intentKind,
    toolName: descriptor.toolName,
    operation: descriptor.operation,
    args,
    summary: `Tool ${descriptor.toolName}: ${descriptor.description}`,
    sourceTrust: input.sourceTrust || inferSourceTrust(args),
    targetScope,
    ...(input.batchKey ? { batchKey: input.batchKey } : {}),
    ...(input.createdAt ? { createdAt: input.createdAt } : {}),
    metadata: {
      ...(input.metadata || {}),
      toolEffectLevel: descriptor.level,
      requiresEffectBoundary: descriptor.requiresEffectBoundary,
      safeObservation: descriptor.safeObservation,
    },
  });
}

export function inferTargetScope(
  descriptor: ToolEffectDescriptor,
  args: Record<string, unknown>,
): ResourceRef[] {
  const hints = descriptor.argumentResourceHints || [];
  const resources: ResourceRef[] = [];
  for (const hint of hints) {
    const value = args[hint];
    if (typeof value === 'string' && value.trim()) {
      resources.push(createResourceRef({
        kind: descriptor.defaultResourceKind,
        uri: normalizeResourceUriForDescriptor(descriptor, hint, value),
        ...(descriptor.defaultSensitivity ? { sensitivity: descriptor.defaultSensitivity } : {}),
      }));
    }
  }
  if (resources.length > 0) {
    return resources;
  }
  return [createResourceRef({
    kind: descriptor.defaultResourceKind,
    uri: descriptor.defaultResourceKind === 'time' ? `timezone:${String(args.timezone || 'local')}` : `${descriptor.toolName}:default-scope`,
    ...(descriptor.defaultSensitivity ? { sensitivity: descriptor.defaultSensitivity } : {}),
  })];
}

function normalizeArgs(args: unknown): Record<string, unknown> {
  return args && typeof args === 'object' && !Array.isArray(args)
    ? args as Record<string, unknown>
    : {};
}

function inferSourceTrust(args: Record<string, unknown>): ActionIntentSourceTrust {
  const metadata = args.metadata && typeof args.metadata === 'object' && !Array.isArray(args.metadata)
    ? args.metadata as Record<string, unknown>
    : {};
  const sourceTrust = String(metadata.sourceTrust || metadata.inputTrust || '').trim();
  if (
    sourceTrust === 'trusted-system'
    || sourceTrust === 'trusted-user'
    || sourceTrust === 'trusted-runtime'
    || sourceTrust === 'tool-output'
    || sourceTrust === 'untrusted-content'
  ) {
    return sourceTrust;
  }
  return 'unknown';
}

function buildToolCallIntentId(toolName: string, args: Record<string, unknown>): string {
  const stable = JSON.stringify(Object.keys(args).sort().map((key) => [key, args[key]]));
  let hash = 0;
  for (let index = 0; index < stable.length; index += 1) {
    hash = ((hash << 5) - hash + stable.charCodeAt(index)) | 0;
  }
  return `tool-intent-${toolName.replace(/[^a-z0-9_.-]+/gi, '-').toLowerCase()}-${Math.abs(hash)}`;
}

function normalizeResourceUriForDescriptor(
  descriptor: ToolEffectDescriptor,
  hint: string,
  value: string,
): string {
  const raw = value.trim();
  if (descriptor.defaultResourceKind === 'time') {
    return `timezone:${raw}`;
  }
  if (descriptor.defaultResourceKind === 'network' && hint === 'query') {
    return `query:${raw}`;
  }
  if (descriptor.defaultResourceKind === 'process') {
    return `command:${raw}`;
  }
  if (descriptor.defaultResourceKind === 'secret') {
    return raw.startsWith('env:') ? raw : `secret:${raw}`;
  }
  return raw;
}
