/**
 * First-party Plugin OS router: recommends plugins for an intent.
 * Never auto-enables. Optional LLM rerank via host PluginRouterService / LlmRuntimeService.
 */
function register(ctx) {
  const logger = ctx.getLogger();
  const workspace = ctx.getWorkspacePath();

  ctx.bindCapability('router.recommend', async ({ input }) => {
    try {
      const intent = String((input && (input.intent || input.query || input.text)) || '').trim();
      const limit = Math.max(1, Math.min(50, Number((input && input.limit) || 5) || 5));
      const useLlm = Boolean(
        (input && (input.useLlm === true || input.llm === true))
        || process.env.ZAVORTH_PLUGIN_ROUTER_LLM === '1',
      );

      const router = tryLoadRouterService();
      if (router && typeof router.recommend === 'function') {
        const result = await router.recommend({
          root: workspace,
          intent,
          limit,
          useLlm,
          candidates: Array.isArray(input && input.candidates) ? input.candidates : undefined,
        });
        // Fall back to local keyword ranking if router returns no recommendations for non-exact-match intents
        if (result.recommendations && result.recommendations.length > 0) {
          return {
            output: {
              ok: result.ok !== false,
              intent: result.intent || intent,
              usedLlm: Boolean(result.usedLlm),
              autoEnable: false,
              recommendations: result.recommendations,
              candidatesConsidered: result.candidatesConsidered || 0,
            },
          };
        }
        // Router returned no matches; fall back to local keyword ranking
      }

      // Fallback local keyword ranking when host service is unavailable or returns no matches.
      const candidates = discoverCandidates(workspace);
      const ranked = scoreCandidates(intent, candidates).slice(0, limit);
      return {
        output: {
          ok: true,
          intent,
          usedLlm: false,
          autoEnable: false,
          recommendations: ranked,
          candidatesConsidered: candidates.length,
          note: 'host PluginRouterService unavailable or returned no matches — keyword ranking only',
        },
      };
    } catch (error) {
      logger.warn('router.recommend failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        output: {
          ok: false,
          recommendations: [],
          message: error instanceof Error ? error.message : String(error),
          autoEnable: false,
        },
      };
    }
  });

  ctx.bindCapability('router.explain', async ({ input }) => {
    try {
      const pluginId = String((input && (input.pluginId || input.id)) || '').trim();
      const router = tryLoadRouterService();
      if (router && typeof router.explain === 'function') {
        const result = router.explain({ root: workspace, pluginId });
        return {
          output: {
            ok: true,
            found: result.found,
            pluginId: result.pluginId,
            candidate: result.candidate,
            reasons: result.reasons || [],
          },
        };
      }

      const candidates = discoverCandidates(workspace);
      const candidate = candidates.find((entry) => entry.pluginId === pluginId) || null;
      if (!candidate) {
        return {
          output: {
            ok: true,
            found: false,
            pluginId,
            reasons: ['Plugin not found among discovered manifests.'],
          },
        };
      }
      const reasons = [];
      if (candidate.summary) reasons.push(`summary: ${candidate.summary}`);
      if (candidate.moduleKind) reasons.push(`moduleKind: ${candidate.moduleKind}`);
      if (candidate.tags && candidate.tags.length) reasons.push(`tags: ${candidate.tags.join(', ')}`);
      return {
        output: {
          ok: true,
          found: true,
          pluginId,
          candidate,
          reasons,
        },
      };
    } catch (error) {
      logger.warn('router.explain failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        output: {
          ok: false,
          found: false,
          message: error instanceof Error ? error.message : String(error),
        },
      };
    }
  });

  logger.info('plugin-router-ai registered', { workspace });
}

function tryLoadRouterService() {
  const path = require('node:path');
  const candidates = [
    path.resolve(__dirname, '../../dist/services/PluginRouterService.js'),
    path.resolve(__dirname, '../../src/services/PluginRouterService.js'),
    path.resolve(__dirname, '../../src/services/PluginRouterService.ts'),
  ];
  for (const file of candidates) {
    try {
      // eslint-disable-next-line import/no-dynamic-require, global-require
      const mod = require(file);
      const Ctor = mod.PluginRouterService || mod.default;
      if (typeof Ctor === 'function') {
        return new Ctor();
      }
    } catch {
      /* try next */
    }
  }
  return null;
}

