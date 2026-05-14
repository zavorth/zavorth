import type { SkillLoader } from '../../../../skills/SkillLoader.js';
import type { McpManifestLoader } from '../../../../mcp/McpManifest.js';
import type {
  ZavorthPlatformCatalogCollection,
  ZavorthPlatformCatalogEntry,
  ZavorthPlatformCatalogRecipe,
  ZavorthPlatformCatalogSourceService,
} from '../../../../services/ZavorthPlatformCatalogSourceService.js';
import type { ZavorthPlatformCatalogSyncStatus } from '../../../../services/ZavorthPlatformCatalogSyncService.js';
import type { ZavorthLearningPlaneService } from '../../../../services/ZavorthLearningPlaneService.js';
import type { ZavorthPluginRegistryService } from '../../../../services/ZavorthPluginRegistryService.js';
import type { PluginStateService } from '../../../../services/PluginStateService.js';
import type { SkillSourceRegistryService } from '../../../../services/SkillSourceRegistryService.js';
import type {
  ZavorthPlatformRegistryCollection,
  ZavorthPlatformRegistryEntry,
  ZavorthPlatformRegistryRecipe,
} from '../../../../services/ZavorthPlatformRegistryService.js';

export type ZavorthPlatformRegistrySnapshotBuilderRuntime = {
  now?: () => Date;
  pluginRegistryService?: Pick<ZavorthPluginRegistryService, 'buildSnapshot' | 'buildStatusSummary'>;
  catalogSourceService?: Pick<
    ZavorthPlatformCatalogSourceService,
    'listEntries' | 'listCollections' | 'listRecipes' | 'readSyncStatus'
  >;
  skillLoader?: Pick<SkillLoader, 'loadAll'>;
  skillSourceRegistryService?: Pick<SkillSourceRegistryService, 'listSearchSources'>;
  mcpManifestLoader?: Pick<McpManifestLoader, 'load'>;
  pluginStateService?: Pick<PluginStateService, 'getState' | 'resolveState'>;
  learningPlaneService?: Pick<ZavorthLearningPlaneService, 'buildSnapshot'>;
};

export type PlatformRegistryCatalogState = {
  entries: ZavorthPlatformCatalogEntry[];
  collections: ZavorthPlatformCatalogCollection[];
  recipes: ZavorthPlatformCatalogRecipe[];
  sync: ZavorthPlatformCatalogSyncStatus;
  byId: Map<string, ZavorthPlatformCatalogEntry>;
};

export type PlatformRegistryResolvedGraph = {
  catalogSync: ZavorthPlatformCatalogSyncStatus;
  allEntries: ZavorthPlatformRegistryEntry[];
  entries: ZavorthPlatformRegistryEntry[];
  collections: ZavorthPlatformRegistryCollection[];
  recipes: ZavorthPlatformRegistryRecipe[];
};
