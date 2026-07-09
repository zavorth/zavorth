import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';
import { LogRepository } from '../storage/LogRepository.js';
import { BaseTool } from '../tools/BaseTool.js';
import { ToolRegistry } from '../tools/ToolRegistry.js';
import { McpClientManager } from './McpClientManager.js';
import {
  McpManifestLoader,
  type ResolvedMcpServerManifestEntry,
} from './McpManifest.js';
import { McpToolPolicyFileService } from '../services/McpToolPolicyFileService.js';
import { SecurityAuditLogger } from '../services/SecurityAuditLogger.js';
import {
  McpToolPolicy,
  type McpToolPolicyDocument,
} from './McpToolPolicy.js';

type McpSecurityDefinition = Record<string, unknown>;

type ToolWithRemoteName = BaseTool & { remoteName?: string };

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

/** Recursively stable JSON stringify with sorted object keys. */
function canonicalStringify(val: unknown): string {
  if (val === null || typeof val !== 'object') {
    return JSON.stringify(val);
  }
  if (Array.isArray(val)) {
    return '[' + (val as unknown[]).map(canonicalStringify).join(',') + ']';
  }
  const keys = Object.keys(val as Record<string, unknown>).sort();
  const parts = keys.map(
    (k) => JSON.stringify(k) + ':' + canonicalStringify((val as Record<string, unknown>)[k]),
  );
  return '{' + parts.join(',') + '}';
}

/**
 * Wraps an MCP tool under a namespaced name (`serverId:toolName`) while
 * delegating all execution to the original tool (which keeps its remoteName intact).
 */
class NamespacedMcpTool extends BaseTool {
  public readonly name: string;
  public readonly description: string;
  public readonly parameters: BaseTool['parameters'];
  public declare readonly metadata: BaseTool['metadata'];

  constructor(
    private readonly originalTool: BaseTool,
    namespacedName: string,
  ) {
    super();
    this.name = namespacedName;
    this.description = originalTool.description;
    this.parameters = originalTool.parameters;
    this.metadata = originalTool.metadata;
  }

  execute(args: Record<string, unknown>): Promise<string> {
    return this.originalTool.execute(args);
  }
}

/**
 * Intercepts ToolRegistry.register() calls during MCP discovery so that
 * the two-phase logic can collect tools before making any persistence or
 * registry decisions.
 */
class RegistryInterceptor extends ToolRegistry {
  constructor(
    private readonly actualRegistry: ToolRegistry,
    private readonly onRegister: (tool: BaseTool, securityDef?: McpSecurityDefinition) => void,
  ) {
    super();
  }

  public override register(tool: BaseTool, securityDefinition?: McpSecurityDefinition): void {
    this.onRegister(tool, securityDefinition);
  }

  // Delegate getTool / getAllTools to the real registry so McpClientManager
  // collision-checks still work correctly.
  public override getTool(name: string): BaseTool | undefined {
    return this.actualRegistry.getTool(name);
  }

  public override getAllTools(): BaseTool[] {
    return this.actualRegistry.getAllTools();
  }
}

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

/** Internal representation of a tool discovered during MCP server connection. */
type DiscoveredMcpTool = {
  tool: BaseTool;
  securityDefinition?: McpSecurityDefinition;
  namespacedName: string;
  toolName: string;
  fingerprint: string;
  description: string;
};

export class McpRuntimeService {
  private readonly managers: McpManagerLike[] = [];
  private readonly stateFile: string;
  private entries = new Map<string, McpRuntimeServerSnapshot>();
  private readonly auditLogger: SecurityAuditLogger;

