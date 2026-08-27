import { v4 as uuidv4 } from 'uuid';
import { logger } from '../logger.js';
import { ZavorthExternalAgentGatewayService } from '../services/ZavorthExternalAgentGatewayService.js';
import { asErrorLike } from '../utils/errorLike';

export type AgentChainStepKind = 'agent' | 'local' | 'transform';

export type AgentChainStepConfig = {
  id: string;
  kind: AgentChainStepKind;
  agent?: string;
  prompt: string;
  input?: string;
  command?: string;
  fallback?: string;
  timeoutMs?: number;
  retries?: number;
  transform?: (input: string) => string;
  condition?: (previousResults: Map<string, AgentChainStepResult>) => boolean;
  parallelGroup?: string;
  dependsOn?: string[];
};

export type AgentChainStepResult = {
  stepId: string;
  kind: AgentChainStepKind;
  agent: string | null;
  status: 'success' | 'failed' | 'skipped' | 'fallback';
  output: string;
  error: string | null;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  receiptId: string | null;
  fallbackUsed: string | null;
  retryCount: number;
};

export type AgentChainConfig = {
  id?: string;
  name?: string;
  description?: string;
  steps: AgentChainStepConfig[];
  stopOnError?: boolean;
  parallel?: boolean;
  maxConcurrency?: number;
  approvalRequired?: boolean;
  requestedBy?: string;
};

export type AgentChainExecution = {
  chainId: string;
  name: string | null;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  steps: AgentChainStepResult[];
  startedAt: string | null;
  finishedAt: string | null;
  totalDurationMs: number;
  successCount: number;
  failureCount: number;
  fallbackCount: number;
  skipCount: number;
};

export type AgentChainExecutor = {
  executeAgent: (agentId: string, prompt: string) => Promise<string>;
  executeLocal?: (command: string) => Promise<string>;
};

export type AgentChainBuilderRuntime = {
  now?: () => Date;
  externalAgentGateway?: ZavorthExternalAgentGatewayService;
  executor?: AgentChainExecutor;
  logger?: typeof logger;
};

const DEFAULT_TIMEOUT_MS = 120_000;
const DEFAULT_RETRIES = 0;
const DEFAULT_MAX_CONCURRENCY = 5;

export class AgentChainBuilder {
  private readonly now: () => Date;
  private readonly gateway: ZavorthExternalAgentGatewayService | null;
  private readonly executor: AgentChainExecutor | null;
  private readonly log: typeof logger;

  constructor(runtime: AgentChainBuilderRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.gateway = runtime.externalAgentGateway || null;
    this.executor = runtime.executor || null;
    this.log = runtime.logger || logger;
  }

  public listAvailableAgents(): Array<{ id: string; label: string; adapter: string; liveReady: boolean }> {
    if (!this.gateway) return [];
    const snapshot = this.gateway.buildRegistrySnapshot();
    return snapshot.profiles
      .filter((profile) => profile.status === 'enabled')
      .map((profile) => ({
        id: profile.id,
        label: profile.label,
        adapter: profile.adapter,
        liveReady: profile.liveExecutionEnabled,
      }));
  }

  public resolveAgentForStep(step: AgentChainStepConfig): { resolved: boolean; agentId: string | null; error: string | null } {
    if (this.executor) {
      return { resolved: true, agentId: step.agent || 'default', error: null };
    }
    if (step.kind !== 'agent') {
      return { resolved: true, agentId: null, error: null };
    }

    const requestedAgent = step.agent || 'default';
    const available = this.listAvailableAgents();

    if (available.length === 0) {
      return { resolved: false, agentId: null, error: 'No external agents registered. Use zavorth external-agent register to add one.' };
    }

    const exactMatch = available.find((a) => a.id === requestedAgent);
    if (exactMatch) {
      return { resolved: true, agentId: exactMatch.id, error: null };
    }

    const partialMatch = available.find((a) =>
      a.id.includes(requestedAgent) || a.label.toLowerCase().includes(requestedAgent.toLowerCase()),
    );
    if (partialMatch) {
      this.log.info(`[AgentChain] Agent "${requestedAgent}" not found exactly, using partial match: "${partialMatch.id}"`);
      return { resolved: true, agentId: partialMatch.id, error: null };
    }

    const liveReady = available.filter((a) => a.liveReady);
    if (liveReady.length > 0) {
      this.log.warn(`[AgentChain] Agent "${requestedAgent}" not found. Available live agents: ${liveReady.map((a) => a.id).join(', ')}`);
      return { resolved: false, agentId: null, error: `Agent "${requestedAgent}" not registered. Available: ${liveReady.map((a) => a.id).join(', ')}` };
    }

    return { resolved: false, agentId: null, error: `Agent "${requestedAgent}" not registered and no live agents available.` };
  }

