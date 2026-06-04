import {
  RuntimeAdapterCapabilityProvider,
  type RuntimeAdapterCapabilityInventorySnapshot,
  type RuntimeAdapterSkillManifest,
} from './RuntimeAdapterCapabilityProvider.js';
import type {
  RuntimeAdapterAdapter,
} from './contracts.js';

export type RuntimeAdapterPluginManifestRegistryEvidence = {
  id: string;
  sourceCapabilityName?: string;
  sourceManifestPath?: string;
  sourceRuntimeName?: string;
  publicContractStored: false;
  implementationLoaded: false;
};

export type RuntimeAdapterPluginManifestRegistryNormalization = {
  nativeContract: 'RuntimeAdapterCapabilityInventorySnapshot';
  inventory: RuntimeAdapterCapabilityInventorySnapshot;
  manifestEvidence: RuntimeAdapterPluginManifestRegistryEvidence[];
  disabledManifestIds: string[];
  exposedToolNames: string[];
  sourceManifestRegistryIntroduced: false;
  sourceManifestImplementationsLoaded: false;
};

export type RuntimeAdapterPluginManifestRegistryBoundaryOptions = {
  adapter: RuntimeAdapterAdapter;
  manifests: RuntimeAdapterSkillManifest[];
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

function manifestEvidenceFor(
  manifest: RuntimeAdapterSkillManifest,
): RuntimeAdapterPluginManifestRegistryEvidence {
  return {
    id: normalizeId(manifest.id || manifest.name || manifest.title, 'external-skill'),
    sourceCapabilityName: manifest.sourceCapabilityName || manifest.name || manifest.id,
    sourceManifestPath: manifest.sourceManifestPath,
    sourceRuntimeName: manifest.sourceRuntimeName,
    publicContractStored: false,
    implementationLoaded: false,
  };
}

export async function normalizeRuntimeAdapterPluginManifestRegistry(
  options: RuntimeAdapterPluginManifestRegistryBoundaryOptions,
): Promise<RuntimeAdapterPluginManifestRegistryNormalization> {
  const provider = new RuntimeAdapterCapabilityProvider({
    adapter: options.adapter,
    now: options.now,
  });
  const inventory = await provider.buildInventory({
    skillManifests: options.manifests,
  });

  return {
    nativeContract: 'RuntimeAdapterCapabilityInventorySnapshot',
    inventory,
    manifestEvidence: options.manifests.map(manifestEvidenceFor),
    disabledManifestIds: inventory.items
      .filter((item) => item.status === 'unavailable')
      .map((item) => item.id),
    exposedToolNames: inventory.toolExposurePolicyInput.requestedTools || [],
    sourceManifestRegistryIntroduced: false,
    sourceManifestImplementationsLoaded: false,
  };
}
