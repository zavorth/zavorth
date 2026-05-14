import { RuntimeIsolationGuardService } from '../../src/services/RuntimeIsolationGuardService';

describe('RuntimeIsolationGuardService', () => {
  const originalRemoteShellIsolation = process.env.ZAVORTH_REMOTE_SHELL_ISOLATION;

  afterEach(() => {
    if (originalRemoteShellIsolation === undefined) {
      delete process.env.ZAVORTH_REMOTE_SHELL_ISOLATION;
    } else {
      process.env.ZAVORTH_REMOTE_SHELL_ISOLATION = originalRemoteShellIsolation;
    }
  });

  it('blocks raw credentials in command arguments and redacts audit argv', () => {
    const service = new RuntimeIsolationGuardService();

    const decision = service.guard({
      surface: 'remote_shell',
      action: 'node',
      argv: ['node', '--token', 'raw-secret-value'],
    });

    expect(decision.ok).toBe(false);
    expect(decision.code).toBe('raw-secret-blocked');
    expect(decision.audit.rawSecretBlocked).toBe(true);
    expect(decision.audit.sanitizedArgv).toEqual(['node', '--token', '[redacted-secret]']);
    expect(JSON.stringify(decision)).not.toContain('raw-secret-value');
  });

  it('redacts bearer authorization values when blocking raw credentials', () => {
    const service = new RuntimeIsolationGuardService();

    const decision = service.guard({
      surface: 'remote_shell',
      action: 'node',
      argv: ['node', 'authorization: Bearer raw-bearer-value'],
    });

    expect(decision.ok).toBe(false);
    expect(decision.code).toBe('raw-secret-blocked');
    expect(decision.audit.sanitizedArgv).toEqual(['node', 'authorization: Bearer [redacted-secret]']);
    expect(JSON.stringify(decision)).not.toContain('raw-bearer-value');
  });

  it('allows SecretRef placeholders without treating them as raw credentials', () => {
    const service = new RuntimeIsolationGuardService();

    const decision = service.guard({
      surface: 'remote_shell',
      action: 'node',
      argv: ['node', '--token', '<SecretRef:runtime-token>'],
    });

    expect(decision.ok).toBe(true);
    expect(decision.audit.secretRefPlaceholders).toEqual(['<SecretRef:runtime-token>']);
    expect(decision.audit.rawSecretBlocked).toBe(false);
  });

  it('requires an adapter when ephemeral mode is requested', () => {
    const service = new RuntimeIsolationGuardService();

    const decision = service.guard({
      surface: 'remote_shell',
      action: 'node',
      argv: ['node', '-v'],
      requestedMode: 'ephemeral',
      ephemeralAdapterAvailable: false,
    });

    expect(decision.ok).toBe(false);
    expect(decision.code).toBe('ephemeral-adapter-required');
    expect(decision.audit.ephemeral).toBe(true);
  });

  it('requires an isolated sidecar when sidecar mode is requested', () => {
    const service = new RuntimeIsolationGuardService();

    const decision = service.guard({
      surface: 'remote_shell',
      action: 'bash',
      argv: ['echo hello | wc -c'],
      requestedMode: 'sidecar',
      sidecarAvailable: false,
    });

    expect(decision.ok).toBe(false);
    expect(decision.code).toBe('sidecar-required');
    expect(decision.audit.sidecar).toBe(true);
  });

  it('can opt in to ephemeral mode through the remote shell environment flag', () => {
    process.env.ZAVORTH_REMOTE_SHELL_ISOLATION = 'ephemeral';
    const service = new RuntimeIsolationGuardService();

    const decision = service.guard({
      surface: 'remote_shell',
      action: 'node',
      argv: ['node', '-v'],
      ephemeralAdapterAvailable: true,
    });

    expect(decision.ok).toBe(true);
    expect(decision.mode).toBe('ephemeral');
  });

  it('can opt in to sidecar mode through the remote shell environment flag', () => {
    process.env.ZAVORTH_REMOTE_SHELL_ISOLATION = 'sidecar';
    const service = new RuntimeIsolationGuardService();

    const decision = service.guard({
      surface: 'remote_shell',
      action: 'bash',
      argv: ['echo hello | wc -c'],
      sidecarAvailable: true,
    });

    expect(decision.ok).toBe(true);
    expect(decision.mode).toBe('sidecar');
  });
});
