import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';
import { LogRepository } from '../storage/LogRepository.js';
import { ToolRegistry } from '../tools/ToolRegistry.js';
import { McpClientManager } from './McpClientManager.js';
import {
  McpManifestLoader,
  type ResolvedMcpServerManifestEntry,
} from './McpManifest.js';

type McpManagerLike = {
  readonly name: string;
  connect(registry: ToolRegistry): Promise<void>;
  disconnect(): Promise<void>;
};

type McpManagerFactory = (entry: ResolvedMcpServerManifestEntry) => McpManagerLike;

export type McpRuntimeServerSnapshot = {
  id: string;
  capability: string | null;
  enabled: boolean;
  status: 'manifest_only' | 'connected' | 'failed' | 'disabled' | 'stopped';
  toolCount: number;
  toolNames: string[];
  command: string;
  args: string[];
  lastAttemptedAt: string | null;
  lastConnectedAt: string | null;
  lastError: string | null;
};

export type McpRuntimeSnapshot = {
  generatedAt: string;
  manifestPath: string;
  summary: {
    total: number;
    enabled: number;
    connected: number;
    failed: number;
    disabled: number;
    stopped: number;
    toolCount: number;
  };
  capabilities: string[];
  entries: McpRuntimeServerSnapshot[];
};

export class McpRuntimeService {
  private readonly managers: McpManagerLike[] = [];
  private readonly stateFile: string;
  private entries = new Map<string, McpRuntimeServerSnapshot>();

  constructor(
    private readonly registry: ToolRegistry,
    private readonly logRepo: LogRepository,
    private readonly manifestLoader: McpManifestLoader = new McpManifestLoader(),
    private readonly managerFactory: McpManagerFactory = (entry) =>
      new McpClientManager(entry.id, entry.command, entry.args, entry.env, entry.allowedEnv),
    stateFile: string = config.mcpRuntimeStateFile,
  ) {
    this.stateFile = path.resolve(stateFile);
  }

  public async start(): Promise<void> {
    const servers = this.loadManifestEntries();
    this.entries = new Map(
      servers.map((server) => [
        server.id,
        {
          id: server.id,
          capability: String(server.capability || '').trim() || null,
          enabled: server.enabled !== false,
          status: server.enabled === false ? 'disabled' : 'manifest_only',
          toolCount: 0,
          toolNames: [],
          command: server.command,
          args: [...server.args],
          lastAttemptedAt: null,
          lastConnectedAt: null,
          lastError: null,
        } satisfies McpRuntimeServerSnapshot,
      ]),
    );
    this.writeSnapshot();

    const enabledServers = servers.filter((entry) => entry.enabled !== false);

    if (enabledServers.length === 0) {
      this.logRepo.log('warn', 'MCP', 'Nenhum servidor MCP habilitado no manifesto.');
      this.writeSnapshot();
      return;
    }

    for (const server of enabledServers) {
      const manager = this.managerFactory(server);
      const attemptedAt = new Date().toISOString();
      const entry = this.entries.get(server.id);
      if (entry) {
        entry.lastAttemptedAt = attemptedAt;
        entry.lastError = null;
        this.entries.set(server.id, entry);
      }

      try {
        const beforeTools = new Set(this.registry.getAllTools().map((tool) => tool.name));
        await manager.connect(this.registry);
        this.managers.push(manager);
        const registeredToolNames = this.registry.getAllTools()
          .map((tool) => tool.name)
          .filter((toolName) => !beforeTools.has(toolName));
        const connectedAt = new Date().toISOString();
        this.entries.set(server.id, {
          id: server.id,
          capability: String(server.capability || '').trim() || null,
          enabled: true,
          status: 'connected',
          toolCount: registeredToolNames.length,
          toolNames: registeredToolNames,
          command: server.command,
          args: [...server.args],
          lastAttemptedAt: attemptedAt,
          lastConnectedAt: connectedAt,
          lastError: null,
        });
        this.logRepo.log(
          'info',
          'MCP',
          `Servidor MCP ${server.id} conectado${server.capability ? ` (${server.capability})` : ''}.`,
        );
      } catch (error: any) {
        this.entries.set(server.id, {
          id: server.id,
          capability: String(server.capability || '').trim() || null,
          enabled: true,
          status: 'failed',
          toolCount: 0,
          toolNames: [],
          command: server.command,
          args: [...server.args],
          lastAttemptedAt: attemptedAt,
          lastConnectedAt: null,
          lastError: error?.message || String(error),
        });
        this.logRepo.log(
          'warn',
          'MCP',
          `Falha ao conectar servidor MCP ${server.id}: ${error?.message || error}`,
        );
      }

      this.writeSnapshot();
    }
  }

  public async stop(): Promise<void> {
    while (this.managers.length > 0) {
      const manager = this.managers.pop()!;

      try {
        await manager.disconnect();
      } catch (error: any) {
        this.logRepo.log(
          'warn',
          'MCP',
          `Falha ao desconectar servidor MCP ${manager.name}: ${error?.message || error}`,
        );
      }

      const entry = this.entries.get(manager.name);
      if (entry) {
        this.entries.set(manager.name, {
          ...entry,
          status: 'stopped',
        });
      }
    }

    this.writeSnapshot();
  }

  /**
   * Para um servidor MCP individual sem afetar os outros.
   */
  public async stopServer(serverId: string): Promise<boolean> {
    const managerIndex = this.managers.findIndex((manager) => manager.name === serverId);
    if (managerIndex < 0) {
      return false;
    }

    const manager = this.managers[managerIndex];
    try {
      await manager.disconnect();
    } catch (error: any) {
      this.logRepo.log(
        'warn',
        'MCP',
        `Falha ao desconectar servidor MCP ${manager.name}: ${error?.message || error}`,
      );
    }

    this.managers.splice(managerIndex, 1);

    const entry = this.entries.get(serverId);
    if (entry) {
      this.entries.set(serverId, { ...entry, status: 'stopped' });
    }

    this.writeSnapshot();
    this.logRepo.log('info', 'MCP', `Servidor MCP ${serverId} parado individualmente.`);
    return true;
  }

