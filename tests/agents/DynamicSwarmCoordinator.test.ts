import { describe, it, expect, beforeEach } from '@jest/globals';
import { DynamicSwarmCoordinator } from '../../src/agents/DynamicSwarmCoordinator.js';
import { SessionPersistenceService } from '../../src/storage/SessionPersistenceService.js';

describe('DynamicSwarmCoordinator (On-Demand Multi-Agent Spawning)', () => {
  beforeEach(() => {
    SessionPersistenceService.resetForTesting();
  });

  it('should decompose simple analytical tasks into architect and QA specialists', () => {
    const plans = DynamicSwarmCoordinator.planSpecialists('Audit system performance and verify error logs');
    expect(plans.length).toBeGreaterThanOrEqual(2);
    expect(plans.some((p) => p.role.includes('Architect'))).toBe(true);
    expect(plans.some((p) => p.role.includes('Quality'))).toBe(true);
  });

  it('should decompose complex coding tasks into architect, coder, and QA specialists', () => {
    const plans = DynamicSwarmCoordinator.planSpecialists('Implement JWT authentication with secret rotation and refactor user model');
    expect(plans.length).toBeGreaterThanOrEqual(3);
    expect(plans.some((p) => p.role.includes('Architect'))).toBe(true);
    expect(plans.some((p) => p.role.includes('Implementation'))).toBe(true);
    expect(plans.some((p) => p.role.includes('Security'))).toBe(true);
    expect(plans.some((p) => p.role.includes('Quality'))).toBe(true);
  });

  it('should execute dynamic swarm and synthesize final report', async () => {
    const session = SessionPersistenceService.createSession({ title: 'Swarm Session' });
    const report = await DynamicSwarmCoordinator.executeTask('Refactor database indexes and verify schema', session.id);

    expect(report.taskId).toBeDefined();
    expect(report.status).toBe('success');
    expect(report.specialists.length).toBeGreaterThan(0);
    expect(report.selfHealing.passed).toBe(true);
    expect(report.finalSynthesis).toContain('Swarm Execution Completed');
  });
});
