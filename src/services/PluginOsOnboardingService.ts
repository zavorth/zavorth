import fs from 'node:fs';
import path from 'node:path';

import { PluginStateBridgeService } from './PluginStateBridgeService.js';
import { PluginCuratedMarketplaceService } from './PluginCuratedMarketplaceService.js';
import { PluginOsBootstrapCatalogService } from './PluginOsBootstrapCatalogService.js';
import { PluginOsTelemetryService } from './PluginOsTelemetryService.js';

export type PluginOsOnboardingProfileId = 'minimal' | 'core' | 'recommended' | 'full' | string;

export type PluginOsOnboardingProfile = {
  id: string;
  label: string;
  summary: string;
  includeIds?: string[];
  includeTiers?: string[];
  excludeIds?: string[];
  excludeOptional?: boolean;
};

export type PluginOsOnboardingConfig = {
  schemaVersion?: string;
  defaultProfile?: string;
  injectAgentSurface?: boolean;
  injectMaxCatalog?: number;
  profiles?: Record<string, Omit<PluginOsOnboardingProfile, 'id'>>;
  optionalIds?: string[];
  notes?: string[];
};

export type PluginOsOnboardingPlan = {
  ok: boolean;
  profile: string;
  targetIds: string[];
  optionalIds: string[];
  alreadyEnabled: string[];
  toEnable: string[];
  missing: string[];
  findings: string[];
  formatText(): string;
};

export type PluginOsOnboardingApplyResult = {
  ok: boolean;
  profile: string;
  enabled: string[];
  skipped: Array<{ pluginId: string; reason: string }>;
  missing: string[];
  optionalSelected: string[];
  statePath: string | null;
  findings: string[];
  formatText(): string;
};

export type PluginOsOnboardingUndoResult = {
  ok: boolean;
  disabled: string[];
  skipped: Array<{ pluginId: string; reason: string }>;
  profile: string | null;
  statePath: string | null;
  findings: string[];
  formatText(): string;
};

export type PluginOsOnboardingStatus = {
  completed: boolean;
  profile: string | null;
  completedAt: string | null;
  undoneAt: string | null;
  enabledIds: string[];
  optionalSelected: string[];
  injectAgentSurface: boolean;
  defaultProfile: string;
  profiles: PluginOsOnboardingProfile[];
  optionalIds: string[];
  notes: string[];
  formatText(): string;
};

export type PluginOsOnboardingRuntime = {
  now?: () => Date;
  projectRoot?: string;
  stateBridge?: PluginStateBridgeService;
  curated?: PluginCuratedMarketplaceService;
  bootstrapCatalog?: PluginOsBootstrapCatalogService;
  telemetry?: PluginOsTelemetryService;
  existsSync?: typeof fs.existsSync;
  readFileSync?: typeof fs.readFileSync;
  writeFileSync?: typeof fs.writeFileSync;
  mkdirSync?: typeof fs.mkdirSync;
};

type OnboardingStateFile = {
  completed?: boolean;
  profile?: string | null;
  completedAt?: string | null;
  undoneAt?: string | null;
  optionalSelected?: string[];
  enabledIds?: string[];
};

const DEFAULT_OPTIONAL = ['gmail', 'linear', 'notion', 'browser-playwright', 'memory-honcho'];

/**
 * First-run / re-run onboarding profiles for Plugin OS:
 * core vs recommended vs full, plus optional credential-heavy plugins.
 */
export class PluginOsOnboardingService {
  private readonly now: () => Date;
  private readonly projectRoot: string;
  private readonly bridge: PluginStateBridgeService;
  private readonly curated: PluginCuratedMarketplaceService;
  private readonly bootstrapCatalog: PluginOsBootstrapCatalogService;
  private readonly telemetry: PluginOsTelemetryService | null;
  private readonly existsSync: typeof fs.existsSync;
  private readonly readFileSync: typeof fs.readFileSync;
  private readonly writeFileSync: typeof fs.writeFileSync;
  private readonly mkdirSync: typeof fs.mkdirSync;

  constructor(runtime: PluginOsOnboardingRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.projectRoot = path.resolve(runtime.projectRoot || process.cwd());
    this.bridge = runtime.stateBridge || new PluginStateBridgeService({
      now: this.now,
      projectRoot: this.projectRoot,
    });
    this.curated = runtime.curated || new PluginCuratedMarketplaceService({
      projectRoot: this.projectRoot,
    });
    this.bootstrapCatalog = runtime.bootstrapCatalog || new PluginOsBootstrapCatalogService({
      now: this.now,
      projectRoot: this.projectRoot,
      stateBridge: this.bridge,
    });
    this.telemetry = runtime.telemetry || null;
    this.existsSync = runtime.existsSync || fs.existsSync.bind(fs);
    this.readFileSync = runtime.readFileSync || fs.readFileSync.bind(fs);
    this.writeFileSync = runtime.writeFileSync || fs.writeFileSync.bind(fs);
    this.mkdirSync = runtime.mkdirSync || fs.mkdirSync.bind(fs);
  }

