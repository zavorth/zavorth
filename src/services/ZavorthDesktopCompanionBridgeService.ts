import type {
  ZavorthDesktopCompanionBridgeProof,
  ZavorthNativeCapabilityId,
  ZavorthNativeCapabilityReceipt,
} from '../contracts/native/ZavorthNativeCompanionDeviceContract.js';
import { NodeDeviceProfileService } from './NodeDeviceProfileService.js';

type Runtime = {
  now?: () => Date;
  platform?: NodeJS.Platform;
  profileService?: NodeDeviceProfileService;
};

const DESKTOP_CAPABILITY_MAP: Array<{
  nodeCapability: string;
  nativeCapability: ZavorthNativeCapabilityId;
  permissionMode: ZavorthNativeCapabilityReceipt['permissionMode'];
  reason: string;
}> = [
  {
    nodeCapability: 'screen.capture',
    nativeCapability: 'desktop.screen',
    permissionMode: 'operator-approval-required',
    reason: 'Desktop screen context is available through the desktop profile but requires operator approval.',
  },
  {
    nodeCapability: 'notifications.send',
    nativeCapability: 'desktop.notification',
    permissionMode: 'browser-permission',
    reason: 'Desktop notifications are available where the host or browser grants notification permission.',
  },
  {
    nodeCapability: 'clipboard.read',
    nativeCapability: 'desktop.clipboard',
    permissionMode: 'operator-approval-required',
    reason: 'Clipboard access is available through the desktop profile and remains approval-gated.',
  },
];

export class ZavorthDesktopCompanionBridgeService {
  private readonly now: () => Date;
  private readonly platform: NodeJS.Platform;
  private readonly profileService: NodeDeviceProfileService;

  constructor(runtime: Runtime = {}) {
    this.now = runtime.now || (() => new Date());
    this.platform = runtime.platform || process.platform;
    this.profileService = runtime.profileService || new NodeDeviceProfileService();
  }

  public buildProof(): ZavorthDesktopCompanionBridgeProof {
    const profile = this.profileService.resolveProfile('desktop-companion', 'desktop');
    const profileCapabilities = new Set(profile.defaultCapabilityIds);
    const receipts = DESKTOP_CAPABILITY_MAP.map((entry) => this.receipt({
      capabilityId: entry.nativeCapability,
      status: profileCapabilities.has(entry.nodeCapability) ? 'available' : 'unsupported',
      permissionMode: entry.permissionMode,
      reason: entry.reason,
    }));
    const availableCapabilities = receipts
      .filter((receipt) => receipt.status === 'available')
      .map((receipt) => receipt.capabilityId);
    const gatedCapabilities = receipts
      .filter((receipt) => receipt.permissionMode !== 'not-required')
      .map((receipt) => receipt.capabilityId);

    return {
      status: availableCapabilities.length >= 2 ? 'passed' : 'attention',
      platform: this.platform,
      profileId: profile.id,
      availableCapabilities,
      gatedCapabilities,
      receipts,
      liveExternalIoPerformed: false,
      secretValuesSerialized: false,
    };
  }

  private receipt(input: {
    capabilityId: ZavorthNativeCapabilityId;
    status: ZavorthNativeCapabilityReceipt['status'];
    permissionMode: ZavorthNativeCapabilityReceipt['permissionMode'];
    reason: string;
  }): ZavorthNativeCapabilityReceipt {
    return {
      id: `zavorth.native-companion.desktop.${input.capabilityId}.${this.now().getTime()}.receipt`,
      target: 'desktop-companion',
      capabilityId: input.capabilityId,
      status: input.status,
      permissionMode: input.permissionMode,
      artifactFirst: true,
      liveExternalIoPerformed: false,
      localProofPerformed: true,
      enabledByDefault: false,
      secretValuesSerialized: false,
      reason: input.reason,
    };
  }
}
