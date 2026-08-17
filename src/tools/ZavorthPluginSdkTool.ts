/**
 * Zavorth Plugin SDK Tool.
 * Exposes plugin inspection, manifest validation, remote URL installation,
 * cryptographic signature verification, MCP server-as-plugin bridging,
 * and live hot-reload diagnostics via ToolRegistry and Cognitive Firewall.
 */

import { BaseTool } from './BaseTool.js';
import {
  PluginSdkRegistry,
  PluginManifestValidator,
  PluginMcpAdapter,
  PluginRemoteInstaller,
  PluginHotReloadController,
  type McpToolSchema,
} from '../plugin-sdk/index.js';

export interface ZavorthPluginSdkInput {
  action: 'list' | 'validate_manifest' | 'inspect' | 'unload' | 'import_mcp' | 'install_url' | 'verify_signature' | 'hot_reload';
  pluginId?: string;
  manifestJson?: Record<string, unknown>;
  url?: string;
  packageDir?: string;
  mcpServerId?: string;
  mcpCommand?: string;
  mcpArgs?: string[];
  mcpTools?: McpToolSchema[];
  pluginDir?: string;
}

export class ZavorthPluginSdkTool extends BaseTool {
  public static readonly name = 'zavorth_plugin_sdk';
  public static readonly description =
    'Inspects plugins, validates manifests, installs remote plugins from URL with Ed25519 signature checks, bridges MCP servers into plugins, and manages live hot-reload.';

  public static readonly schema = {
    type: 'object' as const,
    properties: {
      action: {
        type: 'string',
        enum: ['list', 'validate_manifest', 'inspect', 'unload', 'import_mcp', 'install_url', 'verify_signature', 'hot_reload'],
        description: 'Action to perform with the Plugin SDK.',
      },
      pluginId: {
        type: 'string',
        description: 'Target plugin ID for inspect, unload, or hot_reload.',
      },
      manifestJson: {
        type: 'object',
        description: 'Raw plugin manifest JSON to validate (when action is validate_manifest).',
      },
      url: {
        type: 'string',
        description: 'Remote HTTPS package URL to download and install (when action is install_url).',
      },
      packageDir: {
        type: 'string',
        description: 'Local package directory to verify signature (when action is verify_signature).',
      },
      mcpServerId: {
        type: 'string',
        description: 'MCP server identifier to bridge into a plugin (when action is import_mcp).',
      },
      mcpCommand: {
        type: 'string',
        description: 'MCP execution binary/command (e.g. "npx", "node", "python").',
      },
      mcpArgs: {
        type: 'array',
        items: { type: 'string' },
        description: 'Arguments for the MCP server process.',
      },
      mcpTools: {
        type: 'array',
        description: 'List of MCP tool schemas to project dynamically.',
      },
      pluginDir: {
        type: 'string',
        description: 'Plugin directory path to watch for live hot-reload (when action is hot_reload).',
      },
    },
    required: ['action'] as string[],
  };

  private static installer = new PluginRemoteInstaller();
  private static hotReloadController = new PluginHotReloadController();

  readonly name = ZavorthPluginSdkTool.name;
  readonly description = ZavorthPluginSdkTool.description;
  readonly parameters = ZavorthPluginSdkTool.schema;

  public async execute(args: Record<string, unknown>): Promise<string> {
    return ZavorthPluginSdkTool.execute(args as unknown as ZavorthPluginSdkInput);
  }

