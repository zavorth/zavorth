import fs from 'fs';
import path from 'path';
import { findProjectRoot } from '../config/configHelpers.js';
import { RuntimeResourceBudgetService, type RuntimeBudgetProfile } from '../services/RuntimeResourceBudgetService.js';
import {
  MinimalCapabilityActivationPlanner,
  type MinimalCapabilityActivationPlan,
} from './MinimalCapabilityActivationPlanner.js';
import { MinimalRuntimeProfileRegistry } from './MinimalRuntimeProfileRegistry.js';
import { asErrorLike } from '../utils/errorLike.js';

export type MinimalRuntimeModeLeaseStatus = 'dry-run' | 'active' | 'released' | 'expired' | 'blocked';
export type MinimalRuntimeModeLeaseOperation = 'plan' | 'elevate' | 'release' | 'expire';
export type MinimalRuntimeModePlanStatus = 'ready' | 'noop' | 'blocked' | 'missing' | 'manual';

export type MinimalRuntimeModeLease = {
  version: 1;
  id: string;
  createdAt: string;
  updatedAt: string;
  operation: MinimalRuntimeModeLeaseOperation;
  status: MinimalRuntimeModeLeaseStatus;
  fromProfile: RuntimeBudgetProfile;
  toProfile: RuntimeBudgetProfile;
  previousProfile: RuntimeBudgetProfile;
  returnProfile: RuntimeBudgetProfile;
  capabilityId: string;
  reason: string;
  ttlMs: number;
  expiresAt: string;
  dryRun: boolean;
  applied: boolean;
  message: string;
  activationMode: string;
  activationStatus: string;
  budgetOk: boolean;
  budgetProfile: RuntimeBudgetProfile;
  releaseOf: string | null;
  reasons: string[];
  nextSteps: string[];
};

export type MinimalRuntimeModePlan = {
  version: 1;
  generatedAt: string;
  status: MinimalRuntimeModePlanStatus;
  action: 'noop' | 'elevate' | 'release' | 'blocked';
  fromProfile: RuntimeBudgetProfile;
  toProfile: RuntimeBudgetProfile;
  returnProfile: RuntimeBudgetProfile;
  capabilityId: string;
  reason: string;
  ttlMs: number;
  expiresAt: string;
  applyWouldMutate: boolean;
  budgetOk: boolean;
  budgetProfile: RuntimeBudgetProfile;
  activationPlan: MinimalCapabilityActivationPlan;
  lease: MinimalRuntimeModeLease | null;
  message: string;
  reasons: string[];
  nextSteps: string[];
};

export type MinimalRuntimeModeResult = {
  version: 1;
  generatedAt: string;
  applied: boolean;
  dryRun: boolean;
  plan: MinimalRuntimeModePlan;
  lease: MinimalRuntimeModeLease | null;
  message: string;
};

export type MinimalRuntimeModeLedgerSnapshot = {
  version: 1;
  generatedAt: string;
  ledgerFile: string;
  status: 'passed' | 'failed';
  exists: boolean;
  total: number;
  returned: number;
  active: number;
  released: number;
  expired: number;
  blocked: number;
  dryRun: number;
  leases: MinimalRuntimeModeLease[];
  errors: Array<{
    line: number;
    reason: string;
  }>;
};

export type MinimalRuntimeModeGovernorOptions = {
  projectRoot?: string;
  dataDir?: string;
  manifestDir?: string;
  profileDir?: string;
  ledgerFile?: string;
  now?: () => Date;
};

export type MinimalRuntimeModePlanOptions = {
  fromProfile?: string | null;
  toProfile?: string | null;
  capability?: string | null;
  reason?: string | null;
  ttlMs?: number | null;
};

export type MinimalRuntimeModeApplyOptions = MinimalRuntimeModePlanOptions & {
  apply?: boolean;
};

