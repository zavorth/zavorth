import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  SwarmOrchestrator,
  type SwarmRole,
  type SwarmSnapshot,
  type SwarmTaskResult,
} from '../runtime/sessions/v2/SwarmOrchestrator.js';
import type { LlmRunOptions, LlmRuntimeService } from '../services/llm/LlmRuntimeService.js';
import {
  createSubagentApprovalBoundary,
  createSubagentBudget,
  createSubagentCapabilityScope,
  createSubagentResultReceipt,
  evaluateSubagentBudget,
  type SubagentBudgetInput,
  type SubagentResultReceipt,
  type SubagentResultStatus,
} from '../runtime/agent/subagents/index.js';
import { CanonicalExecutionPipelineService } from '../services/CanonicalExecutionPipelineService.js';
import { asErrorLike } from '../utils/errorLike';

import {
  SWARM_V2_OFFICIAL_CONTRACT_VERSION,
  type ManagedSwarm,
  type SwarmOrchestratorRoleDataEvent,
  type SwarmOrchestratorRoleFinishedEvent,
  type SwarmOrchestratorRoleStartedEvent,
  type SwarmV2BatchSnapshot,
  type SwarmV2CreateInput,
  type SwarmV2IsolationMode,
  type SwarmV2OfficialState,
  type SwarmV2OfficialSurface,
  type SwarmV2ReplayEvent,
  type SwarmV2RoleLibraryEntry,
  type SwarmV2TrackedSnapshot,
  type SwarmV2ToolSpec,
} from './swarm-v2/SwarmV2Types.js';
import { buildTokenBudgetSnapshot, clampNumber } from './swarm-v2/SwarmV2Budget.js';
import {
  buildBenchmarkSnapshot,
  buildOfficialMetrics,
  buildReplayInsights,
  buildToolExecutionSnapshot,
} from './swarm-v2/SwarmV2Metrics.js';
import {
  chunkRoles,
  normalizeKey,
  normalizeToolSpecs,
  resolveSyncRoleSelection,
  rolesFromLibrary,
  selectRoleIdsForObjective,
} from './swarm-v2/SwarmV2Planner.js';
import {
  readRoleLibrary,
  resolveRoleLibraryPath,
  writeRoleLibrary,
} from './swarm-v2/SwarmV2Persistence.js';

// Public API re-exports (compat for `@zavorth/agents/SwarmV2Service.js`)
export {
  SWARM_V2_OFFICIAL_CONTRACT_VERSION,
  type SwarmV2IsolationMode,
  type SwarmV2ToolSpec,
  type SwarmV2RoleSelectionSnapshot,
  type SwarmV2BenchmarkSnapshot,
  type SwarmV2TokenBudgetInput,
  type SwarmV2TokenBudgetSnapshot,
  type SwarmV2RoleLibraryEntry,
  type SwarmV2ReplayEvent,
  type SwarmV2ReplayInsights,
  type SwarmV2BatchSnapshot,
  type SwarmV2ParallelMetrics,
  type SwarmV2OfficialSurface,
  type SwarmV2CreateInput,
  type SwarmV2TrackedSnapshot,
  type ExperimentalSwarmV2CreateInput,
} from './swarm-v2/SwarmV2Types.js';

export class SwarmV2Service {
  private readonly swarms = new Map<string, ManagedSwarm>();

  constructor(
    private readonly options: {
      orchestratorFactory?: (objective: string, roles: SwarmRole[]) => SwarmOrchestrator;
      canonicalExecutionPipeline?: CanonicalExecutionPipelineService;
      roleLibraryPath?: string;
      llmRuntime?: Pick<LlmRuntimeService, 'chat'> | null;
    } = {},
  ) {}

