import fs from 'fs';
import os from 'os';
import path from 'path';

import { SatelliteDeviceLivePlaneService } from '../../src/services/SatelliteDeviceLivePlaneService.js';
import { SatelliteDeviceLiveService } from '../../src/services/SatelliteDeviceLiveService.js';

describe('SatelliteDeviceLivePlaneService Phase 11', () => {
  let workspaceRoot: string;
  let tempRoot: string;

  beforeEach(async () => {
    workspaceRoot = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'zavorth-phase11-workspace-'));
    tempRoot = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'zavorth-phase11-state-'));
  });

  afterEach(async () => {
    await fs.promises.rm(workspaceRoot, { recursive: true, force: true });
    await fs.promises.rm(tempRoot, { recursive: true, force: true });
  });

  it('closes Phase 11 Satellite and device gates without live IO', () => {
    const snapshot = new SatelliteDeviceLivePlaneService({
      now: () => new Date('2026-05-05T00:11:00.000Z'),
    }).buildSnapshot();

    expect(snapshot.contractVersion).toBe('2026-05-05.live-phase-11');
    expect(snapshot.phase).toBe('Phase 11 - Satellite And Device Live Plane');
    expect(snapshot.status).toBe('closed');
    expect(snapshot.summary).toEqual(
      expect.objectContaining({
        targets: 5,
        pairingTargets: 3,
        heartbeatTargets: 3,
        cameraTargets: 2,
        geolocationTargets: 2,
        notificationTargets: 2,
        hapticTargets: 2,
        webAuthnTargets: 2,
        offlineQueueTargets: 2,
        deviceDoctorTargets: 3,
        bonjourDecisionTargets: 1,
        nativeWrapperDecisionTargets: 1,
        stagingLiveSmokeCommands: 5,
        redactedReceipts: 5,
        blocked: 0,
        deviceMarkedLiveWithoutPairing: false,
        sensitiveInvokeBypassesTrust: false,
        unsupportedNativeApisHidden: false,
        liveIoRequiredByPhase11Check: false,
        secretValuesSerialized: false,
      }),
    );
    expect(snapshot.policy).toEqual(
      expect.objectContaining({
        pairingClaimRequired: true,
        heartbeatRequired: true,
        sensitiveCommandsRequireDeviceTrust: true,
        cameraLocationConfirmationSmokeRequired: true,
        unsupportedNativeApisMustBeExplicit: true,
        offlineQueueRequired: true,
      }),
    );
  });

  it('pairs a browser phone and invokes camera, location and confirmation', async () => {
    const service = new SatelliteDeviceLiveService({
      workspaceRoot,
      tempRoot,
      now: () => new Date('2026-05-05T00:11:00.000Z'),
    });

    const proof = await service.runBrowserPhoneProof();

    expect(proof.ok).toBe(true);
    expect(proof.pairingClaimed).toBe(true);
    expect(proof.heartbeatAccepted).toBe(true);
    expect(proof.invokedCapabilityIds).toEqual(
      expect.arrayContaining(['camera.capture', 'location.read', 'device.confirm']),
    );
    expect(proof.completedCapabilityIds).toEqual(
      expect.arrayContaining(['camera.capture', 'location.read', 'device.confirm']),
    );
    expect(proof.receipt).toEqual(
      expect.objectContaining({
        liveIoPerformed: true,
        pairingCodeSerialized: false,
        sharedSecretSerialized: false,
        cameraLocationConfirmationProven: true,
      }),
    );
    expect(proof.secretValuesSerialized).toBe(false);
    expect(proof.cameraArtifactPath).toBeTruthy();
    expect(fs.existsSync(proof.cameraArtifactPath!)).toBe(true);
  });

  it('blocks sensitive device invokes unless the allowlist approves them', () => {
    const service = new SatelliteDeviceLiveService({
      workspaceRoot,
      tempRoot,
      now: () => new Date('2026-05-05T00:11:00.000Z'),
    });

    const probe = service.runSensitiveApprovalProbe();

    expect(probe.ok).toBe(true);
    expect(probe.blocked).toBe(true);
    expect(probe.capabilityId).toBe('camera.capture');
    expect(probe.policySource).toBe('registry-approved-capabilities');
    expect(probe.sensitiveInvokeBypassesTrust).toBe(false);
  });

  it('delivers offline queue work on the next heartbeat', () => {
    const service = new SatelliteDeviceLiveService({
      workspaceRoot,
      tempRoot,
      now: () => new Date('2026-05-05T00:11:00.000Z'),
    });

    const proof = service.runOfflineQueueProof();

    expect(proof.ok).toBe(true);
    expect(proof.queuedWhileOffline).toBe(true);
    expect(proof.deliveredOnHeartbeat).toBe(true);
    expect(proof.queuedInvocationId).toBeTruthy();
    expect(proof.claimedAssignmentIds.length).toBeGreaterThan(0);
    expect(proof.secretValuesSerialized).toBe(false);
  });

  it('keeps Bonjour and native-only APIs explicit', async () => {
    const service = new SatelliteDeviceLiveService({
      workspaceRoot,
      tempRoot,
      now: () => new Date('2026-05-05T00:11:00.000Z'),
    });

    const decision = service.buildNativeSupportDecision();
    const doctor = await service.runDeviceDoctorProof(['camera.capture', 'location.read', 'device.confirm', 'haptics.vibrate']);

    expect(decision).toEqual(
      expect.objectContaining({
        targetId: 'bonjour',
        status: 'explicit-native-wrapper-decision',
        unsupportedNativeApisHidden: false,
        secretValuesSerialized: false,
      }),
    );
    expect(decision.nativeOnly.bonjourDiscovery).toBe('native-wrapper-required-for-background-mdns');
    expect(doctor).toEqual(expect.objectContaining({ ok: true, secretValuesSerialized: false }));
  });
});
