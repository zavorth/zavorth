/**
 * example-workspace — Zavorth Plugin OS workspace stub.
 * Soft-fails when optional registration helpers are missing.
 */
function register(ctx) {
  const logger =
    typeof ctx.getLogger === 'function' ? ctx.getLogger() : { debug() {}, info() {}, warn() {}, error() {} };

  if (typeof ctx.bindCapability === 'function') {
    ctx.bindCapability('workspace.info', async ({ input }) => {
      const workspacePath = typeof ctx.getWorkspacePath === 'function' ? ctx.getWorkspacePath() : null;
      return {
        output: {
          ok: true,
          pluginId: 'example-workspace',
          capabilityId: 'workspace.info',
          moduleKind: 'workspace',
          workspacePath,
          input: input || {},
          message: 'example workspace stub',
        },
      };
    });
  } else {
    logger.warn('bindCapability unavailable; example-workspace registered without capability binding');
  }
}

module.exports = { register };
