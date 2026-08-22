import { CapabilityPolicyService } from './CapabilityPolicyService.js';

import crypto from 'crypto';
import { LocalExecutor } from '../execution/LocalExecutor.js';
import type { ExecutionRequest, ExecutionResult } from '../contracts/ExecutionContract.js';
import type {
  SystemOverlordAdapterResult,
  SystemOverlordRuntimeAdapter,
} from '../contracts/SystemOverlordAdapterContract.js';
import type {
  SystemOverlordActionRecord,
  SystemOverlordActionMutationRequest,
  SystemOverlordActionRequest,
  SystemOverlordCapability,
  SystemOverlordApprovalDecision,
  SystemOverlordKillSwitchState,
  SystemOverlordKillSwitchToggleRequest,
} from '../contracts/SystemOverlordContract.js';

import { HostActionLedgerService } from './HostActionLedgerService.js';
import { SupervisedRuntimeAdapterRegistryService } from './SupervisedRuntimeAdapterRegistryService.js';
import { SupervisedExecutionGatewayRecordBuilder } from './supervised-execution/SupervisedExecutionGatewayRecordBuilder.js';
import { logger } from '../logger.js';
import { asErrorLike, errorMessage } from '../utils/errorLike.js';
type ExecutionRunner = (request: ExecutionRequest) => Promise<ExecutionResult>;
type ActiveActionHandle = {
  actionId: string;
  adapter: SystemOverlordRuntimeAdapter | null;
  cancel?: ((reason?: string | null) => Promise<SystemOverlordAdapterResult>) | null;
  cancelled: boolean;
};

export class SupervisedExecutionGatewayService {
  private readonly policy: CapabilityPolicyService;
  private readonly ledger: HostActionLedgerService;
  private readonly runner: ExecutionRunner;
  private readonly adapterRegistry: SupervisedRuntimeAdapterRegistryService;
  private readonly recordBuilder: SupervisedExecutionGatewayRecordBuilder;
  private readonly activeActions = new Map<string, ActiveActionHandle>();
  private killSwitchState: Omit<SystemOverlordKillSwitchState, 'activeActionCount' | 'cancellableActionCount'> = {
    active: false,
    reason: null,
    activatedAt: null,
    activatedBy: null,
    releasedAt: null,
    releasedBy: null,
  };

  constructor(options: {
    policyService?: CapabilityPolicyService;
    ledgerService?: HostActionLedgerService;
    runner?: ExecutionRunner;
    adapterRegistry?: SupervisedRuntimeAdapterRegistryService;
  } = {}) {
    this.policy = options.policyService || new CapabilityPolicyService();
    this.ledger = options.ledgerService || new HostActionLedgerService();
    const localExecutor = new LocalExecutor();
    this.runner = options.runner || ((request) => localExecutor.execute(request));
    this.adapterRegistry = options.adapterRegistry || new SupervisedRuntimeAdapterRegistryService();
    this.recordBuilder = new SupervisedExecutionGatewayRecordBuilder((actionId) => {
      try {
        return this.ledger.find(actionId)?.metadata?.execution_lifecycle;
      } catch (error: unknown) {logger.warn('[Supervised Execution way] process execution failed', error); return null; }
    });
  }

  public inferCapabilityFromCommand(command: string): SystemOverlordCapability {
    return this.policy.inferCapabilityFromCommand(command);
  }

