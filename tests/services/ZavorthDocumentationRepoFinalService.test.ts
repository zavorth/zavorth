import { describe, expect, it } from '@jest/globals';
import { ZavorthDocumentationRepoFinalService } from '../../src/services/ZavorthDocumentationRepoFinalService.js';

describe('ZavorthDocumentationRepoFinalService', () => {
  it('builds a final repo/docs closure snapshot without granting execution authority', () => {
    const service = new ZavorthDocumentationRepoFinalService({
      now: () => new Date('2026-05-14T00:00:00.000Z'),
    });
    const snapshot = service.buildSnapshot();

    expect(snapshot.contractVersion).toBe('2026-05-14.checkpoint-15-documentation-repo-final');
    expect(snapshot.source).toBe('ZavorthDocumentationRepoFinalService');
    expect(snapshot.guarantees.dashboardIsPrimarySurface).toBe(true);
    expect(snapshot.guarantees.satelliteAndCliRemainValidSurfaces).toBe(true);
    expect(snapshot.guarantees.retiredVisualSurfacesAreNotUserFacing).toBe(true);
    expect(snapshot.guarantees.publicIdentityIsZavorthNative).toBe(true);
    expect(snapshot.guarantees.commandCenterCanExecute).toBe(false);
    expect(snapshot.summary.rawSecretsSerialized).toBe(false);
    expect(snapshot.summary.workspaceMutationPerformed).toBe(false);
    expect(snapshot.summary.externalIoPerformed).toBe(false);
    expect(snapshot.checks.map((entry) => entry.id)).toEqual(expect.arrayContaining([
      'docs-audit',
      'public-identity',
      'live-certification',
      'root-noise',
      'public-docs-posture',
      'surface-posture',
      'package-posture',
      'workspace-wiring',
    ]));
  });
});
