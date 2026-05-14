import {
  NaturalFirstRunClassifier,
} from '../../../src/runtime/agent/index.js';

describe('NaturalFirstRunClassifier transaction routing', () => {
  const classifier = new NaturalFirstRunClassifier();

  it('routes transactional value movement to an approval proposal', () => {
    const result = classifier.classify({
      text: 'Compre ETH ate R$300 se cair 5%, mas peca confirmacao antes.',
      channel: 'web',
      availableTools: ['zavorth.transaction-runtime'],
    });

    expect(result).toEqual(expect.objectContaining({
      shouldEnterGateway: true,
      route: 'approval-proposal',
      effort: 'standard',
      usesLlm: 'optional',
      requiresApproval: true,
      intent: expect.objectContaining({
        primary: 'sensitive-action',
        candidates: expect.arrayContaining(['sensitive-action']),
      }),
      risk: expect.objectContaining({
        level: 'danger',
        requiresApproval: true,
        reasons: expect.arrayContaining(['transaction-approval-intent']),
      }),
      signals: expect.arrayContaining(['transaction-intent', 'approval-required']),
    }));
  });

  it('routes transactional monitoring to governed preview without approval', () => {
    const result = classifier.classify({
      text: 'Monitore notebook abaixo de R$3500 e me avise.',
      channel: 'telegram',
      availableTools: ['zavorth.transaction-preview'],
    });

    expect(result).toEqual(expect.objectContaining({
      shouldEnterGateway: true,
      route: 'tool-preview',
      effort: 'standard',
      usesLlm: 'optional',
      requiresApproval: false,
      intent: expect.objectContaining({
        primary: 'tool-use',
        candidates: expect.arrayContaining(['tool-use']),
      }),
      risk: expect.objectContaining({
        level: 'attention',
        previewRequired: true,
        reasons: expect.arrayContaining(['transaction-preview-intent']),
      }),
      signals: expect.arrayContaining(['transaction-preview-intent', 'preview-required']),
    }));
  });

  it('keeps slash commands out of the natural transaction path', () => {
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
