import { describe, it, expect } from '@jest/globals';
import { DynamicSwarmPlanner } from '../../src/agents/DynamicSwarmPlanner.js';

describe('DynamicSwarmPlanner (Planning-Only Multi-Agent Decomposition)', () => {
  it('should decompose simple analytical tasks into architect and QA specialists', () => {
    const plans = DynamicSwarmPlanner.planSpecialists('Audit system performance and verify error logs');
    expect(plans.length).toBeGreaterThanOrEqual(2);
    expect(plans.some((p) => p.role.includes('Architect'))).toBe(true);
    expect(plans.some((p) => p.role.includes('Quality'))).toBe(true);
  });

  it('should decompose complex coding tasks into architect, coder, and QA specialists', () => {
    const plans = DynamicSwarmPlanner.planSpecialists('Implement JWT authentication with secret rotation and refactor user model');
    expect(plans.length).toBeGreaterThanOrEqual(3);
    expect(plans.some((p) => p.role.includes('Architect'))).toBe(true);
    expect(plans.some((p) => p.role.includes('Implementation'))).toBe(true);
    expect(plans.some((p) => p.role.includes('Security'))).toBe(true);
    expect(plans.some((p) => p.role.includes('Quality'))).toBe(true);
  });

  it('should build execution plan with honest planning-only semantics', () => {
    const plan = DynamicSwarmPlanner.buildExecutionPlan('Refactor database indexes and verify schema');

    expect(plan.planId).toBeDefined();
    expect(plan.planId).toMatch(/^plan_/);
    expect(plan.specialists.length).toBeGreaterThan(0);
    expect(plan.treeView).toBeDefined();
    expect(plan.estimatedTokens).toBeGreaterThan(0);
    expect(plan.estimatedCostUsd).toBeGreaterThanOrEqual(0);
    expect(plan.note).toContain('Planning-only output');
  });
});
