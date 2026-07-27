import {
  NaturalFirstRunClassifier,
} from '../../../src/runtime/agent/index.js';

describe('NaturalFirstRunClassifier structured tool risk', () => {
  const classifier = new NaturalFirstRunClassifier();

  it('routes free-text purchase phrases to the agent (no keyword force)', () => {
    const result = classifier.classify({
      text: 'Compre ETH ate R$300 se cair 5%, mas peca confirmation antes.',
      channel: 'web',
      availableTools: ['zavorth.transaction-runtime'],
    });

    expect(result).toEqual(expect.objectContaining({
      shouldEnterGateway: true,
      route: 'llm-reply',
      requiresApproval: false,
    }));
  });

  it('routes high-risk requested tools to approval', () => {
    const result = classifier.classify({
      text: 'please continue',
      channel: 'web',
      requestedTools: ['workspace.delete'],
    });

    expect(result).toEqual(expect.objectContaining({
      route: 'approval-proposal',
      requiresApproval: true,
      risk: expect.objectContaining({
        level: 'danger',
      }),
    }));
  });

  it('keeps slash commands as deterministic shortcuts', () => {
    expect(classifier.classify({
      text: '/comprar ETH',
      channel: 'cli',
    })).toEqual(expect.objectContaining({
      shouldEnterGateway: false,
      route: 'slash-command',
      intent: expect.objectContaining({
        primary: 'slash-command',
      }),
    }));
  });
});
