import {
  ExternalAgentCapabilityProvider,
  type ExternalAgentCapabilityInventorySnapshot,
  type ExternalAgentSkillManifest,
} from './ExternalAgentCapabilityProvider.js';
import type {
  ExternalAgentAdapter,
} from './contracts.js';

export type ExternalAgentPluginManifestRegistryEvidence = {
  id: string;
  sourceCapabilityName?: string;
  sourceManifestPath?: string;
  sourceRuntimeName?: string;
  publicContractStored: false;
  implementationLoaded: false;
};

export type ExternalAgentPluginManifestRegistryNormalization = {
  nativeContract: 'ExternalAgentCapabilityInventorySnapshot';
  inventory: ExternalAgentCapabilityInventorySnapshot;
  manifestEvidence: ExternalAgentPluginManifestRegistryEvidence[];
  disabledManifestIds: string[];
  exposedToolNames: string[];
  sourceManifestRegistryIntroduced: false;
  sourceManifestImplementationsLoaded: false;
};

export type ExternalAgentPluginManifestRegistryBoundaryOptions = {
  adapter: ExternalAgentAdapter;
  manifests: ExternalAgentSkillManifest[];
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
  manifest: ExternalAgentSkillManifest,
): ExternalAgentPluginManifestRegistryEvidence {
  return {
    id: normalizeId(manifest.id || manifest.name || manifest.title, 'external-skill'),
    sourceCapabilityName: manifest.sourceCapabilityName || manifest.name || manifest.id,
    sourceManifestPath: manifest.sourceManifestPath,
    sourceRuntimeName: manifest.sourceRuntimeName,
    publicContractStored: false,
    implementationLoaded: false,
  };
}

export async function normalizeExternalAgentPluginManifestRegistry(
  options: ExternalAgentPluginManifestRegistryBoundaryOptions,
): Promise<ExternalAgentPluginManifestRegistryNormalization> {
  const provider = new ExternalAgentCapabilityProvider({
    adapter: options.adapter,
    now: options.now,
  });
  const inventory = await provider.buildInventory({
    skillManifests: options.manifests,
  });

  return {
    nativeContract: 'ExternalAgentCapabilityInventorySnapshot',
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
