import { EventEmitter } from 'events';
import { SessionManager } from './SessionManager.js';
import type { AgentState } from './AgentState.js';
import { randomUUID } from 'crypto';
import type { LlmRuntimeService } from '../../../services/llm/LlmRuntimeService.js';
import type { ExecutionLifecycleRecord } from '../../../contracts/ExecutionLifecycleContract.js';
import type { SubagentResultReceipt } from '../../agent/subagents/index.js';
import {
  SessionGarbageCollector,
  type SessionGarbageCollectorSweepInput,
  type SessionGarbageCollectorSweepResult,
} from './SessionGarbageCollector.js';
import type {
  RegisterSessionOwnershipInput,
  SessionGarbageCollectorPolicy,
} from './SessionOwnershipContract.js';
import type { SessionRegistryService } from './SessionRegistryService.js';/**
 * Describes a role within a swarm. Each role maps to an independent
 * SessionManager running its own PTY subprocess.
 */
export interface SwarmRole {
  id: string;
  label: string;
  systemPrompt: string;
  command?: string;
  args?: string[];
  cwd?: string;
  stdinMode?: 'prompt' | 'none';
  toolSpecId?: string | null;
  isolation?: {
    mode: 'direct' | 'temp-worktree' | 'docker' | 'wsl' | 'external-sandbox';
    workerId?: string;
    receiptId?: string;
    description?: string;
  };
  delegationPolicy?: {
    allowedTools?: string[];
    requiresApprovalTools?: string[];
    sandboxInheritance?: boolean;
  };
}

export type SwarmStatus = 'idle' | 'running' | 'completed' | 'failed' | 'cancelled' | 'timed_out';

export interface SwarmTaskResult {
  roleId: string;
  label: string;
  status: AgentState['status'] | 'CANCELLED' | 'TIMEOUT';
  output: string[];
  startedAt: string;
  finishedAt: string | null;
}

export interface SwarmSnapshot {
  swarmId: string;
  traceId?: string | null;
  runId?: string | null;
  sessionId?: string | null;
  status: SwarmStatus;
  objective: string;
  roles: SwarmTaskResult[];
  startedAt: string;
  finishedAt: string | null;
  synthesizedOutput: string | null;
  execution_lifecycle?: ExecutionLifecycleRecord[];
  subagentReceipts?: SubagentResultReceipt[];
}

type SessionController = Pick<SessionManager, 'getEvents' | 'startProcess' | 'write' | 'kill'>;

export type SwarmOrchestratorOptions = {
  sessionFactory?: (role: SwarmRole) => SessionController;
  llmRuntime?: LlmRuntimeService;
  roleTimeoutMs?: number;
  sessionRegistry?: SessionRegistryService;
  traceId?: string | null;
  runId?: string | null;
  sessionId?: string | null;
  surface?: string | null;
  sessionGarbageCollectorPolicy?: Partial<SessionGarbageCollectorPolicy>;
};

/**
 * SwarmOrchestrator — Multi-agent parallel execution engine.
 *
 * When a task is too complex for a single agent pass, the orchestrator
 * decomposes it into roles (researcher, reviewer, coder, etc.), spawns
 * independent PTY sessions for each, and collects their outputs for
 * a final synthesis step.
 *
 * Architecture decisions:
 *  - Each swarm role runs in its own SessionManager (isolated subprocess).
 *  - Roles execute in parallel via Promise.allSettled for fault tolerance.
 *  - A post-processing "synthesize" hook merges all outputs into a single
 *    coherent result that the caller (or the UI) can consume.
 *  - The orchestrator emits granular events so the WebSocket layer and
 *    zavorthControl can show real-time multi-pane progress.
 */
export class SwarmOrchestrator extends EventEmitter {
  private readonly sessions = new Map<string, SessionController>();
  private readonly results = new Map<string, SwarmTaskResult>();
  private status: SwarmStatus = 'idle';
  private readonly swarmId: string;
  private readonly startedAt: string;
  private finishedAt: string | null = null;
  private synthesizedOutput: string | null = null;

  constructor(
    private readonly objective: string,
    private readonly roles: SwarmRole[],
    private readonly options: SwarmOrchestratorOptions = {},
  ) {
    super();
    this.swarmId = randomUUID();
    this.startedAt = new Date().toISOString();
  }

