import { describe, expect, it } from 'vitest';
import { ProviderIntegrationRegistry } from '../../../../src/services/providers/catalog/ProviderIntegrationRegistry.js';

const EXPECTED_CONSISTENCY_PROVIDER_IDS = [
  'ai-gateway',
  'alibaba',
  'alibaba-coding-plan',
  'amazon-bedrock',
  'amazon-bedrock-mantle',
  'anthropic',
  'anthropic-vertex',
  'arcee',
  'azure-foundry',
  'bedrock',
  'bedrock-mantle',
  'claude-max-api-proxy',
  'codex',
  'copilot',
  'copilot-acp',
  'custom',
  'deepseek',
  'ds4',
  'gemini',
  'google-gemini-cli',
  'gmi',
  'huggingface',
  'inferrs',
  'kilocode',
  'kimi-coding',
  'kimi-coding-cn',
  'minimax',
  'minimax-cn',
  'minimax-oauth',
  'nous',
  'nvidia',
  'ollama-cloud',
  'openai-codex',
  'opencode-zen',
  'opencode-go',
  'openrouter',
  'perplexity-provider',
  'qwen-oauth',
  'stepfun',
  'synthetic',
  'xai',
  'xiaomi',
  'zai',
];

describe('Zavorth Provider Consistency Pack', () => {
  it('keeps every consistency provider visible in the Zavorth provider registry', () => {
    const registry = new ProviderIntegrationRegistry();
    const missing = EXPECTED_CONSISTENCY_PROVIDER_IDS.filter((providerId) => !registry.resolveRoute(providerId));

    expect(missing).toEqual([]);
    expect(registry.buildSnapshot().routeCount).toBeGreaterThanOrEqual(80);
  });

  it('keeps consistency providers catalog-only until credentials and live proof exist', () => {
    const registry = new ProviderIntegrationRegistry();
    const oauthRoute = registry.resolveRoute('copilot-acp')?.route;
    const compatibleRoute = registry.resolveRoute('opencode-zen')?.route;

    expect(oauthRoute).toMatchObject({
      routeId: 'copilot-acp',
      authKind: 'oauth',
      mode: 'hybrid',
    });
    expect(oauthRoute?.limitations).toEqual(expect.arrayContaining([
      'Not enabled for default routing until readiness and live proof pass.',
    ]));
    expect(compatibleRoute).toMatchObject({
      routeId: 'opencode-zen',
      authKind: 'api_key',
      mode: 'cloud',
    });
  });
});
