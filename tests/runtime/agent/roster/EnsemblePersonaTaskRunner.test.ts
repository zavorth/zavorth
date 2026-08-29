import { EnsemblePersonaTaskRunner } from '../../../../src/runtime/agent/roster/EnsemblePersonaTaskRunner.js';
import type { ZavorthEnsembleService } from '../../../../src/agents/ZavorthEnsembleService.js';
import type { LlmRuntimeService } from '../../../../src/services/llm/LlmRuntimeService.js';
import type { Persona } from '../../../../src/runtime/agent/roster/PersonaContract.js';

describe('EnsemblePersonaTaskRunner', () => {
  const basePersona: Persona = {
    id: 'sql-guru',
    name: 'SQL Guru',
    role: 'Database Specialist',
    avatar: 'database',
    systemPrompt: 'You are the SQL GURU. Optimize queries strictly.',
    isolationMode: 'direct',
    passiveInspectionEnabled: false,
    scheduleRoutines: [],
    createdAt: '2026-05-17T00:00:00.000Z',
    updatedAt: '2026-05-17T00:00:00.000Z',
  };

  function createMockEnsemble(overrides: Partial<ZavorthEnsembleService> = {}): ZavorthEnsembleService {
    return {
      launchSwarm: jest.fn(() => ({
        swarmId: 'swarm-test-1',
        status: 'running',
        objective: 'task prompt',
        roles: [],
        startedAt: new Date().toISOString(),
        finishedAt: null,
        synthesizedOutput: null,
      })),
      ...overrides,
    } as unknown as ZavorthEnsembleService;
  }

  it('delegates a persona task to the ensemble with the persona system prompt', async () => {
    const ensemble = createMockEnsemble();
    const runner = new EnsemblePersonaTaskRunner(ensemble);
    const result = await runner.runPersonaTask({
      persona: basePersona,
      prompt: 'Optimize the slow join in users table',
    });

    expect(result.ok).toBe(true);
    expect(result.output).toContain('swarm-test-1');
    const launch = (ensemble.launchSwarm as jest.Mock).mock.calls[0][0];
    expect(launch.objective).toBe('Optimize the slow join in users table');
    expect(launch.roles[0].id).toBe('sql-guru');
    expect(launch.roles[0].systemPrompt).toContain('SQL GURU');
  });

  it('honors isolated persona modes by forwarding isolation to the swarm role', async () => {
    const ensemble = createMockEnsemble();
    const runner = new EnsemblePersonaTaskRunner(ensemble);
    await runner.runPersonaTask({
      persona: { ...basePersona, isolationMode: 'docker' },
      prompt: 'Scrape pricing pages',
    });

    const launch = (ensemble.launchSwarm as jest.Mock).mock.calls[0][0];
    expect(launch.isolationMode).toBe('docker');
    expect(launch.roles[0].isolation.mode).toBe('docker');
  });

  it('falls back to direct isolation for trusted persona modes', async () => {
    const ensemble = createMockEnsemble();
    const runner = new EnsemblePersonaTaskRunner(ensemble);
    await runner.runPersonaTask({
      persona: basePersona,
      prompt: 'Write tests',
    });

    const launch = (ensemble.launchSwarm as jest.Mock).mock.calls[0][0];
    expect(launch.roles[0].isolation.mode).toBe('direct');
  });

  it('returns a typed failure when the prompt is empty', async () => {
    const ensemble = createMockEnsemble();
    const runner = new EnsemblePersonaTaskRunner(ensemble);
    const result = await runner.runPersonaTask({
      persona: basePersona,
      prompt: '   ',
    });

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/cannot be empty/);
    expect(ensemble.launchSwarm).not.toHaveBeenCalled();
  });

  it('returns a typed failure when the ensemble launch throws', async () => {
    const ensemble = createMockEnsemble({
      launchSwarm: jest.fn(() => { throw new Error('no roles'); }),
    });
    const runner = new EnsemblePersonaTaskRunner(ensemble);
    const result = await runner.runPersonaTask({
      persona: basePersona,
      prompt: 'Run heavy migration',
    });

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/no roles/);
  });

  describe('llm runtime path', () => {
    function createMockLlmRuntime(overrides: Partial<Pick<LlmRuntimeService, 'chatDetailed'>> = {}): Pick<LlmRuntimeService, 'chatDetailed'> {
      return {
        chatDetailed: jest.fn().mockResolvedValue({
          providerName: 'test-provider',
          modelName: 'test-model',
          response: { content: 'Optimized query plan delivered.', toolCalls: [], finishReason: 'stop' },
          route: { source: 'LlmRuntimeService' },
        }),
        ...overrides,
      };
    }

    it('dispatches through chatDetailed with the persona system prompt and telemetry', async () => {
      const llmRuntime = createMockLlmRuntime();
      const ensemble = createMockEnsemble();
      const runner = new EnsemblePersonaTaskRunner(ensemble, llmRuntime);
      const result = await runner.runPersonaTask({
        persona: basePersona,
        prompt: 'Optimize the slow join in users table',
        sessionId: 'session-1',
      });

      expect(result.ok).toBe(true);
      expect(result.output).toBe('Optimized query plan delivered.');
      expect(ensemble.launchSwarm).not.toHaveBeenCalled();
      const [messages, tools, options] = (llmRuntime.chatDetailed as jest.Mock).mock.calls[0];
      expect(messages[0]).toEqual({ role: 'system', content: basePersona.systemPrompt });
      expect(messages[1]).toEqual({ role: 'user', content: 'Optimize the slow join in users table' });
      expect(tools).toEqual([]);
      expect(options.telemetry).toMatchObject({
        surface: 'persona-task-runner',
        runId: 'persona:sql-guru',
        sessionId: 'session-1',
      });
    });

    it('returns an honest typed error when the LLM dispatch fails without falling back to the swarm', async () => {
      const llmRuntime = createMockLlmRuntime({
        chatDetailed: jest.fn().mockRejectedValue(new Error('No provider selected.')),
      });
      const ensemble = createMockEnsemble();
      const runner = new EnsemblePersonaTaskRunner(ensemble, llmRuntime);
      const result = await runner.runPersonaTask({
        persona: basePersona,
        prompt: 'Optimize the slow join',
      });

      expect(result.ok).toBe(false);
      expect(result.error).toContain('LLM dispatch failed');
      expect(result.error).toContain('No provider selected.');
      expect(ensemble.launchSwarm).not.toHaveBeenCalled();
    });

    it('returns a typed failure when the LLM returns an empty response', async () => {
      const llmRuntime = createMockLlmRuntime({
        chatDetailed: jest.fn().mockResolvedValue({
          providerName: 'test-provider',
          modelName: 'test-model',
          response: { content: null, toolCalls: [], finishReason: 'stop' },
          route: { source: 'LlmRuntimeService' },
        }),
      });
      const runner = new EnsemblePersonaTaskRunner(createMockEnsemble(), llmRuntime);
      const result = await runner.runPersonaTask({
        persona: basePersona,
        prompt: 'Optimize the slow join',
      });

      expect(result.ok).toBe(false);
      expect(result.error).toMatch(/empty LLM response/);
    });
  });
});
