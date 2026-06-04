import { OperationalReadinessToolingService } from '../../src/services/OperationalReadinessToolingService.js';

describe('OperationalReadinessToolingService Dashboard controls', () => {
  it('aggregates phases 1-8 into one operational readiness snapshot', () => {
    const snapshot = new OperationalReadinessToolingService({
      now: () => new Date('2026-05-04T18:00:00.000Z'),
    }).buildSnapshot();

    expect(snapshot.contractVersion).toBe('2026-05-04.checkpoint-8');
    expect(snapshot.status).toBe('passed');
    expect(snapshot.summary).toEqual(
      expect.objectContaining({
        phases: 8,
        passed: 8,
        attention: 0,
        blocked: 0,
        staticGates: 7,
        jestGates: 7,
        doctorCommands: 1,
        privateSourceModules: expect.any(Number),
        normalizedSourceModules: expect.any(Number),
        sourceModulesNeedingReview: 0,
        generatedPluginManifests: expect.any(Number),
        pluginCapabilities: expect.any(Number),
        openGaps: 0,
        p0Gaps: 0,
        p1Gaps: 0,
        p2Gaps: 0,
        liveExternalCallRequired: false,
        liveChannelSendRequired: false,
        liveDeviceRequired: false,
        liveMemoryWriteRequired: false,
        filesystemReadRequired: false,
        secretValuesSerialized: false,
      }),
    );
    expect(snapshot.summary.privateSourceModules).toBeGreaterThanOrEqual(125);
    expect(snapshot.summary.normalizedSourceModules).toBe(snapshot.summary.privateSourceModules);
    expect(snapshot.summary.generatedPluginManifests).toBeGreaterThanOrEqual(72);
    expect(snapshot.summary.pluginCapabilities).toBeGreaterThanOrEqual(98);
    expect(snapshot.phases).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'checkpoint-2-plugin-os', status: 'passed', gapCount: 0 }),
        expect.objectContaining({ id: 'checkpoint-3-capability-normalization', status: 'passed', gapCount: 0 }),
        expect.objectContaining({ id: 'checkpoint-4-provider-mesh', status: 'passed', gapCount: 0 }),
        expect.objectContaining({ id: 'checkpoint-5-channel-mesh', status: 'passed', gapCount: 0 }),
        expect.objectContaining({ id: 'checkpoint-6-satellite-apps', status: 'passed', gapCount: 0 }),
        expect.objectContaining({ id: 'checkpoint-7-memory-artifacts', status: 'passed', gapCount: 0 }),
        expect.objectContaining({ id: 'checkpoint-8-operational-tooling', status: 'passed', gapCount: 0 }),
      ]),
    );
    expect(snapshot.certification).toEqual(
      expect.objectContaining({
        releaseReady: true,
        minimumNextAction: 'Run the certification phase against the full release profile.',
      }),
    );
  });

  it('registers generated manifests from Provider, Channel, Satellite, and Memory consistency', () => {
    const snapshot = new OperationalReadinessToolingService({
      now: () => new Date('2026-05-04T18:10:00.000Z'),
    }).buildSnapshot();

    expect(snapshot.pluginRegistry.summary).toEqual(
      expect.objectContaining({
        total: expect.any(Number),
        capabilities: expect.any(Number),
      }),
    );
    expect(snapshot.pluginRegistry.summary.total).toBeGreaterThanOrEqual(72);
    expect(snapshot.pluginRegistry.summary.capabilities).toBeGreaterThanOrEqual(98);
    expect(snapshot.pluginInventory).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          pluginId: 'zavorth.device.satellite',
          moduleKind: 'bridge',
          capabilityCount: 13,
          requiresApproval: true,
        }),
        expect.objectContaining({
          pluginId: 'zavorth.memory.artifact-plane',
          moduleKind: 'memory',
          capabilityCount: 15,
          requiresApproval: true,
        }),
        expect.objectContaining({
          pluginId: 'zavorth.provider.openai',
          moduleKind: 'provider',
          capabilityCount: 1,
        }),
        expect.objectContaining({
          pluginId: 'zavorth.channel.telegram',
          moduleKind: 'channel',
          capabilityCount: 1,
        }),
      ]),
    );
  });

  it('groups remaining consistency gaps without performing live IO', () => {
    const snapshot = new OperationalReadinessToolingService().buildSnapshot();

    expect(snapshot.gaps).toEqual([]);
    expect(snapshot.policy).toEqual(
      expect.objectContaining({
        operationalToolingOnly: true,
        noExternalCalls: true,
        noLiveSends: true,
        noDeviceAccess: true,
        noMemoryWrites: true,
        noArtifactBodyReads: true,
        secretsSerialized: false,
      }),
    );
  });

  it('formats a concise operator doctor report', () => {
    const service = new OperationalReadinessToolingService({
      now: () => new Date('2026-05-04T18:20:00.000Z'),
    });
    const report = service.formatDoctorText();

    expect(report).toContain('Zavorth Operational Consistency Doctor');
    expect(report).toContain('Status: passed');
    expect(report).toMatch(/Plugin OS manifests: \d+ \/ capabilities \d+/);
    expect(report).toContain('Open gaps: 0 (P0 0, P1 0, P2 0)');
    expect(report).toContain('Next: Etapa 9 - Certification');
  });
});
