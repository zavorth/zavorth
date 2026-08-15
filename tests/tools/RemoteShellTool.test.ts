
import { RemoteShellTool } from '../../src/tools/RemoteShellTool';

describe('RemoteShellTool isolation slice', () => {
  const originalAllowedBinaries = process.env.ZAVORTH_REMOTE_SHELL_ALLOWED_BINARIES;
  const originalIsolation = process.env.ZAVORTH_REMOTE_SHELL_ISOLATION;
  const originalHostCode = process.env.ZAVORTH_REMOTE_SHELL_ALLOW_HOST_CODE_BINARIES;
  const originalHostBreakGlass = process.env.ZAVORTH_REMOTE_SHELL_HOST_BREAK_GLASS;
  const originalEphemeralCode = process.env.ZAVORTH_REMOTE_SHELL_ALLOW_EPHEMERAL_CODE;

  afterEach(() => {
    if (originalAllowedBinaries === undefined) {
      delete process.env.ZAVORTH_REMOTE_SHELL_ALLOWED_BINARIES;
    } else {
      process.env.ZAVORTH_REMOTE_SHELL_ALLOWED_BINARIES = originalAllowedBinaries;
    }

    if (originalIsolation === undefined) {
      delete process.env.ZAVORTH_REMOTE_SHELL_ISOLATION;
    } else {
      process.env.ZAVORTH_REMOTE_SHELL_ISOLATION = originalIsolation;
    }

    if (originalHostCode === undefined) {
      delete process.env.ZAVORTH_REMOTE_SHELL_ALLOW_HOST_CODE_BINARIES;
    } else {
      process.env.ZAVORTH_REMOTE_SHELL_ALLOW_HOST_CODE_BINARIES = originalHostCode;
    }

    if (originalHostBreakGlass === undefined) {
      delete process.env.ZAVORTH_REMOTE_SHELL_HOST_BREAK_GLASS;
    } else {
      process.env.ZAVORTH_REMOTE_SHELL_HOST_BREAK_GLASS = originalHostBreakGlass;
    }

    if (originalEphemeralCode === undefined) {
      delete process.env.ZAVORTH_REMOTE_SHELL_ALLOW_EPHEMERAL_CODE;
    } else {
      process.env.ZAVORTH_REMOTE_SHELL_ALLOW_EPHEMERAL_CODE = originalEphemeralCode;
    }
  });

  it('blocks raw credential arguments before command execution', async () => {
    process.env.ZAVORTH_REMOTE_SHELL_ALLOWED_BINARIES = 'node';
    const adapter = { execute: jest.fn() };
    const tool = new RemoteShellTool({ ephemeralAdapter: adapter, sidecarAdapter: null });

    const output = await tool.execute({
      command: 'node --token raw-secret-value',
    });

    expect(output).toContain('Raw credential blocked');
    expect(output).not.toContain('raw-secret-value');
    expect(adapter.execute).not.toHaveBeenCalled();
  });

  it('routes opt-in ephemeral execution through the adapter and permits SecretRef placeholders', async () => {
    process.env.ZAVORTH_REMOTE_SHELL_ALLOWED_BINARIES = 'zavorth-test-bin';
    const adapter = {
      execute: jest.fn().mockResolvedValue({
        stdout: 'adapter-ok\n',
        stderr: '',
        auditId: 'audit-test',
        workspaceRemoved: true,
      }),
    };
    const tool = new RemoteShellTool({ ephemeralAdapter: adapter, sidecarAdapter: null });

    const output = await tool.execute({
      command: 'zavorth-test-bin --token <SecretRef:runtime-token>',
      isolationMode: 'ephemeral',
    });

    expect(output).toContain('adapter-ok');
    expect(adapter.execute).toHaveBeenCalledWith(expect.objectContaining({
      file: 'zavorth-test-bin',
      args: ['--token', '<SecretRef:runtime-token>'],
      timeoutMs: 10000,
    }));
  });

  it('blocks code-capable binaries on the host and requires explicit ephemeral code opt-in', async () => {
    process.env.ZAVORTH_REMOTE_SHELL_ALLOWED_BINARIES = 'node';
    const adapter = {
      execute: jest.fn().mockResolvedValue({
        stdout: 'ephemeral-node-ok\n',
        stderr: '',
        auditId: 'audit-node',
        workspaceRemoved: true,
      }),
    };
    const tool = new RemoteShellTool({ ephemeralAdapter: adapter, sidecarAdapter: null });

    const blocked = await tool.execute({
      command: 'node -v',
    });
    const isolated = await tool.execute({
      command: 'node -v',
      isolationMode: 'ephemeral',
    });
    process.env.ZAVORTH_REMOTE_SHELL_ALLOW_EPHEMERAL_CODE = 'true';
    const explicitlyEphemeral = await tool.execute({
      command: 'node -v',
      isolationMode: 'ephemeral',
    });

    expect(blocked).toContain('can execute code or scripts');
    expect(isolated).toContain('ephemeral code requires ZAVORTH_REMOTE_SHELL_ALLOW_EPHEMERAL_CODE=true');
    expect(explicitlyEphemeral).toContain('ephemeral-node-ok');
    expect(adapter.execute).toHaveBeenCalledTimes(1);
  });

  it('does not honor the old host code-binary escape hatch', async () => {
    process.env.ZAVORTH_REMOTE_SHELL_ALLOWED_BINARIES = 'node';
    process.env.ZAVORTH_REMOTE_SHELL_ALLOW_HOST_CODE_BINARIES = 'true';
    const tool = new RemoteShellTool({
      ephemeralAdapter: null,
      sidecarAdapter: null,
    });

    const output = await tool.execute({
      command: 'node -v',
    });

    expect(output).toContain('isolationMode="sidecar"');
    expect(output).not.toContain('ZAVORTH_REMOTE_SHELL_ALLOW_HOST_CODE_BINARIES');
  });

  it('routes code-capable binaries to an isolated sidecar by default when available', async () => {
    process.env.ZAVORTH_REMOTE_SHELL_ALLOWED_BINARIES = 'node';
    const sidecar = {
      isConfigured: jest.fn(() => true),
      execute: jest.fn().mockResolvedValue({
        stdout: 'sidecar-node-ok\n',
        stderr: '',
        exitCode: 0,
        executionTimeMs: 10,
        securityLevel: 'container',
        runtime: 'DockerSandboxRuntime',
        auditId: 'audit-node-sidecar',
        requiredLevel: 'auto',
        policyLevel: 'container',
        policyReason: 'container automatico para binario capaz de executar codigo',
      }),
    };
    const tool = new RemoteShellTool({
      ephemeralAdapter: null,
      sidecarAdapter: sidecar,
    });

    const output = await tool.execute({
      command: 'node -v',
    });

    expect(output).toContain('Sidecar container');
    expect(output).toContain('sidecar-node-ok');
    expect(sidecar.execute).toHaveBeenCalledWith(expect.objectContaining({
      command: 'node -v',
      requiredLevel: 'auto',
    }));
  });

  it('refuses ephemeral execution when no adapter is available', async () => {
    process.env.ZAVORTH_REMOTE_SHELL_ALLOWED_BINARIES = 'zavorth-test-bin';
    const tool = new RemoteShellTool({ ephemeralAdapter: null, sidecarAdapter: null });

    const output = await tool.execute({
      command: 'zavorth-test-bin -v',
      isolationMode: 'ephemeral',
    });

    expect(output).toContain('Ephemeral adapter unavailable');
  });

  it('routes broad shell syntax through an isolated sidecar instead of host parsing', async () => {
    const sidecar = {
      isConfigured: jest.fn(() => true),
      execute: jest.fn().mockResolvedValue({
        stdout: 'sidecar-ok\n',
        stderr: '',
        exitCode: 0,
        executionTimeMs: 11,
        securityLevel: 'container',
        runtime: 'DockerSandboxRuntime',
        auditId: 'audit-sidecar',
        requiredLevel: 'container',
        policyLevel: 'container',
        policyReason: 'container solicitado explicitamente',
      }),
    };
    const tool = new RemoteShellTool({
      ephemeralAdapter: null,
      sidecarAdapter: sidecar,
    });

    const output = await tool.execute({
      command: 'echo hello | wc -c',
      isolationMode: 'sidecar',
      requiredIsolation: 'container',
    });

    expect(output).toContain('Sidecar container');
    expect(output).toContain('sidecar-ok');
    expect(sidecar.execute).toHaveBeenCalledWith(expect.objectContaining({
      command: 'echo hello | wc -c',
      requiredLevel: 'container',
    }));
  });

  it('refuses sidecar execution when no isolated sidecar is available', async () => {
    const tool = new RemoteShellTool({
      ephemeralAdapter: null,
      sidecarAdapter: {
        isConfigured: () => false,
        execute: jest.fn(),
      },
    });

    const output = await tool.execute({
      command: 'echo hello | wc -c',
      isolationMode: 'sidecar',
    });

    expect(output).toContain('Isolated sidecar unavailable');
  });
});