  public buildChain(config: AgentChainConfig): AgentChainExecution {
    const chainId = config.id || uuidv4();
    return {
      chainId,
      name: config.name || null,
      status: 'pending',
      steps: config.steps.map((step) => ({
        stepId: step.id,
        kind: step.kind,
        agent: step.agent || null,
        status: 'skipped' as const,
        output: '',
        error: null,
        startedAt: this.now().toISOString(),
        finishedAt: this.now().toISOString(),
        durationMs: 0,
        receiptId: null,
        fallbackUsed: null,
        retryCount: 0,
      })),
      startedAt: null,
      finishedAt: null,
      totalDurationMs: 0,
      successCount: 0,
      failureCount: 0,
      fallbackCount: 0,
      skipCount: 0,
    };
  }

  public async executeChain(config: AgentChainConfig): Promise<AgentChainExecution> {
    const execution = this.buildChain(config);
    execution.status = 'running';
    execution.startedAt = this.now().toISOString();

    const results = new Map<string, AgentChainStepResult>();
    const stepOutputs = new Map<string, string>();

    this.log.info(`[AgentChain] Starting chain "${config.name || execution.chainId}" with ${config.steps.length} steps`);

    if (config.parallel) {
      await this.executeParallel(config, execution, results, stepOutputs);
    } else {
      await this.executeSequential(config, execution, results, stepOutputs);
    }

    execution.status = execution.failureCount > 0 ? 'failed' : 'completed';
    execution.finishedAt = this.now().toISOString();
    execution.totalDurationMs = new Date(execution.finishedAt).getTime() - new Date(execution.startedAt!).getTime();

    this.log.info(
      `[AgentChain] Chain "${config.name || execution.chainId}" finished: ` +
      `${execution.successCount} success, ${execution.failureCount} failed, ` +
      `${execution.fallbackCount} fallback, ${execution.skipCount} skipped (${execution.totalDurationMs}ms)`,
    );

    return execution;
  }

  private async executeSequential(
    config: AgentChainConfig,
    execution: AgentChainExecution,
    results: Map<string, AgentChainStepResult>,
    stepOutputs: Map<string, string>,
  ): Promise<void> {
    for (const stepConfig of config.steps) {
      const shouldContinue = await this.executeStep(stepConfig, config, execution, results, stepOutputs);
      if (!shouldContinue) break;
    }
  }

  private async executeParallel(
    config: AgentChainConfig,
    execution: AgentChainExecution,
    results: Map<string, AgentChainStepResult>,
    stepOutputs: Map<string, string>,
  ): Promise<void> {
    const maxConcurrency = config.maxConcurrency ?? DEFAULT_MAX_CONCURRENCY;
    const groups = this.buildParallelGroups(config.steps);

    this.log.info(`[AgentChain] Parallel mode: ${groups.length} groups, max concurrency ${maxConcurrency}`);

    for (const group of groups) {
      this.log.info(`[AgentChain] Executing group "${group.name}" with ${group.steps.length} steps in parallel`);

      const semaphore = new Semaphore(maxConcurrency);
      const promises = group.steps.map(async (stepConfig) => {
        await semaphore.acquire();
        try {
          return await this.executeStep(stepConfig, config, execution, results, stepOutputs);
        } finally {
          semaphore.release();
        }
      });

      const groupResults = await Promise.allSettled(promises);

      const hasFailure = groupResults.some(
        (r) => r.status === 'rejected' || (r.status === 'fulfilled' && r.value === false),
      );

      if (hasFailure && config.stopOnError !== false) {
        this.log.error(`[AgentChain] Parallel group "${group.name}" had failures, stopping chain`);
        break;
      }
    }
  }

  private buildParallelGroups(steps: AgentChainStepConfig[]): ParallelGroup[] {
    const groups = new Map<string, ParallelGroup>();
    const noGroup: ParallelGroup = { name: '__sequential__', steps: [] };

    for (const step of steps) {
      if (step.parallelGroup) {
        if (!groups.has(step.parallelGroup)) {
          groups.set(step.parallelGroup, { name: step.parallelGroup, steps: [] });
        }
        groups.get(step.parallelGroup)!.steps.push(step);
      } else {
        noGroup.steps.push(step);
      }
    }

    const result: ParallelGroup[] = [];

    if (noGroup.steps.length > 0) {
      const hasParallelGroups = groups.size > 0;
      if (!hasParallelGroups) {
        result.push({ name: 'all-parallel', steps: noGroup.steps });
      } else {
        for (const step of noGroup.steps) {
          result.push({ name: step.id, steps: [step] });
        }
      }
    }

    for (const group of Array.from(groups.values())) {
      result.push(group);
    }

    return result;
  }

