import type { NodeMeshCapabilityId } from '../contracts/NodeMeshContract.js';
import { NODE_HOST_SUPPORTED_CAPABILITY_IDS } from '../domain/nodes/infrastructure/node-host-capability/NodeHostCapabilityCatalog.js';

export const ZAVORTH_PAIRED_DEVICE_FOUNDATION_CONTRACT_VERSION =
  '2026-07-02.paired-device-foundation' as const;

export type ZavorthPairedDeviceFoundationSnapshot = {
  contractVersion: typeof ZAVORTH_PAIRED_DEVICE_FOUNDATION_CONTRACT_VERSION;
  generatedAt: string;
  status: 'foundation-ready';
  summary: {
    nativeMobileAppRequiredNow: false;
    futureNativeTargets: ['ios', 'android'];
    canonicalCapabilities: number;
    sensitiveCapabilities: number;
  };
  pairing: {
    draftCommand: 'zavorth satellite pair --kind mobile';
    claimEndpoint: '/api/node-mesh/pairing/claim';
    approvalEndpoint: '/api/operations/nodes/pairing/approve';
    revocationEndpoint: '/api/operations/nodes/pairing/revoke';
  };
  heartbeat: {
    endpoint: '/api/node-mesh/heartbeat';
    delivery: 'pull-assignments-on-heartbeat';
    resultMode: 'node-completes-invocation-records';
  };
  invocation: {
    queueMode: 'heartbeat-delivered';
    routeCommand: 'zavorth satellite status';
    policy: 'approved-capability-allowlist';
  };
  capabilities: Array<{
    id: NodeMeshCapabilityId;
    sensitive: boolean;
    futureNativeAdapter: 'shared' | 'ios-android' | 'desktop-pwa';
    receiptRequired: true;
  }>;
  futureAdapters: Array<{
    id: 'pwa' | 'desktop-companion' | 'ios' | 'android';
    status: 'available-foundation' | 'future-native-app';
    role: string;
  }>;
  safety: {
    mobileAppsNotRequiredForFoundation: true;
    sensitiveCapabilitiesRequireApproval: true;
    heartbeatRequiredBeforeInvocationDelivery: true;
    noLiveIoDuringFoundationCheck: true;
    unsupportedNativeApisMustReturnReceipts: true;
    noPairingSecretsSerialized: true;
  };
};

type Runtime = {
  now?: () => Date;
};

const SENSITIVE_CAPABILITIES = new Set<NodeMeshCapabilityId>([
  'camera.capture',
  'location.read',
  'device.confirm',
  'clipboard.read',
  'clipboard.write',
  'notifications.send',
]);

const MOBILE_RELEVANT_CAPABILITIES = new Set<NodeMeshCapabilityId>([
  'device.info',
  'camera.capture',
  'location.read',
  'device.confirm',
  'haptics.vibrate',
  'notifications.send',
  'screen.capture',
  'clipboard.read',
  'clipboard.write',
]);

export class ZavorthPairedDeviceFoundationService {
  private readonly now: () => Date;

  constructor(runtime: Runtime = {}) {
    this.now = runtime.now || (() => new Date());
  }

  public buildSnapshot(): ZavorthPairedDeviceFoundationSnapshot {
    const capabilities = NODE_HOST_SUPPORTED_CAPABILITY_IDS
      .filter((capabilityId) => MOBILE_RELEVANT_CAPABILITIES.has(capabilityId))
      .map((capabilityId) => ({
        id: capabilityId,
        sensitive: SENSITIVE_CAPABILITIES.has(capabilityId),
        futureNativeAdapter: futureNativeAdapter(capabilityId),
        receiptRequired: true as const,
      }));

    return {
      contractVersion: ZAVORTH_PAIRED_DEVICE_FOUNDATION_CONTRACT_VERSION,
      generatedAt: this.now().toISOString(),
      status: 'foundation-ready',
      summary: {
        nativeMobileAppRequiredNow: false,
        futureNativeTargets: ['ios', 'android'],
        canonicalCapabilities: capabilities.length,
        sensitiveCapabilities: capabilities.filter((capability) => capability.sensitive).length,
      },
      pairing: {
        draftCommand: 'zavorth satellite pair --kind mobile',
        claimEndpoint: '/api/node-mesh/pairing/claim',
        approvalEndpoint: '/api/operations/nodes/pairing/approve',
        revocationEndpoint: '/api/operations/nodes/pairing/revoke',
      },
      heartbeat: {
        endpoint: '/api/node-mesh/heartbeat',
        delivery: 'pull-assignments-on-heartbeat',
        resultMode: 'node-completes-invocation-records',
      },
      invocation: {
        queueMode: 'heartbeat-delivered',
        routeCommand: 'zavorth satellite status',
        policy: 'approved-capability-allowlist',
      },
      capabilities,
      futureAdapters: [
        {
          id: 'pwa',
          status: 'available-foundation',
          role: 'Browser-hosted phone bridge for camera, geolocation, haptics and confirmations.',
        },
        {
          id: 'desktop-companion',
          status: 'available-foundation',
          role: 'Desktop node host for screen, clipboard, notifications and workspace-local capabilities.',
        },
        {
          id: 'ios',
          status: 'future-native-app',
          role: 'Native iOS node adapter can implement the same pairing, heartbeat and receipt contract later.',
        },
        {
          id: 'android',
          status: 'future-native-app',
          role: 'Native Android node adapter can implement the same pairing, heartbeat and receipt contract later.',
        },
      ],
      safety: {
        mobileAppsNotRequiredForFoundation: true,
        sensitiveCapabilitiesRequireApproval: true,
        heartbeatRequiredBeforeInvocationDelivery: true,
        noLiveIoDuringFoundationCheck: true,
        unsupportedNativeApisMustReturnReceipts: true,
        noPairingSecretsSerialized: true,
      },
    };
  }
}

function futureNativeAdapter(capabilityId: NodeMeshCapabilityId): 'shared' | 'ios-android' | 'desktop-pwa' {
  if (capabilityId === 'camera.capture' || capabilityId === 'location.read' || capabilityId === 'haptics.vibrate') {
    return 'ios-android';
  }
  if (capabilityId === 'screen.capture' || capabilityId === 'clipboard.read' || capabilityId === 'clipboard.write') {
    return 'desktop-pwa';
  }
  return 'shared';
}
