import { LoopEngineeringService } from '../../src/services/LoopEngineeringService.js';
import { LlmRuntimeService } from '../../src/services/llm/LlmRuntimeService.js';

describe('LoopEngineeringService', () => {
  let llmSpy: jest.SpyInstance;
  let service: LoopEngineeringService;
  const sessionId = 'test-session-id';

  beforeEach(() => {
    service = new LoopEngineeringService();
    llmSpy = jest.spyOn(LlmRuntimeService.prototype, 'chat');
  });

  afterEach(async () => {
    llmSpy.mockRestore();
    await service.clearSessionState(sessionId);
  });

  it('correctly transitions state machine for automatic loop', async () => {
    llmSpy.mockImplementation(async (messages: any[]) => {
      const prompt = messages[messages.length - 1].content || '';
      if (prompt.includes('Você é um Engenheiro de QA especialista')) {
        return {
          content: JSON.stringify({
            criteria: ['C1: syntax', 'C2: logic', 'C3: output'],
          }),
          toolCalls: [],
          finishReason: 'stop',
        };
      }
      if (prompt.includes('Você é um Desenvolvedor de Software especialista')) {
        return {
          content: '```javascript\nconsole.log("hello test");\n```',
          toolCalls: [],
          finishReason: 'stop',
        };
      }
      if (prompt.includes('Você é um Juiz de Código especialista')) {
        return {
          content: JSON.stringify({
            notas: { criterio1: 9, criterio2: 9, criterio3: 9 },
            media: 9.0,
            ponto_mais_fraco: 'criterio2',
            critica_construtiva: 'None',
          }),
          toolCalls: [],
          finishReason: 'stop',
        };
      }
      if (prompt.includes('Você é um Engenheiro de Software')) {
        return {
          content: 'Diff plan description',
          toolCalls: [],
          finishReason: 'stop',
        };
      }
      return { content: '', toolCalls: [], finishReason: 'stop' };
    });

    const initResult = await service.initiateLoop(sessionId, 'Test Task', { auto: true });
    expect(initResult).toContain('Loop de Engenharia Finalizado');
    expect(initResult).toContain('criterio1');
    expect(initResult).toContain('Diff plan description');

    const state = await service.getSessionState(sessionId);
    expect(state.status).toBe('IDLE');
  });

  it('correctly transitions state machine for guided loop', async () => {
    llmSpy.mockImplementation(async (messages: any[]) => {
      const prompt = messages[messages.length - 1].content || '';
      if (prompt.includes('Você é um Engenheiro de Requisitos especialista')) {
        return {
          content: JSON.stringify(['Questão A', 'Questão B']),
          toolCalls: [],
          finishReason: 'stop',
        };
      }
      if (prompt.includes('Você é um Engenheiro de QA especialista')) {
        return {
          content: JSON.stringify({
            criteria: ['C1: syntax', 'C2: logic', 'C3: output'],
          }),
          toolCalls: [],
          finishReason: 'stop',
        };
      }
      if (prompt.includes('Você é um Desenvolvedor de Software especialista')) {
        return {
          content: '```javascript\nconsole.log("hello guided");\n```',
          toolCalls: [],
          finishReason: 'stop',
        };
      }
      if (prompt.includes('Você é um Juiz de Código especialista')) {
        return {
          content: JSON.stringify({
            notas: { criterio1: 8, criterio2: 8, criterio3: 8 },
            media: 8.0,
            ponto_mais_fraco: 'criterio1',
            critica_construtiva: 'Fine',
          }),
          toolCalls: [],
          finishReason: 'stop',
        };
      }
      if (prompt.includes('Você é um Engenheiro de Software')) {
        return {
          content: 'Guided diff plan',
          toolCalls: [],
          finishReason: 'stop',
        };
      }
      return { content: '', toolCalls: [], finishReason: 'stop' };
    });

    const initResult = await service.initiateLoop(sessionId, 'Guided Task');
    expect(initResult).toContain('Selecione o modo de execução');

    let state = await service.getSessionState(sessionId);
    expect(state.status).toBe('WAITING_FOR_LOOP_MODE');

    // Select mode 2 (grill)
    const grillStart = await service.processInput(sessionId, 'user-1', '2');
    expect(grillStart).toContain('Iniciando perguntas');
    expect(grillStart).toContain('Questão A');

    state = await service.getSessionState(sessionId);
    expect(state.status).toBe('GRILLING');
    expect(state.grillState?.currentQuestionIndex).toBe(0);

    // Answer Question A
    const nextQuestion = await service.processInput(sessionId, 'user-1', 'Answer A');
    expect(nextQuestion).toContain('Question 2');
    expect(nextQuestion).toContain('Questão B');

    state = await service.getSessionState(sessionId);
    expect(state.status).toBe('GRILLING');
    expect(state.grillState?.currentQuestionIndex).toBe(1);

    // Answer Question B -> triggers execution loop
    const finalResult = await service.processInput(sessionId, 'user-1', 'Answer B');
    expect(finalResult).toContain('Loop de Engenharia Finalizado');
    expect(finalResult).toContain('Guided diff plan');

    state = await service.getSessionState(sessionId);
    expect(state.status).toBe('IDLE');
  });

  it('respects the maximum 5 iterations stopping condition', async () => {
    let judgeCallCount = 0;
    llmSpy.mockImplementation(async (messages: any[]) => {
      const prompt = messages[messages.length - 1].content || '';
      if (prompt.includes('Você é um Engenheiro de QA especialista')) {
        return {
          content: JSON.stringify({
            criteria: ['C1: syntax', 'C2: logic', 'C3: output'],
          }),
          toolCalls: [],
          finishReason: 'stop',
        };
      }
      if (prompt.includes('Você é um Desenvolvedor de Software especialista')) {
        return {
          content: 'console.log("iteration");',
          toolCalls: [],
          finishReason: 'stop',
        };
      }
      if (prompt.includes('Você é um Juiz de Código especialista')) {
        judgeCallCount++;
        return {
          content: JSON.stringify({
            notas: { criterio1: 5, criterio2: 5, criterio3: 5 },
            media: 5.0,
            ponto_mais_fraco: 'criterio2',
            critica_construtiva: 'Keep trying',
          }),
          toolCalls: [],
          finishReason: 'stop',
        };
      }
      if (prompt.includes('Você é um Engenheiro de Software')) {
        return {
          content: 'Diff plan',
          toolCalls: [],
          finishReason: 'stop',
        };
      }
      return { content: '', toolCalls: [], finishReason: 'stop' };
    });

    const result = await service.runAutoLoop(sessionId, 'user-1', 'Infinite Task');
    expect(judgeCallCount).toBe(5);
    expect(result).toContain('Loop de Engenharia Finalizado');
    expect(result).toContain('Iteração 5: Média 5.00');
  });
});
