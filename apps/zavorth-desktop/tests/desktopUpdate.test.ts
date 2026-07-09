import { describe, expect, it } from 'vitest';
import { buildDesktopUpdateStatus, compareSemver } from '../src/desktop-state/desktopUpdate';

describe('desktop update status', () => {
  it('orders versions', () => {
    expect(compareSemver('0.2.0', '0.1.0')).toBe(1);
    expect(compareSemver('1.0.0', '1.0.0')).toBe(0);
  });

  it('defaults to GitHub channel (no custom website required)', () => {
    const status = buildDesktopUpdateStatus({
      currentVersion: '0.1.0',
      latestVersion: '0.1.0',
      source: 'github',
      githubRepo: 'zavorth/zavorth',
      providerConfigured: true,
    });
    expect(status.source).toBe('github');
    expect(status.providerConfigured).toBe(true);
    expect(status.canOpenGithub).toBe(true);
    expect(status.canInstallNow).toBe(true);
    expect(status.releaseUrl).toContain('github.com/zavorth/zavorth/releases');
    expect(status.message).toMatch(/github|GitHub|Releases/i);
  });

  it('marks ready-to-install when downloaded', () => {
    const status = buildDesktopUpdateStatus({
      currentVersion: '0.1.0',
      latestVersion: '0.2.0',
      providerConfigured: true,
      source: 'github',
      downloaded: true,
    });
    expect(status.state).toBe('ready-to-install');
    expect(status.canInstallNow).toBe(true);
  });

  it('supports deferred updates', () => {
    const status = buildDesktopUpdateStatus({
      currentVersion: '0.1.0',
      latestVersion: '0.3.0',
      providerConfigured: true,
      source: 'github',
      deferredUntil: '2099-01-01T00:00:00.000Z',
    });
    expect(status.state).toBe('deferred');
    expect(status.canInstallNow).toBe(true);
  });

  it('surfaces available GitHub release', () => {
    const status = buildDesktopUpdateStatus({
      currentVersion: '0.1.0',
      latestVersion: '0.2.0',
      source: 'github',
      providerConfigured: true,
    });
    expect(status.state).toBe('available');
    expect(status.message).toMatch(/0\.2\.0|GitHub/i);
  });
});
