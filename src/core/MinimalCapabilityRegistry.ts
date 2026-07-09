import fs from 'fs';
import path from 'path';
export type MinimalCapabilityKind =
  | 'core'
  | 'channel'
  | 'tool'
  | 'memory'
  | 'browser'
  | 'model'
  | 'ui'
  | 'remote'
  | 'sidecar'
  | 'devtool';

export type MinimalCapabilityBootMode = 'always' | 'on-demand' | 'scheduled' | 'sidecar' | 'disabled';

export type MinimalCapabilityBudget = {
  rssMb?: number;
  heapUsedMb?: number;
  activeHandles?: number;
  activeRequests?: number;
  loadedCommonJsModules?: number;
};

export type MinimalCapabilitySidecarSpec = {
  command?: string | null;
  args?: string[];
  cwd?: string | null;
  env?: Record<string, string>;
  healthUrl?: string | null;
  statusFile?: string | null;
  logFile?: string | null;
  readyTimeoutMs?: number;
  idleTimeoutMs?: number;
  restartPolicy?: 'never' | 'on-failure';
};

export type MinimalCapabilityManifest = {
  id: string;
  label: string;
  kind: MinimalCapabilityKind;
  version: string;
  boot: MinimalCapabilityBootMode;
  entry?: string | null;
  description?: string;
  requires?: string[];
  provides?: string[];
  tags?: string[];
  budget?: MinimalCapabilityBudget;
  sidecar?: MinimalCapabilitySidecarSpec | null;
  enabled?: boolean;
  source?: 'kernel' | 'manifest';
  manifestPath?: string | null;
  profileOverride?: {
    profileId: string;
    originalBoot: MinimalCapabilityBootMode;
    boot: MinimalCapabilityBootMode;
  } | null;
};

export type MinimalCapabilityRegistrySnapshot = {
  version: 1;
  generatedAt: string;
  manifestDir: string;
  profileId: string;
  declared: number;
  total: number;
  activeOnBoot: number;
  onDemand: number;
  sidecars: number;
  disabled: number;
  invalid: number;
  allCapabilities: MinimalCapabilityManifest[];
  capabilities: MinimalCapabilityManifest[];
  invalidManifests: Array<{
    filePath: string;
    reason: string;
  }>;
};

export type MinimalCapabilityRegistryOptions = {
  manifestDir: string;
  kernelCapabilities?: MinimalCapabilityManifest[];
  profileId?: string;
  bootOverrides?: Record<string, MinimalCapabilityBootMode>;
};

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

export function createKernelCapabilityManifests(): MinimalCapabilityManifest[] {
  return [
    {
      id: 'config-minimal',
      label: 'Minimal Config',
      kind: 'core',
      version: '1.0.0',
      boot: 'always',
      description: 'Resolve paths and runtime profile without loading the full application config.',
      source: 'kernel',
    },
    {
      id: 'process-lock',
      label: 'Process Lock',
      kind: 'core',
      version: '1.0.0',
      boot: 'always',
      description: 'Prevents duplicate minimal-kernel instances in the same workspace.',
      source: 'kernel',
    },
    {
      id: 'event-bus',
      label: 'Event Bus',
      kind: 'core',
      version: '1.0.0',
      boot: 'always',
      description: 'In-process event bus for lightweight runtime coordination.',
      source: 'kernel',
    },
    {
      id: 'shutdown-manager',
      label: 'Shutdown Manager',
      kind: 'core',
      version: '1.0.0',
      boot: 'always',
      description: 'Handles signals and lock cleanup.',
      source: 'kernel',
    },
    {
      id: 'resource-budget',
      label: 'Resource Budget',
      kind: 'core',
      version: '1.0.0',
      boot: 'always',
      description: 'Measures process resource usage and checks runtime budgets.',
      source: 'kernel',
    },
  ];
}

export class MinimalCapabilityRegistry {
  private readonly manifestDir: string;
  private readonly kernelCapabilities: MinimalCapabilityManifest[];
  private readonly profileId: string;
  private readonly bootOverrides: Record<string, MinimalCapabilityBootMode>;
  private loaded: MinimalCapabilityRegistrySnapshot | null = null;

