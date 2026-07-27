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
      if (prompt.includes('You are a specialist QA Engineer')) {
        return {
          content: JSON.stringify({
            criteria: ['C1: syntax', 'C2: logic', 'C3: output'],
          }),
          toolCalls: [],
          finishReason: 'stop',
        };
      }
      if (prompt.includes('You are a specialist Software Developer')) {
        return {
          content: '```javascript\nconsole.log("hello test");\n```',
          toolCalls: [],
          finishReason: 'stop',
        };
      }
      if (prompt.includes('You are a specialist Code Judge')) {
        return {
          content: JSON.stringify({
            grades: { criterio1: 9, criterio2: 9, criterio3: 9 },
            average: 9.0,
            weakPoint: 'criterio2',
            critique: 'None',
          }),
          toolCalls: [],
          finishReason: 'stop',
        };
      }
      if (prompt.includes('You are a Software Engineer')) {
        return {
          content: 'Diff plan description',
          toolCalls: [],
          finishReason: 'stop',
        };
      }
      return { content: '', toolCalls: [], finishReason: 'stop' };
    });

    const initResult = await service.initiateLoop(sessionId, 'Test Task', { auto: true });
    expect(initResult).toContain('Engineering Loop Finished');
    expect(initResult).toContain('criterio1');
    expect(initResult).toContain('Diff plan description');

    const state = await service.getSessionState(sessionId);
    expect(state.status).toBe('IDLE');
  });

  it('correctly transitions state machine for guided loop', async () => {
    llmSpy.mockImplementation(async (messages: any[]) => {
      const prompt = messages[messages.length - 1].content || '';
      if (prompt.includes('You are a specialist Requirements Engineer')) {
        return {
          content: JSON.stringify(['Question A', 'Question B']),
          toolCalls: [],
          finishReason: 'stop',
        };
      }
      if (prompt.includes('You are a specialist QA Engineer')) {
        return {
          content: JSON.stringify({
            criteria: ['C1: syntax', 'C2: logic', 'C3: output'],
          }),
          toolCalls: [],
          finishReason: 'stop',
        };
      }
      if (prompt.includes('You are a specialist Software Developer')) {
        return {
          content: '```javascript\nconsole.log("hello guided");\n```',
          toolCalls: [],
          finishReason: 'stop',
        };
      }
      if (prompt.includes('You are a specialist Code Judge')) {
        return {
          content: JSON.stringify({
            grades: { criterio1: 8, criterio2: 8, criterio3: 8 },
            average: 8.0,
            weakPoint: 'criterio1',
            critique: 'Fine',
          }),
          toolCalls: [],
          finishReason: 'stop',
        };
      }
      if (prompt.includes('You are a Software Engineer')) {
        return {
          content: 'Guided diff plan',
          toolCalls: [],
          finishReason: 'stop',
        };
      }
      return { content: '', toolCalls: [], finishReason: 'stop' };
    });

    const initResult = await service.initiateLoop(sessionId, 'Guided Task');
    expect(initResult).toContain('Select the execution mode');

    let state = await service.getSessionState(sessionId);
    expect(state.status).toBe('WAITING_FOR_LOOP_MODE');

    // Select mode 2 (grill)
    const grillStart = await service.processInput(sessionId, 'user-1', '2');
    expect(grillStart).toContain('Starting questions');
    expect(grillStart).toContain('Question A');

    state = await service.getSessionState(sessionId);
    expect(state.status).toBe('GRILLING');
    expect(state.grillState?.currentQuestionIndex).toBe(0);

    // Answer Question A
    const nextQuestion = await service.processInput(sessionId, 'user-1', 'Answer A');
    expect(nextQuestion).toContain('Question 2');
    expect(nextQuestion).toContain('Question B');

    state = await service.getSessionState(sessionId);
    expect(state.status).toBe('GRILLING');
    expect(state.grillState?.currentQuestionIndex).toBe(1);

    // Answer Question B -> triggers execution loop
    const finalResult = await service.processInput(sessionId, 'user-1', 'Answer B');
    expect(finalResult).toContain('Engineering Loop Finished');
    expect(finalResult).toContain('Guided diff plan');

    state = await service.getSessionState(sessionId);
    expect(state.status).toBe('IDLE');
  });

  it('respects the maximum 5 iterations stopping condition', async () => {
    let judgeCallCount = 0;
    llmSpy.mockImplementation(async (messages: any[]) => {
      const prompt = messages[messages.length - 1].content || '';
      if (prompt.includes('You are a specialist QA Engineer')) {
        return {
          content: JSON.stringify({
            criteria: ['C1: syntax', 'C2: logic', 'C3: output'],
          }),
          toolCalls: [],
          finishReason: 'stop',
        };
      }
      if (prompt.includes('You are a specialist Software Developer')) {
        return {
          content: 'console.log("iteration");',
          toolCalls: [],
          finishReason: 'stop',
        };
      }
      if (prompt.includes('You are a specialist Code Judge')) {
        judgeCallCount++;
        return {
          content: JSON.stringify({
            grades: { criterio1: 5, criterio2: 5, criterio3: 5 },
            average: 5.0,
            weakPoint: 'criterio2',
            critique: 'Keep trying',
          }),
          toolCalls: [],
          finishReason: 'stop',
        };
      }
      if (prompt.includes('You are a Software Engineer')) {
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
    expect(result).toContain('Engineering Loop Finished');
    expect(result).toContain('Iteration 5: Average 5.00');
  });
});
