import fs from 'fs';
import path from 'path';
import { findProjectRoot } from '../config/configHelpers.js';
import type { RuntimeBudgetProfile } from '../services/RuntimeResourceBudgetService.js';
import {
  MinimalCapabilityRegistry,
  type MinimalCapabilityBootMode,
  type MinimalCapabilityKind,
  type MinimalCapabilityManifest,
  type MinimalCapabilityRegistrySnapshot,
} from './MinimalCapabilityRegistry.js';
import {
  MinimalRuntimeProfileRegistry,
  type MinimalRuntimeProfile,
  type MinimalRuntimeProfileRegistrySnapshot,
} from './MinimalRuntimeProfileRegistry.js';
export type MinimalRuntimeContractSeverity = 'error' | 'warning' | 'info';

export type MinimalRuntimeContractIssue = {
  id: string;
  severity: MinimalRuntimeContractSeverity;
  subject: string;
  message: string;
  filePath?: string;
  recommendation?: string;
};

export type MinimalRuntimeContractProfileSummary = {
  id: RuntimeBudgetProfile;
  budgetProfile: RuntimeBudgetProfile;
  resourcePosture: MinimalRuntimeProfile['resourcePosture'];
  pollingMode: MinimalRuntimeProfile['pollingMode'];
  maintenanceMode: MinimalRuntimeProfile['maintenanceMode'];
  maxActiveSidecars: number;
  activeOnBoot: number;
  onDemand: number;
  sidecars: number;
  disabled: number;
};

export type MinimalRuntimeContractReport = {
  version: 1;
  generatedAt: string;
  status: 'passed' | 'warning' | 'failed';
  selectedProfileId: RuntimeBudgetProfile;
  manifestDir: string;
  profileDir: string;
  capabilitySummary: {
    declared: number;
    kernel: number;
    manifest: number;
    activeOnBoot: number;
    onDemand: number;
    sidecars: number;
    disabled: number;
    invalid: number;
  };
  profileSummary: {
    total: number;
    builtin: number;
    manifest: number;
    invalid: number;
    profiles: MinimalRuntimeContractProfileSummary[];
  };
  rules: string[];
  issues: MinimalRuntimeContractIssue[];
  recommendations: string[];
};

export type MinimalRuntimeContractServiceOptions = {
  projectRoot?: string;
  manifestDir?: string;
  profileDir?: string;
};

const VALID_PROFILE_IDS = new Set<RuntimeBudgetProfile>([
  'minimal',
  'chat',
  'desktop',
  'browser',
  'dev',
  'full',
  'safe-8gb',
]);

const VALID_KINDS = new Set<MinimalCapabilityKind>([
  'core',
  'channel',
  'tool',
  'memory',
  'browser',
  'model',
  'ui',
  'remote',
  'sidecar',
  'devtool',
]);

const VALID_BOOT_MODES = new Set<MinimalCapabilityBootMode>([
  'always',
  'on-demand',
  'scheduled',
  'sidecar',
  'disabled',
]);

const VALID_REQUIREMENTS = new Set([
  'filesystem',
  'network',
  'telegram-token',
  'browser',
  'provider-api-key',
  'local-model',
  'gpu',
  'sidecar',
  'workspace',
]);

const CONTRACT_RULES = [
  'manifest capabilities must not boot with always',
  'future features must be explicit in every runtime profile override',
  'sidecars must declare status files, idle policy, and stay outside minimal/event-first profiles',
  'manifest capabilities must declare budget, version, description, and provided surfaces',
  'lean profiles may only boot kernel capabilities',
  'dev-watch polling is allowed only for expanded development profiles',
];

export class MinimalRuntimeContractService {
  private readonly projectRoot: string;
  private readonly manifestDir: string;
  private readonly profileDir: string;

