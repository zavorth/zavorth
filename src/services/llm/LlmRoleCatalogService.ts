import { config } from '../../config/index.js';
import { ProviderFactory } from '../../providers/ProviderFactory.js';
import { safeFetch } from '../../security/SafeFetchService.js';

export type CatalogModel = {
  provider: string;
  model: string;
  family: string;
  tier: 'fast' | 'balanced' | 'strong';
  aliases: string[];
};

const CATALOG: CatalogModel[] = [
  {
    provider: 'gemini',
    model: 'gemini-2.5-flash',
    family: 'gemini',
    tier: 'fast',
    aliases: ['flash', '2.5 flash', 'gemini flash', 'gemini-2.5-flash'],
  },
  {
    provider: 'gemini',
    model: 'gemini-2.5-pro',
    family: 'gemini',
    tier: 'strong',
    aliases: ['pro', '2.5 pro', 'gemini pro', 'gemini-2.5-pro'],
  },
  {
    provider: 'gemini',
    model: 'gemini-2.0-flash',
    family: 'gemini',
    tier: 'fast',
    aliases: ['2.0 flash', 'gemini-2.0-flash'],
  },
  {
    provider: 'openai',
    model: 'gpt-4o-mini',
    family: 'gpt',
    tier: 'fast',
    aliases: ['4o mini', 'gpt-4o-mini', 'mini'],
  },
  {
    provider: 'openai',
    model: 'gpt-4o',
    family: 'gpt',
    tier: 'strong',
    aliases: ['4o', 'gpt-4o', 'gpt4o'],
  },
  {
    provider: 'openai',
    model: 'gpt-4.1',
    family: 'gpt',
    tier: 'strong',
    aliases: ['4.1', 'gpt-4.1'],
  },
  {
    provider: 'deepseek',
    model: 'deepseek-chat',
    family: 'deepseek',
    tier: 'balanced',
    aliases: ['deepseek', 'deepseek-chat'],
  },
  {
    provider: 'deepseek',
    model: 'deepseek-reasoner',
    family: 'deepseek',
    tier: 'strong',
    aliases: ['reasoner', 'deepseek-reasoner'],
  },
  {
    provider: 'openrouter',
    model: 'openrouter/auto',
    family: 'openrouter',
    tier: 'balanced',
    aliases: ['openrouter', 'auto'],
  },
  {
    provider: 'xai',
    model: 'grok-3',
    family: 'xai',
    tier: 'strong',
    aliases: ['grok', 'grok-3', 'xai'],
  },
  {
    provider: 'xai',
    model: 'grok-3-mini',
    family: 'xai',
    tier: 'fast',
    aliases: ['grok mini', 'grok-3-mini'],
  },
  {
    provider: 'anthropic',
    model: 'claude-sonnet-4',
    family: 'claude',
    tier: 'strong',
    aliases: ['sonnet', 'claude sonnet', 'claude-sonnet-4'],
  },
  {
    provider: 'anthropic',
    model: 'claude-haiku-4',
    family: 'claude',
    tier: 'fast',
    aliases: ['haiku', 'claude haiku', 'claude-haiku-4'],
  },
];

export class LlmRoleCatalogService {
  private liveExtras: CatalogModel[] = [];

  public listKnownModels(): CatalogModel[] {
    const fromConfig = this.configBackedModels();
    const byKey = new Map<string, CatalogModel>();
    for (const entry of [...CATALOG, ...fromConfig, ...this.liveExtras]) {
      byKey.set(`${entry.provider}::${entry.model}`, entry);
    }
    return Array.from(byKey.values());
  }

  public listUsableModels(isProviderUsable: (name: string) => boolean): CatalogModel[] {
    return this.listKnownModels().filter(
      (entry) => isProviderUsable(entry.provider) && this.hasProviderCredential(entry.provider),
    );
  }

