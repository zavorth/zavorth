import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ZavorthDesktopCompanionBridgeService } from '../../src/services/ZavorthDesktopCompanionBridgeService.js';
import { ZavorthMlxTtsRuntimeAdapter } from '../../src/services/ZavorthMlxTtsRuntimeAdapter.js';
import { ZavorthNativeCompanionDevicePackService } from '../../src/services/ZavorthNativeCompanionDevicePackService.js';
import { ZavorthSatelliteCapabilityBridgeService } from '../../src/services/ZavorthSatelliteCapabilityBridgeService.js';

describe('ZavorthNativeCompanionDevicePackService Runtime gateway', () => {
  const now = () => new Date('2026-05-05T18:00:00.000Z');
  let tempRoot: string;

  beforeEach(() => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-native-companion-device-pack-'));
  });

  afterEach(() => {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  it('proves the Satellite/PWA bridge with pairing, camera, location, confirmation and offline queue', async () => {
    const proof = await new ZavorthSatelliteCapabilityBridgeService({
      now,
      tempRoot,
      workspaceRoot: tempRoot,
    }).runProof();

    expect(proof.status).toBe('passed');
    expect(proof.pairingClaimed).toBe(true);
    expect(proof.heartbeatAccepted).toBe(true);
    expect(proof.completedCapabilityIds).toEqual(expect.arrayContaining([
      'camera.capture',
      'location.read',
      'device.confirm',
      'haptics.vibrate',
    ]));
    expect(proof.cameraArtifactPath).toEqual(expect.stringContaining('.camera.png'));
    expect(proof.sensitiveApprovalBlocked).toBe(true);
    expect(proof.offlineQueueDelivered).toBe(true);
    expect(proof.receipt).toEqual(expect.objectContaining({
      artifactFirst: true,
      liveExternalIoPerformed: false,
      localProofPerformed: true,
      secretValuesSerialized: false,
    }));
  });

  it('reports desktop companion capabilities without touching screen or clipboard', () => {
    const proof = new ZavorthDesktopCompanionBridgeService({
      now,
      platform: 'win32',
    }).buildProof();

    expect(proof.status).toBe('passed');
    expect(proof.profileId).toBe('desktop-companion');
    expect(proof.availableCapabilities).toEqual(expect.arrayContaining([
      'desktop.screen',
      'desktop.notification',
      'desktop.clipboard',
    ]));
    expect(proof.gatedCapabilities).toEqual(expect.arrayContaining([
      'desktop.screen',
      'desktop.clipboard',
    ]));
    expect(proof.receipts.every((receipt) => receipt.liveExternalIoPerformed === false)).toBe(true);
  });

  it('keeps MLX TTS optional and disabled by default', () => {
    const unsupported = new ZavorthMlxTtsRuntimeAdapter({
      now,
      platform: 'win32',
      env: {},
    }).buildReadinessReceipt();
    const configured = new ZavorthMlxTtsRuntimeAdapter({
      now,
      platform: 'darwin',
      env: {
        ZAVORTH_MLX_TTS_COMMAND: 'secret-command-value-is-not-serialized',
      },
    }).buildReadinessReceipt();
    const blockedPreview = new ZavorthMlxTtsRuntimeAdapter({
      now,
      platform: 'darwin',
      env: {
        ZAVORTH_MLX_TTS_COMMAND: 'secret-command-value-is-not-serialized',
      },
    }).buildPreviewReceipt({
      text: 'hello',
    });

    expect(unsupported).toEqual(expect.objectContaining({
      status: 'unsupported',
      processSpawned: false,
      enabledByDefault: false,
    }));
    expect(configured).toEqual(expect.objectContaining({
      status: 'available',
      commandRef: 'ZAVORTH_MLX_TTS_COMMAND',
      processSpawned: false,
      enabledByDefault: false,
    }));
    expect(JSON.stringify(configured)).not.toContain('secret-command-value-is-not-serialized');
    expect(blockedPreview.status).toBe('blocked');
    expect(blockedPreview.processSpawned).toBe(false);
  });

  it('emits a passing Runtime gateway native companion/device snapshot', async () => {
    const service = new ZavorthNativeCompanionDevicePackService({
      now,
      cwd: tempRoot,
      tempRoot,
      desktopBridge: new ZavorthDesktopCompanionBridgeService({
        now,
        platform: 'win32',
      }),
      mlxTtsAdapter: new ZavorthMlxTtsRuntimeAdapter({
        now,
        platform: 'win32',
        env: {},
      }),
    });
    const snapshot = await service.buildSnapshot();
    const text = service.formatSnapshotText(snapshot);

    expect(snapshot.status).toBe('passed');
    expect(snapshot.phase).toBe(6);
    expect(snapshot.summary).toEqual(expect.objectContaining({
      targets: 7,
      targetsCovered: 4,
      targetsOwnerGated: 3,
      pwaBridgeFunctional: true,
      desktopBridgeFunctional: true,
      mlxTtsOptionalRuntime: true,
      nativeWrappersOwnerGated: true,
      liveExternalIoPerformed: false,
      enabledByDefault: false,
      secretValuesSerialized: false,
    }));
    expect(snapshot.consistency).toEqual(expect.arrayContaining([
      expect.objectContaining({
        target: 'satellite-pwa',
        status: 'covered',
      }),
      expect.objectContaining({
        target: 'android-wrapper',
        status: 'owner-gated',
      }),
      expect.objectContaining({
        target: 'ios-wrapper',
        status: 'owner-gated',
      }),
      expect.objectContaining({
        target: 'macos-wrapper',
        status: 'owner-gated',
      }),
    ]));
    expect(snapshot.policy).toEqual(expect.objectContaining({
      browserPwaFirst: true,
      androidIosMacosWrappersOwnerGated: true,
      mlxTtsNeverEnabledByDefault: true,
      unsupportedNativeApisExplicit: true,
    }));
    expect(snapshot.commands.nextStage).toBe('Surface controls - QA, Security And Release Certification Pack');
    expect(text).toContain('Zavorth Native Companion Device Pack - Runtime gateway');
    expect(text).toContain('Next: Surface controls - QA, Security And Release Certification Pack');
  });
});
