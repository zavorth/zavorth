import { DynamicSystemPromptService } from '../../src/services/DynamicSystemPromptService';

describe('DynamicSystemPromptService', () => {
  const FULL_PROMPT = 'A'.repeat(60000); // ~15K tokens

  it('returns minimal prompt for conversation intent', () => {
    const service = new DynamicSystemPromptService();
    const result = service.getPrompt('conversation', FULL_PROMPT);

    expect(result.tier).toBe('minimal');
    expect(result.tokenEstimate).toBeLessThan(1000);
    expect(result.prompt).toContain('Zavorth');
  });

  it('returns standard prompt for information intent', () => {
    const service = new DynamicSystemPromptService();
    const result = service.getPrompt('information', FULL_PROMPT);

    expect(result.tier).toBe('standard');
    expect(result.tokenEstimate).toBeGreaterThan(50);
    expect(result.tokenEstimate).toBeLessThan(1000);
  });

  it('returns standard prompt for file_operation intent', () => {
    const service = new DynamicSystemPromptService();
    const result = service.getPrompt('file_operation', FULL_PROMPT);

    expect(result.tier).toBe('standard');
  });

  it('returns standard prompt for configuration intent', () => {
    const service = new DynamicSystemPromptService();
    const result = service.getPrompt('configuration', FULL_PROMPT);

    expect(result.tier).toBe('standard');
  });

  it('returns standard prompt for memory intent', () => {
    const service = new DynamicSystemPromptService();
    const result = service.getPrompt('memory', FULL_PROMPT);

    expect(result.tier).toBe('standard');
  });

  it('returns standard prompt for desktop intent', () => {
    const service = new DynamicSystemPromptService();
    const result = service.getPrompt('desktop', FULL_PROMPT);

    expect(result.tier).toBe('standard');
  });

  it('returns full prompt for execution intent', () => {
    const service = new DynamicSystemPromptService();
    const result = service.getPrompt('execution', FULL_PROMPT);

    expect(result.tier).toBe('full');
    expect(result.prompt).toBe(FULL_PROMPT);
  });

  it('returns full prompt for research intent', () => {
    const service = new DynamicSystemPromptService();
    const result = service.getPrompt('research', FULL_PROMPT);

    expect(result.tier).toBe('full');
    expect(result.prompt).toBe(FULL_PROMPT);
  });

  it('returns full prompt for full_toolset intent', () => {
    const service = new DynamicSystemPromptService();
    const result = service.getPrompt('full_toolset', FULL_PROMPT);

    expect(result.tier).toBe('full');
    expect(result.prompt).toBe(FULL_PROMPT);
  });

  it('token estimation is reasonable', () => {
    const service = new DynamicSystemPromptService();
    const shortPrompt = 'Hello world';
    const longPrompt = 'A'.repeat(4000);

    expect(service.calculateTokens(shortPrompt)).toBe(3); // 11 chars / 4 = 2.75 -> 3
    expect(service.calculateTokens(longPrompt)).toBe(1000); // 4000 / 4 = 1000
  });

  it('handles empty prompt', () => {
    const service = new DynamicSystemPromptService();
    expect(service.calculateTokens('')).toBe(0);
  });

  it('handles null intent gracefully', () => {
    const service = new DynamicSystemPromptService();
    const result = service.getPrompt(null, FULL_PROMPT);

    expect(result.tier).toBe('standard');
    expect(result.intentCategory).toBe('unknown');
  });

  it('handles undefined intent gracefully', () => {
    const service = new DynamicSystemPromptService();
    const result = service.getPrompt(undefined, FULL_PROMPT);

    expect(result.tier).toBe('standard');
    expect(result.intentCategory).toBe('unknown');
  });

  it('handles unknown intent category', () => {
    const service = new DynamicSystemPromptService();
    const result = service.getPrompt('unknown_category', FULL_PROMPT);

    expect(result.tier).toBe('standard');
  });

  it('minimal prompt is significantly smaller than full prompt', () => {
    const service = new DynamicSystemPromptService();
    const minimal = service.getPrompt('conversation', FULL_PROMPT);
    const full = service.getPrompt('execution', FULL_PROMPT);

    expect(minimal.tokenEstimate).toBeLessThan(full.tokenEstimate / 10);
  });

  it('returns correct metadata', () => {
    const service = new DynamicSystemPromptService();
    const result = service.getPrompt('research', FULL_PROMPT);

    expect(result).toHaveProperty('prompt');
    expect(result).toHaveProperty('tier');
    expect(result).toHaveProperty('tokenEstimate');
    expect(result).toHaveProperty('intentCategory');
    expect(result.intentCategory).toBe('research');
  });

  it('allows custom tier prompts', () => {
    const customMinimal = 'Custom minimal prompt';
    const service = new DynamicSystemPromptService({
      tierPrompts: { minimal: customMinimal },
    });
    const result = service.getPrompt('conversation', FULL_PROMPT);

    expect(result.prompt).toBe(customMinimal);
  });

  it('falls back to base prompt for full tier when custom not provided', () => {
    const service = new DynamicSystemPromptService();
    const customFull = 'Custom full prompt with all context';
    const result = service.getPrompt('execution', customFull);

    expect(result.prompt).toBe(customFull);
  });
});
