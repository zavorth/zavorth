import { logger } from '../logger.js';
/**
 * ToolVersionRegistry — Versioned tool registry with independent updates.
 *
 * Tracks tool versions, enables rolling updates, and supports
 * multiple versions of the same tool running simultaneously.
 *
 * Usage:
 *   const registry = new ToolVersionRegistry();
 *   registry.register('read_file', '1.0.0', readToolV1);
 *   registry.register('read_file', '1.1.0', readToolV11);
 *   registry.setActiveVersion('read_file', '1.1.0');
 *   const tool = registry.get('read_file');
 */

export interface ToolVersion<T = unknown> {
  version: string;
  tool: T;
  registeredAt: number;
  deprecated?: boolean;
  deprecationMessage?: string;
}

export interface ToolVersionInfo {
  name: string;
  versions: string[];
  activeVersion: string | null;
  latestVersion: string | null;
  totalRegistrations: number;
}

export interface VersionComparison {
  current: string | null;
  latest: string;
  isOutdated: boolean;
  versionsBehind: number;
  deprecationWarning: string | null;
}

// Simple semver comparison
function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);

  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const na = pa[i] || 0;
    const nb = pb[i] || 0;
    if (na > nb) return 1;
    if (na < nb) return -1;
  }
  return 0;
}

function isNewer(a: string, b: string): boolean {
  return compareVersions(a, b) > 0;
}

export class ToolVersionRegistry<T = unknown> {
  private tools = new Map<string, Map<string, ToolVersion<T>>>();
  private activeVersions = new Map<string, string>();
  private updateCallbacks = new Map<string, Array<(version: string) => void>>();

  /**
   * Registers a tool version.
   */
  register(name: string, version: string, tool: T, options?: {
    deprecated?: boolean;
    deprecationMessage?: string;
  }): void {
    if (!this.tools.has(name)) {
      this.tools.set(name, new Map());
    }

    const versions = this.tools.get(name)!;
    versions.set(version, {
      version,
      tool,
      registeredAt: Date.now(),
      deprecated: options?.deprecated,
      deprecationMessage: options?.deprecationMessage,
    });

    // Auto-set as active if first version or newer than current
    const currentActive = this.activeVersions.get(name);
    if (!currentActive || isNewer(version, currentActive)) {
      this.activeVersions.set(name, version);
    }

    // Notify callbacks
    this.notifyUpdate(name, version);
  }

  /**
   * Gets the active tool version.
   */
  get(name: string): T | null {
    const activeVersion = this.activeVersions.get(name);
    if (!activeVersion) return null;

    const versions = this.tools.get(name);
    if (!versions) return null;

    const toolVersion = versions.get(activeVersion);
    return toolVersion?.tool ?? null;
  }

  /**
   * Gets a specific tool version.
   */
  getVersion(name: string, version: string): T | null {
    const versions = this.tools.get(name);
    if (!versions) return null;

    const toolVersion = versions.get(version);
    return toolVersion?.tool ?? null;
  }

  /**
   * Sets the active version for a tool.
   */
  setActiveVersion(name: string, version: string): boolean {
    const versions = this.tools.get(name);
    if (!versions || !versions.has(version)) {
      return false;
    }

    this.activeVersions.set(name, version);
    return true;
  }

  /**
   * Gets the latest version of a tool.
   */
  getLatestVersion(name: string): string | null {
    const versions = this.tools.get(name);
    if (!versions || versions.size === 0) return null;

    return Array.from(versions.keys())
      .sort(compareVersions)
      .pop() ?? null;
  }

  /**
   * Gets all versions of a tool.
   */
  getVersions(name: string): string[] {
    const versions = this.tools.get(name);
    if (!versions) return [];

    return Array.from(versions.keys()).sort(compareVersions);
  }

  /**
   * Gets version info for a tool.
   */
  getVersionInfo(name: string): ToolVersionInfo | null {
    const versions = this.tools.get(name);
    if (!versions) return null;

    const versionList = Array.from(versions.keys()).sort(compareVersions);
    return {
      name,
      versions: versionList,
      activeVersion: this.activeVersions.get(name) ?? null,
      latestVersion: versionList[versionList.length - 1] ?? null,
      totalRegistrations: versions.size,
    };
  }

