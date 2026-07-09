import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';
import { LogRepository } from '../storage/LogRepository.js';
import { McpManifestLoader, type McpServerManifestEntry, type ResolvedMcpServerManifestEntry } from './McpManifest.js';export type McpInstallRequest = {
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
 * McpManagementService — Gerencia o ciclo de vida de servidores MCP:
 * instalacao, remocao, toggle e persistencia no manifesto JSON.
 *
 * This service does not start or stop processes directly; it manages
 * o manifesto e delega operacoes de runtime ao McpRuntimeService.
 */
export class McpManagementService {
  private readonly manifestPath: string;
  private readonly logRepo: LogRepository | null;

  constructor(runtime: McpManagementRuntime = {}) {
    this.manifestPath = path.resolve(runtime.manifestPath || config.mcpServersManifestPath);
    this.logRepo = runtime.logRepo || null;
  }

  /**
   * Instala (ou atualiza) um servidor MCP no manifesto local.
   * Retorna o resultado da operacao sem iniciar o servidor — o chamador
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
      this.log('info', `Servidor MCP "${id}" atualizado no manifesto.`);
      return {
        success: true,
        serverId: id,
        action: 'updated',
        message: `Servidor MCP "${id}" foi atualizado no manifesto.`,
      };
    }

    manifest.push(entry);
    this.writeManifest(manifest);
    this.log('info', `Servidor MCP "${id}" instalado no manifesto.`);
    return {
      success: true,
      serverId: id,
      action: 'installed',
      message: `Servidor MCP "${id}" foi adicionado ao manifesto com sucesso.`,
    };
  }

  /**
   * Remove um servidor MCP do manifesto local.
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
    this.log('info', `Servidor MCP "${id}" removido do manifesto.`);
    return {
      success: true,
      serverId: id,
      action: 'removed',
      message: `Servidor MCP "${id}" foi removido do manifesto com sucesso.`,
    };
  }

  /**
   * Habilita ou desabilita um servidor MCP no manifesto.
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
    this.log('info', `Servidor MCP "${id}" ${enabled ? 'habilitado' : 'desabilitado'}.`);
    return {
      success: true,
      serverId: id,
      action: 'updated',
      message: `Servidor MCP "${id}" foi ${enabled ? 'habilitado' : 'desabilitado'}.`,
    };
  }

  /**
   * Lista todos os servidores MCP registrados no manifesto.
   */
  public list(): McpServerManifestEntry[] {
    return this.readManifest();
  }

  /**
   * Retorna os dados de um servidor especifico.
   */
  public get(serverId: string): McpServerManifestEntry | null {
    const id = this.normalizeId(serverId);
    const manifest = this.readManifest();
    return manifest.find((entry) => this.normalizeId(entry.id) === id) || null;
  }

  /**
   * Verifica se um servidor com o dado id existe no manifesto.
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
