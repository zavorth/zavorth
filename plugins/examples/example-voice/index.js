/**
 * example-voice — Zavorth Plugin OS voice stub.
 * Soft-fails when optional registration helpers are missing.
 */
function register(ctx) {
  const logger =
    typeof ctx.getLogger === 'function' ? ctx.getLogger() : { debug() {}, info() {}, warn() {}, error() {} };

  if (typeof ctx.bindCapability === 'function') {
    ctx.bindCapability('voice.run', async ({ input }) => ({
      output: {
        ok: true,
        pluginId: 'example-voice',
        capabilityId: 'voice.run',
        moduleKind: 'voice',
        input: input || {},
        message: 'example voice stub (no audio I/O)',
      },
    }));
  } else {
    logger.warn('bindCapability unavailable; example-voice registered without capability binding');
  }
}

module.exports = { register };
