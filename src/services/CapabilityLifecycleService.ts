import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';
import { getDefaultCapabilityRegistry } from '../capabilities/CapabilityRegistry.js';
import {
  type ZavorthProfile,
  normalizeZavorthProfile,
  RuntimeProfileService,
} from './RuntimeProfileService.js';
import {
  type ZavorthProductMode,
  type ZavorthProductModeSnapshot,
  buildZavorthProductModeSnapshot,
  isZavorthProductMode,
  normalizeZavorthProductMode,
  resolveBootstrapProductMode,
  resolveDefaultRuntimeProfileForProductMode,
} from './ProductModeService.js';
import { buildCapabilityManifests } from './capability-lifecycle/CapabilityLifecycleManifests.js';
import { logger } from '../logger.js';

export type CapabilityLifecycleState =
  | 'declared'
  | 'dormant'
  | 'provisioning'
  | 'ready'
  | 'active'
  | 'degraded';

export type CapabilityActivationMode = 'builtin' | 'lazy' | 'sidecar';
export type CapabilityApprovalScope = 'once' | 'session' | 'host';

export type CapabilityManifest = {
  id: string;
  label: string;
  description: string;
  availability: 'core' | 'optional';
  activationMode: CapabilityActivationMode;
  approvalRequired: boolean;
  enabledByDefaultProfiles: ZavorthProfile[];
  idleTtlMs: number | null;
  estimatedFootprint: {
    ramIdleMb: number;
    diskMb: number;
    processCount: number;
    notes?: string;
  };
  provisioningRecipe: {
    dependencies?: string[];
    commands?: string[];
    notes?: string;
  } | null;
  cleanupPaths?: string[];
  fallbackBehavior: string;
};

export type CapabilityApprovalRequest = {
  capabilityId: string;
  capabilityLabel: string;
  requestedBy: string;
  requestedAt: string;
  reason: string;
  defaultScope: CapabilityApprovalScope;
  availableScopes: CapabilityApprovalScope[];
  estimatedFootprint: CapabilityManifest['estimatedFootprint'];
};

export type CapabilityStateSnapshot = {
  capabilityId: string;
  label: string;
  state: CapabilityLifecycleState;
  activationMode: CapabilityActivationMode;
  approvalRequired: boolean;
  enabledByProfile: boolean;
  enabledByUser: boolean;
  approvalScope: CapabilityApprovalScope | null;
  idleTtlMs: number | null;
  fallbackBehavior: string;
  estimatedFootprint: CapabilityManifest['estimatedFootprint'];
  lastUpdatedAt: string | null;
  notes?: string;
};

type PersistedCapabilityState = {
  enabledByUser?: boolean;
  approvalScope?: CapabilityApprovalScope | null;
  state?: CapabilityLifecycleState;
  lastUpdatedAt?: string | null;
  notes?: string;
};

type PersistedCapabilityLifecycleState = {
  version: number;
  profile: ZavorthProfile;
  productMode: ZavorthProductMode;
  updatedAt: string;
  capabilities: Record<string, PersistedCapabilityState>;
};

const DEFAULT_APPROVAL_SCOPES: CapabilityApprovalScope[] = ['once', 'session', 'host'];

export class CapabilityLifecycleService {
  private readonly manifests: CapabilityManifest[];
  private readonly manifestsById: Map<string, CapabilityManifest>;
  private readonly stateFilePath: string;
  private readonly runtimeProfileService: RuntimeProfileService;
  private readonly registry = getDefaultCapabilityRegistry();
  private state: PersistedCapabilityLifecycleState;
  private readonly sessionOverrides = new Map<string, PersistedCapabilityState>();