  constructor(options: MinimalRuntimeContractServiceOptions = {}) {
    this.projectRoot = options.projectRoot || findProjectRoot();
    this.manifestDir = options.manifestDir || path.resolve(this.projectRoot, 'config', 'capability-manifests');
    this.profileDir = options.profileDir || path.resolve(this.projectRoot, 'config', 'runtime-profiles');
  }

  public buildReport(selectedProfile: string | null | undefined = 'minimal'): MinimalRuntimeContractReport {
    const profileRegistry = new MinimalRuntimeProfileRegistry({ profileDir: this.profileDir });
    const profileSnapshot = profileRegistry.load(selectedProfile || 'minimal');
    const selectedCapabilities = this.loadCapabilitiesForProfile(profileSnapshot.selectedProfile);
    const issues: MinimalRuntimeContractIssue[] = [];

    this.validateRawCapabilityManifests(issues);
    this.validateRawRuntimeProfiles(issues);
    this.validateRegistryHealth(selectedCapabilities, profileSnapshot, issues);
    this.validateCapabilityContracts(selectedCapabilities, issues);

    const manifestIds = new Set(
      selectedCapabilities.allCapabilities
        .filter((capability) => capability.source === 'manifest')
        .map((capability) => capability.id),
    );
    const profileSummaries = profileSnapshot.profiles.map((profile) => {
      const capabilitySnapshot = this.loadCapabilitiesForProfile(profile);
      this.validateProfileContract(profile, capabilitySnapshot, manifestIds, issues);
      return this.buildProfileSummary(profile, capabilitySnapshot);
    });

    const status = issues.some((issue) => issue.severity === 'error')
      ? 'failed'
      : issues.some((issue) => issue.severity === 'warning')
        ? 'warning'
        : 'passed';
    const manifestCapabilities = selectedCapabilities.allCapabilities.filter((capability) => capability.source === 'manifest');
    const kernelCapabilities = selectedCapabilities.allCapabilities.filter((capability) => capability.source === 'kernel');

    return {
      version: 1,
      generatedAt: new Date().toISOString(),
      status,
      selectedProfileId: profileSnapshot.selectedProfile.id,
      manifestDir: this.manifestDir,
      profileDir: this.profileDir,
      capabilitySummary: {
        declared: selectedCapabilities.declared,
        kernel: kernelCapabilities.length,
        manifest: manifestCapabilities.length,
        activeOnBoot: selectedCapabilities.activeOnBoot,
        onDemand: selectedCapabilities.onDemand,
        sidecars: selectedCapabilities.sidecars,
        disabled: selectedCapabilities.disabled,
        invalid: selectedCapabilities.invalid,
      },
      profileSummary: {
        total: profileSnapshot.total,
        builtin: profileSnapshot.builtin,
        manifest: profileSnapshot.manifest,
        invalid: profileSnapshot.invalid,
        profiles: profileSummaries,
      },
      rules: CONTRACT_RULES,
      issues,
      recommendations: this.buildRecommendations(status, issues),
    };
  }

  private loadCapabilitiesForProfile(profile: MinimalRuntimeProfile): MinimalCapabilityRegistrySnapshot {
    return new MinimalCapabilityRegistry({
      manifestDir: this.manifestDir,
      profileId: profile.id,
      bootOverrides: profile.capabilityBootOverrides,
    }).load();
  }

  private validateRegistryHealth(
    capabilitySnapshot: MinimalCapabilityRegistrySnapshot,
    profileSnapshot: MinimalRuntimeProfileRegistrySnapshot,
    issues: MinimalRuntimeContractIssue[],
  ): void {
    for (const invalidManifest of capabilitySnapshot.invalidManifests) {
      this.pushIssue(issues, {
        id: 'capability-manifest-invalid',
        severity: 'error',
        subject: invalidManifest.filePath,
        filePath: invalidManifest.filePath,
        message: invalidManifest.reason,
        recommendation: 'Fix the manifest JSON before the capability can join any runtime profile.',
      });
    }
    for (const invalidProfile of profileSnapshot.invalidProfiles) {
      this.pushIssue(issues, {
        id: 'runtime-profile-invalid',
        severity: 'error',
        subject: invalidProfile.filePath,
        filePath: invalidProfile.filePath,
        message: invalidProfile.reason,
        recommendation: 'Fix the runtime profile JSON before using it as an architecture contract.',
      });
    }
  }