  public launchSwarm(input: SwarmV2CreateInput): SwarmSnapshot {
    if (
      input.official
      || input.maxConcurrency
      || input.batchSize
      || input.autoSelectRoles
      || input.benchmark
      || input.requireStrongIsolation
      || (input.toolSpecs?.length || 0) > 0
      || (input.roleLibraryIds?.length || 0) > 0
    ) {
      return this.launchOfficialSwarm(input);
    }

    const objective = String(input.objective || '').trim();
    if (!objective) {
      throw new Error('objective is required.');
    }
    if (!Array.isArray(input.roles) || input.roles.length === 0) {
      throw new Error('roles obrigatorios.');
    }

    const swarmId = String(input.swarmId || '').trim() || randomUUID();
    const orchestrator = this.options.orchestratorFactory?.(objective, input.roles)
      || new SwarmOrchestrator(objective, input.roles);
    const subagentReceipts = this.resolveSubagentReceipts(input.roles, {
      objective,
      receiptSeeds: input.subagentReceipts,
      budgetInput: input.subagentBudget,
    });
    const initialSnapshot = this.withLifecycle({
      ...orchestrator.getSnapshot(),
      swarmId,
      status: 'running',
    }, {
      summary: `Swarm launched: ${objective}.`,
    }, subagentReceipts);
    const entry: ManagedSwarm = {
      swarmId,
      orchestrator,
      roles: input.roles,
      subagentReceipts,
      subagentBudget: input.subagentBudget || null,
      lastSnapshot: initialSnapshot,
      createdAt: new Date().toISOString(),
      execution: Promise.resolve(initialSnapshot),
    };

    orchestrator.on('role:data', () => {
      const snapshot = orchestrator.getSnapshot();
      entry.subagentReceipts = this.resolveSubagentReceipts(entry.roles, {
        objective,
        snapshot,
        receiptSeeds: entry.subagentReceipts,
        budgetInput: entry.subagentBudget,
      });
      entry.lastSnapshot = this.withLifecycle({
        ...snapshot,
        swarmId,
      }, {
        summary: `Swarm ${swarmId} emitted role output.`,
      }, entry.subagentReceipts);
    });
    orchestrator.on('role:finished', () => {
      const snapshot = orchestrator.getSnapshot();
      entry.subagentReceipts = this.resolveSubagentReceipts(entry.roles, {
        objective,
        snapshot,
        receiptSeeds: entry.subagentReceipts,
        budgetInput: entry.subagentBudget,
      });
      entry.lastSnapshot = this.withLifecycle({
        ...snapshot,
        swarmId,
      }, {
        summary: `Swarm ${swarmId} role finished.`,
      }, entry.subagentReceipts);
    });
    orchestrator.on('swarm:finished', (snapshot: SwarmSnapshot) => {
      entry.subagentReceipts = this.resolveSubagentReceipts(entry.roles, {
        objective,
        snapshot,
        receiptSeeds: entry.subagentReceipts,
        budgetInput: entry.subagentBudget,
      });
      entry.lastSnapshot = this.withLifecycle({
        ...snapshot,
        swarmId,
      }, {
        summary: `Swarm ${swarmId} finished with status ${snapshot.status}.`,
      }, entry.subagentReceipts);
    });

    entry.execution = orchestrator.execute()
      .then((snapshot) => {
        entry.subagentReceipts = this.resolveSubagentReceipts(entry.roles, {
          objective,
          snapshot,
          receiptSeeds: entry.subagentReceipts,
          budgetInput: entry.subagentBudget,
        });
        entry.lastSnapshot = this.withLifecycle({
          ...snapshot,
          swarmId,
        }, {
          summary: `Swarm ${swarmId} completed with status ${snapshot.status}.`,
        }, entry.subagentReceipts);
        return entry.lastSnapshot;
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error ?? '');
        const snapshot = orchestrator.getSnapshot();
        entry.subagentReceipts = this.resolveSubagentReceipts(entry.roles, {
          objective,
          snapshot,
          receiptSeeds: entry.subagentReceipts,
          budgetInput: entry.subagentBudget,
        });
        entry.lastSnapshot = this.withLifecycle({
          ...snapshot,
          swarmId,
          status: 'failed',
          finishedAt: new Date().toISOString(),
          synthesizedOutput: message || snapshot.synthesizedOutput,
        }, {
          summary: message || `Swarm ${swarmId} failed.`,
        }, entry.subagentReceipts);
        return entry.lastSnapshot;
      });