  constructor(options?: {
    stateFilePath?: string;
    runtimeProfileService?: RuntimeProfileService;
    manifests?: CapabilityManifest[];
  }) {
    this.stateFilePath = options?.stateFilePath || config.capabilityLifecycleStateFile;
    this.runtimeProfileService = options?.runtimeProfileService || new RuntimeProfileService(undefined, {
      stateFilePath: this.stateFilePath,
    });
    this.manifests = options?.manifests || buildCapabilityManifests();
    this.manifestsById = new Map(this.manifests.map((manifest) => [manifest.id, manifest]));
    this.state = this.readState();
    this.syncProfile(this.runtimeProfileService.getProfile());
  }

  public getProfile(): ZavorthProfile {
    return normalizeZavorthProfile(this.state.profile);
  }

  public getProductMode(): ZavorthProductMode {
    return normalizeZavorthProductMode(this.state.productMode, this.state.profile);
  }

  public setProfile(profile: string, requestedBy = 'system'): ZavorthProfile {
    const normalized = normalizeZavorthProfile(profile);
    this.runtimeProfileService.setProfile(normalized);
    this.state.profile = normalized;
    this.state.updatedAt = new Date().toISOString();
    const now = this.state.updatedAt;
    for (const manifest of this.manifests) {
      const entry = this.ensureCapabilityState(manifest.id);
      const enabledByProfile = manifest.enabledByDefaultProfiles.includes(normalized);
      const hostPinned = entry.enabledByUser === true && entry.approvalScope === 'host';
      if (manifest.id === 'core-runtime') {
        entry.state = 'active';
        entry.lastUpdatedAt = now;
        entry.notes = `profile set by ${requestedBy}`;
        continue;
      }
      if (entry.enabledByUser === false) {
        entry.state = 'dormant';
        entry.lastUpdatedAt = now;
        entry.notes = `profile ${normalized} keeps ${manifest.label} disabled by user`;
        continue;
      }
      if (hostPinned) {
        entry.state = manifest.activationMode === 'builtin' ? 'active' : 'ready';
        entry.lastUpdatedAt = now;
        entry.notes = `profile ${normalized} preserved ${manifest.label} host approval`;
        continue;
      }
      if (entry.enabledByUser === true) {
        entry.state = manifest.activationMode === 'builtin' ? 'active' : 'ready';
        entry.lastUpdatedAt = now;
        entry.notes = `profile ${normalized} preserved ${manifest.label} override`;
        continue;
      }
      entry.state = enabledByProfile
        ? (manifest.activationMode === 'builtin' ? 'active' : 'ready')
        : 'dormant';
      entry.lastUpdatedAt = now;
      entry.notes = enabledByProfile
        ? `profile ${normalized} prewarms ${manifest.label}`
        : `profile ${normalized} leaves ${manifest.label} dormant`;
    }
    this.persistState();
    return normalized;
  }

  public setProductMode(mode: string, requestedBy = 'system'): ZavorthProductModeSnapshot {
    if (!isZavorthProductMode(mode)) {
      throw new Error('Use um product mode valido: chat, assistant, builder ou operator.');
    }
    const normalized = normalizeZavorthProductMode(mode, this.getProfile());
    const mappedProfile = resolveDefaultRuntimeProfileForProductMode(normalized);
    if (this.getProfile() !== mappedProfile) {
      this.setProfile(mappedProfile, `${requestedBy} (product mode)`);
    }
    this.state.productMode = normalized;
    this.state.updatedAt = new Date().toISOString();
    this.persistState();
    return this.buildProductModeSnapshot();
  }

  public getManifests(): CapabilityManifest[] {
    return this.manifests.map((manifest) => ({ ...manifest, estimatedFootprint: { ...manifest.estimatedFootprint } }));
  }

  public getManifest(capabilityId: string): CapabilityManifest | null {
    const manifest = this.manifestsById.get(capabilityId);
    return manifest ? { ...manifest, estimatedFootprint: { ...manifest.estimatedFootprint } } : null;
  }