const PROFILE_ORDER: RuntimeBudgetProfile[] = ['minimal', 'safe-8gb', 'chat', 'browser', 'desktop', 'dev', 'full'];
const DEFAULT_TTL_MS = 10 * 60 * 1000;
const MIN_TTL_MS = 60 * 1000;
const MAX_TTL_MS = 30 * 60 * 1000;

export class MinimalRuntimeModeGovernor {
  private readonly projectRoot: string;
  private readonly dataDir: string;
  private readonly manifestDir: string;
  private readonly profileDir: string;
  private readonly ledgerFile: string;
  private readonly now: () => Date;

  public constructor(options: MinimalRuntimeModeGovernorOptions = {}) {
    this.projectRoot = options.projectRoot || findProjectRoot();
    this.dataDir = options.dataDir || path.resolve(this.projectRoot, 'data', 'runtime');
    this.manifestDir = options.manifestDir || path.resolve(this.projectRoot, 'config', 'capability-manifests');
    this.profileDir = options.profileDir || path.resolve(this.projectRoot, 'config', 'runtime-profiles');
    this.ledgerFile = options.ledgerFile || path.resolve(this.dataDir, 'runtime-mode-ledger.jsonl');
    this.now = options.now || (() => new Date());
  }

  public plan(options: MinimalRuntimeModePlanOptions = {}): MinimalRuntimeModePlan {
    const fromProfile = this.resolveProfile(options.fromProfile || process.env.ZAVORTH_RUNTIME_PROFILE || process.env.ZAVORTH_PROFILE || 'safe-8gb');
    const capabilityId = this.normalizeCapability(options.capability || 'browser');
    const ttlMs = this.normalizeTtl(options.ttlMs);
    const reason = String(options.reason || `Temporary ${capabilityId} runtime lease`).trim();
    const toProfile = this.resolveTargetProfile(fromProfile, options.toProfile, capabilityId);
    const expiresAt = new Date(this.now().getTime() + ttlMs).toISOString();
    const activationPlan = this.buildActivationPlan(toProfile, capabilityId);
    const budget = new RuntimeResourceBudgetService().buildBudgetReport(toProfile);
    const reasons: string[] = [
      `Current profile is ${fromProfile}.`,
      `Target profile is ${toProfile}.`,
      `Capability ${capabilityId} resolves to ${activationPlan.status}/${activationPlan.mode} in ${toProfile}.`,
    ];
    const nextSteps: string[] = [];

    if (fromProfile === toProfile && ['active', 'ready'].includes(activationPlan.status)) {
      return this.createPlan({
        status: 'noop',
        action: 'noop',
        fromProfile,
        toProfile,
        capabilityId,
        reason,
        ttlMs,
        expiresAt,
        budgetOk: budget.ok,
        activationPlan,
        message: `No runtime elevation is needed; ${capabilityId} is already usable in ${fromProfile}.`,
        reasons,
        nextSteps: ['Use the capability under the current profile and keep the core profile unchanged.'],
      });
    }

    if (!this.isProfileTransitionAllowed(fromProfile, toProfile)) {
      return this.createPlan({
        status: 'blocked',
        action: 'blocked',
        fromProfile,
        toProfile,
        capabilityId,
        reason,
        ttlMs,
        expiresAt,
        budgetOk: budget.ok,
        activationPlan,
        message: `Profile escalation from ${fromProfile} to ${toProfile} is blocked by the lightweight transition policy.`,
        reasons: [...reasons, 'The target profile skips too far ahead for an automatic temporary lease.'],
        nextSteps: ['Ask explicitly for a closer profile first or use a manual full-runtime session.'],
      });
    }

    if (!budget.ok) {
      return this.createPlan({
        status: 'blocked',
        action: 'blocked',
        fromProfile,
        toProfile,
        capabilityId,
        reason,
        ttlMs,
        expiresAt,
        budgetOk: false,
        activationPlan,
        message: `Runtime budget for ${toProfile} is currently violated; elevation is blocked.`,
        reasons: [...reasons, 'Current process is outside the target budget.'],
        nextSteps: budget.recommendations,
      });
    }

    if (activationPlan.status === 'missing') {
      return this.createPlan({
        status: 'missing',
        action: 'blocked',
        fromProfile,
        toProfile,
        capabilityId,
        reason,
        ttlMs,
        expiresAt,
        budgetOk: budget.ok,
        activationPlan,
        message: `Capability ${capabilityId} is not declared; runtime mode lease cannot be planned.`,
        reasons: [...reasons, 'Capability registry did not find this capability.'],
        nextSteps: activationPlan.nextSteps,
      });
    }

    if (activationPlan.status === 'manual') {
      return this.createPlan({
        status: 'ready',
        action: 'elevate',
        fromProfile,
        toProfile,
        capabilityId,
        reason,
        ttlMs,
        expiresAt,
        budgetOk: budget.ok,
        activationPlan,
        message: `Temporary runtime lease can elevate ${fromProfile} to ${toProfile}; ${capabilityId} still requires manual capability activation.`,
        reasons: [...reasons, ...activationPlan.reasons, 'Profile elevation is allowed even though the capability runner is not automatic yet.'],
        nextSteps: ['Open the lease only for the current task.', ...activationPlan.nextSteps],
      });
    }

    if (!['active', 'ready'].includes(activationPlan.status)) {
      return this.createPlan({
        status: 'blocked',
        action: 'blocked',
        fromProfile,
        toProfile,
        capabilityId,
        reason,
        ttlMs,
        expiresAt,
        budgetOk: budget.ok,
        activationPlan,
        message: `Capability ${capabilityId} is ${activationPlan.status} in profile ${toProfile}; elevation is blocked.`,
        reasons: [...reasons, ...activationPlan.reasons],
        nextSteps: activationPlan.nextSteps,
      });
    }

    nextSteps.push('Open the temporary lease only for the current task.');
    nextSteps.push(`Release the lease before ${expiresAt} or let the TTL expire.`);
    return this.createPlan({
      status: 'ready',
      action: 'elevate',
      fromProfile,
      toProfile,
      capabilityId,
      reason,
      ttlMs,
      expiresAt,
      budgetOk: budget.ok,
      activationPlan,
      message: `Temporary runtime lease can elevate ${fromProfile} to ${toProfile} for ${capabilityId}.`,
      reasons,
      nextSteps,
    });
  }

