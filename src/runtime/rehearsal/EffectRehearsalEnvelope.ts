import type { ToolEffectMapping } from '../../tools/governance/ToolEffectMapper.js';
import { RehearsalRunner } from './RehearsalRunner.js';
import type { RehearsalResult } from './RehearsalResult.js';

export type EffectRehearsalEnvelope = {
  kind: 'effect-rehearsal-envelope';
  version: 1;
  id: string;
  toolCallId: string;
  toolName: string;
  rehearsal: RehearsalResult;
};

export function buildEffectRehearsalEnvelope(input: {
  id: string;
  mapping: ToolEffectMapping;
  runner?: RehearsalRunner;
}): EffectRehearsalEnvelope {
  const runner = input.runner || new RehearsalRunner();
  return {
    kind: 'effect-rehearsal-envelope',
    version: 1,
    id: input.id,
    toolCallId: input.mapping.toolCallId,
    toolName: input.mapping.toolName,
    rehearsal: runner.prepare({
      id: `${input.id}:rehearsal`,
      effect: input.mapping.analysis.effect,
      decision: input.mapping.decision,
    }),
  };
}
