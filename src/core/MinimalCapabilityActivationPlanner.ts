import path from 'path';
import { findProjectRoot } from '../config/configHelpers.js';
import type { RuntimeBudgetProfile } from '../services/RuntimeResourceBudgetService.js';
import {
  MinimalCapabilityActivationLedger,
  type MinimalCapabilityActivationOperation,
  type MinimalCapabilityActivationReceipt,
} from './MinimalCapabilityActivationLedger.js';
import {
  MinimalCapabilityRegistry,
  type MinimalCapabilityBootMode,
  type MinimalCapabilityManifest,
  type MinimalCapabilityRegistrySnapshot,
} from './MinimalCapabilityRegistry.js';
import {
  MinimalRuntimeContractService,
  type MinimalRuntimeContractReport,
} from './MinimalRuntimeContractService.js';
import {
  MinimalRuntimeProfileRegistry,
  type MinimalRuntimeProfile,
  type MinimalRuntimeProfileRegistrySnapshot,
} from './MinimalRuntimeProfileRegistry.js';
import {
  MinimalSidecarManager,
  type MinimalSidecarSnapshot,
} from './MinimalSidecarManager.js';

export type MinimalCapabilityActivationMode =
  | 'already-active'
  | 'deferred-import'
  | 'scheduled'
  | 'sidecar'
  | 'manual'
  | 'disabled'
  | 'missing'
  | 'blocked';

export type MinimalCapabilityActivationStatus = 'active' | 'ready' | 'manual' | 'disabled' | 'missing' | 'blocked';

export type MinimalCapabilityActivationPlan = {
  version: 1;
  generatedAt: string;
  profileId: RuntimeBudgetProfile;
  capabilityId: string;
  label: string;
  kind: string;
  source: 'kernel' | 'manifest' | 'unknown';
  boot: MinimalCapabilityBootMode | 'missing';
  mode: MinimalCapabilityActivationMode;
  status: MinimalCapabilityActivationStatus;
  action: string;
  entry: string | null;
  budget: MinimalCapabilityManifest['budget'];
  requires: string[];
  provides: string[];
  sidecar: MinimalSidecarSnapshot | null;
  contractStatus: MinimalRuntimeContractReport['status'];
  reasons: string[];
  nextSteps: string[];
};

export type MinimalCapabilityActivationReport = {
  version: 1;
  generatedAt: string;
  profileId: RuntimeBudgetProfile;
  contractStatus: MinimalRuntimeContractReport['status'];
  status: 'passed' | 'failed';
  total: number;
  active: number;
  ready: number;
  manual: number;
  disabled: number;
  missing: number;
  blocked: number;
  invalidEnabled: number;
  plans: MinimalCapabilityActivationPlan[];
};

export type MinimalCapabilityActivationResult = {
  version: 1;
  generatedAt: string;
  applied: boolean;
  dryRun: boolean;
  plan: MinimalCapabilityActivationPlan;
  sidecarResult?: MinimalSidecarSnapshot | null;
  receipt?: MinimalCapabilityActivationReceipt | null;
  message: string;
};

export type MinimalCapabilityActivationPlannerOptions = {
  projectRoot?: string;
  dataDir?: string;
  manifestDir?: string;
  profileDir?: string;
  receiptLedgerFile?: string;
};

export class MinimalCapabilityActivationPlanner {
  private readonly projectRoot: string;
  private readonly dataDir: string;
  private readonly manifestDir: string;
  private readonly profileDir: string;
  private readonly receiptLedger: MinimalCapabilityActivationLedger;

  constructor(options: MinimalCapabilityActivationPlannerOptions = {}) {
    this.projectRoot = options.projectRoot || findProjectRoot();
    this.dataDir = options.dataDir || path.resolve(this.projectRoot, 'data', 'runtime');
    this.manifestDir = options.manifestDir || path.resolve(this.projectRoot, 'config', 'capability-manifests');
    this.profileDir = options.profileDir || path.resolve(this.projectRoot, 'config', 'runtime-profiles');
    this.receiptLedger = new MinimalCapabilityActivationLedger({
      projectRoot: this.projectRoot,
      dataDir: this.dataDir,
      ledgerFile: options.receiptLedgerFile,
    });
  }

