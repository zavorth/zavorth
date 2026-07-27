import { IntentClassifier } from '../../src/cognitive-firewall';

describe('IntentClassifier free-text hints', () => {
  const classifier = new IntentClassifier();

  it.each(['hi', 'hello', 'thanks', 'ok', 'bye'])(
    'treats free-text greetings as full_toolset (model-owned): %s',
    (text) => {
      const result = classifier.classify(text);

      expect(result.category).toBe('full_toolset');
      expect(result.isHardDecision).toBe(false);
      expect(result.confidence).toBe(0.5);
      expect(result.secondPass).toEqual(
        expect.objectContaining({
          source: 'ContextualIntentSecondPass',
          verdict: 'left-ambiguous',
          originalCategory: 'full_toolset',
          finalCategory: 'full_toolset',
          signals: expect.arrayContaining(['model-owned-free-text']),
        }),
      );
    },
  );

  it.each([
    'create a file README.md',
    'list the src directory',
    'run the tests',
    'execute npm test',
    'configure the claude model',
    'remember that I prefer short answers',
    'what are the latest AI news-',
    'create a summary of the meeting',
    'save this for me',
    "don't open any file or read the README, just explain the concept",
  ])('does not map free-text words to capability categories: %s', (text) => {
    const result = classifier.classify(text);

    expect(result.category).toBe('full_toolset');
    expect(result.isHardDecision).toBe(false);
    expect(result.confidence).toBe(0.5);
    expect(result.secondPass).toEqual(
      expect.objectContaining({
        source: 'ContextualIntentSecondPass',
        verdict: 'left-ambiguous',
        originalCategory: 'full_toolset',
        finalCategory: 'full_toolset',
        signals: expect.arrayContaining(['model-owned-free-text']),
      }),
    );
  });

  it('classifies empty input as conversation', () => {
    const result = classifier.classify('   ');

    expect(result.category).toBe('conversation');
    expect(result.confidence).toBe(0.5);
  });
});
