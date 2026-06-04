import { assessSwarmWorkload } from '../../../src/runtime/agent/SwarmWorkloadAssessmentService.js';

describe('SwarmWorkloadAssessmentService', () => {
  it('does not treat competitor/model names as scale triggers by themselves', () => {
    const assessment = assessSwarmWorkload({
      text: 'Explique brevemente o que um modelo concorrente faz.',
    });

    expect(assessment.shouldUseSwarm).toBe(false);
    expect(assessment.shouldUseScalePlane).toBe(false);
    expect(assessment.recommendedAgents).toBe(1);
  });

  it('selects scale plane from workload scope and validation needs', () => {
    const assessment = assessSwarmWorkload({
      text: 'Analise todo o Zavorth, todos os modulos do dashboard, CLI, runtime, providers e canais; faca auditoria profunda de arquitetura, seguranca, DDD, testes e riscos com validacao completa.',
    });

    expect(assessment.shouldUseSwarm).toBe(true);
    expect(assessment.shouldUseScalePlane).toBe(true);
    expect(assessment.band).toMatch(/large|massive/);
    expect(assessment.recommendedAgents).toBeGreaterThanOrEqual(40);
    expect(assessment.reasons.join(' ')).toContain('escopo');
  });

  it('honors explicit agent counts only when the user asks for agents/workers', () => {
    const plainNumber = assessSwarmWorkload({
      text: 'Leia a porta 3000 e me diga se o dashboard abre.',
    });
    const explicitAgents = assessSwarmWorkload({
      text: 'Use 300 agentes para auditar os providers e canais.',
    });

    expect(plainNumber.explicitAgentCount).toBeNull();
    expect(plainNumber.shouldUseScalePlane).toBe(false);
    expect(explicitAgents.explicitAgentCount).toBe(300);
    expect(explicitAgents.shouldUseScalePlane).toBe(true);
    expect(explicitAgents.recommendedAgents).toBe(300);
  });
});
