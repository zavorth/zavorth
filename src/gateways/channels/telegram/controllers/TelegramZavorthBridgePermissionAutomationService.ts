import { ZavorthBridgeCompanionBridge } from '../../../../agents/ZavorthBridgeCompanionBridge.js';
import { ZavorthBridgeWindowAutomator } from '../../../../agents/ZavorthBridgeWindowAutomator.js';
import { PermissionRequest } from '../../../../contracts/PermissionRequest.js';
import { Task } from '../../../../contracts/TaskContract.js';

export type ZavorthBridgeCompanionBridgeLike = Pick<ZavorthBridgeCompanionBridge, 'readStatus' | 'isOnline'>;
export type ZavorthBridgeWindowAutomatorLike = Pick<
  ZavorthBridgeWindowAutomator,
  'approveVisibleStep' | 'rejectVisibleStep' | 'waitForPermissionPromptToClear'
>;

export type TelegramZavorthBridgePermissionAutomationServiceDeps = {
  createCompanionBridge?: () => ZavorthBridgeCompanionBridgeLike;
  createWindowAutomator?: () => ZavorthBridgeWindowAutomatorLike;
};

export type TelegramZavorthBridgePermissionAutomationResult = {
  effectiveProcessId: number;
  instanceId: string | null;
};

export class TelegramZavorthBridgePermissionAutomationService {
  constructor(private readonly deps: TelegramZavorthBridgePermissionAutomationServiceDeps = {}) {}

  public async applyApproval(
    permission: PermissionRequest,
    existingTask: Task | undefined,
    mode: 'once' | 'conversation',
  ): Promise<TelegramZavorthBridgePermissionAutomationResult> {
    const automator = this.createWindowAutomator();
    const targetSelection = await this.resolveApprovalTargets(permission, existingTask);
    const effectiveProcessId = await this.applyApprovalToTargets(
      automator,
      mode,
      targetSelection.processIds,
    );
    return {
      effectiveProcessId,
      instanceId: targetSelection.instanceId,
    };
  }

  public async applyRejection(
    permission: PermissionRequest,
    existingTask?: Task,
  ): Promise<TelegramZavorthBridgePermissionAutomationResult> {
    const automator = this.createWindowAutomator();
    const targetSelection = await this.resolveApprovalTargets(permission, existingTask);
    const effectiveProcessId = await this.applyRejectionToTargets(
      automator,
      targetSelection.processIds,
    );
    return {
      effectiveProcessId,
      instanceId: targetSelection.instanceId,
    };
  }

  private createCompanionBridge(): ZavorthBridgeCompanionBridgeLike {
    return this.deps.createCompanionBridge
      ? this.deps.createCompanionBridge()
      : new ZavorthBridgeCompanionBridge();
  }

  private createWindowAutomator(): ZavorthBridgeWindowAutomatorLike {
    return this.deps.createWindowAutomator
      ? this.deps.createWindowAutomator()
      : new ZavorthBridgeWindowAutomator();
  }

  private async resolveApprovalTargets(
    permission: PermissionRequest,
    existingTask?: Task,
  ): Promise<{ processIds: number[]; instanceId: string | null }> {
    const storedInstanceId = String(
      permission.metadata?.companion_instance_id ||
        existingTask?.metadata?.zavorthBridgeCompanionInstanceId ||
        '',
    ).trim();
    const storedProcessIds = [
      Number(permission.metadata?.companion_process_id || 0),
      Number(existingTask?.metadata?.zavorthBridgeCompanionProcessId || 0),
    ].filter((value) => Number.isFinite(value) && value > 0);

    let liveProcessId = 0;
    let resolvedInstanceId = storedInstanceId || null;
    const bridge = this.createCompanionBridge();
    if (await bridge.isOnline().catch(() => false)) {
      const status = await bridge.readStatus().catch(() => null);
      const liveInstanceId = String(status?.instanceId || '').trim();
      const livePid = Number(status?.processId || 0);
      const liveMatchesExpected =
        !storedInstanceId || !liveInstanceId || storedInstanceId === liveInstanceId;

      if (liveMatchesExpected && Number.isFinite(livePid) && livePid > 0) {
        liveProcessId = livePid;
      }

      if (liveMatchesExpected && liveInstanceId) {
        resolvedInstanceId = liveInstanceId;
      }
    }

    const processIds = Array.from(
      new Set([liveProcessId, ...storedProcessIds].filter((value) => value > 0)),
    );
    return {
      processIds,
      instanceId: resolvedInstanceId,
    };
  }

  private async verifyPermissionApplied(
    automator: ZavorthBridgeWindowAutomatorLike,
    processId: number,
  ): Promise<void> {
    const cleared = await automator.waitForPermissionPromptToClear(processId);
    if (!cleared) {
      throw new Error('O prompt de permissao do ZavorthBridge continuou visivel depois da aprovacao.');
    }
  }

  private async applyApprovalToTargets(
    automator: ZavorthBridgeWindowAutomatorLike,
    mode: 'once' | 'conversation',
    processIds: number[],
  ): Promise<number> {
    const candidates = processIds.length > 0 ? processIds : [0];
    let lastError: Error | null = null;

    for (const candidatePid of candidates) {
      try {
        const approvalResult = await automator.approveVisibleStep(0, mode, candidatePid);
        const effectiveProcessId = Number(candidatePid || approvalResult.pid || 0);
        await this.verifyPermissionApplied(automator, effectiveProcessId);
        return effectiveProcessId;
      } catch (error: unknown) {
        lastError = error instanceof Error ? error : new Error(String(error?.message || error));
      }
    }

    throw lastError || new Error('Nao consegui aplicar a permissao visivel do ZavorthBridge.');
  }

  private async applyRejectionToTargets(
    automator: ZavorthBridgeWindowAutomatorLike,
    processIds: number[],
  ): Promise<number> {
    const candidates = processIds.length > 0 ? processIds : [0];
    let lastError: Error | null = null;

    for (const candidatePid of candidates) {
      try {
        const rejectionResult = await automator.rejectVisibleStep(0, candidatePid);
        const effectiveProcessId = Number(candidatePid || rejectionResult.pid || 0);
        await this.verifyPermissionApplied(automator, effectiveProcessId);
        return effectiveProcessId;
      } catch (error: unknown) {
        lastError = error instanceof Error ? error : new Error(String(error?.message || error));
      }
    }

    throw lastError || new Error('Nao consegui rejeitar a permissao visivel do ZavorthBridge.');
  }
}
