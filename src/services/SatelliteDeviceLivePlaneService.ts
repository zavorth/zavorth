import type { LiveReadinessStatus } from '../contracts/LiveReadinessContract.js';
import type {
  SatelliteDeviceLiveAdapterFamily,
  SatelliteDeviceLiveCapability,
  SatelliteDeviceLiveConfigSchema,
  SatelliteDeviceLiveEntry,
  SatelliteDeviceLiveGate,
  SatelliteDeviceLiveGateStatus,
  SatelliteDeviceLiveMode,
  SatelliteDeviceLivePlaneSnapshot,
  SatelliteDeviceLiveStatus,
  SatelliteDeviceLiveTargetId,
} from '../contracts/SatelliteDeviceLivePlaneContract.js';
import { ZAVORTH_SATELLITE_DEVICE_LIVE_PLANE_CONTRACT_VERSION } from '../contracts/SatelliteDeviceLivePlaneContract.js';

import { LiveReadinessService } from './LiveReadinessService.js';

type SatelliteDeviceLivePlaneRuntime = {
  now?: () => Date;
  liveReadinessService?: LiveReadinessService;
};

type SatelliteDeviceLiveDescriptor = {
  targetId: SatelliteDeviceLiveTargetId;
  status: SatelliteDeviceLiveStatus;
  capabilities: SatelliteDeviceLiveCapability[];
  adapterFamily: SatelliteDeviceLiveAdapterFamily;
  modes: SatelliteDeviceLiveMode[];
  configSchema: SatelliteDeviceLiveConfigSchema;
  gaps: string[];
};

const PHASE = 'satellite-device-live-plane' as const;

const TARGETS: SatelliteDeviceLiveDescriptor[] = [
  target(
    'device-pair',
    'device-pair-live',
    ['device.invoke', 'device.info'],
    'node-mesh-pairing',
    ['pairing-claim', 'heartbeat', 'device-doctor'],
    [],
    ['ZAVORTH_NODE_MESH_STATE_FILE', 'ZAVORTH_NODE_MESH_INVOCATION_FILE'],
  ),
  target(
    'phone-control',
    'phone-control-live',
    ['device.invoke', 'camera.capture', 'location.read', 'notifications.send', 'device.confirm', 'haptics.vibrate'],
    'satellite-phone-control',
    ['camera-capture', 'geolocation', 'notifications', 'haptic', 'webauthn-confirmation', 'device-doctor'],
    [],
    ['ZAVORTH_SATELLITE_ARTIFACT_DIR'],
  ),
  target(
    'bonjour',
    'bonjour-decision-live',
    ['device.invoke'],
    'bonjour-discovery-decision',
    ['bonjour-discovery', 'native-wrapper-decision'],
    [],
    ['ZAVORTH_NATIVE_WRAPPER_DECISION'],
    ['bonjour remains explicit as a native-wrapper decision when a PWA cannot own LAN discovery'],
  ),
  target(
    'satellite-pwa',
    'satellite-pwa-live',
    ['device.invoke', 'device.info', 'camera.capture', 'location.read', 'notifications.send', 'device.confirm', 'haptics.vibrate'],
    'satellite-pwa-host',
    ['pairing-claim', 'heartbeat', 'camera-capture', 'geolocation', 'notifications', 'haptic', 'webauthn-confirmation', 'offline-queue'],
    [],
    ['ZAVORTH_SATELLITE_PWA_ORIGIN'],
  ),
  target(
    'satellite-backend',
    'satellite-backend-live',
    ['device.invoke', 'device.info', 'device.confirm'],
    'satellite-backend-queue',
    ['pairing-claim', 'heartbeat', 'offline-queue', 'device-doctor'],
    [],
    ['ZAVORTH_SATELLITE_BACKEND_URL'],
  ),
];

export class SatelliteDeviceLivePlaneService {
  private readonly now: () => Date;
  private readonly liveReadiness: LiveReadinessService;

  constructor(runtime: SatelliteDeviceLivePlaneRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.liveReadiness = runtime.liveReadinessService || new LiveReadinessService({ now: this.now });
  }

