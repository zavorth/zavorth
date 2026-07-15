/**
 * example-sandbox — Zavorth Plugin OS sandbox stub.
 * Soft-fails when optional registration helpers are missing.
 */
function register(ctx) {
  const logger =
    typeof ctx.getLogger === 'function' ? ctx.getLogger() : { debug() {}, info() {}, warn() {}, error() {} };

  if (typeof ctx.bindCapability === 'function') {
    ctx.bindCapability('sandbox.run', async ({ input }) => ({
      output: {
        ok: true,
        pluginId: 'example-sandbox',
        capabilityId: 'sandbox.run',
        moduleKind: 'sandbox',
        spawned: false,
        input: input || {},
        message: 'example sandbox stub (no process spawn)',
      },
    }));
  } else {
    logger.warn('bindCapability unavailable; example-sandbox registered without capability binding');
  }
}

module.exports = { register };
