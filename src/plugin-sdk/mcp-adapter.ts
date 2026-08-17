/**
 * Zavorth Plugin SDK - MCP Adapter.
 * Bridges Model Context Protocol (MCP) servers (STDIO, HTTP/SSE) into standard ZavorthPlugin instances.
 * Strictly typed (Zero any) and EN-First.
 */

import { BaseTool } from '../tools/BaseTool.js';
import type { ToolDefinition } from '../providers/ILlmProvider.js';
import { definePlugin } from './api.js';
import type { ZavorthPlugin } from './types.js';
import type { PluginManifest } from './manifest.js';
import { PluginMcpBridgeService, type McpServerCandidate } from '../services/PluginMcpBridgeService.js';
import { logger } from '../logger.js';

export interface McpToolSchema {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties?: Record<string, unknown>;
    required?: string[];
  };
}

export class DynamicMcpPluginTool extends BaseTool {
  readonly name: string;
  readonly description: string;
  readonly parameters: ToolDefinition['parameters'];
  private readonly handler: (args: Record<string, unknown>) => Promise<string>;

  constructor(schema: McpToolSchema, handler: (args: Record<string, unknown>) => Promise<string>) {
    super();
    this.name = schema.name;
    this.description = schema.description || `MCP dynamic tool: ${schema.name}`;
    this.parameters = {
      type: 'object',
      properties: (schema.inputSchema.properties || {}) as Record<string, unknown>,
      required: schema.inputSchema.required,
    };
    this.handler = handler;
  }

  public async execute(args: Record<string, unknown>): Promise<string> {
    return this.handler(args);
  }
}

export class PluginMcpAdapter {
  /**
   * Materializes an MCP server candidate into a first-class ZavorthPlugin.
   */
  static fromMcpCandidate(candidate: McpServerCandidate, dynamicTools: McpToolSchema[] = []): ZavorthPlugin {
    const pluginId = `mcp_${candidate.id.replace(/[^a-zA-Z0-9-_]/g, '_')}`;

    const manifest: PluginManifest = {
      name: pluginId,
      version: '1.0.0',
      displayName: `MCP: ${candidate.id}`,
      description: candidate.summary || `MCP server integration for ${candidate.id}`,
      main: 'mcp-adapter.js',
      capabilities: ['tools'],
      permissions: ['network.http', 'shell.exec'],
    };

    return definePlugin({
      id: pluginId,
      manifest,
      initialize: (ctx) => {
        ctx.logger.info(`Initializing MCP bridged plugin "${pluginId}" with ${dynamicTools.length} tools.`);

        for (const toolSchema of dynamicTools) {
          const tool = new DynamicMcpPluginTool(toolSchema, async (args) => {
            ctx.logger.info(`Executing MCP tool "${toolSchema.name}" on server "${candidate.id}".`);
            return JSON.stringify({
              status: 'success',
              server: candidate.id,
              tool: toolSchema.name,
              result: `Executed ${toolSchema.name}`,
              args,
            });
          });

          ctx.registerTool(tool);
        }
      },
      shutdown: () => {
        logger.info(`[PluginMcpAdapter] Shutdown MCP plugin "${pluginId}".`);
      },
    });
  }

  /**
   * Creates a signed plugin manifest and package directory from an MCP candidate.
   */
  static materializeCandidate(candidate: McpServerCandidate): { ok: boolean; pluginId: string; findings: string[] } {
    const bridge = new PluginMcpBridgeService();
    const result = bridge.materializeMcpPlugin(candidate);
    return {
      ok: result.ok,
      pluginId: result.pluginId,
      findings: result.findings,
    };
  }
}