  public buildReport(profile: string | null | undefined = 'minimal'): MinimalCapabilityActivationReport {
    const context = this.buildContext(profile);
    const plans = context.capabilityRegistry.allCapabilities.map((capability) =>
      this.buildPlanForCapability(capability.id, context),
    );
    const invalidEnabled = plans.filter((plan) =>
      ['blocked', 'missing'].includes(plan.status) && plan.boot !== 'disabled',
    ).length;
    return {
      version: 1,
      generatedAt: new Date().toISOString(),
      profileId: context.runtimeProfile.id,
      contractStatus: context.contractReport.status,
      status: invalidEnabled === 0 && context.contractReport.status !== 'failed' ? 'passed' : 'failed',
      total: plans.length,
      active: plans.filter((plan) => plan.status === 'active').length,
      ready: plans.filter((plan) => plan.status === 'ready').length,
      manual: plans.filter((plan) => plan.status === 'manual').length,
      disabled: plans.filter((plan) => plan.status === 'disabled').length,
      missing: plans.filter((plan) => plan.status === 'missing').length,
      blocked: plans.filter((plan) => plan.status === 'blocked').length,
      invalidEnabled,
      plans,
    };
  }

  public buildPlan(capabilityId: string, profile: string | null | undefined = 'minimal'): MinimalCapabilityActivationPlan {
    return this.buildPlanForCapability(capabilityId, this.buildContext(profile));
  }

  public async activate(
    capabilityId: string,
    options: {
      profile?: string | null;
      apply?: boolean;
      operation?: MinimalCapabilityActivationOperation;
      recordReceipt?: boolean;
    } = {},
  ): Promise<MinimalCapabilityActivationResult> {
    const context = this.buildContext(options.profile || 'minimal');
    const plan = this.buildPlanForCapability(capabilityId, context);
    const apply = options.apply === true;
    const operation = options.operation || (apply ? 'activate' : 'plan');
    const recordReceipt = options.recordReceipt !== false;

    if (!apply) {
      return this.finalizeActivationResult({
        version: 1,
        generatedAt: new Date().toISOString(),
        applied: false,
        dryRun: true,
        plan,
        sidecarResult: null,
        message: `Dry-run: ${plan.action}`,
      }, operation, recordReceipt);
    }

    if (plan.mode !== 'sidecar') {
      return this.finalizeActivationResult({
        version: 1,
        generatedAt: new Date().toISOString(),
        applied: false,
        dryRun: false,
        plan,
        sidecarResult: null,
        message: 'Only sidecar capabilities are applied by the minimal activation planner; deferred imports stay with the full runtime.',
      }, operation, recordReceipt);
    }

    if (plan.status !== 'ready' && plan.status !== 'active') {
      return this.finalizeActivationResult({
        version: 1,
        generatedAt: new Date().toISOString(),
        applied: false,
        dryRun: false,
        plan,
        sidecarResult: null,
        message: `Capability ${plan.capabilityId} is not ready for sidecar activation in profile ${plan.profileId}.`,
      }, operation, recordReceipt);
    }

    const sidecarResult = await context.sidecarManager.start(plan.capabilityId, { dryRun: false });
    return this.finalizeActivationResult({
      version: 1,
      generatedAt: new Date().toISOString(),
      applied: true,
      dryRun: false,
      plan,
      sidecarResult,
      message: `Sidecar activation requested for ${plan.capabilityId}.`,
    }, operation, recordReceipt);
  }

  private finalizeActivationResult(
    result: MinimalCapabilityActivationResult,
    operation: MinimalCapabilityActivationOperation,
    recordReceipt: boolean,
  ): MinimalCapabilityActivationResult {
    if (!recordReceipt) {
      return {
        ...result,
        receipt: null,
      };
    }
    const receipt = this.receiptLedger.append({
      operation,
      dryRun: result.dryRun,
      applied: result.applied,
      message: result.message,
      plan: result.plan,
      sidecarResult: result.sidecarResult || null,
    });
    return {
      ...result,
      receipt,
    };
  }

