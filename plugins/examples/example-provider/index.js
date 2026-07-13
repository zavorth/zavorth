function register(ctx) {
  ctx.bindProvider({
    id: 'example-provider',
    capabilityId: 'provider.complete',
    name: 'example-provider',
    complete: async (request) => ({
      ok: true,
      pluginId: 'example-provider',
      text: 'example provider complete',
      request: request || {},
    }),
  });
}

module.exports = { register };
