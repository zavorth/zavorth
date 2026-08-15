/**
 * Optional live provider checks — skip unless ZAVORTH_LIVE_PROVIDER_TESTS=1
 * and the relevant API key is present. Never logs secret values.
 */

import fs from 'node:fs';
import path from 'node:path';


const LIVE = process.env.ZAVORTH_LIVE_PROVIDER_TESTS === '1';
const ROOT = path.resolve(__dirname, '../..');

type MockCtx = {
  getLogger: () => { info: () => void; warn: () => void; error: () => void };
  requestPermission: (kind: string) => Promise<boolean>;
  bindCapability: (id: string, handler: (args: { input?: unknown }) => Promise<unknown>) => void;
  bindProvider: (spec: {
    id: string;
    complete: (input: Record<string, unknown>) => Promise<Record<string, unknown>>;
  }) => void;
};

function createMockCtx(allowNetwork: boolean): {
  ctx: MockCtx;
  providers: Array<{ id: string; complete: (input: Record<string, unknown>) => Promise<Record<string, unknown>> }>;
  capabilities: Map<string, (args: { input?: unknown }) => Promise<unknown>>;
} {
  const providers: Array<{
    id: string;
    complete: (input: Record<string, unknown>) => Promise<Record<string, unknown>>;
  }> = [];
  const capabilities = new Map<string, (args: { input?: unknown }) => Promise<unknown>>();
  const noop = () => undefined;
  const ctx: MockCtx = {
    getLogger: () => ({ info: noop, warn: noop, error: noop }),
    requestPermission: async () => allowNetwork,
    bindCapability: (id, handler) => {
      capabilities.set(id, handler);
    },
    bindProvider: (spec) => {
      providers.push(spec);
    },
  };
  return { ctx, providers, capabilities };
}

const CASES: Array<{ id: string; envKeys: string[] }> = [
  { id: 'provider-openai', envKeys: ['OPENAI_API_KEY'] },
  { id: 'provider-xai', envKeys: ['XAI_API_KEY', 'GROK_API_KEY'] },
  { id: 'provider-groq', envKeys: ['GROQ_API_KEY'] },
  { id: 'provider-deepseek', envKeys: ['DEEPSEEK_API_KEY'] },
  { id: 'provider-openrouter', envKeys: ['OPENROUTER_API_KEY'] },
  { id: 'provider-gemini', envKeys: ['GEMINI_API_KEY', 'GOOGLE_API_KEY'] },
  { id: 'provider-anthropic', envKeys: ['ANTHROPIC_API_KEY'] },
  { id: 'provider-mistral', envKeys: ['MISTRAL_API_KEY'] },
  { id: 'provider-together', envKeys: ['TOGETHER_API_KEY'] },
  { id: 'provider-cerebras', envKeys: ['CEREBRAS_API_KEY'] },
];

function keyPresent(envKeys: string[]): boolean {
  return envKeys.some((k) => Boolean(String(process.env[k] || '').trim()));
}

describe('provider plugins live (optional)', () => {
  if (!LIVE) {
    it('skips when ZAVORTH_LIVE_PROVIDER_TESTS is not 1', () => {
      expect(LIVE).toBe(false);
    });
    return;
  }

  for (const item of CASES) {
    const hasKey = keyPresent(item.envKeys);
    const run = hasKey ? it : it.skip;

    run(
      `${item.id} completes a tiny prompt when key present`,
      async () => {
        const pluginPath = path.join(ROOT, 'plugins', item.id, 'index.js');
        expect(fs.existsSync(pluginPath)).toBe(true);
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const mod = require(pluginPath) as { register: (ctx: MockCtx) => void };
        const { ctx, providers } = createMockCtx(true);
        mod.register(ctx);
        expect(providers.length).toBeGreaterThanOrEqual(1);
        const result = await providers[0].complete({
          prompt: 'Reply with exactly: ok',
          maxTokens: 16,
        });
        expect(result).toBeTruthy();
        expect(typeof result.ok === 'boolean' || result.text || result.message).toBeTruthy();
        // Never leak raw key material in response
        const blob = JSON.stringify(result);
        for (const envKey of item.envKeys) {
          const secret = String(process.env[envKey] || '').trim();
          if (secret.length >= 8) {
            expect(blob).not.toContain(secret);
          }
        }
      },
      60000,
    );
  }
});
