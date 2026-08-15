import path from 'node:path';
import type {
  ConversationalPermissionRequest,
  TrustSliderLevel,
  TrustSliderPermissionBoundary,
  TrustSliderPolicyDecision,
  TrustSliderPolicyDecisionStatus,
  TrustSliderPolicySnapshot,
  TrustSliderReceipt,
  TrustSliderReceiptDirection,
  TrustSliderRuntimeProfile,
  TrustSliderSandboxTier,
  UniversalIntentContextHints,
  UniversalIntentPermissionScope,
  UniversalIntentSafetyClassification,
  UniversalIntentSideEffect,
  UniversalIntentTrustMode,
  UniversalIntentUserRole,
} from './UniversalIntentContracts.js';

export type TrustSliderPolicyInput = {
  level?: UniversalIntentTrustMode | null;
  previousLevel?: UniversalIntentTrustMode | null;
  userRole?: UniversalIntentUserRole | null;
  ownerConfirmed?: boolean | null;
  killSwitchActive?: boolean | null;
  workspaceRoot?: string | null;
  targetPath?: string | null;
  hostScopeRequested?: boolean | null;
  requestedTools?: string[] | null;
  classification?: UniversalIntentSafetyClassification | null;
  permissionRequest?: ConversationalPermissionRequest | null;
  contextHints?: UniversalIntentContextHints | null;
  reason?: string | null;
};

type TrustSliderSnapshotTemplate = {
  runtimeProfile: TrustSliderRuntimeProfile;
  sandboxTier: TrustSliderSandboxTier;
  permissionBoundary: TrustSliderPermissionBoundary;
  hostAllowed: boolean;
  workspaceRequired: boolean;
  ownerOrOperatorRequired: boolean;
  killSwitchRequired: boolean;
  auditTrailRequired: boolean;
  selfModificationPreviewRequired: boolean;
  summary: string;
};

type TrustSliderDerivedSignals = {
  requestedTools: string[];
  sideEffect: UniversalIntentSideEffect;
  mutation: boolean;
  shell: boolean;
  externalSideEffect: boolean;
  destructive: boolean;
  operatorRequired: boolean;
  selfModificationPreview: boolean;
  selfModificationMutation: boolean;
  governedOperatorTool: boolean;
  hostScopeRequested: boolean;
};

const LEVEL_ORDER: Record<TrustSliderLevel, number> = {
  protected: 0,
  collaborator: 1,
  overlord: 2,
};

const SNAPSHOT_TEMPLATES: Record<TrustSliderLevel, TrustSliderSnapshotTemplate> = {
  protected: {
    runtimeProfile: 'safe-core',
    sandboxTier: 'safe-core',
    permissionBoundary: 'container-first',
    hostAllowed: false,
    workspaceRequired: true,
    ownerOrOperatorRequired: false,
    killSwitchRequired: false,
    auditTrailRequired: true,
    selfModificationPreviewRequired: true,
    summary: 'Protected uses safe/core with container-first sandbox and blocks broad host access.',
  },
  collaborator: {
    runtimeProfile: 'trusted-workspace',
    sandboxTier: 'workspace-scoped',
    permissionBoundary: 'workspace-scoped',
    hostAllowed: false,
    workspaceRequired: true,
    ownerOrOperatorRequired: false,
    killSwitchRequired: false,
    auditTrailRequired: true,
    selfModificationPreviewRequired: true,
    summary: 'Collaborator uses an approved workspace and requires new permission to escape it.',
  },
  overlord: {
    runtimeProfile: 'owner-operator',
    sandboxTier: 'host-scoped',
    permissionBoundary: 'host-scoped',
    hostAllowed: true,
    workspaceRequired: false,
    ownerOrOperatorRequired: true,
    killSwitchRequired: true,
    auditTrailRequired: true,
    selfModificationPreviewRequired: false,
    summary: 'Overlord allows host-scoped access only with owner/operator, kill switch, and audit trail.',
  },
};

