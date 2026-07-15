import { config } from '../../src/config/index';
import { ProviderControlPlaneService } from '../../src/services/ProviderControlPlaneService';
import { ProviderDoctorService } from '../../src/services/ProviderDoctorService';

describe('ProviderDoctorService', () => {
  const originalProvider = config.llmProvider;
  const originalGeminiKeys = [...config.geminiApiKeys];
  const originalOpenAiKey = config.openaiApiKey;
  const originalOpenRouterKey = config.openRouterApiKey;
  const originalAIGatewayBaseUrl = config.AIGatewayBaseUrl;

  afterEach(() => {
    (config as any).llmProvider = originalProvider;
    (config as any).geminiApiKeys = [...originalGeminiKeys];
    (config as any).openaiApiKey = originalOpenAiKey;
    (config as any).openRouterApiKey = originalOpenRouterKey;
    (config as any).AIGatewayBaseUrl = originalAIGatewayBaseUrl;
  });

  it('builds a readiness report with ready, pending and probe providers', () => {
    (config as any).llmProvider = 'gemini';
    (config as any).geminiApiKeys = ['gemini-key'];
    (config as any).openaiApiKey = '';
    (config as any).openRouterApiKey = '';
    (config as any).AIGatewayBaseUrl = 'http://127.0.0.1:20128/v1';

    const controlPlane = new ProviderControlPlaneService({
      clearProviderCache: jest.fn(),
    });
    const service = new ProviderDoctorService({
      providerControlPlane: controlPlane,
    });

    const report = service.inspect({
      taskKind: 'research',
      taskSubtype: 'web_research',
    });

    expect(report.readyProviders.map((entry) => entry.id)).toEqual(expect.arrayContaining(['gemini', 'gemma']));
    expect(report.pendingConfigProviders.map((entry) => entry.id)).toEqual(
      expect.arrayContaining(['openai', 'openrouter']),
    );
    expect(report.probeProviders.map((entry) => entry.id)).toContain('AIGateway');
    expect(report.recommendedProfile.profile.id).toBe('research');
    expect(report.modelPicker.selected.source).toBe('current-config');
    expect(report.modelPicker.selected.providerLabel).toBe('Gemini');
    expect(report.modelPicker.selected.ready).toBe(true);
  });

  it('renders an operator-facing report with profile and recommendation sections', () => {
    (config as any).llmProvider = 'gemini';
    (config as any).geminiApiKeys = ['gemini-key'];
    const service = new ProviderDoctorService({
      providerControlPlane: new ProviderControlPlaneService({
        clearProviderCache: jest.fn(),
      }),
    });

    const text = service.renderStatusReport({
      taskKind: 'code',
      taskSubtype: 'debugging',
      preferredZavorthBridgeModel: 'gemini-2.5-pro',
    });

    expect(text).toContain('Providers ready now');
    expect(text).toContain('Recommended profile for this stage: Coding');
    expect(text).toContain('Preferred ZavorthBridge model: gemini-2.5-pro');
    expect(text).toContain('Recommendations:');
  });
});