  /**
   * Compares current version with latest.
   */
  compareVersion(name: string): VersionComparison | null {
    const info = this.getVersionInfo(name);
    if (!info) return null;

    const current = info.activeVersion;
    const latest = info.latestVersion;
    if (!latest) return { current: null, latest: '', isOutdated: false, versionsBehind: 0, deprecationWarning: null };

    const versions = info.versions;
    const currentIndex = current ? versions.indexOf(current) : -1;
    const latestIndex = versions.indexOf(latest);

    const activeVersionData = current ? this.tools.get(name)?.get(current) : null;

    return {
      current,
      latest,
      isOutdated: current !== latest && currentIndex < latestIndex,
      versionsBehind: currentIndex >= 0 ? latestIndex - currentIndex : 0,
      deprecationWarning: activeVersionData?.deprecated ? activeVersionData.deprecationMessage ?? 'This version is deprecated' : null,
    };
  }

  /**
   * Deprecates a specific version.
   */
  deprecate(name: string, version: string, message?: string): boolean {
    const versions = this.tools.get(name);
    if (!versions) return false;

    const toolVersion = versions.get(version);
    if (!toolVersion) return false;

    toolVersion.deprecated = true;
    toolVersion.deprecationMessage = message;
    return true;
  }

  /**
   * Removes a specific version.
   */
  remove(name: string, version: string): boolean {
    const versions = this.tools.get(name);
    if (!versions) return false;

    const removed = versions.delete(version);
    if (removed && this.activeVersions.get(name) === version) {
      // Set active to latest remaining
      const remaining = Array.from(versions.keys()).sort(compareVersions);
      if (remaining.length > 0) {
        this.activeVersions.set(name, remaining[remaining.length - 1]);
      } else {
        this.activeVersions.delete(name);
      }
    }

    return removed;
  }

  /**
   * Removes all versions of a tool.
   */
  removeAll(name: string): boolean {
    const existed = this.tools.has(name);
    this.tools.delete(name);
    this.activeVersions.delete(name);
    this.updateCallbacks.delete(name);
    return existed;
  }

  /**
   * Lists all registered tools.
   */
  listTools(): string[] {
    return Array.from(this.tools.keys());
  }

  /**
   * Lists all tools with their version info.
   */
  listToolsWithInfo(): ToolVersionInfo[] {
    return Array.from(this.tools.keys())
      .map((name) => this.getVersionInfo(name))
      .filter((info): info is ToolVersionInfo => info !== null);
  }

  /**
   * Registers a callback for version updates.
   */
  onUpdate(name: string, callback: (version: string) => void): void {
    if (!this.updateCallbacks.has(name)) {
      this.updateCallbacks.set(name, []);
    }
    this.updateCallbacks.get(name)!.push(callback);
  }

  /**
   * Removes update callbacks for a tool.
   */
  removeUpdateCallbacks(name: string): void {
    this.updateCallbacks.delete(name);
  }

  private notifyUpdate(name: string, version: string): void {
    const callbacks = this.updateCallbacks.get(name);
    if (callbacks) {
      for (const callback of callbacks) {
        try {
          callback(version);
        } catch (error: any) {
      // ignore callback errors
      logger.warn('[Version Registry] delete operation failed', error);
    }
      }
    }
  }

  /**
   * Gets statistics about the registry.
   */
  getStats(): {
    totalTools: number;
    totalVersions: number;
    deprecatedVersions: number;
    toolsWithMultipleVersions: number;
  } {
    let totalVersions = 0;
    let deprecatedVersions = 0;
    let toolsWithMultipleVersions = 0;

    for (const versions of this.tools.values()) {
      totalVersions += versions.size;
      if (versions.size > 1) toolsWithMultipleVersions++;
      for (const v of versions.values()) {
        if (v.deprecated) deprecatedVersions++;
      }
    }

    return {
      totalTools: this.tools.size,
      totalVersions,
      deprecatedVersions,
      toolsWithMultipleVersions,
    };
  }
}