  public elevate(options: MinimalRuntimeModeApplyOptions = {}): MinimalRuntimeModeResult {
    const dryRun = options.apply !== true;
    const plan = this.plan(options);
    if (plan.status !== 'ready') {
      const lease = this.createLease(plan, dryRun, false, 'blocked');
      return {
        version: 1,
        generatedAt: this.now().toISOString(),
        applied: false,
        dryRun,
        plan: { ...plan, lease },
        lease: dryRun ? null : this.appendLease(lease),
        message: plan.message,
      };
    }

    const lease = this.createLease(plan, dryRun, !dryRun, dryRun ? 'dry-run' : 'active');
    const recordedLease = dryRun ? lease : this.appendLease(lease);
    return {
      version: 1,
      generatedAt: this.now().toISOString(),
      applied: !dryRun,
      dryRun,
      plan: { ...plan, lease: recordedLease },
      lease: recordedLease,
      message: dryRun
        ? `Dry-run: ${plan.message}`
        : `Runtime mode lease ${recordedLease.id} opened; return profile is ${recordedLease.returnProfile}.`,
    };
  }

  public release(leaseId: string, options: { apply?: boolean; reason?: string | null } = {}): MinimalRuntimeModeResult {
    const dryRun = options.apply !== true;
    const activeLease = this.findActiveLease(leaseId);
    if (!activeLease) {
      const plan = this.createReleasePlan(leaseId, null, 'blocked', 'No active runtime mode lease matched this id.');
      return {
        version: 1,
        generatedAt: this.now().toISOString(),
        applied: false,
        dryRun,
        plan,
        lease: null,
        message: plan.message,
      };
    }

    const releaseLease: MinimalRuntimeModeLease = {
      ...activeLease,
      id: this.createLeaseId('release', activeLease.returnProfile, activeLease.capabilityId),
      updatedAt: this.now().toISOString(),
      operation: 'release',
      status: dryRun ? 'dry-run' : 'released',
      dryRun,
      applied: !dryRun,
      reason: String(options.reason || `Release temporary lease ${activeLease.id}`).trim(),
      message: dryRun
        ? `Dry-run: lease ${activeLease.id} would return to ${activeLease.returnProfile}.`
        : `Lease ${activeLease.id} released; return to ${activeLease.returnProfile}.`,
      releaseOf: activeLease.id,
      reasons: [...activeLease.reasons, 'Release returns runtime mode to the previous profile.'],
      nextSteps: [],
    };
    const plan = this.createReleasePlan(activeLease.id, releaseLease, 'ready', releaseLease.message);
    const recorded = dryRun ? releaseLease : this.appendLease(releaseLease);
    return {
      version: 1,
      generatedAt: this.now().toISOString(),
      applied: !dryRun,
      dryRun,
      plan: { ...plan, lease: recorded },
      lease: recorded,
      message: releaseLease.message,
    };
  }

