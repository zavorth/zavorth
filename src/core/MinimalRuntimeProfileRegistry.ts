import fs from 'fs';
import path from 'path';
import type { RuntimeBudgetProfile } from '../services/RuntimeResourceBudgetService.js';
import type { MinimalCapabilityBootMode } from './MinimalCapabilityRegistry.js';

export type MinimalRuntimePollingMode = 'event-first' | 'adaptive' | 'dev-watch';
export type MinimalRuntimeMaintenanceMode = 'off' | 'light' | 'normal';
export type MinimalRuntimeResourcePosture = 'lean' | 'balanced' | 'expanded';

export type MinimalRuntimeProfile = {
  id: RuntimeBudgetProfile;
  label: string;
  description: string;
  budgetProfile: RuntimeBudgetProfile;
  resourcePosture: MinimalRuntimeResourcePosture;
  pollingMode: MinimalRuntimePollingMode;
  maintenanceMode: MinimalRuntimeMaintenanceMode;
  maxActiveSidecars: number;
  sidecarIdleTimeoutMs: number;
  capabilityBootOverrides: Record<string, MinimalCapabilityBootMode>;
  notes: string[];
  source: 'builtin' | 'manifest';
  manifestPath?: string | null;
};

export type MinimalRuntimeProfileRegistrySnapshot = {
  version: 1;
  generatedAt: string;
  profileDir: string;
  selectedProfileId: RuntimeBudgetProfile;
  selectedProfile: MinimalRuntimeProfile;
  total: number;
  builtin: number;
  manifest: number;
  invalid: number;
  profiles: MinimalRuntimeProfile[];
  invalidProfiles: Array<{
    filePath: string;
    reason: string;
  }>;
};

export type MinimalRuntimeProfileRegistryOptions = {
  profileDir: string;
};

const PROFILE_IDS: RuntimeBudgetProfile[] = ['minimal', 'chat', 'desktop', 'browser', 'dev', 'full', 'safe-8gb'];
const PROFILE_ID_SET = new Set<string>(PROFILE_IDS);
const BOOT_MODES = new Set<MinimalCapabilityBootMode>(['always', 'on-demand', 'scheduled', 'sidecar', 'disabled']);

