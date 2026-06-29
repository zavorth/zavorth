import { v4 as uuidv4 } from 'uuid';
import { MessageBus, type Message, type MessageFilter } from './MessageBus.js';
import { logger } from '../logger.js';

export type AgentStatus = 'online' | 'busy' | 'offline' | 'error';

export type AgentInfo = {
  id: string;
  name: string;
  capabilities: string[];
  status: AgentStatus;
  registeredAt: string;
  lastSeenAt: string;
};

export type AgentFilter = {
  status?: AgentStatus;
  capability?: string;
  name?: string;
};

export type DirectMessage = {
  to: string;
  from: string;
  type: string;
  payload: unknown;
  timeoutMs?: number;
};

export type BroadcastMessage = {
  from: string;
  type: string;
  payload: unknown;
  capabilityFilter?: string;
};

export type RequestResponse = {
  id: string;
  from: string;
  to: string;
  type: string;
  payload: unknown;
  timeoutMs: number;
  response?: unknown;
  completed: boolean;
};

export type TaskDelegationStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'timeout' | 'cancelled';

export type TaskDelegation = {
  id: string;
  taskType: string;
  payload: unknown;
  assignedTo: string;
  assignedBy: string;
  status: TaskDelegationStatus;
  result?: unknown;
  createdAt: string;
  completedAt?: string;
};

export type AgentCapabilities = {
  agentId: string;
  capabilities: string[];
  addedAt: string;
};

export type AgentCommunicatorConfig = {
  defaultRequestTimeoutMs?: number;
  heartbeatIntervalMs?: number;
  heartbeatTimeoutMs?: number;
  now?: () => Date;
};

const DEFAULT_CONFIG: Required<AgentCommunicatorConfig> = {
  defaultRequestTimeoutMs: 30_000,
  heartbeatIntervalMs: 10_000,
  heartbeatTimeoutMs: 30_000,
  now: () => new Date(),
};

const TOPIC_AGENT_COMM = 'agent:comm';
const TOPIC_HEARTBEAT = 'agent:heartbeat';

export class AgentCommunicator {
  private readonly agents = new Map<string, AgentInfo>();
  private readonly tasks = new Map<string, TaskDelegation>();
  private readonly pendingRequests = new Map<string, {
    resolve: (value: unknown) => void;
    reject: (reason: Error) => void;
    timer: ReturnType<typeof setTimeout>;
  }>();
  private readonly heartbeatTimers = new Map<string, ReturnType<typeof setInterval>>();
  private readonly bus: MessageBus;
  private readonly config: Required<AgentCommunicatorConfig>;
  private readonly log: typeof logger;

  constructor(bus: MessageBus, config: AgentCommunicatorConfig = {}) {
    this.bus = bus;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.log = logger;
  }

  public registerAgent(info: Omit<AgentInfo, 'registeredAt' | 'lastSeenAt'>): AgentInfo {
    if (this.agents.has(info.id)) {
      throw new Error(`Agent "${info.id}" is already registered`);
    }

    const now = this.config.now().toISOString();
    const agent: AgentInfo = {
      ...info,
      registeredAt: now,
      lastSeenAt: now,
    };

    this.agents.set(agent.id, agent);

    this.bus.publish({
      topic: TOPIC_AGENT_COMM,
      type: 'agent:registered',
      senderId: agent.id,
      payload: { agent },
    });

    this.log.info(`[AgentCommunicator] Agent "${agent.name}" (${agent.id}) registered with capabilities: [${agent.capabilities.join(', ')}]`);
    return agent;
  }

  public unregisterAgent(agentId: string): boolean {
    const agent = this.agents.get(agentId);
    if (!agent) return false;

    this.stopHeartbeat(agentId);
    this.agents.delete(agentId);

    for (const [taskId, task] of this.tasks) {
      if (task.assignedTo === agentId && task.status !== 'completed' && task.status !== 'cancelled') {
        task.status = 'cancelled';
        task.completedAt = this.config.now().toISOString();
      }
    }

    this.bus.publish({
      topic: TOPIC_AGENT_COMM,
      type: 'agent:unregistered',
      senderId: agentId,
      payload: { agent },
    });

    this.log.info(`[AgentCommunicator] Agent "${agent.name}" (${agentId}) unregistered`);
    return true;
  }

