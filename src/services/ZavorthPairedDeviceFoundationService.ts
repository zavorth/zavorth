import type { NodeMeshCapabilityId } from '../contracts/NodeMeshContract.js';
import type {
  ZavorthPairedDeviceActionResult,
  ZavorthPairedDeviceAuditAction,
  ZavorthPairedDeviceAuditReceipt,
  ZavorthPairedDeviceCapabilityInspection,
  ZavorthPairedDeviceRecord,
  ZavorthPairedDeviceScope,
  ZavorthPairedDeviceStatus,
  ZavorthPairedDeviceTransport,
  ZavorthPairedDeviceTrustMetadata,
} from '../contracts/native/ZavorthNativeCompanionDeviceContract.js';
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
  deviceRegistry: {
    statuses: ['pending', 'approved', 'revoked', 'blocked'];
    protocol: 'zavorth-paired-device-foundation';
    records: ZavorthPairedDeviceRecord[];
    receipts: ZavorthPairedDeviceAuditReceipt[];
  };
  actions: {
    list: 'listDevices';
    approve: 'approveDevice';
    revoke: 'revokeDevice';
    block: 'blockDevice';
    rotateTrust: 'rotateTrust';
    trust: 'trustDevice';
    inspectCapability: 'inspectCapability';
  };
  mockDeviceNode: {
    path: '/api/node-mesh/mock-device-node';
    transport: 'mock-device-node';
    protocol: 'pairing-claim-heartbeat-invocation-receipts';
    mobileAppsAttachLaterWithoutProtocolChange: true;
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
  devices?: ZavorthPairedDeviceRecord[];
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

const KNOWN_DEVICE_SCOPES = new Set<ZavorthPairedDeviceScope>([
  'device:info',
  'device:camera',
  'device:location',
  'device:notifications',
  'device:confirm',
  'device:haptics',
  'device:screen',
  'device:clipboard',
]);

export class ZavorthPairedDeviceFoundationService {
  private readonly now: () => Date;
  private readonly devices = new Map<string, ZavorthPairedDeviceRecord>();
  private readonly receipts: ZavorthPairedDeviceAuditReceipt[] = [];
  private receiptSequence = 0;

  constructor(runtime: Runtime = {}) {
    this.now = runtime.now || (() => new Date());
    for (const device of runtime.devices || []) {
      const normalized = normalizeDeviceRecord(device);
      if (normalized) {
        this.devices.set(normalized.id, normalized);
      }
    }
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
      deviceRegistry: {
        statuses: ['pending', 'approved', 'revoked', 'blocked'],
        protocol: 'zavorth-paired-device-foundation',
        records: this.listDevices(),
        receipts: this.listAuditReceipts(),
      },
      actions: {
        list: 'listDevices',
        approve: 'approveDevice',
        revoke: 'revokeDevice',
        block: 'blockDevice',
        rotateTrust: 'rotateTrust',
        trust: 'trustDevice',
        inspectCapability: 'inspectCapability',
      },
      mockDeviceNode: {
        path: '/api/node-mesh/mock-device-node',
        transport: 'mock-device-node',
        protocol: 'pairing-claim-heartbeat-invocation-receipts',
        mobileAppsAttachLaterWithoutProtocolChange: true,
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

  public listDevices(): ZavorthPairedDeviceRecord[] {
    return Array.from(this.devices.values())
      .map(cloneDevice)
      .sort((left, right) => left.label.localeCompare(right.label, 'en-US'));
  }

  public listAuditReceipts(): ZavorthPairedDeviceAuditReceipt[] {
    return this.receipts.map((receipt) => ({ ...receipt }));
  }

  public approveDevice(
    deviceId: string | null | undefined,
    input: {
      actor?: string | null;
      scopes?: Array<ZavorthPairedDeviceScope | null | undefined> | null;
      reason?: string | null;
    } = {},
  ): ZavorthPairedDeviceActionResult {
    const device = this.findDevice(deviceId);
    if (!device) {
      return this.deniedResult('approve', String(deviceId || '').trim(), null, 'Device record was not found.', input.actor);
    }

    if (device.status === 'revoked' || device.status === 'blocked') {
      return this.deniedResult(
        'approve',
        device.id,
        device,
        `${device.status} devices cannot be approved without a new pairing claim.`,
        input.actor,
      );
    }

    const requestedScopes = input.scopes !== undefined
      ? normalizeScopes(input.scopes)
      : device.scopes;
    const unsupportedScopes = requestedScopes.filter((scope) => !device.scopes.includes(scope));
    if (unsupportedScopes.length > 0) {
      return this.deniedResult(
        'approve',
        device.id,
        device,
        `Approval requested unsupported scope(s): ${unsupportedScopes.join(', ')}.`,
        input.actor,
      );
    }

    const previousStatus = device.status;
    const nowIso = this.now().toISOString();
    const receipt = this.receipt({
      action: 'approve',
      deviceId: device.id,
      actor: input.actor,
      status: 'allowed',
      previousStatus,
      nextStatus: 'approved',
      reason: clean(input.reason) || 'Device approved for the paired-device foundation.',
    });
    const next = cloneDevice({
      ...device,
      status: 'approved',
      scopes: requestedScopes,
      trust: {
        ...device.trust,
        level: requestedScopes.length < device.scopes.length ? 'restricted' : 'trusted',
        approvedAt: nowIso,
        approvedBy: receipt.actor,
        trustReceiptId: receipt.id,
      },
    });
    this.devices.set(next.id, next);
    return { ok: true, device: cloneDevice(next), receipt };
  }

  public revokeDevice(
    deviceId: string | null | undefined,
    input: {
      actor?: string | null;
      reason?: string | null;
    } = {},
  ): ZavorthPairedDeviceActionResult {
    return this.transitionDevice(deviceId, 'revoke', 'revoked', {
      actor: input.actor,
      reason: clean(input.reason) || 'Device pairing revoked.',
      deniedStatuses: ['blocked'],
      trust: (trust, receipt, nowIso) => ({
        ...trust,
        level: 'revoked',
        revokedAt: nowIso,
        revokedBy: receipt.actor,
        trustReceiptId: receipt.id,
      }),
    });
  }

  public blockDevice(
    deviceId: string | null | undefined,
    input: {
      actor?: string | null;
      reason?: string | null;
    } = {},
  ): ZavorthPairedDeviceActionResult {
    return this.transitionDevice(deviceId, 'block', 'blocked', {
      actor: input.actor,
      reason: clean(input.reason) || 'Device blocked by trust policy.',
      deniedStatuses: [],
      trust: (trust, receipt, nowIso) => ({
        ...trust,
        level: 'blocked',
        blockedAt: nowIso,
        blockedBy: receipt.actor,
        trustReceiptId: receipt.id,
      }),
    });
  }

  public rotateTrust(
    deviceId: string | null | undefined,
    input: {
      actor?: string | null;
      publicKey?: string | null;
      reason?: string | null;
    } = {},
  ): ZavorthPairedDeviceActionResult {
    const device = this.findDevice(deviceId);
    if (!device) {
      return this.deniedResult('rotate-trust', String(deviceId || '').trim(), null, 'Device record was not found.', input.actor);
    }
    if (device.status !== 'approved') {
      return this.deniedResult('rotate-trust', device.id, device, 'Only approved devices can rotate trust keys.', input.actor);
    }
    const publicKey = clean(input.publicKey);
    if (!publicKey) {
      return this.deniedResult('rotate-trust', device.id, device, 'A replacement public key is required.', input.actor);
    }

    const nowIso = this.now().toISOString();
    const receipt = this.receipt({
      action: 'rotate-trust',
      deviceId: device.id,
      actor: input.actor,
      status: 'allowed',
      previousStatus: device.status,
      nextStatus: device.status,
      reason: clean(input.reason) || 'Device trust public key rotated.',
    });
    const next = cloneDevice({
      ...device,
      publicKey,
      trust: {
        ...device.trust,
        keyRotatedAt: nowIso,
        trustReceiptId: receipt.id,
      },
    });
    this.devices.set(next.id, next);
    return { ok: true, device: cloneDevice(next), receipt };
  }

  public trustDevice(
    deviceId: string | null | undefined,
    input: {
      actor?: string | null;
      scopes?: Array<ZavorthPairedDeviceScope | null | undefined> | null;
      reason?: string | null;
    } = {},
  ): ZavorthPairedDeviceActionResult {
    const device = this.findDevice(deviceId);
    if (!device) {
      return this.deniedResult('trust', String(deviceId || '').trim(), null, 'Device record was not found.', input.actor);
    }
    if (device.status !== 'approved') {
      return this.deniedResult('trust', device.id, device, 'Only approved devices can update trust metadata.', input.actor);
    }

    const scopes = input.scopes !== undefined ? normalizeScopes(input.scopes) : device.scopes;
    const unsupportedScopes = scopes.filter((scope) => !device.scopes.includes(scope));
    if (unsupportedScopes.length > 0) {
      return this.deniedResult('trust', device.id, device, `Trust update requested unsupported scope(s): ${unsupportedScopes.join(', ')}.`, input.actor);
    }

    const receipt = this.receipt({
      action: 'trust',
      deviceId: device.id,
      actor: input.actor,
      status: 'allowed',
      previousStatus: device.status,
      nextStatus: device.status,
      reason: clean(input.reason) || 'Device trust metadata updated.',
    });
    const next = cloneDevice({
      ...device,
      scopes,
      trust: {
        ...device.trust,
        level: scopes.length < device.scopes.length ? 'restricted' : 'trusted',
        trustReceiptId: receipt.id,
      },
    });
    this.devices.set(next.id, next);
    return { ok: true, device: cloneDevice(next), receipt };
  }

  public inspectCapability(
    deviceId: string | null | undefined,
    capabilityId: NodeMeshCapabilityId,
    input: {
      requiredScope?: ZavorthPairedDeviceScope | null;
    } = {},
  ): ZavorthPairedDeviceCapabilityInspection {
    const normalizedDeviceId = clean(deviceId);
    const normalizedCapabilityId = clean(capabilityId) as NodeMeshCapabilityId;
    const device = this.findDevice(normalizedDeviceId);
    const requiredScope = clean(input.requiredScope) || defaultScopeForCapability(normalizedCapabilityId);
    if (!device) {
      return {
        ok: false,
        status: 'not-found',
        deviceId: normalizedDeviceId,
        deviceStatus: null,
        capabilityId: normalizedCapabilityId,
        requiredScope,
        reason: 'Device record was not found.',
      };
    }
    if (device.status !== 'approved') {
      return {
        ok: false,
        status: 'status-denied',
        deviceId: device.id,
        deviceStatus: device.status,
        capabilityId: normalizedCapabilityId,
        requiredScope,
        reason: `Capability access requires approved status; current status is ${device.status}.`,
      };
    }
    if (!device.capabilities.includes(normalizedCapabilityId)) {
      return {
        ok: false,
        status: 'capability-denied',
        deviceId: device.id,
        deviceStatus: device.status,
        capabilityId: normalizedCapabilityId,
        requiredScope,
        reason: `Device did not declare capability ${normalizedCapabilityId}.`,
      };
    }
    if (requiredScope && !device.scopes.includes(requiredScope)) {
      return {
        ok: false,
        status: 'scope-denied',
        deviceId: device.id,
        deviceStatus: device.status,
        capabilityId: normalizedCapabilityId,
        requiredScope,
        reason: `Capability ${normalizedCapabilityId} requires scope ${requiredScope}.`,
      };
    }
    return {
      ok: true,
      status: 'allowed',
      deviceId: device.id,
      deviceStatus: device.status,
      capabilityId: normalizedCapabilityId,
      requiredScope,
      reason: `Capability ${normalizedCapabilityId} is available for this approved device.`,
    };
  }

  private transitionDevice(
    deviceId: string | null | undefined,
    action: ZavorthPairedDeviceAuditAction,
    nextStatus: ZavorthPairedDeviceStatus,
    input: {
      actor?: string | null;
      reason: string;
      deniedStatuses: ZavorthPairedDeviceStatus[];
      trust: (
        trust: ZavorthPairedDeviceTrustMetadata,
        receipt: ZavorthPairedDeviceAuditReceipt,
        nowIso: string,
      ) => ZavorthPairedDeviceTrustMetadata;
    },
  ): ZavorthPairedDeviceActionResult {
    const device = this.findDevice(deviceId);
    if (!device) {
      return this.deniedResult(action, String(deviceId || '').trim(), null, 'Device record was not found.', input.actor);
    }
    if (input.deniedStatuses.includes(device.status)) {
      return this.deniedResult(action, device.id, device, `${device.status} devices cannot transition to ${nextStatus}.`, input.actor);
    }

    const nowIso = this.now().toISOString();
    const receipt = this.receipt({
      action,
      deviceId: device.id,
      actor: input.actor,
      status: 'allowed',
      previousStatus: device.status,
      nextStatus,
      reason: input.reason,
    });
    const next = cloneDevice({
      ...device,
      status: nextStatus,
      trust: input.trust(device.trust, receipt, nowIso),
    });
    this.devices.set(next.id, next);
    return { ok: true, device: cloneDevice(next), receipt };
  }

  private deniedResult(
    action: ZavorthPairedDeviceAuditAction,
    deviceId: string,
    device: ZavorthPairedDeviceRecord | null,
    reason: string,
    actor?: string | null,
  ): ZavorthPairedDeviceActionResult {
    const receipt = this.receipt({
      action,
      deviceId,
      actor,
      status: 'denied',
      previousStatus: device?.status || null,
      nextStatus: device?.status || null,
      reason,
    });
    return { ok: false, device: device ? cloneDevice(device) : null, receipt };
  }

  private receipt(input: {
    action: ZavorthPairedDeviceAuditAction;
    deviceId: string;
    actor?: string | null;
    status: 'allowed' | 'denied';
    previousStatus: ZavorthPairedDeviceStatus | null;
    nextStatus: ZavorthPairedDeviceStatus | null;
    reason: string;
  }): ZavorthPairedDeviceAuditReceipt {
    this.receiptSequence += 1;
    const receipt: ZavorthPairedDeviceAuditReceipt = {
      id: `zavorth.paired-device.${input.action}.${clean(input.deviceId) || 'unknown'}.${this.now().getTime()}.${this.receiptSequence}`,
      action: input.action,
      deviceId: clean(input.deviceId),
      actor: clean(input.actor) || 'system',
      status: input.status,
      previousStatus: input.previousStatus,
      nextStatus: input.nextStatus,
      reason: input.reason,
      createdAt: this.now().toISOString(),
      auditTrail: 'paired-device-foundation',
      secretValuesSerialized: false,
    };
    this.receipts.push(receipt);
    return { ...receipt };
  }

  private findDevice(deviceId: string | null | undefined): ZavorthPairedDeviceRecord | null {
    const normalizedId = clean(deviceId);
    return normalizedId ? this.devices.get(normalizedId) || null : null;
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

function clean(input: unknown): string {
  return String(input || '').trim();
}

function normalizeScopes(input: Array<ZavorthPairedDeviceScope | null | undefined> | null | undefined): ZavorthPairedDeviceScope[] {
  return Array.from(new Set((input || []).map(clean).filter(Boolean)))
    .filter((scope): scope is ZavorthPairedDeviceScope => KNOWN_DEVICE_SCOPES.has(scope as ZavorthPairedDeviceScope))
    .sort((left, right) => left.localeCompare(right, 'en-US'));
}

function normalizeCapabilities(input: Array<NodeMeshCapabilityId | null | undefined> | null | undefined): NodeMeshCapabilityId[] {
  return Array.from(new Set((input || []).map(clean).filter(Boolean) as NodeMeshCapabilityId[]))
    .filter((capabilityId): capabilityId is NodeMeshCapabilityId => NODE_HOST_SUPPORTED_CAPABILITY_IDS.includes(capabilityId))
    .sort((left, right) => left.localeCompare(right, 'en-US'));
}

function normalizeTransport(input: ZavorthPairedDeviceTransport | null | undefined): ZavorthPairedDeviceTransport {
  const transport = clean(input) as ZavorthPairedDeviceTransport;
  return transport || 'mock-device-node';
}

function normalizeTrust(input: Partial<ZavorthPairedDeviceTrustMetadata> | null | undefined): ZavorthPairedDeviceTrustMetadata {
  return {
    level: input?.level || 'untrusted',
    approvedAt: clean(input?.approvedAt) || null,
    approvedBy: clean(input?.approvedBy) || null,
    revokedAt: clean(input?.revokedAt) || null,
    revokedBy: clean(input?.revokedBy) || null,
    blockedAt: clean(input?.blockedAt) || null,
    blockedBy: clean(input?.blockedBy) || null,
    keyRotatedAt: clean(input?.keyRotatedAt) || null,
    trustReceiptId: clean(input?.trustReceiptId) || null,
  };
}

function normalizeDeviceRecord(input: Partial<ZavorthPairedDeviceRecord> | null | undefined): ZavorthPairedDeviceRecord | null {
  const id = clean(input?.id);
  if (!id) {
    return null;
  }
  const capabilities = normalizeCapabilities(input?.capabilities || []);
  return {
    id,
    label: clean(input?.label) || id,
    status: normalizeStatus(input?.status),
    publicKey: clean(input?.publicKey),
    transport: normalizeTransport(input?.transport),
    scopes: normalizeScopes(input?.scopes || []),
    capabilities,
    lastSeenAt: clean(input?.lastSeenAt) || null,
    trust: normalizeTrust(input?.trust),
  };
}

function normalizeStatus(input: ZavorthPairedDeviceStatus | null | undefined): ZavorthPairedDeviceStatus {
  return input === 'approved' || input === 'revoked' || input === 'blocked' ? input : 'pending';
}

function cloneDevice(device: ZavorthPairedDeviceRecord): ZavorthPairedDeviceRecord {
  return {
    ...device,
    scopes: [...device.scopes],
    capabilities: [...device.capabilities],
    trust: { ...device.trust },
  };
}

function defaultScopeForCapability(capabilityId: NodeMeshCapabilityId): ZavorthPairedDeviceScope | null {
  switch (capabilityId) {
    case 'camera.capture':
      return 'device:camera';
    case 'location.read':
      return 'device:location';
    case 'notifications.send':
      return 'device:notifications';
    case 'device.confirm':
      return 'device:confirm';
    case 'haptics.vibrate':
      return 'device:haptics';
    case 'screen.capture':
      return 'device:screen';
    case 'clipboard.read':
    case 'clipboard.write':
      return 'device:clipboard';
    case 'device.info':
      return 'device:info';
    default:
      return null;
  }
}