  public async execute(input: SystemOverlordActionRequest): Promise<SystemOverlordActionRecord> {
    const actionId = String(input.actionId || '').trim() || `host-action-${crypto.randomUUID()}`;
    const createdAt = new Date().toISOString();
    const command = String(input.command || '').trim() || null;
    const workspace = String(input.workspace || '').trim() || process.cwd();
    const request: SystemOverlordActionRequest = {
      ...input,
      actionId,
      command,
      workspace,
      profile: input.profile || 'safe',
      autonomyLevel: input.autonomyLevel || 1,
      approved: input.approved === true,
      dryRun: input.dryRun === true,
    };
    if (this.killSwitchState.active) {
      return this.ledger.record(this.recordBuilder.buildRecord({
        actionId,
        createdAt,
        request,
        status: 'blocked',
        decision: this.policy.evaluate({
          ...request,
          dryRun: true,
        }),
        command,
        workspace,
        errorCode: 'kill_switch_active',
        errorMessage: this.killSwitchState.reason || 'Kill switch supervised active; new actions foram blocked.',
        metadata: {
          killSwitch: this.getKillSwitchState(),
        },
      }));
    }
    const decision = this.policy.evaluate(request);

    if (!decision.allowed) {
      return this.ledger.record(this.recordBuilder.buildRecord({
        actionId,
        createdAt,
        request,
        status: decision.requiresApproval ? 'pending_approval' : 'blocked',
        decision,
        command,
        workspace,
        errorCode: decision.blockedReason || 'policy_blocked',
        errorMessage: decision.reason,
      }));
    }

    if (request.dryRun) {
      return this.ledger.record(this.recordBuilder.buildRecord({
        actionId,
        createdAt,
        request,
        status: 'dry_run',
        decision,
        command,
        workspace,
        metadata: {
          dryRun: true,
          plannedRuntimeTarget: decision.runtimeTarget,
        },
      }));
    }

    const adapter = this.adapterRegistry.findAdapter(request, decision);
    this.ledger.record(this.recordBuilder.buildRecord({
      actionId,
      createdAt,
      request,
      status: 'running',
      decision,
      command,
      workspace,
      metadata: {
        runtimeTarget: decision.runtimeTarget,
        adapterId: adapter?.id || null,
      },
    }));
    if (adapter) {
      const activeHandle: ActiveActionHandle = {
        actionId,
        adapter,
        cancel: typeof adapter.cancel === 'function'
          ? (reason) => adapter.cancel!(actionId, reason)
          : null,
        cancelled: false,
      };
      this.activeActions.set(actionId, {
        ...activeHandle,
      });
      try {
        const supervisedResult = await this.runWithTimeout({
          actionId,
          timeoutMs: this.resolveActionTimeoutMs(request),
          run: () => adapter.execute(request, decision),
          cancel: activeHandle.cancel,
          timeoutReason: `Timeout supervised da action ${actionId}.`,
        });
        if (supervisedResult.timedOut === true) {
          return this.ledger.record(this.recordBuilder.buildRecord({
            actionId,
            createdAt,
            request,
            status: 'timed_out',
            decision,
            command,
            workspace,
            stdout: supervisedResult.cancelResult?.stdout || null,
            stderr: supervisedResult.cancelResult?.stderr || null,
            errorCode: 'action_timed_out',
            errorMessage: `Action supervised excedeu ${supervisedResult.timeoutMs}ms and was marked as timed_out.`,
            metadata: {
              adapterId: adapter.id,
              timeoutMs: supervisedResult.timeoutMs,
              cancelAttempted: Boolean(activeHandle.cancel),
              cancelResult: supervisedResult.cancelResult || null,
              cancelError: supervisedResult.cancelError || null,
            },
          }));
        }
        const adapterResult = supervisedResult.value;
        if (this.isCancelled(actionId)) {
          return this.ledger.find(actionId) || this.recordBuilder.buildRecord({
            actionId,
            createdAt,
            request,
            status: 'cancelled',
            decision,
            command,
            workspace,
            errorCode: 'action_cancelled',
            errorMessage: 'Supervised action canceled during execution.',
          });
        }
        return this.ledger.record(this.recordBuilder.buildRecord({
          actionId,
          createdAt,
          request,
          status: adapterResult.ok ? 'completed' : 'failed',
          decision,
          command,
          workspace,
          stdout: adapterResult.stdout || null,
          stderr: adapterResult.stderr || null,
          errorCode: adapterResult.errorCode || null,
          errorMessage: adapterResult.errorMessage || null,
          rollbackAvailable: Boolean(adapterResult.rollbackAvailable),
          metadata: {
            ...(adapterResult.metadata || {}),
            adapterId: adapter.id,
          },
        }));
      } catch (error: unknown) {
        asErrorLike(error);
        if (this.isCancelled(actionId)) {
          return this.ledger.find(actionId) || this.recordBuilder.buildRecord({
            actionId,
            createdAt,
            request,
            status: 'cancelled',
            decision,
            command,
            workspace,
            errorCode: 'action_cancelled',
            errorMessage: 'Supervised action canceled during execution.',
          });
        }
        return this.ledger.record(this.recordBuilder.buildRecord({
          actionId,
          createdAt,
          request,
          status: 'failed',
          decision,
          command,
          workspace,
          errorCode: 'adapter_exception',
          errorMessage: errorMessage(error),
          metadata: {
            adapterId: adapter.id,
          },
        }));
      } finally {
        this.activeActions.delete(actionId);
      }
    }

    if (!command && this.canRunWithLocalExecutor(decision.runtimeTarget || decision.target)) {
      return this.ledger.record(this.recordBuilder.buildRecord({
        actionId,
        createdAt,
        request,
        status: 'blocked',
        decision,
        command,
        workspace,
        errorCode: 'runtime_adapter_unavailable',
        errorMessage: `Runtime ${decision.runtimeTarget} still requires a specialized adapter before running.`,
      }));
    }

    const executionRequest = this.toExecutionRequest({
      actionId,
      request,
      command: command || '',
      workspace,
      sandboxRequired: decision.runtimeTarget === 'container',
      microvmRequired: decision.runtimeTarget === 'microvm',
    });

    try {
      this.activeActions.set(actionId, {
        actionId,
        adapter: null,
        cancel: null,
        cancelled: false,
      });
      const supervisedResult = await this.runWithTimeout({
        actionId,
        timeoutMs: this.resolveActionTimeoutMs(request),
        run: () => this.runner(executionRequest),
        cancel: null,
        timeoutReason: `Supervised execution timeout ${actionId}.`,
      });
      if (supervisedResult.timedOut === true) {
        return this.ledger.record(this.recordBuilder.buildRecord({
          actionId,
          createdAt,
          request,
          status: 'timed_out',
          decision,
          command,
          workspace,
          errorCode: 'action_timed_out',
          errorMessage: `Supervised execution exceeded ${supervisedResult.timeoutMs}ms and was marked as timed_out.`,
          metadata: {
            runtimeTarget: decision.runtimeTarget,
            timeoutMs: supervisedResult.timeoutMs,
            cancelAttempted: false,
          },
        }));
      }
      const result = supervisedResult.value;
      return this.ledger.record(this.recordBuilder.buildRecord({
        actionId,
        createdAt,
        request,
        status: result.success ? 'completed' : 'failed',
        decision,
        command,
        workspace,
        stdout: result.stdout,
        stderr: result.stderr,
        errorCode: result.error_code,
        errorMessage: result.error_message,
        rollbackAvailable: result.rollback_available,
        metadata: {
          ...(result.metadata || {}),
          commandsExecuted: result.commands_executed,
          actionsExecuted: result.actions_executed,
          runtimeTarget: decision.runtimeTarget,
        },
      }));
    } catch (error: unknown) {
      asErrorLike(error);
      logger.warn('[Supervised Execution way] process execution failed', error);
    return this.ledger.record(this.recordBuilder.buildRecord({
        actionId,
        createdAt,
        request,
        status: 'failed',
        decision,
        command,
        workspace,
        errorCode: 'gateway_exception',
        errorMessage: errorMessage(error),
      }));
  } finally {
      this.activeActions.delete(actionId);
    }
  }

