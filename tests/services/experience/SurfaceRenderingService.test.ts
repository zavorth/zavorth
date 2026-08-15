import path from 'node:path';
import { ProfileManifestService } from '../../../src/services/ProfileManifestService';
import { ProfileSelectionService } from '../../../src/services/experience/ProfileSelectionService';
import { SurfaceRenderingService } from '../../../src/services/experience/SurfaceRenderingService';
import { SurfaceExperienceProjectionService } from '../../../src/services/SurfaceExperienceProjectionService';


const profileService = () => new ProfileManifestService({
  profileDir: path.join(__dirname, 'config', 'profile-manifests'),
});

describe('SurfaceRenderingService', () => {
  it('projects zavorthControl as tabbed, chat-first product UI', () => {
    const profiles = profileService().compileAll();
    const profileSelection = new ProfileSelectionService().build({
      surface: 'zavorthControl',
      requestedProfileId: 'developer',
      persistedProfileId: null,
      profiles,
    });
    const surfaceExperience = new SurfaceExperienceProjectionService().build({
      surface: 'zavorthControl',
      profileBundle: profiles.find((profile) => profile.id === 'developer'),
    });

    const rendering = new SurfaceRenderingService().build({
      surface: 'zavorthControl',
      profileSelection,
      surfaceExperience,
      healthStatus: 'ready',
      pendingApprovals: 0,
      pendingLearning: 1,
    });

    expect(rendering).toEqual(expect.objectContaining({
      contractVersion: 'ExperienceSurfaceRendering/v1',
      layout: 'zavorthControl-tabs',
      tone: 'developer',
      promptPlaceholder: 'Ask Zavorth anything...',
    }));
    expect(rendering.primarySections).toEqual(expect.arrayContaining(['inbox', 'timeline', 'receipts']));
    expect(rendering.secondarySections).toEqual(expect.arrayContaining(['learning']));
    expect(rendering.hiddenByDefault).toContain('debug-metadata');
  });

  it('projects Telegram as compact ChatOps cards', () => {
    const profiles = profileService().compileAll();
    const profileSelection = new ProfileSelectionService().build({
      surface: 'telegram',
      requestedProfileId: 'operator',
      persistedProfileId: null,
      profiles,
    });

    const rendering = new SurfaceRenderingService().build({
      surface: 'telegram',
      profileSelection,
      healthStatus: 'attention',
      pendingApprovals: 2,
      pendingLearning: 0,
    });

    expect(rendering.layout).toBe('chatops-card');
    expect(rendering.density).toBe('compact');
    expect(rendering.primarySections).toEqual(expect.arrayContaining(['reply', 'approval-card']));
    expect(rendering.limits.maxCards).toBe(1);
    expect(rendering.warnings.join('\n')).toContain('not intended for telegram');
  });
});
