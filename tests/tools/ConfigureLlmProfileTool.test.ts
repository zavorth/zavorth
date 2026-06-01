import fs from 'fs';
import os from 'os';
import path from 'path';
import { config } from '../../src/config/index';
import { ConfigureLlmProfileTool } from '../../src/tools/ConfigureLlmProfileTool';

describe('ConfigureLlmProfileTool', () => {
  const originalProvider = config.llmProvider;
  const originalOpenCodeModel = config.openCodeModel;
  const originalOpenCodeApiKey = config.openCodeApiKey;
  let tempDir: string;
  let envFilePath: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-llm-profile-'));
    envFilePath = path.join(tempDir, '.env');
  });

  afterEach(() => {
    (config as any).llmProvider = originalProvider;
    (config as any).openCodeModel = originalOpenCodeModel;
    (config as any).openCodeApiKey = originalOpenCodeApiKey;
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('lists known providers as JSON', async () => {
    const tool = new ConfigureLlmProfileTool({ envFilePath });

    const result = JSON.parse(await tool.execute({ action: 'list' }));

    expect(result.status).toBe('success');
    expect(result.available_providers.opencode).toBeDefined();
    expect(result.available_providers.aigateway).toBeDefined();
  });

  it('persists a valid OpenCode selection to the configured env file', async () => {
    (config as any).openCodeApiKey = 'test-opencode-key';
    const clearProviderCache = jest.fn();
    const tool = new ConfigureLlmProfileTool({ envFilePath, clearProviderCache });

    const result = JSON.parse(await tool.execute({
      action: 'set',
      providerName: 'opencode',
      modelName: 'opencode/minimax-m2.5-free',
    }));

    expect(result.status).toBe('success');
    expect(result.envFilePath).toBe(envFilePath);
    expect(fs.readFileSync(envFilePath, 'utf8')).toContain('LLM_PROVIDER=opencode');
    expect(fs.readFileSync(envFilePath, 'utf8')).toContain('OPENCODE_MODEL=opencode/minimax-m2.5-free');
    expect(config.llmProvider).toBe('opencode');
    expect(config.openCodeModel).toBe('opencode/minimax-m2.5-free');
    expect(clearProviderCache).toHaveBeenCalled();
  });

  it('rejects unknown providers before writing env state', async () => {
    const tool = new ConfigureLlmProfileTool({ envFilePath });

    await expect(tool.execute({
      action: 'set',
      providerName: 'unknown-provider',
      modelName: 'whatever',
    })).rejects.toThrow(/nao reconhecido/i);

    expect(fs.existsSync(envFilePath)).toBe(false);
  });

  it('rejects unavailable providers unless explicitly allowed', async () => {
    (config as any).openCodeApiKey = '';
    const tool = new ConfigureLlmProfileTool({ envFilePath });

    await expect(tool.execute({
      action: 'set',
      providerName: 'opencode',
      modelName: 'opencode/minimax-m2.5-free',
    })).rejects.toThrow(/opencode: nao conectou; falta OPENCODE_API_KEY/i);

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
    expect(result.provider_ready).toBe(false);
    expect(result.provider_notice).toBe('mistral: salvo, mas ainda falta MISTRAL_API_KEY.');
    expect(fs.readFileSync(envFilePath, 'utf8')).toContain('LLM_PROVIDER=mistral');
    expect(fs.readFileSync(envFilePath, 'utf8')).toContain('MISTRAL_MODEL=mistral-large-latest');
  });

  it('gives a compact missing-config message for OpenClaw parity aliases', async () => {
    const tool = new ConfigureLlmProfileTool({ envFilePath });

    await expect(tool.execute({
      action: 'set',
      providerName: 'github-copilot',
      modelName: 'gpt-4o',
    })).rejects.toThrow(/github-copilot: nao conectou; falta GITHUB_COPILOT_API_KEY \+ GITHUB_COPILOT_BASE_URL/i);
  });
});
