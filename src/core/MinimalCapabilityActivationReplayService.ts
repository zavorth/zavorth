import path from 'path';
import { findProjectRoot } from '../config/configHelpers.js';
import {
  MinimalCapabilityActivationLedger,
  type MinimalCapabilityActivationOperation,
  type MinimalCapabilityActivationReceipt,
} from './MinimalCapabilityActivationLedger.js';
import {
  MinimalCapabilityActivationPlanner,
  type MinimalCapabilityActivationResult,
  type MinimalCapabilityActivationStatus,
} from './MinimalCapabilityActivationPlanner.js';
import { MinimalCapabilityRegistry } from './MinimalCapabilityRegistry.js';
import { MinimalRuntimeProfileRegistry } from './MinimalRuntimeProfileRegistry.js';
import {
  MinimalSidecarManager,
  type MinimalSidecarSnapshot,
} from './MinimalSidecarManager.js';

export type MinimalCapabilityReplayAction = 'replay' | 'rollback';
export type MinimalCapabilityReplayStatus = 'ready' | 'noop' | 'manual' | 'missing' | 'blocked' | 'applied';

export type MinimalCapabilityReplayPlan = {
  version: 1;
  generatedAt: string;
  action: MinimalCapabilityReplayAction;
  receiptId: string | null;
  profileId: string;
  capabilityId: string;
  sourceOperation: MinimalCapabilityActivationOperation | 'missing';
  sourceMode: string;
  sourceStatus: MinimalCapabilityActivationStatus | 'missing';
  executable: boolean;
  applyWouldMutate: boolean;
  status: MinimalCapabilityReplayStatus;
  command: string;
  message: string;
  reasons: string[];
  nextSteps: string[];
  receipt: MinimalCapabilityActivationReceipt | null;
};

export type MinimalCapabilityReplayReport = {
  version: 1;
  generatedAt: string;
  ledgerFile: string;
  action: MinimalCapabilityReplayAction;
  status: 'passed' | 'failed';
  total: number;
  ready: number;
  noop: number;
  manual: number;
  missing: number;
  blocked: number;
  applied: number;
  plans: MinimalCapabilityReplayPlan[];
};

export type MinimalCapabilityReplayResult = {
  version: 1;
  generatedAt: string;
  action: MinimalCapabilityReplayAction;
  apply: boolean;
  plan: MinimalCapabilityReplayPlan;
  activationResult?: MinimalCapabilityActivationResult | null;
  sidecarResult?: MinimalSidecarSnapshot | null;
  receipt?: MinimalCapabilityActivationReceipt | null;
  message: string;
};

export type MinimalCapabilityActivationReplayServiceOptions = {
  projectRoot?: string;
  dataDir?: string;
  manifestDir?: string;
  profileDir?: string;
  ledgerFile?: string;
};

export type MinimalCapabilityReplaySelector = {
  receiptId?: string | null;
  profile?: string | null;
  capability?: string | null;
  limit?: number;
};

export class MinimalCapabilityActivationReplayService {
  private readonly projectRoot: string;
  private readonly dataDir: string;
  private readonly manifestDir: string;
  private readonly profileDir: string;
  private readonly ledgerFile: string;
  private readonly ledger: MinimalCapabilityActivationLedger;

  constructor(options: MinimalCapabilityActivationReplayServiceOptions = {}) {
    this.projectRoot = options.projectRoot || findProjectRoot();
    this.dataDir = options.dataDir || path.resolve(this.projectRoot, 'data', 'runtime');
    this.manifestDir = options.manifestDir || path.resolve(this.projectRoot, 'config', 'capability-manifests');
    this.profileDir = options.profileDir || path.resolve(this.projectRoot, 'config', 'runtime-profiles');
    this.ledgerFile = options.ledgerFile || path.resolve(this.dataDir, 'capability-activation-ledger.jsonl');
    this.ledger = new MinimalCapabilityActivationLedger({
      projectRoot: this.projectRoot,
      dataDir: this.dataDir,
      ledgerFile: this.ledgerFile,
    });
  }

