import type fs from 'node:fs';

import type { PluginStateService } from './PluginStateService.js';

export type BridgedPluginState = {
  pluginId: string;
  installed: boolean;
  enabled: boolean;
  trust: 'review' | 'trusted' | 'blocked';
  installedRevision: string | null;
  sourceDigest: string | null;
  sourceLocator: string | null;
  sourceTrusted: boolean | null;
  runtimeState: 'available' | 'installed' | 'enabled' | 'disabled' | 'blocked';
  updatedAt: string;
  origins: {
    fromPluginStateService: boolean;
    fromCliRecord: boolean;
    fromRuntimeIndex: boolean;
  };
};

export type PluginOsStateEntry = {
  pluginId: string;
  enabled: boolean;
  trust: 'review' | 'trusted' | 'blocked';
  installed: boolean;
  installedRevision: string | null;
  sourceDigest: string | null;
  sourceLocator: string | null;
  sourceTrusted: boolean | null;
  updatedAt: string;
};

export type PluginOsStateFile = {
  version: number;
  updatedAt: string;
  entries: Record<string, PluginOsStateEntry>;
};

export type PluginStateBridgeRuntime = {
  now?: () => Date;
  projectRoot?: string;
  pluginStateService?: Pick<PluginStateService, 'getState' | 'upsertState' | 'clearState' | 'readState'>;
  pluginsFile?: string;
  runtimeFile?: string;
  osStateFile?: string;
  existsSync?: typeof fs.existsSync;
  readFileSync?: typeof fs.readFileSync;
  writeFileSync?: typeof fs.writeFileSync;
  mkdirSync?: typeof fs.mkdirSync;
};
