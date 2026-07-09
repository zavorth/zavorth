import { GatewayEventBus } from '../events/GatewayEventBus';
import { logger } from '../../logger.js';

export type GatewayState = 'uninitialized' | 'core_ready' | 'surface_ready' | 'channel_ready' | 'error' | 'shutdown';

export class GatewayLifecycle {
  private state: GatewayState = 'uninitialized';
  private bootTime: number = Date.now();

  constructor(private eventBus: GatewayEventBus) {}

  getState(): GatewayState {
    return this.state;
  }

  getUptime(): number {
    return Math.floor((Date.now() - this.bootTime) / 1000);
  }

  async transitionTo(newState: GatewayState): Promise<void> {
    const oldState = this.state;
    this.state = newState;

    if (newState === 'core_ready') {
      await this.eventBus.emit({ type: 'gateway_starting' });
    } else if (newState === 'surface_ready') {
      await this.eventBus.emit({ type: 'gateway_ready', uptime: this.getUptime() });
    }

    logger.info(`[GatewayLifecycle] Status transition: ${oldState} -> ${newState}`);
  }
}
