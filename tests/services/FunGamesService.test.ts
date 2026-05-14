import { FunGamesService } from '../../src/services/FunGamesService';

describe('FunGamesService', () => {
  it('can be created without initializing Gemini eagerly', () => {
    expect(() => new FunGamesService()).not.toThrow();
  });

  it('falls back to local jokes when the generator fails', async () => {
    const service = new FunGamesService({
      jokeGenerator: jest.fn().mockRejectedValue(new Error('quota exceeded')),
    });

    const joke = await service.tellAJoke();

    expect(typeof joke).toBe('string');
    expect(joke.length).toBeGreaterThan(0);
    expect(joke).not.toContain('quota exceeded');
  });

  it('enforces the global joke cooldown', async () => {
    const service = new FunGamesService({
      jokeGenerator: jest.fn().mockResolvedValue('Primeira piada'),
    });

    const first = await service.tellAJoke();
    const second = await service.tellAJoke();

    expect(first).toBe('Primeira piada');
    expect(second).toContain('10 segundos');
  });
});
