import {
  ToolExposurePolicy,
} from '../agent/ToolExposurePolicy.js';
import type {
  ToolExposurePolicyInput,
} from '../agent/ToolExposurePolicy.js';
import type {
  UniversalToolExposureProfile,
  UniversalToolRiskLevel,
} from '../agent/UniversalAgentRuntimeTypes.js';
import type {
  ImportedCapabilityTrustState,
} from '../agent/security/index.js';
import {
  buildToolExposurePolicyInputFromExternalCapabilities,
  normalizeRuntimeAdapterCapabilitiesToZavorthProviderContract,
  normalizeRuntimeAdapterCapabilityToZavorthContract,
} from './RuntimeAdapterSidecarAdapter.js';

import type {
  RuntimeAdapterAdapter,
  RuntimeAdapterCapabilityDescriptor,
  RuntimeAdapterCapabilityKind,
  RuntimeAdapterCapabilityProviderContract,
  RuntimeAdapterRuntimeDescriptor,
} from './contracts.js';

export type RuntimeAdapterCapabilityAvailability = 'available' | 'degraded' | 'unavailable';

export type RuntimeAdapterSkillManifest = {
  id?: string;
  name?: string;
  title?: string;
  description?: string;
  tools?: string[];
  risk?: UniversalToolRiskLevel;
  trustState?: ImportedCapabilityTrustState;
  enabled?: boolean;
  available?: boolean;
  requiresApproval?: boolean;
  observedAt?: string;
  sourceRuntimeName?: string;
  sourceCapabilityName?: string;
  sourceManifestPath?: string;
};

export type RuntimeAdapterCapabilityFailure = {
  id: string;
  capabilityId: string;
  reason: 'unavailable' | 'quarantined' | 'invalid-manifest';
  detail: string;
};

export type RuntimeAdapterCapabilityInventoryItem = {
  id: string;
  providerId: string;
  runtimeId: string;
  label: string;
  kind: RuntimeAdapterCapabilityKind;
  status: RuntimeAdapterCapabilityAvailability;
  risk: UniversalToolRiskLevel;
  trustState: ImportedCapabilityTrustState;
  requiresApproval: boolean;
  toolNames: string[];
  policy: {
    exposure: 'allowed' | 'approval-required' | 'blocked' | 'unavailable';
    blockedReason?: string;
  };
  summary?: string;
  diagnosticsAvailable: boolean;
  nativeContract: 'RuntimeAdapterCapabilityInventoryItem/v1';
};

export type RuntimeAdapterCapabilityZavorthControlVisibility = {
  adapterSource: {
    kind: 'universal-agent-runtime';
    label: string;
    version: string;
  };
  capabilities: Array<{
    id: string;
    capabilityId: string;
    label: string;
    risk: UniversalToolRiskLevel;
    requiresApproval: boolean;
    summary?: string;
  }>;
  integrations: Array<{
    id: string;
    label: string;
    category: 'runtime' | 'channel' | 'mcp' | 'provider' | 'unknown';
    status: 'connected' | 'degraded' | 'disabled' | 'missing';
    detail: string;
  }>;
  toolExposureProfile: UniversalToolExposureProfile;
  runtimeWarnings: string[];
};

export type RuntimeAdapterCapabilityInventorySnapshot = {
  id: string;
  runtimeId: string;
  provider: RuntimeAdapterCapabilityProviderContract;
  generatedAt: string;
  summary: {
    total: number;
    available: number;
    degraded: number;
    unavailable: number;
    approvalRequired: number;
    blocked: number;
    dangerous: number;
  };
  items: RuntimeAdapterCapabilityInventoryItem[];
  failures: RuntimeAdapterCapabilityFailure[];
  toolExposurePolicyInput: ToolExposurePolicyInput;
  toolExposureProfile: UniversalToolExposureProfile;
  zavorthControl: RuntimeAdapterCapabilityZavorthControlVisibility;
};

export type RuntimeAdapterCapabilityProviderOptions = {
  adapter: RuntimeAdapterAdapter;
  now?: () => Date;
  toolExposurePolicy?: ToolExposurePolicy;
};

