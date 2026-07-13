function register(ctx) {
  ctx.bindCapability('main.run', async ({ input }) => ({
    output: {
      pluginId: 'hello-world',
      capabilityId: 'main.run',
      ok: true,
      echo: input || {},
      message: 'hello from Plugin OS',
    },
  }));
}

module.exports = { register };
