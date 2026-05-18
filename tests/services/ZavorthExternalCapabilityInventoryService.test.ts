import {
  ZAVORTH_EXTERNAL_CAPABILITY_INVENTORY_CONTRACT_VERSION,
} from '../../src/contracts/ZavorthExternalCapabilityInventoryContract.js';
import { ZavorthExternalCapabilityInventoryService } from '../../src/services/ZavorthExternalCapabilityInventoryService.js';

type FakeFsOptions = {
  wslPresent?: boolean;
};

const ROOTS = {
  project: 'C:\\fixtures\\zavorth',
  referenceRuntime: 'C:\\fixtures\\reference-runtime',
  compatibilitySidecar: 'C:\\fixtures\\acp-compatible-sidecar',
  compatibilityFixture: '\\\\wsl.localhost\\Ubuntu-24.04\\home\\grey\\acp-compatible-sidecar-src',
};

describe('ZavorthExternalCapabilityInventoryService Phase 0', () => {
  it('publishes a read-only Phase 0 inventory across Reference runtime, ACP-compatible sidecar Windows, and ACP compatibility fixture', () => {
    const service = createService();
    const snapshot = service.buildSnapshot();

    expect(snapshot).toEqual(expect.objectContaining({
      generatedAt: '2026-05-11T18:00:00.000Z',
      contractVersion: ZAVORTH_EXTERNAL_CAPABILITY_INVENTORY_CONTRACT_VERSION,
      status: 'inventory-ready',
      planId: '291 - Plano Zavorth External Runtime Absorption',
      phase: 'phase-0-freeze-and-inventory',
      bridgeStatus: 'bridge-ready',
    }));
    expect(snapshot.sourceProbes.map((entry) => entry.runtimeId)).toEqual([
      'reference-runtime',
      'acp-compatible-sidecar',
      'acp-compatibility-fixture',
    ]);
    expect(snapshot.sourceProbes.every((entry) => entry.availability === 'source-present')).toBe(true);
    expect(snapshot.sourceProbes.find((entry) => entry.runtimeId === 'acp-compatibility-fixture')).toEqual(expect.objectContaining({
      required: false,
      rootPath: ROOTS.compatibilityFixture,
      present: true,
    }));
    expect(snapshot.decisionSummary).toEqual(expect.objectContaining({
      total: 14,
      absorb: 5,
      adapt: 7,
      externalize: 1,
      replace: 0,
      reject: 1,
      approvalRequiredForLive: 6,
      sourcePathMissing: 0,
    }));
    expect(snapshot.safety).toEqual(expect.objectContaining({
      executionPerformed: false,
      sourceRuntimeCodeExecuted: false,
      dependencyInstallPerformed: false,
      sidecarsStarted: false,
      toolsExposed: false,
      publicIdentityLeak: false,
    }));
  });

  it('keeps every imported idea advisory, Zavorth-owned, and behind provenance gates', () => {
    const snapshot = createService().buildSnapshot();

    expect(snapshot.freezePolicy).toEqual(expect.objectContaining({
      noRuntimeMixing: true,
      noSourceRuntimeNamingAsPublicIdentity: true,
      noImplementationBeyondReadOnlyInventory: true,
      sourceNamesAllowedOnlyInDiagnostics: true,
      importedCapabilitiesAdvisoryOnly: true,
      nextPhaseRequiresContractLayer: true,
    }));
    expect(snapshot.items.every((entry) => (
      entry.zavorthEquivalent.publicName === 'Zavorth'
      && entry.securityBoundary.readOnlyInventoryOnly
      && entry.securityBoundary.noImplementationCopied
      && entry.securityBoundary.noSourceRuntimeCodeExecution
      && entry.securityBoundary.noDirectToolExposure
      && entry.securityBoundary.noExternalReplyBypass
      && entry.acceptanceGate.length > 0
      && entry.sourcePaths.length > 0
    ))).toBe(true);
    expect(snapshot.items.find((entry) => entry.id === 'reference-runtime:skill-curator')).toEqual(expect.objectContaining({
      decision: 'absorb',
      risk: 'high',
      naturalFirstRoute: 'approval-proposal',
      securityBoundary: expect.objectContaining({ approvalRequiredForLive: true }),
    }));
    expect(snapshot.items.find((entry) => entry.id === 'acp-compatible-sidecar:channel-gateway-normalization')).toEqual(expect.objectContaining({
      decision: 'adapt',
      targetPhase: 'phase-5-channels-messaging',
      naturalFirstRoute: 'capability-discovery',
    }));
  });

  it('does not block inventory readiness when only the optional ACP compatibility fixture clone is absent', () => {
    const snapshot = createService({ wslPresent: false }).buildSnapshot();
    const wslProbe = snapshot.sourceProbes.find((entry) => entry.runtimeId === 'acp-compatibility-fixture');

    expect(snapshot.status).toBe('inventory-ready');
    expect(wslProbe).toEqual(expect.objectContaining({
      required: false,
      present: false,
      availability: 'docs-only',
    }));
  });

  it('blocks the inventory if the Phase 10 bridge is blocked', () => {
    const snapshot = createService().buildSnapshot({ bridgeStatus: 'blocked' });

    expect(snapshot.status).toBe('blocked');
    expect(snapshot.bridgeStatus).toBe('blocked');
    expect(snapshot.commands.nextPhase).toBe('291 Phase 1 - Zavorth Contract Layer');
  });

  it('formats an operator inventory without enabling runtimes or tools', () => {
    const service = createService();
    const text = service.formatSnapshotText(service.buildSnapshot());

    expect(text).toContain('Zavorth External Runtime Phase 0 Inventory');
    expect(text).toContain('Status: inventory-ready');
    expect(text).toContain('acp-compatibility-fixture: source-present');
    expect(text).toContain('Execution performed: false');
    expect(text).toContain('Next: 291 Phase 1 - Zavorth Contract Layer');
  });
});