  public hasProviderCredential(provider: string): boolean {
    const p = String(provider || '').toLowerCase();
    const env = process.env;
    switch (p) {
      case 'gemini':
      case 'google':
        return Boolean(String(env.GEMINI_API_KEY || env.GOOGLE_API_KEY || '').trim());
      case 'openai':
        return Boolean(String(env.OPENAI_API_KEY || '').trim());
      case 'anthropic':
        return Boolean(String(env.ANTHROPIC_API_KEY || '').trim());
      case 'deepseek':
        return Boolean(String(env.DEEPSEEK_API_KEY || '').trim());
      case 'openrouter':
        return Boolean(String(env.OPENROUTER_API_KEY || '').trim());
      case 'xai':
        return Boolean(String(env.XAI_API_KEY || env.GROK_API_KEY || '').trim());
      case 'aigateway':
        return true;
      default:
        return true;
    }
  }

  public async refreshLiveModels(isProviderUsable: (name: string) => boolean): Promise<number> {
    const discovered: CatalogModel[] = [];
    if (isProviderUsable('gemini') || isProviderUsable('google')) {
      const key = String(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '').trim();
      if (key) {
        try {
          const url = `https://generativelanguage.googleapis.com/v1beta/models...key=${encodeURIComponent(key)}`;
          const res = await safeFetch(url, {}, { serviceName: 'LLM role model catalog' });
          if (res.ok) {
            const data = (await res.json()) as {
              models?: Array<{ name?: string; supportedGenerationMethods?: string[] }>;
            };
            for (const model of data.models || []) {
              const methods = model.supportedGenerationMethods || [];
              if (!methods.includes('generateContent')) continue;
              const rawId = String(model.name || '').trim();
              const id = rawId.startsWith('models/') ? rawId.slice('models/'.length).trim() : rawId;
              if (!id) continue;
              const tier: CatalogModel['tier'] = modelHasAnyToken(id, ['pro', 'ultra', 'exp']) ? 'strong'
                : modelHasAnyToken(id, ['flash', 'lite', 'mini']) ? 'fast'
                  : 'balanced';
              discovered.push({
                provider: 'gemini',
                model: id,
                family: 'gemini',
                tier,
                aliases: [id.toLowerCase()],
              });
            }
          }
        } catch {
          // keep static catalog
        }
      }
    }

    if (isProviderUsable('openai')) {
      const key = String(process.env.OPENAI_API_KEY || '').trim();
      if (key) {
        try {
          const res = await safeFetch(
            'https://api.openai.com/v1/models',
            {
              headers: { Authorization: `Bearer ${key}` },
            },
            { serviceName: 'LLM role OpenAI model catalog' },
          );
          if (res.ok) {
            const data = (await res.json()) as { data?: Array<{ id?: string }> };
            for (const model of data.data || []) {
              const id = String(model.id || '').trim();
              if (!id.startsWith('gpt-')) continue;
              const tier: CatalogModel['tier'] = modelHasAnyToken(id, ['mini', 'nano']) ? 'fast'
                : modelHasAnyToken(id, ['4o', '4.1', 'o1', 'o3']) ? 'strong'
                  : 'balanced';
              discovered.push({
                provider: 'openai',
                model: id,
                family: 'gpt',
                tier,
                aliases: [id.toLowerCase()],
              });
            }
          }
        } catch {
          // keep static catalog
        }
      }
    }

    if (isProviderUsable('anthropic')) {
      const key = String(process.env.ANTHROPIC_API_KEY || '').trim();
      if (key) {
        try {
          const res = await safeFetch(
            'https://api.anthropic.com/v1/models',
            {
              headers: {
                'x-api-key': key,
                'anthropic-version': '2023-06-01',
              },
            },
            { serviceName: 'LLM role Anthropic model catalog' },
          );
          if (res.ok) {
            const data = (await res.json()) as { data?: Array<{ id?: string }> };
            for (const model of data.data || []) {
              const id = String(model.id || '').trim();
              if (!id) continue;
              const tier: CatalogModel['tier'] = modelHasAnyToken(id, ['haiku', 'fast']) ? 'fast'
                : modelHasAnyToken(id, ['opus', 'sonnet']) ? 'strong'
                  : 'balanced';
              discovered.push({
                provider: 'anthropic',
                model: id,
                family: 'claude',
                tier,
                aliases: [id.toLowerCase()],
              });
            }
          }
        } catch {
          // keep static catalog
        }
      }
    }

    if (isProviderUsable('xai')) {
      const key = String(process.env.XAI_API_KEY || process.env.GROK_API_KEY || '').trim();
      if (key) {
        try {
          const res = await safeFetch(
            'https://api.x.ai/v1/models',
            {
              headers: { Authorization: `Bearer ${key}` },
            },
            { serviceName: 'LLM role xAI model catalog' },
          );
          if (res.ok) {
            const data = (await res.json()) as { data?: Array<{ id?: string }> };
            for (const model of data.data || []) {
              const id = String(model.id || '').trim();
              if (!id) continue;
              const tier: CatalogModel['tier'] = modelHasAnyToken(id, ['mini', 'fast']) ? 'fast'
                : modelHasAnyToken(id, ['grok', 'reason']) ? 'strong'
                  : 'balanced';
              discovered.push({
                provider: 'xai',
                model: id,
                family: 'xai',
                tier,
                aliases: [id.toLowerCase()],
              });
            }
          }
        } catch {
          // keep static catalog
        }
      }
    }

    if (isProviderUsable('deepseek')) {
      const key = String(process.env.DEEPSEEK_API_KEY || '').trim();
      if (key) {
        try {
          const res = await safeFetch(
            'https://api.deepseek.com/models',
            {
              headers: { Authorization: `Bearer ${key}` },
            },
            { serviceName: 'LLM role DeepSeek model catalog' },
          );
          if (res.ok) {
            const data = (await res.json()) as { data?: Array<{ id?: string }> };
            for (const model of data.data || []) {
              const id = String(model.id || '').trim();
              if (!id) continue;
              const tier: CatalogModel['tier'] = modelHasAnyToken(id, ['reasoner', 'r1']) ? 'strong'
                : modelHasAnyToken(id, ['chat', 'coder']) ? 'balanced'
                  : 'fast';
              discovered.push({
                provider: 'deepseek',
                model: id,
                family: 'deepseek',
                tier,
                aliases: [id.toLowerCase()],
              });
            }
          }
        } catch {
          // keep static catalog
        }
      }
    }

    this.liveExtras = discovered;
    return discovered.length;
  }

