import {
  buildProviderConfig,
  DEFAULT_ECHO_LLM_FALLBACK_ORDER,
} from '../../src/config/sections/providerConfig';
import fs from 'fs';
import os from 'os';
import path from 'path';

describe('buildProviderConfig', () => {
  const originalEchoOrder = process.env.ZAVORTH_ECHO_LLM_FALLBACK_ORDER;
  const originalLegacyEchoOrder = process.env.ZAVORTH_ECHO_FALLBACK_ORDER;
  const originalProvider = process.env.LLM_PROVIDER;
  const originalModel = process.env.ZAVORTH_MODEL;
  const originalModelId = process.env.ZAVORTH_MODEL_ID;

  afterEach(() => {
    if (originalEchoOrder === undefined) {
      delete process.env.ZAVORTH_ECHO_LLM_FALLBACK_ORDER;
    } else {
      process.env.ZAVORTH_ECHO_LLM_FALLBACK_ORDER = originalEchoOrder;
    }
    if (originalLegacyEchoOrder === undefined) {
      delete process.env.ZAVORTH_ECHO_FALLBACK_ORDER;
    } else {
      process.env.ZAVORTH_ECHO_FALLBACK_ORDER = originalLegacyEchoOrder;
    }
    if (originalProvider === undefined) {
      delete process.env.LLM_PROVIDER;
    } else {
      process.env.LLM_PROVIDER = originalProvider;
    }
    if (originalModel === undefined) {
      delete process.env.ZAVORTH_MODEL;
    } else {
      process.env.ZAVORTH_MODEL = originalModel;
    }
    if (originalModelId === undefined) {
      delete process.env.ZAVORTH_MODEL_ID;
    } else {
      process.env.ZAVORTH_MODEL_ID = originalModelId;
    }
  });

  it('parses Echo LLM fallback order from configuration with stable normalization', () => {
    process.env.ZAVORTH_ECHO_LLM_FALLBACK_ORDER = 'vllm, openai; VLLM\nollama';
    delete process.env.ZAVORTH_ECHO_FALLBACK_ORDER;

    expect(buildProviderConfig().echoLlmFallbackOrder).toEqual(['vllm', 'openai', 'ollama']);
  });

  it('keeps the canonical Echo LLM fallback order when configuration is empty', () => {
    process.env.ZAVORTH_ECHO_LLM_FALLBACK_ORDER = ' , ; ';
    delete process.env.ZAVORTH_ECHO_FALLBACK_ORDER;

    expect(buildProviderConfig().echoLlmFallbackOrder).toEqual([...DEFAULT_ECHO_LLM_FALLBACK_ORDER]);
  });

  it('supports the short legacy Echo fallback environment variable', () => {
    delete process.env.ZAVORTH_ECHO_LLM_FALLBACK_ORDER;
    process.env.ZAVORTH_ECHO_FALLBACK_ORDER = 'lmstudio,gemini';

    expect(buildProviderConfig().echoLlmFallbackOrder).toEqual(['lmstudio', 'gemini']);
  });

  it('uses governed provider preference when environment does not override it', () => {
    delete process.env.LLM_PROVIDER;
    delete process.env.ZAVORTH_MODEL;
    delete process.env.ZAVORTH_MODEL_ID;
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-provider-config-pref-'));
    const runtimeDir = path.join(root, 'data', 'runtime');
    fs.mkdirSync(runtimeDir, { recursive: true });
    fs.writeFileSync(path.join(runtimeDir, 'provider-selection-preferences.json'), JSON.stringify({
      providerId: 'openai',
      modelId: 'gpt-test',
      routeId: 'openai',
      familyId: 'openai',
    }), 'utf8');

    const config = buildProviderConfig(root);

    expect(config.llmProvider).toBe('openai');
    expect(config.modelSelectionModelId).toBe('gpt-test');
    expect(config.modelSelectionRouteId).toBe('openai');
  });
});
