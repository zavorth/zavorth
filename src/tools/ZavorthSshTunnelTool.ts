import fs from 'fs';
import path from 'path';
import { BaseTool } from './BaseTool.js';
import type { ToolDefinition } from '@zavorth/providers/ILlmProvider.js';
import { logger } from '../logger.js';

export class ZavorthSshTunnelTool extends BaseTool {
  public readonly name = 'zavorth_ssh_tunnel';

  public readonly description =
    'SSH tunnel management — create, list, and close SSH tunnels for secure remote access.';

  public readonly parameters: ToolDefinition['parameters'] = {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: "Action: 'create', 'list', 'close', 'status'.",
      },
      tunnel_id: {
        type: 'string',
        description: 'Tunnel ID (for close/status).',
      },
      host: {
        type: 'string',
        description: 'Remote host.',
      },
      port: {
        type: 'number',
        description: 'Remote port.',
      },
      local_port: {
        type: 'number',
        description: 'Local port to bind.',
      },
      user: {
        type: 'string',
        description: 'SSH username.',
      },
      key_path: {
        type: 'string',
        description: 'Path to SSH private key.',
      },
      tunnel_type: {
        type: 'string',
        description: "Type: 'local' (L), 'remote' (R), 'dynamic' (D). Default: 'local'.",
      },
    },
    required: ['action'],
  };

  private tunnels: Map<string, { id: string; host: string; port: number; local_port: number; type: string; pid: number | null; created_at: string }> = new Map();

  public async execute(args: Record<string, unknown>): Promise<string> {
    const action = String(args.action || '');
    if (!action) return 'Error: "action" parameter is required.';

    switch (action) {
      case 'create': return await this.createTunnel(args);
      case 'list': return this.listTunnels();
      case 'close': return await this.closeTunnel(args);
      case 'status': return this.tunnelStatus(args);
      default: return `Error: action "${action}" is invalid.`;
    }
  }

  private async createTunnel(args: Record<string, unknown>): Promise<string> {
    const host = String(args.host || '');
    const port = Number(args.port || 22);
    const localPort = Number(args.local_port || 0);
    const user = String(args.user || 'root');
    const keyPath = typeof args.key_path === 'string' ? args.key_path : undefined;
    const tunnelType = String(args.tunnel_type || 'local');

    if (!host) return 'Error: "host" is required.';

    const id = `tunnel_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const assignedLocalPort = localPort || (10000 + Math.floor(Math.random() * 50000));

    try {
      const { execFileSync } = await import('child_process');
      const sshArgs = ['-N', '-f'];

      switch (tunnelType) {
        case 'local':
          sshArgs.push('-L', `${assignedLocalPort}:localhost:${port}`);
          break;
        case 'remote':
          sshArgs.push('-R', `${assignedLocalPort}:localhost:${port}`);
          break;
        case 'dynamic':
          sshArgs.push('-D', `${assignedLocalPort}`);
          break;
      }

      if (keyPath) sshArgs.push('-i', keyPath);
      sshArgs.push(`${user}@${host}`);

      execFileSync('ssh', sshArgs, { timeout: 15000 });

      this.tunnels.set(id, {
        id, host, port, local_port: assignedLocalPort, type: tunnelType, pid: null, created_at: new Date().toISOString(),
      });

      return `SSH tunnel created:\n  ID: ${id}\n  Type: ${tunnelType}\n  ${user}@${host}:${port} -> localhost:${assignedLocalPort}`;
    } catch (error: any) { logger.warn('[Zavorth Ssh Tunnel] process execution failed', error); return ''; }
  }

  private listTunnels(): string {
    if (this.tunnels.size === 0) return 'No active SSH tunnels.';

    const lines: string[] = ['SSH Tunnels:'];
    for (const [, t] of this.tunnels) {
      lines.push(`  ${t.id}: ${t.type} ${t.host}:${t.port} -> localhost:${t.local_port}`);
    }
    return lines.join('\n');
  }

  private async closeTunnel(args: Record<string, unknown>): Promise<string> {
    const tunnelId = String(args.tunnel_id || '');
    if (!tunnelId) return 'Error: "tunnel_id" is required.';

    const tunnel = this.tunnels.get(tunnelId);
    if (!tunnel) return `Error: tunnel "${tunnelId}" not found.`;

    this.tunnels.delete(tunnelId);
    return `Tunnel "${tunnelId}" closed.`;
  }

  private tunnelStatus(args: Record<string, unknown>): string {
    const tunnelId = String(args.tunnel_id || '');
    if (!tunnelId) return 'Error: "tunnel_id" is required.';

    const tunnel = this.tunnels.get(tunnelId);
    if (!tunnel) return `Error: tunnel "${tunnelId}" not found.`;

    return [
      `Tunnel: ${tunnel.id}`,
      `  Type: ${tunnel.type}`,
      `  Host: ${tunnel.host}:${tunnel.port}`,
      `  Local: localhost:${tunnel.local_port}`,
      `  Created: ${tunnel.created_at}`,
    ].join('\n');
  }
}