  /**
   * Recarrega (ou inicia pela primeira vez) um servidor MCP individual.
   * Se ja estiver rodando, para e reinicia. Util para hot-reload apos
   * alteracoes no manifesto via McpManagementService.
   */
  public async reloadServer(serverId: string): Promise<{
    ok: boolean;
    toolCount: number;
    toolNames: string[];
    error: string | null;
  }> {
    // Se ja existe um manager ativo, parar antes
    await this.stopServer(serverId);

    // Recarregar o manifesto para pegar a entrada mais recente
    const allEntries = this.loadManifestEntries();
    const serverEntry = allEntries.find((entry) => entry.id === serverId);

    if (!serverEntry) {
      return { ok: false, toolCount: 0, toolNames: [], error: `Servidor "${serverId}" nao encontrado no manifesto.` };
    }

    if (serverEntry.enabled === false) {
      this.entries.set(serverId, {
        id: serverId,
        capability: String(serverEntry.capability || '').trim() || null,
        enabled: false,
        status: 'disabled',
        toolCount: 0,
        toolNames: [],
        command: serverEntry.command,
        args: [...serverEntry.args],
        lastAttemptedAt: null,
        lastConnectedAt: null,
        lastError: null,
      });
      this.writeSnapshot();
      return { ok: false, toolCount: 0, toolNames: [], error: `Servidor "${serverId}" esta desabilitado no manifesto.` };
    }

    const manager = this.managerFactory(serverEntry);
    const attemptedAt = new Date().toISOString();

    try {
      const beforeTools = new Set(this.registry.getAllTools().map((tool) => tool.name));
      await manager.connect(this.registry);
      this.managers.push(manager);

      const registeredToolNames = this.registry.getAllTools()
        .map((tool) => tool.name)
        .filter((toolName) => !beforeTools.has(toolName));

      const connectedAt = new Date().toISOString();
      this.entries.set(serverId, {
        id: serverId,
        capability: String(serverEntry.capability || '').trim() || null,
        enabled: true,
        status: 'connected',
        toolCount: registeredToolNames.length,
        toolNames: registeredToolNames,
        command: serverEntry.command,
        args: [...serverEntry.args],
        lastAttemptedAt: attemptedAt,
        lastConnectedAt: connectedAt,
        lastError: null,
      });

      this.writeSnapshot();
      this.logRepo.log(
        'info',
        'MCP',
        `Servidor MCP ${serverId} (re)carregado com ${registeredToolNames.length} tool(s).`,
      );

      return { ok: true, toolCount: registeredToolNames.length, toolNames: registeredToolNames, error: null };
    } catch (error: any) {
      this.entries.set(serverId, {
        id: serverId,
        capability: String(serverEntry.capability || '').trim() || null,
        enabled: true,
        status: 'failed',
        toolCount: 0,
        toolNames: [],
        command: serverEntry.command,
        args: [...serverEntry.args],
        lastAttemptedAt: attemptedAt,
        lastConnectedAt: null,
        lastError: error?.message || String(error),
      });

      this.writeSnapshot();
      this.logRepo.log(
        'warn',
        'MCP',
        `Falha ao (re)carregar servidor MCP ${serverId}: ${error?.message || error}`,
      );

      return { ok: false, toolCount: 0, toolNames: [], error: error?.message || String(error) };
    }
  }

  public readSnapshot(): McpRuntimeSnapshot {
    return this.buildSnapshot(Array.from(this.entries.values()));
  }

  private loadManifestEntries(): ResolvedMcpServerManifestEntry[] {
    const loader = this.manifestLoader as McpManifestLoader & {
      load?: () => ResolvedMcpServerManifestEntry[];
      loadEnabled?: () => ResolvedMcpServerManifestEntry[];
    };

    if (typeof loader.load === 'function') {
      return loader.load();
    }

    if (typeof loader.loadEnabled === 'function') {
      return loader.loadEnabled();
    }

    return [];
  }

  private buildSnapshot(entries: McpRuntimeServerSnapshot[]): McpRuntimeSnapshot {
    const normalizedEntries = [...entries].sort((left, right) => left.id.localeCompare(right.id));
    const capabilities = Array.from(
      new Set(
        normalizedEntries
          .map((entry) => String(entry.capability || '').trim())
          .filter(Boolean),
      ),
    );

    return {
      generatedAt: new Date().toISOString(),
      manifestPath: config.mcpServersManifestPath,
      summary: {
        total: normalizedEntries.length,
        enabled: normalizedEntries.filter((entry) => entry.enabled).length,
        connected: normalizedEntries.filter((entry) => entry.status === 'connected').length,
        failed: normalizedEntries.filter((entry) => entry.status === 'failed').length,
        disabled: normalizedEntries.filter((entry) => entry.status === 'disabled').length,
        stopped: normalizedEntries.filter((entry) => entry.status === 'stopped').length,
        toolCount: normalizedEntries.reduce((total, entry) => total + Number(entry.toolCount || 0), 0),
      },
      capabilities,
      entries: normalizedEntries,
    };
  }

  private writeSnapshot(): void {
    const snapshot = this.buildSnapshot(Array.from(this.entries.values()));
    fs.mkdirSync(path.dirname(this.stateFile), { recursive: true });
    fs.writeFileSync(this.stateFile, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
  }
}
