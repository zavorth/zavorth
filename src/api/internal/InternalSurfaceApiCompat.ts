import type { IMessageContext } from '../../contracts/IMessageBroker.js';
import type { CommandRequest, CommandResult } from '../../contracts/InternalBoundaryContract.js';
import type { SharedSurfaceCommandService } from '../../services/SharedSurfaceCommandService.js';
import type { ParsedCommand } from '../../gateways/channels/telegram/CommandParser.js';
import { InternalSurfaceApiService } from './InternalSurfaceApiService.js';

export type LegacySurfaceCommandDelegate = Pick<SharedSurfaceCommandService, 'maybeHandle'>;

export type CanonicalSurfaceCommandApi = {
  handleCommand(input: {
    context: IMessageContext;
    parsedCommand?: ParsedCommand | null;
    request?: Partial<CommandRequest> | null;
  }): Promise<CommandResult>;
  maybeHandle?: (ctx: IMessageContext, parsedCommand?: ParsedCommand | null) => Promise<boolean> | boolean;
};

export type SurfaceCommandBoundary = CanonicalSurfaceCommandApi | LegacySurfaceCommandDelegate;

export function isCanonicalSurfaceCommandApi(service: unknown): service is CanonicalSurfaceCommandApi {
  return typeof (service as CanonicalSurfaceCommandApi | null)?.handleCommand === 'function';
}

export function isLegacySurfaceCommandDelegate(service: unknown): service is LegacySurfaceCommandDelegate {
  return typeof (service as LegacySurfaceCommandDelegate | null)?.maybeHandle === 'function';
}

export function createInternalSurfaceCommandApi(
  service: SurfaceCommandBoundary | null | undefined,
): CanonicalSurfaceCommandApi | null {
  if (!service) {
    return null;
  }
  if (isCanonicalSurfaceCommandApi(service)) {
    return service;
  }
  if (isLegacySurfaceCommandDelegate(service)) {
    return new InternalSurfaceApiService({ commandService: service });
  }
  return null;
}
