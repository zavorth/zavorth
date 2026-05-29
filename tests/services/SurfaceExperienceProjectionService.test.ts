import path from 'node:path';
import { ProfileManifestService } from '../../src/services/ProfileManifestService';
import { SurfaceExperienceProjectionService } from '../../src/services/SurfaceExperienceProjectionService';

describe('SurfaceExperienceProjectionService', () => {
  it('projects a surface bundle into renderable hints', () => {
    const profiles = new ProfileManifestService({
      profileDir: path.join(process.cwd(), 'config', 'profile-manifests'),
    });
    const developer = profiles.compileProfileById('developer');
    const projection = new SurfaceExperienceProjectionService().build({
      surface: 'cli',
      profileBundle: developer,
    });

    expect(projection).toEqual(expect.objectContaining({
      contractVersion: 'SurfaceExperienceProjection/v1',
      profileId: 'developer',
      activeSurface: 'cli',
      defaultSurface: 'cli',
      surfaceAllowed: true,
      label: 'Developer workspace',
    }));
    expect(projection?.navigationHints).toEqual(expect.arrayContaining([
      expect.objectContaining({ surface: 'cli', primary: true }),
      expect.objectContaining({ surface: 'zavorthControl' }),
    ]));
    expect(projection?.profileEnforcementReceipt).toEqual(expect.objectContaining({
      contractVersion: 'zavorth.profile-enforcement.receipt/1',
      kind: 'surface_projection',
      profileId: 'developer',
      subject: 'cli',
      decision: 'allowed',
    }));
  });

  it('marks a non-allowed surface clearly without changing runtime policy', () => {
    const profiles = new ProfileManifestService({
      profileDir: path.join(process.cwd(), 'config', 'profile-manifests'),
    });
    const operator = profiles.compileProfileById('operator');
    const projection = new SurfaceExperienceProjectionService().build({
      surface: 'telegram',
      profileBundle: operator,
    });

    expect(projection?.surfaceAllowed).toBe(false);
    expect(projection?.guidance).toContain('Switch to zavorthControl');
    expect(projection?.allowedSurfaces).toEqual(expect.arrayContaining(['cli', 'zavorthControl', 'api']));
    expect(projection?.profileEnforcementReceipt).toEqual(expect.objectContaining({
      kind: 'surface_projection',
      profileId: 'operator',
      subject: 'telegram',
      decision: 'blocked',
    }));
  });
});
