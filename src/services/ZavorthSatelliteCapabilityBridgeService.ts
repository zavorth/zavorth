import os from 'node:os';
import path from 'node:path';
import type {
  ZavorthNativeCapabilityId,
  ZavorthSatelliteCapabilityBridgeProof,
} from '../contracts/native/ZavorthNativeCompanionDeviceContract.js';
import { SatelliteDeviceLiveService } from './SatelliteDeviceLiveService.js';

type Runtime = {
  now?: () => Date;
  workspaceRoot?: string;
  tempRoot?: string;
  satelliteService?: SatelliteDeviceLiveService;
};

const REQUIRED_PWA_CAPABILITIES: ZavorthNativeCapabilityId[] = [
  'camera.capture',
  'location.read',
  'device.confirm',
  'haptics.vibrate',
  'offline.queue',
  'device.pairing',
];

export class ZavorthSatelliteCapabilityBridgeService {
  private readonly now: () => Date;
  private readonly satelliteService: SatelliteDeviceLiveService;

  constructor(runtime: Runtime = {}) {
    this.now = runtime.now || (() => new Date());
    this.satelliteService = runtime.satelliteService || new SatelliteDeviceLiveService({
      now: this.now,
      workspaceRoot: runtime.workspaceRoot || process.cwd(),
      tempRoot: runtime.tempRoot || path.join(os.tmpdir(), 'zavorth-native-companion-device-pack'),
    });
  }

  public async runProof(): Promise<ZavorthSatelliteCapabilityBridgeProof> {
    const phone = await this.satelliteService.runBrowserPhoneProof({
      label: 'Zavorth Native Companion Device Pack',
      approvedCapabilityIds: [
        'device.info',
        'camera.capture',
        'location.read',
        'device.confirm',
        'haptics.vibrate',
      ],
      includeHaptic: true,
    });
    const approval = this.satelliteService.runSensitiveApprovalProbe();
    const offline = this.satelliteService.runOfflineQueueProof();
    const doctor = await this.satelliteService.runDeviceDoctorProof([
      'device.info',
      'camera.capture',
      'location.read',
      'notifications.send',
      'haptics.vibrate',
    ]);
    const completed = new Set(phone.completedCapabilityIds);
    const requiredCompleted = REQUIRED_PWA_CAPABILITIES
      .filter((capabilityId) => capabilityId !== 'offline.queue' && capabilityId !== 'device.pairing')
      .every((capabilityId) => completed.has(capabilityId));
    const status = phone.ok
      && approval.ok
      && offline.ok
      && doctor.ok === true
      && requiredCompleted
      ? 'passed'
      : 'failed';

    return {
      status,
      nodeId: phone.nodeId,
      pairingClaimed: phone.pairingClaimed,
      heartbeatAccepted: phone.heartbeatAccepted,
      queuedInvocationIds: phone.queuedInvocationIds,
      claimedAssignmentIds: phone.claimedAssignmentIds,
      completedCapabilityIds: phone.completedCapabilityIds,
      cameraArtifactPath: phone.cameraArtifactPath,
      sensitiveApprovalBlocked: approval.blocked,
      offlineQueueDelivered: offline.deliveredOnHeartbeat,
      deviceDoctorOk: doctor.ok === true,
      unsupportedNativeApisExplicit: true,
      secretValuesSerialized: false,
      receipt: {
        id: `zavorth.native-companion.satellite.${phone.nodeId}.receipt`,
        artifactFirst: true,
        liveExternalIoPerformed: false,
        localProofPerformed: true,
        secretValuesSerialized: false,
      },
    };
  }
}
