import { RiskClassifier } from '../../src/orchestrator/RiskClassifier';

describe('RiskClassifier', () => {
  const classifier = new RiskClassifier();

  it('raises risk for /task auto-routed to Codex', () => {
    const result = classifier.classify(
      {
        command_type: '/task',
        command_args: 'corrija o bug no file principal',
        normalized_message: 'corrija o bug no file principal',
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

  it('keeps low risk for /task auto-routed to AI Studio', () => {
    const result = classifier.classify(
      {
        command_type: '/task',
        command_args: 'research today technology news',
        normalized_message: 'research today technology news',
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
