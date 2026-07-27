import { describe, expect, it } from '@jest/globals';
import { GatewayChannelAdapterRegistryService } from '../../src/services/GatewayChannelAdapterRegistryService.js';
import { ProviderIntegrationRegistry } from '../../src/services/providers/catalog/ProviderIntegrationRegistry.js';

const REFERENCE_CHANNEL_IDS = [
  'discord',
  'feishu',
  'googlechat',
  'line',
  'matrix',
  'msteams',
  'nextcloud-talk',
  'nostr',
  'weixin-compat',
  'qqbot',
  'slack',
  'synology-chat',
  'tlon',
  'twitch',
  'wecom',
  'whatsapp',
  'yuanbao',
  'zalo',
  'zalouser',
];

const REFERENCE_PROVIDER_IDS = [
  'amazon-bedrock',
  'amazon-bedrock-mantle',
  'anthropic-vertex',
  'codex',
];

const REFERENCE_PROVIDER_SLUGS = [
  'alibaba',
  'anthropic',
  'arcee',
  'azure-speech',
  'bedrock',
  'bedrock-mantle',
  'cerebras',
  'chutes',
  'claude-max-api-proxy',
  'cloudflare-ai-gateway',
  'comfy',
  'deepgram',
  'deepinfra',
  'deepseek',
  'ds4',
  'elevenlabs',
  'fal',
  'fireworks',
  'github-copilot',
  'google',
  'gradium',
  'groq',
  'huggingface',
  'inferrs',
  'inworld',
  'kilocode',
  'litellm',
  'lmstudio',
  'minimax',
  'mistral',
  'moonshot',
  'nvidia',
  'ollama',
  'openai',
  'opencode',
  'opencode-go',
  'openrouter',
  'perplexity-provider',
  'qianfan',
  'qwen',
  'runway',
  'senseaudio',
  'sglang',
  'stepfun',
  'synthetic',
  'tencent',
  'together',
  'venice',
  'vercel-ai-gateway',
  'vllm',
  'volcengine',
  'vydra',
  'xai',
  'xiaomi',
  'zai',
];

describe('Zavorth native coverage surface', () => {
  it('resolves every reference channel id through Zavorth-native channel adapters', () => {
    const registry = new GatewayChannelAdapterRegistryService({
      hasDispatcher: true,
      canSpawnWeb: true,
      includeLongTailActivationAdapters: true,
    });

    const missing = REFERENCE_CHANNEL_IDS.filter((channelId) => !registry.getAdapter(channelId));

    expect(missing).toEqual([]);
    expect(registry.getAdapter('lark')?.id).toBe('feishu');
    expect(registry.getAdapter('msteams')?.id).toBe('teams');
    expect(registry.getAdapter('weixin-compat')?.id).toBe('weixin');

    for (const channelId of REFERENCE_CHANNEL_IDS) {
      const adapter = registry.getAdapter(channelId);
      expect(adapter?.features.doctor).toBe(true);
      expect(adapter?.doctorCommand || adapter?.operatorNextStep || '').toBeTruthy();
      expect((adapter?.notes || []).join('\n').toLowerCase()).not.toContain('obrigatoriamente needs acoplar');
    }
  });

  it('resolves every reference provider id through the Zavorth provider registry', () => {
    const registry = new ProviderIntegrationRegistry();
    const missing = REFERENCE_PROVIDER_IDS.filter((providerId) => !registry.resolveRoute(providerId));

    expect(missing).toEqual([]);
    expect(registry.resolveRoute('codex')?.route).toMatchObject({
      routeId: 'codex',
      mode: 'hybrid',
      authKind: 'custom',
    });
  });

  it('resolves every reference provider documentation slug through Zavorth provider routes', () => {
    const registry = new ProviderIntegrationRegistry();
    const missing = REFERENCE_PROVIDER_SLUGS.filter((providerId) => !registry.resolveRoute(providerId));

    expect(missing).toEqual([]);
  });
});
