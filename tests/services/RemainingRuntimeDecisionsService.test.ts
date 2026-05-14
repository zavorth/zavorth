import { ChannelMeshParityService } from '../../src/services/ChannelMeshParityService.js';
import { MemoryArtifactParityService } from '../../src/services/MemoryArtifactParityService.js';
import { ParityCertificationService } from '../../src/services/ParityCertificationService.js';
import { RemainingRuntimeDecisionsService } from '../../src/services/RemainingRuntimeDecisionsService.js';
import { SatelliteAppParityService } from '../../src/services/SatelliteAppParityService.js';

describe('RemainingRuntimeDecisionsService Phase 13', () => {
  it('closes the four remaining runtime decisions and reaches certification-ready parity', () => {
    const snapshot = new RemainingRuntimeDecisionsService({
      now: () => new Date('2026-05-04T23:00:00.000Z'),
    }).buildSnapshot();

    expect(snapshot.contractVersion).toBe('2026-05-04.phase-13');
    expect(snapshot.status).toBe('closed');
    expect(snapshot.summary).toEqual(
      expect.objectContaining({
        closedDecisions: 4,
        remainingChannelUnsupported: 0,
        remainingSatelliteDecisions: 0,
        remainingMemoryTemplates: 0,
        remainingMemoryDecisions: 0,
        certificationOpenGaps: 0,
        certificationStatus: 'certified',
        releaseReady: true,
        liveExternalCallRequired: false,
        liveChannelSendRequired: false,
        liveDeviceRequired: false,
        liveMemoryWriteRequired: false,
        secretValuesSerialized: false,
      }),
    );
    expect(snapshot.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'tlon-local-bridge',
          previousGap: 'channel-unsupported-routes',
          resultingStatus: 'adapter-backed',
        }),
        expect.objectContaining({
          id: 'memory-wiki-runtime',
          previousGap: 'memory-wiki-template',
          resultingStatus: 'backend-ready',
        }),
        expect.objectContaining({
          id: 'satellite-pwa-first',
          previousGap: 'satellite-native-wrapper-decision',
          resultingStatus: 'backend-ready',
        }),
        expect.objectContaining({
          id: 'memory-vector-store-backend',
          previousGap: 'memory-vector-backend-choice',
          resultingStatus: 'backend-ready',
        }),
      ]),
    );
  });

  it('makes the underlying parity snapshots report zero gaps', () => {
    const channel = new ChannelMeshParityService().buildSnapshot();
    const satellite = new SatelliteAppParityService().buildSnapshot();
    const memory = new MemoryArtifactParityService().buildSnapshot();

    expect(channel.summary.unsupported).toBe(0);
    expect(channel.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          normalizedSourceName: 'tlon',
          status: 'adapter-backed',
          route: expect.objectContaining({
            transportStrategy: 'local-bridge',
          }),
        }),
      ]),
    );
    expect(satellite.summary.decisionRequired).toBe(0);
    expect(satellite.nativeWrapperDecision).toEqual(
      expect.objectContaining({
        required: false,
        recommendation: 'keep-pwa-first',
      }),
    );
    expect(memory.summary.templateReady).toBe(0);
    expect(memory.summary.decisionRequired).toBe(0);
    expect(memory.gaps).toEqual([]);
  });

  it('makes private certification pass with zero P0/P1/P2 gaps', () => {
    const certification = new ParityCertificationService({
      now: () => new Date('2026-05-04T23:10:00.000Z'),
    }).buildSnapshot();

    expect(certification.status).toBe('certified');
    expect(certification.summary).toEqual(
      expect.objectContaining({
        sourceOpenGaps: 0,
        sourceP0Gaps: 0,
        sourceP1Gaps: 0,
        sourceP2Gaps: 0,
        warned: 0,
        failed: 0,
        releaseReady: true,
      }),
    );
    expect(certification.commands.nextPhase).toBe('Release certification profile hardening');
  });
});
