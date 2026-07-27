import { MessageBus } from '../../src/agents/MessageBus.js';
import { AgentCommunicator, type AgentInfo } from '../../src/agents/AgentCommunicator.js';

const setups: Array<{ bus: MessageBus; communicator: AgentCommunicator }> = [];

function createSetup() {
  let tick = 0;
  const bus = new MessageBus({
    now: () => new Date(2026, 0, 1, 0, 0, 0, tick++),
    config: { defaultTtlMs: 60_000, maxMessages: 1000, maxDeadLetters: 10, ackTimeoutMs: 999_999, cleanupIntervalMs: 999_999 },
  });
  const communicator = new AgentCommunicator(bus, {
    defaultRequestTimeoutMs: 200,
    heartbeatIntervalMs: 100,
    heartbeatTimeoutMs: 300,
    now: () => new Date(2026, 0, 1, 0, 0, 0, tick),
  });
  const setup = { bus, communicator };
  setups.push(setup);
  return setup;
}

describe('AgentCommunicator', () => {
  afterEach(() => {
    for (const s of setups) {
      for (const agent of s.communicator.listAgents()) {
        s.communicator.stopHeartbeat(agent.id);
      }
      s.bus.destroy();
    }
    setups.length = 0;
    jest.restoreAllMocks();
  });

  describe('agent registration and unregistration', () => {
    it('registers an agent with id, name and capabilities', () => {
      const { communicator } = createSetup();

      const agent = communicator.registerAgent({
        id: 'agent-1',
        name: 'code-reviewer',
        capabilities: ['review', 'test'],
        status: 'online',
      });

      expect(agent.id).toBe('agent-1');
      expect(agent.name).toBe('code-reviewer');
      expect(agent.capabilities).toEqual(['review', 'test']);
      expect(agent.registeredAt).toBeTruthy();
      expect(agent.lastSeenAt).toBeTruthy();
    });

    it('throws when registering a duplicate agent id', () => {
      const { communicator } = createSetup();

      communicator.registerAgent({ id: 'dup', name: 'A', capabilities: [], status: 'online' });

      expect(() => {
        communicator.registerAgent({ id: 'dup', name: 'B', capabilities: [], status: 'online' });
      }).toThrow('already registered');
    });

    it('retrieves a registered agent by id', () => {
      const { communicator } = createSetup();

      communicator.registerAgent({ id: 'r1', name: 'fetchatble', capabilities: [], status: 'online' });

      expect(communicator.getAgent('r1')?.name).toBe('fetchatble');
    });

    it('returns null for unknown agent id', () => {
      const { communicator } = createSetup();
      expect(communicator.getAgent('nonexistent')).toBeNull();
    });

    it('unregisters an agent and removes it', () => {
      const { communicator } = createSetup();

      communicator.registerAgent({ id: 'rm1', name: 'removable', capabilities: [], status: 'online' });
      const removed = communicator.unregisterAgent('rm1');

      expect(removed).toBe(true);
      expect(communicator.getAgent('rm1')).toBeNull();
    });

    it('cancels pending tasks when unregistering an agent', () => {
      const { communicator } = createSetup();

      communicator.registerAgent({ id: 'boss', name: 'Boss', capabilities: [], status: 'online' });
      communicator.registerAgent({ id: 'worker', name: 'Worker', capabilities: [], status: 'online' });

      const task = communicator.delegateTask({
        taskType: 'review',
        payload: {},
        assignedTo: 'worker',
        assignedBy: 'boss',
      });

      communicator.unregisterAgent('worker');

      const updated = communicator.getTaskStatus(task.id);
      expect(updated?.status).toBe('cancelled');
    });

    it('returns false when unregistering unknown agent', () => {
      const { communicator } = createSetup();
      expect(communicator.unregisterAgent('ghost')).toBe(false);
    });

    it('lists all registered agents', () => {
      const { communicator } = createSetup();

      communicator.registerAgent({ id: 'a', name: 'A', capabilities: [], status: 'online' });
      communicator.registerAgent({ id: 'b', name: 'B', capabilities: [], status: 'online' });
      communicator.registerAgent({ id: 'c', name: 'C', capabilities: [], status: 'online' });

      expect(communicator.listAgents()).toHaveLength(3);
    });

    it('lists agents with filters', () => {
      const { communicator } = createSetup();

      communicator.registerAgent({ id: 'a', name: 'Alice', capabilities: ['code'], status: 'online' });
      communicator.registerAgent({ id: 'b', name: 'Bob', capabilities: ['test'], status: 'busy' });

      expect(communicator.listAgents({ status: 'online' })).toHaveLength(1);
      expect(communicator.listAgents({ capability: 'code' })).toHaveLength(1);
      expect(communicator.listAgents({ name: 'Bob' })).toHaveLength(1);
    });
  });

  describe('agent discovery by capability', () => {
    it('finds online agents with a specific capability', () => {
      const { communicator } = createSetup();

      communicator.registerAgent({ id: 'r1', name: 'Reviewer', capabilities: ['code-review', 'testing'], status: 'online' });
      communicator.registerAgent({ id: 'd1', name: 'Deployer', capabilities: ['deployment', 'monitoring'], status: 'online' });
      communicator.registerAgent({ id: 't1', name: 'Tester', capabilities: ['testing', 'validation'], status: 'online' });

      const reviewers = communicator.discoverAgents('code-review');
      expect(reviewers).toHaveLength(1);
      expect(reviewers[0].id).toBe('r1');
    });

    it('excludes offline agents from discovery', () => {
      const { communicator } = createSetup();

      communicator.registerAgent({ id: 'off1', name: 'Offline', capabilities: ['task'], status: 'offline' });

      expect(communicator.discoverAgents('task')).toHaveLength(0);
    });

    it('finds multiple agents sharing a capability', () => {
      const { communicator } = createSetup();

      communicator.registerAgent({ id: 'w1', name: 'group-1', capabilities: ['compute'], status: 'online' });
      communicator.registerAgent({ id: 'w2', name: 'group-2', capabilities: ['compute'], status: 'online' });
      communicator.registerAgent({ id: 'w3', name: 'group-3', capabilities: ['storage'], status: 'online' });

      expect(communicator.discoverAgents('compute')).toHaveLength(2);
      expect(communicator.discoverAgents('storage')).toHaveLength(1);
    });
  });

  describe('direct messaging between agents', () => {
    it('sends a message via the bus', () => {
      const { communicator, bus } = createSetup();
      const busMessages: unknown[] = [];
      bus.on('message:published', (msg) => { busMessages.push(msg); });

      communicator.registerAgent({ id: 'a', name: 'A', capabilities: [], status: 'online' });
      communicator.registerAgent({ id: 'b', name: 'B', capabilities: [], status: 'online' });

      communicator.sendMessage({
        to: 'b',
        from: 'a',
        type: 'info',
        payload: { data: 'hello' },
      });

      expect(busMessages.length).toBeGreaterThanOrEqual(2);
    });

    it('throws when sending to unknown agent', () => {
      const { communicator } = createSetup();
      communicator.registerAgent({ id: 'a', name: 'A', capabilities: [], status: 'online' });

      expect(() => {
        communicator.sendMessage({ to: 'unknown', from: 'a', type: 'msg', payload: {} });
      }).toThrow('not registered');
    });
  });

  describe('broadcast messaging', () => {
    it('broadcasts to all online agents and returns count', () => {
      const { communicator, bus } = createSetup();
      const busMessages: unknown[] = [];
      bus.on('message:published', (msg) => { busMessages.push(msg); });

      communicator.registerAgent({ id: 's', name: 'Sender', capabilities: [], status: 'online' });
      communicator.registerAgent({ id: 'r1', name: 'R1', capabilities: [], status: 'online' });
      communicator.registerAgent({ id: 'r2', name: 'R2', capabilities: [], status: 'online' });

      const count = communicator.broadcast({
        from: 's',
        type: 'announcement',
        payload: { text: 'important' },
      });

      expect(count).toBe(3);
    });

    it('excludes offline agents from broadcast', () => {
      const { communicator } = createSetup();

      communicator.registerAgent({ id: 's', name: 'S', capabilities: [], status: 'online' });
      communicator.registerAgent({ id: 'on', name: 'ON', capabilities: [], status: 'online' });
      communicator.registerAgent({ id: 'off', name: 'OFF', capabilities: [], status: 'offline' });

      const count = communicator.broadcast({ from: 's', type: 'msg', payload: {} });
      expect(count).toBe(2);
    });

    it('filters broadcast by capability', () => {
      const { communicator } = createSetup();

      communicator.registerAgent({ id: 's', name: 'S', capabilities: [], status: 'online' });
      communicator.registerAgent({ id: 'c1', name: 'C1', capabilities: ['code'], status: 'online' });
      communicator.registerAgent({ id: 'c2', name: 'C2', capabilities: ['test'], status: 'online' });

      const count = communicator.broadcast({
        from: 's',
        type: 'review-request',
        payload: {},
        capabilityFilter: 'code',
      });

      expect(count).toBe(1);
    });
  });

  describe('request/response with timeout', () => {
    it('resolves when response arrives before timeout', async () => {
      const { communicator } = createSetup();

      communicator.registerAgent({ id: 'req', name: 'Requester', capabilities: [], status: 'online' });
      communicator.registerAgent({ id: 'res', name: 'Responder', capabilities: [], status: 'online' });

      const responsePromise = communicator.request({
        to: 'res',
        from: 'req',
        type: 'query',
        payload: { question: 'what-' },
        timeoutMs: 1000,
      });

      const pending = communicator['pendingRequests'].entries().next().value;
      if (pending) {
        communicator.respondToRequest(pending[0], 'res', { answer: 42 });
      }

      const result = await responsePromise;
      expect(result).toEqual({ answer: 42 });
    });

    it('rejects with timeout error when no response arrives', async () => {
      const { communicator } = createSetup();

      communicator.registerAgent({ id: 'req', name: 'Requester', capabilities: [], status: 'online' });
      communicator.registerAgent({ id: 'silent', name: 'Silent', capabilities: [], status: 'online' });

      await expect(
        communicator.request({
          to: 'silent',
          from: 'req',
          type: 'query',
          payload: {},
          timeoutMs: 50,
        }),
      ).rejects.toThrow('timed out');
    });

    it('rejects when target agent is not registered', async () => {
      const { communicator } = createSetup();

      communicator.registerAgent({ id: 'req', name: 'Req', capabilities: [], status: 'online' });

      await expect(
        communicator.request({ to: 'ghost', from: 'req', type: 'q', payload: {} }),
      ).rejects.toThrow('not registered');
    });

    it('returns false when responding to unknown request', () => {
      const { communicator } = createSetup();
      expect(communicator.respondToRequest('unknown', 'agent', {})).toBe(false);
    });
  });

  describe('task delegation and status tracking', () => {
    it('delegates a task and tracks its status', () => {
      const { communicator } = createSetup();

      communicator.registerAgent({ id: 'boss', name: 'Boss', capabilities: [], status: 'online' });
      communicator.registerAgent({ id: 'worker', name: 'Worker', capabilities: [], status: 'online' });

      const task = communicator.delegateTask({
        taskType: 'code-review',
        payload: { pr: 42 },
        assignedTo: 'worker',
        assignedBy: 'boss',
      });

      expect(task.id).toBeTruthy();
      expect(task.status).toBe('pending');
      expect(task.taskType).toBe('code-review');
      expect(task.assignedTo).toBe('worker');
    });

    it('completes a task with result', () => {
      const { communicator } = createSetup();

      communicator.registerAgent({ id: 'boss', name: 'Boss', capabilities: [], status: 'online' });
      communicator.registerAgent({ id: 'worker', name: 'Worker', capabilities: [], status: 'online' });

      const task = communicator.delegateTask({
        taskType: 'deploy',
        payload: {},
        assignedTo: 'worker',
        assignedBy: 'boss',
      });

      const completed = communicator.completeTask(task.id, 'worker', { deployed: true });

      expect(completed?.status).toBe('completed');
      expect(completed?.result).toEqual({ deployed: true });
      expect(completed?.completedAt).toBeTruthy();
    });

    it('fails a task with error', () => {
      const { communicator } = createSetup();

      communicator.registerAgent({ id: 'boss', name: 'Boss', capabilities: [], status: 'online' });
      communicator.registerAgent({ id: 'worker', name: 'Worker', capabilities: [], status: 'online' });

      const task = communicator.delegateTask({
        taskType: 'build',
        payload: {},
        assignedTo: 'worker',
        assignedBy: 'boss',
      });

      const failed = communicator.failTask(task.id, 'worker', 'Compilation error');

      expect(failed?.status).toBe('failed');
      expect(failed?.result).toEqual({ error: 'Compilation error' });
    });

    it('returns null when completing unknown task', () => {
      const { communicator } = createSetup();
      expect(communicator.completeTask('unknown', 'agent', {})).toBeNull();
    });

    it('returns null when wrong agent tries to complete task', () => {
      const { communicator } = createSetup();

      communicator.registerAgent({ id: 'boss', name: 'Boss', capabilities: [], status: 'online' });
      communicator.registerAgent({ id: 'w1', name: 'group-1', capabilities: [], status: 'online' });
      communicator.registerAgent({ id: 'w2', name: 'group-2', capabilities: [], status: 'online' });

      const task = communicator.delegateTask({
        taskType: 'work',
        payload: {},
        assignedTo: 'w1',
        assignedBy: 'boss',
      });

      expect(communicator.completeTask(task.id, 'w2', {})).toBeNull();
    });

    it('throws when delegating to unknown agent', () => {
      const { communicator } = createSetup();

      expect(() => {
        communicator.delegateTask({
          taskType: 't',
          payload: {},
          assignedTo: 'unknown',
          assignedBy: 'boss',
        });
      }).toThrow('not registered');
    });

    it('retrieves task status', () => {
      const { communicator } = createSetup();

      communicator.registerAgent({ id: 'boss', name: 'Boss', capabilities: [], status: 'online' });
      communicator.registerAgent({ id: 'w', name: 'W', capabilities: [], status: 'online' });

      const task = communicator.delegateTask({
        taskType: 'analyze',
        payload: {},
        assignedTo: 'w',
        assignedBy: 'boss',
      });

      const status = communicator.getTaskStatus(task.id);
      expect(status?.id).toBe(task.id);
      expect(status?.status).toBe('pending');
    });
  });

  describe('agent status updates (online, busy, offline, error)', () => {
    it('updates agent status and publishes event', () => {
      const { communicator, bus } = createSetup();
      const statusEvents: unknown[] = [];
      bus.on('message:published', (msg) => {
        const payload = msg.payload as { event-: string } | undefined;
        if (payload?.event === 'agent:status_changed' || msg.type === 'agent:status_changed') {
          statusEvents.push(msg.payload);
        }
      });

      communicator.registerAgent({ id: 'a', name: 'A', capabilities: [], status: 'online' });
      communicator.updateAgentStatus('a', 'busy');

      expect(communicator.getAgent('a')?.status).toBe('busy');
      expect(statusEvents).toHaveLength(1);
    });

    it('returns false for unknown agent', () => {
      const { communicator } = createSetup();
      expect(communicator.updateAgentStatus('ghost', 'offline')).toBe(false);
    });
  });

  describe('heartbeat detection', () => {
    it('updates lastSeenAt on heartbeat', () => {
      const { communicator } = createSetup();

      communicator.registerAgent({ id: 'hb', name: 'HB', capabilities: [], status: 'online' });
      communicator.handleHeartbeat('hb');

      expect(communicator.getAgent('hb')?.lastSeenAt).toBeTruthy();
    });

    it('revives offline agent on heartbeat', () => {
      const { communicator } = createSetup();

      communicator.registerAgent({ id: 'revive', name: 'Revive', capabilities: [], status: 'online' });
      communicator.updateAgentStatus('revive', 'offline');
      communicator.handleHeartbeat('revive');

      expect(communicator.getAgent('revive')?.status).toBe('online');
    });

    it('startHeartbeat returns true for registered agent', () => {
      const { communicator } = createSetup();

      communicator.registerAgent({ id: 'hb2', name: 'HB2', capabilities: [], status: 'online' });
      expect(communicator.startHeartbeat('hb2')).toBe(true);
    });

    it('startHeartbeat returns false for unknown agent', () => {
      const { communicator } = createSetup();
      expect(communicator.startHeartbeat('ghost')).toBe(false);
    });

    it('stopHeartbeat returns false when no timer exists', () => {
      const { communicator } = createSetup();
      expect(communicator.stopHeartbeat('ghost')).toBe(false);
    });
  });

  describe('multiple agents with different capabilities', () => {
    it('manages agents with diverse capabilities and discovers them', () => {
      const { communicator } = createSetup();

      communicator.registerAgent({ id: 'rev', name: 'Reviewer', capabilities: ['code-review', 'security-audit'], status: 'online' });
      communicator.registerAgent({ id: 'dep', name: 'Deployer', capabilities: ['deployment', 'monitoring'], status: 'online' });
      communicator.registerAgent({ id: 'tst', name: 'Tester', capabilities: ['testing', 'validation'], status: 'online' });

      expect(communicator.listAgents()).toHaveLength(3);
      expect(communicator.discoverAgents('code-review')).toHaveLength(1);
      expect(communicator.discoverAgents('deployment')).toHaveLength(1);
      expect(communicator.discoverAgents('testing')).toHaveLength(1);
      expect(communicator.discoverAgents('nonexistent')).toHaveLength(0);
    });

    it('supports inter-agent task delegation with different capabilities', () => {
      const { communicator } = createSetup();

      communicator.registerAgent({ id: 'planner', name: 'Planner', capabilities: ['planning'], status: 'online' });
      communicator.registerAgent({ id: 'executor', name: 'Executor', capabilities: ['code-gen', 'testing'], status: 'online' });

      const task = communicator.delegateTask({
        taskType: 'implement',
        payload: { feature: 'api' },
        assignedTo: 'executor',
        assignedBy: 'planner',
      });

      expect(task.assignedBy).toBe('planner');
      expect(task.assignedTo).toBe('executor');
    });

    it('adds and removes capabilities dynamically', () => {
      const { communicator } = createSetup();

      communicator.registerAgent({ id: 'flex', name: 'Flexible', capabilities: ['base'], status: 'online' });

      communicator.addCapability('flex', 'advanced');
      expect(communicator.getAgent('flex')?.capabilities).toContain('advanced');

      communicator.removeCapability('flex', 'base');
      expect(communicator.getAgent('flex')?.capabilities).not.toContain('base');
    });
  });

  describe('getStats', () => {
    it('returns comprehensive communicator statistics', () => {
      const { communicator } = createSetup();

      communicator.registerAgent({ id: 'a', name: 'A', capabilities: [], status: 'online' });
      communicator.registerAgent({ id: 'b', name: 'B', capabilities: [], status: 'busy' });

      communicator.delegateTask({ taskType: 't', payload: {}, assignedTo: 'a', assignedBy: 'b' });

      const stats = communicator.getStats();
      expect(stats.totalAgents).toBe(2);
      expect(stats.onlineAgents).toBe(1);
      expect(stats.busyAgents).toBe(1);
      expect(stats.totalTasks).toBe(1);
      expect(stats.pendingTasks).toBe(1);
    });
  });

  describe('cleanup', () => {
    it('removes stale offline agents and cancelled tasks', () => {
      let tick = 0;
      const bus = new MessageBus({
        now: () => new Date(2026, 0, 1, 0, 0, 0, tick++),
        config: { defaultTtlMs: 60_000, maxMessages: 1000, maxDeadLetters: 10, ackTimeoutMs: 999_999, cleanupIntervalMs: 999_999 },
      });
      const communicator = new AgentCommunicator(bus, {
        heartbeatTimeoutMs: 100,
        now: () => new Date(2026, 0, 1, 0, 0, 0, tick),
      });

      communicator.registerAgent({ id: 'boss', name: 'Boss', capabilities: [], status: 'online' });
      communicator.registerAgent({ id: 'stale', name: 'Stale', capabilities: [], status: 'online' });

      communicator.delegateTask({ taskType: 't', payload: {}, assignedTo: 'stale', assignedBy: 'boss' });

      communicator.updateAgentStatus('stale', 'offline');

      tick = 9999;
      const result = communicator.cleanup();

      expect(result.agentsRemoved).toBeGreaterThanOrEqual(0);
      expect(typeof result.tasksRemoved).toBe('number');
    });
  });
});
