import { Task } from '../../../../contracts/TaskContract.js';
import {
  PermissionAccessLevel,
  PermissionCommandMatchType,
  PermissionRequest,
  PermissionScope,
  PermissionStatus,
} from '../../../../contracts/PermissionRequest.js';
import { TelegramPermissionDescriptorService } from '../../../../gateways/channels/telegram/controllers/TelegramPermissionDescriptorService.js';

export type TelegramPermissionPathPolicy = {
  path: string;
  access_level: PermissionAccessLevel;
  scope: PermissionScope;
  permission_id?: string | null;
};

export type TelegramPermissionCommandPolicy = {
  command: string;
  match_type: PermissionCommandMatchType;
  scope: PermissionScope;
  permission_id?: string | null;
};

export interface PermissionPolicyAssignments {
  kind?: string;
  access_level?: PermissionAccessLevel | string;
  access?: string;
  mode?: string;
  match_type?: PermissionCommandMatchType | string;
  match?: string;
  rule?: string;
  [key: string]: unknown;
}

export interface PermissionPolicyPatch {
  access_level?: PermissionAccessLevel | string;
  access?: string;
  mode?: string;
  match_type?: PermissionCommandMatchType | string;
  match?: string;
  rule?: string;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface PermissionPolicyMetadata {
  access_level?: PermissionAccessLevel;
  match_type?: PermissionCommandMatchType;
  [key: string]: unknown;
}

export interface RawPermissionPolicy {
  path?: string;
  command?: string;
  resolved_value?: string;
  requested_value?: string;
  access_level?: PermissionAccessLevel | string;
  match_type?: PermissionCommandMatchType | string;
  scope?: string;
  permission_id?: string | null;
  metadata?: {
    access_level?: PermissionAccessLevel | string;
    match_type?: PermissionCommandMatchType | string;
  };
  [key: string]: unknown;
}

export class TelegramPermissionPolicyService {
  private readonly descriptorService: TelegramPermissionDescriptorService;

  constructor() {
    this.descriptorService = new TelegramPermissionDescriptorService({
      normalizePermissionAccessLevel: (value) => this.normalizePermissionAccessLevel(value),
      normalizePermissionCommandMatchType: (value) => this.normalizePermissionCommandMatchType(value),
    });
  }

  public shortPermissionId(permission: PermissionRequest): string {
    if (!permission || !permission.permission_id) return 'unknown';
    return permission.permission_id.substring(0, 8);
  }

  public describePermissionStatus(status: PermissionStatus | 'all'): string {
    return this.descriptorService.describePermissionStatus(status);
  }

  public describePermissionSubject(permission: PermissionRequest): string {
    return this.descriptorService.describePermissionSubject(permission);
  }

  public normalizePermissionKind(input: string): string {
    switch (String(input || '').trim().toLowerCase()) {
      case 'folder':
      case 'path':
      case 'workspace':
        return 'workspace_access';
      case 'command':
      case 'cmd':
        return 'command_access';
      case 'tool':
      case 'builtin_tool':
      case 'builtin-tools':
        return 'builtin_tool_access';
      case 'service':
      case 'connector':
      case 'connectors':
        return 'service_access';
      case 'ui':
      case 'dialog':
        return 'ui_permission';
      default:
        return String(input || '').trim().toLowerCase();
    }
  }

  public normalizePermissionScope(input: string): PermissionScope {
    const clean = String(input || '').trim().toLowerCase();
    if (clean === 'persistent') return 'persistent';
    if (clean === 'workspace') return 'workspace';
    if (clean === 'session' || clean === 'conversation') return 'session';
    return 'once';
  }

  public normalizePermissionStatus(input: string): PermissionStatus | 'all' {
    const clean = String(input || '').trim().toLowerCase();
    if (clean === 'all') return 'all';
    if (clean === 'approved') return 'approved';
    if (clean === 'rejected') return 'rejected';
    if (clean === 'expired') return 'expired';
    if (clean === 'pending') return 'pending';
    return 'pending';
  }

  public describePermissionScope(scope: PermissionScope): string {
    return this.descriptorService.describePermissionScope(scope);
  }

  public resolveExternalExecutorAgentRole(task: Task): string {
    return this.descriptorService.resolveExternalExecutorAgentRole(task);
  }

  public resolveExternalExecutorAgentRoleFromInput(assignments: Record<string, string>): string {
    return this.descriptorService.resolveExternalExecutorAgentRoleFromInput(assignments);
  }

  public getExternalExecutorAgentRole(permission: PermissionRequest): string {
    return this.descriptorService.getExternalExecutorAgentRole(permission);
  }

  public extractAiStudioPermissionValues(permission: PermissionRequest): string[] {
    return this.descriptorService.extractAiStudioPermissionValues(permission);
  }

  public describeAiStudioPermissionValues(permission: PermissionRequest): string {
    return this.descriptorService.describeAiStudioPermissionValues(permission);
  }

  public mergeNormalizedValues(...collections: Array<Iterable<string> | null | undefined>): string[] {
    return this.descriptorService.mergeNormalizedValues(...collections);
  }