  public buildApprovalRequest(
    capabilityId: string,
    requestedBy: string,
    reason: string,
  ): CapabilityApprovalRequest | null {
    const manifest = this.manifestsById.get(capabilityId);
    if (!manifest) {
      return null;
    }

    return {
      capabilityId: manifest.id,
      capabilityLabel: manifest.label,
      requestedBy,
      requestedAt: new Date().toISOString(),
      reason: String(reason || '').trim() || `Habilitar ${manifest.label}.`,
      defaultScope: 'once',
      availableScopes: [...DEFAULT_APPROVAL_SCOPES],
      estimatedFootprint: { ...manifest.estimatedFootprint },
    };
  }

  public registerCapabilityDemand(
    capabilityId: string,
    requestedBy: string,
    reason: string,
    dependencyName?: string | null,
  ): { capability: CapabilityStateSnapshot; approval: CapabilityApprovalRequest | null } | null {
    const manifest = this.manifestsById.get(capabilityId);
    if (!manifest) {
      return null;
    }

    const noteParts = [
      `requested by ${requestedBy}`,
      String(reason || '').trim() || `Uso solicitado para ${manifest.label}.`,
      dependencyName ? `dependency ${dependencyName} missing` : null,
      manifest.approvalRequired ? 'approval required' : 'provisioning required',
    ].filter(Boolean);

    const capability = this.markCapabilityState(
      capabilityId,
      'degraded',
      noteParts.join(' | '),
    );
    if (!capability) {
      return null;
    }

    return {
      capability,
      approval: this.buildApprovalRequest(capabilityId, requestedBy, reason),
    };
  }

  public enableCapability(
    capabilityId: string,
    requestedBy = 'system',
    scope: CapabilityApprovalScope = 'host',
  ): CapabilityStateSnapshot | null {
    const manifest = this.manifestsById.get(capabilityId);
    if (!manifest) {
      return null;
    }

    const entry = this.getMutableCapabilityState(capabilityId, scope);
    entry.enabledByUser = true;
    entry.approvalScope = manifest.approvalRequired ? scope : null;
    entry.state = manifest.activationMode === 'builtin' ? 'active' : 'ready';
    entry.lastUpdatedAt = new Date().toISOString();
    entry.notes = `enabled by ${requestedBy}${scope !== 'host' ? ` (${scope})` : ''}`;
    if (scope === 'host') {
      this.persistState();
    }
    return this.buildCapabilitySnapshot(manifest);
  }

  public registerCapabilityUsage(
    capabilityId: string,
    note = 'capability used',
  ): CapabilityStateSnapshot | null {
    const manifest = this.manifestsById.get(capabilityId);
    if (!manifest) {
      return null;
    }

    const now = new Date().toISOString();
    const sessionEntry = this.sessionOverrides.get(capabilityId);
    if (sessionEntry?.enabledByUser === true) {
      if (sessionEntry.approvalScope === 'once') {
        this.sessionOverrides.delete(capabilityId);
        const hostEntry = this.ensureCapabilityState(capabilityId);
        hostEntry.lastUpdatedAt = now;
        hostEntry.notes = `${note} | one-time approval consumed`;
        hostEntry.state = manifest.enabledByDefaultProfiles.includes(this.getProfile())
          ? (manifest.activationMode === 'builtin' ? 'active' : 'ready')
          : 'dormant';
        this.persistState();
        return this.buildCapabilitySnapshot(manifest);
      }

      sessionEntry.lastUpdatedAt = now;
      sessionEntry.notes = note;
      sessionEntry.state = manifest.activationMode === 'builtin' ? 'active' : 'active';
      return this.buildCapabilitySnapshot(manifest);
    }

    const hostEntry = this.ensureCapabilityState(capabilityId);
    hostEntry.lastUpdatedAt = now;
    hostEntry.notes = note;
    hostEntry.state = manifest.activationMode === 'builtin' ? 'active' : 'active';
    this.persistState();
    return this.buildCapabilitySnapshot(manifest);
  }

