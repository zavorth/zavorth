import { ConfigVersioningService } from './ConfigVersioningService.js';
import { v4 as uuidv4 } from 'uuid';
import {
  PermissionAccessLevel,
  PermissionCommandMatchType,
  PermissionRequest,
  PermissionScope,
  PermissionStatus,
} from '../contracts/PermissionRequest.js';

import { PermissionRepository } from '../storage/PermissionRepository.js';
import { TelemetryRuntimeService } from './telemetry/TelemetryRuntimeService.js';
import { logger } from '../logger.js';
import { HighRiskConfirmationService } from './HighRiskConfirmationService.js';

export type PermissionMetadataValue = string | number | boolean | null | Record<string, unknown> | unknown[];

type CreatePermissionInput = {
  task_id?: string | null;
  executor: string;
  kind: string;
  scope?: PermissionScope;
  workspace?: string | null;
  requested_value?: string | null;
  resolved_value?: string | null;
  reason: string;
  requested_by?: string | null;
  metadata?: Record<string, PermissionMetadataValue>;
};

type PermissionPatch = {
  scope?: PermissionScope;
  workspace?: string | null;
  requested_value?: string | null;
  resolved_value?: string | null;
  reason?: string;
  decision_note?: string | null;
  metadata?: Record<string, PermissionMetadataValue>;
  /** @deprecated Ignored — TOTP removed from product. */
  approval_code?: string | null;
  totp?: string | null;
  code?: string | null;
};

export class PermissionService {
  private repo: PermissionRepository;
  private initialized = false;
  private configVersioning = new ConfigVersioningService();
  private telemetryRuntime: TelemetryRuntimeService | null;
  private highRisk: HighRiskConfirmationService;

  constructor(
    repo?: PermissionRepository,
    telemetryRuntime?: TelemetryRuntimeService | null,
    highRiskConfirmation?: HighRiskConfirmationService,
  ) {
    this.repo = repo || new PermissionRepository();
    this.telemetryRuntime = telemetryRuntime || null;
    this.highRisk = highRiskConfirmation || new HighRiskConfirmationService();
  }

  public async createRequest(input: CreatePermissionInput): Promise<PermissionRequest> {
    await this.ensureInit();
    const metadataMatch = this.buildMetadataMatch(input.executor, input.kind, input.metadata);

    const existing = this.repo.findPendingMatch(
      input.executor,
      input.kind,
      input.workspace || null,
      input.requested_value || null,
      input.task_id || null,
      metadataMatch,
    );
    if (existing) {
      await this.recordPermissionEvent(existing, 'permission.reused_pending', 'reused_pending');
      return existing;
    }

    const now = new Date().toISOString();
    const permission: PermissionRequest = {
      permission_id: uuidv4(),
      created_at: now,
      updated_at: now,
      task_id: input.task_id || null,
      executor: input.executor,
      kind: input.kind,
      status: 'pending',
      scope: input.scope || 'once',
      workspace: input.workspace || null,
      requested_value: input.requested_value || null,
      resolved_value: input.resolved_value || null,
      reason: input.reason,
      requested_by: input.requested_by || null,
      decided_by: null,
      decision_note: null,
      metadata: this.normalizePermissionMetadata(
        input.executor,
        input.kind,
        input.metadata || {},
        input.requested_value || null,
        input.resolved_value || null,
      ),
    };

    this.repo.save(permission);
    void this.configVersioning.snapshot(`permission-create:${permission.executor}:${permission.kind}`);
    await this.recordPermissionEvent(permission, 'permission.created', 'pending');
    return permission;
  }

  public async listRequests(status: PermissionStatus | 'all' = 'pending', limit: number = 20): Promise<PermissionRequest[]> {
    await this.ensureInit();
    return this.repo.list(status, limit);
  }

  public async getRequest(permissionId: string): Promise<PermissionRequest | undefined> {
    await this.ensureInit();
    return this.repo.getById(permissionId);
  }

  public async updateRequest(permissionId: string, patch: PermissionPatch): Promise<PermissionRequest> {
    await this.ensureInit();
    const existing = this.getExistingPermission(permissionId);
    const updated = this.buildUpdatedPermission(existing, patch);

    this.repo.save(updated);
    void this.configVersioning.snapshot(`permission-update:${existing.executor}:${existing.kind}`);
    await this.recordPermissionEvent(updated, 'permission.updated', 'updated');
    return updated;
  }

