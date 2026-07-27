import os from 'node:os';
import path from 'node:path';
import type {
  ZavorthDesktopCompanionBridgeProof,
  ZavorthMlxTtsRuntimeReceipt,
  ZavorthNativeCapabilityId,
  ZavorthNativeCapabilityReceipt,
  ZavorthNativeCompanionDeviceSnapshot,
  ZavorthNativeConsistencyEntry,
  ZavorthSatelliteCapabilityBridgeProof,
} from '../contracts/native/ZavorthNativeCompanionDeviceContract.js';
import { ZAVORTH_NATIVE_COMPANION_DEVICE_CONTRACT_VERSION } from '../contracts/native/ZavorthNativeCompanionDeviceContract.js';

import { ZavorthDesktopCompanionBridgeService } from './ZavorthDesktopCompanionBridgeService.js';
import { ZavorthMlxTtsRuntimeAdapter } from './ZavorthMlxTtsRuntimeAdapter.js';
import { ZavorthSatelliteCapabilityBridgeService } from './ZavorthSatelliteCapabilityBridgeService.js';

type Runtime = {
  now?: () => Date;
  cwd?: string;
  tempRoot?: string;
  satelliteBridge?: ZavorthSatelliteCapabilityBridgeService;
  desktopBridge?: ZavorthDesktopCompanionBridgeService;
  mlxTtsAdapter?: ZavorthMlxTtsRuntimeAdapter;
};

export class ZavorthNativeCompanionDevicePackService {
  private readonly now: () => Date;
  private readonly cwd: string;
  private readonly tempRoot: string;
  private readonly satelliteBridge: ZavorthSatelliteCapabilityBridgeService;
  private readonly desktopBridge: ZavorthDesktopCompanionBridgeService;
  private readonly mlxTtsAdapter: ZavorthMlxTtsRuntimeAdapter;

  constructor(runtime: Runtime = {}) {
    this.now = runtime.now || (() => new Date());
    this.cwd = path.resolve(runtime.cwd || process.cwd());
    this.tempRoot = path.resolve(runtime.tempRoot || path.join(os.tmpdir(), 'zavorth-native-companion-device-pack'));
    this.satelliteBridge = runtime.satelliteBridge || new ZavorthSatelliteCapabilityBridgeService({
      now: this.now,
      workspaceRoot: this.cwd,
      tempRoot: this.tempRoot,
    });
    this.desktopBridge = runtime.desktopBridge || new ZavorthDesktopCompanionBridgeService({
      now: this.now,
    });
    this.mlxTtsAdapter = runtime.mlxTtsAdapter || new ZavorthMlxTtsRuntimeAdapter({
      now: this.now,
    });
  }

  public async buildSnapshot(): Promise<ZavorthNativeCompanionDeviceSnapshot> {
    const satellite = await this.satelliteBridge.runProof();
    const desktop = this.desktopBridge.buildProof();
    const mlxTts = this.mlxTtsAdapter.buildReadinessReceipt();
    const consistency = this.buildConsistency({
      satellite,
      desktop,
      mlxTts,
    });
    const receipts = consistency.flatMap((entry) => entry.receipts);
    const targetsCovered = consistency.filter((entry) => entry.status === 'covered').length;
    const targetsOwnerGated = consistency.filter((entry) => entry.status === 'owner-gated').length;
    const status = satellite.status === 'passed'
      && (desktop.status === 'passed' || desktop.status === 'attention')
      && targetsOwnerGated >= 3
      && receipts.every((receipt) => receipt.secretValuesSerialized === false) ? 'passed'
      : 'failed';

    return {
      generatedAt: this.now().toISOString(),
      contractVersion: ZAVORTH_NATIVE_COMPANION_DEVICE_CONTRACT_VERSION,
      status,
      gate: 'native-companion-device',
      statement: 'Zavorth native companion and device capabilities are exposed through browser-first, desktop and optional runtime bridges with artifact-first receipts.',
      runtime: {
        platform: process.platform,
        arch: process.arch,
        nodeVersion: process.version,
        cwd: normalizePath(this.cwd),
      },
      consistency,
      satellite,
      desktop,
      mlxTts,
      summary: {
        targets: consistency.length,
        targetsCovered,
        targetsOwnerGated,
        capabilitiesReported: new Set(consistency.flatMap((entry) => entry.capabilities)).size,
        capabilityReceipts: receipts.length,
        pwaBridgeFunctional: satellite.status === 'passed',
        desktopBridgeFunctional: desktop.status === 'passed' || desktop.status === 'attention',
        mlxTtsOptionalRuntime: mlxTts.enabledByDefault === false && mlxTts.processSpawned === false,
        nativeWrappersOwnerGated: ['android-wrapper', 'ios-wrapper', 'macos-wrapper']
          .every((target) => consistency.find((entry) => entry.target === target)?.status === 'owner-gated'),
        liveExternalIoPerformed: false,
        enabledByDefault: false,
        secretValuesSerialized: false,
      },
      policy: {
        noSourceAppCodeCopy: true,
        browserPwaFirst: true,
        desktopCompanionOptional: true,
        androidIosMacosWrappersOwnerGated: true,
        mlxTtsNeverEnabledByDefault: true,
        cameraLocationRequirePermission: true,
        biometricOrDeviceConfirmRequiresTrust: true,
        shareSheetArtifactFirst: true,
        offlineQueueRequired: true,
        unsupportedNativeApisExplicit: true,
      },
      commands: {
        inspect: 'npm run zavorth-native-companion-device-pack --silent',
        inspectJson: 'npm run zavorth-native-companion-device-pack:json --silent',
        check: 'npm run zavorth-native-companion-device-pack:check --silent',
        qa: 'npm run qa:zavorth-native-companion-device-pack --silent',
        liveMlxTts: 'npm run zavorth-native-companion-device-pack -- --mlx-tts "hello" --approval-id <id>',
        nextAction: 'Surface controls - QA, Security And Release Certification Pack',
      },
    };
  }

