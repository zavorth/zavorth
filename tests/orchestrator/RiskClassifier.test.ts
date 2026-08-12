import { RiskClassifier } from '../../src/orchestrator/RiskClassifier';

describe('RiskClassifier', () => {
  const classifier = new RiskClassifier();

  it('eleva risco de /task auto-roteada para Codex', () => {
    const result = classifier.classify(
      {
        command_type: '/task',
        command_args: 'corrija o bug no arquivo principal',
        normalized_message: 'corrija o bug no arquivo principal',
        explicit_executor: null,
        references_last_task: false,
      },
      {
        intent: 'code_execution',
        target: null,
        workspace_hint: 'C:/workspace',
        requires_planning: false,
        executor_preference: 'codex',
        dispatch_mode: 'execution',
      },
    );

    expect(result.risk_level).toBe(2);
    expect(result.reason).toContain('Codex');
  });

  it('mantem risco leve para /task auto-roteada para AI Studio', () => {
    const result = classifier.classify(
      {
        command_type: '/task',
        command_args: 'pesquise as noticias de tecnologia de hoje',
        normalized_message: 'pesquise as noticias de tecnologia de hoje',
        explicit_executor: null,
        references_last_task: false,
      },
      {
        intent: 'research_and_generation',
        target: null,
        workspace_hint: 'C:/workspace',
        requires_planning: false,
        executor_preference: 'aistudio',
        dispatch_mode: 'execution',
      },
    );

    expect(result.risk_level).toBe(1);
    expect(result.requires_approval).toBe(false);
  });
});