  public listActions(limit: number = 50): SystemOverlordActionRecord[] {
    return this.ledger.list(limit);
  }

  public listAdapters(): Array<{ id: string; label: string }> {
    return this.adapterRegistry.listAdapters();
  }

  public getKillSwitchState(): SystemOverlordKillSwitchState {
    const activeActions = Array.from(this.activeActions.values()).filter((entry) => entry.cancelled !== true);
    return {
      ...this.killSwitchState,
      activeActionCount: activeActions.length,
      cancellableActionCount: activeActions.filter((entry) => typeof entry.cancel === 'function').length,
    };
  }

  public async setKillSwitch(input: SystemOverlordKillSwitchToggleRequest): Promise<{
    killSwitch: SystemOverlordKillSwitchState;
    affectedActions: SystemOverlordActionRecord[];
  }> {
    const requestedBy = String(input.requestedBy || '').trim() || 'operator';
    const reason = String(input.reason || '').trim() || (
      input.active ? 'Supervised kill switch activated.'
        : 'Supervised kill switch released.'
    );
    const now = new Date().toISOString();
    const affectedActions: SystemOverlordActionRecord[] = [];

    if (input.active) {
      this.killSwitchState = {
        active: true,
        reason,
        activatedAt: now,
        activatedBy: requestedBy,
        releasedAt: null,
        releasedBy: null,
      };
      if (input.cancelActive === true) {
        for (const [actionId] of this.activeActions.entries()) {
          try {
            const cancelled = await this.cancelAction({
              actionId,
              requestedBy,
              reason: `Kill switch: ${reason}`,
            });
            affectedActions.push(cancelled);
          } catch (error: unknown) {// Some actions may not expose canonical cancelation handles yet.
      logger.warn('[Supervised Execution way] operation failed', error);
    }
        }
      }
    } else {
      this.killSwitchState = {
        active: false,
        reason: null,
        activatedAt: null,
        activatedBy: null,
        releasedAt: now,
        releasedBy: requestedBy,
      };
    }

    return {
      killSwitch: this.getKillSwitchState(),
      affectedActions,
    };
  }

