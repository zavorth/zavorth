import { describe, it, expect } from '@jest/globals';
import { StackAwarePersonaEngine } from '../../../src/agents/swarm/StackAwarePersonaEngine.js';

describe('StackAwarePersonaEngine', () => {
  it('should detect TypeScript/Jest stack in the current project', () => {
    const stack = StackAwarePersonaEngine.detectTechStack(process.cwd());
    expect(stack.languages).toContain('TypeScript');
    expect(stack.hasStrictTyping).toBe(true);
    expect(stack.testRunners).toContain('Jest');
  });

  it('should generate stack-tailored specialists for general tasks', () => {
    const specialists = StackAwarePersonaEngine.generateSpecialists('Refactor data pipeline and optimize queries');
    expect(specialists.length).toBeGreaterThanOrEqual(3);
    expect(specialists[0].title).toContain('Architecture Planner');
    expect(specialists[1].title).toContain('Senior Engineer');
    expect(specialists[2].title).toContain('Verification Auditor');
  });

  it('should include Security Guardian when auth or credentials are in task', () => {
    const specialists = StackAwarePersonaEngine.generateSpecialists('Implement JWT authentication with token rotation guard');
    expect(specialists.some((s) => s.role.includes('Security'))).toBe(true);
  });
});
