const path = require('node:path');
const { createRequire } = require('node:module');

const CONNECTOR_ID = 'composio';

function register(ctx) {
  const logger = ctx.getLogger();
  const workspace = ctx.getWorkspacePath();

  function setupTips() {
    return [
      'Set COMPOSIO_API_KEY',
      'Optional: COMPOSIO_BASE_URL (default https://backend.composio.dev)',
      'zavorth plugins enable composio --yes',
      'Or: zavorth actions preview integration.connectors.doctor --args connectorId=composio',
    ];
  }

  ctx.bindCapability('composio.status', async () => {
    try {
      const mesh = softLoadMesh(workspace);
      if (!mesh) {
        return {
          output: {
            ok: false,
            configured: Boolean(process.env.COMPOSIO_API_KEY),
            reason: 'connector_mesh_unavailable',
            message: 'IntegrationConnectorMeshService not resolvable from this workspace build.',
            env: {
              COMPOSIO_API_KEY: Boolean(process.env.COMPOSIO_API_KEY),
              COMPOSIO_BASE_URL: Boolean(process.env.COMPOSIO_BASE_URL),
            },
            setup: setupTips(),
          },
        };
      }
      const doctor = await mesh.doctor(CONNECTOR_ID);
      return {
        output: {
          ok: true,
          connectorId: CONNECTOR_ID,
          configured: doctor.configured,
          status: doctor.status,
          summary: doctor.summary,
          nextAction: doctor.nextAction,
          setup: setupTips(),
        },
      };
    } catch (error) {
      logger.warn('composio.status failed', {
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

  ctx.bindCapability('composio.doctor', async () => {
    try {
      const mesh = softLoadMesh(workspace);
      if (!mesh) {
        return { output: { ok: false, reason: 'connector_mesh_unavailable', setup: setupTips() } };
      }
      const doctor = await mesh.doctor(CONNECTOR_ID);
      return { output: { ok: true, doctor } };
    } catch (error) {
      logger.warn('composio.doctor failed', {
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

  ctx.bindCapability('composio.preview', async ({ input }) => {
    try {
      const mesh = softLoadMesh(workspace);
      if (!mesh) {
        return { output: { ok: false, reason: 'connector_mesh_unavailable', setup: setupTips() } };
      }
      const toolSlug = String((input && (input.toolSlug || input.tool || input.action)) || '').trim();
      if (!toolSlug) {
        return { output: { ok: false, reason: 'toolSlug is required' } };
      }
      const payload = parsePayload(input && (input.payload || input.input || input.body));
      const preview = mesh.buildExecutePreview({
        connectorId: CONNECTOR_ID,
        toolSlug,
        input: payload,
      });
      return { output: { ok: true, preview } };
    } catch (error) {
      logger.warn('composio.preview failed', {
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

  ctx.bindCapability('composio.execute', async ({ input }) => {
    try {
      let approved = input && input.approved === true;
      if (!approved && typeof ctx.requestPermission === 'function') {
        approved = await ctx.requestPermission(
          'network.external',
          'Execute Composio tool via connector mesh',
        );
      }
      if (!approved) {
        return {
          output: {
            ok: false,
            reason: 'needs_approval',
            message: 'composio.execute requires approved===true.',
          },
        };
      }
      const mesh = softLoadMesh(workspace);
      if (!mesh) {
        return { output: { ok: false, reason: 'connector_mesh_unavailable', setup: setupTips() } };
      }
      const toolSlug = String((input && (input.toolSlug || input.tool || input.action)) || '').trim();
      if (!toolSlug) {
        return { output: { ok: false, reason: 'toolSlug is required' } };
      }
      const payload = parsePayload(input && (input.payload || input.input || input.body));
      const result = await mesh.executeTool({
        connectorId: CONNECTOR_ID,
        toolSlug,
        input: payload,
      });
      return { output: { ok: result.ok, result } };
    } catch (error) {
      logger.warn('composio.execute failed', {
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

function parsePayload(value) {
  if (!value) return {};
  if (typeof value === 'object' && !Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
    } catch {
      return { text: value };
    }
  }
  return {};
}

function softLoadMesh(workspace) {
  try {
    const req = createRequire(__filename);
    const candidates = [
      path.resolve(workspace, 'dist/services/IntegrationConnectorMeshService.js'),
      path.resolve(workspace, 'src/services/IntegrationConnectorMeshService.js'),
      path.resolve(__dirname, '../../dist/services/IntegrationConnectorMeshService.js'),
      path.resolve(__dirname, '../../src/services/IntegrationConnectorMeshService.js'),
    ];
    for (const candidate of candidates) {
      try {
        const mod = req(candidate);
        const Ctor = mod.IntegrationConnectorMeshService || mod.default;
        if (typeof Ctor === 'function') {
          return new Ctor({});
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

module.exports = { register };