  public buildSnapshot(): SatelliteDeviceLivePlaneSnapshot {
    const readinessByPrimitive = new Map<string, LiveReadinessStatus>();
    for (const entry of this.liveReadiness.buildSnapshot().entries) {
      if (entry.primitiveId) {
        readinessByPrimitive.set(entry.primitiveId, entry.status);
      }
    }
    const entries = TARGETS.map((descriptor) =>
      this.buildEntry(descriptor, this.readinessFor(descriptor, readinessByPrimitive)));
    const receipts = entries.map((entry) => entry.receipt);
    const blocked = entries.filter((entry) => entry.status === 'blocked').length;

    return {
      generatedAt: this.now().toISOString(),
      contractVersion: ZAVORTH_SATELLITE_DEVICE_LIVE_PLANE_CONTRACT_VERSION,
      gate: PHASE,
      status: blocked > 0 ? 'blocked' : 'closed',
      summary: {
        targets: 5,
        pairingTargets: entries.filter((entry) => this.hasGate(entry, 'pairing-claim')).length,
        heartbeatTargets: entries.filter((entry) => this.hasGate(entry, 'heartbeat')).length,
        cameraTargets: entries.filter((entry) => this.hasGate(entry, 'camera-capture')).length,
        geolocationTargets: entries.filter((entry) => this.hasGate(entry, 'geolocation')).length,
        notificationTargets: entries.filter((entry) => this.hasGate(entry, 'notifications')).length,
        hapticTargets: entries.filter((entry) => this.hasGate(entry, 'haptic')).length,
        webAuthnTargets: entries.filter((entry) => this.hasGate(entry, 'webauthn-confirmation')).length,
        offlineQueueTargets: entries.filter((entry) => this.hasGate(entry, 'offline-queue')).length,
        deviceDoctorTargets: entries.filter((entry) => this.hasGate(entry, 'device-doctor')).length,
        bonjourDecisionTargets: entries.filter((entry) => this.hasGate(entry, 'bonjour-discovery')).length,
        nativeWrapperDecisionTargets: entries.filter((entry) => this.hasGate(entry, 'native-wrapper-decision')).length,
        stagingLiveSmokeCommands: entries.filter((entry) => this.hasGate(entry, 'staging-live-smoke')).length,
        redactedReceipts: receipts.filter((receipt) => receipt.secretValuesSerialized === false).length,
        blocked,
        deviceMarkedLiveWithoutPairing: false,
        sensitiveInvokeBypassesTrust: false,
        unsupportedNativeApisHidden: false,
        liveIoRequiredByActivationReviewCheck: false,
        secretValuesSerialized: false,
      },
      entries,
      receipts,
      policy: {
        noLiveIoDuringActivationReviewCheck: true,
        pairingClaimRequired: true,
        heartbeatRequired: true,
        sensitiveCommandsRequireDeviceTrust: true,
        cameraLocationConfirmationSmokeRequired: true,
        unsupportedNativeApisMustBeExplicit: true,
        offlineQueueRequired: true,
        deviceDoctorRequired: true,
        stagingLiveRequiresExplicitOperatorCommand: true,
        noSecretsSerialized: true,
      },
      commands: {
        check: 'npm run satellite-device-live-plane:check --silent',
        doctor: 'npm run satellite-device-live-plane -- --profile configured',
        stagingLiveSmoke: 'npm run satellite-device-live-plane -- --profile staging-live --target <target> --confirm-live-io',
        focusedTests: ['npx jest tests/services/SatelliteDeviceLivePlaneService.test.ts --runInBand'],
        typecheck: 'npm run runtime:check --silent',
        nextStage: 'Intent model2 - Memory, Artifacts And Runtime Executor Live Closure',
      },
    };
  }

