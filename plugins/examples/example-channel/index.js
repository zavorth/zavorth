function register(ctx) {
  ctx.bindChannel({
    id: 'example-channel',
    capabilityId: 'channel.send',
    label: 'Example Channel',
    send: async (payload) => ({
      ok: true,
      pluginId: 'example-channel',
      delivered: false,
      payload: payload || {},
    }),
  });
}

module.exports = { register };