  public buildReport(
    action: MinimalCapabilityReplayAction = 'replay',
    selector: MinimalCapabilityReplaySelector = {},
  ): MinimalCapabilityReplayReport {
    const receipts = this.selectReceipts(selector);
    const plans = receipts.map((receipt) => this.buildPlanFromReceipt(action, receipt));
    const status = plans.some((plan) => plan.status === 'blocked' || plan.status === 'missing') ? 'failed' : 'passed';
    return {
      version: 1,
      generatedAt: new Date().toISOString(),
      ledgerFile: this.ledgerFile,
      action,
      status,
      total: plans.length,
      ready: plans.filter((plan) => plan.status === 'ready').length,
      noop: plans.filter((plan) => plan.status === 'noop').length,
      manual: plans.filter((plan) => plan.status === 'manual').length,
      missing: plans.filter((plan) => plan.status === 'missing').length,
      blocked: plans.filter((plan) => plan.status === 'blocked').length,
      applied: plans.filter((plan) => plan.status === 'applied').length,
      plans,
    };
  }

  public async execute(
    action: MinimalCapabilityReplayAction,
    selector: MinimalCapabilityReplaySelector & { apply?: boolean } = {},
  ): Promise<MinimalCapabilityReplayResult> {
    const receipt = this.selectLatestReceipt(selector);
    if (!receipt) {
      const missingPlan = this.createMissingPlan(action, selector);
      return {
        version: 1,
        generatedAt: new Date().toISOString(),
        action,
        apply: selector.apply === true,
        plan: missingPlan,
        activationResult: null,
        sidecarResult: null,
        receipt: null,
        message: missingPlan.message,
      };
    }

    const plan = this.buildPlanFromReceipt(action, receipt);
    const apply = selector.apply === true;
    if (!apply || !plan.executable) {
      const replayReceipt = this.ledger.append({
        operation: action,
        dryRun: true,
        applied: false,
        message: `Dry-run: ${plan.message}`,
        plan: {
          profileId: receipt.profileId,
          capabilityId: receipt.capabilityId,
          label: receipt.label,
          kind: receipt.kind,
          source: receipt.source,
          boot: receipt.boot,
          mode: receipt.mode,
          status: receipt.status,
          contractStatus: receipt.contractStatus,
          action: plan.command,
          entry: receipt.entry,
          reasons: plan.reasons,
          nextSteps: plan.nextSteps,
          sidecar: null,
        },
        sidecarResult: null,
      });
      return {
        version: 1,
        generatedAt: new Date().toISOString(),
        action,
        apply,
        plan,
        activationResult: null,
        sidecarResult: null,
        receipt: replayReceipt,
        message: `Dry-run: ${plan.message}`,
      };
    }

    if (action === 'replay') {
      const activationResult = await this.createPlanner().activate(receipt.capabilityId, {
        profile: receipt.profileId,
        apply: true,
        operation: 'replay',
      });
      return {
        version: 1,
        generatedAt: new Date().toISOString(),
        action,
        apply,
        plan: {
          ...plan,
          status: activationResult.applied ? 'applied' : plan.status,
        },
        activationResult,
        sidecarResult: activationResult.sidecarResult || null,
        receipt: activationResult.receipt || null,
        message: activationResult.message,
      };
    }

    const sidecarResult = await this.stopSidecar(receipt);
    const rollbackReceipt = this.ledger.append({
      operation: 'rollback',
      dryRun: false,
      applied: true,
      message: `Rollback requested for ${receipt.capabilityId}.`,
      plan: {
        profileId: receipt.profileId,
        capabilityId: receipt.capabilityId,
        label: receipt.label,
        kind: receipt.kind,
        source: receipt.source,
        boot: receipt.boot,
        mode: receipt.mode,
        status: receipt.status,
        contractStatus: receipt.contractStatus,
        action: plan.command,
        entry: receipt.entry,
        reasons: plan.reasons,
        nextSteps: plan.nextSteps,
        sidecar: null,
      },
      sidecarResult,
    });
    return {
      version: 1,
      generatedAt: new Date().toISOString(),
      action,
      apply,
      plan: {
        ...plan,
        status: 'applied',
      },
      activationResult: null,
      sidecarResult,
      receipt: rollbackReceipt,
      message: `Rollback requested for ${receipt.capabilityId}.`,
    };
  }

