const path = require('node:path');
const { createRequire } = require('node:module');

function register(ctx) {
  const logger = ctx.getLogger();
  const workspace = ctx.getWorkspacePath();

  ctx.bindCapability('forge.plan', async ({ input }) => {
    try {
      const intent = String((input && (input.intent || input.text || input.query)) || '').trim();
      if (!intent) {
        return { output: { ok: false, reason: 'intent is required' } };
      }
      const service = softLoadForge(workspace);
      if (!service) {
        return {
          output: {
            ok: false,
            reason: 'plugin_forge_unavailable',
            message: 'PluginForgeService could not be loaded from the monorepo.',
            setup: setupTips(),
          },
        };
      }
      const plan = await service.plan(intent, {
        id: input && input.id ? String(input.id) : undefined,
        root: workspace,
      });
      return {
        output: {
          ok: plan.ok,
          intent: plan.intent,
          pluginId: plan.pluginId,
          previewDir: plan.previewDir,
          findings: plan.findings,
          nextCommands: plan.nextCommands,
          files: (plan.files || []).map((file) => file.path),
          text: typeof plan.formatText === 'function' ? plan.formatText() : undefined,
        },
      };
    } catch (error) {
      logger.warn('forge.plan failed', {
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

  ctx.bindCapability('forge.apply', async ({ input }) => {
    try {
      const previewDir = String(
        (input && (input.previewDir || input.preview || input.path || input.id)) || '',
      ).trim();
      if (!previewDir) {
        return { output: { ok: false, reason: 'previewDir is required' } };
      }
      const approved = input && (input.approved === true || input.yes === true);
      if (!approved) {
        const permissionOk = typeof ctx.requestPermission === 'function'
          ? await ctx.requestPermission('filesystem.write', 'Apply forge plugin preview')
          : false;
        if (!permissionOk) {
          return {
            output: {
              ok: false,
              reason: 'needs_approval',
              message: 'forge.apply requires approved===true or filesystem.write permission.',
            },
          };
        }
      }
      const service = softLoadForge(workspace);
      if (!service) {
        return {
          output: {
            ok: false,
            reason: 'plugin_forge_unavailable',
            setup: setupTips(),
          },
        };
      }
      const result = await service.apply(previewDir, {
        approved: true,
        enable: Boolean(input && input.enable),
        root: workspace,
      });
      return {
        output: {
          ok: result.ok,
          pluginId: result.pluginId,
          targetDir: result.targetDir,
          testOk: result.testOk,
          receiptPath: result.receiptPath,
          findings: result.findings,
          text: typeof result.formatText === 'function' ? result.formatText() : undefined,
        },
      };
    } catch (error) {
      logger.warn('forge.apply failed', {
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
    'Use CLI: zavorth plugins forge plan "<intent>"',
    'Apply with: zavorth plugins forge apply <previewDir> --yes',
    'Ensure monorepo src/services/PluginForgeService is available.',
  ];
}

function softLoadForge(workspace) {
  try {
    const req = createRequire(__filename);
    const candidates = [
      path.resolve(workspace, 'dist/services/PluginForgeService.js'),
      path.resolve(workspace, 'src/services/PluginForgeService.js'),
      path.resolve(__dirname, '../../dist/services/PluginForgeService.js'),
      path.resolve(__dirname, '../../src/services/PluginForgeService.js'),
    ];
    for (const candidate of candidates) {
      try {
        const mod = req(candidate);
        const Ctor = mod.PluginForgeService || mod.default;
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

module.exports = { register };
