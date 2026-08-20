import { ZavorthEchoOrchestrator } from '../../src/tool-runtime/orchestrator/ZavorthEchoOrchestrator.js';
import { HomeAssistantBridge } from '../../src/tool-runtime/tools/iot/HomeAssistantBridge.js';

describe('ZavorthEchoOrchestrator', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('delegates standalone compatibility history to an explicit execution log store', () => {
    jest.spyOn(HomeAssistantBridge.prototype, 'startListeningEvents').mockImplementation(() => undefined);
    const append = jest.fn();
    const list = jest.fn(() => [{ id: 'exec-1' }]);
    const orchestrator = new ZavorthEchoOrchestrator({
      compatibilityLog: { append, list },
    });

    orchestrator.recordExecution({
      id: 'exec-1',
      timestamp: '2026-04-18T10:00:00.000Z',
      prompt: 'ligue a luz',
      llmRaw: null,
      toolCalls: [],
      finalResponse: 'ok',
      status: 'success',
      durationMs: 12,
    });

    expect(append).toHaveBeenCalledWith(expect.objectContaining({
      id: 'exec-1',
      prompt: 'ligue a luz',
    }));
    expect(orchestrator.getExecutionLog()).toEqual([{ id: 'exec-1' }]);
    expect(list).toHaveBeenCalledWith(undefined);
  });
});