function createBuiltInProfiles(): MinimalRuntimeProfile[] {
  return [
    {
      id: 'minimal',
      label: 'Minimal',
      description: 'Core kernel only. No channels, browser, gateway, zavorthControls, or dev tooling on boot.',
      budgetProfile: 'minimal',
      resourcePosture: 'lean',
      pollingMode: 'event-first',
      maintenanceMode: 'off',
      maxActiveSidecars: 0,
      sidecarIdleTimeoutMs: 60_000,
      capabilityBootOverrides: {
        telegram: 'disabled',
        browser: 'disabled',
        'ai-gateway': 'disabled',
        'web-browser': 'disabled',
        'workspace-files': 'disabled',
      },
      notes: ['Use this profile for budget probes, bootstrap checks, and extremely constrained hosts.'],
      source: 'builtin',
    },
    {
      id: 'chat',
      label: 'Chat',
      description: 'Lean conversational profile. Channels are available on demand; heavy browser sidecars stay disabled.',
      budgetProfile: 'chat',
      resourcePosture: 'lean',
      pollingMode: 'adaptive',
      maintenanceMode: 'light',
      maxActiveSidecars: 1,
      sidecarIdleTimeoutMs: 180_000,
      capabilityBootOverrides: {
        telegram: 'on-demand',
        browser: 'disabled',
        'ai-gateway': 'on-demand',
        'web-browser': 'disabled',
        'workspace-files': 'on-demand',
      },
      notes: ['Designed for day-to-day chat without opening browser automation by accident.'],
      source: 'builtin',
    },
    {
      id: 'desktop',
      label: 'Desktop',
      description: 'Balanced desktop profile. Browser and gateway are managed as sidecars, not core imports.',
      budgetProfile: 'desktop',
      resourcePosture: 'balanced',
      pollingMode: 'adaptive',
      maintenanceMode: 'light',
      maxActiveSidecars: 2,
      sidecarIdleTimeoutMs: 300_000,
      capabilityBootOverrides: {
        telegram: 'on-demand',
        browser: 'sidecar',
        'ai-gateway': 'sidecar',
        'web-browser': 'on-demand',
        'workspace-files': 'on-demand',
      },
      notes: ['Good default for a workstation when browser actions are sometimes needed.'],
      source: 'builtin',
    },
    {
      id: 'browser',
      label: 'Browser',
      description: 'Browser automation profile. Browser is a first-class sidecar while chat channels remain optional.',
      budgetProfile: 'browser',
      resourcePosture: 'balanced',
      pollingMode: 'adaptive',
      maintenanceMode: 'light',
      maxActiveSidecars: 1,
      sidecarIdleTimeoutMs: 180_000,
      capabilityBootOverrides: {
        telegram: 'disabled',
        browser: 'sidecar',
        'ai-gateway': 'on-demand',
        'web-browser': 'on-demand',
        'workspace-files': 'on-demand',
      },
      notes: ['Use for web inspection, screenshots, and browser automation sessions.'],
      source: 'builtin',
    },
    {
      id: 'dev',
      label: 'Development',
      description: 'Development profile with broader sidecar allowance and dev-watch posture.',
      budgetProfile: 'dev',
      resourcePosture: 'expanded',
      pollingMode: 'dev-watch',
      maintenanceMode: 'normal',
      maxActiveSidecars: 3,
      sidecarIdleTimeoutMs: 600_000,
      capabilityBootOverrides: {
        telegram: 'on-demand',
        browser: 'sidecar',
        'ai-gateway': 'sidecar',
        'web-browser': 'on-demand',
        'workspace-files': 'on-demand',
      },
      notes: ['Allows more tooling pressure, but still keeps heavy dependencies outside the minimal core.'],
      source: 'builtin',
    },
    {
      id: 'full',
      label: 'Full',
      description: 'Maximum feature availability. Heavy capabilities are still sidecars or on demand.',
      budgetProfile: 'full',
      resourcePosture: 'expanded',
      pollingMode: 'adaptive',
      maintenanceMode: 'normal',
      maxActiveSidecars: 4,
      sidecarIdleTimeoutMs: 600_000,
      capabilityBootOverrides: {
        telegram: 'on-demand',
        browser: 'sidecar',
        'ai-gateway': 'sidecar',
        'web-browser': 'on-demand',
        'workspace-files': 'on-demand',
      },
      notes: ['Feature-complete profile for stronger machines or explicit full runtime sessions.'],
      source: 'builtin',
    },
    {
      id: 'safe-8gb',
      label: 'Safe 8GB',
      description: 'Constrained desktop profile for 8GB RAM hosts. Browser and gateway stay off until explicitly requested.',
      budgetProfile: 'safe-8gb',
      resourcePosture: 'lean',
      pollingMode: 'event-first',
      maintenanceMode: 'light',
      maxActiveSidecars: 1,
      sidecarIdleTimeoutMs: 120_000,
      capabilityBootOverrides: {
        telegram: 'on-demand',
        browser: 'disabled',
        'ai-gateway': 'disabled',
        'web-browser': 'disabled',
        'workspace-files': 'on-demand',
      },
      notes: ['Prefer this profile on memory pressure. It keeps expensive sidecars out of the default path.'],
      source: 'builtin',
    },
  ];
}

export class MinimalRuntimeProfileRegistry {
  private readonly profileDir: string;
  private loaded: MinimalRuntimeProfileRegistrySnapshot | null = null;

  constructor(options: MinimalRuntimeProfileRegistryOptions) {
    this.profileDir = options.profileDir;
  }