  public disableCapability(capabilityId: string, requestedBy = 'system'): CapabilityStateSnapshot | null {
    const manifest = this.manifestsById.get(capabilityId);
    if (!manifest) {
      return null;
    }

    this.sessionOverrides.delete(capabilityId);
    const entry = this.ensureCapabilityState(capabilityId);
    entry.enabledByUser = false;
    entry.approvalScope = null;
    entry.state = manifest.id === 'core-runtime' ? 'active' : 'dormant';
    entry.lastUpdatedAt = new Date().toISOString();
    const cleanedPaths = this.cleanupCapabilityArtifacts(manifest);
    entry.notes = `disabled by ${requestedBy}${cleanedPaths.length > 0 ? ` | cleaned ${cleanedPaths.length} path(s)` : ''}`;
    this.persistState();
    return this.buildCapabilitySnapshot(manifest);
  }

  public markCapabilityState(
    capabilityId: string,
    nextState: CapabilityLifecycleState,
    notes?: string,
  ): CapabilityStateSnapshot | null {
    const manifest = this.manifestsById.get(capabilityId);
    if (!manifest) {
      return null;
    }

    const entry = this.ensureCapabilityState(capabilityId);
    entry.state = nextState;
    entry.lastUpdatedAt = new Date().toISOString();
    if (notes) {
      entry.notes = notes;
    }
    this.persistState();
    return this.buildCapabilitySnapshot(manifest);
  }

  public shouldBootCapability(capabilityId: string): boolean {
    const manifest = this.manifestsById.get(capabilityId);
    if (!manifest) {
      return false;
    }

    const profileEnabled = manifest.enabledByDefaultProfiles.includes(this.getProfile());
    const entry = this.readCapabilityState(capabilityId);
    if (entry.enabledByUser === false) {
      return false;
    }
    if (entry.enabledByUser === true) {
      return true;
    }
    return profileEnabled;
  }

  public isCapabilityReady(capabilityId: string): boolean {
    return this.shouldBootCapability(capabilityId);
  }

  public buildSnapshot(): {
    profile: ZavorthProfile;
    productMode: ZavorthProductModeSnapshot;
    policy: string;
    commands: { profile: string; mode: string; capabilities: string; enable: string; disable: string };
    summary: {
      total: number;
      builtinCapabilities: number;
      registeredCommands: number;
      active: number;
      dormant: number;
      requiringApproval: number;
    };
    capabilities: CapabilityStateSnapshot[];
  } {
    const capabilities = this.manifests.map((manifest) => this.buildCapabilitySnapshot(manifest));
    return {
      profile: this.getProfile(),
      productMode: this.buildProductModeSnapshot(),
      policy: config.zavorthCapabilityPolicy,
      commands: {
        profile: '/profile <core|ops|full>',
        mode: '/mode <chat|assistant|builder|operator>',
        capabilities: '/capabilities [id]',
        enable: '/enable <capability> [once|session|host]',
        disable: '/disable <capability>',
      },
      summary: {
        total: capabilities.length,
        builtinCapabilities: this.registry.getSummary().total,
        registeredCommands: this.registry.getSummary().commands,
        active: capabilities.filter((entry) => entry.state === 'active' || entry.state === 'ready').length,
        dormant: capabilities.filter((entry) => entry.state === 'dormant' || entry.state === 'declared').length,
        requiringApproval: capabilities.filter((entry) => entry.approvalRequired).length,
      },
      capabilities,
    };
  }

  public buildProductModeSnapshot(): ZavorthProductModeSnapshot {
    return buildZavorthProductModeSnapshot(this.getProductMode(), this.getProfile());
  }

  public describeCapability(capabilityId: string): CapabilityStateSnapshot | null {
    const manifest = this.manifestsById.get(capabilityId);
    return manifest ? this.buildCapabilitySnapshot(manifest) : null;
  }

