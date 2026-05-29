import path from 'node:path';
import { ProfileManifestService } from '../../../src/services/ProfileManifestService';
import { ProfileSelectionService } from '../../../src/services/experience/ProfileSelectionService';

describe('ProfileSelectionService', () => {
  it('projects profile choices for the active surface', () => {
    const profiles = new ProfileManifestService({
      profileDir: path.join(process.cwd(), 'config', 'profile-manifests'),
    }).compileAll();

    const selection = new ProfileSelectionService().build({
      surface: 'cli',
      requestedProfileId: 'developer',
      persistedProfileId: null,
      profiles,
    });

    expect(selection).toEqual(expect.objectContaining({
      contractVersion: 'ExperienceProfileSelection/v1',
      activeProfileId: 'developer',
      source: 'requested',
      surface: 'cli',
    }));
    expect(selection.options).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'developer',
        active: true,
        availableOnSurface: true,
        command: 'zavorth profile use developer',
      }),
      expect.objectContaining({
        id: 'operator',
        availableOnSurface: true,
      }),
    ]));
  });

  it('warns when a requested profile is not intended for the current surface', () => {
    const profiles = new ProfileManifestService({
      profileDir: path.join(process.cwd(), 'config', 'profile-manifests'),
    }).compileAll();

    const selection = new ProfileSelectionService().build({
      surface: 'telegram',
      requestedProfileId: 'operator',
      persistedProfileId: null,
      profiles,
    });

    expect(selection.activeProfileId).toBe('operator');
    expect(selection.warnings.join('\n')).toContain('not intended for telegram');
    expect(selection.options.find((option) => option.id === 'operator')?.availableOnSurface).toBe(false);
  });
});
