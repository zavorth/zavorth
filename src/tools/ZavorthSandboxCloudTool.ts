import fs from 'fs';
import path from 'path';
import { BaseTool } from './BaseTool.js';
import type { ToolDefinition } from '@zavorth/providers/ILlmProvider.js';
import { logger } from '../logger.js';
import {
ZavorthCloudSandboxAdapterService,
  type ZavorthCloudSandboxExecutionResult,
} from '../services/ZavorthCloudSandboxAdapterService.js';

type SandboxService = Pick<ZavorthCloudSandboxAdapterService, 'execute' | 'listProviders'>;

export class ZavorthSandboxCloudTool extends BaseTool {
  public readonly name = 'zavorth_sandbox_cloud';

  public readonly description =
    'Cloud sandbox - execute code in local, Docker, Daytona, Modal, or explicitly configured external sandboxes.';

  public readonly parameters: ToolDefinition['parameters'] = {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: "Action: 'run', 'list', 'status', 'logs', 'terminate', 'list_providers'.",
      },
      provider: {
        type: 'string',
        description: "Provider: 'local', 'docker'/'local-docker', 'daytona', 'modal', or 'external'. Default: 'local-docker' unless configured.",
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
        description: 'JSON of environment variables. Secret-looking names are stripped before cloud execution.',
      },
      memory_mb: {
        type: 'number',
        description: 'Memory limit in MB. Default: 256 local, 512 cloud.',
      },
      ttl_ms: {
        type: 'number',
        description: 'Sandbox TTL in milliseconds. Default: 600000.',
      },
      network: {
        type: 'string',
        description: "Network policy: 'none' or 'egress'. Default: 'none'.",
      },
    },
    required: ['action'],
  };

  private readonly storageDir: string;
  private readonly sandboxService: SandboxService;
  private sandboxes: Map<string, { id: string; provider: string; status: string; created_at: string }> = new Map();

  constructor(options?: { storageDir?: string; sandboxService?: SandboxService }) {
    super();
    this.storageDir = options?.storageDir || path.join(process.cwd(), 'data', 'runtime', 'cloud-sandbox');
    this.sandboxService = options?.sandboxService || new ZavorthCloudSandboxAdapterService();
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

    const id = `sandbox_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const requestedProvider = args.provider == null ? null : String(args.provider);

    try {
      const result = await this.sandboxService.execute({
        provider: requestedProvider,
        code,
        language: String(args.language || 'node'),
        timeoutMs: numberArg(args.timeout_ms),
        memoryMb: numberArg(args.memory_mb),
        ttlMs: numberArg(args.ttl_ms),
        network: args.network == null ? null : String(args.network),
        env: parseEnvVars(args.env_vars),
      });
      this.sandboxes.set(id, {
        id,
        provider: result.provider,
        status: result.status,
        created_at: new Date().toISOString(),
      });
      this.writeLog(id, result);
      return this.formatRunResult(id, result);
    } catch (error: any) {
      this.sandboxes.set(id, {
        id,
        provider: requestedProvider || 'local-docker',
        status: 'failed',
        created_at: new Date().toISOString(),
      });
      return `Sandbox execution failed: ${redactSecrets(error instanceof Error ? error.message : String(error))}`;
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

    return redactSecrets(fs.readFileSync(logFile, 'utf-8')).slice(0, 3000);
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
    const providers = this.sandboxService.listProviders();
    return [
      'Cloud Sandbox Providers:',
      '',
      ...providers.map((provider) => [
        `  ${provider.id}${provider.id === 'local-docker' ? ' (default)' : ''}: ${provider.label}`,
        `    Enabled: ${provider.enabled}`,
        `    Configured: ${provider.configured}`,
        provider.sdkPackage ? `    SDK: ${provider.sdkPackage} (${provider.installCommand})` : null,
        provider.disabledReason && !provider.enabled ? `    Status: ${provider.disabledReason}` : null,
      ].filter(Boolean).join('\n')),
      '',
      'Cloud providers are disabled unless explicitly enabled and credentialed.',
    ].join('\n');
  }

  private formatRunResult(id: string, result: ZavorthCloudSandboxExecutionResult): string {
    const title = result.status === 'completed'
      ? 'Sandbox execution completed:'
      : result.status === 'blocked'
        ? 'Sandbox execution blocked:'
        : 'Sandbox execution failed:';
    return [
      title,
      `  ID: ${id}`,
      `  Provider: ${result.provider}`,
      `  Status: ${result.status}`,
      `  Duration: ${result.durationMs}ms`,
      `  Timeout: ${result.limits.timeoutMs}ms`,
      `  Memory: ${result.limits.memoryMb}MB`,
      `  TTL: ${result.limits.ttlMs}ms`,
      `  Network: ${result.limits.network}`,
      `  Message: ${result.message}`,
      result.stdout ? `  Output:\n${redactSecrets(result.stdout).slice(0, 3000)}` : '',
      result.stderr ? `  Error Output:\n${redactSecrets(result.stderr).slice(0, 3000)}` : '',
    ].filter(Boolean).join('\n');
  }

  private writeLog(id: string, result: ZavorthCloudSandboxExecutionResult): void {
    const logFile = path.join(this.storageDir, `${id}.log`);
    const log = [
      `provider=${result.provider}`,
      `status=${result.status}`,
      `message=${result.message}`,
      '',
      '[stdout]',
      redactSecrets(result.stdout),
      '',
      '[stderr]',
      redactSecrets(result.stderr),
    ].join('\n');
    fs.writeFileSync(logFile, log, 'utf8');
  }
}

function redactSecrets(value: string): string {
  return String(value || '')
    .replace(/\bsk-[A-Za-z0-9_-]{8,}\b/g, '[redacted-secret]')
    .replace(/\bsk-ant-[A-Za-z0-9_-]{20,}\b/g, '[redacted-secret]')
    .replace(/\bhf_[A-Za-z0-9]{8,}\b/g, '[redacted-secret]')
    .replace(/\bxox[baprs]-[A-Za-z0-9-]{8,}\b/g, '[redacted-secret]')
    .replace(/\bgh[pousr]_[A-Za-z0-9_]{8,}\b/g, '[redacted-secret]')
    .replace(/\bAIza[0-9A-Za-z_-]{20,}\b/g, '[redacted-secret]')
    .replace(/\bAKIA[0-9A-Z]{16}\b/g, '[redacted-secret]')
    .replace(/\b[A-Za-z0-9_-]{24,}\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}\b/g, '[redacted-secret]');
}

function numberArg(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function parseEnvVars(value: unknown): Record<string, string> {
  if (!value) return {};
  if (typeof value === 'object' && !Array.isArray(value)) {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .map(([key, entry]) => [key, String(entry ?? '')]),
    );
  }
  try {
    const parsed = JSON.parse(String(value));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {};
    }
    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>)
        .map(([key, entry]) => [key, String(entry ?? '')]),
    );
  } catch (error: any) { logger.warn('[Zavorth Sandbox Cloud] JSON parse failed', error); return {}; }
}
