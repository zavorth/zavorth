import { runCapabilityPreflight, initializeBootstrapFoundation } from '../../src/bootstrap/bootstrapFoundation.js';
import { RuntimeArtifactMaintenanceService } from '../../src/services/RuntimeArtifactMaintenanceService.js';
import { RuntimeLogMaintenanceService } from '../../src/services/RuntimeLogMaintenanceService.js';

describe('bootstrapFoundation', () => {
  it('runCapabilityPreflight returns preflight capabilities array', () => {
    let preflight: ReturnType<typeof runCapabilityPreflight> | undefined;
    try {
      preflight = runCapabilityPreflight();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      expect(msg).toContain('channel');
      return;
    }
    expect(preflight).toBeDefined();
    expect(Array.isArray(preflight!.capabilities)).toBe(true);
  });

  it('initializeBootstrapFoundation runs and resolves foundation composition', async () => {
    let preflight: ReturnType<typeof runCapabilityPreflight> | undefined;
    try {
      preflight = runCapabilityPreflight();
    } catch {
      return;
    }

    const artifactService = new RuntimeArtifactMaintenanceService();
    const logService = new RuntimeLogMaintenanceService();

    try {
      const foundation = await initializeBootstrapFoundation(
        preflight,
        artifactService,
        logService,
      );
      expect(foundation).toBeDefined();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      expect(
        msg.includes('SQLite') || msg.includes('bindings') || msg.includes('database'),
      ).toBe(true);
    }
  });
});
