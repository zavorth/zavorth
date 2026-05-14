import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ZavorthSemanticNativeCompanionDeviceCapabilityCertificationService } from '../../src/services/ZavorthSemanticNativeCompanionDeviceCapabilityCertificationService.js';

describe('ZavorthSemanticNativeCompanionDeviceCapabilityCertificationService S6', () => {
  const now = () => new Date('2026-05-05T19:00:00.000Z');
  let tempRoot: string;

  beforeEach(() => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-semantic-native-companion-device-'));
  });

  afterEach(() => {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  it('certifies S6 native companion/device semantics without live device IO or secret serialization', async () => {
    const snapshot = await new ZavorthSemanticNativeCompanionDeviceCapabilityCertificationService({
      now,
      cwd: tempRoot,
      tempRoot,
    }).buildSnapshot();

    expect(snapshot.status).toBe('passed');
    expect(snapshot.semanticPhase).toBe('S6');
    expect(snapshot.packStatus).toBe('passed');
    expect(snapshot.summary).toEqual(expect.objectContaining({
      gaps: 0,
      targetClaimsCertified: 7,
      capabilityClaimsCertified: 13,
      bridgeClaimsCertified: 3,
      permissionPoliciesCertified: 8,
      wrapperGateClaimsCertified: 3,
      optionalRuntimeClaimsCertified: 1,
      scenariosPassed: 4,
      liveExternalIoPerformed: false,
      enabledByDefault: false,
      processSpawnedByDefault: false,
      secretValuesSerialized: false,
      sourceCodeCopied: false,
    }));
    expect(snapshot.summary.receiptBackedClaims).toBe(snapshot.summary.semanticClaims);
    expect(snapshot.policy).toEqual(expect.objectContaining({
      browserPwaFirst: true,
      desktopCompanionOptional: true,
      androidIosMacosWrappersOwnerGated: true,
      mlxTtsNeverEnabledByDefault: true,
      cameraLocationRequirePermission: true,
      sensitiveDeviceConfirmRequiresTrust: true,
      screenClipboardReportOnlyWithoutApproval: true,
      noLiveIoDuringCertification: true,
      rawSecretValuesRejected: true,
      defaultNativeAccessRejected: true,
    }));
  });

  it('keeps target and capability decisions explicit by semantic status', async () => {
    const snapshot = await new ZavorthSemanticNativeCompanionDeviceCapabilityCertificationService({
      now,
      cwd: tempRoot,
      tempRoot,
    }).buildSnapshot();

    expect(targetClaim(snapshot, 'satellite-pwa')).toEqual(expect.objectContaining({
      status: 'covered',
      priority: 'P0',
    }));
    expect(targetClaim(snapshot, 'desktop-companion')).toEqual(expect.objectContaining({
      status: 'covered',
      priority: 'P0',
    }));
    expect(targetClaim(snapshot, 'android-wrapper')).toEqual(expect.objectContaining({
      status: 'owner-gated',
      priority: 'P1',
    }));
    expect(targetClaim(snapshot, 'ios-wrapper')).toEqual(expect.objectContaining({
      status: 'owner-gated',
    }));
    expect(targetClaim(snapshot, 'macos-wrapper')).toEqual(expect.objectContaining({
      status: 'owner-gated',
    }));
    expect(capabilityClaim(snapshot, 'camera.capture')).toEqual(expect.objectContaining({
      status: 'covered',
      priority: 'P0',
      permissionMode: 'browser-permission',
    }));
    expect(capabilityClaim(snapshot, 'desktop.screen')).toEqual(expect.objectContaining({
      status: 'covered',
      priority: 'P0',
      permissionMode: 'operator-approval-required',
    }));
    expect(capabilityClaim(snapshot, 'local.tts.mlx')).toEqual(expect.objectContaining({
      status: 'owner-gated',
      capabilityStatus: 'owner-gated',
      permissionMode: 'owner-decision-required',
    }));
  });

  it('certifies guarded scenarios for PWA, sensitive confirmation, desktop data and local TTS', async () => {
    const snapshot = await new ZavorthSemanticNativeCompanionDeviceCapabilityCertificationService({
      now,
      cwd: tempRoot,
      tempRoot,
    }).buildSnapshot();
    const scenarios = Object.fromEntries(snapshot.scenarios.map((scenario) => [scenario.id, scenario]));

    expect(scenarios['pwa-pairing-offline-queue']).toEqual(expect.objectContaining({
      status: 'passed',
      liveExternalIoPerformed: false,
      processSpawned: false,
    }));
    expect(scenarios['sensitive-device-confirm-blocked-without-trust']).toEqual(expect.objectContaining({
      status: 'passed',
      secretValuesSerialized: false,
    }));
    expect(scenarios['desktop-screen-clipboard-report-only']).toEqual(expect.objectContaining({
      status: 'passed',
      liveExternalIoPerformed: false,
    }));
    expect(scenarios['optional-local-tts-blocked-without-approval']).toEqual(expect.objectContaining({
      status: 'passed',
      processSpawned: false,
    }));
  });

  it('rejects unsafe native/device behavior by policy instead of enabling it', async () => {
    const snapshot = await new ZavorthSemanticNativeCompanionDeviceCapabilityCertificationService({
      now,
      cwd: tempRoot,
      tempRoot,
    }).buildSnapshot();

    const unsafeClaims = snapshot.claims.filter((claim) => claim.kind === 'unsafe-native-policy');
    expect(unsafeClaims).toHaveLength(4);
    expect(unsafeClaims.every((claim) => claim.status === 'rejected')).toBe(true);
    expect(snapshot.claims).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'unsafe-native-policy',
        status: 'rejected',
        expectedBehavior: 'The architecture must reject default-on native device access.',
      }),
      expect.objectContaining({
        kind: 'unsafe-native-policy',
        status: 'rejected',
        expectedBehavior: 'The architecture must reject native wrapper activation without owner decision.',
      }),
    ]));
  });

  it('formats a readable S6 operator summary', async () => {
    const service = new ZavorthSemanticNativeCompanionDeviceCapabilityCertificationService({
      now,
      cwd: tempRoot,
      tempRoot,
    });
    const text = service.formatSnapshotText(await service.buildSnapshot());

    expect(text).toContain('Zavorth Semantic Native Companion Device Capability Certification - S6');
    expect(text).toContain('Status: passed');
    expect(text).toContain('Next: S7 - QA, Security And Release Certification Semantics');
  });
});

type Snapshot = Awaited<ReturnType<ZavorthSemanticNativeCompanionDeviceCapabilityCertificationService['buildSnapshot']>>;

function targetClaim(snapshot: Snapshot, target: string) {
  const claim = snapshot.claims.find((entry) =>
    entry.kind === 'target-coverage' && entry.target === target,
  );
  if (!claim) {
    throw new Error(`missing target claim ${target}`);
  }
  return claim;
}

function capabilityClaim(snapshot: Snapshot, capabilityId: string) {
  const claim = snapshot.claims.find((entry) =>
    entry.kind === 'capability-coverage' && entry.capabilityId === capabilityId,
  );
  if (!claim) {
    throw new Error(`missing capability claim ${capabilityId}`);
  }
  return claim;
}
