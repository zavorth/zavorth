import { randomUUID } from 'crypto';

export type DeviceProvisioningStatus = 'unprovisioned' | 'provisioned' | 'deactivated';

export type VoiceDevice = {
  id: string;
  name: string;
  platform: 'local' | 'remote';
  status: DeviceProvisioningStatus;
  provisionedAt: string | null;
  deactivatedAt: string | null;
  capabilities: string[];
  modelPath: string | null;
  binaryPath: string | null;
};

export type ProvisioningRequest = {
  deviceName: string;
  platform?: 'local' | 'remote';
  modelPath?: string;
  binaryPath?: string;
  capabilities?: string[];
};

export type ProvisioningServiceStorage = {
  list: () => VoiceDevice[];
  save: (device: VoiceDevice) => void;
  remove: (deviceId: string) => void;
};

const DEFAULT_CAPABILITIES = ['transcription', 'continuous-recording'];

export class VoiceProvisioningService {
  private readonly storage: ProvisioningServiceStorage;

  constructor(storage?: ProvisioningServiceStorage) {
    this.storage = storage || {
      list: () => [],
      save: () => undefined,
      remove: () => undefined,
    };
  }

  public listDevices(): VoiceDevice[] {
    return this.storage.list().filter((d) => d.status === 'provisioned');
  }

  public getDevice(deviceId: string): VoiceDevice | null {
    return this.storage.list().find((d) => d.id === deviceId) || null;
  }

  public provision(request: ProvisioningRequest): VoiceDevice {
    const device: VoiceDevice = {
      id: randomUUID(),
      name: request.deviceName,
      platform: request.platform || 'local',
      status: 'provisioned',
      provisionedAt: new Date().toISOString(),
      deactivatedAt: null,
      capabilities: request.capabilities || [...DEFAULT_CAPABILITIES],
      modelPath: request.modelPath || null,
      binaryPath: request.binaryPath || null,
    };
    this.storage.save(device);
    return device;
  }

  public deactivate(deviceId: string): VoiceDevice {
    const device = this.getDevice(deviceId);
    if (!device) {
      throw new Error(`Device ${deviceId} not found.`);
    }
    if (device.status !== 'provisioned') {
      throw new Error(`Device ${deviceId} is not in provisioned state.`);
    }
    const deactivated: VoiceDevice = {
      ...device,
      status: 'deactivated',
      deactivatedAt: new Date().toISOString(),
    };
    this.storage.save(deactivated);
    return deactivated;
  }

  public hasProvisionedDevice(): boolean {
    return this.listDevices().length > 0;
  }

  public ensureProvisioned(): void {
    if (!this.hasProvisionedDevice()) {
      throw new Error(
        'No provisioned voice device found. Please provision a device before using voice features.',
      );
    }
  }
}
