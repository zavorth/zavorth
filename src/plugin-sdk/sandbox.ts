/**
 * Zavorth Plugin SDK - Sandbox Permission Guard.
 * Enforces declarative permission boundaries for all plugins, preventing unauthorized
 * hardware, network, memory, and filesystem access.
 */

import { logger } from '../logger.js';
import { safeFetch } from '../security/SafeFetchService.js';
import { EgressNetPolicyGuard } from '../security/EgressNetPolicyGuard.js';
import type { PluginManifest, PluginPermission } from './manifest.js';

export class PluginSandbox {
  private readonly permissions: Set<PluginPermission>;
  private readonly pluginId: string;

  constructor(pluginId: string, manifest: PluginManifest) {
    this.pluginId = pluginId;
    this.permissions = new Set(manifest.permissions || []);
  }

  public hasPermission(permission: PluginPermission): boolean {
    return this.permissions.has(permission);
  }

  public assertPermission(permission: PluginPermission, actionDescription: string): void {
    if (!this.hasPermission(permission)) {
      const errorMsg = `[Sandbox] Plugin "${this.pluginId}" was denied permission "${permission}" for action: ${actionDescription}.`;
      logger.warn(errorMsg);
      throw new Error(errorMsg);
    }
  }

  public async fetch(url: string, init?: RequestInit): Promise<Response> {
    this.assertPermission('network.http', `HTTP fetch to ${url}`);

    const security = EgressNetPolicyGuard.checkUrl(url);
    if (!security.allowed) {
      throw new Error(`[Sandbox] Network fetch to "${url}" blocked by Egress policy: ${security.reason}`);
    }

    return safeFetch(url, init, { serviceName: `Plugin:${this.pluginId}` });
  }
}
