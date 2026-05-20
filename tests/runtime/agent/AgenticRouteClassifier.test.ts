import { config } from '../../../src/config';
import { AgenticRouteClassifier } from '../../../src/runtime/agent/AgenticRouteClassifier';
import { NaturalFirstRunClassifier } from '../../../src/runtime/agent/NaturalFirstRunClassifier';

describe('AgenticRouteClassifier', () => {
  const originalInteractionsEnabled = (config as any).geminiInteractionsEnabled;
  const originalInteractionsApiKey = (config as any).geminiInteractionsApiKey;
  const originalManagedEnabled = (config as any).geminiManagedAgentsEnabled;

  afterEach(() => {
    (config as any).geminiInteractionsEnabled = originalInteractionsEnabled;
    (config as any).geminiInteractionsApiKey = originalInteractionsApiKey;
    (config as any).geminiManagedAgentsEnabled = originalManagedEnabled;
  });

  it('selects interactions automatically for complex read-only analysis', () => {
    (config as any).geminiInteractionsEnabled = true;
    (config as any).geminiInteractionsApiKey = 'test-key';
    const naturalFirst = new NaturalFirstRunClassifier().classify({
      text: 'Analise esse erro e explique o plano com evidencias.',
      channel: 'web',
      userId: 'u1',
    });

    const decision = new AgenticRouteClassifier().decide({
      request: {
        userId: 'u1',
        channel: 'web',
        text: 'Analise esse erro e explique o plano com evidencias.',
      },
      naturalFirst,
    });

    expect(decision.selectedRoute).toBe('llm-interactions');
    expect(decision.providerRoute).toBe('gemini-interactions');
    expect(decision.requiresApproval).toBe(false);
    expect(decision.policy.serverSideStore).toBe(false);
  });

  it('uses managed-agent preview for suspicious execution and never skips approval', () => {
    (config as any).geminiManagedAgentsEnabled = true;
    const naturalFirst = new NaturalFirstRunClassifier().classify({
      text: 'Rode esse pacote suspeito em sandbox sem tocar no meu PC.',
      channel: 'web',
      userId: 'u1',
    });

    const decision = new AgenticRouteClassifier().decide({
      request: {
        userId: 'u1',
        channel: 'web',
        text: 'Rode esse pacote suspeito em sandbox sem tocar no meu PC.',
      },
      naturalFirst,
    });

    expect(decision.selectedRoute).toBe('remote-agent-preview');
    expect(decision.requiresApproval).toBe(true);
    expect(decision.policy.noToolExecutionWithoutApproval).toBe(true);
  });

  it('falls back to standard route when interactions are disabled', () => {
    (config as any).geminiInteractionsEnabled = false;
    (config as any).geminiInteractionsApiKey = 'test-key';
    const naturalFirst = new NaturalFirstRunClassifier().classify({
      text: 'Analise a arquitetura e mostre os passos.',
      channel: 'web',
      userId: 'u1',
    });

    const decision = new AgenticRouteClassifier().decide({
      request: {
        userId: 'u1',
        channel: 'web',
        text: 'Analise a arquitetura e mostre os passos.',
      },
      naturalFirst,
    });

    expect(decision.selectedRoute).toBe('standard-llm');
    expect(decision.signals).toContain('interactions-disabled');
  });
});