  private buildContext(profile: string | null | undefined): {
    profileSnapshot: MinimalRuntimeProfileRegistrySnapshot;
    runtimeProfile: MinimalRuntimeProfile;
    capabilityRegistry: MinimalCapabilityRegistrySnapshot;
    contractReport: MinimalRuntimeContractReport;
    sidecars: MinimalSidecarSnapshot[];
    sidecarManager: MinimalSidecarManager;
  } {
    const profileSnapshot = new MinimalRuntimeProfileRegistry({ profileDir: this.profileDir }).load(profile || 'minimal');
    const runtimeProfile = profileSnapshot.selectedProfile;
    const capabilityRegistry = new MinimalCapabilityRegistry({
      manifestDir: this.manifestDir,
      profileId: runtimeProfile.id,
      bootOverrides: runtimeProfile.capabilityBootOverrides,
    }).load();
    const contractReport = new MinimalRuntimeContractService({
      projectRoot: this.projectRoot,
      manifestDir: this.manifestDir,
      profileDir: this.profileDir,
    }).buildReport(runtimeProfile.id);
    const sidecarManager = new MinimalSidecarManager({
      projectRoot: this.projectRoot,
      dataDir: this.dataDir,
      runtimeProfile,
      capabilityRegistry,
    });
    return {
      profileSnapshot,
      runtimeProfile,
      capabilityRegistry,
      contractReport,
      sidecars: sidecarManager.buildSnapshot().sidecars,
      sidecarManager,
    };
  }

  private buildPlanForCapability(
    capabilityId: string,
    context: ReturnType<MinimalCapabilityActivationPlanner['buildContext']>,
  ): MinimalCapabilityActivationPlan {
    const normalizedId = this.normalizeId(capabilityId);
    const capability = context.capabilityRegistry.allCapabilities.find((candidate) => candidate.id === normalizedId) || null;
    if (!capability) {
      return this.createMissingPlan(normalizedId || capabilityId, context);
    }

    const sidecar = context.sidecars.find((candidate) => candidate.id === capability.id) || null;
    const base = this.createBasePlan(capability, context, sidecar);
    if (context.contractReport.status === 'failed' && capability.source !== 'kernel') {
      return {
        ...base,
        mode: 'blocked',
        status: 'blocked',
        action: 'Fix runtime contract issues before activating manifest capabilities.',
        reasons: [...base.reasons, 'Runtime contract report is failed.'],
        nextSteps: ['Run zavorth doctor contracts --strict and fix the reported issues.'],
      };
    }

    if (capability.enabled === false || capability.boot === 'disabled') {
      return {
        ...base,
        mode: 'disabled',
        status: 'disabled',
        action: `Capability ${capability.id} is disabled in profile ${context.runtimeProfile.id}.`,
        reasons: [...base.reasons, 'Profile override disables this capability.'],
        nextSteps: ['Choose a profile that enables this capability or update capabilityBootOverrides intentionally.'],
      };
    }

    if (capability.boot === 'always') {
      return {
        ...base,
        mode: 'already-active',
        status: 'active',
        action: 'Capability is part of the minimal kernel boot set.',
        reasons: [...base.reasons, 'Boot mode is always.'],
        nextSteps: [],
      };
    }

    if (capability.boot === 'on-demand') {
      return capability.entry
        ? {
          ...base,
          mode: 'deferred-import',
          status: 'ready',
          action: `Defer import of ${capability.entry} until the full runtime asks for ${capability.id}.`,
          reasons: [...base.reasons, 'Capability is on-demand and has an entry path.'],
          nextSteps: ['Keep heavy dependencies behind this entry path.'],
        }
        : {
          ...base,
          mode: 'manual',
          status: 'manual',
          action: 'Capability is on-demand but has no entry path yet.',
          reasons: [...base.reasons, 'Missing entry path.'],
          nextSteps: ['Add an entry path or provide a sidecar launcher before activation.'],
        };
    }

    if (capability.boot === 'scheduled') {
      return {
        ...base,
        mode: 'scheduled',
        status: capability.entry ? 'ready' : 'manual',
        action: capability.entry
          ? `Schedule deferred import of ${capability.entry} through MinimalRuntimeScheduler.`
          : 'Capability is scheduled but has no entry path yet.',
        reasons: [...base.reasons, 'Boot mode is scheduled.'],
        nextSteps: capability.entry
          ? ['Register the future task through MinimalRuntimeScheduler, not a local timer.']
          : ['Add an entry path before enabling scheduled activation.'],
      };
    }

    if (capability.boot === 'sidecar') {
      if (!sidecar) {
        return {
          ...base,
          mode: 'blocked',
          status: 'blocked',
          action: 'Sidecar capability is not present in the sidecar manager snapshot.',
          reasons: [...base.reasons, 'Sidecar manager could not build a sidecar plan.'],
          nextSteps: ['Check sidecar spec and profile limits.'],
        };
      }
      if (sidecar.running || sidecar.ready) {
        return {
          ...base,
          mode: 'sidecar',
          status: 'active',
          action: `Sidecar ${capability.id} is already ${sidecar.ready ? 'ready' : 'running'}.`,
          reasons: [...base.reasons, 'Sidecar status file indicates a live process.'],
          nextSteps: [],
        };
      }
      if (sidecar.launchable) {
        return {
          ...base,
          mode: 'sidecar',
          status: 'ready',
          action: `Start sidecar ${capability.id} on demand with ${sidecar.command} ${sidecar.args.join(' ')}`.trim(),
          reasons: [...base.reasons, 'Sidecar is launchable and not running.'],
          nextSteps: ['Use --apply only when the user explicitly wants to start this sidecar.'],
        };
      }
      return {
        ...base,
        mode: 'manual',
        status: 'manual',
        action: `Sidecar ${capability.id} requires a capability-specific runner.`,
        reasons: [...base.reasons, 'Sidecar has no automatic command.'],
        nextSteps: ['Add sidecar.command/cwd or provide a dedicated runner in a future capability adapter.'],
      };
    }

    return {
      ...base,
      mode: 'blocked',
      status: 'blocked',
      action: `Boot mode ${capability.boot} is not supported by the activation planner.`,
      reasons: [...base.reasons, 'Unknown boot mode.'],
      nextSteps: ['Update MinimalCapabilityActivationPlanner when adding new boot modes.'],
    };
  }

