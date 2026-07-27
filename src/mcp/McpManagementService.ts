import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';
import { LogRepository } from '../storage/LogRepository.js';
import { McpManifestLoader, type McpServerManifestEntry, type ResolvedMcpServerManifestEntry } from './McpManifest.js';
export type McpInstallRequest = {
  id: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
  capability?: string;
  enabled?: boolean;
};

export type McpInstallResult = {
  success: boolean;
  serverId: string;
  action: 'installed' | 'updated' | 'already_exists' | 'failed';
  message: string;
  riskLevel?: number;
  riskReasons?: string[];
};

export type McpRemoveResult = {
  success: boolean;
  serverId: string;
  action: 'removed' | 'not_found' | 'failed';
  message: string;
};

export type McpServerInfo = {
  id: string;
  command: string;
  args: string[];
  env: Record<string, string>;
  capability: string | null;
  enabled: boolean;
  runtimeStatus: 'unknown' | 'connected' | 'failed' | 'disabled' | 'stopped' | 'manifest_only';
  toolCount: number;
  toolNames: string[];
};

type McpManagementRuntime = {
  manifestPath?: string;
  logRepo?: LogRepository | null;
};

/**
 * McpManagementService — Manages the lifecycle of MCP servers:
 * installation, removal, toggle and persistence in the JSON manifest.
 *
 * This service does not start or stop processes directly; it manages
 * the manifest and delegates runtime operations to McpRuntimeService.
 */
export class McpManagementService {
  private readonly manifestPath: string;
  private readonly logRepo: LogRepository | null;

  constructor(runtime: McpManagementRuntime = {}) {
    this.manifestPath = path.resolve(runtime.manifestPath || config.mcpServersManifestPath);
    this.logRepo = runtime.logRepo || null;
  }

  /**
   * Installs (or updates) an MCP server in the local manifest.
   * Returns the operation result without starting the server — the caller
   * should invoke McpRuntimeService.reloadServer() after approval.
   */
  public install(request: McpInstallRequest): McpInstallResult {
    const id = this.normalizeId(request.id);
    if (!id) {
      return {
        success: false,
        serverId: request.id || '',
        action: 'failed',
        message: 'MCP server id cannot be empty.',
      };
    }

    const command = String(request.command || '').trim();
    if (!command) {
      return {
        success: false,
        serverId: id,
        action: 'failed',
        message: 'MCP server command cannot be empty.',
      };
    }

    const manifest = this.readManifest();
    const existingIndex = manifest.findIndex((entry) => this.normalizeId(entry.id) === id);
    const entry: McpServerManifestEntry = {
      id,
      enabled: request.enabled !== false,
      command,
      args: Array.isArray(request.args) ? request.args : [],
      env: request.env || {},
      capability: request.capability || undefined,
    };

    if (existingIndex >= 0) {
      manifest[existingIndex] = entry;
      this.writeManifest(manifest);
      this.log('info', `MCP server "${id}" updated in manifest.`);
      return {
        success: true,
        serverId: id,
        action: 'updated',
        message: `MCP server "${id}" has been updated in the manifest.`,
      };
    }

    manifest.push(entry);
    this.writeManifest(manifest);
    this.log('info', `MCP server "${id}" installed in manifest.`);
    return {
      success: true,
      serverId: id,
      action: 'installed',
      message: `MCP server "${id}" has been added to the manifest successfully.`,
    };
  }

  /**
   * Removes an MCP server from the local manifest.
   */
  public remove(serverId: string): McpRemoveResult {
    const id = this.normalizeId(serverId);
    if (!id) {
      return {
        success: false,
        serverId: serverId || '',
        action: 'failed',
        message: 'MCP server id cannot be empty.',
      };
    }

    const manifest = this.readManifest();
    const index = manifest.findIndex((entry) => this.normalizeId(entry.id) === id);
    if (index < 0) {
      return {
        success: false,
        serverId: id,
        action: 'not_found',
        message: `MCP server "${id}" not found in manifest.`,
      };
    }

    manifest.splice(index, 1);
    this.writeManifest(manifest);
    this.log('info', `MCP server "${id}" removed from manifest.`);
    return {
      success: true,
      serverId: id,
      action: 'removed',
      message: `MCP server "${id}" has been removed from the manifest successfully.`,
    };
  }

  /**
   * Enables or disables an MCP server in the manifest.
   */
  public setEnabled(serverId: string, enabled: boolean): McpInstallResult {
    const id = this.normalizeId(serverId);
    const manifest = this.readManifest();
    const index = manifest.findIndex((entry) => this.normalizeId(entry.id) === id);

    if (index < 0) {
      return {
        success: false,
        serverId: id,
        action: 'failed',
        message: `MCP server "${id}" not found in manifest.`,
      };
    }

    manifest[index].enabled = enabled;
    this.writeManifest(manifest);
    this.log('info', `MCP server "${id}" ${enabled ? 'enabled' : 'disabled'}.`);
    return {
      success: true,
      serverId: id,
      action: 'updated',
      message: `MCP server "${id}" has been ${enabled ? 'enabled' : 'disabled'}.`,
    };
  }

  /**
   * Lists all MCP servers registered in the manifest.
   */
  public list(): McpServerManifestEntry[] {
    return this.readManifest();
  }

  /**
   * Returns the data of a specific server.
   */
  public get(serverId: string): McpServerManifestEntry | null {
    const id = this.normalizeId(serverId);
    const manifest = this.readManifest();
    return manifest.find((entry) => this.normalizeId(entry.id) === id) || null;
  }

  /**
   * Checks if a server with the given id exists in the manifest.
   */
  public exists(serverId: string): boolean {
    return this.get(serverId) !== null;
  }

  // -- Persistencia ----------------------------------------------------------

  private readManifest(): McpServerManifestEntry[] {
    if (!fs.existsSync(this.manifestPath)) {
      return [];
    }

    try {
      const raw = fs.readFileSync(this.manifestPath, 'utf8');
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error: unknown) {this.log('warn', `MCP manifest at ${this.manifestPath} cannot be read; using an empty list.`);
      return [];
    }
  }

  private writeManifest(manifest: McpServerManifestEntry[]): void {
    fs.mkdirSync(path.dirname(this.manifestPath), { recursive: true });
    fs.writeFileSync(
      this.manifestPath,
      `${JSON.stringify(manifest, null, 2)}\n`,
      'utf8',
    );
  }

  // -- Utilitarios -----------------------------------------------------------

  private normalizeId(value: string | undefined): string {
    return String(value || '').trim().toLowerCase().replace(/\s+/g, '-');
  }

  private log(level: 'info' | 'warn' | 'error', message: string): void {
    if (this.logRepo) {
      this.logRepo.log(level, 'McpManagement', message);
    }
  }
}
