import { RuntimeIsolatedShellSidecarService } from '../../src/services/RuntimeIsolatedShellSidecarService';

describe('RuntimeIsolatedShellSidecarService', () => {
  const originalRequireMicrovm = process.env.ZAVORTH_REMOTE_SHELL_SIDECAR_REQUIRE_MICROVM;

  afterEach(() => {
    if (originalRequireMicrovm === undefined) {
      delete process.env.ZAVORTH_REMOTE_SHELL_SIDECAR_REQUIRE_MICROVM;
    } else {
      process.env.ZAVORTH_REMOTE_SHELL_SIDECAR_REQUIRE_MICROVM = originalRequireMicrovm;
    }
  });

  it('runs broad shell commands in the container sandbox without host fallback', async () => {
    const executeCode = jest.fn().mockResolvedValue({
      stdout: 'container ok\n',
      stderr: '',
      exitCode: 0,
      executionTimeMs: 12,
      securityLevel: 'container',
      runtime: 'DockerSandboxRuntime',
    });
    const receiptService = {
      createAuditId: jest.fn(() => 'audit-container'),
      record: jest.fn(),
    };
    const service = new RuntimeIsolatedShellSidecarService({
      sandbox: {
        isDockerAvailable: () => true,
        isFirecrackerAvailable: () => false,
        executeCode,
        executeCommandInMicrovm: jest.fn(),
      },
      receiptService,
    });

    const result = await service.execute({
      command: 'echo hello | wc -c',
      timeoutMs: 5000,
      requiredLevel: 'container',
    });

    expect(result.policyLevel).toBe('container');
    expect(result.stdout).toContain('container ok');
    expect(executeCode).toHaveBeenCalledWith(expect.objectContaining({
      code: 'echo hello | wc -c',
      language: 'shell',
      preferredLevel: 'container',
      timeoutMs: 5000,
    }));
    expect(receiptService.record).toHaveBeenCalledWith(expect.objectContaining({
      sidecarId: 'runtime-shell-sidecar',
      kind: 'shell',
      action: 'echo#audit-container',
      status: 'succeeded',
      isolationLevel: 'container',
    }));
  });

  it('blocks container-required execution when Docker is unavailable', async () => {
    const service = new RuntimeIsolatedShellSidecarService({
      sandbox: {
        isDockerAvailable: () => false,
        isFirecrackerAvailable: () => false,
        executeCode: jest.fn(),
        executeCommandInMicrovm: jest.fn(),
      },
      receiptService: null,
    });

    await expect(service.execute({
      command: 'echo hello',
      timeoutMs: 5000,
      requiredLevel: 'container',
    })).rejects.toThrow('container obrigatorio');
  });

  it('requires Firecracker when policy resolves to microvm', async () => {
    const service = new RuntimeIsolatedShellSidecarService({
      sandbox: {
        isDockerAvailable: () => true,
        isFirecrackerAvailable: () => false,
        executeCode: jest.fn(),
        executeCommandInMicrovm: jest.fn(),
      },
      receiptService: null,
    });

    await expect(service.execute({
      command: 'sudo whoami',
      timeoutMs: 5000,
      requiredLevel: 'auto',
    })).rejects.toThrow('MicroVM obrigatoria');
  });

  it('runs in Firecracker when microvm is explicitly required and available', async () => {
    const executeCommandInMicrovm = jest.fn().mockResolvedValue({
      stdout: 'microvm ok\n',
      stderr: '',
      exitCode: 0,
      executionTimeMs: 21,
      securityLevel: 'microvm',
      runtime: 'FirecrackerSandboxRuntime',
    });
    const receiptService = {
      createAuditId: jest.fn(() => 'audit-microvm'),
      record: jest.fn(),
    };
    const service = new RuntimeIsolatedShellSidecarService({
      sandbox: {
        isDockerAvailable: () => true,
        isFirecrackerAvailable: () => true,
        executeCode: jest.fn(),
        executeCommandInMicrovm,
      },
      receiptService,
    });

    const result = await service.execute({
      command: 'echo isolated',
      timeoutMs: 5000,
      requiredLevel: 'microvm',
    });

    expect(result.policyLevel).toBe('microvm');
    expect(result.stdout).toContain('microvm ok');
    expect(executeCommandInMicrovm).toHaveBeenCalledWith('echo isolated', 5000);
    expect(receiptService.record).toHaveBeenCalledWith(expect.objectContaining({
      action: 'echo#audit-microvm',
      isolationLevel: 'microvm',
      status: 'succeeded',
    }));
  });
});
