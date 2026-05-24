import type { ToolCall } from '../../providers/ILlmProvider.js';
import { analyzeActionIntent, type EffectAnalysis } from '../../runtime/effects/EffectAnalyzer.js';
import type { ActionIntent, ActionIntentSourceTrust } from '../../runtime/effects/ActionIntent.js';
import { decideEffectPolicy } from '../../security/EffectPolicyKernel.js';
import type { EffectPolicyContext } from '../../security/EffectPolicyContext.js';
import type { SecurityEffectPolicyDecision } from '../../security/EffectPolicyDecision.js';
import { ToolEffectRegistry } from './ToolEffectRegistry.js';
import { toolCallToActionIntent } from './ToolCallToActionIntent.js';

export type ToolEffectMapping = {
  toolCallId: string;
  toolName: string;
  actionIntent: ActionIntent;
  analysis: EffectAnalysis;
  decision: SecurityEffectPolicyDecision;
};

export function mapToolCallToEffectDecision(input: {
  toolCall: ToolCall;
  registry?: ToolEffectRegistry;
  sourceTrust?: ActionIntentSourceTrust;
  policyContext?: EffectPolicyContext;
}): ToolEffectMapping {
  const intent = toolCallToActionIntent({
    toolCall: input.toolCall,
    registry: input.registry,
    sourceTrust: input.sourceTrust,
  });
  const analysis = analyzeActionIntent(intent);
  return {
    toolCallId: input.toolCall.id,
    toolName: input.toolCall.name,
    actionIntent: intent,
    analysis,
    decision: decideEffectPolicy(analysis.effect, input.policyContext || {}),
  };
}