  public detectFamily(text: string): string | null {
    const t = this.norm(text);
    if (!t) return null;
    const tokens = splitModelText(t);
    if (hasAnyToken(tokens, ['gemini', 'gemma', 'google'])) return 'gemini';
    if (hasAnyToken(tokens, ['gpt', 'openai', 'chatgpt'])) return 'gpt';
    if (hasAnyToken(tokens, ['claude', 'anthropic'])) return 'claude';
    if (hasAnyToken(tokens, ['deepseek'])) return 'deepseek';
    if (hasAnyToken(tokens, ['grok', 'xai'])) return 'xai';
    if (hasAnyToken(tokens, ['openrouter'])) return 'openrouter';
    return null;
  }

  public resolveBinding(
    providerHint: string | null | undefined,
    modelHint: string | null | undefined,
    isProviderUsable: (name: string) => boolean,
    preferredTier: 'fast' | 'balanced' | 'strong' = 'balanced',
  ): {
    binding: { provider: string; model: string } | null;
    nearest: { provider: string; model: string } | null;
    exact: boolean;
  } {
    const usable = this.listUsableModels(isProviderUsable);
    if (usable.length === 0) {
      return { binding: null, nearest: null, exact: false };
    }

    const provider = ProviderFactory.normalizeProviderName(String(providerHint || '').trim());
    const modelRaw = String(modelHint || '').trim();
    const modelNorm = this.norm(modelRaw);
    const family = this.detectFamily(`${provider} ${modelRaw}`) || this.familyFromProvider(provider);

    if (modelNorm) {
      const inScope = (entry: CatalogModel) => {
        if (provider && entry.provider !== provider && entry.family !== family) return false;
        return true;
      };
      const exact = usable.find((entry) => {
        if (!inScope(entry)) return false;
        const entryNorm = this.norm(entry.model);
        return (
          entry.model.toLowerCase() === modelRaw.toLowerCase() ||
          entry.aliases.some((alias) => {
            const a = this.norm(alias);
            return a === modelNorm || (modelNorm.length >= 4 && (a.includes(modelNorm) || modelNorm.includes(a)));
          }) ||
          entryNorm === modelNorm ||
          (modelNorm.length >= 6 && entryNorm.includes(modelNorm))
        );
      });
      if (exact) {
        return {
          binding: { provider: exact.provider, model: exact.model },
          nearest: null,
          exact: true,
        };
      }

      const modelTokens = splitModelText(modelNorm);
      const shortTier = modelTokens.size <= 2;
      if (shortTier && hasAnyToken(modelTokens, ['flash', 'mini', 'haiku', 'fast', 'lite'])) {
        const pool = usable.filter(inScope);
        const pick = this.pickByTier(pool.length ? pool : usable, 'fast');
        if (pick) {
          return {
            binding: { provider: pick.provider, model: pick.model },
            nearest: null,
            exact: true,
          };
        }
      }
      if (shortTier && hasAnyToken(modelTokens, ['pro', 'sonnet', 'reasoner', 'opus', 'max'])) {
        const pool = usable.filter(inScope);
        const pick = this.pickByTier(pool.length ? pool : usable, 'strong');
        if (pick) {
          return {
            binding: { provider: pick.provider, model: pick.model },
            nearest: null,
            exact: true,
          };
        }
      }

      const nearest = this.nearestModel(usable, provider, family, modelNorm, preferredTier);
      return {
        binding: null,
        nearest: nearest ? { provider: nearest.provider, model: nearest.model } : null,
        exact: false,
      };
    }

    if (provider || family) {
      const pool = usable.filter((entry) => {
        if (provider && entry.provider === provider) return true;
        if (family && entry.family === family) return true;
        return false;
      });
      const pick = this.pickByTier(pool.length ? pool : usable, preferredTier);
      if (!pick) return { binding: null, nearest: null, exact: false };
      return {
        binding: { provider: pick.provider, model: pick.model },
        nearest: null,
        exact: Boolean(provider || family),
      };
    }

    const pick = this.pickByTier(usable, preferredTier);
    return pick
      ? { binding: { provider: pick.provider, model: pick.model }, nearest: null, exact: false }
      : { binding: null, nearest: null, exact: false };
  }

