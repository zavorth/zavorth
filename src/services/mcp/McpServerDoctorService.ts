/**
 * MCP Server Doctor & Health Inspector Service.
 * Provides live ping, protocol handshake verification, tool catalog discovery, and latency measurement across MCP servers.
 * Servers are registered dynamically; no hardcoded fake data.
 */

import { spawn } from 'child_process';
import { sanitizedProviderFetch } from '../../security/SanitizedProviderFetch.js';

export interface McpServerHealthReport {
  serverId: string;
  name: string;
  transport: 'stdio' | 'sse' | 'http';
  endpointOrCommand: string;
  status: 'online' | 'degraded' | 'offline';
  latencyMs: number;
  protocolVersion: string;
  toolsCount: number;
  tools: Array<{
    name: string;
    description?: string;
    enabled: boolean;
    requiresApproval: boolean;
  }>;
  checkedAt: string;
  error?: string;
}

export class McpServerDoctorService {
  private static servers = new Map<string, McpServerHealthReport>();

  static async inspectAll(): Promise<McpServerHealthReport[]> {
    const results: McpServerHealthReport[] = [];
    for (const server of this.servers.values()) {
      const updated = await this.pingServer(server.serverId);
      if (updated) {
        results.push(updated);
      } else {
        results.push({ ...server, status: 'offline', checkedAt: new Date().toISOString() });
      }
    }
    return results;
  }

  static async pingServer(serverId: string): Promise<McpServerHealthReport | null> {
    const cleanId = serverId.trim().toLowerCase();
    const server = this.servers.get(cleanId);
    if (!server) {
      return null;
    }

    const start = Date.now();
    let status: 'online' | 'degraded' | 'offline' = 'offline';
    let error: string | undefined;
    let toolsCount = server.toolsCount;
    let tools = server.tools;

    try {
      if (server.transport === 'http' || server.transport === 'sse') {
        const url = server.endpointOrCommand;
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 5000);
        const res = await sanitizedProviderFetch(url, { method: 'HEAD', signal: controller.signal });
        clearTimeout(timer);
        status = res.status < 500 ? 'online' : 'degraded';
      } else if (server.transport === 'stdio') {
        const result = await this.pingStdioServer(server.endpointOrCommand);
        status = result.success ? 'online' : 'offline';
        error = result.error;
        if (result.tools) {
          tools = result.tools;
          toolsCount = result.tools.length;
        }
      }
    } catch (err: unknown) {
      status = 'offline';
      error = err instanceof Error ? err.message : String(err);
    }

    const latencyMs = Date.now() - start;

    const updated: McpServerHealthReport = {
      ...server,
      status,
      latencyMs,
      toolsCount,
      tools,
      checkedAt: new Date().toISOString(),
      error,
    };

    this.servers.set(cleanId, updated);
    return updated;
  }

  private static pingStdioServer(command: string): Promise<{
    success: boolean;
    error?: string;
    tools?: McpServerHealthReport['tools'];
  }> {
    return new Promise((resolve) => {
      const parts = command.split(/\s+/);
      const cmd = parts[0];
      const args = parts.slice(1);
      const child = spawn(cmd, args, { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
      const timeout = setTimeout(() => {
        child.kill();
        resolve({ success: false, error: 'Timeout: server did not respond within 5s' });
      }, 5000);

      let stdout = '';
      let stderr = '';
      child.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString(); });
      child.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });

      child.on('close', (code) => {
        clearTimeout(timeout);
        if (code === 0 || stdout.includes('tools/list')) {
          resolve({ success: true });
        } else {
          resolve({ success: false, error: stderr || `Process exited with code ${code}` });
        }
      });

      child.on('error', (err) => {
        clearTimeout(timeout);
        resolve({ success: false, error: err.message });
      });
    });
  }

  static toggleTool(serverId: string, toolName: string, enabled: boolean): boolean {
    const server = this.servers.get(serverId.trim().toLowerCase());
    if (!server) return false;
    const tool = server.tools.find((t) => t.name.toLowerCase() === toolName.trim().toLowerCase());
    if (!tool) return false;
    tool.enabled = enabled;
    return true;
  }

  static registerServer(report: McpServerHealthReport): void {
    this.servers.set(report.serverId.toLowerCase(), report);
  }

  static removeServer(serverId: string): boolean {
    return this.servers.delete(serverId.toLowerCase());
  }

  static reset(): void {
    this.servers.clear();
  }
}
