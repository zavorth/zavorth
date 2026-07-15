import type {
  NodeMeshDeviceProfileDescriptor,
  NodeMeshDeviceProfileId,
  NodeMeshNodeKind,
} from '../contracts/NodeMeshContract.js';

const NODE_DEVICE_PROFILES: Record<string, NodeMeshDeviceProfileDescriptor> = {
  'headless-worker': {
    id: 'headless-worker',
    label: 'Headless Worker',
    kind: 'headless',
    transport: 'bridge',
    summary: 'Utility node for secure remote execution, browser proxy, and controlled file read/write.',
    operatorSummary: 'Ideal profile for servers, WSL, and hosts without a dedicated UI.',
    defaultCapabilityIds: ['device.info', 'system.run', 'files.read', 'files.write', 'files.watch', 'browser.proxy'],
    actionHint: 'Use for remote queues, browser automation, and controlled host I/O.',
  },
  'desktop-companion': {
    id: 'desktop-companion',
    label: 'Desktop Companion',
    kind: 'desktop',
    transport: 'remote',
    summary: 'Node with desktop visual context, notifications, and controlled host read/write.',
    operatorSummary: 'Profile for Windows/macOS/Linux with a screen and operator nearby.',
    defaultCapabilityIds: [
      'device.info',
      'screen.capture',
      'notifications.send',
      'files.read',
      'files.write',
      'files.watch',
      'clipboard.read',
      'clipboard.write',
    ],
    actionHint: 'Use for visual support, screen context, notifications, and controlled local I/O.',
  },
  'mobile-companion': {
    id: 'mobile-companion',
    label: 'Mobile Companion',
    kind: 'mobile',
    transport: 'remote',
    summary: 'Node for a mobile device with camera, location, and notification signals.',
    operatorSummary: 'Profile for a mobile companion with real context signals and pragmatic capture.',
    defaultCapabilityIds: [
      'device.info',
      'camera.capture',
      'notifications.send',
      'location.read',
      'device.confirm',
      'haptics.vibrate',
    ],
    actionHint: 'Use for mobile companion, contextual camera/location, and remote handoffs.',
  },
  'browser-companion': {
    id: 'browser-companion',
    label: 'Browser Companion',
    kind: 'browser',
    transport: 'sidecar',
    summary: 'Node specialized in browser proxy and light visual context for guided navigation.',
    operatorSummary: 'Useful profile for browser sidecars and web automation bridges.',
    defaultCapabilityIds: ['device.info', 'browser.proxy', 'screen.capture', 'files.read'],
    actionHint: 'Use when the main goal is assisted browsing and web automation.',
  },
};

const NODE_DEVICE_PROFILE_ALIASES: Record<string, NodeMeshDeviceProfileId> = {
  headless: 'headless-worker',
  worker: 'headless-worker',
  desktop: 'desktop-companion',
  mobile: 'mobile-companion',
  browser: 'browser-companion',
};

export class NodeDeviceProfileService {
  public listProfiles(): NodeMeshDeviceProfileDescriptor[] {
    return Object.values(NODE_DEVICE_PROFILES).sort((left, right) => left.label.localeCompare(right.label, 'en-US'));
  }

  public listRecommendedProfiles(): NodeMeshDeviceProfileDescriptor[] {
    return [
      this.describeProfile('headless-worker'),
      this.describeProfile('desktop-companion'),
      this.describeProfile('browser-companion'),
      this.describeProfile('mobile-companion'),
    ].filter(Boolean) as NodeMeshDeviceProfileDescriptor[];
  }

  public resolveProfile(profileId?: string | null, kind?: NodeMeshNodeKind | null): NodeMeshDeviceProfileDescriptor {
    const normalizedProfileId = this.normalizeProfileId(profileId);
    if (normalizedProfileId && NODE_DEVICE_PROFILES[normalizedProfileId]) {
      return NODE_DEVICE_PROFILES[normalizedProfileId];
    }

    switch (
      String(kind || '')
        .trim()
        .toLowerCase()
    ) {
      case 'desktop':
        return NODE_DEVICE_PROFILES['desktop-companion'];
      case 'mobile':
        return NODE_DEVICE_PROFILES['mobile-companion'];
      case 'browser':
        return NODE_DEVICE_PROFILES['browser-companion'];
      default:
        return NODE_DEVICE_PROFILES['headless-worker'];
    }
  }

  public describeProfile(profileId?: string | null): NodeMeshDeviceProfileDescriptor | null {
    const normalizedProfileId = this.normalizeProfileId(profileId);
    return normalizedProfileId && NODE_DEVICE_PROFILES[normalizedProfileId]
      ? NODE_DEVICE_PROFILES[normalizedProfileId]
      : null;
  }

  public normalizeProfileId(profileId?: string | null): NodeMeshDeviceProfileId | null {
    const normalizedProfileId = String(profileId || '')
      .trim()
      .toLowerCase();
    if (!normalizedProfileId) {
      return null;
    }

    return NODE_DEVICE_PROFILE_ALIASES[normalizedProfileId] || normalizedProfileId;
  }
}