  private async executeStep(
    stepConfig: AgentChainStepConfig,
    config: AgentChainConfig,
    execution: AgentChainExecution,
    results: Map<string, AgentChainStepResult>,
    stepOutputs: Map<string, string>,
  ): Promise<boolean> {
    const stepResult = execution.steps.find((s) => s.stepId === stepConfig.id);
    if (!stepResult) return true;

    if (stepConfig.condition && !stepConfig.condition(results)) {
      stepResult.status = 'skipped';
      stepResult.output = 'Skipped: condition not met';
      execution.skipCount++;
      results.set(stepConfig.id, stepResult);
      this.log.info(`[AgentChain] Step "${stepConfig.id}" skipped: condition not met`);
      return true;
    }

    if (stepConfig.dependsOn) {
      const unmetDeps = stepConfig.dependsOn.filter((dep) => {
        const depResult = results.get(dep);
        return !depResult || depResult.status === 'failed';
      });
      if (unmetDeps.length > 0) {
        stepResult.status = 'skipped';
        stepResult.output = `Skipped: dependencies not met: ${unmetDeps.join(', ')}`;
        execution.skipCount++;
        results.set(stepConfig.id, stepResult);
        this.log.info(`[AgentChain] Step "${stepConfig.id}" skipped: dependencies not met`);
        return true;
      }
    }

    if (stepConfig.kind === 'agent') {
      const resolution = this.resolveAgentForStep(stepConfig);
      if (!resolution.resolved) {
        stepResult.status = 'failed';
        stepResult.error = resolution.error;
        execution.failureCount++;
        results.set(stepConfig.id, stepResult);
        this.log.error(`[AgentChain] Step "${stepConfig.id}" failed: ${resolution.error}`);
        if (config.stopOnError !== false) return false;
        return true;
      }
    }

    const resolvedPrompt = this.resolveInputReferences(stepConfig.prompt, stepOutputs);
    const maxAttempts = (stepConfig.retries ?? DEFAULT_RETRIES) + 1;
    let lastError: string | null = null;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const startedAt = this.now().toISOString();
      stepResult.startedAt = startedAt;
      stepResult.retryCount = attempt;

      try {
        let output: string;

        if (stepConfig.kind === 'agent') {
          output = await this.invokeAgent(stepConfig.agent || 'default', resolvedPrompt, stepConfig.timeoutMs ?? DEFAULT_TIMEOUT_MS);
        } else if (stepConfig.kind === 'local') {
          output = await this.executeLocal(stepConfig.command || resolvedPrompt, stepConfig.timeoutMs ?? DEFAULT_TIMEOUT_MS);
        } else if (stepConfig.kind === 'transform' && stepConfig.transform) {
          const input = stepConfig.input
            ? this.resolveInputReferences(stepConfig.input, stepOutputs)
            : '';
          output = stepConfig.transform(input);
        } else {
          throw new Error(`Unknown step kind: ${stepConfig.kind}`);
        }

        stepResult.status = 'success';
        stepResult.output = output;
        stepResult.error = null;
        stepResult.finishedAt = this.now().toISOString();
        stepResult.durationMs = new Date(stepResult.finishedAt).getTime() - new Date(startedAt).getTime();
        execution.successCount++;
        stepOutputs.set(stepConfig.id, output);
        results.set(stepConfig.id, stepResult);

        this.log.info(`[AgentChain] Step "${stepConfig.id}" completed (${stepResult.durationMs}ms)`);
        return true;
      } catch (error: unknown) { const err = asErrorLike(error);
        lastError = error instanceof Error ? err.message : String(error);
        stepResult.error = lastError;
        stepResult.finishedAt = this.now().toISOString();
        stepResult.durationMs = new Date(stepResult.finishedAt).getTime() - new Date(startedAt).getTime();

        this.log.warn(`[AgentChain] Step "${stepConfig.id}" failed (attempt ${attempt + 1}/${maxAttempts}): ${lastError}`);

        if (attempt < maxAttempts - 1) {
          this.log.info(`[AgentChain] Retrying step "${stepConfig.id}"...`);
          continue;
        }

        if (stepConfig.fallback) {
          this.log.info(`[AgentChain] Step "${stepConfig.id}" failed, trying fallback: ${stepConfig.fallback}`);
          try {
            const fallbackOutput = await this.invokeAgent(stepConfig.fallback, resolvedPrompt, stepConfig.timeoutMs ?? DEFAULT_TIMEOUT_MS);
            stepResult.status = 'fallback';
            stepResult.output = fallbackOutput;
            stepResult.error = null;
            stepResult.fallbackUsed = stepConfig.fallback;
            stepResult.finishedAt = this.now().toISOString();
            stepResult.durationMs = new Date(stepResult.finishedAt).getTime() - new Date(startedAt).getTime();
            execution.fallbackCount++;
            execution.successCount++;
            stepOutputs.set(stepConfig.id, fallbackOutput);
            results.set(stepConfig.id, stepResult);

            this.log.info(`[AgentChain] Step "${stepConfig.id}" completed via fallback "${stepConfig.fallback}" (${stepResult.durationMs}ms)`);
            return true;
          } catch (error: unknown) {
            const err = asErrorLike(error);
            const fallbackErrorMsg = err.message;
            this.log.error(`[AgentChain] Fallback "${stepConfig.fallback}" also failed: ${fallbackErrorMsg}`);
            stepResult.status = 'failed';
            stepResult.error = `Primary: ${lastError}; Fallback: ${fallbackErrorMsg}`;
            execution.failureCount++;
            results.set(stepConfig.id, stepResult);
          }
        } else {
          stepResult.status = 'failed';
          execution.failureCount++;
          results.set(stepConfig.id, stepResult);
        }

        if (config.stopOnError !== false) {
          this.log.error(`[AgentChain] Chain stopped at step "${stepConfig.id}" due to error`);
          return false;
        }
      }
    }

