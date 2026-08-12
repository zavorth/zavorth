import { ZAVORTH_EXTENSION_API_VERSION } from '../contracts/ZavorthExtensionContract.js';
import type { ZavorthExtensionRegistryService } from './ZavorthExtensionRegistryService.js';

export type ZavorthRoleComposition =
  | 'specialist'
  | 'verifier'
  | 'researcher'
  | 'executor'
  | 'critic'
  | 'observer'
  | 'background'
  | 'tree'
  | 'team'
  | 'swarm'
  | 'kanban';

export type ZavorthRoleFilesystemMode = 'none' | 'readonly' | 'workspace-read' | 'workspace-write';

export type ZavorthRoleNetworkMode = 'none' | 'trusted-only' | 'allowed';

export type ZavorthRoleCapabilityScope = {
  filesystem: string;
  network: string;
  capabilityIds: string[];
  toolIds: string[];
  surfaces: string[];
};

export type ZavorthRoleBudget = {
  maxToolCalls: number;
  maxWallClockMs: number;
  maxOutputBytes: number;
  maxNetworkCalls: number;
};

export type ZavorthRoleApprovalBoundary = {
  required: boolean;
  requiredFor: string[];
};

export type ZavorthRoleEvidence = {
  requiredKinds: string[];
  minimumCount: number;
  verifierRoleIds: string[];
  independentVerifierRequired: boolean;
};

export type ZavorthRoleLifecycle = {
  cancellable: boolean;
  resumable: boolean;
  pausable: boolean;
  terminalStates: string[];
  allowedTransitions: string[];
};

export type ZavorthRoleDescriptor = {
  id: string;
  label: string;
  composition: ZavorthRoleComposition;
  mandate: string;
  capabilityScope: ZavorthRoleCapabilityScope;
  budget: ZavorthRoleBudget;
  approvalBoundary: ZavorthRoleApprovalBoundary;
  evidence: ZavorthRoleEvidence;
  lifecycle: ZavorthRoleLifecycle;
  tags: string[];
};

export type ZavorthRoleCertificationFinding = {
  code: string;
  message: string;
  path?: string | null;
};

export type ZavorthRoleCertification = {
  status: 'certified' | 'rejected';
  findings: ZavorthRoleCertificationFinding[];
};

export type ZavorthRoleLifecycleChallenge = {
  id: string;
  action: 'activate' | 'resume' | 'cancel' | 'pause' | 'complete';
  issuedAt: string;
};

type StoredRoleRecord = {
  descriptor: ZavorthRoleDescriptor;
  lifecycleState: 'registered' | 'active' | 'paused' | 'cancelled' | 'completed';
  challenges: Map<string, ZavorthRoleLifecycleChallenge>;
};

const MIN_MANDATE_LENGTH = 12;

const VALID_FILESYSTEM_MODES: ReadonlySet<string> = new Set(['none', 'readonly', 'workspace-read', 'workspace-write']);

const WRITE_FILESYSTEM_MODES: ReadonlySet<string> = new Set(['workspace-write']);

const VALID_TERMINAL_STATES: ReadonlySet<string> = new Set(['registered', 'active', 'paused', 'cancelled', 'completed']);

const VALID_TRANSITIONS: ReadonlySet<string> = new Set(['activate', 'resume', 'cancel', 'pause', 'complete']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function cloneValue<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => cloneValue(item)) as unknown as T;
  }
  if (isRecord(value)) {
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(value)) {
      result[key] = cloneValue(value[key]);
    }
    return result as unknown as T;
  }
  return value;
}

