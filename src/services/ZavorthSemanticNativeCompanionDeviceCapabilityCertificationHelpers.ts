import type {
  ZavorthNativeCapabilityId,
  ZavorthNativeCapabilityReceipt,
  ZavorthNativeCapabilityStatus,
  ZavorthNativeCompanionDeviceSnapshot,
  ZavorthNativePermissionMode,
  ZavorthNativeRuntimeTarget,
} from '../contracts/native/ZavorthNativeCompanionDeviceContract.js';
import type {
  ZavorthSemanticNativeCompanionDeviceCapabilityCertificationSnapshot,
  ZavorthSemanticNativeCompanionDeviceCapabilityClaim,
  ZavorthSemanticNativeCompanionDeviceCapabilityClaimPriority,
  ZavorthSemanticNativeCompanionDeviceCapabilityClaimStatus,
  ZavorthSemanticNativeCompanionDeviceCapabilityScenario,
} from '../contracts/ZavorthSemanticNativeCompanionDeviceCapabilityCertificationContract.js';

export function allReceipts(pack: ZavorthNativeCompanionDeviceSnapshot): ZavorthNativeCapabilityReceipt[] {
  return pack.consistency.flatMap((entry) => entry.receipts);
}

export function receiptsForCapability(
  pack: ZavorthNativeCompanionDeviceSnapshot,
  capabilityId: ZavorthNativeCapabilityId,
): ZavorthNativeCapabilityReceipt[] {
  return allReceipts(pack).filter((receipt) => receipt.capabilityId === capabilityId);
}

export function uniqueCapabilities(pack: ZavorthNativeCompanionDeviceSnapshot): ZavorthNativeCapabilityId[] {
  return [...new Set(pack.consistency.flatMap((entry) => entry.capabilities))].sort();
}

export function requiredTarget(
  pack: ZavorthNativeCompanionDeviceSnapshot,
  target: ZavorthNativeRuntimeTarget,
): ZavorthNativeCompanionDeviceSnapshot['consistency'][number] {
  const entry = pack.consistency.find((candidate) => candidate.target === target);
  if (!entry) {
    throw new Error(`missing native companion target ${target}`);
  }
  return entry;
}

export function targetStatus(
  entry: ZavorthNativeCompanionDeviceSnapshot['consistency'][number],
): ZavorthSemanticNativeCompanionDeviceCapabilityClaimStatus {
  if (entry.status === 'covered') return 'covered';
  if (entry.status === 'owner-gated') return 'owner-gated';
  if (entry.status === 'waived') return 'replaced';
  return 'gap';
}

export function semanticCapabilityStatus(receipts: ZavorthNativeCapabilityReceipt[]): ZavorthSemanticNativeCompanionDeviceCapabilityClaimStatus {
  if (receipts.length === 0) return 'gap';
  if (receipts.some((receipt) => receipt.status === 'available' || receipt.status === 'simulated')) return 'covered';
  if (receipts.some((receipt) => receipt.status === 'owner-gated')) return 'owner-gated';
  if (receipts.some((receipt) => receipt.status === 'unsupported')) return 'rejected';
  return 'gap';
}

export function combinedCapabilityStatus(receipts: ZavorthNativeCapabilityReceipt[]): ZavorthNativeCapabilityStatus {
  if (receipts.some((receipt) => receipt.status === 'available')) return 'available';
  if (receipts.some((receipt) => receipt.status === 'simulated')) return 'simulated';
  if (receipts.some((receipt) => receipt.status === 'owner-gated')) return 'owner-gated';
  if (receipts.some((receipt) => receipt.status === 'unsupported')) return 'unsupported';
  return 'blocked';
}

export function strongestPermission(receipts: ZavorthNativeCapabilityReceipt[]): ZavorthNativePermissionMode {
  const activeReceipts = receipts.filter((receipt) =>
    receipt.status === 'available' || receipt.status === 'simulated',
  );
  const candidates = activeReceipts.length > 0 ? activeReceipts : receipts;
  const rank: ZavorthNativePermissionMode[] = [
    'owner-decision-required',
    'operator-approval-required',
    'device-trust-required',
    'browser-permission',
    'not-required',
  ];
  for (const permissionMode of rank) {
    if (candidates.some((receipt) => receipt.permissionMode === permissionMode)) return permissionMode;
  }
  return 'not-required';
}

export function capabilityStatusCounts(
  pack: ZavorthNativeCompanionDeviceSnapshot,
): Record<ZavorthNativeCapabilityStatus, number> {
  const counts: Record<ZavorthNativeCapabilityStatus, number> = {
    available: 0,
    simulated: 0,
    'owner-gated': 0,
    unsupported: 0,
    blocked: 0,
  };
  for (const receipt of allReceipts(pack)) {
    counts[receipt.status] += 1;
  }
  return counts;
}