  public getAgent(agentId: string): AgentInfo | null {
    return this.agents.get(agentId) ?? null;
  }

  public listAgents(filter?: AgentFilter): AgentInfo[] {
    const agents = Array.from(this.agents.values());

    if (!filter) return agents;

    return agents.filter((agent) => {
      if (filter.status && agent.status !== filter.status) return false;
      if (filter.capability && !agent.capabilities.includes(filter.capability)) return false;
      if (filter.name && agent.name !== filter.name) return false;
      return true;
    });
  }

  public discoverAgents(capability: string): AgentInfo[] {
    return this.listAgents({ status: 'online', capability });
  }

  public sendMessage(message: DirectMessage): void {
    const agent = this.agents.get(message.to);
    if (!agent) {
      throw new Error(`Agent "${message.to}" is not registered`);
    }

    const timeoutMs = message.timeoutMs ?? this.config.defaultRequestTimeoutMs;

    this.bus.publish({
      topic: TOPIC_AGENT_COMM,
      type: 'direct:message',
      senderId: message.from,
      targetId: message.to,
      payload: {
        type: message.type,
        payload: message.payload,
        timeoutMs,
      },
      ttlMs: timeoutMs,
    });

    this.updateAgentLastSeen(message.from);
    this.log.info(`[AgentCommunicator] Direct message "${message.type}" from "${message.from}" to "${message.to}"`);
  }

  public broadcast(message: BroadcastMessage): number {
    const agents = this.listAgents({ status: 'online' });
    const targets = message.capabilityFilter
      ? agents.filter((a) => a.capabilities.includes(message.capabilityFilter!))
      : agents;

    const count = targets.length;

    for (const agent of targets) {
      this.bus.publish({
        topic: TOPIC_AGENT_COMM,
        type: 'broadcast:message',
        senderId: message.from,
        targetId: agent.id,
        payload: {
          type: message.type,
          payload: message.payload,
          capabilityFilter: message.capabilityFilter,
        },
      });
    }

    this.updateAgentLastSeen(message.from);
    this.log.info(`[AgentCommunicator] Broadcast "${message.type}" from "${message.from}" to ${count} agent(s)`);
    return count;
  }

  public request(message: Omit<DirectMessage, 'timeoutMs'> & { timeoutMs?: number }): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const agent = this.agents.get(message.to);
      if (!agent) {
        reject(new Error(`Agent "${message.to}" is not registered`));
        return;
      }

      const requestId = uuidv4();
      const timeoutMs = message.timeoutMs ?? this.config.defaultRequestTimeoutMs;