function normalizeId(value: unknown): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_.:-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function makeDescriptor(
  input: {
    id: string;
    label: string;
    composition: ZavorthRoleComposition;
    mandate: string;
    filesystem: ZavorthRoleFilesystemMode;
    capabilityIds: string[];
    maxToolCalls: number;
    writeAccess: boolean;
  },
): ZavorthRoleDescriptor {
  const approvalBoundary: ZavorthRoleApprovalBoundary = input.writeAccess
    ? { required: true, requiredFor: ['filesystem.write'] }
    : { required: false, requiredFor: [] };
  const isVerifier = input.id === 'verifier';
  const evidence: ZavorthRoleEvidence = isVerifier
    ? { requiredKinds: ['test_result'], minimumCount: 1, verifierRoleIds: [], independentVerifierRequired: false }
    : {
        requiredKinds: ['test_result'],
        minimumCount: 1,
        verifierRoleIds: ['verifier'],
        independentVerifierRequired: true,
      };
  return {
    id: input.id,
    label: input.label,
    composition: input.composition,
    mandate: input.mandate,
    capabilityScope: {
      filesystem: input.filesystem,
      network: 'trusted-only',
      capabilityIds: input.capabilityIds,
      toolIds: ['read', 'search'],
      surfaces: ['terminal'],
    },
    budget: {
      maxToolCalls: input.maxToolCalls,
      maxWallClockMs: 7_200_000,
      maxOutputBytes: 8_000_000,
      maxNetworkCalls: 0,
    },
    approvalBoundary,
    evidence,
    lifecycle: {
      cancellable: true,
      resumable: true,
      pausable: true,
      terminalStates: ['completed', 'cancelled'],
      allowedTransitions: ['activate', 'resume', 'pause', 'cancel', 'complete'],
    },
    tags: ['official', 'default'],
  };
}

export function defaultRoleDescriptors(): ZavorthRoleDescriptor[] {
  const descriptors: ZavorthRoleDescriptor[] = [
    makeDescriptor({
      id: 'planner',
      label: 'Planner',
      composition: 'specialist',
      mandate: 'Break the mission into tasks, risks, dependencies, acceptance criteria, and clear handoffs.',
      filesystem: 'workspace-read',
      capabilityIds: ['role.planner'],
      maxToolCalls: 10,
      writeAccess: false,
    }),
    makeDescriptor({
      id: 'researcher',
      label: 'Researcher',
      composition: 'researcher',
      mandate: 'Collect evidence, files, context, and facts while working in read-only mode and citing gaps.',
      filesystem: 'readonly',
      capabilityIds: ['role.researcher'],
      maxToolCalls: 12,
      writeAccess: false,
    }),
    makeDescriptor({
      id: 'implementer',
      label: 'Implementer',
      composition: 'executor',
      mandate: 'Propose or execute permitted implementation while keeping scope, rollback, and diffs small.',
      filesystem: 'workspace-write',
      capabilityIds: ['role.implementer'],
      maxToolCalls: 16,
      writeAccess: true,
    }),
    makeDescriptor({
      id: 'verifier',
      label: 'Verifier',
      composition: 'verifier',
      mandate: 'Validate tests, regression risk, security, acceptance criteria, and operational risks.',
      filesystem: 'readonly',
      capabilityIds: ['role.verifier'],
      maxToolCalls: 12,
      writeAccess: false,
    }),
    makeDescriptor({
      id: 'critic',
      label: 'Critic',
      composition: 'critic',
      mandate: 'Look for risks, improper permission use, secret leaks, and actions performed without approval.',
      filesystem: 'readonly',
      capabilityIds: ['role.critic'],
      maxToolCalls: 10,
      writeAccess: false,
    }),
    makeDescriptor({
      id: 'observer',
      label: 'Observer',
      composition: 'observer',
      mandate: 'Watch execution passively, gather evidence, and report deviations without mutating state.',
      filesystem: 'readonly',
      capabilityIds: ['role.observer'],
      maxToolCalls: 8,
      writeAccess: false,
    }),
    makeDescriptor({
      id: 'background',
      label: 'Background',
      composition: 'background',
      mandate: 'Run background maintenance and housekeeping tasks with a bounded low-priority budget.',
      filesystem: 'workspace-write',
      capabilityIds: ['role.background'],
      maxToolCalls: 8,
      writeAccess: true,
    }),
    makeDescriptor({
      id: 'tree',
      label: 'Tree',
      composition: 'tree',
      mandate: 'Fan out a single mission into a tree of sub-tasks and consolidate deterministic outcomes.',
      filesystem: 'workspace-read',
      capabilityIds: ['role.tree'],
      maxToolCalls: 14,
      writeAccess: false,
    }),
    makeDescriptor({
      id: 'team',
      label: 'Team',
      composition: 'team',
      mandate: 'Coordinate a team of specialist roles and keep shared context consistent across the mission.',
      filesystem: 'workspace-read',
      capabilityIds: ['role.team'],
      maxToolCalls: 14,
      writeAccess: false,
    }),
    makeDescriptor({
      id: 'swarm',
      label: 'Swarm',
      composition: 'swarm',
      mandate: 'Coordinate parallel worker roles, fan out batches, and consolidate results deterministically.',
      filesystem: 'workspace-read',
      capabilityIds: ['role.swarm'],
      maxToolCalls: 18,
      writeAccess: false,
    }),
    makeDescriptor({
      id: 'kanban',
      label: 'Kanban',
      composition: 'kanban',
      mandate: 'Manage the task board, queueing, dependencies, and the flow of work across the team.',
      filesystem: 'workspace-read',
      capabilityIds: ['role.kanban'],
      maxToolCalls: 14,
      writeAccess: false,
    }),
  ];
  return descriptors.map((descriptor) => cloneValue(descriptor));
}

