import type {
  ZavorthPluginManifest,
  ZavorthPluginPermissionKind,
  ZavorthPluginRuntimeState,
  ZavorthPluginTrustLevel,
} from './PluginManifestContract.js';

export const ZAVORTH_PLUGIN_RUNTIME_CONTRACT_VERSION = '2026-07-12.plugin-runtime-v1' as const;

export const ZAVORTH_PLUGIN_MANIFEST_FILENAMES = [
  'manifest.json',
  'zavorth.plugin.json',
  'plugin.json',
] as const;

export const ZAVORTH_PLUGIN_DISCOVERY_SOURCE_KINDS = ['bundled', 'workspace', 'user'] as const;

export const ZAVORTH_PLUGIN_DISCOVERY_SOURCE_PRIORITY = {
  bundled: 10,
  workspace: 20,
  user: 30,
} as const;

export const ZAVORTH_PLUGIN_RUNTIME_HOOK_EVENTS = [
  'gateway.before_dispatch',
  'gateway.after_dispatch',
  'session.before_send',
  'session.after_send',
  'session.before_spawn',
  'session.after_spawn',
  'tool.before_execute',
  'tool.after_execute',
  'runtime.before_execute',
  'runtime.after_execute',
  'runtime.exec_failed',
  'integration.before_action',
  'integration.after_action',
  'plugin.before_action',
  'plugin.after_action',
  'transport.before_action',
  'transport.after_action',
  'llm.before_request',
  'llm.after_request',
  'agent.before_turn',
  'agent.after_turn',
  'memory.before_write',
  'memory.after_write',
  'channel.before_send',
  'channel.after_send',
  'shutdown.before',
  'shutdown.after',
] as const;

export type ZavorthPluginRuntimeHookEvent = typeof ZAVORTH_PLUGIN_RUNTIME_HOOK_EVENTS[number];

export type ZavorthPluginDiscoverySourceKind = typeof ZAVORTH_PLUGIN_DISCOVERY_SOURCE_KINDS[number];

export type ZavorthPluginManifestFilename = typeof ZAVORTH_PLUGIN_MANIFEST_FILENAMES[number];

export type ZavorthPluginDiscoverySource = {
  kind: ZavorthPluginDiscoverySourceKind;
  root: string;
  priority: number;
};

export type ZavorthPluginDiscoveryValidation = {
  ok: boolean;
  findings: string[];
};

export type ZavorthPluginDiscoveryCompatibility = {
  ok: boolean;
  findings: string[];
};

export type ZavorthPluginDiscoveryStateView = {
  runtimeState: ZavorthPluginRuntimeState;
  trust: ZavorthPluginTrustLevel;
  installed: boolean;
  enabled: boolean;
  installedRevision: string | null;
  sourceLocator: string | null;
};

export type ZavorthDiscoveredPlugin = {
  pluginId: string;
  sourceKind: ZavorthPluginDiscoverySourceKind;
  sourceRoot: string;
  packageDir: string;
  manifestPath: string;
  manifestFilename: ZavorthPluginManifestFilename;
  manifest: ZavorthPluginManifest | null;
  validation: ZavorthPluginDiscoveryValidation;
  compatibility: ZavorthPluginDiscoveryCompatibility;
  state: ZavorthPluginDiscoveryStateView;
  loadEligible: boolean;
  selected: boolean;
  findings: string[];
};

export type ZavorthPluginDiscoverySnapshot = {
  generatedAt: string;
  contractVersion: typeof ZAVORTH_PLUGIN_RUNTIME_CONTRACT_VERSION;
  sources: Array<{
    kind: ZavorthPluginDiscoverySourceKind;
    root: string;
    exists: boolean;
    packageCount: number;
    validCount: number;
  }>;
  plugins: ZavorthDiscoveredPlugin[];
  conflicts: Array<{
    pluginId: string;
    selectedSourceKind: ZavorthPluginDiscoverySourceKind;
    suppressedSourceKinds: ZavorthPluginDiscoverySourceKind[];
  }>;
  summary: {
    total: number;
    valid: number;
    invalid: number;
    loadEligible: number;
    selected: number;
    bySource: Record<ZavorthPluginDiscoverySourceKind, number>;
  };
};