  public cleanupDormantCapabilityArtifacts(
    capabilityIds?: string[],
  ): Array<{ capabilityId: string; removedPaths: string[] }> {
    const targetIds = Array.isArray(capabilityIds) && capabilityIds.length > 0
      ? capabilityIds
      : this.manifests.map((manifest) => manifest.id);
    const cleaned: Array<{ capabilityId: string; removedPaths: string[] }> = [];

    for (const capabilityId of targetIds) {
      const manifest = this.manifestsById.get(capabilityId);
      if (!manifest || this.shouldBootCapability(capabilityId)) {
        continue;
      }

      const removedPaths = this.cleanupCapabilityArtifacts(manifest);
      if (removedPaths.length === 0) {
        continue;
      }

      const entry = this.ensureCapabilityState(capabilityId);
      entry.lastUpdatedAt = new Date().toISOString();
      entry.notes = `dormant cleanup removed ${removedPaths.length} path(s)`;
      if (!entry.enabledByUser) {
        entry.state = manifest.enabledByDefaultProfiles.includes(this.getProfile())
          ? (manifest.activationMode === 'builtin' ? 'active' : 'ready')
          : 'dormant';
      }
      cleaned.push({ capabilityId, removedPaths });
    }

    if (cleaned.length > 0) {
      this.persistState();
    }

    return cleaned;
  }

  public expireIdleCapabilities(
    nowMs = Date.now(),
  ): Array<{ capabilityId: string; removedPaths: string[]; idleForMs: number }> {
    const expired: Array<{ capabilityId: string; removedPaths: string[]; idleForMs: number }> = [];

    for (const manifest of this.manifests) {
      if (!manifest.idleTtlMs || manifest.idleTtlMs <= 0) {
        continue;
      }

      const currentState = this.readCapabilityState(manifest.id);
      const lastUpdatedAtMs = currentState.lastUpdatedAt ? Date.parse(currentState.lastUpdatedAt) : NaN;
      if (!Number.isFinite(lastUpdatedAtMs)) {
        continue;
      }

      const idleForMs = Math.max(0, nowMs - lastUpdatedAtMs);
      if (idleForMs < manifest.idleTtlMs) {
        continue;
      }

      const approvalScope = currentState.approvalScope || null;
      const hostPinned = currentState.enabledByUser === true && approvalScope === 'host';
      const profileEnabled = manifest.enabledByDefaultProfiles.includes(this.getProfile());
      const currentLifecycleState = currentState.state || this.buildCapabilitySnapshot(manifest).state;
      if (hostPinned || profileEnabled || !['active', 'ready', 'degraded'].includes(currentLifecycleState)) {
        continue;
      }

      this.sessionOverrides.delete(manifest.id);
      const entry = this.ensureCapabilityState(manifest.id);
      entry.enabledByUser = false;
      entry.approvalScope = null;
      entry.state = manifest.id === 'core-runtime' ? 'active' : 'dormant';
      entry.lastUpdatedAt = new Date(nowMs).toISOString();
      const removedPaths = this.cleanupCapabilityArtifacts(manifest);
      entry.notes = `idle TTL expired after ${idleForMs}ms${removedPaths.length > 0 ? ` | cleaned ${removedPaths.length} path(s)` : ''}`;
      expired.push({
        capabilityId: manifest.id,
        removedPaths,
        idleForMs,
      });
    }

    if (expired.length > 0) {
      this.persistState();
    }

    return expired;
  }

  private buildCapabilitySnapshot(manifest: CapabilityManifest): CapabilityStateSnapshot {
    const entry = this.readCapabilityState(manifest.id);
    const enabledByProfile = manifest.enabledByDefaultProfiles.includes(this.getProfile());
    const enabledByUser = entry.enabledByUser === true;
    const resolvedState =
      entry.state ||
      (manifest.id === 'core-runtime'
        ? 'active'
        : enabledByUser || enabledByProfile
          ? manifest.activationMode === 'builtin' ? 'active' : 'ready'
          : 'dormant');

    return {
      capabilityId: manifest.id,
      label: manifest.label,
      state: resolvedState,
      activationMode: manifest.activationMode,
      approvalRequired: manifest.approvalRequired,
      enabledByProfile,
      enabledByUser,
      approvalScope: entry.approvalScope || null,
      idleTtlMs: manifest.idleTtlMs,
      fallbackBehavior: manifest.fallbackBehavior,
      estimatedFootprint: { ...manifest.estimatedFootprint },
      lastUpdatedAt: entry.lastUpdatedAt || null,
      notes: entry.notes,
    };
  }