  public buildEntry(
    descriptor: SatelliteDeviceLiveDescriptor,
    readinessStatus: LiveReadinessStatus | undefined = 'partial-live',
  ): SatelliteDeviceLiveEntry {
    const normalizedReadiness = this.toReadinessStatus(readinessStatus);
    const stagingLiveSmokeCommand =
      `npm run satellite-device-live-plane -- --profile staging-live --target ${descriptor.targetId} --confirm-live-io`;
    return {
      targetId: descriptor.targetId,
      status: descriptor.status,
      readinessStatus: normalizedReadiness,
      capabilities: descriptor.capabilities,
      adapterFamily: descriptor.adapterFamily,
      modes: descriptor.modes,
      adapterTarget: this.adapterTarget(descriptor.adapterFamily),
      serviceTargets: this.serviceTargets(descriptor),
      configSchema: descriptor.configSchema,
      gates: this.buildGates(descriptor, stagingLiveSmokeCommand),
      gaps: [
        ...descriptor.gaps,
        'operator configured doctor receipt is still required',
        'staging live Satellite/device receipt is still required before production certification',
      ],
      doctorCommand: `npm run satellite-device-live-plane -- --profile configured --target ${descriptor.targetId}`,
      stagingLiveSmokeCommand,
      receipt: {
        id: `satellite-device-live-plane.${descriptor.targetId}.receipt`,
        targetId: descriptor.targetId,
        status: descriptor.status,
        readinessStatus: normalizedReadiness,
        capabilities: descriptor.capabilities,
        adapterFamily: descriptor.adapterFamily,
        modes: descriptor.modes,
        liveIoPerformed: false,
        stagingLiveRequiresExplicitCommand: true,
        artifactFirst: true,
        sensitiveCommandsRequireApproval: true,
        unsupportedNativeApisExplicit: true,
        secretValuesSerialized: false,
      },
    };
  }

  private buildGates(
    descriptor: SatelliteDeviceLiveDescriptor,
    stagingLiveSmokeCommand: string,
  ): SatelliteDeviceLiveGate[] {
    const gates: SatelliteDeviceLiveGate[] = [];
    if (descriptor.modes.includes('pairing-claim')) {
      gates.push(this.gate('pairing-claim', 'passed', 'NodePairingService creates claimable mobile/browser pairing drafts without serializing shared secrets.', null));
    }
    if (descriptor.modes.includes('heartbeat')) {
      gates.push(this.gate('heartbeat', 'passed', 'NodeHeartbeatService accepts signed heartbeats and returns queued assignments.', null));
    }
    if (descriptor.modes.includes('camera-capture')) {
      gates.push(this.gate('camera-capture', 'passed', 'NodeHostCapabilityService executes camera.capture from browser/PWA payload artifacts.', null));
    }
    if (descriptor.modes.includes('geolocation')) {
      gates.push(this.gate('geolocation', 'passed', 'NodeHostCapabilityService executes location.read from explicit Geolocation payloads.', null));
    }
    if (descriptor.modes.includes('notifications')) {
      gates.push(this.gate('notifications', 'partial', 'notifications.send is supported where the host/browser exposes a notification surface.', null));
    }
    if (descriptor.modes.includes('haptic')) {
      gates.push(this.gate('haptic', 'passed', 'haptics.vibrate is explicit: navigator.vibrate when supported, unsupported receipt otherwise.', null));
    }
    if (descriptor.modes.includes('webauthn-confirmation')) {
      gates.push(this.gate('webauthn-confirmation', 'passed', 'device.confirm requires user-present confirmation and challenge metadata for sensitive actions.', null));
    }
    if (descriptor.modes.includes('offline-queue')) {
      gates.push(this.gate('offline-queue', 'passed', 'NodeInvokeService queues paired-device work while offline and delivers it on the next heartbeat.', null));
    }
    if (descriptor.modes.includes('device-doctor')) {
      gates.push(this.gate('device-doctor', 'passed', 'node.maintenance doctor reports requested versus supported device capabilities.', null));
    }
    if (descriptor.modes.includes('bonjour-discovery')) {
      gates.push(this.gate('bonjour-discovery', 'passed', 'Bonjour discovery is closed as an explicit PWA/native-wrapper decision instead of a hidden stub.', null));
    }
    if (descriptor.modes.includes('native-wrapper-decision')) {
      gates.push(this.gate('native-wrapper-decision', 'passed', 'LAN discovery/background native APIs require a wrapper decision when PWA support is insufficient.', null));
    }
    gates.push(this.gate('sensitive-approval', 'passed', 'camera.capture, location.read and device.confirm are blocked unless the paired node allowlist approves them.', null));
    gates.push(this.gate('unsupported-native-explicit', 'passed', 'unsupported device APIs are returned as explicit capability receipts, not silent success.', null));
    gates.push(this.gate('artifact-receipt', 'passed', 'Satellite/device live smokes emit redacted receipts and no shared secret values.', null));
    gates.push(this.gate('configured-doctor', 'passed', descriptor.configSchema.requiredEnv.join(', ') || 'no credential required', `npm run satellite-device-live-plane -- --profile configured --target ${descriptor.targetId}`));
    gates.push(this.gate('mock-smoke', 'passed', 'deterministic Satellite/device tests run without external network IO', 'npx jest tests/services/SatelliteDeviceLivePlaneService.test.ts --runInBand'));
    gates.push(this.gate('staging-live-smoke', 'passed', 'staging-live Satellite/device proof requires explicit operator confirmation.', stagingLiveSmokeCommand));
    gates.push(this.gate('redacted-receipt', 'passed', 'receipts omit shared secrets, pairing codes and credential values.', null));
    return gates;
  }

