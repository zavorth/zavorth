import { LegacyUnifiedGatewayAdapter } from '../../src/context-engine/LegacyUnifiedGatewayAdapter.js';
import { wireLegacyUnifiedGatewayAgentCallback } from '../../src/bootstrap/bootstrapContextEngine.js';

describe('wireLegacyUnifiedGatewayAgentCallback', () => {
  it('wires the legacy gateway fallback in the central bootstrap instead of relying on Telegram bootstrap', async () => {
    const contextEngine = {
      pushEvent: jest.fn(),
      prepareAsync: jest.fn().mockResolvedValue({
        messages: [
          { role: 'system', content: 'system via context engine' },
          { role: 'user', content: 'me explique o plano' },
        ],
        tools: [],
        firewallStats: 'Context firewall stats',
        intentCategory: 'general',
      }),
    };
    const llmRuntime = {
      isProviderAvailable: jest.fn(() => true),
      chatDetailed: jest.fn().mockResolvedValue({
        providerName: 'gemini',
        response: { content: 'Resposta do gateway unificado.' },
      }),
    };
    const toolRuntime = {
      getToolDefinitions: jest.fn().mockReturnValue([]),
      executeTool: jest.fn(),
    };
    const logRepo = { log: jest.fn() };
    const legacyUnifiedGateway = new LegacyUnifiedGatewayAdapter(contextEngine as any);

    wireLegacyUnifiedGatewayAgentCallback({
      logRepo: logRepo as any,
      contextEngine: contextEngine as any,
      legacyUnifiedGateway,
      runtimeComposition: {
        getLlmRuntime: () => llmRuntime as any,
        getToolRuntime: () => toolRuntime as any,
      },
    });

    const reply = jest.fn(async () => undefined);
    const result = await legacyUnifiedGateway.handleEvent({
      surface: 'web',
      chatId: 'web:session-1',
      userId: 'web-user',
      text: 'me explique o plano',
      isGroup: false,
      reply,
      metadata: {
        workspaceContext: 'workspace extra',
      },
    });

    expect(contextEngine.prepareAsync).toHaveBeenCalledWith(
      'me explique o plano',
      'web-user',
      'web:session-1',
      'web',
      [],
      expect.stringContaining('Voce e o **Zavorth**'),
      'workspace extra',
      undefined,
    );
    expect(llmRuntime.chatDetailed).toHaveBeenCalledWith(
      expect.any(Array),
      undefined,
      expect.objectContaining({
        providerName: expect.any(String),
        allowFallback: true,
      }),
    );
    expect(reply).toHaveBeenCalledWith('Resposta do gateway unificado.');
    expect(result.responseText).toBe('Resposta do gateway unificado.');
    expect(logRepo.log).toHaveBeenCalledWith(
      'info',
      'ContextEngine',
      'LegacyUnifiedGatewayAdapter agent callback conectado no bootstrap central.',
    );
  });
});
