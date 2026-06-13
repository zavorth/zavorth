import { WorkspaceSessionGrantCache } from '../../src/services/WorkspaceSessionGrantCache';

describe('WorkspaceSessionGrantCache', () => {
  const cache = WorkspaceSessionGrantCache.getInstance();
  const workspaceId = 'test-workspace';

  beforeEach(() => {
    cache.clearAll();
  });

  it('manages Developer Mode state correctly', () => {
    expect(cache.isDeveloperModeActive(workspaceId)).toBe(false);
    cache.setDeveloperMode(workspaceId, true);
    expect(cache.isDeveloperModeActive(workspaceId)).toBe(true);
    cache.setDeveloperMode(workspaceId, false);
    expect(cache.isDeveloperModeActive(workspaceId)).toBe(false);
  });

  it('stores and retrieves grants correctly', () => {
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 mins in future
    const grant = {
      workspaceId,
      expiresAt,
      allowRiskUpTo: 'MEDIUM' as const,
      allowPackageInstall: true,
      allowNetwork: false
    };

    cache.setGrant(workspaceId, grant);
    const retrieved = cache.getGrant(workspaceId);
    expect(retrieved).not.toBeNull();
    expect(retrieved?.expiresAt).toBe(expiresAt);
  });

  it('expires grants correctly', () => {
    const expiresAt = new Date(Date.now() - 1000).toISOString(); // 1s in past
    const grant = {
      workspaceId,
      expiresAt,
      allowRiskUpTo: 'MEDIUM' as const,
      allowPackageInstall: true,
      allowNetwork: false
    };

    cache.setGrant(workspaceId, grant);
    const retrieved = cache.getGrant(workspaceId);
    expect(retrieved).toBeNull();
  });

  it('revokes grants correctly', () => {
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const grant = {
      workspaceId,
      expiresAt,
      allowRiskUpTo: 'MEDIUM' as const,
      allowPackageInstall: true,
      allowNetwork: false
    };

    cache.setGrant(workspaceId, grant);
    cache.revokeGrant(workspaceId);
    expect(cache.getGrant(workspaceId)).toBeNull();
  });

  it('clears grants when Developer Mode is disabled', () => {
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const grant = {
      workspaceId,
      expiresAt,
      allowRiskUpTo: 'MEDIUM' as const,
      allowPackageInstall: true,
      allowNetwork: false
    };

    cache.setDeveloperMode(workspaceId, true);
    cache.setGrant(workspaceId, grant);
    cache.setDeveloperMode(workspaceId, false); // should delete grant too
    expect(cache.getGrant(workspaceId)).toBeNull();
  });
});
