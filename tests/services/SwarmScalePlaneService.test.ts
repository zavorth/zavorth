import fs from 'fs';
import os from 'os';
import path from 'path';
import { SwarmScalePlaneService } from '../../src/domain/execution/infrastructure/SwarmScalePlaneService.js';

describe('SwarmScalePlaneService', () => {
  it('runs a dynamic 4000-agent deterministic swarm inside the global step ledger', async () => {
    const service = new SwarmScalePlaneService({
      stateFilePath: null,
      now: steadyClock(),
    });

    const snapshot = await service.launch({
      objective: 'Run a Zavorth-native large-scale audit with deterministic workers.',
      desiredAgents: 4000,
      maxAgents: 4000,
      maxSteps: 4000,
      maxConcurrency: 256,
      persistState: false,
    });

    expect(snapshot.status).toBe('completed');
    expect(snapshot.planner.plannedAgents).toBe(4000);
    expect(snapshot.metrics.completedAgents).toBe(4000);
    expect(snapshot.metrics.failedAgents).toBe(0);
    expect(snapshot.ledger.usedSteps).toBe(4000);
    expect(snapshot.workerPool.actualMaxConcurrency).toBe(256);
    expect(snapshot.reducer.status).toBe('ready');
    expect(snapshot.cooperationContract.reducerOwnsMerge).toBe(true);
  });

  it('pauses and resumes a durable scale run without losing queued agents', async () => {
    const fixture = createFixture();
    try {
      const service = new SwarmScalePlaneService({
        stateFilePath: fixture.stateFile,
        now: steadyClock(),
      });

      const paused = await service.launch({
        objective: 'Pause after a small number of steps.',
        desiredAgents: 20,
        maxSteps: 50,
        maxConcurrency: 5,
        stopAfterSteps: 10,
        persistState: true,
      });

      expect(paused.status).toBe('paused');
      expect(paused.ledger.usedSteps).toBe(10);
      expect(paused.metrics.completedAgents).toBe(10);
      expect(paused.metrics.queuedAgents).toBe(10);
      expect(fs.existsSync(fixture.stateFile)).toBe(true);

      const resumed = await service.resume({
        runId: paused.runId,
        persistState: true,
      });

      expect(resumed.status).toBe('completed');
      expect(resumed.metrics.completedAgents).toBe(20);
      expect(resumed.ledger.usedSteps).toBe(21);
      expect(resumed.reducer.synthesis).toContain('20/20');
    } finally {
      fs.rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  it('uses an LLM planner and live LLM workers when a runtime is attached', async () => {
    const calls: Array<{ messages: unknown[]; tools: unknown[]; options: Record<string, unknown> }> = [];
    const llmRuntime = {
      chatDetailed: jest.fn(async (messages: unknown[], tools: unknown[], options: Record<string, unknown>) => {
        calls.push({ messages, tools, options });
        const telemetry = options.telemetry as { kind-: string; agentId-: string } | undefined;
        if (telemetry?.kind === 'planner') {
          return {
            response: {
              content: JSON.stringify({
                lanes: [
                  { lane: 'researcher', title: 'Research shard', instruction: 'Collect evidence.' },
                  { lane: 'verifier', title: 'Verify shard', instruction: 'Check contradictions.' },
                ],
              }),
            },
            providerName: 'fake',
            modelName: 'planner',
            route: { fallbackUsed: false, attempts: [] },
          };
        }
        return {
          response: {
            content: `Findings:\n- ${telemetry?.agentId || 'agent'} live result.\nRisks:\n- none.\nRecommended next step:\n- reduce.`,
          },
          providerName: 'fake',
          modelName: 'worker',
          route: { fallbackUsed: false, attempts: [] },
        };
      }),
    };
    const service = new SwarmScalePlaneService({
      stateFilePath: null,
      llmRuntime,
      now: steadyClock(),
    });

    const snapshot = await service.launch({
      objective: 'Use LLM live workers.',
      desiredAgents: 4,
      maxSteps: 12,
      maxConcurrency: 2,
      plannerMode: 'llm',
      executionMode: 'llm-live',
      persistState: false,
    });

    expect(snapshot.status).toBe('completed');
    expect(snapshot.planner.mode).toBe('llm');
    expect(snapshot.workerPool.mode).toBe('llm-live');
    expect(snapshot.metrics.completedAgents).toBe(4);
    expect(snapshot.agents.map((agent) => agent.lane)).toEqual(['researcher', 'verifier', 'researcher', 'verifier']);
    expect(llmRuntime.chatDetailed).toHaveBeenCalledTimes(5);
    expect(calls.some((call) => (call.options.telemetry as any)?.surface === 'swarm-scale-plane')).toBe(true);
  });

  it('runs custom real workers concurrently and reports reducer conflicts', async () => {
    let active = 0;
    let maxActive = 0;
    const service = new SwarmScalePlaneService({
      stateFilePath: null,
      now: steadyClock(),
      worker: async ({ task, reserveStep }) => {
        active += 1;
        maxActive = Math.max(maxActive, active);
        const step = reserveStep('agent_execution', `${task.agentId} custom worker`);
        expect(step).not.toBeNull();
        await Promise.resolve();
        active -= 1;
        return {
          output: `CONFLICT: shared-artifact\nvalue=${task.index % 2}`,
          summary: `${task.agentId} custom result`,
          conflictKey: 'shared-artifact',
          metadata: { custom: true },
        };
      },
    });

    const snapshot = await service.launch({
      objective: 'Detect conflicting custom worker outputs.',
      desiredAgents: 6,
      maxSteps: 12,
      maxConcurrency: 3,
      executionMode: 'custom',
      persistState: false,
    });

    expect(snapshot.status).toBe('completed');
    expect(maxActive).toBe(3);
    expect(snapshot.workerPool.actualMaxConcurrency).toBe(3);
    expect(snapshot.reducer.conflictCount).toBe(1);
    expect(snapshot.reducer.conflicts[0]?.agentIds).toHaveLength(6);
  });
});

function createFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-swarm-scale-'));
  return {
    root,
    stateFile: path.join(root, 'state.json'),
  };
}

function steadyClock() {
  let tick = 0;
  return () => new Date(Date.UTC(2026, 5, 1, 12, 0, tick++));
}