  public extractPermissionPolicyMetadata(
    assignments: PermissionPolicyAssignments,
    kind?: string | null,
  ): PermissionPolicyMetadata {
    const metadata: PermissionPolicyMetadata = {};
    const normalizedKind = String(kind || assignments.kind || '').trim().toLowerCase();

    if (normalizedKind === 'workspace_access') {
      metadata.access_level = this.normalizePermissionAccessLevel(
        assignments.access_level || assignments.access || assignments.mode,
      );
    }

    if (normalizedKind === 'command_access') {
      metadata.match_type = this.normalizePermissionCommandMatchType(
        assignments.match_type || assignments.match || assignments.rule,
      );
    }

    return metadata;
  }

  public applyPermissionPolicyHints(
    permission: PermissionRequest,
    patch: PermissionPolicyPatch,
  ): PermissionPolicyPatch {
    const nextPatch = { ...(patch || {}) };
    const metadata = { ...(nextPatch.metadata || {}) };

    if (permission.kind === 'workspace_access') {
      metadata.access_level = this.normalizePermissionAccessLevel(
        nextPatch.access_level || nextPatch.access || nextPatch.mode || metadata.access_level,
      );
    }

    if (permission.kind === 'command_access') {
      metadata.match_type = this.normalizePermissionCommandMatchType(
        nextPatch.match_type || nextPatch.match || nextPatch.rule || metadata.match_type,
      );
    }

    if (Object.keys(metadata).length > 0) {
      nextPatch.metadata = metadata;
    }

    return nextPatch;
  }

  public normalizePermissionAccessLevel(value: unknown): PermissionAccessLevel {
    const normalized = String(value || '').trim().toLowerCase();
    if (
      normalized === 'read_write' ||
      normalized === 'readwrite' ||
      normalized === 'write' ||
      normalized === 'rw'
    ) {
      return 'read_write';
    }
    return 'read_only';
  }

  public normalizePermissionCommandMatchType(value: unknown): PermissionCommandMatchType {
    const normalized = String(value || '').trim().toLowerCase();
    if (normalized === 'prefix' || normalized === 'starts_with' || normalized === 'startswith') {
      return 'prefix';
    }
    return 'exact';
  }

  public getPermissionAccessLevel(permission: PermissionRequest): PermissionAccessLevel {
    return this.descriptorService.getPermissionAccessLevel(permission);
  }

  public describePermissionAccessLevel(permission: PermissionRequest): string {
    return this.descriptorService.describePermissionAccessLevel(permission);
  }

  public getPermissionCommandMatchType(permission: PermissionRequest): PermissionCommandMatchType {
    return this.descriptorService.getPermissionCommandMatchType(permission);
  }

  public describePermissionCommandMatchType(permission: PermissionRequest): string {
    return this.descriptorService.describePermissionCommandMatchType(permission);
  }

  public normalizePathPolicy(policy: unknown): TelegramPermissionPathPolicy | null {
    const p = policy as RawPermissionPolicy | null | undefined;
    const pathValue = String(p?.path || p?.resolved_value || p?.requested_value || '').trim();
    if (!pathValue) {
      return null;
    }

    return {
      path: pathValue,
      access_level: this.normalizePermissionAccessLevel(
        p?.access_level || p?.metadata?.access_level,
      ),
      scope: this.normalizePermissionScope(p?.scope || 'once'),
      permission_id: p?.permission_id || null,
    };
  }

  public normalizeCommandPolicy(policy: unknown): TelegramPermissionCommandPolicy | null {
    const p = policy as RawPermissionPolicy | null | undefined;
    const commandValue = String(p?.command || p?.resolved_value || p?.requested_value || '').trim();
    if (!commandValue) {
      return null;
    }

    return {
      command: commandValue,
      match_type: this.normalizePermissionCommandMatchType(
        p?.match_type || p?.metadata?.match_type,
      ),
      scope: this.normalizePermissionScope(p?.scope || 'once'),
      permission_id: p?.permission_id || null,
    };
  }

  public mergePathPolicies(
    ...policies: Array<TelegramPermissionPathPolicy | null>
  ): TelegramPermissionPathPolicy[] {
    const merged = new Map<string, TelegramPermissionPathPolicy>();
    for (const policy of policies) {
      if (!policy || !policy.path) {
        continue;
      }

      const key = policy.path.toLowerCase();
      const current = merged.get(key);
      if (!current) {
        merged.set(key, policy);
        continue;
      }

      const stronger =
        current.access_level === 'read_write' || policy.access_level !== 'read_write'
          ? current
          : policy;
      merged.set(key, {
        ...stronger,
        scope: stronger.scope === 'persistent' ? stronger.scope : policy.scope,
        permission_id: stronger.permission_id || policy.permission_id || null,
      });
    }

    return Array.from(merged.values());
  }

  public mergeCommandPolicies(
    ...policies: Array<TelegramPermissionCommandPolicy | null>
  ): TelegramPermissionCommandPolicy[] {
    const merged = new Map<string, TelegramPermissionCommandPolicy>();
    for (const policy of policies) {
      if (!policy || !policy.command) {
        continue;
      }

      const key = `${policy.match_type}:${policy.command.toLowerCase()}`;
      if (!merged.has(key)) {
        merged.set(key, policy);
      }
    }

    return Array.from(merged.values());
  }
}
