import fs from 'fs';
import path from 'path';
import { resolveZavorthLocalStateFile } from '../../config/localStatePaths.js';
import type { NodeMeshCapabilityId } from '../../contracts/NodeMeshContract.js';

export type CapabilityId = NodeMeshCapabilityId;
export type DevicePolicyRiskLevel = 'low' | 'medium' | 'high';
export type DevicePolicySource = 'manual' | 'pairing-credentials';

export interface DevicePolicy {
  nodeId: string;
  allowedCapabilities: CapabilityId[];
  autoApproveRiskLevel: DevicePolicyRiskLevel;
  source: DevicePolicySource;
  updatedAt: string;
  notes: string[];
}

type DevicePolicyState = {
  version: number;
  updatedAt: string;
  policies: Record<string, DevicePolicy>;
};

type DeviceCapabilityPolicyOptions = {
  policyFile?: string;
  now?: () => Date;
};

type DevicePolicyInput = {
  allowedCapabilities?: Array<CapabilityId | null | undefined> | null;
  autoApproveRiskLevel?: DevicePolicyRiskLevel | null;
  source?: DevicePolicySource | null;
  notes?: Array<string | null | undefined> | null;
};

type DevicePolicySyncInput = {
  nodeId: string;
  capabilityIds?: Array<CapabilityId | null | undefined> | null;
  approvedCapabilityIds?: Array<CapabilityId | null | undefined> | null;
  source?: DevicePolicySource | null;
  notes?: Array<string | null | undefined> | null;
};

const DEFAULT_POLICY_STATE = (): DevicePolicyState => ({
  version: 1,
  updatedAt: new Date(0).toISOString(),
  policies: {},
});

export class DeviceCapabilityPolicy {
  private readonly policyFile: string;
  private readonly now: () => Date;
  private policies: Map<string, DevicePolicy> = new Map();

  constructor(options: DeviceCapabilityPolicyOptions = {}) {
    this.policyFile = path.resolve(
      options.policyFile || resolveZavorthLocalStateFile('device-capability-policy.json'),
    );
    this.now = options.now || (() => new Date());
  }

  public loadPolicies(): DevicePolicy[] {
    const state = this.readState();
    this.policies = new Map(
      Object.values(state.policies).map((policy) => [policy.nodeId, this.normalizePolicy(policy.nodeId, policy)]),
    );
    return this.listPolicies();
  }

  public listPolicies(): DevicePolicy[] {
    if (this.policies.size === 0 && fs.existsSync(this.policyFile)) {
      this.loadPolicies();
    }
    return Array.from(this.policies.values()).sort((left, right) => left.nodeId.localeCompare(right.nodeId));
  }

  public readPolicy(nodeId: string): DevicePolicy | null {
    const normalizedNodeId = normalizeNodeId(nodeId);
    if (!normalizedNodeId) {
      return null;
    }
    if (this.policies.size === 0 && fs.existsSync(this.policyFile)) {
      this.loadPolicies();
    }
    return this.policies.get(normalizedNodeId) || null;
  }

  public resolveAllowedCapabilities(
    nodeId: string,
    fallbackCapabilities: Array<CapabilityId | null | undefined> = [],
  ): CapabilityId[] {
    const policy = this.readPolicy(nodeId);
    if (policy && policy.allowedCapabilities.length > 0) {
      return [...policy.allowedCapabilities];
    }
    return normalizeCapabilities(fallbackCapabilities);
  }

  public isCapabilityAllowed(nodeId: string, capability: CapabilityId): boolean {
    const normalizedCapability = String(capability || '').trim();
    if (!normalizedCapability) {
      return false;
    }

    const policy = this.readPolicy(nodeId);
    if (!policy) {
      return false;
    }
    return policy.allowedCapabilities.includes(normalizedCapability);
  }

  public setPolicy(nodeId: string, policy: DevicePolicyInput): DevicePolicy {
    const normalizedNodeId = normalizeNodeId(nodeId);
    if (!normalizedNodeId) {
      throw new Error('nodeId obrigatorio para persistir policy do device.');
    }

    const existing = this.readPolicy(normalizedNodeId);
    const allowedCapabilities = policy.allowedCapabilities !== undefined
      ? normalizeCapabilities(policy.allowedCapabilities || [])
      : (existing?.allowedCapabilities || []);
    const notes = policy.notes !== undefined
      ? normalizeNotes(policy.notes || [])
      : (existing?.notes || []);
    const next: DevicePolicy = this.normalizePolicy(normalizedNodeId, {
      allowedCapabilities,
      autoApproveRiskLevel: policy.autoApproveRiskLevel ?? existing?.autoApproveRiskLevel ?? 'low',
      source: policy.source ?? existing?.source ?? 'manual',
      notes,
      updatedAt: this.now().toISOString(),
    });

    this.policies.set(normalizedNodeId, next);
    this.persist();
    return next;
  }