  public async approveRequest(
    permissionId: string,
    decidedBy: string | null,
    patch: PermissionPatch = {},
  ): Promise<PermissionRequest> {
    await this.ensureInit();
    const existing = this.getExistingPermission(permissionId);
    const meta =
      existing.metadata && typeof existing.metadata === 'object'
        ? (existing.metadata as Record<string, unknown>)
        : {};
    const rawRiskLevel = meta.riskLevel ?? meta.risk_level ?? meta.risk;
    const riskLevel =
      typeof rawRiskLevel === 'string' || typeof rawRiskLevel === 'number'
        ? rawRiskLevel
        : null;
    const gate = this.highRisk.assertApprovalGate({
      risk: {
        riskLevel,
        requiresHighRiskPin: Boolean(meta.requiresHighRiskPin || meta.requires_high_risk_pin),
        metadata: meta,
      },
      approvalGranted: true,
    });
    if (!gate.ok) {
      throw new Error(this.highRisk.formatGateFailure(gate));
    }

    const updated = this.buildUpdatedPermission(existing, patch);
    const approved: PermissionRequest = {
      ...updated,
      status: 'approved',
      updated_at: new Date().toISOString(),
      decided_by: decidedBy,
      decision_note: patch.decision_note !== undefined ? patch.decision_note : updated.decision_note,
      metadata: {
        ...(updated.metadata || {}),
        highRiskGate: {
          reason: gate.reason,
          requiresTotp: false,
          highRisk: gate.highRisk,
          surface: 'permission-service',
          at: new Date().toISOString(),
        },
      },
    };
    this.repo.save(approved);
    void this.configVersioning.snapshot(`permission-approve:${approved.executor}:${approved.kind}`);
    await this.recordPermissionEvent(approved, 'permission.approved', 'approved');
    return approved;
  }

  public async rejectRequest(
    permissionId: string,
    decidedBy: string | null,
    note?: string | null,
  ): Promise<PermissionRequest> {
    await this.ensureInit();
    const existing = this.getExistingPermission(permissionId);

    const rejected: PermissionRequest = {
      ...existing,
      status: 'rejected',
      updated_at: new Date().toISOString(),
      decided_by: decidedBy,
      decision_note: note !== undefined ? note : existing.decision_note,
    };
    this.repo.save(rejected);
    void this.configVersioning.snapshot(`permission-reject:${rejected.executor}:${rejected.kind}`);
    await this.recordPermissionEvent(rejected, 'permission.rejected', 'rejected');
    return rejected;
  }

  public async grantPolicy(input: CreatePermissionInput): Promise<PermissionRequest> {
    await this.ensureInit();
    const metadataMatch = this.buildMetadataMatch(input.executor, input.kind, input.metadata);

    const effectiveValue = input.resolved_value || input.requested_value || null;
    const existing = this.repo.findApprovedMatch(
      input.executor,
      input.kind,
      input.workspace || null,
      effectiveValue,
      metadataMatch,
    );

    if (existing) {
      const refreshed: PermissionRequest = {
        ...existing,
        updated_at: new Date().toISOString(),
        scope: input.scope || existing.scope,
        workspace: input.workspace !== undefined ? input.workspace : existing.workspace,
        requested_value: input.requested_value !== undefined ? input.requested_value : existing.requested_value,
        resolved_value: input.resolved_value !== undefined ? input.resolved_value : existing.resolved_value,
        reason: input.reason || existing.reason,
        requested_by: input.requested_by || existing.requested_by,
        decided_by: input.requested_by || existing.decided_by,
        metadata: this.normalizePermissionMetadata(
          existing.executor,
          existing.kind,
          { ...(existing.metadata || {}), ...(input.metadata || {}) },
          input.requested_value !== undefined ? input.requested_value : existing.requested_value,
          input.resolved_value !== undefined ? input.resolved_value : existing.resolved_value,
        ),
      };
      this.repo.save(refreshed);
      void this.configVersioning.snapshot(`permission-refresh:${refreshed.executor}:${refreshed.kind}`);
      await this.recordPermissionEvent(refreshed, 'permission.policy_refreshed', 'approved');
      return refreshed;
    }

    const now = new Date().toISOString();
    const granted: PermissionRequest = {
      permission_id: uuidv4(),
      created_at: now,
      updated_at: now,
      task_id: input.task_id || null,
      executor: input.executor,
      kind: input.kind,
      status: 'approved',
      scope: input.scope || 'persistent',
      workspace: input.workspace || null,
      requested_value: input.requested_value || null,
      resolved_value: input.resolved_value || null,
      reason: input.reason,
      requested_by: input.requested_by || null,
      decided_by: input.requested_by || null,
      decision_note: 'Politica aprovada diretamente pelo operador.',
      metadata: this.normalizePermissionMetadata(
        input.executor,
        input.kind,
        input.metadata || {},
        input.requested_value || null,
        input.resolved_value || null,
      ),
    };

    this.repo.save(granted);
    void this.configVersioning.snapshot(`permission-grant:${granted.executor}:${granted.kind}`);
    await this.recordPermissionEvent(granted, 'permission.policy_granted', 'approved');
    return granted;
  }