  constructor(
    private readonly registry: ToolRegistry,
    private readonly logRepo: LogRepository,
    private readonly manifestLoader: McpManifestLoader = new McpManifestLoader(),
    private readonly managerFactory: McpManagerFactory = (entry) =>
      new McpClientManager(entry.id, entry.command, entry.args, entry.env, entry.allowedEnv),
    stateFile: string = config.mcpRuntimeStateFile,
    private readonly policyFileService: McpToolPolicyFileService = new McpToolPolicyFileService(),
  ) {
    this.stateFile = path.resolve(stateFile);
    this.auditLogger = new SecurityAuditLogger(this.logRepo);
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

    // ── Global Phase 1: Connect all managers with interceptors ─────────────
    // Collect all discovered tools BEFORE making any drift/policy decisions.
    // This is necessary so collision detection (for legacy allowlist migration)
    // can see tools from ALL servers simultaneously, regardless of connect order.
    type PerServerData = {
      manager: McpManagerLike;
      server: ResolvedMcpServerManifestEntry;
      discovered: DiscoveredMcpTool[];
      attemptedAt: string;
      error?: unknown;
    };

    const perServerData = await Promise.all(
      enabledServers.map(async (server) => {
        const manager = this.managerFactory(server);
        const attemptedAt = new Date().toISOString();
        const entry = this.entries.get(server.id);
        if (entry) {
          entry.lastAttemptedAt = attemptedAt;
          entry.lastError = null;
          this.entries.set(server.id, entry);
        }

        try {
          const discovered = await this.collectDiscoveredTools(manager, server.id);
          return { manager, server, discovered, attemptedAt };
        } catch (error: any) { const err = error; const e = error;
          return { manager, server, discovered: [], attemptedAt, error };
        }
      })
    );

    // ── Global Phase 2: Resolve drift/migration with full collision context ─
    // Build the complete global list of ALL discovered namespaced names.
    const allGlobalNamespacedTools = perServerData.flatMap(
      ({ discovered }) => discovered.map((d) => d.namespacedName),
    );

    const policyDoc = this.policyFileService.readPolicy();
    let policyChanged = false;
    const globalPolicy = this.policyFileService.getMcpToolPolicy(process.env);

    for (const { manager, server, discovered, attemptedAt, error } of perServerData) {
      if (error) {
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
          lastError: getErrorMessage(error),
        });
        this.logRepo.log(
          'warn', 'MCP',
          `Falha ao conectar servidor MCP ${server.id}: ${getErrorMessage(error)}`,
        );
        this.writeSnapshot();
        continue;
      }

      const { registeredNames, changed } = this.resolveDiscoveredTools(
        discovered, allGlobalNamespacedTools, policyDoc, globalPolicy, server.id,
      );

      if (changed) policyChanged = true;

