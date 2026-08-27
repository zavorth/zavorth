import fs from 'node:fs';
import path from 'node:path';

import { ZAVORTH_PLUGIN_OS_API_VERSION } from '../contracts/PluginManifestContract.js';
import type { ZavorthPluginManifest } from '../contracts/PluginManifestContract.js';
import { PluginSignatureService } from './PluginSignatureService.js';

export type McpServerCandidate = {
  id: string;
  enabled: boolean;
  command?: string;
  args?: string[];
  capability?: string;
  summary: string;
  source: string;
};

export type McpMaterializeResult = {
  ok: boolean;
  pluginId: string;
  packageDir: string;
  signed: boolean;
  findings: string[];
  formatText(): string;
};

export type McpActivationPlan = {
  ok: boolean;
  enabled: boolean;
  serverId: string;
  steps: string[];
  nextCommands: string[];
};

export type McpEnableResult = {
  ok: boolean;
  enabled: boolean;
  serverId: string;
  reason?: string;
};

export type PluginMcpBridgeServiceRuntime = {
  now?: () => Date;
  projectRoot?: string;
  signatureService?: PluginSignatureService;
  existsSync?: typeof fs.existsSync;
  mkdirSync?: typeof fs.mkdirSync;
  writeFileSync?: typeof fs.writeFileSync;
  readFileSync?: typeof fs.readFileSync;
};

export class PluginMcpBridgeService {
  private readonly now: () => Date;
  private readonly projectRoot: string;
  private readonly signatureService: PluginSignatureService;
  private readonly existsSync: typeof fs.existsSync;
  private readonly mkdirSync: typeof fs.mkdirSync;
  private readonly writeFileSync: typeof fs.writeFileSync;
  private readonly readFileSync: typeof fs.readFileSync;

  constructor(runtime: PluginMcpBridgeServiceRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.projectRoot = path.resolve(runtime.projectRoot || process.cwd());
    this.signatureService = runtime.signatureService || new PluginSignatureService();
    this.existsSync = runtime.existsSync || fs.existsSync.bind(fs);
    this.mkdirSync = runtime.mkdirSync || fs.mkdirSync.bind(fs);
    this.writeFileSync = runtime.writeFileSync || fs.writeFileSync.bind(fs);
    this.readFileSync = runtime.readFileSync || fs.readFileSync.bind(fs);
  }

  public listServers(options: { configPath?: string; root?: string } = {}): McpServerCandidate[] {
    const root = path.resolve(options.root || this.projectRoot);
    const configPath = options.configPath
      ? (path.isAbsolute(options.configPath) ? options.configPath : path.join(root, options.configPath))
      : path.join(root, 'config', 'mcp-servers.json');

    if (!this.existsSync(configPath)) {
      return [];
    }

    try {
      const raw = JSON.parse(this.readFileSync(configPath, 'utf8')) as unknown;
      const list = Array.isArray(raw) ? raw : [];
      return list
        .map((entry) => normalizeServer(entry, configPath))
        .filter((entry): entry is McpServerCandidate => Boolean(entry));
    } catch {
      return [];
    }
  }

  public buildActivationPlan(
    serverId: string,
    options: { root?: string; configPath?: string } = {},
  ): McpActivationPlan {
    const root = path.resolve(options.root || this.projectRoot);
    const servers = this.listServers({ root, configPath: options.configPath });
    const server = servers.find((entry) => entry.id === serverId || entry.id === normalizeId(serverId));
    if (!server) {
      return { ok: false, enabled: false, serverId, steps: [], nextCommands: [] };
    }
    const steps = server.enabled
      ? [`MCP server "${server.id}" is already enabled.`]
      : [
          `Enable MCP server "${server.id}" in config/mcp-servers.json (set enabled=true).`,
          'Restart the runtime/gateway after enabling.',
        ];
    return {
      ok: true,
      enabled: server.enabled,
      serverId: server.id,
      steps,
      nextCommands: [`zavorth plugins mcp_enable ${server.id} --yes`],
    };
  }

