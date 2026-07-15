/**
 * example-bridge — generic Plugin OS bridge (HTTP / CLI / MCP).
 * Soft-fails without endpoint; never auto-calls private networks.
 * Brand-agnostic: operator supplies url/command/mcpServer only.
 */
function register(ctx) {
  const logger =
    typeof ctx.getLogger === 'function' ? ctx.getLogger() : { debug() {}, info() {}, warn() {}, error() {} };

  async function invokeBridge({ input }) {
    const body = input && typeof input === 'object' ? input : {};
    const mode = String(body.mode || body.transport || 'http').toLowerCase();
    const endpoint = String(body.url || body.endpoint || process.env.ZAVORTH_BRIDGE_ENDPOINT || '').trim();
    const command = String(body.command || body.cli || process.env.ZAVORTH_BRIDGE_CLI || '').trim();
    const mcpServer = String(body.mcpServer || body.server || process.env.ZAVORTH_BRIDGE_MCP_SERVER || '').trim();
    const payload = body.payload !== undefined ? body.payload : body;

    if (mode === 'cli' || mode === 'shell' || mode === 'process') {
      if (!command) {
        return {
          output: {
            ok: false,
            softFail: true,
            reason: 'cli_missing',
            pluginId: 'example-bridge',
            capabilityId: 'bridge.invoke',
            mode: 'cli',
            message: 'CLI bridge soft-fail: set command/cli or ZAVORTH_BRIDGE_CLI.',
          },
        };
      }
      return {
        output: {
          ok: true,
          softFail: true,
          forwarded: false,
          pluginId: 'example-bridge',
          capabilityId: 'bridge.invoke',
          mode: 'cli',
          command,
          payload,
          message: 'CLI bridge planned only (example does not spawn processes).',
        },
      };
    }

    if (mode === 'mcp') {
      if (!mcpServer) {
        return {
          output: {
            ok: false,
            softFail: true,
            reason: 'mcp_server_missing',
            pluginId: 'example-bridge',
            capabilityId: 'bridge.invoke',
            mode: 'mcp',
            message: 'MCP bridge soft-fail: set mcpServer or ZAVORTH_BRIDGE_MCP_SERVER.',
          },
        };
      }
      return {
        output: {
          ok: true,
          softFail: true,
          forwarded: false,
          pluginId: 'example-bridge',
          capabilityId: 'bridge.invoke',
          mode: 'mcp',
          mcpServer,
          payload,
          message: 'MCP bridge planned only (wire via plugins mcp materialize when ready).',
        },
      };
    }

    if (!endpoint) {
      return {
        output: {
          ok: false,
          softFail: true,
          reason: 'endpoint_missing',
          pluginId: 'example-bridge',
          capabilityId: 'bridge.invoke',
          mode: 'http',
          message: 'HTTP bridge soft-fail: set url/endpoint or ZAVORTH_BRIDGE_ENDPOINT.',
        },
      };
    }
    if (!/^https:\/\//i.test(endpoint)) {
      return {
        output: {
          ok: false,
          softFail: true,
          reason: 'https_required',
          pluginId: 'example-bridge',
          capabilityId: 'bridge.invoke',
          mode: 'http',
          endpoint,
          message: 'HTTP bridge requires public HTTPS URL (SSRF-safe policy).',
        },
      };
    }
    return {
      output: {
        ok: true,
        softFail: true,
        forwarded: false,
        pluginId: 'example-bridge',
        capabilityId: 'bridge.invoke',
        mode: 'http',
        endpoint,
        payload,
        message: 'HTTP bridge planned only (example does not perform outbound fetch).',
      },
    };
  }

  if (typeof ctx.bindCapability === 'function') {
    ctx.bindCapability('bridge.invoke', invokeBridge);
    ctx.bindCapability('bridge.forward', invokeBridge);
  } else {
    logger.warn('bindCapability unavailable; example-bridge registered without capability binding');
  }
}

module.exports = { register };