export class ZavorthRoleRegistryService {
  private readonly records = new Map<string, StoredRoleRecord>();

  private readonly now: () => Date;

  constructor(options: { includeDefaults?: boolean; now?: () => Date } = {}) {
    this.now = options.now || (() => new Date());
    if (options.includeDefaults !== false) {
      for (const descriptor of defaultRoleDescriptors()) {
        this.store(descriptor);
      }
    }
  }

  public certify(descriptor: ZavorthRoleDescriptor): ZavorthRoleCertification {
    const findings: ZavorthRoleCertificationFinding[] = [];
    const add = (code: string, message: string, path?: string | null): void => {
      findings.push({ code, message, path: path ?? null });
    };

    const id = normalizeId(descriptor?.id);
    if (!id) {
      add('id_invalid', 'Role id must not be empty.', 'id');
    }

    const mandate = descriptor?.mandate;
    if (typeof mandate === 'string' && mandate.trim().length < MIN_MANDATE_LENGTH) {
      add('mandate_incomplete', `Role mandate must be at least ${MIN_MANDATE_LENGTH} characters.`, 'mandate');
    }

    const capabilityScope = descriptor?.capabilityScope;
    if (capabilityScope && typeof capabilityScope === 'object') {
      if (!VALID_FILESYSTEM_MODES.has(String(capabilityScope.filesystem ?? ''))) {
        add('filesystem_invalid', `filesystem mode ${String(capabilityScope.filesystem ?? '')} is unsupported.`, 'capabilityScope.filesystem');
      }
      if (String(capabilityScope.network ?? '') === 'allowed') {
        add('network_trust_required', 'Network access requires an explicit trust boundary.', 'capabilityScope.network');
      }

      const capabilityIds = Array.isArray(capabilityScope.capabilityIds) ? capabilityScope.capabilityIds : [];
      const seenCapability = new Set<string>();
      for (const capabilityId of capabilityIds) {
        const normalized = normalizeId(capabilityId);
        if (!normalized) {
          add('capability_id_empty', 'Capability ids must not be empty.', 'capabilityScope.capabilityIds');
        } else if (seenCapability.has(normalized)) {
          add('capability_id_duplicate', `Duplicate capability id ${normalized}.`, 'capabilityScope.capabilityIds');
        } else {
          seenCapability.add(normalized);
        }
      }

      const toolIds = Array.isArray(capabilityScope.toolIds) ? capabilityScope.toolIds : [];
      const seenTool = new Set<string>();
      for (const toolId of toolIds) {
        const normalized = normalizeId(toolId);
        if (normalized) {
          if (seenTool.has(normalized)) {
            add('tool_id_duplicate', `Duplicate tool id ${normalized}.`, 'capabilityScope.toolIds');
          }
          seenTool.add(normalized);
        }
      }

      const surfaces = Array.isArray(capabilityScope.surfaces) ? capabilityScope.surfaces : [];
      for (const surface of surfaces) {
        if (!normalizeId(surface)) {
          add('surface_id_empty', 'Surface ids must not be empty.', 'capabilityScope.surfaces');
        }
      }
    }

    const budget = descriptor?.budget;
    if (budget && typeof budget === 'object') {
      const values = [budget.maxToolCalls, budget.maxWallClockMs, budget.maxOutputBytes, budget.maxNetworkCalls];
      const invalid = values.some((value) => !Number.isFinite(value) || !Number.isInteger(value) || Number(value) < 0);
      if (invalid) {
        add('budget_invalid', 'Budget limits must be finite non-negative integers.', 'budget');
      }
    }

    const approvalBoundary = descriptor?.approvalBoundary;
    if (approvalBoundary && typeof approvalBoundary === 'object') {
      if (typeof approvalBoundary.required !== 'boolean') {
        add('approval_required_invalid', 'approvalBoundary.required must be a boolean.', 'approvalBoundary.required');
      }
      const requiredFor = Array.isArray(approvalBoundary.requiredFor) ? approvalBoundary.requiredFor : [];
      if (approvalBoundary.required === false && requiredFor.length > 0) {
        add('approval_inconsistent', 'Approval cannot be disabled while actions still require approval.', 'approvalBoundary');
      }
      if (
        capabilityScope &&
        typeof capabilityScope === 'object' &&
        WRITE_FILESYSTEM_MODES.has(String(capabilityScope.filesystem ?? '')) &&
        approvalBoundary.required !== true
      ) {
        add('write_approval_missing', 'Write-capable filesystem access must be approval gated.', 'approvalBoundary');
      }
    } else if (
      capabilityScope &&
      typeof capabilityScope === 'object' &&
      WRITE_FILESYSTEM_MODES.has(String(capabilityScope.filesystem ?? ''))
    ) {
      add('write_approval_missing', 'Write-capable filesystem access must be approval gated.', 'approvalBoundary');
    }

    const evidence = descriptor?.evidence;
    if (evidence && typeof evidence === 'object') {
      const requiredKinds = Array.isArray(evidence.requiredKinds) ? evidence.requiredKinds : [];
      const seenKind = new Set<string>();
      for (const requiredKind of requiredKinds) {
        const normalized = normalizeId(requiredKind);
        if (!normalized) {
          add('evidence-kind_id_empty', 'Required evidence kinds must not be empty.', 'evidence.requiredKinds');
        } else if (seenKind.has(normalized)) {
          add('evidence-kind_id_duplicate', `Duplicate required evidence kind ${normalized}.`, 'evidence.requiredKinds');
        } else {
          seenKind.add(normalized);
        }
      }
      if (
        typeof evidence.minimumCount !== 'number' ||
        !Number.isFinite(evidence.minimumCount) ||
        !Number.isInteger(evidence.minimumCount) ||
        evidence.minimumCount < 1
      ) {
        add('evidence_invalid', 'evidence.minimumCount must be a positive integer.', 'evidence.minimumCount');
      }
      const verifierRoleIds = Array.isArray(evidence.verifierRoleIds) ? evidence.verifierRoleIds : [];
      const ownNormalized = normalizeId(descriptor?.id);
      const hasSelf = verifierRoleIds.some((verifierId) => normalizeId(verifierId) === ownNormalized && Boolean(ownNormalized));
      if (hasSelf) {
        add('self_verification_forbidden', 'A role must not verify itself.', 'evidence.verifierRoleIds');
      }
      const distinctVerifiers = verifierRoleIds
        .map((verifierId) => normalizeId(verifierId))
        .filter((verifierId, index, values) => Boolean(verifierId) && values.indexOf(verifierId) === index && verifierId !== ownNormalized);
      if (evidence.independentVerifierRequired === true && distinctVerifiers.length === 0) {
        add('independent_verifier_missing', 'Independent verification requires at least one distinct verifier role.', 'evidence');
      }
    }

    const lifecycle = descriptor?.lifecycle;
    if (lifecycle && typeof lifecycle === 'object') {
      if (
        typeof lifecycle.cancellable !== 'boolean' ||
        typeof lifecycle.resumable !== 'boolean' ||
        typeof lifecycle.pausable !== 'boolean'
      ) {
        add('lifecycle_invalid', 'Lifecycle capability flags must be booleans.', 'lifecycle');
      }
      const terminalStates = Array.isArray(lifecycle.terminalStates) ? lifecycle.terminalStates : [];
      const seenTerminal = new Set<string>();
      for (const terminalState of terminalStates) {
        const normalized = normalizeId(terminalState);
        if (!VALID_TERMINAL_STATES.has(normalized)) {
          add('lifecycle_invalid', `Unknown terminal state ${String(terminalState)}.`, 'lifecycle.terminalStates');
        }
        if (normalized) {
          if (seenTerminal.has(normalized)) {
            add('transitions_inconsistent', `Duplicate terminal state ${normalized}.`, 'lifecycle.terminalStates');
          }
          seenTerminal.add(normalized);
        }
      }
      if (terminalStates.length === 0) {
        add('lifecycle_invalid', 'Lifecycle must declare at least one terminal state.', 'lifecycle.terminalStates');
      }
      const allowedTransitions = Array.isArray(lifecycle.allowedTransitions) ? lifecycle.allowedTransitions : [];
      const seenTransition = new Set<string>();
      for (const transition of allowedTransitions) {
        const normalized = normalizeId(transition);
        if (!VALID_TRANSITIONS.has(normalized)) {
          add('transitions_invalid', `Unknown transition ${String(transition)}.`, 'lifecycle.allowedTransitions');
        }
        if (normalized) {
          if (seenTransition.has(normalized)) {
            add('transitions_inconsistent', `Duplicate transition ${normalized}.`, 'lifecycle.allowedTransitions');
            add('transitions_invalid', `Duplicate transition ${normalized}.`, 'lifecycle.allowedTransitions');
          }
          seenTransition.add(normalized);
        }
      }
      if (allowedTransitions.length === 0) {
        add('transitions_invalid', 'Lifecycle must declare allowed transitions.', 'lifecycle.allowedTransitions');
      }
    } else if (lifecycle === undefined) {
      add('lifecycle_invalid', 'Lifecycle configuration is required.', 'lifecycle');
      add('transitions_invalid', 'Lifecycle configuration is required.', 'lifecycle');
    }

    const tags = Array.isArray(descriptor?.tags) ? descriptor.tags : [];
    const seenSelection = new Set<string>();
    for (const tag of tags) {
      const text = String(tag || '');
      if (text.startsWith('default-selection:')) {
        const rawPriority = text.slice('default-selection:'.length).trim();
        const priority = Number(rawPriority);
        if (!rawPriority || !Number.isInteger(priority) || priority < 1) {
          add('selection_priority_invalid', `Invalid default-selection priority ${text}.`, 'tags');
        }
        if (seenSelection.has(text)) {
          add('selection_priority_invalid', `Duplicate default-selection tag ${text}.`, 'tags');
        }
        seenSelection.add(text);
      }
    }

    return {
      status: findings.length === 0 ? 'certified' : 'rejected',
      findings,
    };
  }