  private buildPlanFromReceipt(
    action: MinimalCapabilityReplayAction,
    receipt: MinimalCapabilityActivationReceipt,
  ): MinimalCapabilityReplayPlan {
    if (action === 'rollback') {
      return this.buildRollbackPlan(receipt);
    }
    return this.buildReplayPlan(receipt);
  }

  private buildReplayPlan(receipt: MinimalCapabilityActivationReceipt): MinimalCapabilityReplayPlan {
    const base = this.createBasePlan('replay', receipt);
    if (receipt.status === 'blocked' || receipt.status === 'missing' || receipt.contractStatus === 'failed') {
      return {
        ...base,
        status: 'blocked',
        executable: false,
        applyWouldMutate: false,
        command: `zavorth capability plan ${receipt.capabilityId} --profile=${receipt.profileId}`,
        message: 'Source receipt is not replayable until capability contracts are healthy.',
        reasons: [...base.reasons, 'Receipt status or contract status is not healthy.'],
        nextSteps: ['Run zavorth doctor contracts --strict before replaying this receipt.'],
      };
    }
    if (receipt.mode === 'sidecar') {
      return {
        ...base,
        status: 'ready',
        executable: true,
        applyWouldMutate: true,
        command: `zavorth capability activate ${receipt.capabilityId} --profile=${receipt.profileId} --apply`,
        message: 'Replay can request the sidecar activation again.',
        reasons: [...base.reasons, 'Sidecar activations are replayable through the activation planner.'],
        nextSteps: ['Use --apply only when you want to mutate the local sidecar state.'],
      };
    }
    if (receipt.mode === 'deferred-import' || receipt.mode === 'already-active' || receipt.mode === 'scheduled') {
      return {
        ...base,
        status: 'noop',
        executable: false,
        applyWouldMutate: false,
        command: `zavorth capability plan ${receipt.capabilityId} --profile=${receipt.profileId}`,
        message: 'Replay is a safe no-op in the minimal runtime; the full runtime owns this activation.',
        reasons: [...base.reasons, `Mode ${receipt.mode} does not require sidecar mutation.`],
        nextSteps: ['Use the generated plan as audit evidence or let the full runtime perform the deferred import.'],
      };
    }
    return {
      ...base,
      status: 'manual',
      executable: false,
      applyWouldMutate: false,
      command: `zavorth doctor activation --profile=${receipt.profileId} --capability=${receipt.capabilityId}`,
      message: 'Replay requires a capability-specific runner.',
      reasons: [...base.reasons, `Mode ${receipt.mode} has no generic replay executor.`],
      nextSteps: ['Add a sidecar command or future adapter before replaying with apply.'],
    };
  }

  private buildRollbackPlan(receipt: MinimalCapabilityActivationReceipt): MinimalCapabilityReplayPlan {
    const base = this.createBasePlan('rollback', receipt);
    if (!receipt.applied) {
      return {
        ...base,
        status: 'noop',
        executable: false,
        applyWouldMutate: false,
        command: `zavorth doctor activation-ledger --capability=${receipt.capabilityId}`,
        message: 'Receipt was not applied; there is no runtime state to rollback.',
        reasons: [...base.reasons, 'Dry-run receipts do not mutate sidecars.'],
        nextSteps: [],
      };
    }
    if (receipt.mode !== 'sidecar') {
      return {
        ...base,
        status: 'noop',
        executable: false,
        applyWouldMutate: false,
        command: `zavorth doctor activation --profile=${receipt.profileId} --capability=${receipt.capabilityId}`,
        message: 'Receipt did not apply a sidecar; minimal rollback has nothing to stop.',
        reasons: [...base.reasons, `Mode ${receipt.mode} is not a sidecar.`],
        nextSteps: [],
      };
    }
    return {
      ...base,
      status: 'ready',
      executable: true,
      applyWouldMutate: true,
      command: `zavorth sidecar stop ${receipt.capabilityId} --profile=${receipt.profileId} --apply`,
      message: 'Rollback can stop the sidecar through MinimalSidecarManager.',
      reasons: [...base.reasons, 'Applied sidecar receipt can be rolled back by stopping the sidecar.'],
      nextSteps: ['Use --apply only when you want to stop the sidecar.'],
    };
  }