  public async findApprovedRequest(
    executor: string,
    kind: string,
    workspace: string | null,
    metadataMatch?: Record<string, PermissionMetadataValue>,
  ): Promise<PermissionRequest | undefined> {
    await this.ensureInit();
    return this.repo.findApproved(executor, kind, workspace, metadataMatch);
  }

  public async listApprovedRequests(
    executor?: string,
    kind?: string,
    workspace?: string | null,
    metadataMatch?: Record<string, PermissionMetadataValue>,
  ): Promise<PermissionRequest[]> {
    await this.ensureInit();
    return this.repo.listApproved(executor, kind, workspace, metadataMatch);
  }

  public async findApprovedExternalExecutorBinding(
    workspace: string | null,
    agentRole: string | null,
    metadataMatch?: Record<string, PermissionMetadataValue>,
  ): Promise<PermissionRequest | undefined> {
    const normalizedRole = this.normalizeAgentRole(agentRole);
    const exact = await this.findApprovedRequest('external_executor', 'agent_binding', workspace, {
      agent_role: normalizedRole,
      ...(metadataMatch || {}),
    });
    if (exact) {
      return exact;
    }

    if (normalizedRole === 'default') {
      return this.findApprovedRequest('external_executor', 'agent_binding', workspace, metadataMatch);
    }

    return undefined;
  }

  private buildMetadataMatch(
    executor: string,
    kind: string,
    metadata?: Record<string, PermissionMetadataValue>,
  ): Record<string, PermissionMetadataValue> | undefined {
    if (executor !== 'external_executor' || kind !== 'agent_binding') {
      return undefined;
    }

    const normalizedRole = this.normalizeAgentRole(metadata?.agent_role);
    return { agent_role: normalizedRole };
  }

  private normalizeAgentRole(value: unknown): string {
    const normalized = String(value || '').trim().toLowerCase();
    return normalized || 'default';
  }

  private async ensureInit(): Promise<void> {
    if (this.initialized) {
      return;
    }

    await this.repo.init();
    this.initialized = true;
  }

  private getExistingPermission(permissionId: string): PermissionRequest {
    const existing = this.repo.getById(permissionId);
    if (!existing) {
      throw new Error(`Pedido de permissao ${permissionId} nao encontrado.`);
    }

    return existing;
  }

  private buildUpdatedPermission(existing: PermissionRequest, patch: PermissionPatch): PermissionRequest {
    return {
      ...existing,
      updated_at: new Date().toISOString(),
      scope: patch.scope || existing.scope,
      workspace: patch.workspace !== undefined ? patch.workspace : existing.workspace,
      requested_value: patch.requested_value !== undefined ? patch.requested_value : existing.requested_value,
      resolved_value: patch.resolved_value !== undefined ? patch.resolved_value : existing.resolved_value,
      reason: patch.reason || existing.reason,
      decision_note: patch.decision_note !== undefined ? patch.decision_note : existing.decision_note,
      metadata: this.normalizePermissionMetadata(
        existing.executor,
        existing.kind,
        patch.metadata ? { ...(existing.metadata || {}), ...patch.metadata } : existing.metadata,
        patch.requested_value !== undefined ? patch.requested_value : existing.requested_value,
        patch.resolved_value !== undefined ? patch.resolved_value : existing.resolved_value,
      ),
    };
  }

