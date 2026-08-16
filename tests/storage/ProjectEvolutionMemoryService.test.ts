import { describe, it, expect, beforeEach } from '@jest/globals';
import { ProjectEvolutionMemoryService } from '../../src/storage/ProjectEvolutionMemoryService.js';

describe('ProjectEvolutionMemoryService', () => {
  beforeEach(() => {
    ProjectEvolutionMemoryService.clearRules();
  });

  it('should list baseline clean-code rules on init', () => {
    const rules = ProjectEvolutionMemoryService.listRules();
    expect(rules.length).toBeGreaterThanOrEqual(2);
    expect(rules.some((r) => r.rule.includes('SOLID'))).toBe(true);
  });

  it('should add and format project-specific learned rules', () => {
    const added = ProjectEvolutionMemoryService.addRule('code_style', 'Prefer pure functions and immutability across all reducers');
    expect(added.id).toBeDefined();
    expect(added.category).toBe('code_style');

    const promptContext = ProjectEvolutionMemoryService.getSystemPromptMemoryContext();
    expect(promptContext).toContain('Prefer pure functions and immutability');
  });
});