  public load(selectedProfile: string | null | undefined): MinimalRuntimeProfileRegistrySnapshot {
    const invalidProfiles: MinimalRuntimeProfileRegistrySnapshot['invalidProfiles'] = [];
    const profiles = new Map<RuntimeBudgetProfile, MinimalRuntimeProfile>();

    for (const profile of createBuiltInProfiles()) {
      profiles.set(profile.id, profile);
    }

    if (this.profileDir && fs.existsSync(this.profileDir)) {
      for (const filePath of this.listProfileFiles(this.profileDir)) {
        try {
          const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
          const items = Array.isArray(parsed) ? parsed : [parsed];
          for (const item of items) {
            const profile = this.normalizeProfile(item, filePath);
            profiles.set(profile.id, profile);
          }
        } catch (error) {
          invalidProfiles.push({
            filePath,
            reason: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }

    const selectedProfileId = this.resolveProfileId(selectedProfile);
    const profileList = Array.from(profiles.values()).sort((left, right) => left.id.localeCompare(right.id));
    const selected = profiles.get(selectedProfileId) || profiles.get('minimal') as MinimalRuntimeProfile;
    const snapshot: MinimalRuntimeProfileRegistrySnapshot = {
      version: 1,
      generatedAt: new Date().toISOString(),
      profileDir: this.profileDir,
      selectedProfileId: selected.id,
      selectedProfile: selected,
      total: profileList.length,
      builtin: profileList.filter((profile) => profile.source === 'builtin').length,
      manifest: profileList.filter((profile) => profile.source === 'manifest').length,
      invalid: invalidProfiles.length,
      profiles: profileList,
      invalidProfiles,
    };
    this.loaded = snapshot;
    return snapshot;
  }

  public getSnapshot(selectedProfile: string | null | undefined): MinimalRuntimeProfileRegistrySnapshot {
    if (this.loaded && this.loaded.selectedProfileId === this.resolveProfileId(selectedProfile)) {
      return this.loaded;
    }
    return this.load(selectedProfile);
  }

  public resolveProfileId(value: string | null | undefined): RuntimeBudgetProfile {
    const normalized = String(value || '').trim().toLowerCase();
    return PROFILE_ID_SET.has(normalized) ? normalized as RuntimeBudgetProfile : 'minimal';
  }

  private listProfileFiles(dir: string): string[] {
    return fs.readdirSync(dir, { withFileTypes: true })
      .flatMap((entry) => {
        const filePath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          return this.listProfileFiles(filePath);
        }
        return entry.isFile() && entry.name.toLowerCase().endsWith('.json') ? [filePath] : [];
      })
      .sort((left, right) => left.localeCompare(right));
  }

  private normalizeProfile(raw: unknown, manifestPath: string): MinimalRuntimeProfile {
    if (!raw || typeof raw !== 'object') {
      throw new Error('Runtime profile manifest must be an object.');
    }
    const input = raw as Record<string, unknown>;
    const id = this.resolveProfileId(String(input.id || '').trim());
    if (!String(input.id || '').trim() || id === 'minimal' && String(input.id || '').trim().toLowerCase() !== 'minimal') {
      throw new Error('Runtime profile manifest has an invalid id.');
    }
    const builtInFallback = createBuiltInProfiles().find((profile) => profile.id === id) || createBuiltInProfiles()[0];
    return {
      ...builtInFallback,
      id,
      label: String(input.label || builtInFallback.label).trim(),
      description: String(input.description || builtInFallback.description).trim(),
      budgetProfile: this.resolveProfileId(String(input.budgetProfile || id)),
      resourcePosture: this.normalizeEnum(input.resourcePosture, ['lean', 'balanced', 'expanded'], builtInFallback.resourcePosture),
      pollingMode: this.normalizeEnum(input.pollingMode, ['event-first', 'adaptive', 'dev-watch'], builtInFallback.pollingMode),
      maintenanceMode: this.normalizeEnum(input.maintenanceMode, ['off', 'light', 'normal'], builtInFallback.maintenanceMode),
      maxActiveSidecars: this.normalizePositiveInteger(input.maxActiveSidecars, builtInFallback.maxActiveSidecars),
      sidecarIdleTimeoutMs: this.normalizePositiveInteger(input.sidecarIdleTimeoutMs, builtInFallback.sidecarIdleTimeoutMs),
      capabilityBootOverrides: {
        ...builtInFallback.capabilityBootOverrides,
        ...this.normalizeBootOverrides(input.capabilityBootOverrides),
      },
      notes: this.normalizeStringList(input.notes, builtInFallback.notes),
      source: 'manifest',
      manifestPath,
    };
  }

  private normalizeBootOverrides(value: unknown): Record<string, MinimalCapabilityBootMode> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }
    const overrides: Record<string, MinimalCapabilityBootMode> = {};
    for (const [rawId, rawBoot] of Object.entries(value as Record<string, unknown>)) {
      const id = String(rawId || '').trim().toLowerCase();
      const boot = String(rawBoot || '').trim().toLowerCase() as MinimalCapabilityBootMode;
      if (id && BOOT_MODES.has(boot)) {
        overrides[id] = boot;
      }
    }
    return overrides;
  }

  private normalizePositiveInteger(value: unknown, fallback: number): number {
    const normalized = Number(value);
    return Number.isFinite(normalized) && normalized >= 0 ? Math.floor(normalized) : fallback;
  }

  private normalizeStringList(value: unknown, fallback: string[]): string[] {
    return Array.isArray(value)
      ? value.map((entry) => String(entry || '').trim()).filter(Boolean)
      : fallback;
  }

  private normalizeEnum<T extends string>(value: unknown, allowed: T[], fallback: T): T {
    const normalized = String(value || '').trim().toLowerCase() as T;
    return allowed.includes(normalized) ? normalized : fallback;
  }
}
