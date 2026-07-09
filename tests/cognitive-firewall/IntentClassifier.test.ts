import { IntentClassifier } from '../../src/cognitive-firewall';

describe('IntentClassifier contextual hints', () => {
  const classifier = new IntentClassifier();

  it.each([
    ['create a summary of the meeting', 'file-conversation-context'],
    ['run this reasoning again', 'execution-conversation-context'],
    ['open my mind and think differently', 'file-conversation-context'],
    ['save me from this', 'file-conversation-context'],
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
    ['create a file README.md', 'file_operation'],
    ['list the src directory', 'file_operation'],
    ['run the tests', 'execution'],
    ['execute npm test', 'execution'],
    ['configure the claude model', 'configuration'],
    ['remember that I prefer short answers', 'memory'],
  ])('keeps concrete technical intents as hints: %s', (text, category) => {
    const result = classifier.classify(text);

    expect(result.category).toBe(category);
    expect(result.confidence).toBeGreaterThanOrEqual(0.75);
    expect(result.isHardDecision).toBe(false);
    expect(result.secondPass.verdict).toBe('confirmed');
  });

  it('classifies weak file operations as memory when ambiguous', () => {
    const result = classifier.classify('save this for me');

    expect(result.category).toBe('memory');
    expect(result.confidence).toBeGreaterThanOrEqual(0.75);
    expect(result.isHardDecision).toBe(false);
  });

  it('second pass downgrades explicit no-tool workspace mentions', () => {
    const result = classifier.classify('don\'t open any file or read the README, just explain the concept');

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