  private syncProfile(profile: ZavorthProfile): void {
    this.state.profile = normalizeZavorthProfile(profile);
    this.state.updatedAt = new Date().toISOString();
    this.persistState();
  }

  private ensureCapabilityState(capabilityId: string): PersistedCapabilityState {
    if (!this.state.capabilities[capabilityId]) {
      this.state.capabilities[capabilityId] = {};
    }
    return this.state.capabilities[capabilityId];
  }

  private getMutableCapabilityState(
    capabilityId: string,
    scope: CapabilityApprovalScope,
  ): PersistedCapabilityState {
    if (scope === 'host') {
      return this.ensureCapabilityState(capabilityId);
    }
    if (!this.sessionOverrides.has(capabilityId)) {
      this.sessionOverrides.set(capabilityId, {});
    }
    return this.sessionOverrides.get(capabilityId)!;
  }

  private readCapabilityState(capabilityId: string): PersistedCapabilityState {
    return this.sessionOverrides.get(capabilityId) || this.ensureCapabilityState(capabilityId);
  }

  private cleanupCapabilityArtifacts(manifest: CapabilityManifest): string[] {
    const cleanupPaths = Array.isArray(manifest.cleanupPaths) ? manifest.cleanupPaths : [];
    const removed: string[] = [];
    for (const cleanupPath of cleanupPaths) {
      const absolutePath = path.resolve(cleanupPath);
      const relative = path.relative(config.projectRoot, absolutePath);
      if (relative.startsWith('..') || path.isAbsolute(relative)) {
        continue;
      }
      if (!fs.existsSync(absolutePath)) {
        continue;
      }
      try {
        const stats = fs.statSync(absolutePath);
        if (stats.isDirectory()) {
          fs.rmSync(absolutePath, { recursive: true, force: true });
        } else {
          fs.unlinkSync(absolutePath);
        }
        removed.push(relative.replace(/\\/g, '/'));
      } catch (error: unknown) {// O Zavorth segue leve mesmo quando um artefato antigo esta travado por outro processo.
      logger.warn('[Capability Lifecycle] file cleanup failed', error);
    }
    }
    return removed;
  }

  private readState(): PersistedCapabilityLifecycleState {
    try {
      if (fs.existsSync(this.stateFilePath)) {
        const parsed = JSON.parse(fs.readFileSync(this.stateFilePath, 'utf8')) as PersistedCapabilityLifecycleState;
        return {
          version: 2,
          profile: normalizeZavorthProfile(parsed.profile),
          productMode: normalizeZavorthProductMode(
            parsed.productMode,
            normalizeZavorthProfile(parsed.profile),
          ),
          updatedAt: String(parsed.updatedAt || new Date().toISOString()),
          capabilities: parsed.capabilities && typeof parsed.capabilities === 'object' ? parsed.capabilities : {},
        };
      }
    } catch (error: unknown) {// Se o estado estiver corrompido, o Zavorth volta para o baseline leve.
      logger.warn('[Capability Lifecycle] parsing failed', error);
    }

    return {
      version: 2,
      profile: this.runtimeProfileService.getProfile(),
      productMode: resolveBootstrapProductMode(
        null,
        this.runtimeProfileService.getProfile(),
        { stateFilePath: this.stateFilePath },
      ),
      updatedAt: new Date().toISOString(),
      capabilities: {},
    };
  }

  private persistState(): void {
    fs.mkdirSync(path.dirname(this.stateFilePath), { recursive: true });
    fs.writeFileSync(this.stateFilePath, `${JSON.stringify(this.state, null, 2)}\n`, 'utf8');
  }
}
