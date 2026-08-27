
import fs from 'fs';
import os from 'os';
import path from 'path';
import { config } from '../../src/config/index';
import { ConfigureLlmProfileTool } from '../../src/tools/ConfigureLlmProfileTool';
import { ProviderFactory } from '../../src/providers/ProviderFactory';

describe('ConfigureLlmProfileTool', () => {
  const originalProvider = config.llmProvider;
  const originalOpenCodeModel = config.openCodeModel;
  const originalOpenCodeApiKey = config.openCodeApiKey;
  const originalDeepseekModel = config.deepseekModel;
  const originalDeepseekApiKey = config.deepseekApiKey;
  let tempDir: string;
  let envFilePath: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-llm-profile-'));
    envFilePath = path.join(tempDir, '.env');
  });

  afterEach(() => {
    (config as Record<string, unknown>).llmProvider = originalProvider;
    (config as Record<string, unknown>).openCodeModel = originalOpenCodeModel;
    (config as Record<string, unknown>).openCodeApiKey = originalOpenCodeApiKey;
    (config as Record<string, unknown>).deepseekModel = originalDeepseekModel;
    (config as Record<string, unknown>).deepseekApiKey = originalDeepseekApiKey;
    ProviderFactory.unregisterCustomProvider('acme-ai');
    ProviderFactory.unregisterCustomProvider('corp-gateway');
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('lists known providers as JSON', async () => {
    const tool = new ConfigureLlmProfileTool({ envFilePath });

    const result = JSON.parse(await tool.execute({ action: 'list' }));

    expect(result.status).toBe('success');
    expect(result.available_providers.opencode).toBeDefined();
    expect(result.available_providers.aigateway).toBeDefined();
  });

  it('persists a valid provider selection to the configured env file', async () => {
    (config as Record<string, unknown>).deepseekApiKey = 'test-deepseek-key';
    const clearProviderCache = jest.fn();
    const tool = new ConfigureLlmProfileTool({ envFilePath, clearProviderCache });

    const result = JSON.parse(await tool.execute({
      action: 'set',
      providerName: 'deepseek',
      modelName: 'deepseek-chat',
    }));

    expect(result.status).toBe('success');
    expect(result.envFilePath).toBe(envFilePath);
    expect(fs.readFileSync(envFilePath, 'utf8')).toContain('LLM_PROVIDER=deepseek');
    expect(fs.readFileSync(envFilePath, 'utf8')).toContain('DEEPSEEK_MODEL=deepseek-chat');
    expect(config.llmProvider).toBe('deepseek');
    expect(config.deepseekModel).toBe('deepseek-chat');
    expect(clearProviderCache).toHaveBeenCalled();
  });

  it('rejects unknown providers before writing env state', async () => {
    const tool = new ConfigureLlmProfileTool({ envFilePath });

    await expect(tool.execute({
      action: 'set',
      providerName: 'unknown-provider',
      modelName: 'whatever',
    })).rejects.toThrow(/unrecognized|nao reconhecido|unknown/i);

    expect(fs.existsSync(envFilePath)).toBe(false);
  });

  it('rejects unavailable providers unless explicitly allowed', async () => {
    (config as Record<string, unknown>).deepseekApiKey = '';
    const tool = new ConfigureLlmProfileTool({ envFilePath });

    await expect(tool.execute({
      action: 'set',
      providerName: 'deepseek',
      modelName: 'deepseek-chat',
    })).rejects.toThrow(/deepseek: not connected; missing DEEPSEEK_API_KEY/i);

    expect(fs.existsSync(envFilePath)).toBe(false);
  });

  it('accepts Zavorth-native long-tail provider routes with a short prepared notice', async () => {
    const tool = new ConfigureLlmProfileTool({ envFilePath });

    const result = JSON.parse(await tool.execute({
      action: 'set',
      providerName: 'mistral',
      modelName: 'mistral-large-latest',
      allowUnavailable: true,
    }));

    expect(result.status).toBe('success');
    expect(result.provider).toBe('mistral');
    expect(typeof result.provider_ready).toBe('boolean');
    expect(typeof result.provider_notice).toBe('string');
    expect(result.provider_notice).toContain('mistral');
    expect(fs.readFileSync(envFilePath, 'utf8')).toContain('LLM_PROVIDER=mistral');
    expect(fs.readFileSync(envFilePath, 'utf8')).toContain('MISTRAL_MODEL=mistral-large-latest');
  });

  it('rejects compatibility aliases that are not registered providers', async () => {
    const tool = new ConfigureLlmProfileTool({ envFilePath });

    await expect(tool.execute({
      action: 'set',
      providerName: 'github-copilot',
      modelName: 'gpt-4o',
    })).rejects.toThrow(/Provider not registered: github-copilot/i);
  });

  it('onboards a custom compatible provider and persists env state', async () => {
    const clearProviderCache = jest.fn();
    const tool = new ConfigureLlmProfileTool({ envFilePath, clearProviderCache });
    process.env.ACME_API_KEY = 'test-acme-key';

    const result = JSON.parse(await tool.execute({
      action: 'onboard',
      providerName: 'acme-ai',
      label: 'Acme AI',
      baseUrl: 'https://acme.example.com/v1',
      apiKeyEnv: 'ACME_API_KEY',
      modelName: 'acme-1',
    }));

    delete process.env.ACME_API_KEY;

    expect(result.status).toBe('success');
    expect(result.provider).toBe('acme-ai');
    expect(result.label).toBe('Acme AI');
    expect(result.provider_ready).toBe(true);
    const envContent = fs.readFileSync(envFilePath, 'utf8');
    expect(envContent).toContain('LLM_PROVIDER=acme-ai');
    expect(envContent).toContain('ACME_AI_BASE_URL=https://acme.example.com/v1');
    expect(envContent).toContain('ACME_AI_MODEL=acme-1');
    expect(config.llmProvider).toBe('acme-ai');
    expect(clearProviderCache).toHaveBeenCalled();
    expect(ProviderFactory.listCustomProviders().some((p) => p.id === 'acme-ai')).toBe(true);
  });

  it('rejects onboarding without a base URL before writing env state', async () => {
    const tool = new ConfigureLlmProfileTool({ envFilePath });

    await expect(tool.execute({
      action: 'onboard',
      providerName: 'acme-ai',
    })).rejects.toThrow(/baseUrl/i);

    expect(fs.existsSync(envFilePath)).toBe(false);
  });

  it('resolves an onboarded provider at runtime through the factory', async () => {
    const tool = new ConfigureLlmProfileTool({ envFilePath });

    await tool.execute({
      action: 'onboard',
      providerName: 'corp-gateway',
      label: 'Corp Gateway',
      baseUrl: 'https://gw.corp.example/v1',
      apiKeyEnv: 'CORP_API_KEY',
      modelName: 'corp-1',
    });
    process.env.CORP_API_KEY = 'test-corp-key';

    const target = ProviderFactory.resolveRuntimeTarget('corp-gateway');
    expect(target.providerName).toBe('corp-gateway');
    expect(target.genericCompatible).toBe(true);
    expect(target.adapterKind).toBe('openai_compatible');
    expect(target.baseUrl).toBe('https://gw.corp.example/v1');
    expect(target.apiKey).toBe('test-corp-key');
    expect(ProviderFactory.normalizeProviderName('corp-gateway')).toBe('corp-gateway');

    delete process.env.CORP_API_KEY;
  });
});
