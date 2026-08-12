import { ExecutionIntentClassifierService } from '../../src/services/ExecutionIntentClassifierService';

describe('ExecutionIntentClassifierService', () => {
  it('respects explicit task profile hints and planner mode', () => {
    const service = new ExecutionIntentClassifierService();

    const result = service.classify({
      text: 'gere um plano tecnico para revisar o modulo',
      taskKind: 'code',
      taskSubtype: 'review',
      modeHint: 'planner',
    });

    expect(result).toEqual(
      expect.objectContaining({
        taskKind: 'code',
        taskSubtype: 'review',
        responseStyle: 'findings_first',
        executionRoute: 'planner.structured',
        confidence: 'high',
      }),
    );
    expect(result.rationale[0]).toContain('Classificacao explicita');
  });

  it('infers automation/browser tasks from text when there is no explicit profile', () => {
    const service = new ExecutionIntentClassifierService();

    const result = service.classify({
      text: 'abra o browser, inspecione o console e tire uma screenshot da pagina',
      modeHint: 'graph',
    });

    expect(result).toEqual(
      expect.objectContaining({
        taskKind: 'automation',
        executionRoute: 'graph.automation',
      }),
    );
    expect(result.confidence).toBe('medium');
  });
});
