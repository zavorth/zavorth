import { SandboxPolicyService } from '../../../src/services/sandbox/SandboxPolicyService';

describe('SandboxPolicyService', () => {
  const service = new SandboxPolicyService();

  // -------------------------------------------------------------------------
  // Tier 1: local-jail (baixo risco)
  // -------------------------------------------------------------------------
  it('keeps low-risk javascript in container by default because regex is only heuristic', () => {
    const policy = service.resolveCodeExecutionPolicy(
      'javascript',
      'console.log("hello from zavorth");',
    );
    expect(policy.securityLevel).toBe('container');
  });

  it('keeps low-risk python in container by default because regex is only heuristic', () => {
    const policy = service.resolveCodeExecutionPolicy(
      'python',
      'print("hello")',
    );
    expect(policy.securityLevel).toBe('container');
  });

  it('blocks local-jail unless trusted local policy opt-in is enabled', () => {
    const policy = service.resolveCodeExecutionPolicy(
      'javascript',
      'const x = 1 + 2;',
      'local-jail',
    );
    expect(policy.securityLevel).toBe('container');
  });

  it('allows local-jail when explicitly requested and trusted local policy opt-in is enabled', () => {
    const original = process.env.ZAVORTH_ALLOW_LOCAL_JAIL_SANDBOX;
    process.env.ZAVORTH_ALLOW_LOCAL_JAIL_SANDBOX = 'true';
    const policy = service.resolveCodeExecutionPolicy(
      'javascript',
      'const x = 1 + 2;',
      'local-jail',
    );
    if (original === undefined) {
      delete process.env.ZAVORTH_ALLOW_LOCAL_JAIL_SANDBOX;
    } else {
      process.env.ZAVORTH_ALLOW_LOCAL_JAIL_SANDBOX = original;
    }
    expect(policy.securityLevel).toBe('local-jail');
  });

  // -------------------------------------------------------------------------
  // Tier 2: container / gVisor (risco medio)
  // -------------------------------------------------------------------------
  it('requires container for shell scripts by default', () => {
    const policy = service.resolveCodeExecutionPolicy('shell', 'echo hello');
    expect(policy.securityLevel).toBe('container');
  });

  it('requires container for curl commands', () => {
    const policy = service.resolveCodeExecutionPolicy(
      'javascript',
      'const res = fetch("https://api.com");',
    );
    // fetch alone is not a sensitive regex match, but unknown dynamic code
    // still stays in container because regex is not the security boundary.
    expect(policy.securityLevel).toBe('container');

    const curlPolicy = service.resolveCodeExecutionPolicy(
      'shell',
      'curl https://example.com',
    );
    expect(curlPolicy.securityLevel).toBe('container');
  });

  it('requires container for npm install', () => {
    const policy = service.resolveCodeExecutionPolicy(
      'shell',
      'npm install express',
    );
    expect(policy.securityLevel).toBe('container');
  });

  it('requires container for pip install', () => {
    const policy = service.resolveCodeExecutionPolicy(
      'python',
      'pip install requests',
    );
    expect(policy.securityLevel).toBe('container');
  });

  it('forces container when explicitly requested', () => {
    const policy = service.resolveCodeExecutionPolicy(
      'javascript',
      'console.log("safe")',
      'container',
    );
    expect(policy.securityLevel).toBe('container');
  });

  // -------------------------------------------------------------------------
  // Tier 3: microvm / Firecracker (alto risco)
  // -------------------------------------------------------------------------
  it('escalates child_process to microvm (high risk)', () => {
    const policy = service.resolveCodeExecutionPolicy(
      'javascript',
      'require("child_process").exec("ls")',
    );
    expect(policy.securityLevel).toBe('microvm');
  });

  it('escalates sudo to microvm', () => {
    const policy = service.resolveCodeExecutionPolicy(
      'shell',
      'sudo apt update',
    );
    expect(policy.securityLevel).toBe('microvm');
  });

  it('escalates os.system to microvm', () => {
    const policy = service.resolveCodeExecutionPolicy(
      'python',
      'import os\nos.system("whoami")',
    );
    expect(policy.securityLevel).toBe('microvm');
  });

  it('escalates eval() to microvm', () => {
    const policy = service.resolveCodeExecutionPolicy(
      'python',
      'eval("__import__(\'os\').system(\'id\')")',
    );
    expect(policy.securityLevel).toBe('microvm');
  });

  it('escalates fork bombs to microvm', () => {
    const policy = service.resolveCodeExecutionPolicy(
      'shell',
      ':(){ :|:& };:',
    );
    expect(policy.securityLevel).toBe('microvm');
  });

  it('escalates process.env access to microvm', () => {
    const policy = service.resolveCodeExecutionPolicy(
      'javascript',
      'console.log(process.env.SECRET_KEY)',
    );
    expect(policy.securityLevel).toBe('microvm');
  });

  it('does not downgrade obfuscated risky javascript just because regex misses it', () => {
    const policy = service.resolveCodeExecutionPolicy(
      'javascript',
      'const fs = require("f" + "s"); console.log(fs.readdirSync("."));',
    );
    expect(policy.securityLevel).toBe('container');
    expect(policy.reason).toMatch(/heuristica|heuristic|container/i);
  });

  it('escalates gcc compilation to microvm', () => {
    const policy = service.resolveCodeExecutionPolicy(
      'shell',
      'gcc -o exploit exploit.c && ./exploit',
    );
    expect(policy.securityLevel).toBe('microvm');
  });

  it('escalates nmap to microvm', () => {
    const policy = service.resolveCodeExecutionPolicy(
      'shell',
      'nmap -sV 192.168.1.0/24',
    );
    expect(policy.securityLevel).toBe('microvm');
  });

  it('forces microvm when explicitly requested', () => {
    const policy = service.resolveCodeExecutionPolicy(
      'javascript',
      'console.log("safe")',
      'microvm',
    );
    expect(policy.securityLevel).toBe('microvm');
  });

  it('routes wasm modules to the wasm tier by default', () => {
    const policy = service.resolveCodeExecutionPolicy(
      'wasm',
      'AGFzbQEAAAABBQFgAAF/AwIBAAcIAQRtYWluAAAKBgEEAEEqCw==',
    );
    expect(policy.securityLevel).toBe('wasm');
  });

  it('accepts explicit wasm preference for wasm modules', () => {
    const policy = service.resolveCodeExecutionPolicy(
      'wasm',
      'AGFzbQEAAAABBQFgAAF/AwIBAAcIAQRtYWluAAAKBgEEAEEqCw==',
      'wasm',
    );
    expect(policy.securityLevel).toBe('wasm');
  });

  // -------------------------------------------------------------------------
  // Security: never downgrade
  // -------------------------------------------------------------------------
  it('never downgrades high-risk code even if user requests local-jail', () => {
    const policy = service.resolveCodeExecutionPolicy(
      'python',
      'import subprocess; subprocess.Popen(["rm", "-rf", "/"])',
      'local-jail',
    );
    // High-risk pattern overrides user preference
    expect(policy.securityLevel).toBe('microvm');
  });

  it('never downgrades high-risk code even if user requests container', () => {
    const policy = service.resolveCodeExecutionPolicy(
      'shell',
      'sudo chmod +s /bin/bash',
      'container',
    );
    // High-risk pattern overrides user preference
    expect(policy.securityLevel).toBe('microvm');
  });

  // -------------------------------------------------------------------------
  // Language inference
  // -------------------------------------------------------------------------
  it('infers javascript from npm/node commands', () => {
    expect(service.inferExecutionSandboxLanguage('npm test')).toBe('javascript');
    expect(service.inferExecutionSandboxLanguage('node index.js')).toBe('javascript');
  });

  it('infers python from python/pip commands', () => {
    expect(service.inferExecutionSandboxLanguage('python3 main.py')).toBe('python');
    expect(service.inferExecutionSandboxLanguage('pip install flask')).toBe('python');
  });

  it.each([
    'node script.js',
    'npm run build',
    'npx jest',
    'python script.py',
    'py -m pytest',
    'pip install requests',
  ])('requires container for local code-capable execution: %s', (command) => {
    expect(service.requiresContainerForExecution({
      execution_id: 'exec-1',
      task_id: 'task-1',
      executor: 'local_executor',
      workspace: process.cwd(),
      objective: command,
      instructions: [command],
      allowed_paths: [],
      blocked_paths: [],
      allowed_commands: [],
      blocked_commands: [],
      timeout_seconds: 30,
      dry_run: false,
      requires_backup: false,
      metadata: {},
    })).toBe(true);
  });

  it('defaults to shell for unknown commands', () => {
    expect(service.inferExecutionSandboxLanguage('ls -la')).toBe('shell');
  });
});