function discoverCandidates(workspace) {
  const fs = require('node:fs');
  const path = require('node:path');
  const roots = [
    path.join(workspace, 'plugins'),
    path.join(workspace, '.zavorth', 'plugins'),
  ];
  const byId = new Map();
  for (const base of roots) {
    if (!fs.existsSync(base)) continue;
    let entries = [];
    try {
      entries = fs.readdirSync(base, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name === 'examples' || entry.name.startsWith('.')) continue;
      const packageDir = path.join(base, entry.name);
      const manifestPath = path.join(packageDir, 'manifest.json');
      if (!fs.existsSync(manifestPath)) continue;
      try {
        const raw = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        const pluginId = String(raw.id || entry.name).trim();
        if (!pluginId) continue;
        byId.set(pluginId, {
          pluginId,
          label: String(raw.label || pluginId),
          summary: String(raw.summary || ''),
          description: String(raw.description || ''),
          moduleKind: String(raw.moduleKind || ''),
          tags: Array.isArray(raw.tags) ? raw.tags.map(String) : [],
          capabilities: Array.isArray(raw.capabilities) ? raw.capabilities : [],
          path: packageDir,
        });
      } catch {
        /* soft-fail */
      }
    }
    const examples = path.join(base, 'examples');
    if (fs.existsSync(examples)) {
      try {
        for (const entry of fs.readdirSync(examples, { withFileTypes: true })) {
          if (!entry.isDirectory()) continue;
          const packageDir = path.join(examples, entry.name);
          const manifestPath = path.join(packageDir, 'manifest.json');
          if (!fs.existsSync(manifestPath)) continue;
          const raw = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
          const pluginId = String(raw.id || entry.name).trim();
          if (pluginId && !byId.has(pluginId)) {
            byId.set(pluginId, {
              pluginId,
              label: String(raw.label || pluginId),
              summary: String(raw.summary || ''),
              tags: Array.isArray(raw.tags) ? raw.tags.map(String) : [],
              capabilities: Array.isArray(raw.capabilities) ? raw.capabilities : [],
              path: packageDir,
            });
          }
        }
      } catch {
        /* soft-fail */
      }
    }
  }
  return Array.from(byId.values());
}

function scoreCandidates(intent, candidates) {
  const tokens = String(intent || '')
    .toLowerCase()
    .split(/[^a-z0-9]+/u)
    .filter((t) => t.length >= 2);
  return candidates
    .map((c) => {
      let score = 0;
      const reasons = [];
      const corpus = [
        c.pluginId,
        c.label,
        c.summary,
        c.description,
        ...(c.tags || []),
        ...(c.capabilities || []).map((cap) => [cap.id, cap.intent, cap.label, cap.summary].filter(Boolean).join(' ')),
      ].join(' ').toLowerCase();
      for (const token of tokens) {
        if (corpus.includes(token)) {
          score += c.pluginId.toLowerCase().includes(token) ? 4 : 2;
          reasons.push(`match "${token}"`);
        }
      }
      return {
        pluginId: c.pluginId,
        score,
        reasons: reasons.slice(0, 6),
        capabilities: (c.capabilities || []).map((cap) => cap.id).filter(Boolean),
        label: c.label,
        summary: c.summary,
        moduleKind: c.moduleKind,
        path: c.path || null,
      };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.pluginId.localeCompare(b.pluginId));
}

function normalizeCandidate(input) {
  return {
    pluginId: String((input && input.pluginId) || '').trim(),
    label: input && input.label,
    summary: input && input.summary,
    tags: Array.isArray(input && input.tags) ? input.tags.map(String) : [],
    capabilities: Array.isArray(input && input.capabilities) ? input.capabilities : [],
  };
}

module.exports = { register };