  public proposeDualRoles(isProviderUsable: (name: string) => boolean): {
    default: { provider: string; model: string } | null;
    strong: { provider: string; model: string } | null;
  } {
    const usable = this.listUsableModels(isProviderUsable);
    if (usable.length === 0) {
      return { default: null, strong: null };
    }

    const byFamily = new Map<string, CatalogModel[]>();
    for (const entry of usable) {
      const list = byFamily.get(entry.family) || [];
      list.push(entry);
      byFamily.set(entry.family, list);
    }

    for (const [, models] of byFamily) {
      if (models.length >= 2) {
        const fast = this.pickByTier(models, 'fast');
        const strong = this.pickByTier(models, 'strong') || this.pickByTier(models, 'balanced');
        if (fast && strong) {
          return {
            default: { provider: fast.provider, model: fast.model },
            strong: { provider: strong.provider, model: strong.model },
          };
        }
      }
    }

    const providers = Array.from(new Set(usable.map((entry) => entry.provider)));
    if (providers.length >= 2) {
      const a =
        this.pickByTier(
          usable.filter((e) => e.provider === providers[0]),
          'fast',
        ) || usable.find((e) => e.provider === providers[0])!;
      const b =
        this.pickByTier(
          usable.filter((e) => e.provider === providers[1]),
          'strong',
        ) || usable.find((e) => e.provider === providers[1])!;
      return {
        default: { provider: a.provider, model: a.model },
        strong: { provider: b.provider, model: b.model },
      };
    }

    const only = this.pickByTier(usable, 'balanced') || usable[0];
    return {
      default: { provider: only.provider, model: only.model },
      strong: { provider: only.provider, model: only.model },
    };
  }

