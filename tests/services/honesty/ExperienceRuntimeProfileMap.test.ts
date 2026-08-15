import path from 'node:path';
import {
  DESKTOP_FIRST_RUN_AUDIENCE_IDS,
  EXPERIENCE_TO_RUNTIME_PROFILE_ALIASES,
  isDesktopFirstRunAudienceId,
  listExperienceRuntimeProfileIds,
  resolveRuntimeProfileId,
} from '../../../src/services/ExperienceRuntimeProfileMap';
import { ProfileManifestService } from '../../../src/services/ProfileManifestService';


describe('ExperienceRuntimeProfileMap', () => {
  const profileDir = path.join(__dirname, 'config', 'profile-manifests');

  it('maps every experience alias to a stable runtime profile id', () => {
    expect(resolveRuntimeProfileId('personal')).toBe('personal');
    expect(resolveRuntimeProfileId('developer')).toBe('developer');
    expect(resolveRuntimeProfileId('business')).toBe('business');
    expect(resolveRuntimeProfileId('power')).toBe('power');
    expect(resolveRuntimeProfileId('creator')).toBe('creator');
    expect(resolveRuntimeProfileId('operator')).toBe('operator');
    expect(resolveRuntimeProfileId('team')).toBe('team');
    expect(resolveRuntimeProfileId(' BUSINESS ')).toBe('business');
  });

  it('defaults empty ids to personal and passes unknown ids through for loud compile failure', () => {
    expect(resolveRuntimeProfileId(null)).toBe('personal');
    expect(resolveRuntimeProfileId(undefined)).toBe('personal');
    expect(resolveRuntimeProfileId('')).toBe('personal');
    expect(resolveRuntimeProfileId('   ')).toBe('personal');
    expect(resolveRuntimeProfileId('does-not-exist-yet')).toBe('does-not-exist-yet');
  });

  it('lists all known experience runtime profile ids including business and power', () => {
    const ids = listExperienceRuntimeProfileIds();
    expect(ids).toEqual(expect.arrayContaining([
      'personal',
      'developer',
      'business',
      'power',
      'creator',
      'operator',
      'team',
    ]));
    expect(Object.keys(EXPERIENCE_TO_RUNTIME_PROFILE_ALIASES)).toEqual(ids);
  });

  it('compiles business and power from real profile manifests (no silent personal fallback)', () => {
    const service = new ProfileManifestService({ profileDir });
    for (const experienceId of ['business', 'power'] as const) {
      const runtimeId = resolveRuntimeProfileId(experienceId);
      expect(runtimeId).toBe(experienceId);
      const bundle = service.compileProfileById(experienceId);
      expect(bundle?.id).toBe(experienceId);
      expect(bundle?.id).not.toBe('personal');
    }
  });

  it('exposes first-run Desktop audiences personal/developer/business', () => {
    expect([...DESKTOP_FIRST_RUN_AUDIENCE_IDS]).toEqual(['personal', 'developer', 'business']);
    expect(isDesktopFirstRunAudienceId('personal')).toBe(true);
    expect(isDesktopFirstRunAudienceId('developer')).toBe(true);
    expect(isDesktopFirstRunAudienceId('business')).toBe(true);
    expect(isDesktopFirstRunAudienceId('power')).toBe(false);
    expect(isDesktopFirstRunAudienceId('nope')).toBe(false);
  });
});
