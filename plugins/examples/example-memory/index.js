function register(ctx) {
  const store = new Map();

  ctx.bindMemoryBackend({
    id: 'example-memory',
    capabilityId: 'memory.read',
    read: async (input) => {
      const key = String((input && input.key) || '');
      return {
        key,
        value: store.has(key) ? store.get(key) : null,
        pluginId: 'example-memory',
      };
    },
    write: async (input) => {
      const key = String((input && input.key) || '');
      const value = input ? input.value : null;
      store.set(key, value);
      return { ok: true, key, value };
    },
  });
}

module.exports = { register };