    this.swarms.set(swarmId, entry);
    return initialSnapshot;
  }

  public listSwarms(): SwarmV2TrackedSnapshot[] {
    return Array.from(this.swarms.values())
      .map((entry) => ({
        ...entry.lastSnapshot,
        swarmId: entry.swarmId,
        createdAt: entry.createdAt,
      }))
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  public getSwarm(swarmId: string): SwarmV2TrackedSnapshot | null {
    const entry = this.swarms.get(String(swarmId || '').trim());
    if (!entry) {
      return null;
    }
    return {
      ...entry.lastSnapshot,
      swarmId: entry.swarmId,
      createdAt: entry.createdAt,
    };
  }

  public async waitForSwarm(swarmId: string): Promise<SwarmV2TrackedSnapshot> {
    const entry = this.swarms.get(String(swarmId || '').trim());
    if (!entry) {
      throw new Error('Swarm v2 not found.');
    }
    const snapshot = await entry.execution;
    entry.lastSnapshot = snapshot;
    return {
      ...entry.lastSnapshot,
      swarmId: entry.swarmId,
      createdAt: entry.createdAt,
    };
  }

  public listRoleLibrary(): SwarmV2RoleLibraryEntry[] {
    return readRoleLibrary(this.options.roleLibraryPath);
  }

  public upsertRoleLibraryEntry(
    entry: Partial<SwarmV2RoleLibraryEntry> & { id: string; label: string; systemPrompt: string },
  ): SwarmV2RoleLibraryEntry {
    const now = new Date().toISOString();
    const current = readRoleLibrary(this.options.roleLibraryPath);
    const index = current.findIndex((item) => item.id === entry.id);
    const next: SwarmV2RoleLibraryEntry = {
      id: normalizeKey(entry.id, 'custom-role'),
      label: String(entry.label || '').trim() || entry.id,
      kind: entry.kind || 'custom',
      systemPrompt: String(entry.systemPrompt || '').trim(),
      defaultTools: Array.isArray(entry.defaultTools) ? entry.defaultTools.map(String) : [],
      risk: entry.risk || 'unknown',
      scope: entry.scope || 'tool_limited',
      tags: Array.isArray(entry.tags) ? entry.tags.map(String) : [],
      createdAt: index >= 0 ? current[index].createdAt : now,
      updatedAt: now,
    };
    if (!next.systemPrompt) {
      throw new Error('systemPrompt is required for role library.');
    }
    if (index >= 0) {
      current[index] = next;
    } else {
      current.push(next);
    }
    writeRoleLibrary(resolveRoleLibraryPath(this.options.roleLibraryPath), current);
    return next;
  }

  public getSwarmReplay(swarmId: string): { ok: true; events: SwarmV2ReplayEvent[] } | null {
    const entry = this.swarms.get(String(swarmId || '').trim());
    if (!entry?.officialState) {
      return null;
    }
    return { ok: true, events: entry.officialState.replay.slice() };
  }

  public async launchOfficialSwarmAsync(input: SwarmV2CreateInput): Promise<SwarmV2TrackedSnapshot> {
    if (!input.autoSelectRoles || (input.roles?.length || 0) > 0 || (input.roleLibraryIds?.length || 0) > 0) {
      return this.launchOfficialSwarm(input);
    }
    const library = readRoleLibrary(this.options.roleLibraryPath);
    const desiredRoleCount = clampNumber(input.desiredRoleCount, 1, 300, 6);
    const selection = await selectRoleIdsForObjective({
      objective: input.objective,
      desiredRoleCount,
      library,
    }, {
      llmRuntime: this.options.llmRuntime,
    });
    return this.launchOfficialSwarm({
      ...input,
      roleLibraryIds: selection.selectedRoleIds,
      maxRoles: input.maxRoles || desiredRoleCount,
      roleSelectionOverride: selection,
    });
  }

  public launchOfficialSwarm(input: SwarmV2CreateInput): SwarmV2TrackedSnapshot {
    const objective = String(input.objective || '').trim();
    if (!objective) {
      throw new Error('objective is required.');
    }

    const swarmId = String(input.swarmId || '').trim() || randomUUID();
    const createdAt = new Date().toISOString();
    const roleLibrary = readRoleLibrary(this.options.roleLibraryPath);
    const defaultIsolation = ((): SwarmV2IsolationMode => {
      const envVal = process.env.ZAVORTH_SWARM_DEFAULT_ISOLATION;
      if (
        envVal === 'direct' ||
        envVal === 'temp-worktree' ||
        envVal === 'docker' ||
        envVal === 'wsl' ||
        envVal === 'external-sandbox'
      ) {
        return envVal as SwarmV2IsolationMode;
      }
      return 'temp-worktree';
    })();
    const autoSelection = input.roleSelectionOverride || resolveSyncRoleSelection({
      objective,
      library: roleLibrary,
      selectedRoleIds: Array.isArray(input.roleLibraryIds)
        ? input.roleLibraryIds.map((entry) => normalizeKey(entry, '')).filter(Boolean)
        : [],
      requestedRoles: Array.isArray(input.roles) ? input.roles : [],
      autoSelectRoles: input.autoSelectRoles === true,
      desiredRoleCount: clampNumber(input.desiredRoleCount, 1, 300, 6),
    });
    const selectedRoleIds = autoSelection.selectedRoleIds;
    const requestedRoles = Array.isArray(input.roles) ? input.roles : [];
    const libraryRoles = rolesFromLibrary(
      roleLibrary,
      selectedRoleIds.length > 0
        ? selectedRoleIds
        : requestedRoles.length === 0
          ? ['planner', 'researcher', 'implementer', 'verifier', 'synthesizer']
          : [],
    );
    const roles = this.prepareOfficialRoles([...requestedRoles, ...libraryRoles], {
      objective,
      maxRoles: clampNumber(input.maxRoles, 1, 300, 300),
      isolationMode: input.isolationMode || defaultIsolation,
      swarmId,
      toolSpecs: normalizeToolSpecs(input.toolSpecs),
      isolationImage: input.isolationImage,
      wslDistro: input.wslDistro,
    });
    if (roles.length === 0) {
      throw new Error('roles obrigatorios.');
    }
    const tokenBudget = buildTokenBudgetSnapshot({
      objective,
      roles,
      roleSelection: autoSelection,
      input: input.tokenBudget,
      benchmark: input.benchmark === true,
      hasLlmRuntime: Boolean(this.options.llmRuntime),
    });
    if (tokenBudget.status !== 'passed') {
      throw new Error(`Swarm Token Budget Guard: ${tokenBudget.status}. ${tokenBudget.rationale}`);
    }

    const maxConcurrency = clampNumber(input.maxConcurrency, 1, 30, Math.min(6, roles.length));
    const batchSize = clampNumber(input.batchSize, 1, maxConcurrency, maxConcurrency);
    const batches = chunkRoles(roles, batchSize).map((batch, index): SwarmV2BatchSnapshot => ({
      batchId: `${swarmId}:batch-${index + 1}`,
      index,
      status: 'queued',
      roleIds: batch.map((role) => role.id),
      maxConcurrency,
      startedAt: null,
      finishedAt: null,
    }));
    const state: SwarmV2OfficialState = {
      swarmId,
      objective,
      createdAt,
      roles,
      selectedRoleIds,
      queueStatus: 'queued',
      maxRoles: 300,
      maxConcurrency,
      batches,
      replay: [],
      isolationMode: input.isolationMode || defaultIsolation,
      workerRoots: roles.map((role) => ({
        roleId: role.id,
        cwd: role.cwd || process.cwd(),
        mode: role.isolation?.mode || 'direct',
      })),
      synthesisStatus: 'pending',
      synthesisMode: this.options.llmRuntime ? 'llm' : 'deterministic',
      synthesisSummary: 'Synthesis is waiting for batches to complete.',
      startedAt: createdAt,
      roleSelection: {
        ...autoSelection,
        selectedRoleIds: selectedRoleIds.length > 0 ? selectedRoleIds.slice() : roles.map((role) => role.id),
        requestedRoleCount: roles.length,
        availableRoleCount: roleLibrary.length,
      },
      toolSpecs: normalizeToolSpecs(input.toolSpecs),
      benchmarkEnabled: input.benchmark === true,
      tokenBudget,
      strongIsolationRequired: input.requireStrongIsolation === true,
      strongIsolationSatisfied: this.isStrongIsolationMode(input.isolationMode || defaultIsolation),
      strongIsolationWrapper: this.strongIsolationWrapper(input.isolationMode || defaultIsolation),
    };
    if (state.strongIsolationRequired && !state.strongIsolationSatisfied) {
      throw new Error('Swarm v2 exige isolamento forte: use isolationMode docker, wsl ou external-sandbox.');
    }
    this.pushReplay(state, 'swarm.queued', 'Swarm oficial enfileirado.', {
      roleCount: roles.length,
      maxConcurrency,
      batchSize,
      autoSelectRoles: input.autoSelectRoles === true,
      benchmark: input.benchmark === true,
      strongIsolation: state.strongIsolationSatisfied,
    });
    this.pushReplay(state, 'role.selection', 'Roles selecionadas para o Swarm oficial.', {
      mode: state.roleSelection.mode,
      selectedRoleIds: state.roleSelection.selectedRoleIds,
      rationale: state.roleSelection.rationale,
    });
    for (const role of roles) {
      if (!role.toolSpecId) continue;
      this.pushReplay(state, 'role.tool.bound', `Tool spec ${role.toolSpecId} ligado a role ${role.id}.`, {
        roleId: role.id,
        toolSpecId: role.toolSpecId,
      });
    }
    for (const batch of batches) {
      this.pushReplay(state, 'batch.queued', `Batch ${batch.index + 1} is waiting for execution.`, {
        batchId: batch.batchId,
        roleIds: batch.roleIds,
      });
    }

    const initialSnapshot = this.withOfficialSurface(this.withLifecycle({
      swarmId,
      status: 'running',
      objective,
      roles: [],
      startedAt: createdAt,
      finishedAt: null,
      synthesizedOutput: null,
    }, {
      summary: `Official Swarm v2 queued: ${objective}.`,
    }, []), state);

    const entry: ManagedSwarm = {
      swarmId,
      orchestrator: null,
      roles,
      subagentReceipts: [],
      subagentBudget: input.subagentBudget || null,
      lastSnapshot: initialSnapshot,
      createdAt,
      execution: Promise.resolve(initialSnapshot),
      officialState: state,
    };

    entry.execution = this.executeOfficialBatches(entry, input);
    this.swarms.set(swarmId, entry);
    return { ...initialSnapshot, createdAt };
  }

  public cancelSwarm(swarmId: string): SwarmV2TrackedSnapshot {
    const entry = this.swarms.get(String(swarmId || '').trim());
    if (!entry) {
      throw new Error('Swarm v2 not found.');
    }
    if (entry.officialState) {
      entry.orchestrator?.killAll();
      entry.officialState.queueStatus = 'cancelled';
      entry.officialState.synthesisStatus = 'failed';
      entry.officialState.synthesisSummary = 'Swarm cancelled by the operator.';
      for (const batch of entry.officialState.batches) {
        if (batch.status === 'queued' || batch.status === 'running') {
          batch.status = 'cancelled';
          batch.finishedAt = new Date().toISOString();
        }
      }
      this.pushReplay(entry.officialState, 'swarm.cancelled', `Swarm ${entry.swarmId} cancelled by the operator.`);
      entry.lastSnapshot = this.withOfficialSurface({
        ...entry.lastSnapshot,
        status: 'cancelled',
        finishedAt: new Date().toISOString(),
        synthesizedOutput: entry.officialState.synthesisSummary,
      }, entry.officialState);
      return {
        ...entry.lastSnapshot,
        swarmId: entry.swarmId,
        createdAt: entry.createdAt,
      };
    }
    if (!entry.orchestrator) {
      throw new Error('Swarm v2 has no active orchestrator.');
    }
    entry.orchestrator.killAll();
    const snapshot = entry.orchestrator.getSnapshot();
    entry.subagentReceipts = this.resolveSubagentReceipts(entry.roles, {
      objective: snapshot.objective,
      snapshot,
      receiptSeeds: entry.subagentReceipts,
      budgetInput: entry.subagentBudget,
    });
    entry.lastSnapshot = this.withLifecycle({
      ...snapshot,
      swarmId: entry.swarmId,
      status: 'failed',
    }, {
      summary: `Swarm ${entry.swarmId} cancelled by operator.`,
    }, entry.subagentReceipts);
    return {
      ...entry.lastSnapshot,
      swarmId: entry.swarmId,
      createdAt: entry.createdAt,
    };
  }

  public shutdown(): void {
    for (const entry of this.swarms.values()) {
      entry.orchestrator?.killAll();
    }
    this.swarms.clear();
  }

  private async executeOfficialBatches(
    entry: ManagedSwarm,
    input: SwarmV2CreateInput,
  ): Promise<SwarmSnapshot> {
    const state = entry.officialState;
    if (!state) {
      return entry.lastSnapshot;
    }
    state.queueStatus = 'running';
    const allResults: SwarmTaskResult[] = [];
    let finalStatus: SwarmSnapshot['status'] = 'completed';

    for (const batch of state.batches) {
      const queueStatus: SwarmV2OfficialSurface['queue']['status'] = entry.officialState?.queueStatus || state.queueStatus;
      if (queueStatus === 'cancelled') {
        finalStatus = 'cancelled';
        break;
      }
      batch.status = 'running';
      batch.startedAt = new Date().toISOString();
      this.pushReplay(state, 'batch.started', `Batch ${batch.index + 1} iniciado.`, {
        batchId: batch.batchId,
        roleIds: batch.roleIds,
      });
      const batchRoles = state.roles.filter((role) => batch.roleIds.includes(role.id));
      const orchestrator = this.options.orchestratorFactory?.(state.objective, batchRoles)
        || new SwarmOrchestrator(entry.lastSnapshot.objective, batchRoles, {
          roleTimeoutMs: input.subagentBudget?.maxWallClockMs || 120000,
          traceId: entry.lastSnapshot.traceId || entry.swarmId,
          runId: entry.lastSnapshot.runId || entry.swarmId,
          sessionId: entry.lastSnapshot.sessionId || null,
          surface: 'swarm-v2-official',
        });
      entry.orchestrator = orchestrator;
      orchestrator.on('role:started', (event: SwarmOrchestratorRoleStartedEvent) => {
        this.pushReplay(state, 'role.started', `Role ${String(event.label || event.roleId || 'unknown')} iniciado.`, {
          batchId: batch.batchId,
          roleId: event.roleId,
        });
      });
      orchestrator.on('role:data', (event: SwarmOrchestratorRoleDataEvent) => {
        this.pushReplay(state, 'role.output', `Role ${String(event.roleId || 'unknown')} emitiu output.`, {
          batchId: batch.batchId,
          roleId: event.roleId,
          bytes: Buffer.byteLength(String(event.data || ''), 'utf8'),
        });
      });
      orchestrator.on('role:finished', (event: SwarmOrchestratorRoleFinishedEvent) => {
        this.pushReplay(state, 'role.finished', `Role ${String(event.roleId || 'unknown')} finalizado.`, {
          batchId: batch.batchId,
          roleId: event.roleId,
          status: event.status,
          exitCode: event.exitCode,
        });
      });

      const batchSnapshot = await orchestrator.execute();
      allResults.push(...batchSnapshot.roles);
      batch.finishedAt = new Date().toISOString();
      batch.status = batchSnapshot.status === 'completed'
        ? 'completed'
        : batchSnapshot.status === 'cancelled'
          ? 'cancelled'
          : 'failed';
      this.pushReplay(state, 'batch.finished', `Batch ${batch.index + 1} finalizado como ${batch.status}.`, {
        batchId: batch.batchId,
        status: batchSnapshot.status,
      });
      if (batchSnapshot.status === 'timed_out') {
        finalStatus = 'timed_out';
      } else if (batchSnapshot.status === 'cancelled') {
        finalStatus = 'cancelled';
      } else if (batchSnapshot.status !== 'completed' && finalStatus === 'completed') {
        finalStatus = 'failed';
      }

      const intermediate = this.buildOfficialSnapshot(entry, state, allResults, finalStatus, null);
      entry.lastSnapshot = intermediate;
      if ((entry.officialState?.queueStatus as SwarmV2OfficialSurface['queue']['status'] | undefined) === 'cancelled') {
        finalStatus = 'cancelled';
        break;
      }
    }

    state.queueStatus = finalStatus === 'completed' ? 'completed' : finalStatus === 'cancelled' ? 'cancelled' : 'failed';
    state.synthesisStatus = finalStatus === 'cancelled' ? 'failed' : 'completed';
    state.synthesisMode = this.options.llmRuntime && finalStatus !== 'cancelled' ? 'llm' : 'deterministic';
    const synthesizedOutput = finalStatus === 'cancelled'
      ? state.synthesisSummary
      : await this.synthesizeOfficialOutput(state, allResults, finalStatus);
    state.synthesisSummary = finalStatus === 'cancelled'
      ? 'Swarm cancelled by the operator.'
      : `Sintese oficial gerada com ${allResults.length}/${state.roles.length} role(s).`;
    this.pushReplay(state, 'swarm.synthesized', state.synthesisSummary, {
      outputChars: synthesizedOutput.length,
      finalStatus,
    });
    entry.subagentReceipts = this.resolveSubagentReceipts(state.roles, {
      objective: state.objective,
      snapshot: {
        ...entry.lastSnapshot,
        roles: allResults,
        status: finalStatus,
        synthesizedOutput,
      },
      receiptSeeds: entry.subagentReceipts,
      budgetInput: entry.subagentBudget,
    });
    entry.lastSnapshot = this.buildOfficialSnapshot(entry, state, allResults, finalStatus, synthesizedOutput);
    return entry.lastSnapshot;
  }

  private buildOfficialSnapshot(
    entry: ManagedSwarm,
    state: SwarmV2OfficialState,
    roles: SwarmTaskResult[],
    status: SwarmSnapshot['status'],
    synthesizedOutput: string | null,
  ): SwarmSnapshot {
    return this.withOfficialSurface(this.withLifecycle({
      ...entry.lastSnapshot,
      swarmId: entry.swarmId,
      status,
      objective: state.objective,
      roles,
      startedAt: state.startedAt,
      finishedAt: status === 'running' ? null : new Date().toISOString(),
      synthesizedOutput,
    }, {
      summary: `Official Swarm v2 ${status} with ${roles.length} role result(s).`,
    }, entry.subagentReceipts), state);
  }

  private withOfficialSurface(snapshot: SwarmSnapshot, state: SwarmV2OfficialState): SwarmSnapshot & SwarmV2OfficialSurface {
    const metrics = buildOfficialMetrics(snapshot, state);
    return {
      ...snapshot,
      official: true,
      experimental: false,
      contractVersion: SWARM_V2_OFFICIAL_CONTRACT_VERSION,
      queue: {
        mode: 'batch-queue',
        status: state.queueStatus,
        maxRoles: state.maxRoles,
        maxConcurrency: state.maxConcurrency,
        pendingBatchIds: state.batches.filter((batch) => batch.status === 'queued').map((batch) => batch.batchId),
      },
      batches: state.batches.map((batch) => ({ ...batch, roleIds: batch.roleIds.slice() })),
      replay: {
        eventCount: state.replay.length,
        events: state.replay.slice(-200),
      },
      replayInsights: buildReplayInsights(snapshot, state),
      metrics,
      roleLibrary: {
        persistent: true,
        selectedRoleIds: state.selectedRoleIds.slice(),
        availableRoleCount: readRoleLibrary(this.options.roleLibraryPath).length,
      },
      isolation: {
        mode: state.isolationMode,
        workersIsolated: state.isolationMode !== 'direct',
        workerRoots: state.workerRoots.map((worker) => ({ ...worker })),
        note: state.isolationMode === 'temp-worktree'
          ? 'Cada role roda em cwd temporario separado; use docker/wsl/external-sandbox para isolamento de SO forte.'
          : 'Isolamento declarado pelo perfil do worker e registrado nos receipts.',
      },
      synthesis: {
        mode: state.synthesisMode,
        status: state.synthesisStatus,
        summary: state.synthesisSummary,
      },
      roleSelection: {
        ...state.roleSelection,
        selectedRoleIds: state.roleSelection.selectedRoleIds.slice(),
      },
      toolExecution: buildToolExecutionSnapshot(snapshot, state),
      benchmark: buildBenchmarkSnapshot(snapshot, state, metrics),
      tokenBudget: state.tokenBudget,
      strongIsolation: {
        required: state.strongIsolationRequired,
        satisfied: state.strongIsolationSatisfied,
        mode: state.isolationMode,
        wrapper: state.strongIsolationWrapper,
        note: state.strongIsolationRequired
          ? 'Strong isolation was explicitly required by the operator.'
          : 'Strong isolation is optional for this run; sensitive mutations still require approval.',
      },
    };
  }

  private async synthesizeOfficialOutput(
    state: SwarmV2OfficialState,
    results: SwarmTaskResult[],
    status: SwarmSnapshot['status'],
  ): Promise<string> {
    const lines = [
      '# Swarm v2 Official Synthesis',
      '',
      `Status: ${status}`,
      `Objective: ${state.objective}`,
      `Roles: ${results.length}/${state.roles.length}`,
      `Batches: ${state.batches.filter((batch) => batch.status === 'completed').length}/${state.batches.length}`,
      `Max concurrency: ${state.maxConcurrency}`,
      '',
      '## Role results',
    ];
    for (const result of results) {
      const text = result.output.join('').trim();
      lines.push(
        '',
        `### ${result.label} (${result.status})`,
        text ? text.slice(0, 4000) : 'No output captured.',
      );
    }
    lines.push(
      '',
      '## Operational notes',
      `Replay events: ${state.replay.length}`,
      `Isolation: ${state.isolationMode}`,
      'Mutation remains governed by Zavorth approvals and receipts.',
    );
    const deterministic = lines.join('\n');

    if (!this.options.llmRuntime) {
      return deterministic;
    }

    try {
      const response = await this.options.llmRuntime.chat([
        {
          role: 'user',
          content: [
            'You are Zavorth Swarm v2 final synthesizer.',
            'Create a concise, accurate final report from the role outputs below.',
            'Preserve blockers, failed roles, metrics and next safe steps.',
            'Do not expose chain-of-thought or raw secrets.',
            '',
            deterministic,
          ].join('\n'),
        },
      ], [], {
        allowFallback: true,
        telemetry: {
          surface: 'swarm-v2-official',
          runId: state.swarmId,
          traceId: state.swarmId,
        },
      } satisfies LlmRunOptions);
      return response.content?.trim() || deterministic;
    } catch (error: unknown) {
      const err = asErrorLike(error);
      void err;
      this.pushReplay(state, 'swarm.failed', 'LLM synthesis failed; deterministic synthesis was used.', {
        error: String(error instanceof Error ? err.message : String(error ?? 'unknown')).slice(0, 240),
      });
      state.synthesisMode = 'deterministic';
      return deterministic;
    }
  }

  private isStrongIsolationMode(mode: SwarmV2IsolationMode): boolean {
    return mode === 'docker' || mode === 'wsl' || mode === 'external-sandbox';
  }

  private strongIsolationWrapper(mode: SwarmV2IsolationMode): SwarmV2OfficialSurface['strongIsolation']['wrapper'] {
    if (mode === 'docker') return 'docker';
    if (mode === 'wsl') return 'wsl';
    if (mode === 'external-sandbox') return 'external-sandbox';
    return 'none';
  }

  private prepareOfficialRoles(
    roles: SwarmRole[],
    input: {
      objective: string;
      maxRoles: number;
      isolationMode: SwarmV2IsolationMode;
      swarmId: string;
      toolSpecs: SwarmV2ToolSpec[];
      isolationImage?: string | null;
      wslDistro?: string | null;
    },
  ): SwarmRole[] {
    return roles.slice(0, input.maxRoles).map((role, index) => {
      const id = normalizeKey(role.id || `role-${index + 1}`, `role-${index + 1}`);
      const cwd = this.resolveRoleCwd(input.swarmId, id, input.isolationMode, role.cwd);
      const toolSpec = !role.command && input.toolSpecs.length > 0
        ? input.toolSpecs[index % input.toolSpecs.length]
        : null;
      const commandRole = toolSpec
        ? this.applyToolSpecToRole(role, toolSpec)
        : role;
      const isolatedCommand = this.applyStrongIsolationWrapper(commandRole, {
        mode: input.isolationMode,
        cwd,
        isolationImage: input.isolationImage,
        wslDistro: input.wslDistro,
      });
      return {
        ...isolatedCommand,
        id,
        label: String(role.label || `Role ${index + 1}`).trim(),
        systemPrompt: String(role.systemPrompt || 'Execute sua parte da missao com saida objetiva e auditavel.').trim(),
        cwd,
        toolSpecId: toolSpec?.id || role.toolSpecId || null,
        isolation: {
          mode: input.isolationMode,
          workerId: `${input.swarmId}:${id}`,
          receiptId: `swarm-isolation:${input.swarmId}:${id}`,
          description: `Official Swarm v2 worker for ${id}.`,
        },
        delegationPolicy: role.delegationPolicy,
      };
    });
  }

  private resolveRoleCwd(
    swarmId: string,
    roleId: string,
    mode: SwarmV2IsolationMode,
    requestedCwd?: string,
  ): string {
    if (mode === 'direct') {
      return requestedCwd || process.cwd();
    }
    if (mode === 'temp-worktree') {
      const root = path.join(os.tmpdir(), 'zavorth-swarm-v2', normalizeKey(swarmId, 'swarm'), roleId);
      fs.mkdirSync(root, { recursive: true });
      return root;
    }
    return requestedCwd || process.cwd();
  }

  private applyToolSpecToRole(role: SwarmRole, tool: SwarmV2ToolSpec): SwarmRole {
    return {
      ...role,
      command: tool.command,
      args: tool.args?.slice() || [],
      cwd: tool.cwd || role.cwd,
      stdinMode: 'none',
      toolSpecId: tool.id,
    };
  }

  private applyStrongIsolationWrapper(
    role: SwarmRole,
    input: {
      mode: SwarmV2IsolationMode;
      cwd: string;
      isolationImage?: string | null;
      wslDistro?: string | null;
    },
  ): SwarmRole {
    if (!role.command) {
      return role;
    }
    if (input.mode === 'docker') {
      const image = String(input.isolationImage || 'node:22').trim();
      return {
        ...role,
        command: 'docker',
        args: [
          'run',
          '--rm',
          '--network',
          'none',
          '-v',
          `${input.cwd}:/workspace`,
          '-w',
          '/workspace',
          image,
          role.command,
          ...(role.args || []),
        ],
        cwd: input.cwd,
        stdinMode: 'none',
      };
    }
    if (input.mode === 'wsl' && process.platform === 'win32') {
      const distro = String(input.wslDistro || '').trim();
      return {
        ...role,
        command: 'wsl.exe',
        args: [
          ...(distro ? ['-d', distro] : []),
          '--cd',
          input.cwd,
          '--',
          role.command,
          ...(role.args || []),
        ],
        cwd: input.cwd,
        stdinMode: 'none',
      };
    }
    return role;
  }

  private pushReplay(
    state: SwarmV2OfficialState,
    type: SwarmV2ReplayEvent['type'],
    summary: string,
    payload: Record<string, unknown> = {},
  ): void {
    state.replay.push({
      id: `swarm-replay-${state.replay.length + 1}`,
      at: new Date().toISOString(),
      type,
      swarmId: state.swarmId,
      batchId: typeof payload.batchId === 'string' ? payload.batchId : null,
      roleId: typeof payload.roleId === 'string' ? payload.roleId : null,
      summary,
      payload,
    });
  }

  private withLifecycle(
    snapshot: SwarmSnapshot,
    input: { summary: string },
    subagentReceipts: SubagentResultReceipt[] = snapshot.subagentReceipts || [],
  ): SwarmSnapshot {
    const canonicalExecution = this.options.canonicalExecutionPipeline || new CanonicalExecutionPipelineService();
    const link = canonicalExecution.buildLink({
      engine: 'swarm',
      kind: 'run',
      id: snapshot.swarmId,
      status: canonicalExecution.mapSwarmStatus(snapshot.status),
      summary: input.summary,
      objective: snapshot.objective,
      requestedBy: 'operator',
      surface: 'swarm-v2',
      traceId: snapshot.traceId || snapshot.swarmId,
      runId: snapshot.runId || snapshot.swarmId,
      at: snapshot.finishedAt || snapshot.startedAt,
      metadata: {
        roleCount: snapshot.roles.length,
        roleStatuses: snapshot.roles.map((role) => ({
          roleId: role.roleId,
          status: role.status,
        })),
        subagentReceiptCount: subagentReceipts.length,
        subagentReceiptStatuses: subagentReceipts.map((receipt) => ({
          roleId: receipt.roleId,
          status: receipt.status,
          budgetExceeded: receipt.budgetDecision.exceeded,
          approvalRequired: receipt.approvalBoundary.requiresApproval,
        })),
      },
    });
    return {
      ...snapshot,
      subagentReceipts,
      traceId: link.traceId,
      runId: link.runId,
      sessionId: link.sessionId,
      execution_lifecycle: canonicalExecution.mergeLifecycle(snapshot.execution_lifecycle, link.lifecycle),
    };
  }

  private resolveSubagentReceipts(
    roles: SwarmRole[],
    input: {
      objective: string;
      snapshot?: SwarmSnapshot | null;
      receiptSeeds?: SubagentResultReceipt[] | null;
      budgetInput?: SubagentBudgetInput | null;
    },
  ): SubagentResultReceipt[] {
    const resultsByRole = new Map((input.snapshot?.roles || []).map((result) => [result.roleId, result]));
    const seedsByRole = new Map((input.receiptSeeds || []).map((receipt) => [receipt.roleId, receipt]));

    return roles.map((role) => {
      const result = resultsByRole.get(role.id);
      const seed = seedsByRole.get(role.id);
      const outputBytes = result ? Buffer.byteLength(result.output.join(''), 'utf8') : 0;
      const elapsedMs = this.calculateRoleElapsedMs(result);
      const budget = createSubagentBudget({
        maxToolCalls: input.budgetInput?.maxToolCalls ?? seed?.budget.maxToolCalls ?? 0,
        maxWallClockMs: input.budgetInput?.maxWallClockMs ?? seed?.budget.maxWallClockMs ?? 120000,
        maxOutputBytes: input.budgetInput?.maxOutputBytes ?? seed?.budget.maxOutputBytes ?? 65536,
        usedToolCalls: seed?.budget.usedToolCalls ?? 0,
        elapsedMs,
        outputBytes,
        policyTags: [
          ...(seed?.budget.policyTags ?? []),
          ...(input.budgetInput?.policyTags ?? []),
          'swarm-v2-subagent-budget',
        ],
        metadata: {
          ...(seed?.budget.metadata ?? {}),
          ...(input.budgetInput?.metadata ?? {}),
          objective: input.objective,
          swarmId: input.snapshot?.swarmId || null,
          roleId: role.id,
          outputBytes,
        },
      });
      const allowedTools = role.delegationPolicy?.allowedTools ?? this.resolveRoleTools(role);
      const requiresApproval = role.delegationPolicy?.requiresApprovalTools
        ? role.delegationPolicy.requiresApprovalTools.length > 0
        : true;

      const scope = seed?.scope || createSubagentCapabilityScope({
        roleId: role.id,
        mode: 'tool_limited',
        allowedTools,
        allowedPaths: [],
        requiresApproval,
        metadata: {
          objective: input.objective,
          swarmRoleLabel: role.label,
          command: role.command || null,
          delegationPolicy: role.delegationPolicy ? JSON.stringify(role.delegationPolicy) : null,
        },
      });
      const approvalBoundary = seed?.approvalBoundary || createSubagentApprovalBoundary({
        scope,
        budget,
        risk: role.delegationPolicy?.requiresApprovalTools && role.delegationPolicy.requiresApprovalTools.length === 0
          ? 'unknown'
          : (role.command ? 'attention' : 'unknown'),
        approvalReason: 'SwarmV2 records the approval boundary before subagent execution.',
        metadata: {
          objective: input.objective,
          swarmRoleLabel: role.label,
          swarmId: input.snapshot?.swarmId || null,
        },
      });
      if (role.delegationPolicy?.requiresApprovalTools && role.delegationPolicy.requiresApprovalTools.length === 0) {
        approvalBoundary.requiresApproval = false;
      }
      const budgetDecision = evaluateSubagentBudget(budget);
      const status = budgetDecision.ok
        ? this.mapSubagentStatus(result, input.snapshot)
        : 'budget_exceeded';

      return createSubagentResultReceipt({
        roleId: role.id,
        status,
        summary: result
          ? `Swarm subagent ${role.label} finished with status ${result.status}.`
          : `Swarm subagent ${role.label} registered before execution.`,
        scope,
        budget,
        approvalBoundary,
        budgetDecision,
        artifacts: outputBytes > 0 ? [`swarm-output:${role.id}`] : [],
        risks: approvalBoundary.requiresApproval ? ['approval-boundary-required'] : [],
        policyTags: ['swarm-v2-subagent-receipt'],
        metadata: {
          objective: input.objective,
          swarmId: input.snapshot?.swarmId || null,
          roleLabel: role.label,
          roleStatus: result?.status || null,
          outputBytes,
        },
      });
    });
  }

  private resolveRoleTools(role: SwarmRole): string[] {
    const command = String(role.command || '').trim();
    return command ? [command] : ['swarm-session'];
  }

  private mapSubagentStatus(
    result: SwarmTaskResult | undefined,
    snapshot: SwarmSnapshot | null | undefined,
  ): SubagentResultStatus {
    if (!result) {
      return snapshot?.status === 'failed' || snapshot?.status === 'cancelled' ? 'failed' : 'planned';
    }
    if (result.status === 'IDLE') {
      return 'completed';
    }
    if (result.status === 'TIMEOUT') {
      return 'budget_exceeded';
    }
    if (result.status === 'CANCELLED') {
      return 'blocked';
    }
    return 'failed';
  }

  private calculateRoleElapsedMs(result: SwarmTaskResult | undefined): number {
    if (!result?.startedAt || !result.finishedAt) {
      return 0;
    }
    const elapsed = new Date(result.finishedAt).getTime() - new Date(result.startedAt).getTime();
    return Number.isFinite(elapsed) ? Math.max(0, elapsed) : 0;
  }
}

export {
  SwarmV2Service as ExperimentalSwarmV2Service,
};
