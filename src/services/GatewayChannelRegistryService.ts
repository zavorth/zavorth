import {
  type ChannelAdapterContract,
  type ChannelFeatureSet as BaseChannelFeatureSet,
  type ChannelAdapterStatus,
  type RuntimeChannelDescriptor,
  type RuntimeChannelDescriptorContract,
} from '../contracts/ChannelMeshContract.js';
import { GatewayChannelAdapterRegistryService } from './GatewayChannelAdapterRegistryService.js';

import type { PlatformReadiness } from '../contracts/PlatformContract.js';
import { PlatformCapabilityService } from './PlatformCapabilityService.js';

type GatewayChannelRegistryRuntime = {
  now?: () => Date;
  hasDispatcher?: boolean;
  canSpawnWeb?: boolean;
  platformCapabilityService?: Pick<PlatformCapabilityService, 'getCapabilities'>;
  adapterRegistryService?: Pick<GatewayChannelAdapterRegistryService, 'listAdapters' | 'getAdapter'>;
  includeLongTailActivationAdapters?: boolean;
};

export type GatewayChannelFeatureSet = Pick<
  BaseChannelFeatureSet,
  'sessionList' | 'sessionHistory' | 'sessionSend' | 'sessionSpawn' | 'attachments' | 'threads' | 'groupPolicy'
>;

export type GatewayChannelRegistryEntry = {
  id: string;
  label: string;
  readiness: PlatformReadiness;
  configured: boolean;
  transport: string;
  notes: string[];
  features: GatewayChannelFeatureSet;
};

export type GatewayChannelRegistrySnapshot = {
  generatedAt: string;
  summary: {
    total: number;
    ready: number;
    partial: number;
    planned: number;
    disabled: number;
  };
  channels: GatewayChannelRegistryEntry[];
  narrative: {
    headline: string;
    operatorSummary: string;
  };
};

export class GatewayChannelRegistryService {
  private readonly now: () => Date;
  private readonly adapters: Pick<GatewayChannelAdapterRegistryService, 'listAdapters'> & {
    getAdapter?: (id: string) => ChannelAdapterStatus | null;
    setRuntimeAdapters?: (runtimeAdapters: ChannelAdapterContract[]) => void;
    setRuntimeDescriptors?: (
      runtimeDescriptors: Array<RuntimeChannelDescriptor | RuntimeChannelDescriptorContract>,
    ) => void;
  };

  constructor(runtime: GatewayChannelRegistryRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.adapters =
      runtime.adapterRegistryService ||
      new GatewayChannelAdapterRegistryService({
        hasDispatcher: runtime.hasDispatcher,
        canSpawnWeb: runtime.canSpawnWeb,
        platformCapabilityService: runtime.platformCapabilityService,
        includeLongTailActivationAdapters: runtime.includeLongTailActivationAdapters,
      });
  }

  public setRuntimeAdapters(runtimeAdapters: ChannelAdapterContract[]): void {
    if (typeof this.adapters.setRuntimeAdapters === 'function') {
      this.adapters.setRuntimeAdapters(runtimeAdapters);
    }
  }

  public setRuntimeDescriptors(
    runtimeDescriptors: Array<RuntimeChannelDescriptor | RuntimeChannelDescriptorContract>,
  ): void {
    if (typeof this.adapters.setRuntimeDescriptors === 'function') {
      this.adapters.setRuntimeDescriptors(runtimeDescriptors);
    }
  }

  public buildSnapshot(): GatewayChannelRegistrySnapshot {
    const channels = this.listChannels();
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
      narrative: {
        headline: `Gateway conhece ${summary.total} canal(is) com contract explicito.`,
        operatorSummary: `${summary.ready} pronto(s), ${summary.partial} parcial(is) e ${summary.planned} planejado(s).`,
      },
    };
  }

  public listChannels(): GatewayChannelRegistryEntry[] {
    return this.adapters.listAdapters().map((entry) => this.fromAdapter(entry));
  }

  public getChannel(id: string): GatewayChannelRegistryEntry | null {
    const normalizedId = String(id || '').trim().toLowerCase();
    const exact = this.listChannels().find((entry) => entry.id === normalizedId);
    if (exact) {
      return exact;
    }
    const resolved = this.adapters.getAdapter?.(normalizedId);
    return resolved ? this.fromAdapter(resolved) : null;
  }

  private fromAdapter(entry: ChannelAdapterStatus): GatewayChannelRegistryEntry {
    return {
      id: String(entry.id || '').trim().toLowerCase(),
      label: entry.label,
      readiness: entry.readiness,
      configured: entry.configured,
      transport: entry.transport,
      notes: Array.isArray(entry.notes) ? entry.notes : [],
      features: {
        sessionList: entry.features.sessionList,
        sessionHistory: entry.features.sessionHistory,
        sessionSend: entry.features.sessionSend,
        sessionSpawn: entry.features.sessionSpawn,
        attachments: entry.features.attachments,
        threads: entry.features.threads,
        groupPolicy: entry.features.groupPolicy,
      },
    };
  }
}
