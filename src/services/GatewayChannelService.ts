import type {
  PlatformReadiness,
} from '../contracts/PlatformContract.js';
import type { ChannelAdapterStatus } from '../contracts/ChannelMeshContract.js';
import { GatewayChannelAdapterRegistryService } from './GatewayChannelAdapterRegistryService.js';

type GatewayChannelRuntime = {
  now?: () => Date;
  adapterRegistryService?: Pick<GatewayChannelAdapterRegistryService, 'listAdapters'>;
};

export type GatewayChannelEntry = {
  id: string;
  label: string;
  readiness: PlatformReadiness;
  configured: boolean;
  transport: string;
  notes: string[];
};

export type GatewayChannelSnapshot = {
  generatedAt: string;
  summary: {
    total: number;
    ready: number;
    partial: number;
    planned: number;
    disabled: number;
  };
  channels: GatewayChannelEntry[];
  entries: GatewayChannelEntry[];
  narrative: {
    headline: string;
    operatorSummary: string;
  };
};

export class GatewayChannelService {
  private readonly now: () => Date;
  private readonly adapters: Pick<GatewayChannelAdapterRegistryService, 'listAdapters'>;

  constructor(runtime: GatewayChannelRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.adapters = runtime.adapterRegistryService || new GatewayChannelAdapterRegistryService({
      includeLongTailActivationAdapters: true,
    });
  }

  public buildSnapshot(): GatewayChannelSnapshot {
    const channels = this.adapters.listAdapters().map((entry) => this.fromAdapter(entry));
    const summary = channels.reduce(
      (acc, entry) => {
        acc.total += 1;
        acc[entry.readiness] += 1;
        return acc;
      },
      {
        total: 0,
        ready: 0,
        partial: 0,
        planned: 0,
        disabled: 0,
      },
    );

    return {
      generatedAt: this.now().toISOString(),
      summary,
      channels,
      entries: channels,
      narrative: {
        headline: `Gateway com ${summary.total} canal(is) conhecido(s).`,
        operatorSummary: `${summary.ready} pronto(s), ${summary.partial} parcial(is) e ${summary.planned} planejado(s).`,
      },
    };
  }

  private fromAdapter(entry: ChannelAdapterStatus): GatewayChannelEntry {
    return {
      id: String(entry.id || '').trim().toLowerCase(),
      label: entry.label,
      readiness: entry.readiness,
      configured: entry.configured,
      transport: entry.transport,
      notes: Array.isArray(entry.notes) ? entry.notes : [],
    };
  }
}
