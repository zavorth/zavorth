import type { CapabilityImportManifest } from './CapabilityImportContract.js';

export const CAPABILITY_PACK_CATALOG_CONTRACT_VERSION = 'zavorth-capability-pack-catalog/v1';

export type CapabilityPackCategory =
  | 'channels'
  | 'providers'
  | 'tools'
  | 'skills'
  | 'operations';

export type CapabilityPackDefinition = {
  id: string;
  label: string;
  summary: string;
  category: CapabilityPackCategory;
  tags: string[];
  official: true;
  manifest: CapabilityImportManifest;
};

export type CapabilityPackCatalogQuery = {
  packId?: string | null;
  category?: CapabilityPackCategory | null;
  includeManifests?: boolean;
};

export type CapabilityPackCatalogSnapshot = {
  contractVersion: typeof CAPABILITY_PACK_CATALOG_CONTRACT_VERSION;
  generatedAt: string;
  policy: {
    canonicalRoot: 'zavorth-core/Zavorth';
    officialPacksOnly: true;
    externalRootsAllowed: false;
    importsMustUseCapabilityImporter: true;
    liveActivationByDefault: false;
    secretsSerialized: false;
  };
  query: {
    packId: string | null;
    category: CapabilityPackCategory | null;
  };
  summary: {
    packs: number;
    visible: number;
    manifestItems: number;
    categories: number;
  };
  packs: CapabilityPackDefinition[];
  selected: CapabilityPackDefinition | null;
  manifests: CapabilityImportManifest[];
  narrative: {
    headline: string;
    operatorSummary: string;
    nextAction: string;
  };
};
