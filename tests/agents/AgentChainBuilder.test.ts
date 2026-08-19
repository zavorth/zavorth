import { AgentChainBuilder, type AgentChainConfig, type AgentChainExecutor } from '../../src/agents/AgentChainBuilder';

function createMockExecutor(overrides: Partial<AgentChainExecutor> = {}): AgentChainExecutor {
  return {
    executeAgent: overrides.executeAgent || (async (_agentId: string, prompt: string) => `Agent output for: ${prompt}`),
    executeLocal: overrides.executeLocal || (async (command: string) => `Local output for: ${command}`),
  };
}

describe('AgentChainBuilder', () => {
  describe('buildChain', () => {
    it('creates a pending chain from config', () => {
      const builder = new AgentChainBuilder();
      const config: AgentChainConfig = {
        name: 'test-chain',
        steps: [
          { id: 's1', kind: 'agent', prompt: 'hello' },
          { id: 's2', kind: 'local', prompt: 'world' },
        ],
      };
      const chain = builder.buildChain(config);
      expect(chain.name).toBe('test-chain');
      expect(chain.status).toBe('pending');
      expect(chain.steps).toHaveLength(2);
      expect(chain.steps[0].stepId).toBe('s1');
      expect(chain.steps[0].status).toBe('skipped');
    });

    it('generates chain id when not provided', () => {
      const builder = new AgentChainBuilder();
      const chain = builder.buildChain({ steps: [{ id: 's1', kind: 'agent', prompt: 'test' }] });
      expect(chain.chainId).toBeTruthy();
      expect(typeof chain.chainId).toBe('string');
    });
  });

  describe('executeChain', () => {
    it('executes steps sequentially', async () => {
      const executor = createMockExecutor({
        executeAgent: async (_agentId: string, prompt: string) => `Response: ${prompt}`,
      });
      const builder = new AgentChainBuilder({ executor });
      const config: AgentChainConfig = {
        name: 'sequential-chain',
        steps: [
          { id: 'step1', kind: 'agent', agent: 'claude', prompt: 'Analyze code' },
          { id: 'step2', kind: 'agent', agent: 'codex', prompt: 'Fix issues based on ${step1.output}' },
        ],
      };
      const result = await builder.executeChain(config);
      expect(result.status).toBe('completed');
      expect(result.successCount).toBe(2);
      expect(result.failureCount).toBe(0);
      expect(result.steps[0].output).toContain('Analyze code');
      expect(result.steps[1].output).toContain('Fix issues based on Response: Analyze code');
    });

    it('uses fallback when primary agent fails', async () => {
      let callCount = 0;
      const executor = createMockExecutor({
        executeAgent: async (agentId: string, _prompt: string) => {
          callCount++;
          if (agentId === 'unreliable-agent') {
            throw new Error('Agent unavailable');
          }
          return `Success from ${agentId}`;
        },
      });
      const builder = new AgentChainBuilder({ executor });
      const config: AgentChainConfig = {
        steps: [
          { id: 's1', kind: 'agent', agent: 'unreliable-agent', prompt: 'Do something', fallback: 'reliable-agent' },
        ],
      };
      const result = await builder.executeChain(config);
      expect(result.status).toBe('completed');
      expect(result.fallbackCount).toBe(1);
      expect(result.steps[0].status).toBe('fallback');
      expect(result.steps[0].fallbackUsed).toBe('reliable-agent');
      expect(callCount).toBe(2);
    });

    it('retries on failure before fallback', async () => {
      let attempts = 0;
      const executor = createMockExecutor({
        executeAgent: async (agentId: string, _prompt: string) => {
          attempts++;
          if (agentId === 'flaky-agent' && attempts < 3) {
            throw new Error('Temporary failure');
          }
          return `Success on attempt ${attempts}`;
        },
      });
      const builder = new AgentChainBuilder({ executor });
      const config: AgentChainConfig = {
        steps: [
          { id: 's1', kind: 'agent', agent: 'flaky-agent', prompt: 'Work', retries: 2 },
        ],
      };
      const result = await builder.executeChain(config);
      expect(result.status).toBe('completed');
      expect(result.steps[0].retryCount).toBe(2);
      expect(attempts).toBe(3);
    });

    it('stops on error by default', async () => {
      const executor = createMockExecutor({
        executeAgent: async (agentId: string) => {
          if (agentId === 'fail-agent') throw new Error('Failed');
          return 'ok';
        },
      });
      const builder = new AgentChainBuilder({ executor });
      const config: AgentChainConfig = {
        steps: [
          { id: 's1', kind: 'agent', agent: 'fail-agent', prompt: 'Fail' },
          { id: 's2', kind: 'agent', agent: 'ok-agent', prompt: 'Should not run' },
        ],
      };
      const result = await builder.executeChain(config);
      expect(result.status).toBe('failed');
      expect(result.steps[1].status).toBe('skipped');
    });

    it('continues when stopOnError is false', async () => {
      const executor = createMockExecutor({
        executeAgent: async (agentId: string) => {
          if (agentId === 'fail-agent') throw new Error('Failed');
          return 'ok';
        },
      });
      const builder = new AgentChainBuilder({ executor });
      const config: AgentChainConfig = {
        stopOnError: false,
        steps: [
          { id: 's1', kind: 'agent', agent: 'fail-agent', prompt: 'Fail' },
          { id: 's2', kind: 'agent', agent: 'ok-agent', prompt: 'Should run' },
        ],
      };
      const result = await builder.executeChain(config);
      expect(result.status).toBe('failed');
      expect(result.steps[0].status).toBe('failed');
      expect(result.steps[1].status).toBe('success');
      expect(result.successCount).toBe(1);
      expect(result.failureCount).toBe(1);
    });

    it('skips step when condition is not met', async () => {
      const executor = createMockExecutor();
      const builder = new AgentChainBuilder({ executor });
      const config: AgentChainConfig = {
        steps: [
          { id: 's1', kind: 'agent', prompt: 'Run' },
          {
            id: 's2',
            kind: 'agent',
            prompt: 'Conditional',
            condition: (results) => results.get('s1')?.status === 'failed',
          },
        ],
      };
      const result = await builder.executeChain(config);
      expect(result.steps[1].status).toBe('skipped');
      expect(result.skipCount).toBe(1);
    });

    it('throws when no executor is provided', async () => {
      const builder = new AgentChainBuilder();
      const config: AgentChainConfig = {
        steps: [{ id: 's1', kind: 'agent', prompt: 'test' }],
      };
      const result = await builder.executeChain(config);
      // Without executor/gateway, agent steps fail closed with a registration error (or throw).
      expect(result.status).toBe('failed');
      expect(result.failureCount).toBeGreaterThan(0);
      expect(String(result.steps[0]?.error || '')).toMatch(
        /requires an executor|No external agents registered|external agent gateway/i,
      );
    });

    it('executes steps in parallel when parallel is true', async () => {
      const executionOrder: string[] = [];
      const executor = createMockExecutor({
        executeAgent: async (agentId: string, _prompt: string) => {
          executionOrder.push(agentId);
          await new Promise((resolve) => setTimeout(resolve, 50));
          return `Done: ${agentId}`;
        },
      });
      const builder = new AgentChainBuilder({ executor });
      const config: AgentChainConfig = {
        name: 'parallel-chain',
        parallel: true,
        steps: [
          { id: 's1', kind: 'agent', agent: 'agent-a', prompt: 'Task A' },
          { id: 's2', kind: 'agent', agent: 'agent-b', prompt: 'Task B' },
          { id: 's3', kind: 'agent', agent: 'agent-c', prompt: 'Task C' },
        ],
      };
      const result = await builder.executeChain(config);
      expect(result.status).toBe('completed');
      expect(result.successCount).toBe(3);
      expect(executionOrder).toHaveLength(3);
    });

    it('executes parallel groups concurrently', async () => {
      const startTime = Date.now();
      const executor = createMockExecutor({
        executeAgent: async (_agentId: string, _prompt: string) => {
          await new Promise((resolve) => setTimeout(resolve, 100));
          return 'done';
        },
      });
      const builder = new AgentChainBuilder({ executor });
      const config: AgentChainConfig = {
        parallel: true,
        steps: [
          { id: 's1', kind: 'agent', prompt: 'A', parallelGroup: 'group1' },
          { id: 's2', kind: 'agent', prompt: 'B', parallelGroup: 'group1' },
          { id: 's3', kind: 'agent', prompt: 'C', parallelGroup: 'group2' },
        ],
      };
      const result = await builder.executeChain(config);
      const duration = Date.now() - startTime;
      expect(result.status).toBe('completed');
      expect(result.successCount).toBe(3);
      expect(duration).toBeLessThan(600);
    });

    it('respects maxConcurrency limit', async () => {
      let concurrentCount = 0;
      let maxConcurrent = 0;
      const executor = createMockExecutor({
        executeAgent: async (_agentId: string, _prompt: string) => {
          concurrentCount++;
          maxConcurrent = Math.max(maxConcurrent, concurrentCount);
          await new Promise((resolve) => setTimeout(resolve, 50));
          concurrentCount--;
          return 'done';
        },
      });
      const builder = new AgentChainBuilder({ executor });
      const config: AgentChainConfig = {
        parallel: true,
        maxConcurrency: 2,
        steps: [
          { id: 's1', kind: 'agent', prompt: 'A', parallelGroup: 'group1' },
          { id: 's2', kind: 'agent', prompt: 'B', parallelGroup: 'group1' },
          { id: 's3', kind: 'agent', prompt: 'C', parallelGroup: 'group1' },
          { id: 's4', kind: 'agent', prompt: 'D', parallelGroup: 'group1' },
        ],
      };
      const result = await builder.executeChain(config);
      expect(result.status).toBe('completed');
      expect(maxConcurrent).toBeLessThanOrEqual(2);
    });

    it('skips step when dependsOn dependencies are not met', async () => {
      const executor = createMockExecutor({
        executeAgent: async (agentId: string) => {
          if (agentId === 'fail-agent') throw new Error('Failed');
          return 'ok';
        },
      });
      const builder = new AgentChainBuilder({ executor });
      const config: AgentChainConfig = {
        parallel: true,
        steps: [
          { id: 's1', kind: 'agent', agent: 'fail-agent', prompt: 'Fail' },
          { id: 's2', kind: 'agent', prompt: 'Depends on s1', dependsOn: ['s1'] },
        ],
      };
      const result = await builder.executeChain(config);
      expect(result.steps[0].status).toBe('failed');
      expect(result.steps[1].status).toBe('skipped');
    });
  });

  describe('resolveInputReferences', () => {
    it('resolves step output references', () => {
      const builder = new AgentChainBuilder();
      const outputs = new Map([
        ['step1', 'hello world'],
        ['step2', 'foo bar'],
      ]);
      const resolved = builder.resolveInputReferences('Input: ${step1.output} and ${step2.output}', outputs);
      expect(resolved).toBe('Input: hello world and foo bar');
    });

    it('resolves previous.output reference', () => {
      const builder = new AgentChainBuilder();
      const outputs = new Map([['step1', 'last value']]);
      const resolved = builder.resolveInputReferences('Previous: ${previous.output}', outputs);
      expect(resolved).toBe('Previous: last value');
    });

    it('leaves unresolved references as-is', () => {
      const builder = new AgentChainBuilder();
      const resolved = builder.resolveInputReferences('${missing.output}', new Map());
      expect(resolved).toBe('${missing.output}');
    });
  });

  describe('formatExecutionSummary', () => {
    it('formats execution summary with all statuses', () => {
      const builder = new AgentChainBuilder();
      const execution = builder.buildChain({
        name: 'test',
        steps: [
          { id: 's1', kind: 'agent', prompt: 'a' },
          { id: 's2', kind: 'agent', prompt: 'b' },
        ],
      });
      execution.steps[0] = { ...execution.steps[0], status: 'success', durationMs: 100 };
      execution.steps[1] = { ...execution.steps[1], status: 'failed', durationMs: 50, error: 'boom' };

      const summary = builder.formatExecutionSummary(execution);
      expect(summary).toContain('[OK] s1 (100ms)');
      expect(summary).toContain('[FAIL] s2 (50ms)');
      expect(summary).toContain('Error: boom');
    });
  });
});
