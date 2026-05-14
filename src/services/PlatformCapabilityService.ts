import { PlatformCapability, PlatformKey, PLATFORM_KEYS } from '../contracts/PlatformContract.js';
import { describePlatformCapability } from './platform-capability/PlatformCapabilityDescriptors.js';
import {
  envBoolean,
  envList,
  envValue,
  readDiscordBridgeRuntimeStatus,
  readPlannedChannelRuntimeStatus,
  readSlackRuntimeStatus,
  readWhatsAppRuntimeStatus,
} from './platform-capability/PlatformCapabilityRuntimeReaders.js';

export class PlatformCapabilityService {
  public getCapabilities(): PlatformCapability[] {
    return [...PLATFORM_KEYS].map((platform) => this.describe(platform));
  }

  public describe(platform: PlatformKey): PlatformCapability {
    return describePlatformCapability(platform, {
      readDiscordBridgeRuntimeStatus: this.readDiscordBridgeRuntimeStatus.bind(this),
      readWhatsAppRuntimeStatus: this.readWhatsAppRuntimeStatus.bind(this),
      readSlackRuntimeStatus: this.readSlackRuntimeStatus.bind(this),
      readPlannedChannelRuntimeStatus: this.readPlannedChannelRuntimeStatus.bind(this),
      envValue: this.envValue.bind(this),
      envList: this.envList.bind(this),
      envBoolean: this.envBoolean.bind(this),
    });
  }

  public isReady(platform: PlatformKey): boolean {
    return this.describe(platform).readiness === 'ready';
  }

  public getSummary(): { ready: PlatformKey[]; partial: PlatformKey[]; planned: PlatformKey[]; disabled: PlatformKey[] } {
    const summary = {
      ready: [] as PlatformKey[],
      partial: [] as PlatformKey[],
      planned: [] as PlatformKey[],
      disabled: [] as PlatformKey[],
    };

    for (const capability of this.getCapabilities()) {
      if (capability.readiness === 'ready') {
        summary.ready.push(capability.platform);
      } else if (capability.readiness === 'partial') {
        summary.partial.push(capability.platform);
      } else if (capability.readiness === 'planned') {
        summary.planned.push(capability.platform);
      } else {
        summary.disabled.push(capability.platform);
      }
    }

    return summary;
  }

  private readDiscordBridgeRuntimeStatus() {
    return readDiscordBridgeRuntimeStatus();
  }

  private readWhatsAppRuntimeStatus() {
    return readWhatsAppRuntimeStatus();
  }

  private readSlackRuntimeStatus() {
    return readSlackRuntimeStatus();
  }

  private readPlannedChannelRuntimeStatus(filePath: string) {
    return readPlannedChannelRuntimeStatus(filePath);
  }

  private envValue(key: string): string {
    return envValue(key);
  }

  private envList(key: string): string[] {
    return envList(key);
  }

  private envBoolean(key: string, fallback = false): boolean {
    return envBoolean(key, fallback);
  }
}