  private createBasePlan(
    capability: MinimalCapabilityManifest,
    context: ReturnType<MinimalCapabilityActivationPlanner['buildContext']>,
    sidecar: MinimalSidecarSnapshot | null,
  ): MinimalCapabilityActivationPlan {
    return {
      version: 1,
      generatedAt: new Date().toISOString(),
      profileId: context.runtimeProfile.id,
      capabilityId: capability.id,
      label: capability.label,
      kind: capability.kind,
      source: capability.source || 'manifest',
      boot: capability.boot,
      mode: 'blocked',
      status: 'blocked',
      action: '',
      entry: capability.entry || null,
      budget: capability.budget || {},
      requires: capability.requires || [],
      provides: capability.provides || [],
      sidecar,
      contractStatus: context.contractReport.status,
      reasons: [],
      nextSteps: [],
    };
  }

  private createMissingPlan(
    capabilityId: string,
    context: ReturnType<MinimalCapabilityActivationPlanner['buildContext']>,
  ): MinimalCapabilityActivationPlan {
    return {
      version: 1,
      generatedAt: new Date().toISOString(),
      profileId: context.runtimeProfile.id,
      capabilityId,
      label: capabilityId,
      kind: 'unknown',
      source: 'unknown',
      boot: 'missing',
      mode: 'missing',
      status: 'missing',
      action: `Capability ${capabilityId} is not declared in the registry.`,
      entry: null,
      budget: {},
      requires: [],
      provides: [],
      sidecar: null,
      contractStatus: context.contractReport.status,
      reasons: ['No manifest or kernel capability matched this id.'],
      nextSteps: ['Add a capability manifest and include an explicit profile override.'],
    };
  }

  private normalizeId(value: string): string {
    return String(value || '').trim().toLowerCase().replace(/[^a-z0-9._:-]+/g, '-').replace(/^-+|-+$/g, '');
  }
}