  public async cancelAction(input: SystemOverlordActionMutationRequest): Promise<SystemOverlordActionRecord> {
    const actionId = String(input.actionId || '').trim();
    if (!actionId) {
      throw new Error('actionId required to cancel supervised action.');
    }
    const latest = this.ledger.find(actionId);
    if (!latest) {
      throw new Error('Supervised action not found for cancellation.');
    }
    const requestedBy = String(input.requestedBy || '').trim() || 'operator';
    const reason = String(input.reason || '').trim() || 'Cancelled by the operator.';

    if (latest.status === 'pending_approval' || latest.status === 'dry_run') {
      return this.ledger.record(this.recordBuilder.buildMutationRecord(latest, {
        status: 'cancelled',
        requestedBy,
        reason,
        errorCode: 'action_cancelled',
        metadata: {
          cancelDecision: {
            cancelledAt: new Date().toISOString(),
            cancelledBy: requestedBy,
            reason,
            previousStatus: latest.status,
          },
        },
      }));
    }

    if (latest.status !== 'running') {
      throw new Error(`Action ${actionId} is not in a cancellable state; current status: ${latest.status}.`);
    }

    const active = this.activeActions.get(actionId);
    if (!active?.cancel) {
      throw new Error('This action does not expose a canonical kill switch for live cancellation yet.');
    }

    const cancelResult = await active.cancel(reason);
    if (!cancelResult.ok) {
      throw new Error(cancelResult.errorMessage || 'Failure while cancelling the supervised action.');
    }
    active.cancelled = true;
    return this.ledger.record(this.recordBuilder.buildMutationRecord(latest, {
      status: 'cancelled',
      requestedBy,
      reason,
      errorCode: 'action_cancelled',
      stdout: cancelResult.stdout || null,
      stderr: cancelResult.stderr || null,
      metadata: {
        ...(cancelResult.metadata || {}),
        cancelDecision: {
          cancelledAt: new Date().toISOString(),
          cancelledBy: requestedBy,
          reason,
          previousStatus: latest.status,
        },
      },
    }));
  }

  public async rollbackAction(input: SystemOverlordActionMutationRequest): Promise<SystemOverlordActionRecord> {
    const actionId = String(input.actionId || '').trim();
    if (!actionId) {
      throw new Error('actionId required for supervised rollback.');
    }
    const latest = this.ledger.find(actionId);
    if (!latest) {
      throw new Error('Supervised action not found for rollback.');
    }
    if (latest.status !== 'completed') {
      throw new Error(`Supervised rollback requires a completed action; current status: ${latest.status}.`);
    }
    if (!latest.rollbackAvailable) {
      throw new Error('This action does not report available supervised rollback.');
    }

    const adapter = this.adapterRegistry.findAdapter(latest.request, latest.decision);
    if (!adapter || typeof adapter.rollback !== 'function') {
      throw new Error('No supervised adapter registered a canonical rollback for this action.');
    }

    const requestedBy = String(input.requestedBy || '').trim() || 'operator';
    const reason = String(input.reason || '').trim() || 'Supervised rollback requested by the operator.';
    const rollbackActionId = `rollback-${crypto.randomUUID()}`;
    const createdAt = new Date().toISOString();
    const rollbackResult = await adapter.rollback(latest, reason);
    return this.ledger.record(this.recordBuilder.buildRecord({
      actionId: rollbackActionId,
      createdAt,
      request: {
        ...latest.request,
        actionId: rollbackActionId,
        requestedBy,
        dryRun: false,
        approved: true,
        metadata: {
          ...(latest.request.metadata || {}),
          rollbackOf: latest.actionId,
          rollbackReason: reason,
        },
      },
      status: rollbackResult.ok ? 'completed' : 'failed',
      decision: latest.decision,
      command: `rollback:${latest.actionId}`,
      workspace: latest.workspace || null,
      stdout: rollbackResult.stdout || null,
      stderr: rollbackResult.stderr || null,
      errorCode: rollbackResult.errorCode || null,
      errorMessage: rollbackResult.errorMessage || null,
      rollbackAvailable: false,
      metadata: {
        ...(rollbackResult.metadata || {}),
        adapterId: adapter.id,
        rollbackOf: latest.actionId,
      },
    }));
  }