  private configBackedModels(): CatalogModel[] {
    const rows: Array<[string, string, string, CatalogModel['tier']]> = [
      ['gemini', config.geminiModel, 'gemini', 'fast'],
      ['gemini', config.graphResearchDeepModel || config.geminiModel, 'gemini', 'strong'],
      ['openai', config.openaiModel, 'gpt', 'strong'],
      ['deepseek', config.deepseekModel, 'deepseek', 'balanced'],
      ['openrouter', config.openRouterModel, 'openrouter', 'balanced'],
      ['xai', config.xaiModel, 'xai', 'strong'],
      ['aigateway', config.AIGatewayModel, 'aigateway', 'balanced'],
    ];
    return rows
      .filter(([, model]) => String(model || '').trim())
      .map(([provider, model, family, tier]) => ({
        provider,
        model: String(model).trim(),
        family,
        tier,
        aliases: [String(model).trim().toLowerCase()],
      }));
  }

  private pickByTier(pool: CatalogModel[], tier: CatalogModel['tier']): CatalogModel | null {
    if (!pool.length) return null;
    const exact = pool.find((entry) => entry.tier === tier);
    if (exact) return exact;
    if (tier === 'strong') {
      return pool.find((entry) => entry.tier === 'balanced') || pool[pool.length - 1];
    }
    if (tier === 'fast') {
      return pool.find((entry) => entry.tier === 'balanced') || pool[0];
    }
    return pool[0];
  }

  private nearestModel(
    usable: CatalogModel[],
    provider: string,
    family: string | null,
    modelNorm: string,
    preferredTier: CatalogModel['tier'],
  ): CatalogModel | null {
    const pool = usable.filter((entry) => {
      if (provider && entry.provider === provider) return true;
      if (family && entry.family === family) return true;
      return !provider && !family;
    });
    const ranked = (pool.length ? pool : usable)
      .map((entry) => ({
        entry,
        score:
          this.similarity(modelNorm, this.norm(entry.model)) +
          Math.max(...entry.aliases.map((alias) => this.similarity(modelNorm, this.norm(alias)))),
      }))
      .sort((a, b) => b.score - a.score);
    if (ranked[0] && ranked[0].score >= 0.35) {
      return ranked[0].entry;
    }
    return this.pickByTier(pool.length ? pool : usable, preferredTier);
  }

  private similarity(a: string, b: string): number {
    if (!a || !b) return 0;
    if (a === b) return 1;
    if (a.includes(b) || b.includes(a)) return 0.8;
    const as = splitModelText(a);
    const bs = splitModelText(b);
    let inter = 0;
    for (const token of as) {
      if (bs.has(token)) inter += 1;
    }
    return inter / Math.max(as.size, bs.size, 1);
  }

  private familyFromProvider(provider: string): string | null {
    const p = String(provider || '').toLowerCase();
    if (!p) return null;
    if (p === 'openai') return 'gpt';
    if (p === 'anthropic') return 'claude';
    if (p === 'gemini') return 'gemini';
    return p;
  }

  private norm(value: string): string {
    return String(value || '')
      .toLowerCase()
      .normalize('NFD')
      .replaceAll('\u0300', '')
      .replaceAll('\u0301', '')
      .replaceAll('\u0302', '')
      .replaceAll('\u0303', '')
      .replaceAll('\u0308', '')
      .split('')
      .map((char) => isModelTextChar(char) ? char : ' ')
      .join('')
      .trim();
  }
}

function modelHasAnyToken(value: string, candidates: string[]): boolean {
  return hasAnyToken(splitModelText(value), candidates);
}

function splitModelText(value: string): Set<string> {
  const tokens = new Set<string>();
  let current = '';
  for (const char of String(value || '').toLowerCase()) {
    if (isModelTextChar(char)) {
      current += char;
      continue;
    }
    if (current) {
      tokens.add(current);
      current = '';
    }
  }
  if (current) {
    tokens.add(current);
  }
  return tokens;
}

function hasAnyToken(tokens: Set<string>, candidates: string[]): boolean {
  for (const candidate of candidates) {
    if (tokens.has(candidate)) {
      return true;
    }
  }
  return false;
}

function isModelTextChar(char: string): boolean {
  return (char >= 'a' && char <= 'z') || (char >= '0' && char <= '9') || char === '.';
}
