import { DomainRegistry } from '../../domain/DomainRegistry.js';
import { GatewayFacade } from '../../domain/gateway/GatewayFacade.js';
import { logger } from '../../logger.js';
import { GatewayChannelAdapter } from '../channels/GatewayChannelAdapter.js';
import { GatewayEventBus } from '../events/GatewayEventBus.js';
import {
  getChannelMessageLimitDirectory,
} from '../../channels/formatting/ChannelMessageLimitDirectory.js';
import { GatewaySessionRouter } from '../session-routing/GatewaySessionRouter.js';
import { GatewayLifecycle } from './GatewayLifecycle.js';

type GatewayRuntimeOptions = {
  domains?: DomainRegistry;
};

export class GatewayRuntime {
  public events: GatewayEventBus;
  public lifecycle: GatewayLifecycle;
  public router: GatewaySessionRouter;
  public readonly domains: DomainRegistry;

  private channels: Map<string, GatewayChannelAdapter> = new Map();

  constructor(options: GatewayRuntimeOptions = {}) {
    this.events = new GatewayEventBus();
    this.lifecycle = new GatewayLifecycle(this.events);
    this.router = new GatewaySessionRouter(this.events);
    this.domains = options.domains || new DomainRegistry({
      gatewayFacade: new GatewayFacade({
        gatewayRuntime: this,
      }),
    });
  }

  async registerChannel(adapter: GatewayChannelAdapter): Promise<void> {
    if (this.channels.has(adapter.id)) {
      throw new Error(`Channel ${adapter.id} already registered`);
    }

    this.channels.set(adapter.id, adapter);
    await adapter.initialize();

    // Dynamic message-limit levels: record the declared static limit, then
    // negotiate the effective limit once through the adapter API when it
    // implements negotiation. A null outcome keeps the declared limit.
    const limitDirectory = getChannelMessageLimitDirectory();
    limitDirectory.recordDeclaredLimit(adapter.id, adapter.messageCharLimit);
    if (typeof adapter.negotiateMessageCharLimit === 'function') {
      try {
        const negotiated = await adapter.negotiateMessageCharLimit();
        limitDirectory.recordNegotiatedLimit(adapter.id, negotiated);
      } catch (error: unknown) {
        logger.warn(
          `[GatewayRuntime] Message char-limit negotiation failed for channel ${adapter.id}; keeping declared limit.`,
          error,
        );
        limitDirectory.recordNegotiatedLimit(adapter.id, null);
      }
    }

    await this.events.emit({
      type: 'channel_registered',
      channelId: adapter.id,
    });
  }

  async start(): Promise<void> {
    await this.lifecycle.transitionTo('core_ready');
    await this.domains.initializeAll();
    await this.lifecycle.transitionTo('surface_ready');
    await this.lifecycle.transitionTo('channel_ready');
  }

  async stop(): Promise<void> {
    this.lifecycle.transitionTo('shutdown');

    for (const channel of this.channels.values()) {
      await channel.shutdown();
    }
  }

  getChannel(id: string): GatewayChannelAdapter | undefined {
    return this.channels.get(id);
  }

  listChannels(): GatewayChannelAdapter[] {
    return Array.from(this.channels.values());
  }

  buildCoreSnapshot(): {
    lifecycle: {
      state: string;
      uptime: number;
    };
    channels: {
      total: number;
      ids: string[];
    };
    sessions: {
      total: number;
    };
  } {
    return {
      lifecycle: {
        state: this.lifecycle.getState(),
        uptime: this.lifecycle.getUptime(),
      },
      channels: {
        total: this.channels.size,
        ids: Array.from(this.channels.keys()),
      },
      sessions: {
        total: this.router.listSessions().length,
      },
    };
  }

  buildSnapshot(): {
    lifecycle: {
      state: string;
      uptime: number;
    };
    channels: {
      total: number;
      ids: string[];
    };
    sessions: {
      total: number;
    };
    domains: {
      total: number;
      initialized: number;
      pending: number;
    };
  } {
    const core = this.buildCoreSnapshot();
    const domains = this.domains.buildSummarySnapshot();

    return {
      ...core,
      domains: domains.summary,
    };
  }
}