  public recordApprovalDecision(input: {
    action: SystemOverlordActionRecord;
    decision: SystemOverlordApprovalDecision;
    requestedBy?: string | null;
    reason?: string | null;
  }): SystemOverlordActionRecord {
    return this.ledger.record(this.recordBuilder.buildApprovalDecisionRecord(input));
  }

  private canRunWithLocalExecutor(runtimeTarget: string): boolean {
    return runtimeTarget === 'host' || runtimeTarget === 'container' || runtimeTarget === 'microvm';
  }

  private toExecutionRequest(input: {
    actionId: string;
    request: SystemOverlordActionRequest;
    command: string;
    workspace: string;
    sandboxRequired: boolean;
    microvmRequired: boolean;
  }): ExecutionRequest {
    const timeoutSeconds = Math.max(1, Math.ceil(Number(input.request.timeoutMs || 60_000) / 1000));
    return {
      execution_id: input.actionId,
      task_id: String(input.request.runId || input.actionId),
      executor: 'local',
      workspace: input.workspace,
      objective: String(input.request.objective || input.command),
      instructions: [input.command],
      allowed_paths: [input.workspace],
      blocked_paths: [],
      allowed_commands: [],
      blocked_commands: [],
      timeout_seconds: timeoutSeconds,
      dry_run: false,
      requires_backup: true,
      metadata: {
        source: 'system-overlord',
        capability: input.request.capability,
        profile: input.request.profile || 'safe',
        autonomyLevel: input.request.autonomyLevel || 1,
        surface: input.request.surface || null,
        sandboxRequired: input.sandboxRequired,
        untrustedContent: input.microvmRequired,
        task_metadata: input.request.metadata || {},
      },
    };
  }

  private resolveActionTimeoutMs(request: SystemOverlordActionRequest): number {
    const requested = Number(request.timeoutMs || 0);
    if (Number.isFinite(requested) && requested > 0) {
      return Math.min(Math.max(Math.floor(requested), 1_000), 21_600_000);
    }

    const autonomyLevel = Number(request.autonomyLevel || 1);
    if (autonomyLevel >= 6) {
      return 1_800_000;
    }
    if (autonomyLevel >= 5) {
      return 600_000;
    }
    if (autonomyLevel >= 4) {
      return 300_000;
    }
    if (autonomyLevel >= 3) {
      return 120_000;
    }
    return 60_000;
  }

  private async runWithTimeout<T>(input: {
    actionId: string;
    timeoutMs: number;
    run: () => Promise<T>;
    cancel?: ((reason?: string | null) => Promise<SystemOverlordAdapterResult>) | null;
    timeoutReason: string;
  }): Promise<
    | { timedOut: false; value: T; timeoutMs: number }
    | {
      timedOut: true;
      timeoutMs: number;
      cancelResult: SystemOverlordAdapterResult | null;
      cancelError: string | null;
    }
  > {
    let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
    const timeoutMs = Math.max(1_000, Math.floor(input.timeoutMs));
    const execution = Promise.resolve()
      .then(input.run)
      .then(
        (value) => ({ kind: 'completed' as const, value }),
        (error) => ({ kind: 'failed' as const, error }),
      );
    const timeout = new Promise<{
      kind: 'timed_out';
      cancelResult: SystemOverlordAdapterResult | null;
      cancelError: string | null;
    }>((resolve) => {
      timeoutHandle = setTimeout(() => {
        const active = this.activeActions.get(input.actionId);
        if (active) {
          active.cancelled = true;
        }
        if (!input.cancel) {
          resolve({
            kind: 'timed_out',
            cancelResult: null,
            cancelError: null,
          });
          return;
        }
        input.cancel(input.timeoutReason)
          .then((cancelResult) => {
            resolve({
              kind: 'timed_out',
              cancelResult,
              cancelError: null,
            });
          })
          .catch((error: unknown) => {
            resolve({
              kind: 'timed_out',
              cancelResult: null,
              cancelError: errorMessage(error),
            });
          });
      }, timeoutMs);
    });

    const outcome = await Promise.race([execution, timeout]);
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
    if (outcome.kind === 'failed') {
      throw outcome.error;
    }
    if (outcome.kind === 'timed_out') {
      return {
        timedOut: true,
        timeoutMs,
        cancelResult: outcome.cancelResult,
        cancelError: outcome.cancelError,
      };
    }
    return {
      timedOut: false,
      value: outcome.value,
      timeoutMs,
    };
  }

  private isCancelled(actionId: string): boolean {
    return this.activeActions.get(actionId)?.cancelled === true;
  }
}
