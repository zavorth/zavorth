import { Context } from 'grammy';

/**
 * Hermes-style: free text always belongs to the agent.
 *
 * This service used to intercept free-text with regex packs (research, automation,
 * file delivery, inspection). Those packs are deleted. Explicit slash commands
 * and agent tools own those capabilities now.
 *
 * Kept as a no-op adapter so bootstrap/wiring stays stable.
 */
export type TelegramNaturalCapabilityRoutingServiceDeps = {
  fileDeliveryController?: unknown;
  inspectionController?: unknown;
  researchController?: unknown;
  schedulerController?: unknown;
  surfaceOperationalIntentService?: unknown;
};

export class TelegramNaturalCapabilityRoutingService {
  constructor(_deps: TelegramNaturalCapabilityRoutingServiceDeps) {}

  /**
   * Never steals free text from the agent (Hermes-style).
   * @returns always false
   */
  public async dispatch(
    _ctx: Context,
    _effectiveText: string,
    _userId: string,
  ): Promise<boolean> {
    return false;
  }
}
