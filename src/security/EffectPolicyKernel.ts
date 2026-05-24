import type { Effect } from '../runtime/effects/Effect.js';
import type { EffectPolicyContext } from './EffectPolicyContext.js';
import { evaluateEffectPolicyRules } from './EffectPolicyRules.js';
import type { SecurityEffectPolicyDecision } from './EffectPolicyDecision.js';

export function decideEffectPolicy(
  effect: Effect,
  context: EffectPolicyContext = {},
): SecurityEffectPolicyDecision {
  return evaluateEffectPolicyRules(effect, context);
}

export class EffectPolicyKernel {
  public decide(
    effect: Effect,
    context: EffectPolicyContext = {},
  ): SecurityEffectPolicyDecision {
    return decideEffectPolicy(effect, context);
  }
}
