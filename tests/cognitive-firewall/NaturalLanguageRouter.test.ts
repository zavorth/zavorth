import { NaturalLanguageRouter } from '../../src/cognitive-firewall';

describe('NaturalLanguageRouter honest command contract', () => {
  const router = new NaturalLanguageRouter();

  it('does not pretend every natural intent maps to an internal slash command', () => {
    const route = router.route('list the src directory');

    expect(route.classified).toBe(true);
    expect(route.intentCategory).toBe('file_operation');
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
  });

  it('keeps trivial chat fast without suggesting a hidden command', () => {
    const route = router.route('hi');

    expect(route.intentCategory).toBe('conversation');
    expect(route.isTrivialChat).toBe(true);
    expect(route.useFastModel).toBe(true);
    expect(route.suggestedInternalCommand).toBeNull();
  });
});
