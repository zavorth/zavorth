import type { ActionIntent } from './ActionIntent.js';
import { isObservationIntent } from './ActionIntent.js';
import type { Effect } from './Effect.js';
import { createEmptyEffect } from './Effect.js';
import type { ResourceRef } from './EffectScope.js';

export function actionIntentToDraftEffect(intent: ActionIntent): Effect {
  const effect = createEmptyEffect({
    intentId: intent.id,
    sourceTrust: intent.sourceTrust,
    reversibility: intent.kind === 'draft' ? 'draft_only' : 'none',
  });

  if (isObservationIntent(intent)) {
    return {
      ...effect,
      reads: intent.targetScope,
    };
  }

  switch (intent.kind) {
    case 'tool_call':
      return classifyToolCallIntent(intent, effect);
    case 'workspace_mutation':
      return {
        ...effect,
        reads: intent.targetScope,
        writes: intent.targetScope,
        reversibility: 'rollback_available',
      };
    case 'external_egress':
      return {
        ...effect,
        networkEgress: intent.targetScope,
        humanVisibleSend: intent.targetScope.filter((resource) => resource.kind === 'channel'),
        reversibility: 'irreversible',
      };
    case 'credential_or_config':
      return {
        ...effect,
        secretAccess: intent.targetScope,
        reversibility: 'none',
      };
    case 'irreversible_or_destructive':
      return {
        ...effect,
        deletes: intent.targetScope,
        reversibility: 'irreversible',
      };
    default:
      return effect;
  }
}

export function mergeEffects(intentId: string, effects: Effect[]): Effect {
  const first = effects[0];
  const sourceTrust = first?.sourceTrust || 'unknown';
  return {
    intentId,
    reads: uniqueResources(effects.flatMap((effect) => effect.reads)),
    writes: uniqueResources(effects.flatMap((effect) => effect.writes)),
    deletes: uniqueResources(effects.flatMap((effect) => effect.deletes)),
    networkEgress: uniqueResources(effects.flatMap((effect) => effect.networkEgress)),
    secretAccess: uniqueResources(effects.flatMap((effect) => effect.secretAccess)),
    processSpawn: uniqueResources(effects.flatMap((effect) => effect.processSpawn)),
    persistence: uniqueResources(effects.flatMap((effect) => effect.persistence)),
    humanVisibleSend: uniqueResources(effects.flatMap((effect) => effect.humanVisibleSend)),
    reversibility: mostRestrictiveReversibility(effects.map((effect) => effect.reversibility)),
    sourceTrust,
  };
}

function classifyToolCallIntent(intent: ActionIntent, base: Effect): Effect {
  const toolName = String(intent.toolName || '').toLowerCase();
  if (toolName.includes('read') || toolName.includes('list') || toolName.includes('datetime') || toolName === 'get_datetime') {
    return { ...base, reads: intent.targetScope };
  }
  if (toolName.includes('write') || toolName.includes('edit') || toolName.includes('patch')) {
    return { ...base, reads: intent.targetScope, writes: intent.targetScope, reversibility: 'rollback_available' };
  }
  if (toolName.includes('delete')) {
    return { ...base, deletes: intent.targetScope, reversibility: 'irreversible' };
  }
  if (toolName.includes('shell') || toolName.includes('bash') || toolName.includes('powershell')) {
    return { ...base, processSpawn: intent.targetScope, reversibility: 'rollback_available' };
  }
  if (toolName.includes('send') || toolName.includes('publish')) {
    return { ...base, humanVisibleSend: intent.targetScope, networkEgress: intent.targetScope, reversibility: 'irreversible' };
  }
  return base;
}

function uniqueResources(resources: ResourceRef[]): ResourceRef[] {
  const seen = new Set<string>();
  const output: ResourceRef[] = [];
  for (const resource of resources) {
    const key = `${resource.kind}:${resource.uri.replace(/\\/g, '/')}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    output.push(resource);
  }
  return output;
}

function mostRestrictiveReversibility(values: Effect['reversibility'][]): Effect['reversibility'] {
  if (values.includes('irreversible')) {
    return 'irreversible';
  }
  if (values.includes('rollback_available')) {
    return 'rollback_available';
  }
  if (values.includes('draft_only')) {
    return 'draft_only';
  }
  return 'none';
}
