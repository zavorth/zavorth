/**
 * Zavorth Plugin SDK Tool.
 * Exposes plugin inspection, manifest validation, active tool discovery,
 * and sandbox permission diagnostics via ToolRegistry and Cognitive Firewall.
 */

import { BaseTool } from './BaseTool.js';
import { PluginSdkRegistry, PluginManifestValidator } from '../plugin-sdk/index.js';

export interface ZavorthPluginSdkInput {
  action: 'list' | 'validate_manifest' | 'inspect' | 'unload';
  pluginId?: string;
  manifestJson?: Record<string, unknown>;
}

export class ZavorthPluginSdkTool extends BaseTool {
  public static readonly name = 'zavorth_plugin_sdk';
  public static readonly description =
    'Inspects loaded Zavorth plugins, validates plugin manifests, tests sandbox permissions, and lists dynamic tools provided by plugins.';

  public static readonly schema = {
    type: 'object' as const,
    properties: {
      action: {
        type: 'string',
        enum: ['list', 'validate_manifest', 'inspect', 'unload'],
        description: 'Action to perform with the Plugin SDK.',
      },
      pluginId: {
        type: 'string',
        description: 'Target plugin ID for inspect or unload.',
      },
      manifestJson: {
        type: 'object',
        description: 'Raw plugin manifest JSON to validate (when action is validate_manifest).',
      },
    },
    required: ['action'] as string[],
  };

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

      default:
        return JSON.stringify({
          status: 'error',
          message: `Unknown action: ${String(input.action)}`,
        });
    }
  }
}