function normalizeText(value: unknown, fallback = ''): string {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function normalizeId(value: unknown, fallback: string): string {
  const normalized = normalizeText(value, fallback)
    .toLowerCase()
    .replace(/[^a-z0-9._:-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || fallback;
}

function uniqueStrings(values: unknown[]): string[] {
  return Array.from(new Set(values.map((value) => normalizeText(value)).filter(Boolean)));
}

function normalizeTrustState(value: unknown): ImportedCapabilityTrustState {
  return value === 'trusted' || value === 'safe' || value === 'quarantined'
    ? value
    : 'quarantined';
}

function normalizeRisk(value: unknown): UniversalToolRiskLevel {
  return value === 'safe' || value === 'attention' || value === 'danger' || value === 'unknown'
    ? value
    : 'unknown';
}

function inferRiskFromTools(
  declaredRisk: UniversalToolRiskLevel,
  toolNames: string[],
): UniversalToolRiskLevel {
  if (declaredRisk === 'danger') {
    return 'danger';
  }

  const normalizedTools = toolNames.map((tool) => tool.toLowerCase());
  if (normalizedTools.some((tool) => (
    tool.includes('shell')
    || tool.includes('exec')
    || tool.includes('write')
    || tool.includes('delete')
    || tool.includes('deploy')
    || tool.includes('commit')
  ))) {
    return 'danger';
  }

  if (declaredRisk === 'attention') {
    return 'attention';
  }

  if (normalizedTools.some((tool) => (
    tool.includes('send')
    || tool.includes('network')
    || tool.includes('web.')
    || tool.includes('http')
  ))) {
    return 'attention';
  }

  return declaredRisk;
}

function resolveAvailability(capability: RuntimeAdapterCapabilityDescriptor): RuntimeAdapterCapabilityAvailability {
  const metadata = capability.metadata || {};
  if (metadata.available === false || metadata.availability === 'unavailable' || metadata.status === 'unavailable') {
    return 'unavailable';
  }
  if (metadata.availability === 'degraded' || metadata.status === 'degraded') {
    return 'degraded';
  }
  return 'available';
}

function capabilityToolNames(capability: RuntimeAdapterCapabilityDescriptor): string[] {
  return uniqueStrings(capability.toolNames || [`external.${normalizeId(capability.id, 'capability')}`]);
}

export class RuntimeAdapterCapabilityProvider {
  private readonly adapter: RuntimeAdapterAdapter;
  private readonly now: () => Date;
  private readonly toolExposurePolicy: ToolExposurePolicy;

  constructor(options: RuntimeAdapterCapabilityProviderOptions) {
    this.adapter = options.adapter;
    this.now = options.now || (() => new Date());
    this.toolExposurePolicy = options.toolExposurePolicy || new ToolExposurePolicy();
  }

  public importSkillManifest(manifest: RuntimeAdapterSkillManifest): RuntimeAdapterCapabilityDescriptor {
    const id = normalizeId(manifest.id || manifest.name || manifest.title, 'external-skill');
    const available = manifest.enabled === false || manifest.available === false ? false : true;
    return {
      id,
      label: normalizeText(manifest.title || manifest.name, 'External skill'),
      kind: 'skill',
      summary: normalizeText(manifest.description),
      risk: normalizeRisk(manifest.risk),
      trustState: normalizeTrustState(manifest.trustState || 'safe'),
      toolNames: uniqueStrings(manifest.tools || [`skill.${id}`]),
      requiresApproval: manifest.requiresApproval === true,
      inventoryEvidence: {
        sourceRuntimeName: manifest.sourceRuntimeName,
        sourceCapabilityName: manifest.sourceCapabilityName || manifest.name || manifest.id,
        rawKind: 'skill-manifest',
        observedAt: normalizeText(manifest.observedAt, this.now().toISOString()),
        notes: manifest.sourceManifestPath ? [`manifest:${manifest.sourceManifestPath}`] : undefined,
      },
      metadata: {
        availability: available ? 'available' : 'unavailable',
        available,
        importedFromSkillManifest: true,
      },
    };
  }

  public async buildInventory(input: {
    skillManifests?: RuntimeAdapterSkillManifest[];
  } = {}): Promise<RuntimeAdapterCapabilityInventorySnapshot> {
    const adapterCapabilities = await this.adapter.listCapabilities();
    const manifestCapabilities = (input.skillManifests || []).map((manifest) => this.importSkillManifest(manifest));
    const capabilities = [...adapterCapabilities, ...manifestCapabilities].map((capability) => (
      this.classifyCapability(capability)
    ));
    const provider = this.sanitizeProviderContract(normalizeRuntimeAdapterCapabilitiesToZavorthProviderContract(
      this.adapter.descriptor,
      capabilities.filter((capability) => resolveAvailability(capability) !== 'unavailable'),
    ));
    const items = capabilities.map((capability) => this.toInventoryItem(provider, capability));
    const availableCapabilities = capabilities.filter((capability) => resolveAvailability(capability) !== 'unavailable');
    const toolExposurePolicyInput = buildToolExposurePolicyInputFromExternalCapabilities(availableCapabilities);
    const toolExposureProfile = this.toolExposurePolicy.buildProfile(toolExposurePolicyInput);
    const failures = this.buildFailures(items);
    const summary = {
      total: items.length,
      available: items.filter((item) => item.status === 'available').length,
      degraded: items.filter((item) => item.status === 'degraded').length,
      unavailable: items.filter((item) => item.status === 'unavailable').length,
      approvalRequired: items.filter((item) => item.requiresApproval).length,
      blocked: items.filter((item) => item.policy.exposure === 'blocked').length,
      dangerous: items.filter((item) => item.risk === 'danger').length,
    };

    const snapshot: RuntimeAdapterCapabilityInventorySnapshot = {
      id: `${provider.id}:inventory`,
      runtimeId: this.adapter.descriptor.id,
      provider,
      generatedAt: this.now().toISOString(),
      summary,
      items,
      failures,
      toolExposurePolicyInput,
      toolExposureProfile,
      zavorthControl: this.buildZavorthControlVisibility(
        this.adapter.descriptor,
        items,
        toolExposureProfile,
        failures,
      ),
    };

    return snapshot;
  }

  public buildZavorthControlAdapterInput(
    snapshot: RuntimeAdapterCapabilityInventorySnapshot,
  ): RuntimeAdapterCapabilityZavorthControlVisibility {
    return snapshot.zavorthControl;
  }

  private classifyCapability(capability: RuntimeAdapterCapabilityDescriptor): RuntimeAdapterCapabilityDescriptor {
    const toolNames = capabilityToolNames(capability);
    const risk = inferRiskFromTools(capability.risk, toolNames);
    const requiresApproval = capability.requiresApproval === true
      || risk === 'danger'
      || risk === 'attention'
      || risk === 'unknown';

    return {
      ...capability,
      risk,
      toolNames,
      requiresApproval,
    };
  }

  private toInventoryItem(
    provider: RuntimeAdapterCapabilityProviderContract,
    capability: RuntimeAdapterCapabilityDescriptor,
  ): RuntimeAdapterCapabilityInventoryItem {
    const contract = normalizeRuntimeAdapterCapabilityToZavorthContract(capability);
    const status = resolveAvailability(capability);
    const blocked = capability.trustState === 'quarantined';
    const requiresApproval = capability.requiresApproval === true
      || capability.risk === 'danger'
      || capability.risk === 'attention'
      || capability.risk === 'unknown';
    const exposure: RuntimeAdapterCapabilityInventoryItem['policy']['exposure'] =
      status === 'unavailable'
        ? 'unavailable'
        : blocked ? 'blocked'
          : requiresApproval ? 'approval-required'
            : 'allowed';

    return {
      id: contract.id,
      providerId: provider.id,
      runtimeId: this.adapter.descriptor.id,
      label: contract.label,
      kind: capability.kind,
      status,
      risk: capability.risk,
      trustState: capability.trustState,
      requiresApproval,
      toolNames: contract.toolNames,
      policy: {
        exposure,
        ...(exposure === 'blocked' ? { blockedReason: 'blocked-by-external-capability-quarantine' } : {}),
        ...(exposure === 'unavailable' ? { blockedReason: 'external-capability-unavailable' } : {}),
      },
      summary: normalizeText(capability.summary) || undefined,
      diagnosticsAvailable: Boolean(capability.inventoryEvidence || this.adapter.descriptor.diagnostics),
      nativeContract: 'RuntimeAdapterCapabilityInventoryItem/v1',
    };
  }

  private sanitizeProviderContract(
    provider: RuntimeAdapterCapabilityProviderContract,
  ): RuntimeAdapterCapabilityProviderContract {
    return {
      ...provider,
      capabilities: provider.capabilities.map((capability) => ({
        ...capability,
        inventoryEvidence: undefined,
      })),
    };
  }

  private buildFailures(items: RuntimeAdapterCapabilityInventoryItem[]): RuntimeAdapterCapabilityFailure[] {
    return items.flatMap((item): RuntimeAdapterCapabilityFailure[] => {
      if (item.status === 'unavailable') {
        return [{
          id: `${item.id}:unavailable`,
          capabilityId: item.id,
          reason: 'unavailable',
          detail: `${item.label} is unavailable and was not exposed to the model.`,
        }];
      }
      if (item.policy.exposure === 'blocked') {
        return [{
          id: `${item.id}:quarantined`,
          capabilityId: item.id,
          reason: 'quarantined',
          detail: `${item.label} is quarantined and cannot be exposed until reviewed.`,
        }];
      }
      return [];
    });
  }

  private buildZavorthControlVisibility(
    runtime: RuntimeAdapterRuntimeDescriptor,
    items: RuntimeAdapterCapabilityInventoryItem[],
    toolExposureProfile: UniversalToolExposureProfile,
    failures: RuntimeAdapterCapabilityFailure[],
  ): RuntimeAdapterCapabilityZavorthControlVisibility {
    return {
      adapterSource: {
        kind: 'universal-agent-runtime',
        label: 'Zavorth External Capability Provider',
        version: 'gate-4',
      },
      capabilities: items.map((item) => ({
        id: item.id,
        capabilityId: item.id,
        label: item.label,
        risk: item.risk,
        requiresApproval: item.requiresApproval,
        summary: item.summary,
      })),
      integrations: [
        {
          id: `${runtime.id}:capabilities`,
          label: 'External capability provider',
          category: 'runtime',
          status: failures.length > 0 ? 'degraded' : 'connected',
          detail: failures.length > 0
            ? `${failures.length} external capability issue(s) require review.`
            : 'External capabilities are visible through Zavorth policy.',
        },
      ],
      toolExposureProfile,
      runtimeWarnings: failures.map((failure) => failure.detail),
    };
  }
}
