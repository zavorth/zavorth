/**
 * example-qa — Zavorth Plugin OS QA stub.
 * Soft-fails when optional registration helpers are missing.
 */
function register(ctx) {
  const logger =
    typeof ctx.getLogger === 'function' ? ctx.getLogger() : { debug() {}, info() {}, warn() {}, error() {} };

  if (typeof ctx.bindCapability === 'function') {
    ctx.bindCapability('qa.check', async ({ input }) => ({
      output: {
        ok: true,
        pluginId: 'example-qa',
        capabilityId: 'qa.check',
        moduleKind: 'qa',
        passed: true,
        findings: [],
        input: input || {},
        message: 'example QA stub (always pass)',
      },
    }));
  } else {
    logger.warn('bindCapability unavailable; example-qa registered without capability binding');
  }
}

module.exports = { register };
