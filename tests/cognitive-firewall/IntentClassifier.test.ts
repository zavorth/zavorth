import { IntentClassifier } from '../../src/cognitive-firewall';

describe('IntentClassifier contextual hints', () => {
  const classifier = new IntentClassifier();

  it.each([
    ['lembra daquele filme que te falei?', 'memory-conversation-context'],
    ['cria um resumo da reuniao', 'file-conversation-context'],
    ['roda esse raciocinio de novo', 'execution-conversation-context'],
    ['abre a cabeca e pensa diferente', 'file-conversation-context'],
    ['me salva dessa', 'file-conversation-context'],
  ])('downgrades conversational false positive: %s', (text, signal) => {
    const result = classifier.classify(text);

    expect(result.category).toBe('conversation');
    expect(result.confidence).toBeLessThan(0.75);
    expect(result.isHardDecision).toBe(false);
    expect(result.downgradedBy).toContain(signal);
    expect(result.secondPass).toEqual(expect.objectContaining({
      source: 'ContextualIntentSecondPass',
      stage: 7,
      mode: 'local-contextual',
    }));
  });

  it.each([
    ['crie um arquivo README.md', 'file_operation'],
    ['liste a pasta src', 'file_operation'],
    ['rode os testes', 'execution'],
    ['executar npm test', 'execution'],
    ['configure o modelo claude', 'configuration'],
    ['lembre que eu prefiro respostas curtas', 'memory'],
  ])('keeps concrete technical intents as hints: %s', (text, category) => {
    const result = classifier.classify(text);

    expect(result.category).toBe(category);
    expect(result.confidence).toBeGreaterThanOrEqual(0.75);
    expect(result.isHardDecision).toBe(false);
    expect(result.secondPass.verdict).toBe('confirmed');
  });

  it('keeps weak isolated tool words ambiguous instead of forcing a route', () => {
    const result = classifier.classify('salva isso para mim');

    expect(result.category).toBe('full_toolset');
    expect(result.confidence).toBeLessThan(0.75);
    expect(result.isHardDecision).toBe(false);
    expect(result.downgradedBy).toContain('weak-file-keyword');
    expect(result.secondPass.verdict).toBe('left-ambiguous');
  });

  it('second pass downgrades explicit no-tool workspace mentions', () => {
    const result = classifier.classify('nao abra arquivo nem leia o README, so me explique o conceito');

    expect(result.category).toBe('conversation');
    expect(result.isHardDecision).toBe(false);
    expect(result.confidence).toBeLessThanOrEqual(0.6);
    expect(result.downgradedBy).toContain('second-pass-explicit-no-tool-request');
    expect(result.secondPass).toEqual(expect.objectContaining({
      verdict: 'downgraded',
      originalCategory: 'file_operation',
      finalCategory: 'conversation',
      signals: expect.arrayContaining(['explicit-no-tool-request']),
    }));
  });
});
