import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ZavorthCloudSandboxAdapterService } from '../../src/services/ZavorthCloudSandboxAdapterService';
import { ZavorthSandboxCloudTool } from '../../src/tools/ZavorthSandboxCloudTool';

describe('ZavorthSandboxCloudTool cloud adapter contract', () => {
  const storageDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-cloud-tool-'));

  it('lists Zavorth sandbox providers without coming-soon placeholders', async () => {
    const tool = new ZavorthSandboxCloudTool({ storageDir: storageDir() });

    const output = await tool.execute({ action: 'list_providers' });

    expect(output).toContain('local-docker');
    expect(output).toContain('daytona');
    expect(output).toContain('modal');
    expect(output).toContain('external');
    expect(output.toLowerCase()).not.toContain('coming soon');
    expect(output).not.toContain('lambda');
    expect(output).not.toContain('fly');
    expect(output).not.toContain('railway');
  });

  it('reports disabled Daytona as an explicit provider state', async () => {
    const tool = new ZavorthSandboxCloudTool({
      storageDir: storageDir(),
      sandboxService: new ZavorthCloudSandboxAdapterService({ env: {} }),
    });

    const output = await tool.execute({
      action: 'run',
      provider: 'daytona',
      code: 'console.log("hello")',
      env_vars: '{"OPENAI_API_KEY":"sk-test-secret"}',
    });

    expect(output).toContain('Sandbox execution blocked');
    expect(output).toContain('Provider: daytona');
    expect(output).toContain('disabled by default');
    expect(output).not.toContain('sk-test-secret');
  });

  it('normalizes docker provider requests to local-docker through the service contract', async () => {
    let capturedProvider: string | null | undefined;
    const tool = new ZavorthSandboxCloudTool({
      storageDir: storageDir(),
      sandboxService: {
        execute: async (input: { provider?: string | null }) => {
          capturedProvider = input.provider;
          return {
            status: 'completed',
            provider: 'local-docker',
            stdout: 'ok\n',
            stderr: '',
            exitCode: 0,
            durationMs: 12,
            message: 'Local Docker sandbox execution completed.',
            limits: {
              timeoutMs: 30000,
              memoryMb: 512,
              ttlMs: 600000,
              network: 'none',
            },
            redaction: {
              envSecretsStripped: true,
              rawSecretSerialized: false,
            },
          };
        },
        listProviders: () => [],
      },
    } as any);

    const output = await tool.execute({
      action: 'run',
      provider: 'docker',
      code: 'console.log("ok")',
    });

    expect(capturedProvider).toBe('docker');
    expect(output).toContain('Provider: local-docker');
    expect(output).toContain('ok');
  });

  it('redacts secret-looking values from persisted sandbox logs', async () => {
    const dir = storageDir();
    const openAiLikeSecret = ['sk', 'test-secret-value-1234567890'].join('-');
    const githubLikeSecret = `ghp_${'123456789012345678901234567890123456'}`;
    const tool = new ZavorthSandboxCloudTool({
      storageDir: dir,
      sandboxService: {
        execute: async () => ({
          status: 'completed',
          provider: 'local-docker',
          stdout: `token ${openAiLikeSecret}\n`,
          stderr: `${githubLikeSecret}\n`,
          exitCode: 0,
          durationMs: 12,
          message: 'Local Docker sandbox execution completed.',
          limits: {
            timeoutMs: 30000,
            memoryMb: 512,
            ttlMs: 600000,
            network: 'none',
          },
          redaction: {
            envSecretsStripped: true,
            rawSecretSerialized: false,
          },
        }),
        listProviders: () => [],
      },
    } as any);

    const output = await tool.execute({
      action: 'run',
      code: 'console.log("secret")',
    });
    const sandboxId = output.match(/ID: (sandbox_[^\n]+)/)?.[1];
    expect(sandboxId).toBeTruthy();

    const logs = await tool.execute({
      action: 'logs',
      sandbox_id: sandboxId,
    });

    expect(logs).toContain('[redacted-secret]');
    expect(logs).not.toContain(openAiLikeSecret);
    expect(logs).not.toContain(githubLikeSecret);
  });
});