export type ZavorthPluginCapabilityHandlerInput = {
  pluginId: string;
  capabilityId: string;
  input: Record<string, unknown>;
  requestedBy: string | null;
};

export type ZavorthPluginCapabilityHandlerResult = {
  output: unknown;
  artifacts?: string[];
  receipts?: string[];
};

export type ZavorthPluginCapabilityHandler = (
  input: ZavorthPluginCapabilityHandlerInput,
) => ZavorthPluginCapabilityHandlerResult | Promise<ZavorthPluginCapabilityHandlerResult>;

export type ZavorthPluginChannelAdapterBinding = {
  id: string;
  capabilityId: string;
  label?: string;
  send?: (input: Record<string, unknown>) => unknown | Promise<unknown>;
  receive?: (input: Record<string, unknown>) => unknown | Promise<unknown>;
  metadata?: Record<string, unknown>;
};

export type ZavorthPluginMemoryBackendBinding = {
  id: string;
  capabilityId: string;
  label?: string;
  read?: (input: Record<string, unknown>) => unknown | Promise<unknown>;
  write?: (input: Record<string, unknown>) => unknown | Promise<unknown>;
  search?: (input: Record<string, unknown>) => unknown | Promise<unknown>;
  metadata?: Record<string, unknown>;
};

export type ZavorthPluginProviderBinding = {
  id: string;
  capabilityId: string;
  name: string;
  label?: string;
  complete?: (input: Record<string, unknown>) => unknown | Promise<unknown>;
  embed?: (input: Record<string, unknown>) => unknown | Promise<unknown>;
  metadata?: Record<string, unknown>;
};

export type ZavorthPluginToolBinding = {
  capabilityId: string;
  name?: string;
  description?: string;
  handler: ZavorthPluginCapabilityHandler;
  parameters?: Record<string, unknown>;
};

/** Specialized binding kinds (register_* surface on Plugin OS ctx). */
export const ZAVORTH_PLUGIN_SPECIALIZED_KINDS = [
  'platform',
  'web_search',
  'browser',
  'image_gen',
  'video_gen',
  'tts',
  'transcription',
  'secret_source',
  'dashboard_auth',
  'context_engine',
  'middleware',
  'skill',
  'cli_command',
  'auxiliary_task',
  'slack_action',
] as const;

export type ZavorthPluginSpecializedKind = typeof ZAVORTH_PLUGIN_SPECIALIZED_KINDS[number];

export type ZavorthPluginSpecializedHandler = (
  input: Record<string, unknown>,
) => unknown | Promise<unknown>;

export type ZavorthPluginSpecializedBinding = {
  kind: ZavorthPluginSpecializedKind;
  id: string;
  capabilityId: string;
  label?: string;
  handler?: ZavorthPluginSpecializedHandler;
  metadata?: Record<string, unknown>;
};