  public setServerEnabled(
    serverId: string,
    enabled: boolean,
    options: { root?: string; configPath?: string; confirmed?: boolean } = {},
  ): McpEnableResult {
    const root = path.resolve(options.root || this.projectRoot);
    const configPath = options.configPath
      ? (path.isAbsolute(options.configPath) ? options.configPath : path.join(root, options.configPath))
      : path.join(root, 'config', 'mcp-servers.json');

    if (options.confirmed !== true) {
      return { ok: false, enabled: false, serverId, reason: 'needs_confirmation' };
    }
    if (!this.existsSync(configPath)) {
      return { ok: false, enabled: false, serverId, reason: 'config_missing' };
    }
    try {
      const raw = JSON.parse(this.readFileSync(configPath, 'utf8')) as unknown;
      if (!Array.isArray(raw)) {
        return { ok: false, enabled: false, serverId, reason: 'config_invalid' };
      }
      let found = false;
      const next = raw.map((entry) => {
        const record = entry as Record<string, unknown>;
        const candidateId = normalizeId(String(record.id || ''));
        if (candidateId === normalizeId(serverId)) {
          found = true;
          return { ...record, enabled };
        }
        return record;
      });
      if (!found) {
        return { ok: false, enabled: false, serverId, reason: 'server_missing' };
      }
      this.writeFileSync(configPath, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
      return { ok: true, enabled, serverId };
    } catch {
      return { ok: false, enabled: false, serverId, reason: 'config_invalid' };
    }
  }

  public formatCatalogForAgent(options: { root?: string; configPath?: string; max?: number } = {}): string {
    const root = path.resolve(options.root || this.projectRoot);
    const servers = this.listServers({ root, configPath: options.configPath });
    const max = options.max && options.max > 0 ? options.max : servers.length;
    return [
      '## MCP Server Catalog',
      `servers=${servers.length} (max=${max})`,
      'Enable with: zavorth plugins mcp_enable <id> --yes',
      ...servers.slice(0, max).map((server) => {
        const state = server.enabled ? 'enabled' : 'disabled';
        return `- ${server.id} [${state}] capability=${server.capability || 'n/a'} summary=${server.summary}`;
      }),
    ].join('\n');
  }

  public materializeBridgePlugin(
    mcpId: string,
    options: {
      root?: string;
      configPath?: string;
      sign?: boolean;
      force?: boolean;
    } = {},
  ): McpMaterializeResult {
    const root = path.resolve(options.root || this.projectRoot);
    const findings: string[] = [];
    const servers = this.listServers({ root, configPath: options.configPath });
    const server = servers.find((entry) => entry.id === mcpId || entry.id === normalizeId(mcpId));

    if (!server) {
      return finishMaterialize({
        ok: false,
        pluginId: '',
        packageDir: '',
        signed: false,
        findings: [
          `MCP server not found: ${mcpId}`,
          'Configure servers in config/mcp-servers.json',
          `Known: ${servers.map((s) => s.id).join(', ') || 'none'}`,
        ],
      });
    }

    const pluginId = `mcp-${normalizeId(server.id)}`;
    const packageDir = path.join(root, '.zavorth', 'plugins', pluginId);
    if (!isInside(root, packageDir)) {
      return finishMaterialize({
        ok: false,
        pluginId,
        packageDir,
        signed: false,
        findings: ['Refusing to write outside workspace'],
      });
    }

    const relativeDir = path.relative(root, packageDir).replace(/\\/gu, '/');
    const already = this.existsSync(path.join(packageDir, 'manifest.json'));
    if (already && options.force !== true) {
      findings.push('package already exists (pass force to overwrite)');
    }

    try {
      this.mkdirSync(packageDir, { recursive: true });
      const manifest = buildBridgeManifest(pluginId, server);
      const indexJs = renderBridgeIndex(pluginId, server);
      const readme = [
        `# ${pluginId}`,
        '',
        `Synthetic MCP bridge package for server \`${server.id}\`.`,
        '',
        '## Capabilities',
        '',
        '- `mcp.invoke` — soft invoke (requires MCP runtime / enabled server)',
        '- `mcp.status` — configuration status',
        '',
        '```bash',
        `zavorth plugins enable ${pluginId} --yes`,
        '```',
        '',
        `Generated at ${this.now().toISOString()}`,
        '',
      ].join('\n');

      this.writeFileSync(
        path.join(packageDir, 'manifest.json'),
        `${JSON.stringify(manifest, null, 2)}\n`,
        'utf8',
      );
      this.writeFileSync(path.join(packageDir, 'index.js'), indexJs, 'utf8');
      this.writeFileSync(path.join(packageDir, 'README.md'), readme, 'utf8');
      this.writeFileSync(
        path.join(packageDir, 'package.json'),
        `${JSON.stringify({ name: pluginId, version: '0.1.0', private: true, main: 'index.js' }, null, 2)}\n`,
        'utf8',
      );
      findings.push(`materialized ${relativeDir}`);
    } catch (error: unknown) {
      return finishMaterialize({
        ok: false,
        pluginId,
        packageDir: relativeDir,
        signed: false,
        findings: [
          `materialize failed: ${error instanceof Error ? error.message : String(error)}`,
        ],
      });
    }

    let signed = false;
    const shouldSign = options.sign !== false;
    if (shouldSign) {
      try {
        const privateKey = process.env.ZAVORTH_PLUGIN_ED25519_PRIVATE_KEY
          || process.env.ZAVORTH_PLUGIN_HMAC_SECRET;
        if (privateKey) {
          const result = this.signatureService.signPackage(packageDir, { yes: true });
          signed = result.ok;
          findings.push(
            result.ok ? `signed package (ed25519=${Boolean(result.ed25519)})`
              : `sign soft-failed: ${result.findings.join('; ')}`,
          );
        } else {
          // Still write sha256 checksum sidecar when possible
          try {
            const result = this.signatureService.signPackage(packageDir, { yes: true });
            signed = result.ok;
            findings.push(
              result.ok ? 'signed package (sha256 checksum; no private key for ed25519)'
                : `checksum sign soft-failed: ${result.findings.join('; ')}`,
            );
          } catch {
            findings.push('signature keys not present — package left unsigned');
          }
        }
      } catch (error: unknown) {
        findings.push(
          `sign soft-failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    return finishMaterialize({
      ok: true,
      pluginId,
      packageDir: relativeDir,
      signed,
      findings,
    });
  }
}

function normalizeServer(entry: unknown, configPath: string): McpServerCandidate | null {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null;
  const record = entry as Record<string, unknown>;
  const id = normalizeId(String(record.id || ''));
  if (!id) return null;
  return {
    id,
    enabled: record.enabled === true,
    command: record.command ? String(record.command) : undefined,
    args: Array.isArray(record.args) ? record.args.map(String) : [],
    capability: record.capability ? String(record.capability) : undefined,
    summary: String(
      record.summary
      || record.capability
      || `MCP server ${id}`,
    ),
    source: configPath,
  };
}

function buildBridgeManifest(pluginId: string, server: McpServerCandidate): ZavorthPluginManifest {
  return {
    schemaVersion: ZAVORTH_PLUGIN_OS_API_VERSION,
    id: pluginId,
    label: `MCP Bridge: ${server.id}`,
    version: '0.1.0',
    moduleKind: 'bridge',
    summary: `Synthetic bridge for MCP server ${server.id}`,
    description: `Plugin OS package that soft-bridges MCP server "${server.id}" (${server.summary}).`,
    tags: ['mcp', 'bridge', server.id, server.capability || 'mcp'].filter(Boolean),
    source: {
      kind: 'local',
      locator: `mcp-bridge://${server.id}`,
      digest: null,
      trusted: false,
    },
    compatibility: {
      zavorthVersion: '>=1.1.0',
      pluginApiVersion: ZAVORTH_PLUGIN_OS_API_VERSION,
    },
    capabilities: [
      {
        id: 'mcp.invoke',
        intent: 'mcp.invoke',
        label: 'MCP Invoke',
        summary: `Invoke a tool on MCP server ${server.id}.`,
        artifactKinds: [],
        command: {
          name: `${pluginId.replace(/[^a-z0-9]+/giu, '_')}_invoke`,
          aliases: ['mcp_invoke'],
          usage: '{ tool?, args... }',
        },
      },
      {
        id: 'mcp.status',
        intent: 'mcp.status',
        label: 'MCP Status',
        summary: `Status for MCP server ${server.id}.`,
        artifactKinds: [],
        command: {
          name: `${pluginId.replace(/[^a-z0-9]+/giu, '_')}_status`,
          aliases: ['mcp_status'],
          usage: null,
        },
      },
    ],
    permissions: [
      {
        kind: 'network.external',
        scope: 'external',
        reason: 'MCP servers may require network access.',
        required: false,
      },
      {
        kind: 'process.spawn',
        scope: 'workspace',
        reason: 'MCP servers typically spawn a local process.',
        required: false,
      },
    ],
    entrypoint: {
      module: './index.js',
      exportName: 'register',
      runtime: 'node',
    },
    lifecycle: {
      actions: ['install', 'enable', 'disable', 'uninstall', 'invoke', 'doctor'],
      defaultAction: 'invoke',
    },
    policy: {
      defaultTrust: 'review',
      requiresApproval: true,
      allowNetworkByDefault: false,
      allowFilesystemWriteByDefault: false,
      allowProcessSpawnByDefault: false,
      sandboxProfile: 'networked',
    },
    artifactKinds: [],
    receiptKinds: [],
  };
}

function renderBridgeIndex(pluginId: string, server: McpServerCandidate): string {
  const sid = escapeJs(server.id);
  const pid = escapeJs(pluginId);
  const enabled = server.enabled ? 'true' : 'false';
  return [
    "const path = require('node:path');",
    "const { createRequire } = require('node:module');",
    '',
    'function register(ctx) {',
    '  const logger = ctx.getLogger();',
    '  const workspace = ctx.getWorkspacePath();',
    `  const mcpServerId = '${sid}';`,
    `  const pluginId = '${pid}';`,
    `  const configEnabled = ${enabled};`,
    '',
    "  ctx.bindCapability('mcp.status', async () => {",
    '    try {',
    '      return {',
    '        output: {',
    '          ok: true,',
    '          pluginId,',
    '          serverId: mcpServerId,',
    '          configEnabled,',
    "          message: configEnabled",
    "            - 'MCP server is enabled in config/mcp-servers.json'",
    "            : 'Enable MCP server \"' + mcpServerId + '\" in config/mcp-servers.json',",
    '          setup: setupTips(mcpServerId),',
    '        },',
    '      };',
    '    } catch (error) {',
    "      logger.warn('mcp.status failed', { error: error instanceof Error ? error.message : String(error) });",
    "      return { output: { ok: false, message: error instanceof Error ? error.message : String(error) } };",
    '    }',
    '  });',
    '',
    "  ctx.bindCapability('mcp.invoke', async ({ input }) => {",
    '    try {',
    '      const tool = input && (input.tool || input.name || input.method);',
    '      const args = (input && (input.args || input.arguments || input.params)) || {};',
    '      const result = await softInvokeMcp(workspace, mcpServerId, tool, args);',
    '      return { output: result };',
    '    } catch (error) {',
    "      logger.warn('mcp.invoke failed', { error: error instanceof Error ? error.message : String(error) });",
    '      return {',
    '        output: {',
    '          ok: false,',
    "          message: error instanceof Error ? error.message : String(error),",
    '          setup: setupTips(mcpServerId),',
    '        },',
    '      };',
    '    }',
    '  });',
    '}',
    '',
    'function setupTips(serverId) {',
    '  return [',
    "    'Edit config/mcp-servers.json and set enabled=true for \"' + serverId + '\".',",
    "    'Restart the gateway/runtime after enabling MCP servers.',",
    "    'Materialize bridge: zavorth plugins mcp materialize ' + serverId + ' --yes',",
    '  ];',
    '}',
    '',
    'async function softInvokeMcp(workspace, serverId, tool, args) {',
    '  try {',
    '    const req = createRequire(__filename);',
    '    const candidates = [',
    "      path.resolve(workspace, 'dist/services/PluginOsMcpRuntimeAccess.js'),",
    "      path.resolve(workspace, 'src/services/PluginOsMcpRuntimeAccess.js'),",
    "      path.resolve(workspace, 'dist/mcp/McpRuntimeService.js'),",
    "      path.resolve(workspace, 'src/mcp/McpRuntimeService.js'),",
    "      path.resolve(__dirname, '../../dist/services/PluginOsMcpRuntimeAccess.js'),",
    "      path.resolve(__dirname, '../../src/services/PluginOsMcpRuntimeAccess.js'),",
    "      path.resolve(__dirname, '../../dist/mcp/McpRuntimeService.js'),",
    "      path.resolve(__dirname, '../../src/mcp/McpRuntimeService.js'),",
    '    ];',
    '    for (const candidate of candidates) {',
    '      try {',
    '        const mod = req(candidate);',
    '        if (!mod) continue;',
    "        if (typeof mod.invokePluginOsMcp === 'function') {",
    '          return await mod.invokePluginOsMcp({ serverId, tool, args: args || {} });',
    '        }',
    "        if (typeof mod.getPluginOsMcpRuntime === 'function') {",
    '          const runtime = mod.getPluginOsMcpRuntime();',
    "          if (runtime && typeof runtime.invoke === 'function') {",
    '            return await runtime.invoke({ serverId, tool, args: args || {} });',
    '          }',
    '        }',
    "      } catch (e) { /* next candidate */ }",
    '    }',
    "  } catch (e) { /* soft-fail fallback */ }",
    '  return {',
    '    ok: false,',
    "    reason: 'mcp_runtime_unavailable',",
    '    serverId,',
    '    requestedTool: tool || null,',
    '    args: args || {},',
    "    message: 'Enable MCP server \"' + serverId + '\" and ensure the Zavorth runtime is running.',",
    '    setup: setupTips(serverId),',
    '  };',
    '}',
    '',
    'module.exports = { register };',
    '',
  ].join('\n');
}

function finishMaterialize(input: Omit<McpMaterializeResult, 'formatText'>): McpMaterializeResult {
  return {
    ...input,
    formatText() {
      return [
        `MCP materialize: ${input.pluginId || '<none>'}`,
        `ok=${input.ok} signed=${input.signed}`,
        `package: ${input.packageDir || 'n/a'}`,
        ...input.findings.map((line) => ` ? ${line}`),
      ].join('\n');
    },
  };
}

function normalizeId(raw: string): string {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/gu, '-')
    .replace(/^-+|-+$/gu, '');
}

function escapeJs(value: string): string {
  return String(value || '')
    .replace(/\\/gu, '\\\\')
    .replace(/'/gu, "\\'");
}

function isInside(root: string, target: string): boolean {
  const resolvedRoot = path.resolve(root);
  const resolvedTarget = path.resolve(target);
  const relative = path.relative(resolvedRoot, resolvedTarget);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}
