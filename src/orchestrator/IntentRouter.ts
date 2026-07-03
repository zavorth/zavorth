import type { ParsedCommand } from '../gateways/channels/telegram/CommandParser.js';
import { IntentRouterV2 } from './IntentRouterV2.js';

/**
 * RouteIntent — legacy interface preserved for backward compatibility.
 *
 * All consumers that import RouteIntent continue to work unchanged.
 * Internally this now delegates to IntentRouterV2.
 */
export interface RouteIntent {
  intent: string;
  target: string | null;
  workspace_hint: string | null;
  requires_planning: boolean;
  executor_preference: string | null;
  dispatch_mode?: 'conversation' | 'execution' | 'planning';
  routing_reason?: string;
  routing_confidence?: number;
}

/**
 * IntentRouter — thin adapter over IntentRouterV2.
 *
 * Preserves the V1 `route(parsed): RouteIntent` signature while using
 * the V2 capability OS service internally.
 */
export class IntentRouter {
  private readonly v2: IntentRouterV2;

  constructor() {
    this.v2 = new IntentRouterV2();
  }

  public route(parsed: ParsedCommand): RouteIntent {
    const decision = this.v2.route(parsed);

    return {
      intent: decision.decision.intent,
      target: decision.selected?.id ?? null,
      workspace_hint: null,
      requires_planning: decision.decision.dispatchMode === 'planning',
      executor_preference: decision.decision.executorPreference,
      dispatch_mode: decision.decision.dispatchMode as RouteIntent['dispatch_mode'],
      routing_reason: decision.decision.reason,
      routing_confidence: decision.decision.confidence,
    };
  }
}