function normalizeText(value: unknown, fallback = ''): string {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function normalizeLevel(value: unknown): TrustSliderLevel {
  const normalized = normalizeText(value).toLowerCase();
  if (normalized === 'protected' || normalized === 'collaborator' || normalized === 'overlord') {
    return normalized;
  }
  return 'collaborator';
}

function normalizeLevelOrNull(value: unknown): TrustSliderLevel | null {
  const normalized = normalizeText(value).toLowerCase();
  if (normalized === 'protected' || normalized === 'collaborator' || normalized === 'overlord') {
    return normalized;
  }
  return null;
}

function normalizeTools(values: unknown): string[] {
  if (!Array.isArray(values)) {
    return [];
  }
  return Array.from(new Set(
    values.map((value) => normalizeText(value)).filter(Boolean),
  ));
}

function hasTool(tools: string[], toolId: string): boolean {
  const target = toolId.toLowerCase();
  return tools.some((tool) => tool.toLowerCase() === target);
}

function hasAnyTool(tools: string[], candidates: string[]): boolean {
  const normalized = new Set(candidates.map((tool) => tool.toLowerCase()));
  return tools.some((tool) => normalized.has(tool.toLowerCase()));
}

function bool(value: unknown): boolean {
  return value === true || value === 'true' || value === 1 || value === '1';
}

export class TrustSliderPolicyService {
  private readonly now: () => Date;
  private readonly idFactory: (prefix: string) => string;

  constructor(runtime: {
    now?: () => Date;
    idFactory?: (prefix: string) => string;
  } = {}) {
    this.now = runtime.now || (() => new Date());
    this.idFactory = runtime.idFactory || ((prefix) => `${prefix}-${this.now().getTime().toString(36)}`);
  }

  public buildSnapshot(input: TrustSliderLevel | {
    level?: TrustSliderLevel | null;
    generatedAt?: string | null;
  } = 'collaborator'): TrustSliderPolicySnapshot {
    const level = typeof input === 'string' ? normalizeLevel(input) : normalizeLevel(input.level);
    const generatedAt = typeof input === 'string'
      ? this.now().toISOString()
      : normalizeText(input.generatedAt, this.now().toISOString());
    const template = SNAPSHOT_TEMPLATES[level];
    return {
      schemaVersion: 1,
      generatedAt,
      level,
      runtimeProfile: template.runtimeProfile,
      sandboxTier: template.sandboxTier,
      permissionBoundary: template.permissionBoundary,
      hostAllowed: template.hostAllowed,
      workspaceRequired: template.workspaceRequired,
      ownerOrOperatorRequired: template.ownerOrOperatorRequired,
      killSwitchRequired: template.killSwitchRequired,
      auditTrailRequired: template.auditTrailRequired,
      selfModificationPreviewRequired: template.selfModificationPreviewRequired,
      summary: template.summary,
      controls: {
        explicitElevationRequired: level !== 'protected',
        workspaceEscapeRequiresPermission: level === 'collaborator',
        hostMutationBlocked: !template.hostAllowed,
        rollbackExpected: level !== 'overlord',
      },
    };
  }

  public evaluate(input: TrustSliderPolicyInput = {}): TrustSliderPolicyDecision {
    const generatedAt = this.now().toISOString();
    const level = normalizeLevel(input.level);
    const previousLevel = normalizeLevelOrNull(input.previousLevel);
    const snapshot = this.buildSnapshot({ level, generatedAt });
    const derived = this.deriveSignals(input);
    const workspaceRoot = this.resolveWorkspaceRoot(input);
    const targetPath = this.resolveTargetPath(input);
    const workspaceEscape = level === 'collaborator'
      && Boolean(workspaceRoot && targetPath)
      && !this.isWithinWorkspace(targetPath, workspaceRoot);
    const ownerOrOperator = this.isOwnerOrOperator(input.userRole) || bool(input.ownerConfirmed);
    const killSwitchActive = bool(input.killSwitchActive);
    const permissionNeeded = this.requiresPermission(input, derived);
    const previewRequired = this.resolvePreviewRequired(level, input, derived);
    const permissionScope = this.resolvePermissionScope(input.permissionRequest, permissionNeeded);
    const policy = this.resolveDecision({
      level,
      snapshot,
      derived,
      workspaceEscape,
      ownerOrOperator,
      killSwitchActive,
      permissionNeeded,
      previewRequired,
    });
    const receipt = this.buildReceipt({
      generatedAt,
      previousLevel,
      level,
      reason: normalizeText(input.reason, policy.reason),
      sandboxTier: snapshot.sandboxTier,
      permissionScope,
      auditTrailRequired: snapshot.auditTrailRequired,
      killSwitchRequired: snapshot.killSwitchRequired,
      previewRequired,
    });

    return {
      schemaVersion: 1,
      generatedAt,
      level,
      decision: policy.decision,
      reason: policy.reason,
      sandboxTier: snapshot.sandboxTier,
      permissionBoundary: snapshot.permissionBoundary,
      permissionScope,
      hostAllowed: snapshot.hostAllowed,
      workspaceRoot: workspaceRoot || null,
      targetPath: targetPath || null,
      previewRequired,
      approvalRequired: policy.decision === 'requires_permission' || Boolean(input.permissionRequest?.approvalRequired),
      auditTrailRequired: snapshot.auditTrailRequired,
      killSwitchRequired: snapshot.killSwitchRequired,
      ownerOrOperatorRequired: snapshot.ownerOrOperatorRequired,
      blocked: policy.decision === 'block',
      blockReason: policy.decision === 'block' ? policy.reason : null,
      snapshot,
      receipt,
      enforcement: {
        source: 'TrustSliderPolicyService',
        centralEnforcement: true,
        explicitElevationRequired: receipt.direction === 'elevation',
      },
    };
  }

  private resolveDecision(input: {
    level: TrustSliderLevel;
    snapshot: TrustSliderPolicySnapshot;
    derived: TrustSliderDerivedSignals;
    workspaceEscape: boolean;
    ownerOrOperator: boolean;
    killSwitchActive: boolean;
    permissionNeeded: boolean;
    previewRequired: boolean;
  }): {
    decision: TrustSliderPolicyDecisionStatus;
    reason: string;
  } {
    if (input.level === 'protected') {
      if (input.derived.hostScopeRequested) {
        return {
          decision: 'block',
          reason: 'Protected mode blocks the entire host; it operates in safe/core container-first.',
        };
      }
      if (input.derived.destructive && !input.derived.governedOperatorTool) {
        return {
          decision: 'block',
          reason: 'Protected mode blocks destructive operation without explicit elevation.',
        };
      }
      if (input.derived.operatorRequired && !input.derived.governedOperatorTool) {
        return {
          decision: 'block',
          reason: 'Protected mode blocks operator control without explicit elevation.',
        };
      }
      if (input.permissionNeeded || input.previewRequired || input.derived.shell || input.derived.externalSideEffect) {
        return {
          decision: 'requires_permission',
          reason: 'Protected mode requires preview/permission before any effect outside direct response.',
        };
      }
    }

    if (input.level === 'collaborator') {
      if (input.derived.hostScopeRequested) {
        return {
          decision: 'block',
          reason: 'Collaborator mode does not authorize the whole host; use new permission/elevation.',
        };
      }
      if (input.workspaceEscape) {
        return {
          decision: 'block',
          reason: 'Collaborator mode blocks paths outside the approved workspace.',
        };
      }
      if (input.derived.operatorRequired && !input.derived.governedOperatorTool) {
        return {
          decision: 'block',
          reason: 'Collaborator mode blocks operator control without Overlord.',
        };
      }
      if (input.permissionNeeded || input.previewRequired) {
        return {
          decision: 'requires_permission',
          reason: 'Collaborator mode requires permission inside the approved workspace.',
        };
      }
    }

    if (input.level === 'overlord') {
      if (!input.ownerOrOperator) {
        return {
          decision: 'block',
          reason: 'Overlord mode requires owner/operator before any execution.',
        };
      }
      if (!input.killSwitchActive) {
        return {
          decision: 'block',
          reason: 'Overlord mode requires an active kill switch and audit trail.',
        };
      }
      if (input.permissionNeeded || input.derived.hostScopeRequested || input.derived.operatorRequired) {
        return {
          decision: 'requires_permission',
          reason: 'Released Overlord mode requires an audit trail and explicit approval.',
        };
      }
    }

    return {
      decision: 'allow',
      reason: input.snapshot.summary,
    };
  }

  private deriveSignals(input: TrustSliderPolicyInput): TrustSliderDerivedSignals {
    const classification = input.classification || null;
    const requestedTools = Array.from(new Set([
      ...normalizeTools(input.requestedTools),
      ...normalizeTools(classification?.capabilityRequired),
      ...normalizeTools(classification?.signals.requestedTools),
      ...normalizeTools(input.permissionRequest?.requestedTools),
    ]));
    const sideEffect = classification?.sideEffect || this.inferSideEffectFromTools(requestedTools);
    const selfModificationPreview = hasTool(requestedTools, 'selfmod.preview');
    const selfModificationMutation = hasAnyTool(requestedTools, ['selfmod.apply', 'selfmod.rollback']);
    const governedOperatorTool = hasAnyTool(requestedTools, [
      'selfmod.preview',
      'selfmod.apply',
      'selfmod.rollback',
      'watchmode.control',
    ]);
    const shell = Boolean(classification?.signals.shell)
      || hasAnyTool(requestedTools, ['shell.exec', 'bash.exec', 'powershell.exec']);
    const externalSideEffect = Boolean(classification?.signals.externalSideEffect)
      || hasAnyTool(requestedTools, ['email.send', 'report.send', 'slack.send', 'telegram.send', 'publish']);
    const destructive = Boolean(classification?.signals.destructive)
      || hasAnyTool(requestedTools, ['delete_file', 'workspace.delete', 'git.reset', 'system.delete', 'selfmod.rollback']);
    const mutation = Boolean(classification?.signals.mutation)
      || hasAnyTool(requestedTools, ['write_file', 'workspace.write', 'workspace.edit', 'apply_patch', 'selfmod.preview']);
    const operatorRequired = Boolean(classification?.signals.operatorRequired)
      || hasAnyTool(requestedTools, ['watchmode.control', 'system.delete', 'selfmod.preview', 'selfmod.apply', 'selfmod.rollback']);
    return {
      requestedTools,
      sideEffect,
      mutation,
      shell,
      externalSideEffect,
      destructive,
      operatorRequired,
      selfModificationPreview,
      selfModificationMutation,
      governedOperatorTool,
      hostScopeRequested: Boolean(
        input.hostScopeRequested
        || input.contextHints?.hostScopeRequested
        || classification?.signals.hostScopeRequested
        || input.permissionRequest?.scopeBoundary.hostAllowed,
      ),
    };
  }

  private requiresPermission(
    input: TrustSliderPolicyInput,
    derived: TrustSliderDerivedSignals,
  ): boolean {
    return Boolean(
      input.permissionRequest
      || derived.mutation
      || derived.shell
      || derived.externalSideEffect
      || derived.operatorRequired
      || derived.selfModificationMutation
      || derived.sideEffect !== 'none',
    );
  }

  private resolvePreviewRequired(
    level: TrustSliderLevel,
    input: TrustSliderPolicyInput,
    derived: TrustSliderDerivedSignals,
  ): boolean {
    if (derived.selfModificationPreview && (level === 'protected' || level === 'collaborator')) {
      return true;
    }
    return Boolean(input.permissionRequest?.previewRequired || derived.sideEffect !== 'none');
  }

  private resolvePermissionScope(
    permissionRequest: ConversationalPermissionRequest | null | undefined,
    permissionNeeded: boolean,
  ): UniversalIntentPermissionScope | 'none' {
    if (permissionRequest?.scope) {
      return permissionRequest.scope;
    }
    return permissionNeeded ? 'once' : 'none';
  }

  private buildReceipt(input: {
    generatedAt: string;
    previousLevel: TrustSliderLevel | null;
    level: TrustSliderLevel;
    reason: string;
    sandboxTier: TrustSliderSandboxTier;
    permissionScope: UniversalIntentPermissionScope | 'none';
    auditTrailRequired: boolean;
    killSwitchRequired: boolean;
    previewRequired: boolean;
  }): TrustSliderReceipt {
    const direction = this.resolveDirection(input.previousLevel, input.level);
    return {
      id: this.idFactory('trust-slider-receipt'),
      generatedAt: input.generatedAt,
      fromLevel: input.previousLevel,
      toLevel: input.level,
      direction,
      reason: input.reason,
      sandboxTier: input.sandboxTier,
      permissionScope: input.permissionScope,
      auditTrailRequired: input.auditTrailRequired,
      killSwitchRequired: input.killSwitchRequired,
      previewRequired: input.previewRequired,
      rollbackCommand: direction === 'elevation' && input.previousLevel ? `trust-slider set ${input.previousLevel}`
        : null,
    };
  }

  private resolveDirection(
    previousLevel: TrustSliderLevel | null,
    level: TrustSliderLevel,
  ): TrustSliderReceiptDirection {
    if (!previousLevel || previousLevel === level) {
      return 'same';
    }
    return LEVEL_ORDER[level] > LEVEL_ORDER[previousLevel] ? 'elevation' : 'reduction';
  }

  private resolveWorkspaceRoot(input: TrustSliderPolicyInput): string {
    return normalizeText(
      input.workspaceRoot
      || input.contextHints?.workspaceRoot
      || input.contextHints?.workspacePath
      || input.permissionRequest?.scopeBoundary.workspaceRoot,
    );
  }

  private resolveTargetPath(input: TrustSliderPolicyInput): string {
    return normalizeText(
      input.targetPath
      || input.contextHints?.targetPath
      || input.permissionRequest?.scopeBoundary.targetPath,
    );
  }

  private inferSideEffectFromTools(tools: string[]): UniversalIntentSideEffect {
    if (hasAnyTool(tools, ['delete_file', 'workspace.delete', 'git.reset', 'system.delete', 'selfmod.rollback'])) {
      return 'destructive';
    }
    if (hasAnyTool(tools, ['email.send', 'report.send', 'slack.send', 'telegram.send', 'publish'])) {
      return 'external';
    }
    if (hasAnyTool(tools, ['shell.exec', 'bash.exec', 'powershell.exec', 'watchmode.control', 'selfmod.apply'])) {
      return 'system';
    }
    if (hasAnyTool(tools, ['write_file', 'workspace.write', 'workspace.edit', 'apply_patch', 'selfmod.preview'])) {
      return 'local_workspace';
    }
    return 'none';
  }

  private isOwnerOrOperator(userRole: UniversalIntentUserRole | null | undefined): boolean {
    const role = normalizeText(userRole).toLowerCase();
    return role === 'owner' || role === 'operator' || role === 'overlord';
  }

  private isWithinWorkspace(targetPath: string, workspaceRoot: string): boolean {
    const root = normalizeText(workspaceRoot);
    const target = normalizeText(targetPath);
    if (!root || !target) {
      return false;
    }
    const normalizedRoot = path.resolve(root).toLowerCase();
    const normalizedTarget = path.resolve(target).toLowerCase();
    return normalizedTarget === normalizedRoot || normalizedTarget.startsWith(`${normalizedRoot}${path.sep}`);
  }
}
