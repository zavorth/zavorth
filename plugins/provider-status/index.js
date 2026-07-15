const PROVIDERS = [
  {
    id: 'openai-compatible',
    plugin: 'provider-openai-compatible',
    keys: ['OPENAI_API_KEY'],
    tip: 'Set OPENAI_API_KEY (+ optional OPENAI_BASE_URL)',
  },
  {
    id: 'anthropic',
    plugin: 'provider-anthropic',
    keys: ['ANTHROPIC_API_KEY'],
    tip: 'Set ANTHROPIC_API_KEY',
  },
  {
    id: 'xai',
    plugin: 'provider-xai',
    keys: ['XAI_API_KEY', 'GROK_API_KEY'],
    tip: 'Set XAI_API_KEY or GROK_API_KEY',
  },
  {
    id: 'gemini',
    plugin: 'provider-gemini',
    keys: ['GEMINI_API_KEY', 'GOOGLE_API_KEY'],
    tip: 'Set GEMINI_API_KEY or GOOGLE_API_KEY',
  },
];

function register(ctx) {
  ctx.bindCapability('provider.pack.status', async () => {
    const providers = PROVIDERS.map((p) => {
      const presentKeys = p.keys.filter((k) => Boolean(String(process.env[k] || '').trim()));
      return {
        id: p.id,
        plugin: p.plugin,
        configured: presentKeys.length > 0,
        presentKeys,
        tip: p.tip,
      };
    });
    const configured = providers.filter((p) => p.configured).length;
    return {
      output: {
        ok: true,
        pack: 'providers',
        configured,
        total: providers.length,
        providers,
        message:
          configured > 0
            ? `${configured}/${providers.length} provider plugins have credentials configured.`
            : 'No provider API keys detected. Core routing may still work if configured elsewhere.',
        note: 'Values are never returned — presence only.',
      },
      receipts: ['provider-status.receipt'],
    };
  });

  ctx.getLogger().info('provider-status registered');
}

module.exports = { register };
