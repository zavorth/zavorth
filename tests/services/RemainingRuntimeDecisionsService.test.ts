import { ChannelMeshConsistencyService } from '../../src/services/ChannelMeshConsistencyService.js';
import { MemoryArtifactConsistencyService } from '../../src/services/MemoryArtifactConsistencyService.js';
import { ReleaseCertificationService } from '../../src/services/ReleaseCertificationService.js';
import { RemainingRuntimeDecisionsService } from '../../src/services/RemainingRuntimeDecisionsService.js';
import { SatelliteAppConsistencyService } from '../../src/services/SatelliteAppConsistencyService.js';

describe('RemainingRuntimeDecisionsService Intent model3', () => {
  it('closes the four remaining runtime decisions and reaches certification-ready consistency', () => {
    const snapshot = new RemainingRuntimeDecisionsService({
      now: () => new Date('2026-05-04T23:00:00.000Z'),
    }).buildSnapshot();

    expect(snapshot.contractVersion).toBe('2026-05-04.checkpoint-13');
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

  it('makes the underlying consistency snapshots report zero gaps', () => {
    const channel = new ChannelMeshConsistencyService().buildSnapshot();
    const satellite = new SatelliteAppConsistencyService().buildSnapshot();
    const memory = new MemoryArtifactConsistencyService().buildSnapshot();

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
    const certification = new ReleaseCertificationService({
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
    expect(certification.commands.nextStage).toBe('Release certification profile hardening');
  });
});
