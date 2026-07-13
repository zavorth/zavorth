const { createJanitor } = require('./janitor.js');

function register(ctx) {
  const workspacePath = ctx.getWorkspacePath();
  const janitor = createJanitor(workspacePath);
  const logger = ctx.getLogger();

  ctx.bindCapability('ephemera.status', async () => ({
    output: janitor.buildStatus(),
    artifacts: [janitor.ledgerPath],
  }));

  ctx.bindCapability('ephemera.sweep', async ({ input }) => {
    const apply = input?.apply === true || input?.mode === 'apply';
    if (apply) {
      const allowed = await ctx.requestPermission(
        'filesystem.write',
        'Apply session scratch cleanup for allowlisted ephemeral files',
      );
      if (!allowed) {
        return {
          output: {
            ok: false,
            reason: 'filesystem.write permission was not granted for apply mode',
            receipt: janitor.sweep({ apply: false }),
          },
        };
      }
    }
    const receipt = janitor.sweep({ apply });
    return {
      output: {
        ok: true,
        receipt,
      },
      artifacts: [janitor.ledgerPath],
      receipts: ['session-scratch-janitor.receipt'],
    };
  });

  ctx.registerHook('tool.after_execute', async ({ context }) => {
    try {
      const result = janitor.observeToolContext(context || {});
      if (result.tracked.length > 0) {
        logger.debug('tracked scratch paths', {
          count: result.tracked.length,
          paths: result.tracked.slice(0, 5),
        });
        ctx.emit({
          type: 'session-scratch-janitor.tracked',
          payload: { tracked: result.tracked },
        });
      }
    } catch (error) {
      logger.warn('tool.after_execute observe failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  ctx.registerHook('agent.after_turn', async () => {
    try {
      const status = janitor.buildStatus();
      if (status.activeCount === 0) {
        return;
      }
      const receipt = janitor.sweep({ apply: false });
      logger.info('agent.after_turn dry-run sweep', {
        planned: receipt.plannedCount,
      });
      ctx.emit({
        type: 'session-scratch-janitor.turn-sweep-preview',
        payload: receipt,
      });
    } catch (error) {
      logger.warn('agent.after_turn sweep failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  ctx.registerHook('shutdown.before', async () => {
    try {
      const receipt = janitor.sweep({ apply: false });
      logger.info('shutdown.before dry-run sweep', {
        planned: receipt.plannedCount,
      });
    } catch {
      /* never block shutdown */
    }
  });

  logger.info('session-scratch-janitor registered', {
    workspace: janitor.workspaceRoot,
    ledger: janitor.ledgerPath,
  });
}

module.exports = {
  register,
};