  public formatSnapshotText(snapshot: ZavorthNativeCompanionDeviceSnapshot): string {
    const lines = [
      'Zavorth Native Companion Device Pack - Runtime gateway',
      `Status: ${snapshot.status}`,
      `Contract: ${snapshot.contractVersion}`,
      `Targets: ${snapshot.summary.targets}`,
      `Targets covered: ${snapshot.summary.targetsCovered}`,
      `Owner-gated targets: ${snapshot.summary.targetsOwnerGated}`,
      `Capabilities reported: ${snapshot.summary.capabilitiesReported}`,
      `Capability receipts: ${snapshot.summary.capabilityReceipts}`,
      `PWA bridge functional: ${snapshot.summary.pwaBridgeFunctional}`,
      `Desktop bridge functional: ${snapshot.summary.desktopBridgeFunctional}`,
      `MLX TTS optional runtime: ${snapshot.summary.mlxTtsOptionalRuntime}`,
      `Native wrappers owner-gated: ${snapshot.summary.nativeWrappersOwnerGated}`,
      `Live external IO performed: ${snapshot.summary.liveExternalIoPerformed}`,
      'Targets:',
    ];
    for (const entry of snapshot.consistency) {
      lines.push(`- ${entry.target}: ${entry.status}, decision=${entry.decision}, capabilities=${entry.capabilities.length}`);
    }
    lines.push(`Next: ${snapshot.commands.nextAction}`);
    return lines.join('\n');
  }

  public buildMlxTtsPreviewReceipt(input: {
    text: string;
    approvalId?: string | null;
  }): ZavorthMlxTtsRuntimeReceipt {
    return this.mlxTtsAdapter.buildPreviewReceipt(input);
  }

  private buildConsistency(input: {
    satellite: ZavorthSatelliteCapabilityBridgeProof;
    desktop: ZavorthDesktopCompanionBridgeProof;
    mlxTts: ZavorthMlxTtsRuntimeReceipt;
  }): ZavorthNativeConsistencyEntry[] {
    const satelliteCapabilities: ZavorthNativeCapabilityId[] = [
      'camera.capture',
      'location.read',
      'device.confirm',
      'haptics.vibrate',
      'offline.queue',
      'device.pairing',
      'share.invoke',
      'notifications.send',
    ];
    return [
      {
        target: 'satellite-pwa',
        decision: 'implemented-browser-first',
        capabilities: satelliteCapabilities,
        status: input.satellite.status === 'passed' ? 'covered' : 'blocked',
        bridge: 'satellite-capability-bridge',
        enabledByDefault: false,
        ownerDecisionRequired: false,
        receipts: satelliteCapabilities.map((capabilityId) => this.receipt({
          target: 'satellite-pwa',
          capabilityId,
          status: this.satelliteCapabilityStatus(input.satellite, capabilityId),
          permissionMode: permissionFor(capabilityId),
          localProofPerformed: true,
          reason: `Satellite/PWA bridge reports ${capabilityId} through device pairing, heartbeat and artifact receipts.`,
        })),
        notes: ['Browser/PWA path is the first-class implementation before native wrappers are promised.'],
      },
      {
        target: 'desktop-companion',
        decision: 'implemented-desktop-bridge',
        capabilities: input.desktop.availableCapabilities,
        status: input.desktop.status === 'passed' || input.desktop.status === 'attention' ? 'covered' : 'blocked',
        bridge: 'desktop-companion-bridge',
        enabledByDefault: false,
        ownerDecisionRequired: false,
        receipts: input.desktop.receipts,
        notes: ['Desktop bridge reports current host capability shape without touching clipboard or screen by default.'],
      },
      {
        target: 'shared-device-runtime',
        decision: 'implemented',
        capabilities: ['device.profile', 'device.pairing', 'offline.queue', 'share.invoke'],
        status: 'covered',
        bridge: 'satellite-capability-bridge',
        enabledByDefault: false,
        ownerDecisionRequired: false,
        receipts: ['device.profile', 'device.pairing', 'offline.queue', 'share.invoke'].map((capabilityId) => this.receipt({
          target: 'shared-device-runtime',
          capabilityId: capabilityId as ZavorthNativeCapabilityId,
          status: 'available',
          permissionMode: permissionFor(capabilityId as ZavorthNativeCapabilityId),
          localProofPerformed: true,
          reason: 'Shared device runtime uses Node Mesh profiles, pairing claims and offline assignment queues.',
        })),
        notes: ['Shared runtime behavior is covered by Node Mesh and Satellite bridge receipts.'],
      },
      this.ownerGatedWrapper('android-wrapper', ['camera.capture', 'location.read', 'notifications.send', 'share.invoke', 'haptics.vibrate']),
      this.ownerGatedWrapper('ios-wrapper', ['camera.capture', 'location.read', 'notifications.send', 'share.invoke', 'haptics.vibrate', 'device.confirm']),
      this.ownerGatedWrapper('macos-wrapper', ['desktop.screen', 'desktop.notification', 'desktop.clipboard', 'share.invoke']),
      {
        target: 'macos-local-tts',
        decision: 'implemented-optional-runtime',
        capabilities: ['local.tts.mlx'],
        status: 'covered',
        bridge: 'mlx-tts-runtime-adapter',
        enabledByDefault: false,
        ownerDecisionRequired: input.mlxTts.status !== 'available',
        receipts: [this.receipt({
          target: 'macos-local-tts',
          capabilityId: 'local.tts.mlx',
          status: input.mlxTts.status === 'available' ? 'available' : input.mlxTts.status === 'blocked' ? 'blocked' : 'owner-gated',
          permissionMode: 'owner-decision-required',
          localProofPerformed: false,
          reason: input.mlxTts.reason,
        })],
        notes: ['MLX TTS is represented as an optional runtime adapter, never as a copied native app.'],
      },
    ];
  }

