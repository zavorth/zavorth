import { ZavorthPerceptionCrossSurfaceCertificationService } from '../../../src/services/ZavorthPerceptionCrossSurfaceCertificationService.js';
import { ZAVORTH_PERCEPTION_CROSS_SURFACE_CERTIFICATION_VERSION } from '../../../src/contracts/ZavorthPerceptionCrossSurfaceCertificationContract.js';

describe('ZavorthPerceptionCrossSurfaceCertificationService', () => {
  it('builds a snapshot and formats snapshot text successfully', async () => {
    const service = new ZavorthPerceptionCrossSurfaceCertificationService({
      now: () => new Date('2026-05-14T14:00:00.000Z'),
    });
    const snapshot = await service.buildSnapshot();

    expect(snapshot.contractVersion).toBe(ZAVORTH_PERCEPTION_CROSS_SURFACE_CERTIFICATION_VERSION);
    expect(snapshot.status).toBe('passed');
    expect(snapshot.source).toBe('ZavorthPerceptionCrossSurfaceCertificationService');
    expect(snapshot.certificationMatrix.length).toBeGreaterThan(0);
    expect(snapshot.safety.noWorkspaceMutation).toBe(true);
    expect(snapshot.safety.noExternalIo).toBe(true);
    expect(snapshot.safety.noRawSecretsSerialized).toBe(true);

    const text = service.formatSnapshotText(snapshot);
    expect(text).toContain('Zavorth Perception Cross-Surface Certification - Runtime gateway');
    expect(text).toContain('Status: passed');
  });
});
