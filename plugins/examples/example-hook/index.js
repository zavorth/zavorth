function register(ctx) {
  const logger = ctx.getLogger();

  ctx.bindCapability('agent.ping', async ({ input }) => ({
    output: {
      pluginId: 'example-hook',
      capabilityId: 'agent.ping',
      ok: true,
      input: input || {},
    },
  }));

  ctx.registerHook('tool.before_execute', async ({ context }) => {
    logger.debug('tool.before_execute', {
      tool: context && context.toolName ? context.toolName : null,
    });
  });

  ctx.registerHook('agent.after_turn', async ({ context }) => {
    logger.debug('agent.after_turn', {
      turn: context && context.turnId ? context.turnId : null,
    });
  });
}

module.exports = { register };
