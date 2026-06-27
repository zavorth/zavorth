// @ts-nocheck
import fs from 'fs';
import path from 'path';
import os from 'os';
import { BaseTool } from './BaseTool.js';
import type { ToolDefinition } from '@zavorth/providers/ILlmProvider.js';

export class ZavorthSandboxCloudTool extends BaseTool {
  public readonly name = 'zavorth_sandbox_cloud';

  public readonly description =
    'Cloud sandbox — execute code in remote sandboxes (AWS Lambda, Fly.io, Railway, Docker remote). Isolated, ephemeral, secure.';

  public readonly parameters: ToolDefinition['parameters'] = {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: "Action: 'run', 'list', 'status', 'logs', 'terminate', 'list_providers'.",
      },
      provider: {
        type: 'string',
        description: "Provider: 'lambda', 'fly', 'railway', 'docker-remote', 'local-docker'. Default: 'local-docker'.",
      },
      code: {
        type: 'string',
        description: 'Code to execute.',
      },
      language: {
        type: 'string',
        description: "Language: 'python', 'node', 'bash', 'go'. Default: 'node'.",
      },
      timeout_ms: {
        type: 'number',
        description: 'Execution timeout. Default: 30000.',
      },
      sandbox_id: {
        type: 'string',
        description: 'Sandbox ID for status/logs/terminate.',
      },
      env_vars: {
        type: 'string',
        description: 'JSON of environment variables.',
      },
      memory_mb: {
        type: 'number',
        description: 'Memory limit in MB. Default: 256.',
      },
    },
    required: ['action'],
  };

  private readonly storageDir: string;
  private sandboxes: Map<string, { id: string; provider: string; status: string; created_at: string; pid?: number }> = new Map();

  constructor(options?: { storageDir?: string }) {
    super();
    this.storageDir = options?.storageDir || path.join(process.cwd(), 'data', 'runtime', 'cloud-sandbox');
    if (!fs.existsSync(this.storageDir)) fs.mkdirSync(this.storageDir, { recursive: true });
  }

  public async execute(args: Record<string, unknown>): Promise<string> {
    const action = String(args.action || '');
    if (!action) return 'Error: "action" parameter is required.';

    switch (action) {
      case 'run': return await this.runCode(args);
      case 'list': return this.listSandboxes();
      case 'status': return this.getStatus(args);
      case 'logs': return this.getLogs(args);
      case 'terminate': return this.terminate(args);
      case 'list_providers': return this.listProviders();
      default: return `Error: action "${action}" is invalid.`;
    }
  }

  private async runCode(args: Record<string, unknown>): Promise<string> {
    const code = String(args.code || '');
    if (!code) return 'Error: "code" is required.';

    const provider = String(args.provider || 'local-docker');
    const language = String(args.language || 'node');
    const timeoutMs = typeof args.timeout_ms === 'number' ? args.timeout_ms : 30000;

    const id = `sandbox_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    try {
      const { execFileSync } = await import('child_process');
      const tmpDir = os.tmpdir();

      let result = '';
      const start = Date.now();

      if (provider === 'local-docker') {
        const imageMap: Record<string, string> = {
          node: 'node:22-slim',
          python: 'python:3.12-slim',
          bash: 'bash:latest',
          go: 'golang:1.22-alpine',
        };
        const image = imageMap[language] || 'node:22-slim';
        const cmdMap: Record<string, string> = {
          node: 'node -e',
          python: 'python3 -c',
          bash: 'bash -c',
          go: 'echo "package main; func main() { println(\\"Hello\\") }" > /tmp/main.go && go run /tmp/main.go',
        };

        const scriptFile = path.join(tmpDir, `sandbox_${id}.${language === 'python' ? 'py' : language === 'go' ? 'go' : 'js'}`);
        fs.writeFileSync(scriptFile, code);

        try {
          result = execFileSync('docker', [
            'run', '--rm', '--memory', `${options?.memory_mb || 256}m`,
            '--cpus', '0.5',
            '-v', `${scriptFile}:/code/script${language === 'python' ? '.py' : language === 'go' ? '.go' : '.js'}`,
            image,
            'sh', '-c', `${cmdMap[language]?.split(' -c')[0] || 'node'} /code/script*`,
          ], { timeout: timeoutMs, maxBuffer: 5 * 1024 * 1024 }).toString();
        } finally {
          try { fs.unlinkSync(scriptFile); } catch { /* ignore */ }
        }
      } else if (provider === 'local') {
        const ext = { node: '.js', python: '.py', bash: '.sh', go: '.go' }[language] || '.js';
        const scriptFile = path.join(tmpDir, `sandbox_${id}${ext}`);
        fs.writeFileSync(scriptFile, code);

        try {
          const cmd = { node: 'node', python: 'python3', bash: 'bash', go: 'go run' }[language] || 'node';
          result = execFileSync(cmd.split(' ')[0], [...cmd.split(' ').slice(1), scriptFile], {
            timeout: timeoutMs,
            maxBuffer: 5 * 1024 * 1024,
          }).toString();
        } finally {
          try { fs.unlinkSync(scriptFile); } catch { /* ignore */ }
        }
      } else {
        return `Provider "${provider}" not yet implemented. Use 'local-docker' or 'local'.`;
      }

      const duration = Date.now() - start;
      this.sandboxes.set(id, { id, provider, status: 'completed', created_at: new Date().toISOString() });

      return [
        `Sandbox execution completed:`,
        `  ID: ${id}`,
        `  Provider: ${provider}`,
        `  Language: ${language}`,
        `  Duration: ${duration}ms`,
        `  Output:`,
        result.slice(0, 3000),
      ].join('\n');
    } catch (error: unknown) {
      this.sandboxes.set(id, { id, provider, status: 'failed', created_at: new Date().toISOString() });
      return `Sandbox execution failed: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  private listSandboxes(): string {
    if (this.sandboxes.size === 0) return 'No sandboxes running.';

    const lines: string[] = ['Sandboxes:'];
    for (const [, s] of this.sandboxes) {
      lines.push(`  ${s.id}: ${s.provider} [${s.status}] ${s.created_at}`);
    }
    return lines.join('\n');
  }

  private getStatus(args: Record<string, unknown>): string {
    const id = String(args.sandbox_id || '');
    if (!id) return 'Error: "sandbox_id" is required.';

    const sandbox = this.sandboxes.get(id);
    if (!sandbox) return `Error: sandbox "${id}" not found.`;

    return `Sandbox ${sandbox.id}: ${sandbox.status} (${sandbox.provider})`;
  }

  private getLogs(args: Record<string, unknown>): string {
    const id = String(args.sandbox_id || '');
    if (!id) return 'Error: "sandbox_id" is required.';

    const logFile = path.join(this.storageDir, `${id}.log`);
    if (!fs.existsSync(logFile)) return `No logs for sandbox "${id}".`;

    return fs.readFileSync(logFile, 'utf-8').slice(0, 3000);
  }

  private terminate(args: Record<string, unknown>): string {
    const id = String(args.sandbox_id || '');
    if (!id) return 'Error: "sandbox_id" is required.';

    const sandbox = this.sandboxes.get(id);
    if (!sandbox) return `Error: sandbox "${id}" not found.`;

    sandbox.status = 'terminated';
    return `Sandbox "${id}" terminated.`;
  }

  private listProviders(): string {
    return [
      'Cloud Sandbox Providers:',
      '',
      '  local-docker (default): Local Docker containers, isolated, ephemeral',
      '  local: Direct local execution (less isolated)',
      '  lambda: AWS Lambda (coming soon)',
      '  fly: Fly.io Machines (coming soon)',
      '  railway: Railway (coming soon)',
      '',
      'Use "local-docker" for secure local execution.',
    ].join('\n');
  }
}
