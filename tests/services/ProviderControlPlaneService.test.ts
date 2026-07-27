import fs from 'fs';
import os from 'os';
import path from 'path';
import { config } from '../../src/config/index';
import { ProviderControlPlaneService } from '../../src/services/ProviderControlPlaneService';

describe('ProviderControlPlaneService', () => {
  const originalProvider = config.llmProvider;
  const originalGeminiModel = config.geminiModel;
  const originalGemmaModel = config.gemmaModel;
  const originalOpenAiKey = config.openaiApiKey;
  const originalMiniMaxKey = (config as any).minimaxApiKey;
  const originalMiniMaxModel = (config as any).minimaxModel;
  const originalAIGatewayBaseUrl = config.AIGatewayBaseUrl;
  const originalAIGatewayUpstreamBaseUrl = config.AIGatewayUpstreamBaseUrl;
  const originalAIGatewayGatewayStatusFile = config.AIGatewayGatewayStatusFile;
  const originalAIGatewayGatewayEnabled = config.zavorthAIGatewayGatewayEnabled;
  const originalGeminiKeys = [...config.geminiApiKeys];
  const originalModelSelectionFamilyId = (config as any).modelSelectionFamilyId;
  const originalModelSelectionRouteId = (config as any).modelSelectionRouteId;
  const originalModelSelectionModelId = (config as any).modelSelectionModelId;
  const tempDirs: string[] = [];

  afterEach(() => {
    (config as any).llmProvider = originalProvider;
    (config as any).geminiModel = originalGeminiModel;
    (config as any).gemmaModel = originalGemmaModel;
    (config as any).openaiApiKey = originalOpenAiKey;
    (config as any).minimaxApiKey = originalMiniMaxKey;
    (config as any).minimaxModel = originalMiniMaxModel;
    (config as any).AIGatewayBaseUrl = originalAIGatewayBaseUrl;
    (config as any).AIGatewayUpstreamBaseUrl = originalAIGatewayUpstreamBaseUrl;
    (config as any).AIGatewayGatewayStatusFile = originalAIGatewayGatewayStatusFile;
    (config as any).zavorthAIGatewayGatewayEnabled = originalAIGatewayGatewayEnabled;
    (config as any).geminiApiKeys = [...originalGeminiKeys];
    (config as any).modelSelectionFamilyId = originalModelSelectionFamilyId;
    (config as any).modelSelectionRouteId = originalModelSelectionRouteId;
    (config as any).modelSelectionModelId = originalModelSelectionModelId;
    while (tempDirs.length > 0) {
      const target = tempDirs.pop();
      if (target && fs.existsSync(target)) {
        fs.rmSync(target, { recursive: true, force: true });
      }
    }
  });

  it('resolves the puter alias to the qwen provider', () => {
    const service = new ProviderControlPlaneService({
      clearProviderCache: jest.fn(),
    });

    const selection = service.resolveSelection('puter');

    expect(selection).toEqual(expect.objectContaining({
      selectionKind: 'provider',
      effectiveProviderName: 'qwen',
      replyLabel: 'Qwen via Puter',
    }));
  });

  it('resolves Gemma as a Gemini-hosted model selection', () => {
    (config as any).gemmaModel = 'gemma-2-27b-it';
    const service = new ProviderControlPlaneService({
      clearProviderCache: jest.fn(),
    });

    const selection = service.resolveSelection('gemma');

    expect(selection).toEqual(expect.objectContaining({
      selectionKind: 'model',
      effectiveProviderName: 'gemini',
      modelName: 'gemma-2-27b-it',
    }));
  });

  it('recommends the coding profile for code review flows', () => {
    (config as any).llmProvider = 'openai';
    (config as any).openaiApiKey = 'test-openai-key';
    (config as any).AIGatewayBaseUrl = '';
    (config as any).zavorthAIGatewayGatewayEnabled = false;
    const service = new ProviderControlPlaneService({
      clearProviderCache: jest.fn(),
    });

    const recommendation = service.recommendProfileForTask('code', 'review');

    expect(recommendation.profile.id).toBe('coding');
    expect(recommendation.strategy.providerName).toBe('openai');
    expect(recommendation.selectedModelProfile).toEqual(expect.objectContaining({
      providerName: 'openai',
      routeId: 'openai',
    }));
    expect(recommendation.selectionExplanation?.join(' ')).toContain('Familia selecionada');
  });

  it('resolves SelectedModelProfile from explicit family, route and model config', () => {
    (config as any).openaiApiKey = 'test-openai-key';
    (config as any).modelSelectionFamilyId = 'openai';
    (config as any).modelSelectionRouteId = 'openai';
    (config as any).modelSelectionModelId = 'gpt-4o';
    const service = new ProviderControlPlaneService({
      clearProviderCache: jest.fn(),
    });

    const selection = service.resolveSelectedModelProfile({
      includeAdvanced: true,
      fallbackOrder: ['gemini'],
    });

    expect(selection.primary).toEqual(expect.objectContaining({
      familyId: 'openai',
      routeId: 'openai',
      providerName: 'openai',
      modelName: 'gpt-4o',
    }));
    expect(selection.compatibility).toEqual(expect.objectContaining({
      providerName: 'openai',
      modelName: 'gpt-4o',
    }));
    expect(selection.explanation.join(' ')).toContain('Rota selecionada');
  });

  it('marks Gemma as pending config when Gemini credentials are missing', () => {
    (config as any).geminiApiKeys = [];
    const service = new ProviderControlPlaneService({
      clearProviderCache: jest.fn(),
    });

    const gemma = service.listProviders().find((entry) => entry.id === 'gemma');

    expect(gemma).toEqual(expect.objectContaining({
      readiness: 'needs_config',
      issue: expect.stringContaining('GEMINI_API_KEY'),
    }));
  });

  it('lists MiniMax as a ready optional provider when MINIMAX_API_KEY exists', () => {
    (config as any).minimaxApiKey = 'minimax-key';
    (config as any).minimaxModel = 'MiniMax-M2.7';
    const service = new ProviderControlPlaneService({
      clearProviderCache: jest.fn(),
    });

    const minimax = service.listProviders().find((entry) => entry.id === 'minimax');

    expect(minimax).toEqual(expect.objectContaining({
      readiness: 'ready',
      ready: true,
      currentModel: 'MiniMax-M2.7',
    }));
    expect(service.resolveSelection('minimax')).toEqual(expect.objectContaining({
      effectiveProviderName: 'minimax',
      selectionKind: 'provider',
    }));
  });

  it('applies a profile using the first ready provider in its preferred order', () => {
    (config as any).llmProvider = 'gemini';
    (config as any).geminiApiKeys = ['gemini-key'];
    (config as any).openaiApiKey = 'test-openai-key';
    (config as any).AIGatewayBaseUrl = '';
    (config as any).zavorthAIGatewayGatewayEnabled = false;
    const clearProviderCache = jest.fn();
    const service = new ProviderControlPlaneService({
      clearProviderCache,
    });

    const applied = service.applyProfileSelection('coding');

    expect(applied.profile.id).toBe('coding');
    expect(applied.target.id).toBe('openai');
    expect((config as any).llmProvider).toBe('openai');
    expect(clearProviderCache).toHaveBeenCalled();
  });

  it('marks AIGateway as ready when the Zavorth-owned gateway status is healthy', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-provider-AIGateway-'));
    tempDirs.push(root);
    (config as any).AIGatewayBaseUrl = 'http://127.0.0.1:21128/v1';
    (config as any).AIGatewayUpstreamBaseUrl = 'http://127.0.0.1:20128/v1';
    (config as any).zavorthAIGatewayGatewayEnabled = true;
    (config as any).AIGatewayGatewayStatusFile = path.join(root, 'ai-gateway.json');
    fs.writeFileSync(
      config.AIGatewayGatewayStatusFile,
      JSON.stringify({
        enabled: true,
        ready: true,
        running: true,
        pid: 4512,
        host: '127.0.0.1',
        port: 21128,
        baseUrl: 'http://127.0.0.1:21128/v1',
        upstreamBaseUrl: 'http://127.0.0.1:20128/v1',
        localOnly: true,
        overlayFile: 'C:/repo/config/AIGateway-overlay.json',
        checkedAt: '2026-04-04T16:00:00.000Z',
        message: 'Gateway own do AIGateway active.',
      }),
      'utf8',
    );

    const service = new ProviderControlPlaneService({
      clearProviderCache: jest.fn(),
    });

    const AIGateway = service.listProviders({ includeAdvanced: true }).find((entry) => entry.id === 'AIGateway');
    const AIGatewayRoute = service.resolveAccessRoutes({ includeAdvanced: true }).routes.find((entry) => entry.id === 'AIGateway');

    expect(AIGateway).toEqual(expect.objectContaining({
      readiness: 'ready',
      ready: true,
      issue: null,
    }));
    expect(AIGatewayRoute).toEqual(expect.objectContaining({
      readinessCode: 'ready',
      routeClass: 'gateway',
      health: expect.objectContaining({
        status: 'healthy',
      }),
    }));
  });
});