      this.managers.push(manager);
      const connectedAt = new Date().toISOString();
      this.entries.set(server.id, {
        id: server.id,
        capability: String(server.capability || '').trim() || null,
        enabled: true,
        status: 'connected',
        toolCount: registeredNames.length,
        toolNames: registeredNames,
        command: server.command,
        args: [...server.args],
        lastAttemptedAt: attemptedAt,
        lastConnectedAt: connectedAt,
        lastError: null,
      });
      this.logRepo.log(
        'info', 'MCP',
        `Servidor MCP ${server.id} conectado${server.capability ? ` (${server.capability})` : ''}.`,
      );
      this.writeSnapshot();
    }

    // Single policy write after processing ALL servers
    if (policyChanged) {
      this.policyFileService.savePolicy(policyDoc);
    }
  }

  public async stop(): Promise<void> {
    while (this.managers.length > 0) {
      const manager = this.managers.pop()!;

      try {
        await manager.disconnect();
      } catch (error: any) { const err = error; const e = error;
        this.logRepo.log(
          'warn',
          'MCP',
          `Falha ao desconectar servidor MCP ${manager.name}: ${getErrorMessage(error)}`,
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
    } catch (error: any) { const err = error; const e = error;
      this.logRepo.log(
        'warn',
        'MCP',
        `Falha ao desconectar servidor MCP ${manager.name}: ${getErrorMessage(error)}`,
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
   * If it is already running, stop and restart it. Useful for hot reload after
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
      return { ok: false, toolCount: 0, toolNames: [], error: `Server "${serverId}" not found in manifest.` };
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
      const registeredToolNames = await this.connectManager(manager, serverId);
      this.managers.push(manager);

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
    } catch (error: any) { const err = error; const e = error;
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
        lastError: getErrorMessage(error),
      });

      this.writeSnapshot();
      this.logRepo.log(
        'warn',
        'MCP',
        `Falha ao (re)carregar servidor MCP ${serverId}: ${getErrorMessage(error)}`,
      );

      return { ok: false, toolCount: 0, toolNames: [], error: getErrorMessage(error) };
    }
  }

  public readSnapshot(): McpRuntimeSnapshot {
    return this.buildSnapshot(Array.from(this.entries.values()));
  }

  private computeFingerprint(serverId: string, toolName: string, inputSchema: unknown): string {
    const data = canonicalStringify({
      serverId,
      toolName,
      inputSchema: inputSchema || {},
    });
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /** Phase 1: Connect a single manager using a RegistryInterceptor to capture tools without registering them. */
  private async collectDiscoveredTools(
    manager: McpManagerLike,
    serverId: string,
  ): Promise<DiscoveredMcpTool[]> {
    const discovered: DiscoveredMcpTool[] = [];
    const interceptor = new RegistryInterceptor(this.registry, (tool, securityDefinition) => {
      const toolName = (tool as ToolWithRemoteName).remoteName || tool.name;
      const namespacedName = `${serverId}:${toolName}`;
      const fingerprint = this.computeFingerprint(serverId, toolName, tool.parameters);
      discovered.push({
        tool,
        securityDefinition,
        namespacedName,
        toolName,
        fingerprint,
        description: tool.description || '',
      });
    });
    await manager.connect(interceptor);
    return discovered;
  }

  /**
   * Phase 2: Resolve drift/migration for a list of discovered tools.
   * `allActiveNamespacedTools` must include ALL tools visible in scope (from all servers)
   * so that legacy-allowlist collision detection is order-independent.
   * Mutates `policyDoc` in memory; the caller is responsible for persisting it once.
   */
  private resolveDiscoveredTools(
    discovered: DiscoveredMcpTool[],
    allActiveNamespacedTools: string[],
    policyDoc: any,
    globalPolicy: McpToolPolicy,
    serverId: string,
  ): { registeredNames: string[]; changed: boolean } {
    let changed = false;
    const registeredNames: string[] = [];

    for (const d of discovered) {
      const { tool, securityDefinition, namespacedName, toolName, fingerprint, description } = d;
      const existing = policyDoc.tools?.[namespacedName];
      let status: 'approved' | 'pending_approval' = 'pending_approval';

      if (existing) {
        if (existing.status === 'approved') {
          if (existing.fingerprint !== fingerprint) {
            // Schema drift: demote back to pending
            this.logRepo.log('warn', 'MCP', `Schema drift detectado para "${namespacedName}".`);
            this.policyFileService.markToolPending(policyDoc, namespacedName, fingerprint, 'schema_drift', description);
            changed = true;
            this.auditLogger.logMcpRuntimeEvent({
              event: 'mcp_schema_drift_detected',
              serverId,
              toolName,
              namespacedToolId: namespacedName,
              fingerprint,
              previousFingerprint: existing.fingerprint,
              pendingReason: 'schema_drift',
            });
            // status stays 'pending_approval'
          } else if (existing.description !== description) {
            // Description-only drift: warn and update lastSeen, keep approved
            this.logRepo.log(
              'warn', 'MCP',
              `Descricao da ferramenta "${namespacedName}" mudou (description drift). Ferramenta permanece aprovada.`,
            );
            this.policyFileService.updateToolLastSeen(policyDoc, namespacedName, description);
            changed = true;
            status = 'approved';
            this.auditLogger.logMcpRuntimeEvent({
              event: 'mcp_description_drift_detected',
              serverId,
              toolName,
              namespacedToolId: namespacedName,
              fingerprint,
            });
          } else {
            status = 'approved';
          }
        } else {
          // Already pending/blocked: check if fingerprint changed while waiting for approval
          if (existing.fingerprint !== fingerprint) {
            this.logRepo.log(
              'warn', 'MCP',
              `Ferramenta pending "${namespacedName}" teve fingerprint alterado. Atualizando registro pending.`,
            );
            // Always use 'schema_drift' when the fingerprint changes — regardless of the original pendingReason
            this.policyFileService.markToolPending(policyDoc, namespacedName, fingerprint, 'schema_drift', description);
            changed = true;
            this.auditLogger.logMcpRuntimeEvent({
              event: 'mcp_schema_drift_detected',
              serverId,
              toolName,
              namespacedToolId: namespacedName,
              fingerprint,
              previousFingerprint: existing.fingerprint,
              pendingReason: 'schema_drift',
            });
          }
          // status remains 'pending_approval'
        }
      } else {
        // Brand-new tool: check legacy allowlist migration
        const allowlistArr = globalPolicy.getAllowlist();
        const legacyItem = allowlistArr.find(
          (item: string) => !item.includes(':') && item.toLowerCase() === toolName.toLowerCase(),
        );

        if (legacyItem !== undefined) {
          const collisions = allActiveNamespacedTools.filter(
            (t) => t.includes(':') && t.slice(t.indexOf(':') + 1).toLowerCase() === toolName.toLowerCase(),
          );

          if (collisions.length === 1) {
            status = 'approved';
            this.logRepo.log(
              'info', 'MCP',
              `Auto-migrando ferramenta legada "${namespacedName}" (allowlist simples "${legacyItem}").`,
            );
            this.policyFileService.autoMigrateLegacyTool(policyDoc, namespacedName, fingerprint, description);
            changed = true;
          } else {
            this.logRepo.log(
              'warn', 'MCP',
              `Colisao detectada para allowlist legada "${legacyItem}" — `
              + `${collisions.length} servidores expondo. "${namespacedName}" fica como pending_approval.`,
            );
            this.policyFileService.markToolPending(policyDoc, namespacedName, fingerprint, 'new_tool', description);
            changed = true;
            this.auditLogger.logMcpRuntimeEvent({
              event: 'mcp_tool_pending',
              serverId,
              toolName,
              namespacedToolId: namespacedName,
              fingerprint,
              pendingReason: 'new_tool',
            });
          }
        } else {
          this.logRepo.log('warn', 'MCP', `Nova ferramenta detectada: "${namespacedName}". Marcando como pending_approval.`);
          this.policyFileService.markToolPending(policyDoc, namespacedName, fingerprint, 'new_tool', description);
          changed = true;
          this.auditLogger.logMcpRuntimeEvent({
            event: 'mcp_tool_pending',
            serverId,
            toolName,
            namespacedToolId: namespacedName,
            fingerprint,
            pendingReason: 'new_tool',
          });
        }
      }

      if (status !== 'approved') continue;

      // Global policy check (profile + allowlist)
      const globalDecision = globalPolicy.decide(namespacedName, allActiveNamespacedTools);
      if (!globalDecision.allowed) {
        this.logRepo.log(
          'warn', 'MCP',
          `Ferramenta "${namespacedName}" aprovada no drift, mas bloqueada pela politica global: ${globalDecision.reason}`,
        );
        this.auditLogger.logMcpRuntimeEvent({
          event: 'mcp_tool_blocked',
          serverId,
          toolName,
          namespacedToolId: namespacedName,
          fingerprint,
          effectiveAllowed: false,
        });
        continue;
      }

      // Register under the namespaced name
      const namespacedTool = new NamespacedMcpTool(tool, namespacedName);
      const finalSecurityDef = securityDefinition
        ? { ...securityDefinition, toolName: namespacedName }
        : undefined;
      this.registry.register(namespacedTool, finalSecurityDef as any);
      registeredNames.push(namespacedName);
      this.auditLogger.logMcpRuntimeEvent({
        event: 'mcp_tool_registered',
        serverId,
        toolName,
        namespacedToolId: namespacedName,
        fingerprint,
        effectiveAllowed: true,
      });
    }

    return { registeredNames, changed };
  }

  /**
   * Single-server connection (used by reloadServer).
   * Phase 1: collect this server's tools.
   * Phase 2: resolve with `alreadyRegisteredFromOthers` providing cross-server collision context.
   * Saves policy atomically after processing.
   */
  private async connectManager(manager: McpManagerLike, serverId: string): Promise<string[]> {
    const discovered = await this.collectDiscoveredTools(manager, serverId);

    // For single-server reload: use tools already in registry from OTHER servers as collision context
    const alreadyRegisteredFromOthers = this.registry
      .getAllTools()
      .map((t) => t.name)
      .filter((n) => {
        const parts = n.split(':');
        return parts.length === 2 && parts[0] !== serverId;
      });

    const allActiveNamespacedTools = [
      ...alreadyRegisteredFromOthers,
      ...discovered.map((d) => d.namespacedName),
    ];

    const policyDoc = this.policyFileService.readPolicy();
    const globalPolicy = this.policyFileService.getMcpToolPolicy(process.env);

    const { registeredNames, changed } = this.resolveDiscoveredTools(
      discovered, allActiveNamespacedTools, policyDoc, globalPolicy, serverId,
    );

    if (changed) {
      this.policyFileService.savePolicy(policyDoc);
    }

    return registeredNames;
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