  public buildLedgerSnapshot(options: { limit?: number } = {}): MinimalRuntimeModeLedgerSnapshot {
    const parsed = this.readLeases();
    const limit = Math.max(1, Math.floor(Number(options.limit || 20) || 20));
    const leases = parsed.leases.slice(-limit).reverse();
    return {
      version: 1,
      generatedAt: this.now().toISOString(),
      ledgerFile: this.ledgerFile,
      status: parsed.errors.length === 0 ? 'passed' : 'failed',
      exists: fs.existsSync(this.ledgerFile),
      total: parsed.leases.length,
      returned: leases.length,
      active: parsed.leases.filter((lease) => lease.status === 'active' && !this.hasRelease(lease.id, parsed.leases)).length,
      released: parsed.leases.filter((lease) => lease.status === 'released').length,
      expired: parsed.leases.filter((lease) => lease.status === 'expired').length,
      blocked: parsed.leases.filter((lease) => lease.status === 'blocked').length,
      dryRun: parsed.leases.filter((lease) => lease.dryRun).length,
      leases,
      errors: parsed.errors,
    };
  }

  private createPlan(input: {
    status: MinimalRuntimeModePlanStatus;
    action: MinimalRuntimeModePlan['action'];
    fromProfile: RuntimeBudgetProfile;
    toProfile: RuntimeBudgetProfile;
    capabilityId: string;
    reason: string;
    ttlMs: number;
    expiresAt: string;
    budgetOk: boolean;
    activationPlan: MinimalCapabilityActivationPlan;
    message: string;
    reasons: string[];
    nextSteps: string[];
  }): MinimalRuntimeModePlan {
    return {
      version: 1,
      generatedAt: this.now().toISOString(),
      status: input.status,
      action: input.action,
      fromProfile: input.fromProfile,
      toProfile: input.toProfile,
      returnProfile: input.fromProfile,
      capabilityId: input.capabilityId,
      reason: input.reason,
      ttlMs: input.ttlMs,
      expiresAt: input.expiresAt,
      applyWouldMutate: input.status === 'ready',
      budgetOk: input.budgetOk,
      budgetProfile: input.toProfile,
      activationPlan: input.activationPlan,
      lease: null,
      message: input.message,
      reasons: input.reasons,
      nextSteps: input.nextSteps,
    };
  }

