import { StructuredPlanner } from '../../src/agents/StructuredPlanner';
import { ProviderFactory } from '../../src/providers/ProviderFactory';
import { config } from '../../src/config';

describe('StructuredPlanner', () => {
  const originalConfig = {
    llmProvider: (config as any).llmProvider,
    geminiApiKey: (config as any).geminiApiKey,
    geminiApiKeys: (config as any).geminiApiKeys,
    deepseekApiKey: (config as any).deepseekApiKey,
    echoLlmFallbackOrder: (config as any).echoLlmFallbackOrder,
  };

  afterEach(() => {
    jest.restoreAllMocks();
    (config as any).llmProvider = originalConfig.llmProvider;
    (config as any).geminiApiKey = originalConfig.geminiApiKey;
    (config as any).geminiApiKeys = originalConfig.geminiApiKeys;
    (config as any).deepseekApiKey = originalConfig.deepseekApiKey;
    (config as any).echoLlmFallbackOrder = originalConfig.echoLlmFallbackOrder;
  });

  it('falls back to another provider when the primary one fails', async () => {
    const geminiProvider = {
      chat: jest.fn().mockRejectedValue(new Error('429 Too Many Requests')),
    };
    const deepseekProvider = {
      chat: jest.fn().mockResolvedValue({
        content: JSON.stringify({
          objective: 'Encontrar arquivo',
          context: 'Teste',
          assumptions: [],
          executor_recommendation: 'local_executor',
          workspace_recommendation: 'core',
          risk_level: 1,
          requires_approval: false,
          steps: [],
          validation_steps: [],
          success_condition: 'ok',
          rollback_condition: 'nenhum',
          notes: [],
        }),
        toolCalls: [],
        finishReason: 'stop',
      }),
    };

    jest.spyOn(ProviderFactory, 'create').mockImplementation((name: string) => {
      if (name === 'gemini') {
        return geminiProvider as any;
      }
      if (name === 'deepseek') {
        return deepseekProvider as any;
      }
      throw new Error(`Provider nao esperado: ${name}`);
    });

    (config as any).llmProvider = 'gemini';
    (config as any).geminiApiKey = 'gemini-key';
    (config as any).geminiApiKeys = ['gemini-key'];
    (config as any).deepseekApiKey = 'deepseek-key';
    (config as any).echoLlmFallbackOrder = ['deepseek'];

    const planner = new StructuredPlanner();
    const task = {
      task_id: 'task-1',
      raw_message: '/plan localizar arquivo',
      normalized_message: 'localizar arquivo',
      parent_task_id: null,
    } as any;

    const result = await planner.generatePlan(task, 'gere um plano em json');

    expect(result.providerUsed).toBe('deepseek');
    expect(result.fallbackUsed).toBe(true);
    expect(result.decisionTrace.intent.executionRoute).toBe('planner.structured');
    expect(result.plan.notes).toEqual(
      expect.arrayContaining(['decision.route=planner.structured', 'decision.provider_used=deepseek']),
    );
    expect(deepseekProvider.chat).toHaveBeenCalled();
  });
});
