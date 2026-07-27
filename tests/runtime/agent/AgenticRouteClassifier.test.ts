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

  it('does not select interactions from free-text analysis keywords alone', () => {
    (config as any).geminiInteractionsEnabled = true;
    (config as any).geminiInteractionsApiKey = 'test-key';
    const naturalFirst = new NaturalFirstRunClassifier().classify({
      text: 'Analyze this error and explain the plan with evidence.',
      channel: 'web',
      userId: 'u1',
    });

    const decision = new AgenticRouteClassifier().decide({
      request: {
        userId: 'u1',
        channel: 'web',
        text: 'Analyze this error and explain the plan with evidence.',
      },
      naturalFirst,
    });

    expect(decision.selectedRoute).toBe('standard-llm');
  });

  it('selects interactions when structured preferInteractions metadata is set', () => {
    (config as any).geminiInteractionsEnabled = true;
    (config as any).geminiInteractionsApiKey = 'test-key';
    const naturalFirst = new NaturalFirstRunClassifier().classify({
      text: 'Analyze this error and explain the plan with evidence.',
      channel: 'web',
      userId: 'u1',
    });

    const decision = new AgenticRouteClassifier().decide({
      request: {
        userId: 'u1',
        channel: 'web',
        text: 'Analyze this error and explain the plan with evidence.',
        metadata: { preferInteractions: true },
      },
      naturalFirst,
    });

    expect(decision.selectedRoute).toBe('llm-interactions');
    expect(decision.providerRoute).toBe('gemini-interactions');
    expect(decision.requiresApproval).toBe(false);
    expect(decision.policy.serverSideStore).toBe(false);
    expect(decision.signals).toContain('structured-prefer-interactions');
  });

  it('does not use managed-agent preview from free-text sandbox keywords alone', () => {
    (config as any).geminiManagedAgentsEnabled = true;
    const naturalFirst = new NaturalFirstRunClassifier().classify({
      text: 'Run this suspicious package in sandbox without touching my PC.',
      channel: 'web',
      userId: 'u1',
    });

    const decision = new AgenticRouteClassifier().decide({
      request: {
        userId: 'u1',
        channel: 'web',
        text: 'Run this suspicious package in sandbox without touching my PC.',
      },
      naturalFirst,
    });

    expect(decision.selectedRoute).toBe('standard-llm');
  });

  it('uses managed-agent preview for structured preferRemoteAgent and never skips approval', () => {
    (config as any).geminiManagedAgentsEnabled = true;
    const naturalFirst = new NaturalFirstRunClassifier().classify({
      text: 'Run this suspicious package in sandbox without touching my PC.',
      channel: 'web',
      userId: 'u1',
    });

    const decision = new AgenticRouteClassifier().decide({
      request: {
        userId: 'u1',
        channel: 'web',
        text: 'Run this suspicious package in sandbox without touching my PC.',
        metadata: { preferRemoteAgent: true },
      },
      naturalFirst,
    });

    expect(decision.selectedRoute).toBe('remote-agent-preview');
    expect(decision.requiresApproval).toBe(true);
    expect(decision.policy.noToolExecutionWithoutApproval).toBe(true);
    expect(decision.signals).toContain('structured-prefer-remote-agent');
  });

  it('falls back to standard route when interactions are disabled even with structured prefer', () => {
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
        metadata: { preferInteractions: true },
      },
      naturalFirst,
    });

    expect(decision.selectedRoute).toBe('standard-llm');
    expect(decision.signals).toContain('interactions-disabled');
  });
});