function createService(options: FakeFsOptions = {}): ZavorthExternalCapabilityInventoryService {
  const fakeExists = (target: string): boolean => {
    const normalized = normalize(target);
    const project = normalize(ROOTS.project);
    const referenceRuntime = normalize(ROOTS.referenceRuntime);
    const compatibilitySidecar = normalize(ROOTS.compatibilitySidecar);
    const compatibilityFixture = normalize(ROOTS.compatibilityFixture);
    if (normalized.startsWith(`${project}/docs/`)) return true;
    if (normalized === referenceRuntime || normalized.startsWith(`${referenceRuntime}/`)) return true;
    if (normalized === compatibilitySidecar || normalized.startsWith(`${compatibilitySidecar}/`)) return true;
    if (options.wslPresent === false) return false;
    return normalized === compatibilityFixture || normalized.startsWith(`${compatibilityFixture}/`);
  };

  return new ZavorthExternalCapabilityInventoryService({
    now: () => new Date('2026-05-11T18:00:00.000Z'),
    projectRoot: ROOTS.project,
    referenceRuntimeRoot: ROOTS.referenceRuntime,
    compatibilitySidecarRoot: ROOTS.compatibilitySidecar,
    compatibilityFixtureRoot: ROOTS.compatibilityFixture,
    existsSync: fakeExists as unknown as typeof import('fs').existsSync,
    readdirSync: (() => [
      { name: 'agent', isFile: () => false, isDirectory: () => true },
      { name: 'extensions', isFile: () => false, isDirectory: () => true },
      { name: 'packages', isFile: () => false, isDirectory: () => true },
      { name: 'src', isFile: () => false, isDirectory: () => true },
      { name: 'README.md', isFile: () => true, isDirectory: () => false },
    ]) as unknown as typeof import('fs').readdirSync,
  });
}

function normalize(target: string): string {
  return target.replace(/\\/g, '/').replace(/\/+/g, '/').toLowerCase();
}