  public configPath(root?: string): string {
    return path.join(path.resolve(root || this.projectRoot), 'config', 'plugin-os-onboarding.json');
  }

  public statePath(root?: string): string {
    return path.join(path.resolve(root || this.projectRoot), '.zavorth', 'plugin-os-onboarding.json');
  }

  public loadConfig(root?: string): PluginOsOnboardingConfig {
    const projectRoot = path.resolve(root || this.projectRoot);
    const filePath = this.configPath(projectRoot);
    if (!this.existsSync(filePath)) {
      return defaultConfig();
    }
    try {
      const raw = JSON.parse(this.readFileSync(filePath, 'utf8')) as PluginOsOnboardingConfig;
      return {
        ...defaultConfig(),
        ...raw,
        optionalIds: Array.isArray(raw.optionalIds) ? raw.optionalIds.map(String) : DEFAULT_OPTIONAL,
        profiles: raw.profiles && typeof raw.profiles === 'object'
          ? raw.profiles
          : defaultConfig().profiles,
      };
    } catch {
      return defaultConfig();
    }
  }

  public status(root?: string): PluginOsOnboardingStatus {
    const projectRoot = path.resolve(root || this.projectRoot);
    const config = this.loadConfig(projectRoot);
    const state = this.readState(projectRoot);
    const profiles = Object.entries(config.profiles || {}).map(([id, profile]) => ({
      id,
      label: profile.label || id,
      summary: profile.summary || '',
      includeIds: profile.includeIds,
      includeTiers: profile.includeTiers,
      excludeIds: profile.excludeIds,
      excludeOptional: profile.excludeOptional,
    }));

    return {
      completed: state.completed === true,
      profile: state.profile || null,
      completedAt: state.completedAt || null,
      undoneAt: state.undoneAt || null,
      enabledIds: Array.isArray(state.enabledIds) ? state.enabledIds.map(String) : [],
      optionalSelected: Array.isArray(state.optionalSelected) ? state.optionalSelected.map(String) : [],
      injectAgentSurface: config.injectAgentSurface !== false,
      defaultProfile: config.defaultProfile || 'recommended',
      profiles,
      optionalIds: config.optionalIds || DEFAULT_OPTIONAL,
      notes: config.notes || [],
      formatText() {
        return [
          'Plugin OS onboarding',
          `completed=${this.completed} profile=${this.profile || 'n/a'}`,
          this.undoneAt ? `undoneAt=${this.undoneAt}` : null,
          `default=${this.defaultProfile} injectAgentSurface=${this.injectAgentSurface}`,
          `optional: ${(this.optionalIds || []).join(', ') || 'none'}`,
          ...this.profiles.map((p) => `  - ${p.id}: ${p.label} — ${p.summary}`),
        ].filter(Boolean).join('\n');
      },
    };
  }