export type ZavorthPluginRegistrationContext = {
  bindCapability(capabilityId: string, handler: ZavorthPluginCapabilityHandler): void;
  bindChannel(adapter: ZavorthPluginChannelAdapterBinding): void;
  bindMemoryBackend(backend: ZavorthPluginMemoryBackendBinding): void;
  bindProvider(provider: ZavorthPluginProviderBinding): void;
  bindTool(tool: ZavorthPluginToolBinding): void;
  registerHook(
    event: ZavorthPluginRuntimeHookEvent,
    callback: (payload: {
      event: ZavorthPluginRuntimeHookEvent;
      context: Record<string, unknown>;
    }) => void | Promise<void>,
  ): void;
  /** Specialized registrars (trust-preserving wrappers). */
  registerPlatform(adapter: ZavorthPluginChannelAdapterBinding): void;
  registerWebSearchProvider(binding: ZavorthPluginSpecializedBinding): void;
  registerBrowserProvider(binding: ZavorthPluginSpecializedBinding): void;
  registerImageGenProvider(binding: ZavorthPluginSpecializedBinding): void;
  registerVideoGenProvider(binding: ZavorthPluginSpecializedBinding): void;
  registerTtsProvider(binding: ZavorthPluginSpecializedBinding): void;
  registerTranscriptionProvider(binding: ZavorthPluginSpecializedBinding): void;
  registerSecretSource(binding: ZavorthPluginSpecializedBinding): void;
  registerDashboardAuthProvider(binding: ZavorthPluginSpecializedBinding): void;
  registerContextEngine(binding: ZavorthPluginSpecializedBinding): void;
  registerMiddleware(
    event: ZavorthPluginRuntimeHookEvent,
    callback: (payload: {
      event: ZavorthPluginRuntimeHookEvent;
      context: Record<string, unknown>;
    }) => void | Promise<void>,
  ): void;
  registerSkill(binding: ZavorthPluginSpecializedBinding): void;
  registerCliCommand(binding: ZavorthPluginSpecializedBinding): void;
  registerAuxiliaryTask(binding: ZavorthPluginSpecializedBinding): void;
  registerSlackActionHandler(binding: ZavorthPluginSpecializedBinding): void;
  getConfig(): Record<string, unknown>;
  getLogger(): {
    debug(message: string, meta?: Record<string, unknown>): void;
    info(message: string, meta?: Record<string, unknown>): void;
    warn(message: string, meta?: Record<string, unknown>): void;
    error(message: string, meta?: Record<string, unknown>): void;
  };
  getWorkspacePath(): string;
  requestPermission(kind: ZavorthPluginPermissionKind, reason: string): Promise<boolean>;
  emit(event: { type: string; payload?: Record<string, unknown> }): void;
};

export type ZavorthLoadedPlugin = {
  pluginId: string;
  manifest: ZavorthPluginManifest;
  packageDir: string;
  sourceKind: ZavorthPluginDiscoverySourceKind;
  capabilities: string[];
  hooks: ZavorthPluginRuntimeHookEvent[];
};

export type ZavorthPluginLoadStatus = 'loaded' | 'skipped' | 'failed' | 'blocked';

export type ZavorthPluginLoadResult = {
  pluginId: string;
  status: ZavorthPluginLoadStatus;
  packageDir: string;
  sourceKind: ZavorthPluginDiscoverySourceKind;
  manifest: ZavorthPluginManifest | null;
  entrypointModule: string | null;
  exportName: string | null;
  capabilities: string[];
  hooks: ZavorthPluginRuntimeHookEvent[];
  findings: string[];
  durationMs: number;
};

export type ZavorthPluginLoadSnapshot = {
  generatedAt: string;
  contractVersion: typeof ZAVORTH_PLUGIN_RUNTIME_CONTRACT_VERSION;
  results: ZavorthPluginLoadResult[];
  loaded: ZavorthLoadedPlugin[];
  summary: {
    total: number;
    loaded: number;
    skipped: number;
    failed: number;
    blocked: number;
    capabilities: number;
    hooks: number;
  };
};

export type ZavorthPluginWirePlan = {
  pluginId: string;
  capabilityIds: string[];
  hookEvents: ZavorthPluginRuntimeHookEvent[];
  toolNames: string[];
  channelIds: string[];
  memoryBackendIds: string[];
  providerIds: string[];
};

export type ZavorthPluginRuntimeBootstrapSnapshot = {
  generatedAt: string;
  contractVersion: typeof ZAVORTH_PLUGIN_RUNTIME_CONTRACT_VERSION;
  discovery: ZavorthPluginDiscoverySnapshot;
  load: ZavorthPluginLoadSnapshot;
  wire: {
    registryEntries: number;
    handlersRegistered: number;
    toolsRegistered: number;
    hooksRegistered: number;
    channelsRegistered: number;
    memoryBackendsRegistered: number;
    providersRegistered: number;
    plans: ZavorthPluginWirePlan[];
  };
  summary: {
    discovered: number;
    loadEligible: number;
    loaded: number;
    wired: number;
    failed: number;
  };
};