  private createBasePlan(
    action: MinimalCapabilityReplayAction,
    receipt: MinimalCapabilityActivationReceipt,
  ): MinimalCapabilityReplayPlan {
    return {
      version: 1,
      generatedAt: new Date().toISOString(),
      action,
      receiptId: receipt.id,
      profileId: receipt.profileId,
      capabilityId: receipt.capabilityId,
      sourceOperation: receipt.operation,
      sourceMode: receipt.mode,
      sourceStatus: receipt.status,
      executable: false,
      applyWouldMutate: false,
      status: 'blocked',
      command: '',
      message: '',
      reasons: [`Source receipt ${receipt.id} recorded ${receipt.operation}/${receipt.mode}.`],
      nextSteps: [],
      receipt,
    };
  }

  private createMissingPlan(
    action: MinimalCapabilityReplayAction,
    selector: MinimalCapabilityReplaySelector,
  ): MinimalCapabilityReplayPlan {
    const profile = this.normalizeFilter(selector.profile) || 'unknown';
    const capability = this.normalizeFilter(selector.capability) || 'unknown';
    return {
      version: 1,
      generatedAt: new Date().toISOString(),
      action,
      receiptId: selector.receiptId || null,
      profileId: profile,
      capabilityId: capability,
      sourceOperation: 'missing',
      sourceMode: 'missing',
      sourceStatus: 'missing',
      executable: false,
      applyWouldMutate: false,
      status: 'missing',
      command: 'zavorth doctor activation-ledger',
      message: 'No matching activation receipt was found.',
      reasons: ['Ledger has no receipt matching this selector.'],
      nextSteps: ['Create a plan or activation receipt before replaying or rolling back.'],
      receipt: null,
    };
  }

  private selectReceipts(selector: MinimalCapabilityReplaySelector): MinimalCapabilityActivationReceipt[] {
    const snapshot = this.ledger.buildSnapshot({
      profile: selector.profile || null,
      capability: selector.capability || null,
      limit: selector.limit || 50,
    });
    if (!selector.receiptId) {
      return snapshot.receipts;
    }
    return snapshot.receipts.filter((receipt) => receipt.id === selector.receiptId);
  }

  private selectLatestReceipt(selector: MinimalCapabilityReplaySelector): MinimalCapabilityActivationReceipt | null {
    return this.selectReceipts({
      ...selector,
      limit: selector.limit || 500,
    })[0] || null;
  }

  private createPlanner(): MinimalCapabilityActivationPlanner {
    return new MinimalCapabilityActivationPlanner({
      projectRoot: this.projectRoot,
      dataDir: this.dataDir,
      manifestDir: this.manifestDir,
      profileDir: this.profileDir,
      receiptLedgerFile: this.ledgerFile,
    });
  }

  private async stopSidecar(receipt: MinimalCapabilityActivationReceipt): Promise<MinimalSidecarSnapshot> {
    const profileSnapshot = new MinimalRuntimeProfileRegistry({ profileDir: this.profileDir }).load(receipt.profileId);
    const capabilityRegistry = new MinimalCapabilityRegistry({
      manifestDir: this.manifestDir,
      profileId: profileSnapshot.selectedProfile.id,
      bootOverrides: profileSnapshot.selectedProfile.capabilityBootOverrides,
    }).load();
    return new MinimalSidecarManager({
      projectRoot: this.projectRoot,
      dataDir: this.dataDir,
      runtimeProfile: profileSnapshot.selectedProfile,
      capabilityRegistry,
    }).stop(receipt.capabilityId, { dryRun: false });
  }

  private normalizeFilter(value: string | null | undefined): string | null {
    const normalized = String(value || '').trim().toLowerCase();
    return normalized || null;
  }
}