  public plan(
    profileId?: string,
    options: { root?: string; optionalIds?: string[] } = {},
  ): PluginOsOnboardingPlan {
    const root = path.resolve(options.root || this.projectRoot);
    const config = this.loadConfig(root);
    const profileKey = String(profileId || config.defaultProfile || 'recommended').trim() || 'recommended';
    const profile = (config.profiles || {})[profileKey];
    const findings: string[] = [];

    if (!profile) {
      return finishPlan({
        ok: false,
        profile: profileKey,
        targetIds: [],
        optionalIds: [],
        alreadyEnabled: [],
        toEnable: [],
        missing: [],
        findings: [`unknown profile: ${profileKey}`],
      });
    }

    const optionalSet = new Set((config.optionalIds || DEFAULT_OPTIONAL).map(normalizeId));
    const selectedOptional = (options.optionalIds || [])
      .map(normalizeId)
      .filter((id) => id && optionalSet.has(id));

    const catalog = this.curated.list({ root });
    const byId = new Map(catalog.entries.map((entry) => [normalizeId(entry.id), entry]));

    let targetIds = new Set<string>();
    if (Array.isArray(profile.includeIds) && profile.includeIds.length > 0) {
      for (const id of profile.includeIds) {
        const normalized = normalizeId(id);
        if (normalized) targetIds.add(normalized);
      }
    } else {
      const tiers = new Set((profile.includeTiers || ['first-party']).map((t) => t.toLowerCase()));
      for (const entry of catalog.entries) {
        const tier = String(entry.tier || '').toLowerCase();
        if (tiers.has(tier)) {
          targetIds.add(normalizeId(entry.id));
        }
      }
    }

    const exclude = new Set((profile.excludeIds || []).map(normalizeId));
    if (profile.excludeOptional !== false) {
      for (const id of optionalSet) {
        if (!selectedOptional.includes(id)) {
          exclude.add(id);
        }
      }
    }
    for (const id of selectedOptional) {
      targetIds.add(id);
      exclude.delete(id);
    }

    targetIds = new Set(Array.from(targetIds).filter((id) => id && !exclude.has(id)));
    const targets = Array.from(targetIds).sort((a, b) => a.localeCompare(b));

    const alreadyEnabled: string[] = [];
    const toEnable: string[] = [];
    const missing: string[] = [];

    for (const pluginId of targets) {
      const packageExists = this.findPackage(root, pluginId) || byId.has(pluginId);
      if (!packageExists && !this.findPackage(root, pluginId)) {
        // still try enable if package dir exists under plugins/
        if (!this.findPackage(root, pluginId)) {
          missing.push(pluginId);
          continue;
        }
      }
      if (!this.findPackage(root, pluginId)) {
        missing.push(pluginId);
        continue;
      }
      const state = this.bridge.resolve(pluginId);
      if (state.enabled) {
        alreadyEnabled.push(pluginId);
      } else {
        toEnable.push(pluginId);
      }
    }

    findings.push(`profile=${profileKey} targets=${targets.length} toEnable=${toEnable.length}`);

    return finishPlan({
      ok: true,
      profile: profileKey,
      targetIds: targets,
      optionalIds: selectedOptional,
      alreadyEnabled,
      toEnable,
      missing,
      findings,
    });
  }