  public syncFromCapabilities(input: DevicePolicySyncInput): DevicePolicy {
    const declared = normalizeCapabilities(input.capabilityIds || []);
    const approved = normalizeCapabilities(input.approvedCapabilityIds || []);
    const allowedCapabilities = approved.length > 0 ? approved : declared;
    const notes = normalizeNotes(input.notes || []);

    if (notes.length === 0) {
      notes.push(
        approved.length > 0
          ? 'Allowlist local sincronizada a partir das capabilities aprovadas no pareamento.'
          : 'Allowlist local sincronizada a partir das capabilities declaradas do device node.',
      );
    }

    return this.setPolicy(input.nodeId, {
      allowedCapabilities,
      autoApproveRiskLevel: inferRiskLevel(allowedCapabilities),
      source: input.source || 'pairing-credentials',
      notes,
    });
  }

  private normalizePolicy(nodeId: string, policy: Partial<DevicePolicy>): DevicePolicy {
    const allowedCapabilities = normalizeCapabilities(policy.allowedCapabilities || []);
    return {
      nodeId: normalizeNodeId(nodeId),
      allowedCapabilities,
      autoApproveRiskLevel: normalizeRiskLevel(policy.autoApproveRiskLevel, inferRiskLevel(allowedCapabilities)),
      source: policy.source === 'pairing-credentials' ? 'pairing-credentials' : 'manual',
      updatedAt: String(policy.updatedAt || this.now().toISOString()),
      notes: normalizeNotes(policy.notes || []),
    };
  }

  private readState(): DevicePolicyState {
    try {
      if (!fs.existsSync(this.policyFile)) {
        return DEFAULT_POLICY_STATE();
      }
      const parsed = JSON.parse(fs.readFileSync(this.policyFile, 'utf8'));
      if (!parsed || typeof parsed !== 'object' || typeof parsed.policies !== 'object') {
        return DEFAULT_POLICY_STATE();
      }
      return {
        version: Number(parsed.version || 1) || 1,
        updatedAt: String(parsed.updatedAt || this.now().toISOString()),
        policies: parsed.policies as Record<string, DevicePolicy>,
      };
    } catch {
      return DEFAULT_POLICY_STATE();
    }
  }

  private persist(): void {
    const state: DevicePolicyState = {
      version: 1,
      updatedAt: this.now().toISOString(),
      policies: Object.fromEntries(
        Array.from(this.policies.entries()).sort(([left], [right]) => left.localeCompare(right)),
      ),
    };
    fs.mkdirSync(path.dirname(this.policyFile), { recursive: true });
    fs.writeFileSync(this.policyFile, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
  }
}

function normalizeNodeId(input: string): string {
  return String(input || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function normalizeCapabilities(
  entries: Array<CapabilityId | null | undefined>,
): CapabilityId[] {
  return Array.from(
    new Set(
      entries
        .map((entry) => String(entry || '').trim())
        .filter(Boolean),
    ),
  );
}

function normalizeNotes(entries: Array<string | null | undefined>): string[] {
  return Array.from(
    new Set(
      entries
        .map((entry) => String(entry || '').trim())
        .filter(Boolean),
    ),
  );
}

function normalizeRiskLevel(
  input: DevicePolicyRiskLevel | null | undefined,
  fallback: DevicePolicyRiskLevel,
): DevicePolicyRiskLevel {
  return input === 'low' || input === 'medium' || input === 'high'
    ? input
    : fallback;
}

function inferRiskLevel(capabilityIds: CapabilityId[]): DevicePolicyRiskLevel {
  const capabilities = new Set(capabilityIds);
  if (capabilities.has('system.run')) {
    return 'high';
  }
  if (
    capabilities.has('browser.proxy')
    || capabilities.has('files.write')
    || capabilities.has('camera.capture')
    || capabilities.has('location.read')
    || capabilities.has('screen.capture')
    || capabilities.has('clipboard.read')
    || capabilities.has('clipboard.write')
  ) {
    return 'medium';
  }
  return 'low';
}
