import {
  CLAUDE_OPUS_4_PRICING,
  CLAUDE_OPUS_46_PRICING,
  CLAUDE_SONNET_4_PRICING,
  CLAUDE_SONNET_46_PRICING,
} from '../pricingPresets';

export const API_KEY_PROVIDER_PRICING = {
  openai: {
    "gpt-4o": {
      input: 2.5,
      output: 10.0,
      cached: 1.25,
      reasoning: 15.0,
      cache_creation: 2.5,
    },
    "gpt-4o-mini": {
      input: 0.15,
      output: 0.6,
      cached: 0.075,
      reasoning: 0.9,
      cache_creation: 0.15,
    },
    "gpt-4-turbo": {
      input: 10.0,
      output: 30.0,
      cached: 5.0,
      reasoning: 45.0,
      cache_creation: 10.0,
    },
    o1: {
      input: 15.0,
      output: 60.0,
      cached: 7.5,
      reasoning: 90.0,
      cache_creation: 15.0,
    },
    "o1-mini": {
      input: 3.0,
      output: 12.0,
      cached: 1.5,
      reasoning: 18.0,
      cache_creation: 3.0,
    },
  },

  // Anthropic
  anthropic: {
    "claude-sonnet-4-20250514": {
      input: 3.0,
      output: 15.0,
      cached: 1.5,
      reasoning: 15.0,
      cache_creation: 3.0,
    },
    "claude-opus-4-20250514": {
      input: 15.0,
      output: 75.0,
      cached: 7.5,
      reasoning: 112.5,
      cache_creation: 15.0,
    },
    "claude-3-5-sonnet-20241022": {
      input: 3.0,
      output: 15.0,
      cached: 1.5,
      reasoning: 15.0,
      cache_creation: 3.0,
    },
    // Claude 4.5 Haiku â€” modelo eco mais recente da Anthropic (2025-10)
    "claude-haiku-4-5-20251001": {
      input: 1.0,
      output: 5.0,
      cached: 0.5,
      reasoning: 7.5,
      cache_creation: 1.0,
    },
    "claude-haiku-4.5": {
      input: 1.0,
      output: 5.0,
      cached: 0.5,
      reasoning: 7.5,
      cache_creation: 1.0,
    },
    // Claude Sonnet 4.6 â€” maxOutput 64k tokens, $3/$15/M
    "claude-sonnet-4-6-20251031": {
      input: 3.0,
      output: 15.0,
      cached: 1.5,
      reasoning: 22.5,
      cache_creation: 3.0,
    },
    "claude-sonnet-4.6": {
      input: 3.0,
      output: 15.0,
      cached: 1.5,
      reasoning: 22.5,
      cache_creation: 3.0,
    },
    // Claude Opus 4.6 â€” mais barato que Opus 4 ($5/$25 vs $15/$75)
    "claude-opus-4-6-20251031": {
      input: 5.0,
      output: 25.0,
      cached: 2.5,
      reasoning: 37.5,
      cache_creation: 5.0,
    },
    "claude-opus-4.6": {
      input: 5.0,
      output: 25.0,
      cached: 2.5,
      reasoning: 37.5,
      cache_creation: 5.0,
    },
    // Common model IDs (without dates) used across providers
    // Intentional duplicates of dot-notation variants (e.g. claude-opus-4.6)
    // to cover hyphen-notation IDs (claude-opus-4-6) used by some clients
    "claude-opus-4-6": CLAUDE_OPUS_46_PRICING,
    "claude-sonnet-4-6": CLAUDE_SONNET_46_PRICING,
    "claude-opus-4-5-20251101": CLAUDE_OPUS_4_PRICING,
    "claude-sonnet-4-5-20250929": CLAUDE_SONNET_4_PRICING,
    "claude-sonnet-4": CLAUDE_SONNET_4_PRICING,
    "claude-opus-4": CLAUDE_OPUS_4_PRICING,
  },

  // Gemini
  gemini: {
    // Gemini 3.1 Pro â€” novo flagship Google (2026-03-17)
    // Context: 1.050.000 tokens | Max Output: 65.536
    "gemini-3.1-pro": {
      input: 2.0,
      output: 12.0,
      cached: 0.25,
      reasoning: 18.0,
      cache_creation: 2.0,
    },
    "gemini-3-1-pro": {
      input: 2.0,
      output: 12.0,
      cached: 0.25,
      reasoning: 18.0,
      cache_creation: 2.0,
    },
    "gemini-3-pro-preview": {
      input: 2.0,
      output: 12.0,
      cached: 0.25,
      reasoning: 18.0,
      cache_creation: 2.0,
    },
    "gemini-3.1-pro-preview": {
      input: 2.0,
      output: 12.0,
      cached: 0.25,
      reasoning: 18.0,
      cache_creation: 2.0,
    },
    "gemini-2.5-pro": {
      input: 2.0,
      output: 12.0,
      cached: 0.25,
      reasoning: 18.0,
      cache_creation: 2.0,
    },
    "gemini-2.5-flash": {
      input: 0.3,
      output: 2.5,
      cached: 0.03,
      reasoning: 3.75,
      cache_creation: 0.3,
    },
    // Gemini 2.5 Flash Lite â€” preco corrigido: $0.10/$0.40 (ClawRouter)
    "gemini-2.5-flash-lite": {
      input: 0.1,
      output: 0.4,
      cached: 0.025,
      reasoning: 0.6,
      cache_creation: 0.1,
    },
  },

  // DeepSeek â€” API nativa (V3.2 Chat), separada de free providers
  // Preco: $0.28/$0.42/M tokens (verificado via ClawRouter 2026-03-17)
  deepseek: {
    "deepseek-chat": {
      input: 0.28,
      output: 0.42,
      cached: 0.014,
      reasoning: 0.42,
      cache_creation: 0.28,
    },
    "deepseek-v3": {
      input: 0.28,
      output: 0.42,
      cached: 0.014,
      reasoning: 0.42,
      cache_creation: 0.28,
    },
    "deepseek-v3.2": {
      input: 0.28,
      output: 0.42,
      cached: 0.014,
      reasoning: 0.42,
      cache_creation: 0.28,
    },
    "deepseek-reasoner": {
      input: 0.55,
      output: 2.19,
      cached: 0.14,
      reasoning: 2.19,
      cache_creation: 0.55,
    },
    "deepseek-r1": {
      input: 0.55,
      output: 2.19,
      cached: 0.14,
      reasoning: 2.19,
      cache_creation: 0.55,
    },
  },

  // OpenRouter
  openrouter: {
    auto: {
      input: 2.0,
      output: 8.0,
      cached: 1.0,
      reasoning: 12.0,
      cache_creation: 2.0,
    },
  },

  // GLM
  glm: {
    "glm-5.1": {
      input: 1.2,
      output: 5,
      cached: 0.3,
      reasoning: 5,
      cache_creation: 1.2,
    },
    "glm-5": {
      input: 1.0,
      output: 3.2,
      cached: 0.2,
      reasoning: 4.8,
      cache_creation: 1.0,
    },
    "glm-5-turbo": {
      input: 1.2,
      output: 4.0,
      cached: 0.24,
      reasoning: 4.0,
      cache_creation: 1.2,
    },
    "glm-4.7-flash": {
      input: 0,
      output: 0,
      cached: 0,
      reasoning: 0,
      cache_creation: 0,
    },
    "glm-4.7": {
      input: 0.6,
      output: 2.2,
      cached: 0.11,
      reasoning: 2.2,
      cache_creation: 0.6,
    },
    "glm-4.6": {
      input: 0.6,
      output: 2.2,
      cached: 0.11,
      reasoning: 2.2,
      cache_creation: 0.6,
    },
    "glm-4.6v": {
      input: 0.3,
      output: 0.9,
      cached: 0.05,
      reasoning: 0.9,
      cache_creation: 0.3,
    },
    "glm-4.5v": {
      input: 0.6,
      output: 1.8,
      cached: 0.11,
      reasoning: 1.8,
      cache_creation: 0.6,
    },
    "glm-4.5": {
      input: 0.6,
      output: 2.2,
      cached: 0.11,
      reasoning: 2.2,
      cache_creation: 0.6,
    },
    "glm-4.5-air": {
      input: 0.2,
      output: 1.1,
      cached: 0.03,
      reasoning: 1.1,
      cache_creation: 0.2,
    },
  },

  // Kimi (Moonshot)
  kimi: {
    "kimi-latest": {
      input: 1.0,
      output: 4.0,
      cached: 0.5,
      reasoning: 6.0,
      cache_creation: 1.0,
    },
    // Kimi K2.5 â€” acesso direto via Moonshot API
    // Context: 262.144 tokens | Capabilities: reasoning, vision, agentic, tools
    "kimi-k2.5": {
      input: 0.6,
      output: 3.0,
      cached: 0.3,
      reasoning: 4.5,
      cache_creation: 0.6,
    },
    "kimi-k2.5-thinking": {
      input: 0.6,
      output: 3.0,
      cached: 0.3,
      reasoning: 4.5,
      cache_creation: 0.6,
    },
    "kimi-for-coding": {
      input: 0.6,
      output: 3.0,
      cached: 0.3,
      reasoning: 4.5,
      cache_creation: 0.6,
    },
    "moonshot-kimi-k2.5": {
      input: 0.6,
      output: 3.0,
      cached: 0.3,
      reasoning: 4.5,
      cache_creation: 0.6,
    },
  },

  // Kimi Coding aliases (OAuth/API key)
  kmc: {
    "kimi-k2.5": { input: 0.6, output: 3.0, cached: 0.3, reasoning: 4.5, cache_creation: 0.6 },
    "kimi-k2.5-thinking": {
      input: 0.6,
      output: 3.0,
      cached: 0.3,
      reasoning: 4.5,
      cache_creation: 0.6,
    },
    "kimi-latest": { input: 1.0, output: 4.0, cached: 0.5, reasoning: 6.0, cache_creation: 1.0 },
  },
  kmca: {
    "kimi-k2.5": { input: 0.6, output: 3.0, cached: 0.3, reasoning: 4.5, cache_creation: 0.6 },
    "kimi-k2.5-thinking": {
      input: 0.6,
      output: 3.0,
      cached: 0.3,
      reasoning: 4.5,
      cache_creation: 0.6,
    },
    "kimi-latest": { input: 1.0, output: 4.0, cached: 0.5, reasoning: 6.0, cache_creation: 1.0 },
  },

  // MiniMax
  minimax: {
    "minimax-m2.1": {
      input: 0.5,
      output: 2.0,
      cached: 0.25,
      reasoning: 3.0,
      cache_creation: 0.5,
    },
    "MiniMax-M2.1": {
      input: 0.5,
      output: 2.0,
      cached: 0.25,
      reasoning: 3.0,
      cache_creation: 0.5,
    },
    // MiniMax M2.5 â€” mais barato que M2.1, reasoning + tools
    // Context: 204.800 tokens | Max Output: 16.384 tokens
    "minimax-m2.5": {
      input: 0.27,
      output: 0.95,
      cached: 0.135,
      reasoning: 1.425,
      cache_creation: 0.27,
    },
    "MiniMax-M2.5": {
      input: 0.27,
      output: 0.95,
      cached: 0.135,
      reasoning: 1.425,
      cache_creation: 0.27,
    },
    // T12: MiniMax M2.7 â€” new default model (sub2api PR #1120)
    // Upgraded from M2.5, same API endpoint api.minimax.io
    // Pricing estimated, check https://platform.minimaxi.com/document/Price
    "minimax-m2.7": {
      input: 0.4,
      output: 1.6,
      cached: 0.2,
      reasoning: 2.4,
      cache_creation: 0.4,
    },
    "MiniMax-M2.7": {
      input: 0.4,
      output: 1.6,
      cached: 0.2,
      reasoning: 2.4,
      cache_creation: 0.4,
    },
    "minimax-m2.7-highspeed": {
      input: 0.4,
      output: 1.6,
      cached: 0.2,
      reasoning: 2.4,
      cache_creation: 0.4,
    },
  },

  // â”€â”€â”€ Free-tier API Key Providers (nominal $0 pricing) â”€â”€â”€
} as const;
