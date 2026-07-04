import fs from 'node:fs';
import path from 'node:path';
import {
  buildDesktopSafeModeState,
  buildRuntimeDoctorSnapshot,
  detectRemoteDisplayFromEnv,
} from '../../../apps/zavorth-desktop/src/desktop-state/runtimeDoctor';
import {
  buildDesktopUpdateStatus,
  compareSemver,
} from '../../../apps/zavorth-desktop/src/desktop-state/desktopUpdate';

function readSource(relativePath: string): string {
  return fs.readFileSync(path.resolve(relativePath), 'utf8');
}

describe('Desktop P6 install, update and trust contract', () => {
  it('builds a full Runtime Doctor for install and daily readiness', () => {
    const snapshot = buildRuntimeDoctorSnapshot({
      generatedAt: '2026-07-01T00:00:00.000Z',
      nodeVersion: 'v22.13.0',
      gitVersion: 'git version 2.45.0',
      ripgrepVersion: 'ripgrep 14.1.0',
      runtimeRunning: true,
      backendReachable: true,
      tokenReady: true,
      providerCount: 1,
      selectedModel: 'openai:gpt-5',
      workspacePath: 'C:/repo',
      workspaceTrusted: true,
      terminalBackend: 'pty',
      safeMode: buildDesktopSafeModeState({ enabled: false }),
    });

    expect(snapshot.overall).toBe('ready');
    expect(snapshot.checks.map(check => check.id)).toEqual([
      'node',
      'git',
      'ripgrep',
      'provider',
      'workspace',
      'permissions',
      'terminal',
      'backend',
    ]);
    expect(snapshot.summary.failures).toBe(0);
  });

  it('detects remote display and safe mode restrictions for hardening', () => {
    expect(detectRemoteDisplayFromEnv({ SESSIONNAME: 'RDP-Tcp#12' })).toMatchObject({
      remote: true,
      severity: 'warning',
    });
    expect(buildDesktopSafeModeState({ enabled: true, remoteDisplay: true }).restrictions).toEqual(expect.arrayContaining([
      expect.stringContaining('Host commands'),
    ]));
  });

  it('models auto-update, defer, install and rollback states', () => {
    expect(compareSemver('2.1.0', '2.0.9')).toBe(1);
    const available = buildDesktopUpdateStatus({
      currentVersion: '2.0.0',
      latestVersion: '2.1.0',
      providerConfigured: true,
      releaseNotes: ['Runtime Doctor', 'Recovery pos-sleep'],
    });
    expect(available).toMatchObject({
      state: 'available',
      canDownloadLater: true,
      canInstallNow: true,
    });

    expect(buildDesktopUpdateStatus({
      currentVersion: '2.0.0',
      latestVersion: '2.1.0',
      providerConfigured: true,
      downloaded: true,
      rollbackVersion: '2.0.0',
    })).toMatchObject({
      state: 'ready-to-install',
      canRollback: true,
    });
  });

  it('wires P6 through Electron, onboarding, settings and resume recovery', () => {
    const main = readSource('apps/zavorth-desktop/electron/main.cjs');
    const preload = readSource('apps/zavorth-desktop/electron/preload.cjs');
    const onboarding = readSource('apps/zavorth-desktop/src/components/OnboardingOverlay.tsx');
    const settings = readSource('apps/zavorth-desktop/src/components/SettingsOverlay.tsx');
    const recovery = readSource('apps/zavorth-desktop/src/desktop-state/useRuntimeRecoveryRefresh.ts');

    expect(main).toContain("zavorth:runtime:doctor");
    expect(main).toContain("zavorth:updates:install");
    expect(main).toContain("zavorth:trust:safe-mode");
    expect(main).toContain("zavorth:power-resume");
    expect(preload).toContain('runRuntimeDoctor');
    expect(preload).toContain('onPowerResume');
    expect(onboarding).toContain('Runtime Doctor');
    expect(onboarding).toContain('apiRequest');
    expect(settings).toContain('DesktopP6Panel');
    expect(settings).toContain("section=\"updates\"");
    expect(settings).toContain("section=\"trust\"");
    expect(recovery).toContain('onPowerResume');
  });
});
