/**
 * example-media — Zavorth Plugin OS media stub.
 * Soft-fails when optional registration helpers are missing.
 */
function register(ctx) {
  const logger =
    typeof ctx.getLogger === 'function' ? ctx.getLogger() : { debug() {}, info() {}, warn() {}, error() {} };

  if (typeof ctx.bindCapability === 'function') {
    ctx.bindCapability('media.run', async ({ input }) => ({
      output: {
        ok: true,
        pluginId: 'example-media',
        capabilityId: 'media.run',
        moduleKind: 'media',
        input: input || {},
        message: 'example media stub (no network I/O)',
      },
    }));
  } else {
    logger.warn('bindCapability unavailable; example-media registered without capability binding');
  }
}

module.exports = { register };