      const timer = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error(`Request "${requestId}" to "${message.to}" timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      this.pendingRequests.set(requestId, { resolve, reject, timer });

      this.bus.publish({
        topic: TOPIC_AGENT_COMM,
        type: 'request:send',
        senderId: message.from,
        targetId: message.to,
        payload: {
          requestId,
          type: message.type,
          payload: message.payload,
          timeoutMs,
        },
        ttlMs: timeoutMs,
      });

      this.updateAgentLastSeen(message.from);
      this.log.info(`[AgentCommunicator] Request "${message.type}" (${requestId}) from "${message.from}" to "${message.to}"`);
    });
  }

  public respondToRequest(requestId: string, agentId: string, response: unknown): boolean {
    const pending = this.pendingRequests.get(requestId);
    if (!pending) return false;

    clearTimeout(pending.timer);
    this.pendingRequests.delete(requestId);

    pending.resolve(response);

    this.bus.publish({
      topic: TOPIC_AGENT_COMM,
      type: 'request:response',
      senderId: agentId,
      payload: {
        requestId,
        response,
      },
    });

    this.updateAgentLastSeen(agentId);
    this.log.info(`[AgentCommunicator] Response to request "${requestId}" from "${agentId}"`);
    return true;
  }

  public delegateTask(task: Omit<TaskDelegation, 'id' | 'status' | 'createdAt'>): TaskDelegation {
    const agent = this.agents.get(task.assignedTo);
    if (!agent) {
      throw new Error(`Agent "${task.assignedTo}" is not registered`);
    }

    const now = this.config.now().toISOString();
    const delegation: TaskDelegation = {
      ...task,
      id: uuidv4(),
      status: 'pending',
      createdAt: now,
    };

    this.tasks.set(delegation.id, delegation);

    this.bus.publish({
      topic: TOPIC_AGENT_COMM,
      type: 'task:delegated',
      senderId: task.assignedBy,
      targetId: task.assignedTo,
      payload: {
        taskId: delegation.id,
        taskType: task.taskType,
        payload: task.payload,
      },
    });

    this.log.info(`[AgentCommunicator] Task "${task.taskType}" (${delegation.id}) delegated to "${task.assignedTo}"`);
    return delegation;
  }

  public completeTask(taskId: string, agentId: string, result: unknown): TaskDelegation | null {
    const task = this.tasks.get(taskId);
    if (!task) return null;
    if (task.assignedTo !== agentId) return null;

    task.status = 'completed';
    task.result = result;
    task.completedAt = this.config.now().toISOString();

    this.bus.publish({
      topic: TOPIC_AGENT_COMM,
      type: 'task:completed',
      senderId: agentId,
      payload: {
        taskId,
        result,
      },
    });

    this.log.info(`[AgentCommunicator] Task "${task.taskType}" (${taskId}) completed by "${agentId}"`);
    return task;
  }

  public failTask(taskId: string, agentId: string, error: unknown): TaskDelegation | null {
    const task = this.tasks.get(taskId);
    if (!task) return null;
    if (task.assignedTo !== agentId) return null;

    task.status = 'failed';
    task.result = { error: String(error) };
    task.completedAt = this.config.now().toISOString();

    this.bus.publish({
      topic: TOPIC_AGENT_COMM,
      type: 'task:failed',
      senderId: agentId,
      payload: {
        taskId,
        error: String(error),
      },
    });

    this.log.info(`[AgentCommunicator] Task "${task.taskType}" (${taskId}) failed: ${error}`);
    return task;
  }

  public getTaskStatus(taskId: string): TaskDelegation | null {
    return this.tasks.get(taskId) ?? null;
  }

  public updateAgentStatus(agentId: string, status: AgentStatus): boolean {
    const agent = this.agents.get(agentId);
    if (!agent) return false;

    const previousStatus = agent.status;
    agent.status = status;
    agent.lastSeenAt = this.config.now().toISOString();

    this.bus.publish({
      topic: TOPIC_AGENT_COMM,
      type: 'agent:status_changed',
      senderId: agentId,
      payload: {
        previousStatus,
        currentStatus: status,
      },
    });

    this.log.info(`[AgentCommunicator] Agent "${agent.name}" (${agentId}) status: ${previousStatus} -> ${status}`);
    return true;
  }

  public startHeartbeat(agentId: string, intervalMs?: number): boolean {
    const agent = this.agents.get(agentId);
    if (!agent) return false;

    this.stopHeartbeat(agentId);

    const interval = intervalMs ?? this.config.heartbeatIntervalMs;

    const timer = setInterval(() => {
      const currentAgent = this.agents.get(agentId);
      if (!currentAgent || currentAgent.status === 'offline') {
        this.stopHeartbeat(agentId);
        return;
      }

      const lastSeen = new Date(currentAgent.lastSeenAt).getTime();
      const now = this.config.now().getTime();

      if (now - lastSeen > this.config.heartbeatTimeoutMs) {
        this.updateAgentStatus(agentId, 'offline');
        this.log.info(`[AgentCommunicator] Agent "${currentAgent.name}" (${agentId}) heartbeat timeout - marking offline`);
        this.stopHeartbeat(agentId);
        return;
      }

      this.bus.publish({
        topic: TOPIC_HEARTBEAT,
        type: 'heartbeat:ping',
        senderId: agentId,
        payload: { timestamp: this.config.now().toISOString() },
      });
    }, interval);

    this.heartbeatTimers.set(agentId, timer);
    this.log.info(`[AgentCommunicator] Heartbeat started for agent "${agent.name}" (${agentId}) every ${interval}ms`);
    return true;
  }

  public stopHeartbeat(agentId: string): boolean {
    const timer = this.heartbeatTimers.get(agentId);
    if (!timer) return false;

    clearInterval(timer);
    this.heartbeatTimers.delete(agentId);
    this.log.info(`[AgentCommunicator] Heartbeat stopped for agent "${agentId}"`);
    return true;
  }

  public handleHeartbeat(agentId: string): void {
    const agent = this.agents.get(agentId);
    if (!agent) return;

    agent.lastSeenAt = this.config.now().toISOString();

    if (agent.status === 'offline') {
      this.updateAgentStatus(agentId, 'online');
    }

    this.bus.publish({
      topic: TOPIC_HEARTBEAT,
      type: 'heartbeat:pong',
      senderId: agentId,
      payload: { timestamp: this.config.now().toISOString() },
    });
  }

  public getAgentCapabilities(agentId: string): AgentCapabilities | null {
    const agent = this.agents.get(agentId);
    if (!agent) return null;

    return {
      agentId: agent.id,
      capabilities: [...agent.capabilities],
      addedAt: agent.registeredAt,
    };
  }

  public addCapability(agentId: string, capability: string): boolean {
    const agent = this.agents.get(agentId);
    if (!agent) return false;

    if (!agent.capabilities.includes(capability)) {
      agent.capabilities.push(capability);

      this.bus.publish({
        topic: TOPIC_AGENT_COMM,
        type: 'agent:capability_added',
        senderId: agentId,
        payload: { capability, capabilities: agent.capabilities },
      });
    }

    return true;
  }

  public removeCapability(agentId: string, capability: string): boolean {
    const agent = this.agents.get(agentId);
    if (!agent) return false;

    const index = agent.capabilities.indexOf(capability);
    if (index < 0) return false;

    agent.capabilities.splice(index, 1);

    this.bus.publish({
      topic: TOPIC_AGENT_COMM,
      type: 'agent:capability_removed',
      senderId: agentId,
      payload: { capability, capabilities: agent.capabilities },
    });

    return true;
  }

  public cleanup(): { agentsRemoved: number; tasksRemoved: number } {
    let agentsRemoved = 0;
    const now = this.config.now();

    for (const [id, agent] of this.agents) {
      if (agent.status === 'offline') {
        const lastSeen = new Date(agent.lastSeenAt).getTime();
        if (now.getTime() - lastSeen > this.config.heartbeatTimeoutMs * 10) {
          this.stopHeartbeat(id);
          this.agents.delete(id);
          agentsRemoved++;
        }
      }
    }

    let tasksRemoved = 0;
    for (const [taskId, task] of this.tasks) {
      if (task.status === 'cancelled') {
        this.tasks.delete(taskId);
        tasksRemoved++;
      }
    }

    return { agentsRemoved, tasksRemoved };
  }

  public getStats(): {
    totalAgents: number;
    onlineAgents: number;
    busyAgents: number;
    offlineAgents: number;
    errorAgents: number;
    totalTasks: number;
    pendingTasks: number;
    completedTasks: number;
    failedTasks: number;
    pendingRequests: number;
    activeHeartbeats: number;
  } {
    const agents = Array.from(this.agents.values());
    const tasks = Array.from(this.tasks.values());

    return {
      totalAgents: agents.length,
      onlineAgents: agents.filter((a) => a.status === 'online').length,
      busyAgents: agents.filter((a) => a.status === 'busy').length,
      offlineAgents: agents.filter((a) => a.status === 'offline').length,
      errorAgents: agents.filter((a) => a.status === 'error').length,
      totalTasks: tasks.length,
      pendingTasks: tasks.filter((t) => t.status === 'pending').length,
      completedTasks: tasks.filter((t) => t.status === 'completed').length,
      failedTasks: tasks.filter((t) => t.status === 'failed').length,
      pendingRequests: this.pendingRequests.size,
      activeHeartbeats: this.heartbeatTimers.size,
    };
  }

  private updateAgentLastSeen(agentId: string): void {
    const agent = this.agents.get(agentId);
    if (agent) {
      agent.lastSeenAt = this.config.now().toISOString();
    }
  }
}