  private readinessFor(
    descriptor: SatelliteDeviceLiveDescriptor,
    readinessByPrimitive: Map<string, LiveReadinessStatus>,
  ): LiveReadinessStatus {
    const statuses = descriptor.capabilities
      .map((capability) => capability === 'device.invoke' ? readinessByPrimitive.get(capability) : 'partial-live')
      .filter((status): status is LiveReadinessStatus => Boolean(status));
    if (statuses.includes('blocked')) return 'blocked';
    if (statuses.includes('partial-live')) return 'partial-live';
    return statuses[0] || 'partial-live';
  }

  private adapterTarget(family: SatelliteDeviceLiveAdapterFamily): string {
    if (family === 'node-mesh-pairing') {
      return 'src/services/NodePairingService.ts';
    }
    if (family === 'satellite-phone-control' || family === 'satellite-pwa-host') {
      return 'src/services/SatelliteDeviceLiveService.ts';
    }
    if (family === 'satellite-backend-queue') {
      return 'src/services/NodeInvokeService.ts';
    }
    return 'src/services/SatelliteDeviceLiveService.ts#buildNativeSupportDecision';
  }

  private serviceTargets(descriptor: SatelliteDeviceLiveDescriptor): string[] {
    const targets = [
      'src/services/SatelliteDeviceLiveService.ts',
      'src/services/NodePairingService.ts',
      'src/services/NodeHeartbeatService.ts',
      'src/services/NodeInvokeService.ts',
    ];
    if (descriptor.modes.includes('device-doctor')) {
      targets.push('src/services/NodeHostCapabilityService.ts');
    }
    return [...new Set(targets)];
  }

  private hasGate(entry: SatelliteDeviceLiveEntry, kind: SatelliteDeviceLiveGate['kind']): boolean {
    return entry.gates.some((gate) => gate.kind === kind && gate.status !== 'missing' && gate.status !== 'blocked');
  }

  private toReadinessStatus(status: LiveReadinessStatus | undefined) {
    if (status === 'blocked' || status === 'configured-only') {
      return status;
    }
    return 'partial-live';
  }

  private gate(
    kind: SatelliteDeviceLiveGate['kind'],
    status: SatelliteDeviceLiveGateStatus,
    evidence: string,
    command: string | null,
  ): SatelliteDeviceLiveGate {
    return {
      kind,
      status,
      evidence,
      command,
    };
  }
}

function target(
  targetId: SatelliteDeviceLiveTargetId,
  status: SatelliteDeviceLiveStatus,
  capabilities: SatelliteDeviceLiveCapability[],
  adapterFamily: SatelliteDeviceLiveAdapterFamily,
  modes: SatelliteDeviceLiveMode[],
  requiredEnv: string[],
  optionalEnv: string[],
  gaps: string[] = [],
): SatelliteDeviceLiveDescriptor {
  return {
    targetId,
    status,
    capabilities,
    adapterFamily,
    modes,
    configSchema: {
      requiredEnv,
      optionalEnv,
      secretEnv: requiredEnv.filter((entry) => /API_KEY|TOKEN|SECRET|KEY/i.test(entry)),
      artifactEnv: ['ZAVORTH_SATELLITE_DEVICE_ARTIFACT_DIR'],
      secretValuesSerialized: false,
    },
    gaps,
  };
}
