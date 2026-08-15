import type {
  ISandboxRuntime,
  SandboxRequest,
  SandboxResult,
  SandboxSecurityLevel,
} from '../../src/services/sandbox/ISandboxRuntime';
import { SandboxExecutionService } from '../../src/services/SandboxExecutionService';
import { SandboxPolicyService } from '../../src/services/sandbox/SandboxPolicyService';
import { SecurityOrchestratorEngine } from '../../src/services/sandbox/SecurityOrchestratorEngine';


describe('sandbox fail-closed execution', () => {
  it('cascades to fallback runtimes when the preferred microvm runtime is unavailable', async () => {
    const microvm = fakeRuntime('microvm', false);
    const container = fakeRuntime('container', true);
    const wasm = fakeRuntime('wasm', true);
    const localJail = fakeRuntime('local-jail', true);
    const engine = buildEngine({ microvm, container, wasm, localJail });

    // Engine cascades: microvm unavailable -> tries container -> succeeds
    const result = await engine.executeSecurely(request(), 'microvm');
    expect(result.securityLevel).toBe('container');

    expect(microvm.execute).not.toHaveBeenCalled();
    expect(container.execute).toHaveBeenCalledTimes(1);
  });

  it('cascades through all fallbacks when a runtime fails during execution', async () => {
    const executionFailure = new Error('container runtime failed after start');
    const container = fakeRuntime('container', true, executionFailure);
    const microvm = fakeRuntime('microvm', true);
    const wasm = fakeRuntime('wasm', true);
    const localJail = fakeRuntime('local-jail', true);
    const engine = buildEngine({ microvm, container, wasm, localJail });

    // Engine cascades: container fails -> tries wasm -> succeeds
    const result = await engine.executeSecurely(request(), 'container');
    expect(result.securityLevel).toBe('wasm');

    expect(container.execute).toHaveBeenCalledTimes(1);
    expect(wasm.execute).toHaveBeenCalledTimes(1);
    expect(localJail.execute).not.toHaveBeenCalled();
  });

  it('propagates governed local-jail authorization through SandboxExecutionService', async () => {
    const service = new SandboxExecutionService();
    const localJail = fakeRuntime('local-jail', true);
    (service as any).localJailRuntime = localJail;

    const result = await service.executeCode({
      code: 'console.log("ok")',
      language: 'javascript',
      preferredLevel: 'local-jail',
      allowTrustedLocalJail: true,
    });

    expect(result.securityLevel).toBe('local-jail');
    expect(localJail.execute).toHaveBeenCalledTimes(1);
  });

  it.each([
    'telegram',
    'discord',
  ])('requires microvm for known external channel identifier: %s', (sourceChannel) => {
    const policy = new SandboxPolicyService();
    expect(policy.requiresMicrovmForExecution(executionRequest({
      metadata: { sourceChannel, sourceTrust: 'trusted-user' },
    }))).toBe(true);
  });

  it.each([
    'slack',
    'email',
    'home-assistant',
    'api',
    'custom-channel-installed-later',
  ])('does not require microvm for channel source not in the external channel list: %s', (sourceChannel) => {
    const policy = new SandboxPolicyService();
    expect(policy.requiresMicrovmForExecution(executionRequest({
      metadata: { sourceChannel, sourceTrust: 'trusted-user' },
    }))).toBe(false);
  });

  it('requires microvm for untrusted content regardless of channel', () => {
    const policy = new SandboxPolicyService();
    expect(policy.requiresMicrovmForExecution(executionRequest({
      metadata: { untrustedContent: true },
    }))).toBe(true);
  });

  it('requires microvm for god-mode autonomous execution', () => {
    const policy = new SandboxPolicyService();
    expect(policy.requiresMicrovmForExecution(executionRequest({
      metadata: { godModeAutonomous: true },
    }))).toBe(true);
  });

  it('requires microvm for high-risk code patterns in instructions', () => {
    const policy = new SandboxPolicyService();
    expect(policy.requiresMicrovmForExecution(executionRequest({
      instructions: ['sudo rm -rf /'],
    }))).toBe(true);
  });

  it('does not require microvm for safe local instructions', () => {
    const policy = new SandboxPolicyService();
    expect(policy.requiresMicrovmForExecution(executionRequest({
      instructions: ['git status'],
    }))).toBe(false);
  });
});

function request(): SandboxRequest {
  return {
    language: 'javascript',
    code: 'console.log("ok")',
  };
}

function executionRequest(overrides: Record<string, unknown> = {}) {
  return {
    execution_id: 'exec-source-trust',
    task_id: 'task-source-trust',
    executor: 'local_executor',
    workspace: __dirname,
    objective: 'Inspect repository status',
    instructions: ['git status'],
    allowed_paths: [],
    blocked_paths: [],
    allowed_commands: [],
    blocked_commands: [],
    timeout_seconds: 30,
    dry_run: false,
    requires_backup: false,
    metadata: {},
    ...overrides,
  } as any;
}

function fakeRuntime(
  securityLevel: SandboxSecurityLevel,
  available: boolean,
  failure?: Error,
): ISandboxRuntime & { execute: jest.Mock } {
  const execute = failure
    ? jest.fn().mockRejectedValue(failure)
    : jest.fn().mockResolvedValue({
        stdout: 'ok\n',
        stderr: '',
        exitCode: 0,
        executionTimeMs: 1,
        securityLevel,
        runtime: `Fake${securityLevel}`,
      } satisfies SandboxResult);
  return {
    securityLevel,
    isAvailable: jest.fn().mockReturnValue(available),
    execute,
  };
}

function buildEngine(runtimes: {
  microvm: ISandboxRuntime;
  container: ISandboxRuntime;
  wasm: ISandboxRuntime;
  localJail: ISandboxRuntime;
}): SecurityOrchestratorEngine {
  return new SecurityOrchestratorEngine({
    getFirecrackerRuntime: () => runtimes.microvm as any,
    getDockerRuntime: () => runtimes.container as any,
    getWasmRuntime: () => runtimes.wasm as any,
    getLocalJailRuntime: () => runtimes.localJail as any,
  });
}