  private validateCapabilityContracts(
    capabilitySnapshot: MinimalCapabilityRegistrySnapshot,
    issues: MinimalRuntimeContractIssue[],
  ): void {
    const byId = new Map<string, MinimalCapabilityManifest[]>();
    for (const capability of capabilitySnapshot.allCapabilities) {
      byId.set(capability.id, [...(byId.get(capability.id) || []), capability]);
      if (capability.source === 'manifest') {
        this.validateManifestCapability(capability, issues);
      }
    }

    for (const [id, matches] of byId.entries()) {
      if (matches.length > 1) {
        this.pushIssue(issues, {
          id: 'capability-id-duplicate',
          severity: 'error',
          subject: id,
          message: `Capability id ${id} appears ${matches.length} times after normalization.`,
          recommendation: 'Keep ids globally unique across kernel and manifest capabilities.',
        });
      }
    }
  }

  private validateManifestCapability(
    capability: MinimalCapabilityManifest,
    issues: MinimalRuntimeContractIssue[],
  ): void {
    if (capability.boot === 'always') {
      this.pushIssue(issues, {
        id: 'manifest-boot-always',
        severity: 'error',
        subject: capability.id,
        filePath: capability.manifestPath || undefined,
        message: 'Manifest capabilities cannot enter the core boot path.',
        recommendation: 'Use on-demand, scheduled, sidecar, or disabled and let profiles opt in explicitly.',
      });
    }

    if (!capability.description) {
      this.pushIssue(issues, {
        id: 'capability-description-missing',
        severity: 'error',
        subject: capability.id,
        filePath: capability.manifestPath || undefined,
        message: 'Capability manifests must describe the feature boundary.',
      });
    }

    if ((capability.provides || []).length === 0) {
      this.pushIssue(issues, {
        id: 'capability-provides-missing',
        severity: 'error',
        subject: capability.id,
        filePath: capability.manifestPath || undefined,
        message: 'Capability manifests must declare at least one provided surface.',
      });
    }

    if (Object.keys(capability.budget || {}).length === 0) {
      this.pushIssue(issues, {
        id: 'capability-budget-missing',
        severity: 'error',
        subject: capability.id,
        filePath: capability.manifestPath || undefined,
        message: 'Capability manifests must declare a resource budget.',
      });
    }

    if (capability.boot === 'sidecar' && !capability.sidecar) {
      this.pushIssue(issues, {
        id: 'sidecar-spec-missing',
        severity: 'error',
        subject: capability.id,
        filePath: capability.manifestPath || undefined,
        message: 'Sidecar capabilities must declare a sidecar block.',
      });
    }

    if (capability.sidecar && !capability.sidecar.statusFile) {
      this.pushIssue(issues, {
        id: 'sidecar-status-file-missing',
        severity: 'error',
        subject: capability.id,
        filePath: capability.manifestPath || undefined,
        message: 'Sidecar capabilities must declare a statusFile for dry-run and lifecycle tracking.',
      });
    }
  }

