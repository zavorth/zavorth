import type { ParsedCommand } from '../telegram/CommandParser.js';
import {
  ZavorthCapabilityOsService,
  type ZavorthCapabilityOsRouteDecision,
} from '../services/ZavorthCapabilityOsService.js';

type IntentRouterV2Runtime = {
  capabilityOsService?: Pick<ZavorthCapabilityOsService, 'explainRoute'>;
};

type IntentRouterV2Options = {
  commandType?: string | null;
  requestedBy?: string | null;
  sourceSurface?: string | null;
  writeLedger?: boolean;
};

export class IntentRouterV2 {
  private readonly capabilityOsService: Pick<ZavorthCapabilityOsService, 'explainRoute'>;

  constructor(runtime: IntentRouterV2Runtime = {}) {
    this.capabilityOsService = runtime.capabilityOsService || new ZavorthCapabilityOsService();
  }

  public route(
    input: string | Pick<ParsedCommand, 'command_type' | 'command_args' | 'normalized_message'>,
    options: IntentRouterV2Options = {},
  ): ZavorthCapabilityOsRouteDecision {
    const normalized = typeof input === 'string'
      ? {
          text: input,
          commandType: options.commandType || '/task',
        }
      : {
          text: String(input.command_args || input.normalized_message || '').trim(),
          commandType: input.command_type || options.commandType || '/task',
        };

    return this.capabilityOsService.explainRoute(normalized.text, {
      commandType: normalized.commandType,
      requestedBy: options.requestedBy || null,
      sourceSurface: options.sourceSurface || 'intent-router-v2',
      writeLedger: options.writeLedger,
    });
  }
}

export type { IntentRouterV2Options };