  /**
   * Launch all roles in parallel. Each role gets its own shell subprocess
   * managed by a SessionManager. The orchestrator listens for state changes
   * and collects stdout from every agent.
   */
  public async execute(): Promise<SwarmSnapshot> {
    this.status = 'running';
    this.emit('swarm:started', { swarmId: this.swarmId, objective: this.objective });

    const promises = this.roles.map((role) => this.executeRole(role));
    await Promise.allSettled(promises);

    const results = Array.from(this.results.values());
    const timedOut = results.some((r) => r.status === 'TIMEOUT');
    const currentStatus = this.status as SwarmStatus;
    const cancelled = results.some((r) => r.status === 'CANCELLED') || currentStatus === 'cancelled';
    const allSucceeded = results.length === this.roles.length && results.every(
      (r) => r.status === 'IDLE', // IDLE means process exited cleanly
    );
    this.status = cancelled ? 'cancelled' : timedOut ? 'timed_out' : allSucceeded ? 'completed' : 'failed';
    this.finishedAt = new Date().toISOString();

    // Synthesis step: combine all role outputs into a merged result
    this.synthesizedOutput = await this.synthesize();

    const snapshot = this.getSnapshot();
    this.emit('swarm:finished', snapshot);
    return snapshot;
  }

  public getSnapshot(): SwarmSnapshot {
    return {
      swarmId: this.swarmId,
      traceId: this.options.traceId ?? null,
      runId: this.options.runId ?? null,
      sessionId: this.options.sessionId ?? null,
      status: this.status,
      objective: this.objective,
      roles: Array.from(this.results.values()),
      startedAt: this.startedAt,
      finishedAt: this.finishedAt,
      synthesizedOutput: this.synthesizedOutput,
    };
  }

  public async sweepOrphanedRoleSessions(
    input: SessionGarbageCollectorSweepInput = {},
  ): Promise<SessionGarbageCollectorSweepResult> {
    if (!this.options.sessionRegistry) {
      return buildEmptySweepResult();
    }

    const collector = new SessionGarbageCollector({
      registry: this.options.sessionRegistry,
      policy: this.options.sessionGarbageCollectorPolicy,
      terminateSession: (record) => {
        const session = this.sessions.get(record.sessionId);
        if (!session) {
          return;
        }
        session.kill();
        this.sessions.delete(record.sessionId);
      },
    });
    return collector.sweep(input);
  }

  /**
   * Forcefully terminate all running role sessions.
   */
  public killAll(): void {
    for (const session of this.sessions.values()) {
      session.kill();
    }
    this.status = 'cancelled';
    this.finishedAt = new Date().toISOString();
  }

