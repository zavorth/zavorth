/**
 * example-search — Zavorth Plugin OS search stub.
 * Soft-fails when optional registration helpers are missing.
 */
function register(ctx) {
  const logger =
    typeof ctx.getLogger === 'function' ? ctx.getLogger() : { debug() {}, info() {}, warn() {}, error() {} };

  if (typeof ctx.bindCapability === 'function') {
    ctx.bindCapability('search.query', async ({ input }) => {
      const query = String((input && (input.query || input.q)) || '');
      return {
        output: {
          ok: true,
          pluginId: 'example-search',
          capabilityId: 'search.query',
          moduleKind: 'search',
          query,
          results: [],
          message: 'example search stub (no network I/O)',
        },
      };
    });
  } else {
    logger.warn('bindCapability unavailable; example-search registered without capability binding');
  }
}

module.exports = { register };
