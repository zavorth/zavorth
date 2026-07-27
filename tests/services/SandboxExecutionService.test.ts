import { config } from '../../src/config/index';
import type { ZavorthCapabilityRunEnvelope } from '../../src/contracts/ZavorthMutationPlaneContract';
import { SandboxExecutionService } from '../../src/services/SandboxExecutionService';

describe('SandboxExecutionService', () => {
  const originalEnabled = config.dockerSandboxEnabled;
  const originalImage = config.dockerSandboxImage;
  const originalJavascriptImage = config.dockerSandboxJavascriptImage;
  const originalPythonImage = config.dockerSandboxPythonImage;
  const originalShellImage = config.dockerSandboxShellImage;

  afterEach(() => {
    (config as any).dockerSandboxEnabled = originalEnabled;
    (config as any).dockerSandboxImage = originalImage;
    (config as any).dockerSandboxJavascriptImage = originalJavascriptImage;
    (config as any).dockerSandboxPythonImage = originalPythonImage;
    (config as any).dockerSandboxShellImage = originalShellImage;
  });

  it('resolves sandbox tier correctly based on policy', () => {
    (config as any).dockerSandboxEnabled = true;
    const service = new SandboxExecutionService();

    // Container required for tests
    expect(
      service.resolveSandboxTier({
        executor: 'local',
        instructions: ['npm test'],
        metadata: {},
      } as any)?.tier,
    ).toBe('container');

    // Microvm required for untrusted metadata
    expect(
      service.resolveSandboxTier({
        executor: 'local',
        instructions: ['node build.js'],
        metadata: { untrustedContent: true },
      } as any)?.tier,
    ).toBe('microvm');

    // Microvm required for high risk code
    expect(
      service.resolveSandboxTier({
        executor: 'local',
        instructions: ['eval(foo)'],
        metadata: {},
      } as any)?.tier,
    ).toBe('microvm');

    // Microvm required for discord channel
    expect(
      service.resolveSandboxTier({
        executor: 'local',
        instructions: ['echo hello'],
        metadata: { sourceChannel: 'discord' },
      } as any)?.tier,
    ).toBe('microvm');
  });

  it('builds an ephemeral docker command', () => {
    (config as any).dockerSandboxEnabled = true;
    (config as any).dockerSandboxImage = 'node:22-bullseye';
    (config as any).dockerSandboxJavascriptImage = 'node:22-bullseye';
    (config as any).dockerSandboxPythonImage = 'python:3.12-slim';
    const service = new SandboxExecutionService();
    const command = service.buildSandboxCommand('npm test', 'C:/repo');
    const pythonCommand = service.buildSandboxCommand('pytest', 'C:/repo');

    expect(command).toContain('docker');
    expect(command).toContain('node:22-bullseye');
    expect(command).toContain('npm test');
    expect(pythonCommand).toContain('python:3.12-slim');
    expect(pythonCommand).toContain('pytest');
  });

  it('wraps microvm command execution as a shell script', async () => {
    const service = new SandboxExecutionService();
    const execute = jest.fn().mockResolvedValue({
      stdout: 'ok',
      stderr: '',
      exitCode: 0,
      executionTimeMs: 1,
      securityLevel: 'microvm',
      runtime: 'FirecrackerSandboxRuntime',
    });

    (service as any).firecrackerRuntime = { execute };

    await service.executeCommandInMicrovm('node build.js', 1234);

    expect(execute).toHaveBeenCalledWith({
      language: 'javascript',
      code: expect.stringContaining(`const command = ${JSON.stringify('node build.js')};`),
      timeoutMs: 1234,
    });
  });

  it('delegates wasm module execution to the wasm runtime', async () => {
    const service = new SandboxExecutionService();
    const execute = jest.fn().mockResolvedValue({
      stdout: '5\n',
      stderr: '',
      exitCode: 0,
      executionTimeMs: 1,
      securityLevel: 'wasm',
      runtime: 'WasmSandboxRuntime',
      selectedExport: 'add',
      returnValue: '5',
    });

    (service as any).wasmRuntime = { execute };

    const result = await service.executeModuleInWasm('AAA=', 'add', [2, 3], 4321);

    expect(execute).toHaveBeenCalledWith({
      moduleBase64: 'AAA=',
      exportName: 'add',
      args: [2, 3],
      timeoutMs: 4321,
    });
    expect(result.returnValue).toBe('5');
  });

  it('executes ready envelopes through the selected sandbox profile and budget', async () => {
    const service = new SandboxExecutionService();
    const execute = jest.fn().mockResolvedValue({
      stdout: 'ok\n',
      stderr: '',
      exitCode: 0,
      executionTimeMs: 3,
      securityLevel: 'local-jail',
      runtime: 'LocalJailSandboxRuntime',
    });
    (service as any).localJailRuntime = { execute };

    const envelope = buildEnvelope({
      mode: 'dry-run',
      status: 'ready',
      sandboxProfile: 'process',
      riskLevel: 'low',
      budget: {
        ...buildEnvelope().budget,
        maxDurationMs: 1234,
      },
    });

    const report = await service.executeEnvelope(envelope, {
      code: 'console.log("ok")',
      language: 'javascript',
    });

    expect(execute).toHaveBeenCalledWith(expect.objectContaining({
      code: 'console.log("ok")',
      language: 'javascript',
      timeoutMs: 1234,
      env: expect.objectContaining({
        ZAVORTH_SANDBOX_ENVELOPE_ID: envelope.id,
        ZAVORTH_SANDBOX_TEMP_ONLY: 'true',
      }),
    }));
    expect(report).toEqual(expect.objectContaining({
      envelopeId: envelope.id,
      auditId: envelope.auditId,
      sandboxProfile: 'process',
      cleanup: expect.objectContaining({ completed: true }),
    }));
  });

  it('refuses unsafe envelopes before any runtime is started', async () => {
    const service = new SandboxExecutionService();
    const execute = jest.fn();
    (service as any).localJailRuntime = { execute };

    await expect(service.executeEnvelope(buildEnvelope({
      status: 'waiting_approval',
      mode: 'preview',
    }), {
      code: 'console.log("blocked")',
      language: 'javascript',
    })).rejects.toThrow('not esta ready');

    await expect(service.executeEnvelope(buildEnvelope({
      mode: 'apply',
      status: 'ready',
      sandboxProfile: 'process',
      riskLevel: 'high',
    }), {
      code: 'require("fs").writeFileSync("escape", "x")',
      language: 'javascript',
    })).rejects.toThrow('not pode usar profile process');

    expect(execute).not.toHaveBeenCalled();
  });
});

