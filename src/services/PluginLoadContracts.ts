import type fs from 'node:fs';

import type {
  ZavorthLoadedPlugin,
  ZavorthPluginCapabilityHandler,
  ZavorthPluginChannelAdapterBinding,
  ZavorthPluginMemoryBackendBinding,
  ZavorthPluginProviderBinding,
  ZavorthPluginRuntimeHookEvent,
} from '../contracts/core/PluginRuntimeContract.js';
import type { PluginSandboxPolicyService } from './PluginSandboxPolicyService.js';

export type PluginLoadLogger = {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
};

export type PluginLoadRuntime = {
  now?: () => Date;
  workspacePath?: string;
  pluginConfig?: Record<string, unknown> | ((pluginId: string) => Record<string, unknown>);
  sandbox?: Pick<PluginSandboxPolicyService, 'evaluate'>;
  importModule?: (modulePath: string) => Promise<Record<string, unknown>>;
  resolveEntrypointPath?: (packageDir: string, moduleRef: string) => string;
  existsSync?: typeof fs.existsSync;
  registerTimeoutMs?: number;
  concurrency?: number;
  logger?: PluginLoadLogger;
};

export type PluginLoadAllOptions = { approvedPluginIds?: Set<string> };
export type PluginLoadOneOptions = { approved?: boolean; approvedPluginIds?: Set<string> };

export type PluginHookBinding = {
  event: ZavorthPluginRuntimeHookEvent;
  callback: (payload: {
    event: ZavorthPluginRuntimeHookEvent;
    context: Record<string, unknown>;
  }) => void | Promise<void>;
};

export type LoadedPluginRuntimeRecord = {
  loaded: ZavorthLoadedPlugin;
  capabilityHandlers: Map<string, ZavorthPluginCapabilityHandler>;
  moduleHandler: ZavorthPluginCapabilityHandler | null;
  hooks: PluginHookBinding[];
  channels: ZavorthPluginChannelAdapterBinding[];
  memoryBackends: ZavorthPluginMemoryBackendBinding[];
  providers: ZavorthPluginProviderBinding[];
};
