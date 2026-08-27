import fs from 'node:fs';
import path from 'node:path';

import { PluginOsAgentSurfaceService } from './PluginOsAgentSurfaceService.js';
import { PluginOsOnboardingService } from './PluginOsOnboardingService.js';
import { PluginOsTelemetryService } from './PluginOsTelemetryService.js';

export type PluginOsInjectMode = 'off' | 'compact' | 'standard' | 'full' | 'ab';

export type PluginOsPromptInjectionResult = {
  injected: boolean;
  reason: string;
  block: string;
  mode?: PluginOsInjectMode;
  samplePercent?: number;
  health?: string;
  enabledCount?: number;
};

export type PluginOsPromptPrefs = {
  injectMode: PluginOsInjectMode;
  injectSamplePercent: number;
  updatedAt?: string;
};

export type PluginOsPromptInjectionRuntime = {
  now?: () => Date;
  projectRoot?: string;
  agentSurface?: PluginOsAgentSurfaceService;
  onboarding?: PluginOsOnboardingService;
  telemetry?: PluginOsTelemetryService;
  env?: NodeJS.ProcessEnv;
  existsSync?: typeof fs.existsSync;
  readFileSync?: typeof fs.readFileSync;
};

/**
 * Builds a Plugin OS block for agent system prompts with modes:
 * off | compact | standard | full | ab (sample percent).
 */
export class PluginOsPromptInjectionService {
  private readonly now: () => Date;
  private readonly projectRoot: string;
  private readonly agentSurface: PluginOsAgentSurfaceService;
  private readonly onboarding: PluginOsOnboardingService;
  private readonly telemetry: PluginOsTelemetryService | null;
  private readonly env: NodeJS.ProcessEnv;
  private readonly existsSync: typeof fs.existsSync;
  private readonly readFileSync: typeof fs.readFileSync;
  private cache: {
    at: number;
    block: string;
    health: string;
    enabledCount: number;
    mode: PluginOsInjectMode;
  } | null = null;
  private readonly cacheTtlMs = 30_000;

  constructor(runtime: PluginOsPromptInjectionRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.projectRoot = path.resolve(runtime.projectRoot || process.cwd());
    this.agentSurface = runtime.agentSurface || new PluginOsAgentSurfaceService({
      now: this.now,
      projectRoot: this.projectRoot,
    });
    this.onboarding = runtime.onboarding || new PluginOsOnboardingService({
      now: this.now,
      projectRoot: this.projectRoot,
    });
    this.telemetry = runtime.telemetry || null;
    this.env = runtime.env || process.env;
    this.existsSync = runtime.existsSync || fs.existsSync.bind(fs);
    this.readFileSync = runtime.readFileSync || fs.readFileSync.bind(fs);
  }

  public prefsPath(root?: string): string {
    return path.join(path.resolve(root || this.projectRoot), '.zavorth', 'plugin-os-prompt.json');
  }

  /**
   * Persist inject prefs. Production default remains compact unless explicitly changed.
   */
  public savePrefs(
    prefs: Partial<PluginOsPromptPrefs>,
    root?: string,
  ): PluginOsPromptPrefs {
    const projectRoot = path.resolve(root || this.projectRoot);
    const current = this.loadPrefs(projectRoot);
    const next: PluginOsPromptPrefs = {
      injectMode: prefs.injectMode ? normalizeMode(prefs.injectMode) : current.injectMode,
      injectSamplePercent: prefs.injectSamplePercent !== undefined
        ? clampPercent(prefs.injectSamplePercent, current.injectSamplePercent)
        : current.injectSamplePercent,
      updatedAt: this.now().toISOString(),
    };
    // Guard production: refuse to persist full/ab unless ZAVORTH_PLUGIN_OS_PROMPT_ALLOW_FULL=1
    if (
      (next.injectMode === 'full' || next.injectMode === 'ab')
      && this.env.NODE_ENV === 'production'
      && this.env.ZAVORTH_PLUGIN_OS_PROMPT_ALLOW_FULL !== '1'
    ) {
      next.injectMode = 'compact';
      next.injectSamplePercent = 100;
    }
    try {
      const filePath = this.prefsPath(projectRoot);
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
    } catch {
      /* soft-fail */
    }
    this.cache = null;
    return next;
  }