  private normalizePermissionMetadata(
    executor: string,
    kind: string,
    metadata: Record<string, PermissionMetadataValue> | undefined,
    requestedValue: string | null,
    resolvedValue: string | null,
  ): Record<string, PermissionMetadataValue> {
    const nextMetadata: Record<string, PermissionMetadataValue> = { ...(metadata || {}) };

    if (kind === 'workspace_access') {
      nextMetadata.access_level = this.normalizeAccessLevel(
        nextMetadata.access_level || nextMetadata.access || nextMetadata.mode,
      );
    }

    if (kind === 'command_access') {
      nextMetadata.match_type = this.normalizeCommandMatchType(
        nextMetadata.match_type ||
          nextMetadata.match ||
          nextMetadata.command_match ||
          this.inferMatchTypeFromValue(resolvedValue || requestedValue || ''),
      );
    }

    if (executor === 'external_executor' && kind === 'workspace_access') {
      nextMetadata.policy_family = 'scoped_path_access';
    }

    if (executor === 'file_delivery' && kind === 'workspace_access') {
      nextMetadata.policy_family = 'scoped_file_read';
    }

    if (!nextMetadata.traceId && !nextMetadata.trace_id) {
      if (typeof nextMetadata.task_id === 'string' && nextMetadata.task_id.trim().length > 0) {
        nextMetadata.traceId = `task:${nextMetadata.task_id.trim()}`;
      } else if (typeof nextMetadata.permission_id === 'string' && nextMetadata.permission_id.trim().length > 0) {
        nextMetadata.traceId = `permission:${nextMetadata.permission_id.trim()}`;
      }
    }

    return nextMetadata;
  }

  private normalizeAccessLevel(value: unknown): PermissionAccessLevel {
    const normalized = String(value || '').trim().toLowerCase();
    if (
      normalized === 'read_write' ||
      normalized === 'write' ||
      normalized === 'rw' ||
      normalized === 'readwrite'
    ) {
      return 'read_write';
    }

    return 'read_only';
  }

  private normalizeCommandMatchType(value: unknown): PermissionCommandMatchType {
    const normalized = String(value || '').trim().toLowerCase();
    if (normalized === 'prefix' || normalized === 'starts_with' || normalized === 'startswith') {
      return 'prefix';
    }

    return 'exact';
  }

  private inferMatchTypeFromValue(value: string): PermissionCommandMatchType {
    const normalized = String(value || '').trim();
    if (normalized.endsWith('*')) {
      return 'prefix';
    }

    return 'exact';
  }

  private async recordPermissionEvent(
    permission: PermissionRequest,
    eventType: string,
    status: string,
  ): Promise<void> {
    if (!this.telemetryRuntime) {
      return;
    }

    try {
      await this.telemetryRuntime.record({
        traceId: this.resolveTraceId(permission),
        source: 'permission-service',
        eventType,
        status,
        payload: {
          permissionId: permission.permission_id,
          taskId: permission.task_id,
          executor: permission.executor,
          kind: permission.kind,
          scope: permission.scope,
          workspace: permission.workspace,
          requestedValue: permission.requested_value,
          resolvedValue: permission.resolved_value,
          requestedBy: permission.requested_by,
          decidedBy: permission.decided_by,
        },
      });
    } catch (error: unknown) {// telemetry should never break permission flow
      logger.warn('[Permission] process execution failed', error);
    }
  }

  private resolveTraceId(permission: PermissionRequest): string {
    const candidates = [
      permission.metadata?.traceId,
      permission.metadata?.trace_id,
      permission.task_id ? `task:${permission.task_id}` : null,
      permission.permission_id ? `permission:${permission.permission_id}` : null,
    ];

    for (const candidate of candidates) {
      const normalized = String(candidate || '').trim();
      if (normalized) {
        return normalized;
      }
    }

    return 'permission:unknown';
  }
}
