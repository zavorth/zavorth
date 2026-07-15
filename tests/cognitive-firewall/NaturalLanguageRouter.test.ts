import { NaturalLanguageRouter } from '../../src/cognitive-firewall';

describe('NaturalLanguageRouter honest command contract', () => {
  const router = new NaturalLanguageRouter();

  it('does not pretend every natural intent maps to an internal slash command', () => {
    const route = router.route('list the src directory');

    expect(route.classified).toBe(true);
    // Free-text category is model-owned; local router only hints full_toolset.
    expect(route.intentCategory).toBe('full_toolset');
    expect(route.suggestedInternalCommand).toBeNull();
    expect(route.legacyFallbackCommand).toBe('/task');
    expect(route.skipCommandRouting).toBe(false);
  });

  it('keeps empty input unclassified without fabricating a command', () => {
    const route = router.route('   ');

    expect(route.classified).toBe(false);
    expect(route.intentCategory).toBe('conversation');
    expect(route.suggestedInternalCommand).toBeNull();
    expect(route.legacyFallbackCommand).toBe('/task');
    expect(route.useFastModel).toBe(false);
  });

  it('routes greetings as full_toolset without fast-model shortcut', () => {
    const route = router.route('hi');

    expect(route.intentCategory).toBe('full_toolset');
    expect(route.useFastModel).toBe(false);
    expect(route.suggestedInternalCommand).toBeNull();
  });
});