  private validateProfileContract(
    profile: MinimalRuntimeProfile,
    capabilitySnapshot: MinimalCapabilityRegistrySnapshot,
    manifestIds: Set<string>,
    issues: MinimalRuntimeContractIssue[],
  ): void {
    if (capabilitySnapshot.sidecars > profile.maxActiveSidecars) {
      this.pushIssue(issues, {
        id: 'profile-sidecar-limit-exceeded',
        severity: 'error',
        subject: profile.id,
        filePath: profile.manifestPath || undefined,
        message: `Profile exposes ${capabilitySnapshot.sidecars} sidecars but maxActiveSidecars is ${profile.maxActiveSidecars}.`,
        recommendation: 'Disable, on-demand, or raise the profile limit intentionally.',
      });
    }

    if (profile.pollingMode === 'event-first' && capabilitySnapshot.sidecars > 0) {
      this.pushIssue(issues, {
        id: 'event-first-profile-has-sidecar',
        severity: 'error',
        subject: profile.id,
        filePath: profile.manifestPath || undefined,
        message: 'Event-first profiles must not expose sidecars by default.',
        recommendation: 'Keep sidecars disabled/on-demand for event-first profiles.',
      });
    }

    const kernelBootCount = capabilitySnapshot.allCapabilities.filter(
      (capability) => capability.source === 'kernel' && capability.boot === 'always',
    ).length;
    if (profile.resourcePosture === 'lean' && capabilitySnapshot.activeOnBoot > kernelBootCount) {
      this.pushIssue(issues, {
        id: 'lean-profile-manifest-boot',
        severity: 'error',
        subject: profile.id,
        filePath: profile.manifestPath || undefined,
        message: 'Lean profiles may only boot kernel capabilities.',
        recommendation: 'Move manifest capabilities to on-demand, sidecar, or disabled in this profile.',
      });
    }

    if (profile.pollingMode === 'dev-watch' && profile.resourcePosture !== 'expanded') {
      this.pushIssue(issues, {
        id: 'dev-watch-profile-not-expanded',
        severity: 'error',
        subject: profile.id,
        filePath: profile.manifestPath || undefined,
        message: 'dev-watch polling is reserved for expanded profiles.',
      });
    }

    for (const [capabilityId, boot] of Object.entries(profile.capabilityBootOverrides)) {
      if (!manifestIds.has(capabilityId)) {
        this.pushIssue(issues, {
          id: 'profile-override-unknown-capability',
          severity: 'error',
          subject: `${profile.id}:${capabilityId}`,
          filePath: profile.manifestPath || undefined,
          message: `Profile override points to unknown capability ${capabilityId}.`,
        });
      }
      if (!VALID_BOOT_MODES.has(boot)) {
        this.pushIssue(issues, {
          id: 'profile-override-invalid-boot',
          severity: 'error',
          subject: `${profile.id}:${capabilityId}`,
          filePath: profile.manifestPath || undefined,
          message: `Profile override ${capabilityId}:${boot} is not a valid boot mode.`,
        });
      }
    }

    for (const capabilityId of manifestIds) {
      if (!Object.prototype.hasOwnProperty.call(profile.capabilityBootOverrides, capabilityId)) {
        this.pushIssue(issues, {
          id: 'profile-override-missing',
          severity: 'error',
          subject: `${profile.id}:${capabilityId}`,
          filePath: profile.manifestPath || undefined,
          message: `Profile does not explicitly decide boot mode for capability ${capabilityId}.`,
          recommendation: 'Every profile must opt in, defer, or disable every manifest capability.',
        });
      }
    }
  }

