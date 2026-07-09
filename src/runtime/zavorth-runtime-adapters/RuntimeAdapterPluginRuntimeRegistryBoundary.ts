import type {
  UniversalToolRiskLevel,
} from '../agent/UniversalAgentRuntimeTypes.js';
import type {
  ImportedCapabilityTrustState,
} from '../agent/security/index.js';
import {
  RuntimeAdapterCapabilityProvider,
  type RuntimeAdapterCapabilityInventorySnapshot,
} from './RuntimeAdapterCapabilityProvider.js';

import type {
  RuntimeAdapterAdapter,
  RuntimeAdapterCapabilityDescriptor,
} from './contracts.js';

export type RuntimeAdapterPluginRuntimeRegistryRecordKind =
  | 'tool'
  | 'http-route'
  | 'service'
  | 'gateway-method'
  | 'cli-command';

export type RuntimeAdapterPluginRuntimeRegistrySourceEvidence = {
  sourceRuntimeName?: string;
  sourcePaths: string[];
  observedAt: string;
  notes?: string[];
};

export type RuntimeAdapterPluginRuntimeRegistryRecord = {
  fixtureCase?: string;
  id: string;
  label: string;
  kind: RuntimeAdapterPluginRuntimeRegistryRecordKind;
  tools?: string[];
  risk?: UniversalToolRiskLevel;
  trustState?: ImportedCapabilityTrustState;
  route?: string;
  sourceEvidence?: RuntimeAdapterPluginRuntimeRegistrySourceEvidence;
};

export type RuntimeAdapterPluginRuntimeRegistryMetadataOnlyRecord = {
  id: string;
  label: string;
  kind: Exclude<RuntimeAdapterPluginRuntimeRegistryRecordKind, 'tool'>;
  canonicalMetadataId: string;
  executionAuthorized: false;
  exposedToToolPolicy: false;
  route?: string;
};

export type RuntimeAdapterPluginRuntimeRegistryNormalization = {
  nativeContract: 'RuntimeAdapterCapabilityInventorySnapshot';
  inventory: RuntimeAdapterCapabilityInventorySnapshot;
  metadataOnlyRecords: RuntimeAdapterPluginRuntimeRegistryMetadataOnlyRecord[];
  capabilityRecordIds: string[];
  blockedToolNames: string[];
  sourceRuntimeRegistryIntroduced: false;
  sourceRuntimeImplementationsLoaded: false;
  sourceRuntimeExecutionAuthority: false;
};

export type RuntimeAdapterPluginRuntimeRegistryBoundaryOptions = {
  records: RuntimeAdapterPluginRuntimeRegistryRecord[];
  createAdapter: (capabilities: RuntimeAdapterCapabilityDescriptor[]) => RuntimeAdapterAdapter;
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
  record: RuntimeAdapterPluginRuntimeRegistryRecord,
): RuntimeAdapterCapabilityDescriptor {
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
  record: RuntimeAdapterPluginRuntimeRegistryRecord,
): RuntimeAdapterPluginRuntimeRegistryMetadataOnlyRecord {
  return {
    id: record.id,
    label: record.label,
    kind: record.kind as Exclude<RuntimeAdapterPluginRuntimeRegistryRecordKind, 'tool'>,
    canonicalMetadataId: `external-registry-metadata:${normalizeId(record.id, 'record')}`,
    executionAuthorized: false,
    exposedToToolPolicy: false,
    route: record.route,
  };
}

export async function normalizeRuntimeAdapterPluginRuntimeRegistry(
  options: RuntimeAdapterPluginRuntimeRegistryBoundaryOptions,
): Promise<RuntimeAdapterPluginRuntimeRegistryNormalization> {
  const capabilityRecords = options.records.filter((record) => record.kind === 'tool');
  const metadataOnlyRecords = options.records
    .filter((record) => record.kind !== 'tool')
    .map(metadataOnlyRecordFromRegistryRecord);
  const adapter = options.createAdapter(capabilityRecords.map(capabilityFromRegistryRecord));
  const provider = new RuntimeAdapterCapabilityProvider({
    adapter,
    now: options.now,
  });
  const inventory = await provider.buildInventory();

  return {
    nativeContract: 'RuntimeAdapterCapabilityInventorySnapshot',
    inventory,
    metadataOnlyRecords,
    capabilityRecordIds: capabilityRecords.map((record) => record.id),
    blockedToolNames: inventory.toolExposurePolicyInput.blockedTools || [],
    sourceRuntimeRegistryIntroduced: false,
    sourceRuntimeImplementationsLoaded: false,
    sourceRuntimeExecutionAuthority: false,
  };
}