  public static async execute(input: ZavorthPluginSdkInput): Promise<string> {
    const registry = PluginSdkRegistry.getInstance();

    switch (input.action) {
      case 'list': {
        const plugins = registry.listPlugins();
        return JSON.stringify({
          status: 'success',
          action: 'list',
          total: plugins.length,
          plugins: plugins.map((p) => ({
            id: p.id,
            name: p.plugin.manifest.name,
            version: p.plugin.manifest.version,
            status: p.status,
            toolsCount: p.registeredTools.size,
            tools: Array.from(p.registeredTools.keys()),
            permissions: p.plugin.manifest.permissions,
            loadedAt: p.loadedAt,
          })),
        });
      }

      case 'validate_manifest': {
        if (!input.manifestJson) {
          return JSON.stringify({
            status: 'error',
            message: 'manifestJson object is required to validate manifest.',
          });
        }

        const result = PluginManifestValidator.validate(input.manifestJson);
        return JSON.stringify({
          status: result.valid ? 'success' : 'invalid',
          action: 'validate_manifest',
          valid: result.valid,
          errors: result.errors,
          manifest: result.manifest,
        });
      }

      case 'inspect': {
        if (!input.pluginId) {
          return JSON.stringify({
            status: 'error',
            message: 'pluginId is required to inspect a plugin.',
          });
        }

        const record = registry.getPlugin(input.pluginId);
        if (!record) {
          return JSON.stringify({
            status: 'not_found',
            message: `Plugin "${input.pluginId}" is not loaded.`,
          });
        }

        return JSON.stringify({
          status: 'success',
          action: 'inspect',
          plugin: {
            id: record.id,
            manifest: record.plugin.manifest,
            status: record.status,
            loadedAt: record.loadedAt,
            registeredTools: Array.from(record.registeredTools.keys()),
            hooksCount: record.hooks.length,
          },
        });
      }

      case 'unload': {
        if (!input.pluginId) {
          return JSON.stringify({
            status: 'error',
            message: 'pluginId is required to unload a plugin.',
          });
        }

        const unloaded = await registry.unload(input.pluginId);
        return JSON.stringify({
          status: unloaded ? 'success' : 'not_found',
          action: 'unload',
          pluginId: input.pluginId,
          message: unloaded ? `Plugin "${input.pluginId}" unloaded.` : `Plugin "${input.pluginId}" not found.`,
        });
      }

      case 'import_mcp': {
        if (!input.mcpServerId) {
          return JSON.stringify({
            status: 'error',
            message: 'mcpServerId is required to import an MCP server as a plugin.',
          });
        }

        const plugin = PluginMcpAdapter.fromMcpCandidate({
          id: input.mcpServerId,
          enabled: true,
          command: input.mcpCommand,
          args: input.mcpArgs,
          summary: `Bridged MCP Server: ${input.mcpServerId}`,
          source: 'mcp_bridge',
        }, input.mcpTools || []);

        const record = await registry.registerAndInitialize(plugin);
        return JSON.stringify({
          status: 'success',
          action: 'import_mcp',
          pluginId: plugin.id,
          toolsRegistered: Array.from(record.registeredTools.keys()),
          message: `MCP Server "${input.mcpServerId}" successfully bridged as plugin "${plugin.id}".`,
        });
      }

      case 'install_url': {
        if (!input.url) {
          return JSON.stringify({
            status: 'error',
            message: 'url is required to install a remote plugin.',
          });
        }

        const installResult = await this.installer.installFromUrl({
          url: input.url,
          requireSignature: false,
        });

        return JSON.stringify({
          status: installResult.ok ? 'success' : 'failed',
          action: 'install_url',
          pluginId: installResult.pluginId,
          verified: installResult.verified,
          checksum: installResult.checksum,
          error: installResult.error,
        });
      }

      case 'verify_signature': {
        if (!input.packageDir) {
          return JSON.stringify({
            status: 'error',
            message: 'packageDir is required to verify plugin signature.',
          });
        }

        const verifyResult = this.installer.verifyLocalPackage(input.packageDir);
        return JSON.stringify({
          status: 'success',
          action: 'verify_signature',
          verified: verifyResult.ok,
          verifyStatus: verifyResult.status,
          checksum: verifyResult.packageChecksum,
          findings: verifyResult.findings,
        });
      }

      case 'hot_reload': {
        if (!input.pluginId || !input.pluginDir) {
          return JSON.stringify({
            status: 'error',
            message: 'pluginId and pluginDir are required to start hot-reload.',
          });
        }

        this.hotReloadController.watchPlugin({
          pluginId: input.pluginId,
          pluginDir: input.pluginDir,
        });

        return JSON.stringify({
          status: 'success',
          action: 'hot_reload',
          pluginId: input.pluginId,
          message: `Hot-reload watcher active for plugin "${input.pluginId}" on "${input.pluginDir}".`,
        });
      }

      default:
        return JSON.stringify({
          status: 'error',
          message: `Unknown action: ${String(input.action)}`,
        });
    }
  }
}