  private validateRawCapabilityManifests(issues: MinimalRuntimeContractIssue[]): void {
    for (const filePath of this.listJsonFiles(this.manifestDir)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
        const items = Array.isArray(parsed) ? parsed : [parsed];
        items.forEach((item, index) => this.validateRawCapabilityManifest(filePath, item, index, issues));
      } catch (error: unknown) {
        this.pushIssue(issues, {
          id: 'capability-json-invalid',
          severity: 'error',
          subject: filePath,
          filePath,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  private validateRawCapabilityManifest(
    filePath: string,
    raw: unknown,
    index: number,
    issues: MinimalRuntimeContractIssue[],
  ): void {
    const subject = `${path.basename(filePath)}#${index}`;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      this.pushIssue(issues, {
        id: 'capability-contract-not-object',
        severity: 'error',
        subject,
        filePath,
        message: 'Capability manifest entries must be objects.',
      });
      return;
    }
    const input = raw as Record<string, unknown>;
    const id = this.readString(input.id);
    const kind = this.readString(input.kind) as MinimalCapabilityKind;
    const boot = this.readString(input.boot) as MinimalCapabilityBootMode;

    if (!id) {
      this.pushIssue(issues, {
        id: 'capability-id-missing',
        severity: 'error',
        subject,
        filePath,
        message: 'Capability manifest id is required.',
      });
    }
    if (!this.readString(input.label)) {
      this.pushIssue(issues, {
        id: 'capability-label-missing',
        severity: 'error',
        subject: id || subject,
        filePath,
        message: 'Capability manifest label is required.',
      });
    }
    if (!VALID_KINDS.has(kind)) {
      this.pushIssue(issues, {
        id: 'capability-kind-invalid',
        severity: 'error',
        subject: id || subject,
        filePath,
        message: `Capability kind ${String(input.kind || '')} is not valid.`,
      });
    }
    if (!VALID_BOOT_MODES.has(boot)) {
      this.pushIssue(issues, {
        id: 'capability-boot-invalid',
        severity: 'error',
        subject: id || subject,
        filePath,
        message: `Capability boot ${String(input.boot || '')} is not valid.`,
      });
    }
    if (!this.isSemverLike(this.readString(input.version))) {
      this.pushIssue(issues, {
        id: 'capability-version-invalid',
        severity: 'error',
        subject: id || subject,
        filePath,
        message: 'Capability version must be semver-like, for example 0.1.0.',
      });
    }
    this.validateRawStringList(filePath, id || subject, 'requires', input.requires, issues, true, true);
    this.validateRawStringList(filePath, id || subject, 'provides', input.provides, issues, false, false);
    this.validateRawBudget(filePath, id || subject, input.budget, issues);
    this.validateRawSidecar(filePath, id || subject, boot, input.sidecar, issues);
  }

  private validateRawRuntimeProfiles(issues: MinimalRuntimeContractIssue[]): void {
    for (const filePath of this.listJsonFiles(this.profileDir)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
        const items = Array.isArray(parsed) ? parsed : [parsed];
        items.forEach((item, index) => this.validateRawRuntimeProfile(filePath, item, index, issues));
      } catch (error: unknown) {
        this.pushIssue(issues, {
          id: 'runtime-profile-json-invalid',
          severity: 'error',
          subject: filePath,
          filePath,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  private validateRawRuntimeProfile(
    filePath: string,
    raw: unknown,
    index: number,
    issues: MinimalRuntimeContractIssue[],
  ): void {
    const subject = `${path.basename(filePath)}#${index}`;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      this.pushIssue(issues, {
        id: 'runtime-profile-contract-not-object',
        severity: 'error',
        subject,
        filePath,
        message: 'Runtime profile entries must be objects.',
      });
      return;
    }
    const input = raw as Record<string, unknown>;
    const id = this.readString(input.id) as RuntimeBudgetProfile;
    if (!VALID_PROFILE_IDS.has(id)) {
      this.pushIssue(issues, {
        id: 'runtime-profile-id-invalid',
        severity: 'error',
        subject,
        filePath,
        message: `Runtime profile id ${String(input.id || '')} is not valid.`,
      });
    }
    this.validateProfileEnum(filePath, id || subject, 'budgetProfile', input.budgetProfile, VALID_PROFILE_IDS, issues);
    this.validateProfileEnum(filePath, id || subject, 'resourcePosture', input.resourcePosture, new Set(['lean', 'balanced', 'expanded']), issues);
    this.validateProfileEnum(filePath, id || subject, 'pollingMode', input.pollingMode, new Set(['event-first', 'adaptive', 'dev-watch']), issues);
    this.validateProfileEnum(filePath, id || subject, 'maintenanceMode', input.maintenanceMode, new Set(['off', 'light', 'normal']), issues);
    this.validatePositiveNumber(filePath, id || subject, 'maxActiveSidecars', input.maxActiveSidecars, issues);
    this.validatePositiveNumber(filePath, id || subject, 'sidecarIdleTimeoutMs', input.sidecarIdleTimeoutMs, issues);

    if (!input.capabilityBootOverrides || typeof input.capabilityBootOverrides !== 'object' || Array.isArray(input.capabilityBootOverrides)) {
      this.pushIssue(issues, {
        id: 'runtime-profile-overrides-invalid',
        severity: 'error',
        subject: id || subject,
        filePath,
        message: 'Runtime profiles must declare capabilityBootOverrides as an object.',
      });
      return;
    }
    for (const [capabilityId, rawBoot] of Object.entries(input.capabilityBootOverrides as Record<string, unknown>)) {
      const boot = this.readString(rawBoot) as MinimalCapabilityBootMode;
      if (!capabilityId.trim() || !VALID_BOOT_MODES.has(boot)) {
        this.pushIssue(issues, {
          id: 'runtime-profile-override-invalid',
          severity: 'error',
          subject: `${id || subject}:${capabilityId}`,
          filePath,
          message: `Profile override ${capabilityId}:${String(rawBoot || '')} is not valid.`,
        });
      }
    }
  }

  private validateRawStringList(
    filePath: string,
    subject: string,
    field: 'requires' | 'provides',
    value: unknown,
    issues: MinimalRuntimeContractIssue[],
    validateRequirements: boolean,
    allowEmpty: boolean,
  ): void {
    if (!Array.isArray(value) || (!allowEmpty && value.length === 0)) {
      this.pushIssue(issues, {
        id: `capability-${field}-invalid`,
        severity: 'error',
        subject,
        filePath,
        message: allowEmpty
          ? `Capability ${field} must be a string array.`
          : `Capability ${field} must be a non-empty string array.`,
      });
      return;
    }
    for (const entry of value) {
      const normalized = this.readString(entry);
      if (!normalized) {
        this.pushIssue(issues, {
          id: `capability-${field}-entry-invalid`,
          severity: 'error',
          subject,
          filePath,
          message: `Capability ${field} contains an empty entry.`,
        });
      }
      if (validateRequirements && normalized && !VALID_REQUIREMENTS.has(normalized)) {
        this.pushIssue(issues, {
          id: 'capability-requirement-unknown',
          severity: 'warning',
          subject,
          filePath,
          message: `Requirement ${normalized} is not in the minimal runtime vocabulary.`,
          recommendation: 'Add the requirement to the contract vocabulary or rename it to a known runtime primitive.',
        });
      }
    }
  }

  private validateRawBudget(
    filePath: string,
    subject: string,
    budget: unknown,
    issues: MinimalRuntimeContractIssue[],
  ): void {
    if (!budget || typeof budget !== 'object' || Array.isArray(budget)) {
      this.pushIssue(issues, {
        id: 'capability-budget-invalid',
        severity: 'error',
        subject,
        filePath,
        message: 'Capability budget must be an object.',
      });
      return;
    }
    for (const field of ['rssMb', 'heapUsedMb'] as const) {
      this.validatePositiveNumber(filePath, subject, `budget.${field}`, (budget as Record<string, unknown>)[field], issues);
    }
  }

  private validateRawSidecar(
    filePath: string,
    subject: string,
    boot: MinimalCapabilityBootMode,
    sidecar: unknown,
    issues: MinimalRuntimeContractIssue[],
  ): void {
    if (boot !== 'sidecar') {
      return;
    }
    if (!sidecar || typeof sidecar !== 'object' || Array.isArray(sidecar)) {
      this.pushIssue(issues, {
        id: 'sidecar-contract-invalid',
        severity: 'error',
        subject,
        filePath,
        message: 'Sidecar boot requires a sidecar object.',
      });
      return;
    }
    const input = sidecar as Record<string, unknown>;
    if (!this.readString(input.statusFile)) {
      this.pushIssue(issues, {
        id: 'sidecar-contract-status-file-missing',
        severity: 'error',
        subject,
        filePath,
        message: 'Sidecar contract must declare statusFile.',
      });
    }
    if (input.command !== undefined && !this.readString(input.cwd)) {
      this.pushIssue(issues, {
        id: 'sidecar-contract-cwd-missing',
        severity: 'error',
        subject,
        filePath,
        message: 'Launchable sidecars must declare cwd.',
      });
    }
    this.validatePositiveNumber(filePath, subject, 'sidecar.idleTimeoutMs', input.idleTimeoutMs, issues);
  }

  private validateProfileEnum<T extends string>(
    filePath: string,
    subject: string,
    field: string,
    value: unknown,
    allowed: Set<T>,
    issues: MinimalRuntimeContractIssue[],
  ): void {
    const normalized = this.readString(value) as T;
    if (!allowed.has(normalized)) {
      this.pushIssue(issues, {
        id: 'runtime-profile-enum-invalid',
        severity: 'error',
        subject,
        filePath,
        message: `Runtime profile ${field}=${String(value || '')} is not valid.`,
      });
    }
  }

  private validatePositiveNumber(
    filePath: string,
    subject: string,
    field: string,
    value: unknown,
    issues: MinimalRuntimeContractIssue[],
  ): void {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric < 0) {
      this.pushIssue(issues, {
        id: 'contract-number-invalid',
        severity: 'error',
        subject,
        filePath,
        message: `${field} must be a positive number.`,
      });
    }
  }

  private buildProfileSummary(
    profile: MinimalRuntimeProfile,
    capabilitySnapshot: MinimalCapabilityRegistrySnapshot,
  ): MinimalRuntimeContractProfileSummary {
    return {
      id: profile.id,
      budgetProfile: profile.budgetProfile,
      resourcePosture: profile.resourcePosture,
      pollingMode: profile.pollingMode,
      maintenanceMode: profile.maintenanceMode,
      maxActiveSidecars: profile.maxActiveSidecars,
      activeOnBoot: capabilitySnapshot.activeOnBoot,
      onDemand: capabilitySnapshot.onDemand,
      sidecars: capabilitySnapshot.sidecars,
      disabled: capabilitySnapshot.disabled,
    };
  }

  private buildRecommendations(status: MinimalRuntimeContractReport['status'], issues: MinimalRuntimeContractIssue[]): string[] {
    if (status === 'passed') {
      return [
        'Add future features as manifest capabilities first, then decide boot mode in every runtime profile.',
        'Keep feature code behind on-demand imports or sidecar launchers so the minimal kernel remains stable.',
      ];
    }
    return Array.from(new Set(
      issues
        .map((issue) => issue.recommendation)
        .filter((recommendation): recommendation is string => Boolean(recommendation)),
    ));
  }

  private listJsonFiles(dir: string): string[] {
    if (!dir || !fs.existsSync(dir)) {
      return [];
    }
    return fs.readdirSync(dir, { withFileTypes: true })
      .flatMap((entry) => {
        const filePath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          return this.listJsonFiles(filePath);
        }
        return entry.isFile() && entry.name.toLowerCase().endsWith('.json') ? [filePath] : [];
      })
      .sort((left, right) => left.localeCompare(right));
  }

  private readString(value: unknown): string {
    return String(value || '').trim().toLowerCase();
  }

  private isSemverLike(value: string): boolean {
    return /^\d+\.\d+\.\d+(?:[-+][a-z0-9.-]+)?$/i.test(value);
  }

  private pushIssue(issues: MinimalRuntimeContractIssue[], issue: MinimalRuntimeContractIssue): void {
    const key = `${issue.id}:${issue.subject}:${issue.filePath || ''}:${issue.message}`;
    if (issues.some((existing) => `${existing.id}:${existing.subject}:${existing.filePath || ''}:${existing.message}` === key)) {
      return;
    }
    issues.push(issue);
  }
}