    return true;
  }

  private async invokeAgent(agentId: string, prompt: string, timeoutMs: number): Promise<string> {
    if (this.executor?.executeAgent) {
      return this.executor.executeAgent(agentId, prompt);
    }

    if (!this.gateway) {
      throw new Error('AgentChainBuilder requires an executor or external agent gateway. Provide one in the constructor.');
    }

    const receipt = await this.gateway.invoke({
      profileId: agentId,
      prompt,
      timeoutMs,
      approvalGranted: true,
    });

    if (receipt.status === 'completed') {
      return receipt.output.text;
    }

    if (receipt.status === 'blocked') {
      throw new Error(`Agent "${agentId}" blocked: ${receipt.output.text}`);
    }

    if (receipt.status === 'approval-required') {
      throw new Error(`Agent "${agentId}" requires approval. Run with --approve-external-execution.`);
    }

    throw new Error(`Agent "${agentId}" failed with status "${receipt.status}": ${receipt.output.text}`);
  }

  private async executeLocal(command: string, timeoutMs: number): Promise<string> {
    if (this.executor?.executeLocal) {
      return this.executor.executeLocal(command);
    }

    // S3: never shell:true on chain local commands — argv-only spawn.
    const { spawnSyncCommandLine } = await import('../security/SafeProcessExec.js');
    const result = spawnSyncCommandLine(command, {
      timeout: timeoutMs,
      encoding: 'utf-8',
      cwd: process.cwd(),
    });
    if (result.error) throw result.error;
    if (result.status !== 0) {
      throw new Error(`Command failed with exit code ${result.status}: ${String(result.stderr || '')}`);
    }
    return String(result.stdout ?? '');
  }

  public resolveInputReferences(template: string, outputs: Map<string, string>): string {
    let resolved = template;
    for (const [stepId, output] of Array.from(outputs.entries())) {
      resolved = resolved.replace(new RegExp(`\\$\\{${stepId}\\.output\\}`, 'g'), output);
    }
    resolved = resolved.replace(/\$\{previous\.output\}/g, outputs.size > 0 ? Array.from(outputs.values()).pop() || '' : '');
    return resolved;
  }

  public formatExecutionSummary(execution: AgentChainExecution): string {
    const lines: string[] = [];
    lines.push(`Chain: ${execution.name || execution.chainId}`);
    lines.push(`Status: ${execution.status}`);
    lines.push(`Duration: ${execution.totalDurationMs}ms`);
    lines.push(`Results: ${execution.successCount} success, ${execution.failureCount} failed, ${execution.fallbackCount} fallback, ${execution.skipCount} skipped`);
    lines.push('');
    lines.push('Steps:');
    for (const step of execution.steps) {
      const icon = step.status === 'success' ? '[OK]' : step.status === 'failed' ? '[FAIL]' : step.status === 'fallback' ? '[FALLBACK]' : '[SKIP]';
      const fallback = step.fallbackUsed ? ` (fallback: ${step.fallbackUsed})` : '';
      const retry = step.retryCount > 0 ? ` (retry ${step.retryCount})` : '';
      lines.push(`  ${icon} ${step.stepId} (${step.durationMs}ms)${fallback}${retry}`);
      if (step.error) {
        lines.push(`     Error: ${step.error}`);
      }
    }
    return lines.join('\n');
  }
}

type ParallelGroup = {
  name: string;
  steps: AgentChainStepConfig[];
};

class Semaphore {
  private permits: number;
  private waitQueue: Array<() => void> = [];

  constructor(permits: number) {
    this.permits = permits;
  }

  async acquire(): Promise<void> {
    if (this.permits > 0) {
      this.permits--;
      return;
    }
    return new Promise<void>((resolve) => {
      this.waitQueue.push(resolve);
    });
  }

  release(): void {
    const next = this.waitQueue.shift();
    if (next) {
      next();
    } else {
      this.permits++;
    }
  }
}
