const fs = require('node:fs');
const path = require('node:path');

function register(ctx) {
  const logger = ctx.getLogger();
  const workspace = ctx.getWorkspacePath();
  const ledgerDir = path.join(workspace, '.zavorth', 'cost-tracker');
  const ledgerPath = path.join(ledgerDir, 'ledger.jsonl');
  const pending = new Map();

  function ensureLedgerDir() {
    if (!fs.existsSync(ledgerDir)) {
      fs.mkdirSync(ledgerDir, { recursive: true });
    }
  }

  function appendLedger(entry) {
    ensureLedgerDir();
    fs.appendFileSync(ledgerPath, `${JSON.stringify(entry)}\n`, 'utf8');
  }

  function readEntries() {
    if (!fs.existsSync(ledgerPath)) return [];
    try {
      return fs
        .readFileSync(ledgerPath, 'utf8')
        .split(/\r?\n/u)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          try {
            return JSON.parse(line);
          } catch {
            return null;
          }
        })
        .filter(Boolean);
    } catch {
      return [];
    }
  }

  function buildSummary() {
    const entries = readEntries();
    let totalTokens = 0;
    let totalDurationMs = 0;
    let requests = 0;
    let completed = 0;
    for (const entry of entries) {
      if (entry.kind === 'after_request' || entry.kind === 'request') {
        completed += 1;
        totalTokens += Number(entry.tokens || entry.totalTokens || 0) || 0;
        totalDurationMs += Number(entry.durationMs || 0) || 0;
      }
      if (entry.kind === 'before_request') {
        requests += 1;
      }
    }
    return {
      ok: true,
      ledgerPath,
      requests: Math.max(requests, completed),
      completed,
      totalTokens,
      totalDurationMs,
      entryCount: entries.length,
    };
  }

  ctx.bindCapability('cost.summary', async () => {
    try {
      return { output: buildSummary(), artifacts: [ledgerPath] };
    } catch (error) {
      logger.warn('cost.summary failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        output: {
          ok: false,
          message: error instanceof Error ? error.message : String(error),
        },
      };
    }
  });

  ctx.bindCapability('cost.reset', async () => {
    try {
      const allowed = await ctx.requestPermission(
        'filesystem.write',
        'Clear cost-tracker ledger',
      );
      if (!allowed) {
        return {
          output: {
            ok: false,
            reason: 'filesystem.write permission was not granted',
          },
        };
      }
      ensureLedgerDir();
      fs.writeFileSync(ledgerPath, '', 'utf8');
      pending.clear();
      return { output: { ok: true, cleared: true, ledgerPath } };
    } catch (error) {
      logger.warn('cost.reset failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        output: {
          ok: false,
          message: error instanceof Error ? error.message : String(error),
        },
      };
    }
  });

  ctx.registerHook('llm.before_request', async ({ context }) => {
    try {
      const requestId = String(
        (context && (context.requestId || context.id || context.traceId))
        || `req-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      );
      const startedAt = Date.now();
      pending.set(requestId, { startedAt, context: context || {} });
      appendLedger({
        kind: 'before_request',
        requestId,
        at: new Date().toISOString(),
        provider: context && (context.primaryProviderName || context.requestedProviderName),
        messageCount: context && context.messageCount,
      });
      if (context && typeof context === 'object') {
        context.__costTrackerRequestId = requestId;
        context.__costTrackerStartedAt = startedAt;
      }
    } catch (error) {
      logger.warn('llm.before_request hook failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  ctx.registerHook('llm.after_request', async ({ context }) => {
    try {
      const requestId = String(
        (context && (context.__costTrackerRequestId || context.requestId || context.id || context.traceId))
        || '',
      );
      const started = requestId && pending.get(requestId);
      const startedAt = (started && started.startedAt)
        || Number(context && context.__costTrackerStartedAt)
        || Number(context && context.startedAt)
        || Date.now();
      const durationMs = Math.max(0, Date.now() - startedAt);
      const tokens = Number(
        (context && (
          context.totalTokens
          || context.tokens
          || (context.usage && (context.usage.total_tokens || context.usage.totalTokens))
          || ((context.usage && context.usage.prompt_tokens) || 0)
            + ((context.usage && context.usage.completion_tokens) || 0)
        )) || 0,
      ) || 0;
      appendLedger({
        kind: 'after_request',
        requestId: requestId || null,
        at: new Date().toISOString(),
        durationMs,
        tokens,
        provider: context && (context.providerName || context.primaryProviderName),
        model: context && (context.model || context.modelId),
        ok: context ? context.ok !== false : true,
      });
      if (requestId) pending.delete(requestId);
    } catch (error) {
      logger.warn('llm.after_request hook failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });
}

module.exports = { register };