  public apply(
    profileId?: string,
    options: {
      root?: string;
      optionalIds?: string[];
      force?: boolean;
      approved?: boolean;
    } = {},
  ): PluginOsOnboardingApplyResult {
    const root = path.resolve(options.root || this.projectRoot);
    if (options.approved !== true) {
      return finishApply({
        ok: false,
        profile: String(profileId || ''),
        enabled: [],
        skipped: [{ pluginId: '*', reason: 'approved===true required' }],
        missing: [],
        optionalSelected: [],
        statePath: null,
        findings: ['Pass approved: true or CLI --yes'],
      });
    }

    const plan = this.plan(profileId, {
      root,
      optionalIds: options.optionalIds,
    });

    if (!plan.ok) {
      return finishApply({
        ok: false,
        profile: plan.profile,
        enabled: [],
        skipped: [],
        missing: plan.missing,
        optionalSelected: plan.optionalIds,
        statePath: null,
        findings: plan.findings,
      });
    }

    const enabled: string[] = [];
    const skipped: Array<{ pluginId: string; reason: string }> = [];

    for (const pluginId of plan.alreadyEnabled) {
      skipped.push({ pluginId, reason: 'already_enabled' });
    }
    for (const pluginId of plan.missing) {
      skipped.push({ pluginId, reason: 'package_not_found' });
    }

    for (const pluginId of plan.toEnable) {
      const packageDir = this.findPackage(root, pluginId);
      if (!packageDir) {
        skipped.push({ pluginId, reason: 'package_not_found' });
        continue;
      }
      const current = this.bridge.resolve(pluginId);
      if (current.trust === 'blocked' && options.force !== true) {
        skipped.push({ pluginId, reason: 'trust_blocked' });
        continue;
      }
      if (current.installed && current.enabled === false && options.force !== true) {
        // If never completed onboarding, allow re-enable; if user disabled after onboarding, respect.
        const state = this.readState(root);
        if (state.completed === true) {
          skipped.push({ pluginId, reason: 'user_disabled' });
          continue;
        }
      }
      try {
        const relative = path.relative(root, packageDir).replace(/\\/gu, '/');
        this.bridge.markInstalled({
          pluginId,
          revision: this.readVersion(packageDir) || '1.0.0',
          sourceLocator: relative.startsWith('.') ? relative : `./${relative}`,
          sourceTrusted: true,
          trust: current.trust === 'blocked' ? 'trusted' : (current.trust || 'trusted'),
          enable: true,
        });
        enabled.push(pluginId);
        try {
          this.telemetry?.recordEvent('enable', { root, pluginId, profile: plan.profile });
        } catch {
          /* soft */
        }
      } catch (error) {
        skipped.push({
          pluginId,
          reason: `enable_failed: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    }

    // Do not re-run full first-party bootstrap catalog here: onboarding profiles
    // intentionally leave optional/credential plugins disabled unless selected.

    const stateFile = this.statePath(root);
    let statePath: string | null = null;
    try {
      this.mkdirSync(path.dirname(stateFile), { recursive: true });
      const payload: OnboardingStateFile = {
        completed: true,
        profile: plan.profile,
        completedAt: this.now().toISOString(),
        optionalSelected: plan.optionalIds,
        enabledIds: [...plan.alreadyEnabled, ...enabled],
      };
      this.writeFileSync(stateFile, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
      statePath = path.relative(root, stateFile).replace(/\\/gu, '/');
    } catch {
      statePath = null;
    }

    try {
      this.telemetry?.recordEvent('onboarding', {
        root,
        profile: plan.profile,
        counts: {
          enabled: enabled.length,
          skipped: skipped.length,
          optional: plan.optionalIds.length,
        },
      });
    } catch {
      /* soft */
    }

    return finishApply({
      ok: true,
      profile: plan.profile,
      enabled,
      skipped,
      missing: plan.missing,
      optionalSelected: plan.optionalIds,
      statePath,
      findings: [
        ...plan.findings,
        `enabled=${enabled.length}`,
        statePath ? `state=${statePath}` : 'state write soft-failed',
      ],
    });
  }

  /**
   * Disable plugins enabled by the last onboarding apply (from state.enabledIds).
   * Does not delete packages. Soft-fails per plugin id.
   */
  public undo(options: {
    root?: string;
    approved?: boolean;
  } = {}): PluginOsOnboardingUndoResult {
    const root = path.resolve(options.root || this.projectRoot);
    if (options.approved !== true) {
      return finishUndo({
        ok: false,
        disabled: [],
        skipped: [{ pluginId: '*', reason: 'approved===true required' }],
        profile: null,
        statePath: null,
        findings: ['Pass approved: true or CLI --yes'],
      });
    }

    const state = this.readState(root);
    const enabledIds = Array.isArray(state.enabledIds)
      ? state.enabledIds.map(normalizeId).filter(Boolean)
      : [];
    const findings: string[] = [];
    const disabled: string[] = [];
    const skipped: Array<{ pluginId: string; reason: string }> = [];

    if (enabledIds.length === 0) {
      findings.push('no enabledIds in onboarding state — nothing to undo');
    }

    for (const pluginId of enabledIds) {
      try {
        const current = this.bridge.resolve(pluginId);
        if (!current.enabled) {
          skipped.push({ pluginId, reason: 'already_disabled' });
          continue;
        }
        this.bridge.setEnabled(pluginId, false);
        disabled.push(pluginId);
        try {
          this.telemetry?.recordEvent('disable', {
            root,
            pluginId,
            profile: state.profile || undefined,
            meta: { source: 'onboarding-undo' },
          });
        } catch {
          /* soft */
        }
      } catch (error) {
        skipped.push({
          pluginId,
          reason: `disable_failed: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    }

    const stateFile = this.statePath(root);
    let statePath: string | null = null;
    try {
      this.mkdirSync(path.dirname(stateFile), { recursive: true });
      const payload: OnboardingStateFile = {
        completed: false,
        profile: state.profile || null,
        completedAt: state.completedAt || null,
        undoneAt: this.now().toISOString(),
        optionalSelected: Array.isArray(state.optionalSelected) ? state.optionalSelected : [],
        enabledIds: [],
      };
      this.writeFileSync(stateFile, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
      statePath = path.relative(root, stateFile).replace(/\\/gu, '/');
    } catch {
      statePath = null;
      findings.push('state write soft-failed');
    }

    try {
      this.telemetry?.recordEvent('onboarding', {
        root,
        profile: state.profile || undefined,
        counts: {
          disabled: disabled.length,
          skipped: skipped.length,
        },
        meta: { action: 'undo' },
      });
    } catch {
      /* soft */
    }

    findings.push(`disabled=${disabled.length} skipped=${skipped.length}`);
    if (statePath) findings.push(`state=${statePath}`);

    return finishUndo({
      ok: true,
      disabled,
      skipped,
      profile: state.profile || null,
      statePath,
      findings,
    });
  }

  private readState(root: string): OnboardingStateFile {
    const filePath = this.statePath(root);
    if (!this.existsSync(filePath)) return {};
    try {
      return JSON.parse(this.readFileSync(filePath, 'utf8')) as OnboardingStateFile;
    } catch {
      return {};
    }
  }

  private findPackage(root: string, pluginId: string): string | null {
    const candidates = [
      path.join(root, 'plugins', pluginId),
      path.join(root, 'plugins', 'examples', pluginId),
      path.join(root, '.zavorth', 'plugins', pluginId),
    ];
    for (const candidate of candidates) {
      if (this.existsSync(path.join(candidate, 'manifest.json'))) {
        return candidate;
      }
    }
    return null;
  }

  private readVersion(packageDir: string): string | null {
    try {
      const raw = JSON.parse(this.readFileSync(path.join(packageDir, 'manifest.json'), 'utf8')) as {
        version?: unknown;
      };
      return raw.version ? String(raw.version) : null;
    } catch {
      return null;
    }
  }
}

function defaultConfig(): PluginOsOnboardingConfig {
  return {
    schemaVersion: 'zavorth.plugin-os-onboarding.v1',
    defaultProfile: 'recommended',
    injectAgentSurface: true,
    injectMaxCatalog: 12,
    optionalIds: [...DEFAULT_OPTIONAL],
    profiles: {
      minimal: {
        label: 'Minimal',
        summary: 'Router + security guidance only.',
        includeIds: ['plugin-router-ai', 'security-guidance', 'mcp-bridge'],
        excludeOptional: true,
      },
      core: {
        label: 'Core',
        summary: 'Safe first-party defaults without credential-heavy integrations.',
        includeTiers: ['first-party'],
        excludeIds: ['gmail', 'linear', 'notion', 'browser-playwright', 'memory-honcho'],
        excludeOptional: true,
      },
      recommended: {
        label: 'Recommended',
        summary: 'All first-party plugins except optional credential integrations.',
        includeTiers: ['first-party'],
        excludeIds: ['gmail', 'linear', 'notion'],
        excludeOptional: true,
      },
      full: {
        label: 'Full first-party',
        summary: 'Enable every first-party plugin including optional integrations.',
        includeTiers: ['first-party'],
        excludeOptional: false,
      },
    },
    notes: [],
  };
}

function normalizeId(raw: string): string {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/gu, '-')
    .replace(/^-+|-+$/gu, '');
}

function finishPlan(input: Omit<PluginOsOnboardingPlan, 'formatText'>): PluginOsOnboardingPlan {
  return {
    ...input,
    formatText() {
      return [
        `Onboarding plan: ${input.profile}`,
        `ok=${input.ok} targets=${input.targetIds.length} toEnable=${input.toEnable.length} missing=${input.missing.length}`,
        input.optionalIds.length ? `optional: ${input.optionalIds.join(', ')}` : 'optional: (none)',
        ...input.toEnable.map((id) => `  + enable ${id}`),
        ...input.alreadyEnabled.map((id) => `  ~ already ${id}`),
        ...input.missing.map((id) => `  ? missing ${id}`),
        ...input.findings.map((line) => `  - ${line}`),
      ].join('\n');
    },
  };
}

function finishApply(input: Omit<PluginOsOnboardingApplyResult, 'formatText'>): PluginOsOnboardingApplyResult {
  return {
    ...input,
    formatText() {
      return [
        `Onboarding apply: ${input.profile}`,
        `ok=${input.ok} enabled=${input.enabled.length} skipped=${input.skipped.length}`,
        ...input.enabled.map((id) => `  + ${id}`),
        ...input.skipped.slice(0, 20).map((item) => `  ~ ${item.pluginId}: ${item.reason}`),
        input.statePath ? `state: ${input.statePath}` : null,
        ...input.findings.map((line) => `  - ${line}`),
      ].filter(Boolean).join('\n');
    },
  };
}

function finishUndo(input: Omit<PluginOsOnboardingUndoResult, 'formatText'>): PluginOsOnboardingUndoResult {
  return {
    ...input,
    formatText() {
      return [
        `Onboarding undo: ${input.profile || 'n/a'}`,
        `ok=${input.ok} disabled=${input.disabled.length} skipped=${input.skipped.length}`,
        ...input.disabled.map((id) => `  - ${id}`),
        ...input.skipped.slice(0, 20).map((item) => `  ~ ${item.pluginId}: ${item.reason}`),
        input.statePath ? `state: ${input.statePath}` : null,
        ...input.findings.map((line) => `  - ${line}`),
        'Packages were not deleted.',
      ].filter(Boolean).join('\n');
    },
  };
}