  public loadPrefs(root?: string): PluginOsPromptPrefs {
    const projectRoot = path.resolve(root || this.projectRoot);
    const filePath = this.prefsPath(projectRoot);
    if (this.existsSync(filePath)) {
      try {
        const raw = JSON.parse(this.readFileSync(filePath, 'utf8')) as Record<string, unknown>;
        return {
          injectMode: normalizeMode(raw.injectMode),
          injectSamplePercent: clampPercent(raw.injectSamplePercent, 100),
          updatedAt: raw.updatedAt ? String(raw.updatedAt) : undefined,
        };
      } catch {
        /* fall through */
      }
    }

    // Env overrides
    const envMode = this.env.ZAVORTH_PLUGIN_OS_PROMPT_MODE;
    if (envMode) {
      return {
        injectMode: normalizeMode(envMode),
        injectSamplePercent: clampPercent(this.env.ZAVORTH_PLUGIN_OS_PROMPT_SAMPLE, 100),
      };
    }

    try {
      const status = this.onboarding.status(projectRoot);
      if (status.injectAgentSurface === false) {
        return { injectMode: 'off', injectSamplePercent: 0 };
      }
    } catch {
      /* soft */
    }

    // Daily product default: compact inject in all environments unless prefs/env override.
    return { injectMode: 'compact', injectSamplePercent: 100 };
  }

  public shouldInject(root?: string): boolean {
    if (this.env.ZAVORTH_PLUGIN_OS_PROMPT === '0') return false;
    if (this.env.ZAVORTH_PLUGIN_OS_RUNTIME === '0') return false;
    const prefs = this.loadPrefs(root);
    if (prefs.injectMode === 'off') return false;
    if (prefs.injectMode === 'ab') {
      const sample = prefs.injectSamplePercent;
      // Deterministic-ish per-minute bucket so a single run is stable for ~60s.
      const bucket = Math.floor(this.now().getTime() / 60_000) % 100;
      return bucket < sample;
    }
    return true;
  }

  public buildInjection(options: {
    root?: string;
    maxCatalog?: number;
    recordTelemetry?: boolean;
    mode?: PluginOsInjectMode;
  } = {}): PluginOsPromptInjectionResult {
    const root = path.resolve(options.root || this.projectRoot);
    const prefs = this.loadPrefs(root);
    const mode = options.mode || prefs.injectMode;

    if (this.env.ZAVORTH_PLUGIN_OS_PROMPT === '0' || mode === 'off') {
      return {
        injected: false,
        reason: 'disabled_by_config_or_env',
        block: '',
        mode: 'off',
        samplePercent: prefs.injectSamplePercent,
      };
    }

    if (!this.shouldInject(root) && mode === 'ab') {
      return {
        injected: false,
        reason: 'ab_sample_miss',
        block: '',
        mode: 'ab',
        samplePercent: prefs.injectSamplePercent,
      };
    }

    if (!this.shouldInject(root) && mode !== 'ab') {
      return {
        injected: false,
        reason: 'disabled_by_config_or_env',
        block: '',
        mode,
        samplePercent: prefs.injectSamplePercent,
      };
    }

    const nowMs = this.now().getTime();
    if (this.cache && nowMs - this.cache.at < this.cacheTtlMs && this.cache.block && this.cache.mode === mode) {
      return {
        injected: true,
        reason: 'cache',
        block: this.cache.block,
        mode: this.cache.mode,
        samplePercent: prefs.injectSamplePercent,
        health: this.cache.health,
        enabledCount: this.cache.enabledCount,
      };
    }

    try {
      const config = this.onboarding.loadConfig(root);
      let maxCatalog = Math.max(
        4,
        Math.min(24, Number(options.maxCatalog ?? config.injectMaxCatalog ?? 12) || 12),
      );
      if (mode === 'compact') maxCatalog = Math.min(maxCatalog, 8);
      if (mode === 'full') maxCatalog = Math.max(maxCatalog, 16);

      const surface = this.agentSurface.buildSurface({ root, maxCatalog });
      const block = renderBlock(mode, surface, loadMcpServerIds(root, this.existsSync, this.readFileSync));

      this.cache = {
        at: nowMs,
        block,
        health: surface.health,
        enabledCount: surface.enabledPluginIds.length,
        mode,
      };

      if (options.recordTelemetry !== false) {
        try {
          this.telemetry?.recordEvent('prompt-inject', {
            root,
            health: surface.health,
            counts: {
              enabled: surface.enabledPluginIds.length,
              catalog: surface.firstPartyCatalog.length,
              samplePercent: prefs.injectSamplePercent,
            },
            meta: { mode },
          });
        } catch {
          /* soft */
        }
      }

      return {
        injected: true,
        reason: mode === 'ab' ? 'ab_sample_hit' : 'ok',
        block,
        mode,
        samplePercent: prefs.injectSamplePercent,
        health: surface.health,
        enabledCount: surface.enabledPluginIds.length,
      };
    } catch (error: unknown) {
      return {
        injected: false,
        reason: `soft_fail: ${error instanceof Error ? error.message : String(error)}`,
        block: '',
        mode,
        samplePercent: prefs.injectSamplePercent,
      };
    }
  }

