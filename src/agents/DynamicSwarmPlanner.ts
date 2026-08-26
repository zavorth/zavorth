/**
 * Dynamic Swarm Planner.
 *
 * Generates multi-agent specialist decomposition plans using the
 * StackAwarePersonaEngine. This class plans execution strategies — it does NOT
 * execute them. Actual swarm execution requires a separate executor (LLM-backed
 * agents, filesystem writes, etc.) which is not implemented here.
 *
 * The `planSpecialists` method is deterministic and real: it reads workspace
 * context, applies role decomposition heuristics, and returns tailored
 * specialist definitions. The `buildExecutionPlan` method wraps those
 * specialists into a hierarchical tree view suitable for presentation or
 * delegation tracking.
 */
import crypto from 'node:crypto';
import { StackAwarePersonaEngine, type TailoredSpecialist } from './swarm/StackAwarePersonaEngine.js';
import { SwarmTreeRenderer, type SwarmTreeNode } from '../cli/presentation/SwarmTreeRenderer.js';
import { DynamicCostEstimator } from '../services/pricing/DynamicCostEstimator.js';

export interface SwarmExecutionPlan {
  planId: string;
  taskDescription: string;
  specialists: TailoredSpecialist[];
  treeView: string;
  estimatedTokens: number;
  estimatedCostUsd: number;
  note: string;
}

export class DynamicSwarmPlanner {
  /**
   * Plans tech-stack tailored specialists using the StackAwarePersonaEngine.
   */
  static planSpecialists(
    taskDescription: string,
    sessionId = 'session-default',
    workspaceRoot = process.cwd()
  ): TailoredSpecialist[] {
    return StackAwarePersonaEngine.generateSpecialists(taskDescription, sessionId, workspaceRoot);
  }

  /**
   * Builds an execution plan with hierarchical tree view and cost estimate.
   * This is a PLANNING operation — no specialist work is actually performed.
   */
  static buildExecutionPlan(
    taskDescription: string,
    sessionId = 'session-default',
    workspaceRoot = process.cwd()
  ): SwarmExecutionPlan {
    const planId = `plan_${crypto.randomBytes(5).toString('hex')}`;
    const specialists = this.planSpecialists(taskDescription, sessionId, workspaceRoot);

    const rootNodes: SwarmTreeNode[] = [];
    const architect = specialists.find((s) => s.role.includes('Architect')) || specialists[0];
    const workers = specialists.filter((s) => s !== architect);

    rootNodes.push({
      id: architect.id,
      scientist: architect.scientist,
      role: architect.role,
      status: 'queued',
      currentAction: `Planned: ${architect.role} (${architect.scientist})`,
      durationMs: 0,
      children: workers.map((w) => ({
        id: w.id,
        scientist: w.scientist,
        role: w.role,
        status: 'queued',
        currentAction: `Planned: ${w.role} (${w.scientist})`,
        durationMs: 0,
      })),
    });

    const treeView = SwarmTreeRenderer.renderTree(rootNodes);

    const totalTokens = specialists.reduce((acc, s) => acc + s.maxTokensBudget, 0);
    const estimatedCostUsd = DynamicCostEstimator.estimateCost('Claude 3.7 Sonnet', {
      inputTokens: Math.floor(totalTokens * 0.7),
      outputTokens: Math.floor(totalTokens * 0.3),
      reasoningTokens: 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
    });

    return {
      planId,
      taskDescription,
      specialists,
      treeView,
      estimatedTokens: totalTokens,
      estimatedCostUsd,
      note: 'Planning-only output. No specialist execution was performed.',
    };
  }
}