  private executeRole(role: SwarmRole): Promise<void> {
    return new Promise<void>((resolve) => {
      const ownership = this.buildRoleOwnership(role);
      const nonInteractiveCommand = Boolean(role.command && role.stdinMode !== 'prompt');
      const session = this.options.sessionFactory?.(role) || new SessionManager(role.id, normalizeText(role.cwd, process.cwd()), {
        ...(nonInteractiveCommand ? { loadNodePty: () => null } : {}),
        sessionRegistry: this.options.sessionRegistry,
        ownership,
      });
      if (this.options.sessionFactory) {
        this.registerRoleOwnership(role, ownership);
      }
      this.sessions.set(role.id, session);

      const outputBuffer: string[] = [];
      const startedAt = new Date().toISOString();
      const roleTimeoutMs = Math.max(10, this.options.roleTimeoutMs || 120000);
      let settled = false;
      let timeout: NodeJS.Timeout | null = null;

      const settle = (status: SwarmTaskResult['status'], exitCode: number | null = null) => {
        if (settled) {
          return;
        }
        settled = true;
        if (timeout) {
          clearTimeout(timeout);
          timeout = null;
        }
        const result: SwarmTaskResult = {
          roleId: role.id,
          label: role.label,
          status,
          output: outputBuffer,
          startedAt,
          finishedAt: new Date().toISOString(),
        };
        this.results.set(role.id, result);

        this.emit('role:finished', {
          swarmId: this.swarmId,
          roleId: role.id,
          status,
          exitCode,
        });

        resolve();
      };

      session.getEvents().on('pty:data', (data: string) => {
        outputBuffer.push(data);
        this.emit('role:data', { swarmId: this.swarmId, roleId: role.id, data });
      });

      session.getEvents().on('pty:error', (error: string) => {
        outputBuffer.push(`[stderr] ${error}`);
      });

      session.getEvents().on('pty:exit', (code: number | null) => {
        settle(code === 0 ? 'IDLE' : 'ERROR', code);
      });

      // Start the subprocess for this role
      this.emit('role:started', { swarmId: this.swarmId, roleId: role.id, label: role.label });
      timeout = setTimeout(() => {
        outputBuffer.push(`[timeout] Role "${role.label}" excedeu ${roleTimeoutMs}ms e foi encerrada.\n`);
        settle('TIMEOUT', null);
        session.kill();
      }, roleTimeoutMs);
      session.startProcess(role.command, role.args);

      // Feed the system prompt + objective as initial stdin
      const prompt = [
        `[ROLE: ${role.label}]`,
        `[SYSTEM PROMPT]: ${role.systemPrompt}`,
        `[OBJECTIVE]: ${this.objective}`,
        '',
      ].join('\n');

      const shouldWritePrompt = role.stdinMode === 'prompt' || (!role.command && role.stdinMode !== 'none');
      if (shouldWritePrompt) {
        session.write(`${prompt}\n`);
      }
    });
  }

  private registerRoleOwnership(
    role: SwarmRole,
    ownership: Omit<RegisterSessionOwnershipInput, 'sessionId'>,
  ): void {
    this.options.sessionRegistry?.registerSession({
      ...ownership,
      sessionId: role.id,
    });
  }

  private buildRoleOwnership(role: SwarmRole): Omit<RegisterSessionOwnershipInput, 'sessionId'> {
    return {
      kind: 'swarm_role',
      surface: normalizeText(this.options.surface, 'swarm'),
      runId: normalizeNullable(this.options.runId),
      taskId: role.id,
      swarmId: this.swarmId,
      ownerRef: `swarm:${this.swarmId}:${role.id}`,
      metadata: {
        roleId: role.id,
        roleLabel: role.label,
        objective: this.objective,
        cwd: normalizeText(role.cwd, process.cwd()),
        isolationMode: role.isolation?.mode || 'direct',
        isolationWorkerId: role.isolation?.workerId || null,
      },
    };
  }

  /**
   * Post-processing merge of all role outputs.
   * If llmRuntime is provided, it calls the LLM to intelligently merge the context.
   * Otherwise, it concatenates with clear role delimiters.
   */
  private async synthesize(): Promise<string> {
    const sections: string[] = [];
    for (const result of this.results.values()) {
      sections.push(
        `=== [${result.label}] (status: ${result.status}) ===`,
        result.output.join(''),
        '',
      );
    }
    const rawOutput = sections.join('\n');

    if (!this.options.llmRuntime) {
      return rawOutput;
    }

    try {
      const prompt = `You are the final coordinator of a Swarm.
The original mission objective was: "${this.objective}"

Here are the raw reports from each agent that worked in parallel:
${rawOutput}

Synthesize these results into a single cohesive, high-quality answer focused on resolving the original objective. Remove shell noise, merge discovered facts and produced code, and explain any reported failures with likely causes. Return a properly formatted Markdown response.`;
      const result = await this.options.llmRuntime.chat([{ role: 'user', content: prompt }]);
      return result.content?.trim() || rawOutput;
    } catch (error: unknown) {// Fallback in case of LLM failure
      return `[LLM summarization failed; showing raw log]:\n\n${rawOutput}`;
    }
  }
}

function normalizeText(value: unknown, fallback = ''): string {
  const normalized = String(value ?? '').trim();
  return normalized || fallback;
}

function normalizeNullable(value: unknown): string | null {
  const normalized = normalizeText(value);
  return normalized || null;
}

function buildEmptySweepResult(): SessionGarbageCollectorSweepResult {
  return {
    checked: 0,
    kept: [],
    orphaned: [],
    reaped: [],
    receipts: [],
  };
}