  public register(descriptor: ZavorthRoleDescriptor): ZavorthRoleDescriptor {
    const certification = this.certify(descriptor);
    if (certification.status !== 'certified') {
      throw new Error(
        `role_certification_rejected: ${certification.findings.map((finding) => finding.code).join(', ')}`,
      );
    }
    return this.store(cloneValue(descriptor));
  }

  public get(id: string): ZavorthRoleDescriptor | undefined {
    const record = this.records.get(normalizeId(id));
    return record ? cloneValue(record.descriptor) : undefined;
  }

  public list(): ZavorthRoleDescriptor[] {
    return Array.from(this.records.values()).map((record) => cloneValue(record.descriptor));
  }

  public issueLifecycleChallenge(
    id: string,
    action: ZavorthRoleLifecycleChallenge['action'],
  ): ZavorthRoleLifecycleChallenge {
    const record = this.requireRole(id);
    const challengeId = `${action}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const challenge: ZavorthRoleLifecycleChallenge = {
      id: challengeId,
      action,
      issuedAt: this.now().toISOString(),
    };
    record.challenges.set(challengeId, challenge);
    return cloneValue(challenge);
  }

  public activate(id: string, challengeId?: string): string {
    const record = this.requireRole(id);
    if (record.lifecycleState === 'completed' || record.lifecycleState === 'cancelled') {
      throw new Error('Use resume for terminal states');
    }
    this.consumeChallenge(record, challengeId, 'activate');
    record.lifecycleState = 'active';
    return 'active';
  }

  public resume(id: string, challengeId?: string): string {
    const record = this.requireRole(id);
    this.consumeChallenge(record, challengeId, 'resume');
    record.lifecycleState = 'active';
    return 'active';
  }

  public pause(id: string): string {
    const record = this.requireRole(id);
    record.lifecycleState = 'paused';
    return 'paused';
  }

  public cancel(id: string): string {
    const record = this.requireRole(id);
    if (record.lifecycleState === 'registered') {
      throw new Error('cannot cancel from registered');
    }
    record.lifecycleState = 'cancelled';
    return 'cancelled';
  }

  public complete(id: string): string {
    const record = this.requireRole(id);
    record.lifecycleState = 'completed';
    return 'completed';
  }

  public registerExtension(extensions: ZavorthExtensionRegistryService, roleId: string): void {
    const descriptor = this.get(roleId);
    if (!descriptor) {
      throw new Error(`role_not_registered: ${roleId}`);
    }
    const normalizedRoleId = normalizeId(roleId);
    extensions.register({
      manifest: {
        schemaVersion: ZAVORTH_EXTENSION_API_VERSION,
        id: `role.${normalizedRoleId}`,
        label: descriptor.label,
        version: '1.0.0',
        summary: `Zavorth role "${normalizedRoleId}" exposed as a governed extension contribution.`,
        source: { kind: 'workspace', locator: `role:${normalizedRoleId}`, trusted: true },
        compatibility: {
          zavorthVersion: '>=2',
          extensionApiVersion: ZAVORTH_EXTENSION_API_VERSION,
        },
        contributions: [
          {
            id: normalizedRoleId,
            kind: 'verifier',
            exportName: 'run',
            capabilityIds: [normalizedRoleId, `${normalizedRoleId}.run`],
          },
        ],
        permissions: [],
        policy: {
          defaultTrust: 'review',
          requiresApproval: true,
          allowNetworkByDefault: false,
          allowFilesystemWriteByDefault: false,
          allowProcessSpawnByDefault: false,
          sandboxProfile: 'restricted',
        },
      },
      handlers: {
        run: () => ({ id: descriptor.id, composition: descriptor.composition }),
      },
    });
  }

  private store(descriptor: ZavorthRoleDescriptor): ZavorthRoleDescriptor {
    const id = normalizeId(descriptor.id);
    const existing = this.records.get(id);
    const record: StoredRoleRecord = {
      descriptor: cloneValue(descriptor),
      lifecycleState: existing?.lifecycleState ?? 'registered',
      challenges: existing?.challenges ?? new Map(),
    };
    this.records.set(id, record);
    return cloneValue(record.descriptor);
  }

  private requireRole(id: string): StoredRoleRecord {
    const record = this.records.get(normalizeId(id));
    if (!record) {
      throw new Error(`role_not_registered: ${id}`);
    }
    return record;
  }

  private consumeChallenge(
    record: StoredRoleRecord,
    challengeId: string | undefined,
    action: ZavorthRoleLifecycleChallenge['action'],
  ): void {
    if (!challengeId) {
      throw new Error('requires approval');
    }
    const challenge = record.challenges.get(challengeId);
    if (!challenge || challenge.action !== action) {
      throw new Error('requires approval');
    }
    record.challenges.delete(challengeId);
  }
}