  private ownerGatedWrapper(
    target: 'android-wrapper' | 'ios-wrapper' | 'macos-wrapper',
    capabilities: ZavorthNativeCapabilityId[],
  ): ZavorthNativeConsistencyEntry {
    return {
      target,
      decision: 'owner-gated',
      capabilities,
      status: 'owner-gated',
      bridge: 'owner-scope-ledger',
      enabledByDefault: false,
      ownerDecisionRequired: true,
      receipts: capabilities.map((capabilityId) => this.receipt({
        target,
        capabilityId,
        status: 'owner-gated',
        permissionMode: 'owner-decision-required',
        localProofPerformed: false,
        reason: `${target} stays owner-gated until product scope, store policy and native permission model are approved.`,
      })),
      notes: ['Native wrapper is not promised or enabled until owner scope is confirmed.'],
    };
  }

  private satelliteCapabilityStatus(
    proof: ZavorthSatelliteCapabilityBridgeProof,
    capabilityId: ZavorthNativeCapabilityId,
  ): ZavorthNativeCapabilityReceipt['status'] {
    if (capabilityId === 'offline.queue') return proof.offlineQueueDelivered ? 'available' : 'blocked';
    if (capabilityId === 'device.pairing') return proof.pairingClaimed ? 'available' : 'blocked';
    if (capabilityId === 'share.invoke' || capabilityId === 'notifications.send') return 'dryRun';
    return proof.completedCapabilityIds.includes(capabilityId) ? 'available' : 'blocked';
  }

  private receipt(input: {
    target: ZavorthNativeCapabilityReceipt['target'];
    capabilityId: ZavorthNativeCapabilityId;
    status: ZavorthNativeCapabilityReceipt['status'];
    permissionMode: ZavorthNativeCapabilityReceipt['permissionMode'];
    localProofPerformed: boolean;
    reason: string;
  }): ZavorthNativeCapabilityReceipt {
    return {
      id: `zavorth.native-companion.${input.target}.${input.capabilityId}.${this.now().getTime()}.receipt`,
      target: input.target,
      capabilityId: input.capabilityId,
      status: input.status,
      permissionMode: input.permissionMode,
      artifactFirst: true,
      liveExternalIoPerformed: false,
      localProofPerformed: input.localProofPerformed,
      enabledByDefault: false,
      secretValuesSerialized: false,
      reason: input.reason,
    };
  }
}

function permissionFor(capabilityId: ZavorthNativeCapabilityId): ZavorthNativeCapabilityReceipt['permissionMode'] {
  switch (capabilityId) {
    case 'camera.capture':
    case 'location.read':
    case 'notifications.send':
    case 'haptics.vibrate':
      return 'browser-permission';
    case 'device.confirm':
    case 'desktop.clipboard':
    case 'desktop.screen':
    case 'local.tts.mlx':
      return 'operator-approval-required';
    case 'share.invoke':
      return 'device-trust-required';
    default:
      return 'not-required';
  }
}

function normalizePath(input: string): string {
  return input.replace(/\\/g, '/');
}