  private createReleasePlan(
    leaseId: string,
    lease: MinimalRuntimeModeLease | null,
    status: MinimalRuntimeModePlanStatus,
    message: string,
  ): MinimalRuntimeModePlan {
    const fromProfile = lease?.toProfile || 'minimal';
    const toProfile = lease?.returnProfile || 'minimal';
    const activationPlan = this.buildActivationPlan(toProfile, lease?.capabilityId || 'runtime-mode');
    return {
      version: 1,
      generatedAt: this.now().toISOString(),
      status,
      action: status === 'ready' ? 'release' : 'blocked',
      fromProfile,
      toProfile,
      returnProfile: toProfile,
      capabilityId: lease?.capabilityId || leaseId,
      reason: lease?.reason || `Release runtime lease ${leaseId}`,
      ttlMs: lease?.ttlMs || 0,
      expiresAt: lease?.expiresAt || this.now().toISOString(),
      applyWouldMutate: status === 'ready',
      budgetOk: true,
      budgetProfile: toProfile,
      activationPlan,
      lease,
      message,
      reasons: lease ? lease.reasons : ['No active lease was found.'],
      nextSteps: lease ? [] : ['Check zavorth doctor mode --ledger for active lease ids.'],
    };
  }

  private createLease(
    plan: MinimalRuntimeModePlan,
    dryRun: boolean,
    applied: boolean,
    status: MinimalRuntimeModeLeaseStatus,
  ): MinimalRuntimeModeLease {
    const now = this.now().toISOString();
    return {
      version: 1,
      id: this.createLeaseId(plan.action, plan.toProfile, plan.capabilityId),
      createdAt: now,
      updatedAt: now,
      operation: plan.action === 'elevate' ? 'elevate' : 'plan',
      status,
      fromProfile: plan.fromProfile,
      toProfile: plan.toProfile,
      previousProfile: plan.fromProfile,
      returnProfile: plan.returnProfile,
      capabilityId: plan.capabilityId,
      reason: plan.reason,
      ttlMs: plan.ttlMs,
      expiresAt: plan.expiresAt,
      dryRun,
      applied,
      message: plan.message,
      activationMode: plan.activationPlan.mode,
      activationStatus: plan.activationPlan.status,
      budgetOk: plan.budgetOk,
      budgetProfile: plan.budgetProfile,
      releaseOf: null,
      reasons: plan.reasons,
      nextSteps: plan.nextSteps,
    };
  }

  private appendLease(lease: MinimalRuntimeModeLease): MinimalRuntimeModeLease {
    fs.mkdirSync(path.dirname(this.ledgerFile), { recursive: true });
    fs.appendFileSync(this.ledgerFile, `${JSON.stringify(lease)}\n`, 'utf8');
    return lease;
  }

  private findActiveLease(leaseId: string): MinimalRuntimeModeLease | null {
    const parsed = this.readLeases();
    const normalizedId = String(leaseId || '').trim();
    const lease = parsed.leases.find((candidate) => candidate.id === normalizedId && candidate.status === 'active') || null;
    if (!lease || this.hasRelease(lease.id, parsed.leases)) {
      return null;
    }
    if (new Date(lease.expiresAt).getTime() <= this.now().getTime()) {
      return null;
    }
    return lease;
  }

  private readLeases(): {
    leases: MinimalRuntimeModeLease[];
    errors: Array<{ line: number; reason: string }>;
  } {
    if (!fs.existsSync(this.ledgerFile)) {
      return { leases: [], errors: [] };
    }
    const leases: MinimalRuntimeModeLease[] = [];
    const errors: Array<{ line: number; reason: string }> = [];
    fs.readFileSync(this.ledgerFile, 'utf8').split(/\r?\n/).forEach((line, index) => {
      if (!line.trim()) {
        return;
      }
      try {
        const parsed = JSON.parse(line) as MinimalRuntimeModeLease;
        this.assertLease(parsed);
        leases.push(parsed);
      } catch (error: unknown) {
        const err = asErrorLike(error);
        errors.push({
          line: index + 1,
          reason: error instanceof Error ? err.message : String(error),
        });
      }
    });
    return { leases, errors };
  }

