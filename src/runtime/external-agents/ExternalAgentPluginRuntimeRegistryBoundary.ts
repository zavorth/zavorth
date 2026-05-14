import type {
  UniversalToolRiskLevel,
} from '../agent/UniversalAgentRuntimeTypes.js';
import type {
  ImportedCapabilityTrustState,
} from '../agent/security/index.js';
import {
  ExternalAgentCapabilityProvider,
  type ExternalAgentCapabilityInventorySnapshot,
} from './ExternalAgentCapabilityProvider.js';
import type {
  ExternalAgentAdapter,
  ExternalAgentCapabilityDescriptor,
} from './contracts.js';

export type ExternalAgentPluginRuntimeRegistryRecordKind =
  | 'tool'
  | 'http-route'
  | 'service'
  | 'gateway-method'
  | 'cli-command';

export type ExternalAgentPluginRuntimeRegistrySourceEvidence = {
  sourceRuntimeName?: string;
  sourcePaths: string[];
  observedAt: string;
  notes?: string[];
};

export type ExternalAgentPluginRuntimeRegistryRecord = {
  fixtureCase?: string;
  id: string;
  label: string;
  kind: ExternalAgentPluginRuntimeRegistryRecordKind;
  tools?: string[];
  risk?: UniversalToolRiskLevel;
  trustState?: ImportedCapabilityTrustState;
  route?: string;
  sourceEvidence?: ExternalAgentPluginRuntimeRegistrySourceEvidence;
};

export type ExternalAgentPluginRuntimeRegistryMetadataOnlyRecord = {
  id: string;
  label: string;
  kind: Exclude<ExternalAgentPluginRuntimeRegistryRecordKind, 'tool'>;
  canonicalMetadataId: string;
  executionAuthorized: false;
  exposedToToolPolicy: false;
  route?: string;
};

export type ExternalAgentPluginRuntimeRegistryNormalization = {
  nativeContract: 'ExternalAgentCapabilityInventorySnapshot';
  inventory: ExternalAgentCapabilityInventorySnapshot;
  metadataOnlyRecords: ExternalAgentPluginRuntimeRegistryMetadataOnlyRecord[];
  capabilityRecordIds: string[];
  blockedToolNames: string[];
  sourceRuntimeRegistryIntroduced: false;
  sourceRuntimeImplementationsLoaded: false;
  sourceRuntimeExecutionAuthority: false;
};

export type ExternalAgentPluginRuntimeRegistryBoundaryOptions = {
  records: ExternalAgentPluginRuntimeRegistryRecord[];
  createAdapter: (capabilities: ExternalAgentCapabilityDescriptor[]) => ExternalAgentAdapter;
  now?: () => Date;
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

function capabilityFromRegistryRecord(
  record: ExternalAgentPluginRuntimeRegistryRecord,
): ExternalAgentCapabilityDescriptor {
  return {
    id: record.id,
    label: record.label,
    kind: 'tool',
    summary: 'Runtime registry capability metadata imported through Zavorth policy.',
    risk: record.risk || 'unknown',
    trustState: record.trustState || 'quarantined',
    toolNames: uniqueStrings(record.tools || [`external.${record.id}`]),
    inventoryEvidence: {
      sourceRuntimeName: record.sourceEvidence?.sourceRuntimeName,
      sourceCapabilityName: record.id,
      rawKind: record.kind,
      observedAt: normalizeText(record.sourceEvidence?.observedAt),
      notes: record.sourceEvidence?.sourcePaths.map((sourcePath) => `source:${sourcePath}`),
    },
    metadata: {
      registryRecordKind: record.kind,
      executionAuthorized: false,
      route: record.route,
    },
  };
}

function metadataOnlyRecordFromRegistryRecord(
  record: ExternalAgentPluginRuntimeRegistryRecord,
): ExternalAgentPluginRuntimeRegistryMetadataOnlyRecord {
  return {
    id: record.id,
    label: record.label,
    kind: record.kind as Exclude<ExternalAgentPluginRuntimeRegistryRecordKind, 'tool'>,
    canonicalMetadataId: `external-registry-metadata:${normalizeId(record.id, 'record')}`,
    executionAuthorized: false,
    exposedToToolPolicy: false,
    route: record.route,
  };
}

export async function normalizeExternalAgentPluginRuntimeRegistry(
  options: ExternalAgentPluginRuntimeRegistryBoundaryOptions,
): Promise<ExternalAgentPluginRuntimeRegistryNormalization> {
  const capabilityRecords = options.records.filter((record) => record.kind === 'tool');
  const metadataOnlyRecords = options.records
    .filter((record) => record.kind !== 'tool')
    .map(metadataOnlyRecordFromRegistryRecord);
  const adapter = options.createAdapter(capabilityRecords.map(capabilityFromRegistryRecord));
  const provider = new ExternalAgentCapabilityProvider({
    adapter,
    now: options.now,
  });
  const inventory = await provider.buildInventory();

  return {
    nativeContract: 'ExternalAgentCapabilityInventorySnapshot',
    inventory,
    metadataOnlyRecords,
    capabilityRecordIds: capabilityRecords.map((record) => record.id),
    blockedToolNames: inventory.toolExposurePolicyInput.blockedTools || [],
    sourceRuntimeRegistryIntroduced: false,
    sourceRuntimeImplementationsLoaded: false,
    sourceRuntimeExecutionAuthority: false,
  };
}
