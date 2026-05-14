import { CapabilityDefinition } from '../contracts/CapabilityContract.js';
import { ParsedCommand } from '../telegram/CommandParser.js';
import { getDefaultCapabilityRegistry } from '../capabilities/CapabilityRegistry.js';

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

export class IntentRouter {
  private readonly capabilityRegistry = getDefaultCapabilityRegistry();

  public route(parsed: ParsedCommand): RouteIntent {
    const explicitCapability = this.capabilityRegistry.findByCommand(parsed.command_type);
    if (explicitCapability) {
      return this.toRouteIntent(explicitCapability);
    }

    let intent = 'unknown';
    let requires_planning = false;
    let target: string | null = null;
    let workspace_hint: string | null = null;
    let executor_preference = parsed.explicit_executor;
    let dispatch_mode: RouteIntent['dispatch_mode'] = 'conversation';
    let routing_reason = 'Rota padrao sem especializacao automatica.';
    let routing_confidence = 0.2;

    switch (parsed.command_type) {
      case '/plan':
        intent = 'plan_execution';
        requires_planning = true;
        executor_preference = 'planner';
        dispatch_mode = 'planning';
        routing_reason = 'Comando explicito de planejamento.';
        routing_confidence = 1;
        break;
      case '/run':
      case '/dryrun':
        intent = 'shell_execution';
        dispatch_mode = 'execution';
        executor_preference = 'local_executor';
        routing_reason = 'Comando explicito de shell local.';
        routing_confidence = 1;
        break;
      case '/task':
      case '/auto': {
        const autoRoute = this.inferImplicitRoute(parsed);
        intent = autoRoute.intent;
        requires_planning = autoRoute.requires_planning;
        executor_preference = autoRoute.executor_preference;
        workspace_hint = autoRoute.workspace_hint;
        dispatch_mode = autoRoute.dispatch_mode || 'conversation';
        routing_reason = autoRoute.routing_reason || routing_reason;
        routing_confidence = autoRoute.routing_confidence ?? routing_confidence;
        target = autoRoute.target;
        break;
      }
      default:
        intent = 'query';
    }

    if (!workspace_hint && parsed.normalized_message.includes('workspace')) {
      workspace_hint = 'current_workspace';
    }

    return {
      intent,
      target,
      workspace_hint,
      requires_planning,
      executor_preference,
      dispatch_mode,
      routing_reason,
      routing_confidence,
    };
  }

  private inferImplicitRoute(parsed: ParsedCommand): RouteIntent {
    const payload = String(parsed.command_args || parsed.normalized_message || '').trim();
    const text = this.normalize(payload);
    const capability = this.capabilityRegistry.matchImplicit(parsed.command_type, text);

    if (capability) {
      return this.toRouteIntent(capability);
    }

    return {
      intent: 'hybrid_task',
      target: null,
      workspace_hint: null,
      requires_planning: false,
      executor_preference: null,
      dispatch_mode: 'conversation',
      routing_reason: 'Pedido segue no fluxo conversacional por nao ter um executor implicito claro.',
      routing_confidence: 0.35,
    };
  }

  private toRouteIntent(capability: CapabilityDefinition): RouteIntent {
    return {
      intent: capability.intent,
      target: capability.id,
      workspace_hint: capability.workspace_hint ?? null,
      requires_planning: Boolean(capability.requires_planning),
      executor_preference: capability.executor_preference,
      dispatch_mode: capability.dispatch_mode,
      routing_reason: capability.routing_reason || capability.description,
      routing_confidence: capability.routing_confidence ?? Math.min(1, Number(capability.priority || 0) / 100),
    };
  }

  private normalize(value: string): string {
    return String(value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }
}