  private assertLease(lease: MinimalRuntimeModeLease): void {
    if (!lease || typeof lease !== 'object') {
      throw new Error('Runtime mode lease must be an object.');
    }
    if (lease.version !== 1) {
      throw new Error('Runtime mode lease version must be 1.');
    }
    for (const field of ['id', 'createdAt', 'operation', 'status', 'fromProfile', 'toProfile', 'capabilityId'] as const) {
      if (!String(lease[field] || '').trim()) {
        throw new Error(`Runtime mode lease field ${field} is required.`);
      }
    }
  }

  private hasRelease(leaseId: string, leases: MinimalRuntimeModeLease[]): boolean {
    return leases.some((lease) => lease.releaseOf === leaseId && ['released', 'expired'].includes(lease.status));
  }

  private resolveProfile(value: string | null | undefined): RuntimeBudgetProfile {
    return new MinimalRuntimeProfileRegistry({ profileDir: this.profileDir }).resolveProfileId(value || 'minimal');
  }

  private resolveTargetProfile(
    fromProfile: RuntimeBudgetProfile,
    requestedProfile: string | null | undefined,
    capabilityId: string,
  ): RuntimeBudgetProfile {
    if (requestedProfile) {
      return this.resolveProfile(requestedProfile);
    }
    if (capabilityId.includes('browser')) {
      return 'browser';
    }
    if (capabilityId.includes('gateway')) {
      return fromProfile === 'safe-8gb' ? 'chat' : 'desktop';
    }
    const candidates = PROFILE_ORDER.filter((profile) => profile !== fromProfile && this.profileRank(profile) >= this.profileRank(fromProfile));
    for (const candidate of candidates) {
      const plan = this.buildActivationPlan(candidate, capabilityId);
      if (['active', 'ready'].includes(plan.status)) {
        return candidate;
      }
    }
    return fromProfile;
  }

  private isProfileTransitionAllowed(fromProfile: RuntimeBudgetProfile, toProfile: RuntimeBudgetProfile): boolean {
    if (fromProfile === toProfile) {
      return true;
    }
    if (fromProfile === 'minimal' && toProfile === 'full') {
      return false;
    }
    return this.profileRank(toProfile) >= this.profileRank(fromProfile)
      && this.profileRank(toProfile) - this.profileRank(fromProfile) <= 3;
  }

  private profileRank(profile: RuntimeBudgetProfile): number {
    const index = PROFILE_ORDER.indexOf(profile);
    return index >= 0 ? index : 0;
  }

  private buildActivationPlan(profile: RuntimeBudgetProfile, capabilityId: string): MinimalCapabilityActivationPlan {
    return new MinimalCapabilityActivationPlanner({
      projectRoot: this.projectRoot,
      dataDir: this.dataDir,
      manifestDir: this.manifestDir,
      profileDir: this.profileDir,
    }).buildPlan(capabilityId, profile);
  }

  private normalizeCapability(value: string | null | undefined): string {
    return String(value || '').trim().toLowerCase().replace(/[^a-z0-9._:-]+/g, '-').replace(/^-+|-+$/g, '') || 'browser';
  }

  private normalizeTtl(value: number | null | undefined): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return DEFAULT_TTL_MS;
    }
    return Math.min(MAX_TTL_MS, Math.max(MIN_TTL_MS, Math.floor(parsed)));
  }

  private createLeaseId(action: string, profile: string, capability: string): string {
    const stamp = this.now().toISOString().replace(/[-:.]/g, '').replace('T', '-').replace('Z', '');
    const suffix = Math.abs((process.pid * 131 + stamp.length * 17) % 100000).toString().padStart(5, '0');
    return `${stamp}-${action}-${profile}-${capability}-${suffix}`.replace(/[^a-zA-Z0-9._:-]+/g, '-').toLowerCase();
  }
}