export function targetPriority(target: ZavorthNativeRuntimeTarget): ZavorthSemanticNativeCompanionDeviceCapabilityClaimPriority {
  switch (target) {
    case 'satellite-pwa':
    case 'desktop-companion':
    case 'shared-device-runtime':
      return 'P0';
    case 'android-wrapper':
    case 'ios-wrapper':
    case 'macos-wrapper':
    case 'macos-local-tts':
      return 'P1';
    default:
      return 'P2';
  }
}

export function capabilityPriority(capabilityId: ZavorthNativeCapabilityId): ZavorthSemanticNativeCompanionDeviceCapabilityClaimPriority {
  switch (capabilityId) {
    case 'camera.capture':
    case 'location.read':
    case 'device.confirm':
    case 'desktop.screen':
    case 'desktop.clipboard':
      return 'P0';
    case 'notifications.send':
    case 'share.invoke':
    case 'offline.queue':
    case 'device.profile':
    case 'device.pairing':
      return 'P1';
    default:
      return 'P2';
  }
}

export function targetEquivalent(target: ZavorthNativeRuntimeTarget): string {
  switch (target) {
    case 'satellite-pwa':
      return 'Browser-first Satellite/PWA capability bridge.';
    case 'desktop-companion':
      return 'Desktop companion host capability reporter.';
    case 'shared-device-runtime':
      return 'Shared Node/device mesh capability runtime.';
    case 'android-wrapper':
    case 'ios-wrapper':
    case 'macos-wrapper':
      return 'Owner-gated native wrapper ledger entry.';
    case 'macos-local-tts':
      return 'Optional local TTS runtime adapter.';
    default:
      return 'Zavorth native companion/device capability target.';
  }
}

export function capabilityBehavior(capabilityId: ZavorthNativeCapabilityId): string {
  switch (capabilityId) {
    case 'camera.capture':
      return 'Camera capture is available only through permissioned artifact-first device capability receipts.';
    case 'location.read':
      return 'Location read is available only through permissioned device capability receipts.';
    case 'notifications.send':
      return 'Notification send is simulated or permissioned and never default-live during certification.';
    case 'device.confirm':
      return 'Device confirmation requires trust or approval for sensitive actions.';
    case 'share.invoke':
      return 'Share sheet invocation is represented as an artifact-first device action.';
    case 'offline.queue':
      return 'Offline device actions are queued and replayable with receipts.';
    case 'haptics.vibrate':
      return 'Haptics are permissioned device capabilities and may be simulated when no live device is used.';
    case 'desktop.clipboard':
      return 'Desktop clipboard access is reported as capability availability and gated before reading values.';
    case 'desktop.screen':
      return 'Desktop screen access is reported as capability availability and gated before capture.';
    case 'desktop.notification':
      return 'Desktop notification capability is reported without sending live notifications during certification.';
    case 'local.tts.mlx':
      return 'Local MLX TTS is optional, approval-gated and never spawns by default.';
    case 'device.profile':
      return 'Device profile is represented by governed runtime metadata.';
    case 'device.pairing':
      return 'Device pairing is receipt-backed before capability invocation.';
    default:
      return `${capabilityId} is represented as a governed native companion/device capability.`;
  }
}

export function scenarioBehavior(id: ZavorthSemanticNativeCompanionDeviceCapabilityScenario['id']): string {
  switch (id) {
    case 'pwa-pairing-offline-queue':
      return 'PWA companion pairing and offline queue flow must complete locally with receipts.';
    case 'sensitive-device-confirm-blocked-without-trust':
      return 'Sensitive device confirmation must be blocked without trust or approval.';
    case 'desktop-screen-clipboard-report-only':
      return 'Desktop screen and clipboard capabilities must be report-only without live reads.';
    case 'optional-local-tts-blocked-without-approval':
      return 'Optional local TTS preview must be blocked without approval and spawn no process.';
    default:
      return 'Native companion/device scenario must pass.';
  }
}

export function scenarioEquivalent(id: ZavorthSemanticNativeCompanionDeviceCapabilityScenario['id']): string {
  switch (id) {
    case 'pwa-pairing-offline-queue':
      return 'Satellite bridge pairing, heartbeat and offline queue proof.';
    case 'sensitive-device-confirm-blocked-without-trust':
      return 'Sensitive approval probe denies untrusted device.confirm.';
    case 'desktop-screen-clipboard-report-only':
      return 'Desktop companion bridge reports gated capabilities only.';
    case 'optional-local-tts-blocked-without-approval':
      return 'MLX TTS preview receipt returns blocked without approval.';
    default:
      return 'Zavorth native companion/device scenario receipt.';
  }
}

export function countStatus(
  claims: ZavorthSemanticNativeCompanionDeviceCapabilityClaim[],
  status: ZavorthSemanticNativeCompanionDeviceCapabilityClaimStatus,
): number {
  return claims.filter((claim) => claim.status === status).length;
}

export function countPriority(
  claims: ZavorthSemanticNativeCompanionDeviceCapabilityClaim[],
  priority: ZavorthSemanticNativeCompanionDeviceCapabilityClaimPriority,
): number {
  return claims.filter((claim) => claim.priority === priority).length;
}

export function slug(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 96);
}