  constructor(options: MinimalCapabilityRegistryOptions) {
    this.manifestDir = options.manifestDir;
    this.profileId = String(options.profileId || 'minimal').trim().toLowerCase() || 'minimal';
    this.bootOverrides = Object.fromEntries(
      Object.entries(options.bootOverrides || {})
        .map(([id, boot]) => [this.normalizeId(id), boot])
        .filter(([id, boot]) => Boolean(id) && VALID_BOOT_MODES.has(boot as MinimalCapabilityBootMode)),
    ) as Record<string, MinimalCapabilityBootMode>;
    this.kernelCapabilities = (options.kernelCapabilities || createKernelCapabilityManifests())
      .map((capability) => this.normalizeManifest(capability, null, 'kernel'));
  }

  public load(): MinimalCapabilityRegistrySnapshot {
    const invalidManifests: MinimalCapabilityRegistrySnapshot['invalidManifests'] = [];
    const manifests = [...this.kernelCapabilities];

    if (this.manifestDir && fs.existsSync(this.manifestDir)) {
      for (const filePath of this.listManifestFiles(this.manifestDir)) {
        try {
          const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
          const items = Array.isArray(parsed) ? parsed : [parsed];
          for (const item of items) {
            manifests.push(this.normalizeManifest(item, filePath, 'manifest'));
          }
        } catch (error: unknown) {
          invalidManifests.push({
            filePath,
            reason: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }

    const profiledManifests = manifests.map((capability) => this.applyProfileOverride(capability));
    const allCapabilities = profiledManifests.sort((left, right) => left.id.localeCompare(right.id));
    const enabled = allCapabilities.filter((capability) => capability.enabled !== false);
    const snapshot: MinimalCapabilityRegistrySnapshot = {
      version: 1,
      generatedAt: new Date().toISOString(),
      manifestDir: this.manifestDir,
      profileId: this.profileId,
      declared: allCapabilities.length,
      total: enabled.length,
      activeOnBoot: enabled.filter((capability) => capability.boot === 'always').length,
      onDemand: enabled.filter((capability) => capability.boot === 'on-demand' || capability.boot === 'scheduled').length,
      sidecars: enabled.filter((capability) => capability.boot === 'sidecar').length,
      disabled: allCapabilities.length - enabled.length,
      invalid: invalidManifests.length,
      allCapabilities,
      capabilities: enabled,
      invalidManifests,
    };
    this.loaded = snapshot;
    return snapshot;
  }

  public getSnapshot(): MinimalCapabilityRegistrySnapshot {
    return this.loaded || this.load();
  }

  public getBootCapabilities(): MinimalCapabilityManifest[] {
    return this.getSnapshot().capabilities.filter((capability) => capability.boot === 'always');
  }

  public findById(id: string): MinimalCapabilityManifest | null {
    const normalized = this.normalizeId(id);
    return this.getSnapshot().capabilities.find((capability) => capability.id === normalized) || null;
  }

  private listManifestFiles(dir: string): string[] {
    return fs.readdirSync(dir, { withFileTypes: true })
      .flatMap((entry) => {
        const filePath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          return this.listManifestFiles(filePath);
        }
        return entry.isFile() && entry.name.toLowerCase().endsWith('.json') ? [filePath] : [];
      })
      .sort((left, right) => left.localeCompare(right));
  }

  private normalizeManifest(
    raw: unknown,
    manifestPath: string | null,
    source: 'kernel' | 'manifest',
  ): MinimalCapabilityManifest {
    if (!raw || typeof raw !== 'object') {
      throw new Error('Capability manifest must be an object.');
    }
    const input = raw as Record<string, unknown>;
    const id = this.normalizeId(input.id);
    if (!id) {
      throw new Error('Capability manifest missing required id.');
    }
    const kind = this.normalizeKind(input.kind);
    const boot = this.normalizeBootMode(input.boot);
    return {
      id,
      label: String(input.label || id).trim(),
      kind,
      version: String(input.version || '0.0.0').trim(),
      boot,
      entry: input.entry === undefined || input.entry === null ? null : String(input.entry).trim() || null,
      description: String(input.description || '').trim(),
      requires: this.normalizeStringList(input.requires),
      provides: this.normalizeStringList(input.provides),
      tags: this.normalizeStringList(input.tags),
      budget: this.normalizeBudget(input.budget),
      sidecar: this.normalizeSidecar(input.sidecar),
      enabled: input.enabled !== false && boot !== 'disabled',
      source,
      manifestPath,
      profileOverride: null,
    };
  }

  private applyProfileOverride(capability: MinimalCapabilityManifest): MinimalCapabilityManifest {
    if (capability.source === 'kernel') {
      return capability;
    }
    const override = this.bootOverrides[capability.id];
    if (!override) {
      return capability;
    }
    return {
      ...capability,
      boot: override,
      enabled: capability.enabled !== false && override !== 'disabled',
      profileOverride: {
        profileId: this.profileId,
        originalBoot: capability.boot,
        boot: override,
      },
    };
  }

  private normalizeId(value: unknown): string {
    return String(value || '').trim().toLowerCase().replace(/[^a-z0-9._:-]+/g, '-').replace(/^-+|-+$/g, '');
  }

  private normalizeKind(value: unknown): MinimalCapabilityKind {
    const normalized = String(value || '').trim().toLowerCase() as MinimalCapabilityKind;
    return VALID_KINDS.has(normalized) ? normalized : 'tool';
  }

  private normalizeBootMode(value: unknown): MinimalCapabilityBootMode {
    const normalized = String(value || '').trim().toLowerCase() as MinimalCapabilityBootMode;
    return VALID_BOOT_MODES.has(normalized) ? normalized : 'on-demand';
  }

  private normalizeStringList(value: unknown): string[] {
    return Array.isArray(value)
      ? value.map((entry) => String(entry || '').trim()).filter(Boolean)
      : [];
  }

  private normalizeBudget(value: unknown): MinimalCapabilityBudget {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }
    const input = value as Record<string, unknown>;
    const budget: MinimalCapabilityBudget = {};
    for (const key of ['rssMb', 'heapUsedMb', 'activeHandles', 'activeRequests', 'loadedCommonJsModules'] as const) {
      const rawValue = Number(input[key]);
      if (Number.isFinite(rawValue) && rawValue >= 0) {
        budget[key] = rawValue;
      }
    }
    return budget;
  }

  private normalizeSidecar(value: unknown): MinimalCapabilitySidecarSpec | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }
    const input = value as Record<string, unknown>;
    return {
      command: this.normalizeNullableString(input.command),
      args: this.normalizeStringList(input.args),
      cwd: this.normalizeNullableString(input.cwd),
      env: this.normalizeStringMap(input.env),
      healthUrl: this.normalizeNullableString(input.healthUrl),
      statusFile: this.normalizeNullableString(input.statusFile),
      logFile: this.normalizeNullableString(input.logFile),
      readyTimeoutMs: this.normalizePositiveInteger(input.readyTimeoutMs, 30_000),
      idleTimeoutMs: this.normalizePositiveInteger(input.idleTimeoutMs, 300_000),
      restartPolicy: String(input.restartPolicy || '').trim().toLowerCase() === 'on-failure' ? 'on-failure' : 'never',
    };
  }

  private normalizeNullableString(value: unknown): string | null {
    const normalized = String(value || '').trim();
    return normalized ? normalized : null;
  }

  private normalizeStringMap(value: unknown): Record<string, string> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .map(([key, entry]) => [String(key || '').trim(), String(entry || '').trim()])
        .filter(([key]) => Boolean(key)),
    );
  }

  private normalizePositiveInteger(value: unknown, fallback: number): number {
    const normalized = Number(value);
    return Number.isFinite(normalized) && normalized >= 0 ? Math.floor(normalized) : fallback;
  }
}
