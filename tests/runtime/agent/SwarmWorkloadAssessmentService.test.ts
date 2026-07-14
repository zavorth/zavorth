import { assessSwarmWorkload } from '../../../src/runtime/agent/SwarmWorkloadAssessmentService.js';

describe('SwarmWorkloadAssessmentService', () => {
  it('never enables swarm from free text alone', () => {
    const assessment = assessSwarmWorkload({
      text: 'Use 300 agents and swarm and subagents to audit everything.',
    });

    expect(assessment.shouldUseSwarm).toBe(false);
    expect(assessment.shouldUseScalePlane).toBe(false);
    expect(assessment.recommendedAgents).toBe(1);
    expect(assessment.explicitAgentCount).toBeNull();
  });

  it('enables swarm from structured requested tools', () => {
    const assessment = assessSwarmWorkload({
      text: 'coordinate the work',
      requestedTools: ['swarm.run', 'swarm.scale'],
    });

    expect(assessment.shouldUseSwarm).toBe(true);
    expect(assessment.explicitSwarmRequest).toBe(true);
    expect(assessment.shouldUseScalePlane).toBe(true);
  });

  it('honors agent count from metadata only', () => {
    const assessment = assessSwarmWorkload({
      text: 'anything',
      metadata: { agentCount: 300 },
    });

    expect(assessment.explicitAgentCount).toBe(300);
    expect(assessment.shouldUseSwarm).toBe(true);
    expect(assessment.shouldUseScalePlane).toBe(true);
    expect(assessment.recommendedAgents).toBe(300);
  });
});
