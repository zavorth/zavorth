function register(ctx) {
  ctx.bindCapability('ephemera.status', async () => ({
    output: {
      pluginId: 'example-auxiliary',
      capabilityId: 'ephemera.status',
      ok: true,
      status: 'idle',
      activeCount: 0,
    },
  }));
}

module.exports = { register };