function buildEnvelope(overrides: Partial<ZavorthCapabilityRunEnvelope> = {}): ZavorthCapabilityRunEnvelope {
  return {
    id: 'sandbox-run:test',
    capabilityId: 'sandbox-execution',
    requestedBy: 'tester',
    sourceSurface: 'jest',
    mode: 'preview',
    trustDecisionId: null,
    budget: {
      cpuCores: 1,
      memoryMb: 512,
      diskMb: 512,
      maxDurationMs: 30000,
      maxNetworkCalls: 0,
      maxFilesystemWrites: 0,
      maxProcesses: 8,
      maxInvocations: 1,
    },
    sandboxProfile: 'process',
    networkPolicy: 'none',
    filesystemPolicy: {
      tempWorkspaceOnly: true,
      hostMountsReadOnly: true,
      deniedHostWrite: true,
      allowlistedMounts: [],
      artifactCollection: 'explicit',
    },
    inputRefs: ['inline:test'],
    outputRefs: [],
    cleanupPlan: {
      killOnTimeout: true,
      removeWorkspace: true,
      removeContainerOrVm: true,
      ttlMs: 86400000,
      notes: [],
    },
    auditId: 'audit:sandbox:test',
    riskLevel: 'low',
    status: 'ready',
    reasons: [],
    ...overrides,
  };
}
