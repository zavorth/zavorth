const path = require('node:path');
const { createRequire } = require('node:module');

function register(ctx) {
  const logger = ctx.getLogger();
  const workspace = ctx.getWorkspacePath();

  ctx.bindCapability('mcp.list', async () => {
    try {
      const service = softLoadBridge(workspace);
      if (!service) {
        return {
          output: {
            ok: false,
            servers: [],
            reason: 'plugin_mcp_bridge_unavailable',
            setup: setupTips(),
          },
        };
      }
      const servers = service.listServers({ root: workspace });
      return {
        output: {
          ok: true,
          count: servers.length,
          servers,
        },
      };
    } catch (error) {
      logger.warn('mcp.list failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        output: {
          ok: false,
          servers: [],
          message: error instanceof Error ? error.message : String(error),
          setup: setupTips(),
        },
      };
    }
  });

  ctx.bindCapability('mcp.materialize', async ({ input }) => {
    try {
      const serverId = String(
        (input && (input.serverId || input.id || input.mcpId || input.name)) || '',
      ).trim();
      if (!serverId) {
        return { output: { ok: false, reason: 'serverId is required' } };
      }
      const service = softLoadBridge(workspace);
      if (!service) {
        return {
          output: {
            ok: false,
            reason: 'plugin_mcp_bridge_unavailable',
            setup: setupTips(),
          },
        };
      }
      const result = service.materializeBridgePlugin(serverId, {
        root: workspace,
        force: Boolean(input && input.force),
        sign: input && input.sign === false ? false : true,
      });
      return {
        output: {
          ok: result.ok,
          pluginId: result.pluginId,
          packageDir: result.packageDir,
          signed: result.signed,
          findings: result.findings,
          text: typeof result.formatText === 'function' ? result.formatText() : undefined,
        },
      };
    } catch (error) {
      logger.warn('mcp.materialize failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        output: {
          ok: false,
          message: error instanceof Error ? error.message : String(error),
          setup: setupTips(),
        },
      };
    }
  });

  ctx.bindCapability('mcp.status', async ({ input }) => {
    try {
      const serverId = String(
        (input && (input.serverId || input.id || input.mcpId || input.name)) || '',
      ).trim();
      const service = softLoadBridge(workspace);
      if (!service) {
        return {
          output: {
            ok: false,
            reason: 'plugin_mcp_bridge_unavailable',
            setup: setupTips(),
          },
        };
      }
      const servers = service.listServers({ root: workspace });
      if (!serverId) {
        return {
          output: {
            ok: true,
            count: servers.length,
            servers: servers.map((server) => ({
              id: server.id,
              enabled: server.enabled,
              summary: server.summary,
            })),
          },
        };
      }
      const hit = servers.find((server) => server.id === serverId);
      if (!hit) {
        return {
          output: {
            ok: false,
            reason: 'not_found',
            serverId,
            known: servers.map((server) => server.id),
            setup: setupTips(),
          },
        };
      }
      return {
        output: {
          ok: true,
          serverId: hit.id,
          enabled: hit.enabled,
          command: hit.command || null,
          capability: hit.capability || null,
          summary: hit.summary,
          message: hit.enabled
            ? `MCP server ${hit.id} is enabled in config.`
            : `Enable MCP server ${hit.id} in config/mcp-servers.json.`,
        },
      };
    } catch (error) {
      logger.warn('mcp.status failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        output: {
          ok: false,
          message: error instanceof Error ? error.message : String(error),
          setup: setupTips(),
        },
      };
    }
  });

  ctx.bindCapability('mcp.invoke', async ({ input }) => {
    try {
      const serverId = String(
        (input && (input.serverId || input.id || input.mcpId || input.name)) || '',
      ).trim();
      if (!serverId) {
        return { output: { ok: false, reason: 'serverId is required' } };
      }
      const tool = (input && (input.tool || input.method || input.toolName)) || null;
      const args = (input && (input.args || input.arguments || input.params)) || {};
      const result = await softInvokeMcp({
        workspace,
        serverId,
        tool,
        args,
      });
      return { output: result };
    } catch (error) {
      logger.warn('mcp.invoke failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        output: {
          ok: false,
          message: error instanceof Error ? error.message : String(error),
          setup: setupTips(),
        },
      };
    }
  });
}

function setupTips() {
  return [
    'Configure servers in config/mcp-servers.json',
    'CLI: zavorth plugins mcp list',
    'CLI: zavorth plugins mcp materialize filesystem --yes',
    'CLI: zavorth plugins enable mcp-bridge --yes',
  ];
}

function softLoadBridge(workspace) {
  try {
    const req = createRequire(__filename);
    const candidates = [
      path.resolve(workspace, 'dist/services/PluginMcpBridgeService.js'),
      path.resolve(workspace, 'src/services/PluginMcpBridgeService.js'),
      path.resolve(__dirname, '../../dist/services/PluginMcpBridgeService.js'),
      path.resolve(__dirname, '../../src/services/PluginMcpBridgeService.js'),
    ];
    for (const candidate of candidates) {
      try {
        const mod = req(candidate);
        const Ctor = mod.PluginMcpBridgeService || mod.default;
        if (typeof Ctor === 'function') {
          return new Ctor({ projectRoot: workspace });
        }
      } catch {
        /* next */
      }
    }
  } catch {
    /* soft-fail */
  }
  return null;
}

async function softInvokeMcp({ workspace, serverId, tool, args }) {
  try {
    const req = createRequire(__filename);
    const accessCandidates = [
      path.resolve(workspace, 'dist/services/PluginOsMcpRuntimeAccess.js'),
      path.resolve(workspace, 'src/services/PluginOsMcpRuntimeAccess.js'),
      path.resolve(__dirname, '../../dist/services/PluginOsMcpRuntimeAccess.js'),
      path.resolve(__dirname, '../../src/services/PluginOsMcpRuntimeAccess.js'),
    ];
    for (const candidate of accessCandidates) {
      try {
        const mod = req(candidate);
        if (typeof mod.invokePluginOsMcp === 'function') {
          return await mod.invokePluginOsMcp({
            serverId,
            tool,
            args: args || {},
          });
        }
        if (typeof mod.getPluginOsMcpRuntime === 'function') {
          const runtime = mod.getPluginOsMcpRuntime();
          if (runtime && typeof runtime.invoke === 'function') {
            return await runtime.invoke({
              serverId,
              tool,
              args: args || {},
            });
          }
        }
      } catch {
        /* next */
      }
    }
  } catch {
    /* soft-fail */
  }
  return {
    ok: false,
    reason: 'mcp_runtime_unavailable',
    serverId,
    requestedTool: tool || null,
    args: args || {},
    message: 'Live McpRuntime is not wired. Start the Zavorth runtime, then retry.',
    setup: setupTips(),
  };
}

module.exports = { register };
