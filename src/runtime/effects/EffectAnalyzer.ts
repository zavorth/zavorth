import type { ActionIntent } from './ActionIntent.js';
import { actionIntentToDraftEffect, mergeEffects } from './EffectAlgebra.js';
import type { Effect } from './Effect.js';
import { hasRealSideEffect, isReadOnlyEffect } from './Effect.js';
import { inferEffectRisk, type EffectRiskLevel } from './EffectRisk.js';

export type EffectAnalysis = {
  intentId: string;
  effect: Effect;
  risk: EffectRiskLevel;
  readOnly: boolean;
  hasRealSideEffect: boolean;
  summary: string;
};

export type EffectBatchAnalysis = {
  batchId: string;
  effects: EffectAnalysis[];
  mergedEffect: Effect;
  risk: EffectRiskLevel;
  hasRealSideEffect: boolean;
};

export function analyzeActionIntent(intent: ActionIntent): EffectAnalysis {
  const effect = actionIntentToDraftEffect(intent);
  const risk = inferEffectRisk(effect);
  const sideEffect = hasRealSideEffect(effect);
  return {
    intentId: intent.id,
    effect,
    risk,
    readOnly: isReadOnlyEffect(effect),
    hasRealSideEffect: sideEffect,
    summary: summarizeEffect(effect, risk),
  };
}

export function analyzeActionIntentBatch(
  batchId: string,
  intents: ActionIntent[],
): EffectBatchAnalysis {
  const effects = intents.map(analyzeActionIntent);
  const mergedEffect = mergeEffects(batchId, effects.map((entry) => entry.effect));
  return {
    batchId,
    effects,
    mergedEffect,
    risk: inferEffectRisk(mergedEffect),
    hasRealSideEffect: hasRealSideEffect(mergedEffect),
  };
}

export function summarizeEffect(effect: Effect, risk: EffectRiskLevel = inferEffectRisk(effect)): string {
  const parts = [
    countPart(effect.reads.length, 'read'),
    countPart(effect.writes.length, 'write'),
    countPart(effect.deletes.length, 'delete'),
    countPart(effect.networkEgress.length, 'network egress'),
    countPart(effect.secretAccess.length, 'secret access'),
    countPart(effect.processSpawn.length, 'process spawn'),
    countPart(effect.persistence.length, 'persistence'),
    countPart(effect.humanVisibleSend.length, 'human-visible send'),
  ].filter(Boolean);
  return `${parts.length ? parts.join(', ') : 'no declared resource touch'}; risk=${risk}; reversibility=${effect.reversibility}`;
}

function countPart(count: number, label: string): string {
  return count > 0 ? `${count} ${label}` : '';
}