  public appendToSystemPrompt(systemPrompt: string, options: {
    root?: string;
    maxCatalog?: number;
    recordTelemetry?: boolean;
    mode?: PluginOsInjectMode;
  } = {}): { prompt: string; injection: PluginOsPromptInjectionResult } {
    const injection = this.buildInjection(options);
    if (!injection.injected || !injection.block) {
      return { prompt: systemPrompt, injection };
    }
    const base = String(systemPrompt || '').trimEnd();
    const prompt = base ? `${base}\n\n${injection.block}`
      : injection.block;
    return { prompt, injection };
  }
}

function renderBlock(
  mode: PluginOsInjectMode,
  surface: {
    promptBlock: string;
    health: string;
    enabledPluginIds: string[];
    firstPartyCatalog: Array<{ id: string; summary?: string; enabled: boolean }>;
    recommendHints: string[];
  },
  mcpServers: string[] = [],
): string {
  if (mode === 'compact') {
    const on = surface.enabledPluginIds.slice(0, 8).join(', ') || 'none';
    const mcp = mcpServers.length ? mcpServers.slice(0, 8).join(', ') : 'filesystem';
    return [
      '## Zavorth Plugin OS (compact)',
      `Health=${surface.health}. Enabled: ${on}.`,
      `MCP: ${mcp} (use mcp_enable to activate; see integration.connectors for external platforms).`,
      'If a capability may be missing, call plugin_suggest and offer Enable vs Recommend-only. Never auto-enable.',
      'CLI: zavorth plugins enable <id> --yes',
    ].join('\n');
  }

  if (mode === 'full') {
    return [
      surface.promptBlock,
      '',
      'Hints:',
      ...surface.recommendHints.map((hint) => `- ${hint}`),
      'Deep: zavorth plugins plane · metrics · onboarding · marketplace --curated',
    ].join('\n');
  }

  // standard + ab hit
  return [
    surface.promptBlock,
    'If plugin_recommend is visible and a capability may be plugin-backed, call it before inventing missing features.',
  ].join('\n');
}

function loadMcpServerIds(
  root: string,
  existsSync: typeof fs.existsSync,
  readFileSync: typeof fs.readFileSync,
): string[] {
  try {
    const configPath = path.join(root, 'config', 'mcp-servers.json');
    if (!existsSync(configPath)) return [];
    const raw = JSON.parse(readFileSync(configPath, 'utf8')) as unknown;
    if (!Array.isArray(raw)) return [];
    return raw
      .map((entry) => {
        if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null;
        const id = String((entry as Record<string, unknown>).id || '').trim().toLowerCase();
        return id || null;
      })
      .filter((id): id is string => Boolean(id));
  } catch {
    return [];
  }
}

function normalizeMode(raw: unknown): PluginOsInjectMode {
  const value = String(raw || 'compact').trim().toLowerCase();
  if (value === 'off' || value === '0' || value === 'false') return 'off';
  if (value === 'compact' || value === 'mini') return 'compact';
  if (value === 'standard' || value === 'std' || value === 'default') return 'standard';
  if (value === 'full' || value === 'verbose') return 'full';
  if (value === 'ab' || value === 'sample' || value === 'canary') return 'ab';
  return 'compact';
}

function clampPercent(raw: unknown, fallback: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(100, n));
}

/**
 * Soft-load helper for agent runtime paths that must never hard-depend on Plugin OS.
 */
export function softInjectPluginOsPrompt(
  systemPrompt: string,
  options: { projectRoot?: string; recordTelemetry?: boolean; mode?: PluginOsInjectMode } = {},
): string {
  try {
    if (process.env.ZAVORTH_PLUGIN_OS_PROMPT === '0') {
      return systemPrompt;
    }
    const service = new PluginOsPromptInjectionService({
      projectRoot: options.projectRoot
        || process.env.ZAVORTH_PROJECT_ROOT
        || process.cwd(),
    });
    return service.appendToSystemPrompt(systemPrompt, {
      recordTelemetry: options.recordTelemetry === true,
      mode: options.mode,
    }).prompt;
  } catch {
    return systemPrompt;
  }
}
