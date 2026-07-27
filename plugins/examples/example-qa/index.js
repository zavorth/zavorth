/**
 * example-qa - Zavorth Plugin OS QA template.
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
        message: 'example QA template (returns a deterministic check result)',
      },
    }));
  } else {
    logger.warn('bindCapability unavailable; example-qa registered without capability binding');
  }
}

module.exports = { register };
