import { ZavorthCloudWorkspaceBackendsService } from '../../src/services/ZavorthCloudWorkspaceBackendsService.js';

describe('ZavorthCloudWorkspaceBackendsService', () => {
  it('does not claim cloud workspace readiness without config', () => {
    const service = new ZavorthCloudWorkspaceBackendsService({
      env: {},
      commandExists: () => false,
      now: () => new Date('2026-06-02T12:00:00.000Z'),
    });

    const snapshot = service.buildSnapshot();

    expect(snapshot.status).toBe('missing-config');
    expect(snapshot.summary.ready).toBe(0);
    expect(snapshot.backends.map((backend) => backend.id)).toEqual([
      'cloud-function',
      'managed-workspace',
      'custom-remote-workspace',
      'modal',
      'daytona',
    ]);
    expect(snapshot.backends.every((backend) => backend.adapterMode === 'doctor-only')).toBe(true);
    expect(snapshot.safety.noSecretValuesSerialized).toBe(true);
  });

  it('marks configured backends live-disabled until explicit live IO is enabled', () => {
    const service = new ZavorthCloudWorkspaceBackendsService({
      env: {
        ZAVORTH_CLOUD_FUNCTION_TOKEN: 'secret-token',
      },
      commandExists: (command) => command === 'zavorth-cloud-function',
    });

    const snapshot = service.buildSnapshot();
    const backend = snapshot.backends.find((entry) => entry.id === 'cloud-function');

    expect(backend?.status).toBe('live-disabled');
    expect(backend?.probe.credentialsReady).toBe(true);
    expect(backend?.probe.liveIoAllowed).toBe(false);
  });

  it('marks neutral cloud workspaces ready only with command, credentials and live flag', () => {
    const service = new ZavorthCloudWorkspaceBackendsService({
      env: {
        ZAVORTH_CLOUD_FUNCTION_TOKEN: 'secret-token',
        ZAVORTH_CLOUD_WORKSPACE_ALLOW_LIVE_IO: 'true',
      },
      commandExists: (command) => command === 'zavorth-cloud-function',
    });

    const snapshot = service.buildSnapshot();
    const backend = snapshot.backends.find((entry) => entry.id === 'cloud-function');

    expect(snapshot.status).toBe('partial');
    expect(backend?.status).toBe('ready');
    expect(backend?.adapterMode).toBe('cli-live-ready');
    expect(JSON.stringify(snapshot)).not.toContain('secret-token');
  });

  it('recognizes Modal and Daytona as real configurable cloud backends', () => {
    const service = new ZavorthCloudWorkspaceBackendsService({
      env: {
        MODAL_TOKEN_ID: 'id-secret',
        MODAL_TOKEN_SECRET: 'token-secret',
        DAYTONA_API_KEY: 'daytona-secret',
        ZAVORTH_DAYTONA_WORKSPACE: 'workspace-1',
        ZAVORTH_CLOUD_WORKSPACE_ALLOW_LIVE_IO: 'true',
      },
      commandExists: (command) => command === 'modal' || command === 'daytona',
    });

    const snapshot = service.buildSnapshot();
    const modal = snapshot.backends.find((entry) => entry.id === 'modal');
    const daytona = snapshot.backends.find((entry) => entry.id === 'daytona');

    expect(modal?.status).toBe('ready');
    expect(daytona?.status).toBe('ready');
    expect(modal?.adapterMode).toBe('cli-live-ready');
    expect(daytona?.adapterMode).toBe('cli-live-ready');
    expect(JSON.stringify(snapshot)).not.toContain('token-secret');
    expect(JSON.stringify(snapshot)).not.toContain('daytona-secret');
  });
});
