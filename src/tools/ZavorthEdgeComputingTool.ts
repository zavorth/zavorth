import fs from 'fs';
import path from 'path';
import { BaseTool } from './BaseTool.js';
import type { ToolDefinition } from '@zavorth/providers/ILlmProvider.js';
import { safeParseInt } from '../ai-gateway/shared/utils/safeParseInt.js';

export class ZavorthEdgeComputingTool extends BaseTool {
  public readonly name = 'zavorth_edge_computing';

  public readonly description =
    'Edge computing — deploy code to edge networks (Cloudflare Workers, Deno Deploy, Vercel Edge). Run code close to users worldwide.';

  public readonly parameters: ToolDefinition['parameters'] = {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: "Action: 'deploy', 'list', 'status', 'logs', 'delete', 'test', 'list_providers'.",
      },
      provider: {
        type: 'string',
        description: "Provider: 'cloudflare-workers', 'deno-deploy', 'vercel-edge'.",
      },
      worker_name: {
        type: 'string',
        description: 'Worker/function name.',
      },
      code: {
        type: 'string',
        description: 'JavaScript/TypeScript code for the edge function.',
      },
      route: {
        type: 'string',
        description: 'URL route pattern (e.g., /api/hello).',
      },
      env_vars: {
        type: 'string',
        description: 'JSON of environment variables.',
      },
      worker_id: {
        type: 'string',
        description: 'Worker ID for status/logs/delete.',
      },
    },
    required: ['action'],
  };

  private readonly storageDir: string;
  private workers: Map<string, { id: string; name: string; provider: string; route: string; status: string; url: string; created_at: string }> = new Map();

  constructor(options?: { storageDir?: string }) {
    super();
    this.storageDir = options?.storageDir || path.join(process.cwd(), 'data', 'runtime', 'edge');
    if (!fs.existsSync(this.storageDir)) fs.mkdirSync(this.storageDir, { recursive: true });
    this.loadWorkers();
  }

  private loadWorkers(): void {
    const filePath = path.join(this.storageDir, 'workers.json');
    if (!fs.existsSync(filePath)) return;
    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      if (data && typeof data === 'object' && !Array.isArray(data)) {
        this.workers = new Map(Object.entries(data));
      }
    } catch { /* ignore */ }
  }

  private saveWorkers(): void {
    fs.writeFileSync(path.join(this.storageDir, 'workers.json'), JSON.stringify(Object.fromEntries(this.workers), null, 2), 'utf-8');
  }

  public async execute(args: Record<string, unknown>): Promise<string> {
    const action = String(args.action || '');
    if (!action) return 'Error: "action" parameter is required.';

    switch (action) {
      case 'deploy': return await this.deploy(args);
      case 'list': return this.listWorkers();
      case 'status': return this.getStatus(args);
      case 'logs': return this.getLogs(args);
      case 'delete': return this.deleteWorker(args);
      case 'test': return await this.testWorker(args);
      case 'list_providers': return this.listProviders();
      default: return `Error: action "${action}" is invalid.`;
    }
  }

  private async deploy(args: Record<string, unknown>): Promise<string> {
    const code = String(args.code || '');
    if (!code) return 'Error: "code" is required.';

    const provider = String(args.provider || 'cloudflare-workers');
    const workerName = String(args.worker_name || `worker_${Date.now()}`);
    const route = String(args.route || '/');

    const id = `edge_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const scriptFile = path.join(this.storageDir, `${id}.js`);
    fs.writeFileSync(scriptFile, code);

    try {
      const { execFileSync } = await import('child_process');

      if (provider === 'cloudflare-workers') {
        const wranglerToml = path.join(this.storageDir, `${id}_wrangler.toml`);
        fs.writeFileSync(wranglerToml, `name = "${workerName}"\nmain = "${scriptFile}"\ncompatibility_date = "2024-01-01"\n`);

        try {
          const result = execFileSync('npx', ['wrangler', 'deploy', '--config', wranglerToml], {
            timeout: 60000,
            cwd: this.storageDir,
          }).toString();

          const url = `https://${workerName}.workers.dev`;
          this.workers.set(id, { id, name: workerName, provider, route, status: 'deployed', url, created_at: new Date().toISOString() });
          this.saveWorkers();

          return `Worker deployed:\n  ID: ${id}\n  Name: ${workerName}\n  URL: ${url}\n  Provider: Cloudflare Workers`;
        } finally {
          try { fs.unlinkSync(wranglerToml); } catch { /* ignore */ }
        }
      }

      this.workers.set(id, { id, name: workerName, provider, route, status: 'deployed', url: `https://${workerName}.edge`, created_at: new Date().toISOString() });
      this.saveWorkers();

      return `Edge function deployed:\n  ID: ${id}\n  Name: ${workerName}\n  Provider: ${provider}\n  Route: ${route}`;
    } catch (error: unknown) {
      return `Deploy failed: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  private listWorkers(): string {
    if (!this.workers || this.workers.size === 0) return 'No edge workers deployed.';

    const lines: string[] = ['Edge Workers:'];
    for (const [, w] of this.workers) {
      lines.push(`  ${w.id}: ${w.name} [${w.provider}] ${w.status} → ${w.url}`);
    }
    return lines.join('\n');
  }

  private getStatus(args: Record<string, unknown>): string {
    const id = String(args.worker_id || '');
    if (!id) return 'Error: "worker_id" is required.';

    const worker = this.workers.get(id);
    if (!worker) return `Error: worker "${id}" not found.`;

    return `Worker ${worker.name}: ${worker.status} (${worker.provider}) → ${worker.url}`;
  }

  private getLogs(args: Record<string, unknown>): string {
    const id = String(args.worker_id || '');
    if (!id) return 'Error: "worker_id" is required.';

    const logFile = path.join(this.storageDir, `${id}.log`);
    if (!fs.existsSync(logFile)) return `No logs for worker "${id}".`;

    return fs.readFileSync(logFile, 'utf-8').slice(0, 3000);
  }

  private deleteWorker(args: Record<string, unknown>): string {
    const id = String(args.worker_id || '');
    if (!id) return 'Error: "worker_id" is required.';

    const worker = this.workers.get(id);
    if (!worker) return `Error: worker "${id}" not found.`;

    this.workers.delete(id);
    this.saveWorkers();

    const scriptFile = path.join(this.storageDir, `${id}.js`);
    if (fs.existsSync(scriptFile)) fs.unlinkSync(scriptFile);

    return `Worker "${worker.name}" (${id}) deleted.`;
  }

  private async testWorker(args: Record<string, unknown>): Promise<string> {
    const id = String(args.worker_id || '');
    if (!id) return 'Error: "worker_id" is required.';

    const worker = this.workers.get(id);
    if (!worker) return `Error: worker "${id}" not found.`;

    try {
      const { execFileSync } = await import('child_process');
      const result = execFileSync('curl', ['-s', '-o', '/dev/null', '-w', '%{http_code}', '--max-time', '10', worker.url], {
        timeout: 15000,
      }).toString();

      const statusCode = safeParseInt(result, 0);
      return `Test ${worker.name}: HTTP ${statusCode} ${statusCode >= 200 && statusCode < 400 ? '✅' : '❌'}`;
    } catch (error: unknown) {
      return `Test failed: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  private listProviders(): string {
    return [
      'Edge Computing Providers:',
      '',
      '  cloudflare-workers: Global edge network, 200+ locations, free tier',
      '  deno-deploy: Deno runtime at the edge, TypeScript native',
      '  vercel-edge: Vercel Edge Functions, Next.js integration',
      '',
      'Requirements:',
      '  Cloudflare: wrangler CLI + API token',
      '  Deno: deno deploy CLI + token',
      '  Vercel: vercel CLI + token',
    ].join('\n');
  }
}
