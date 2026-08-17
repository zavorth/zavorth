/**
 * Zavorth Plugin SDK - Core Contracts and Runtime Context Types.
 * Strictly typed (Zero any) and EN-First.
 */

import type { BaseTool } from '../tools/BaseTool.js';
import type { PluginManifest, PluginPermission } from './manifest.js';

export interface PluginLogger {
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}

export interface PluginStorage {
  get<T = unknown>(key: string): Promise<T | null>;
  set<T = unknown>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<boolean>;
  clear(): Promise<void>;
  listKeys(): Promise<string[]>;
}

export interface PluginEventBus {
  on(event: string, handler: (payload: unknown) => void | Promise<void>): () => void;
  emit(event: string, payload: unknown): void;
}

export interface PluginLifecycleHooks {
  onBeforeExecute?(context: { toolName: string; args: Record<string, unknown> }): Promise<void | boolean>;
  onAfterExecute?(context: { toolName: string; result: string; durationMs: number }): Promise<void>;
  onTurnStart?(context: { sessionId: string; prompt: string }): Promise<void>;
  onTurnEnd?(context: { sessionId: string; output: string }): Promise<void>;
}

export interface PluginContext {
  pluginId: string;
  manifest: PluginManifest;
  logger: PluginLogger;
  storage: PluginStorage;
  events: PluginEventBus;
  config: Record<string, unknown>;
  registerTool(tool: BaseTool): void;
  unregisterTool(toolName: string): boolean;
  registerHook(hooks: PluginLifecycleHooks): void;
  hasPermission(permission: PluginPermission): boolean;
  fetch(url: string, init?: RequestInit): Promise<Response>;
}

export interface ZavorthPlugin {
  readonly id: string;
  readonly manifest: PluginManifest;
  initialize(context: PluginContext): Promise<void> | void;
  shutdown?(): Promise<void> | void;
}
