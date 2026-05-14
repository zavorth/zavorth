import fs from 'fs';
import path from 'path';
import { SkillLoader, type SkillMetadata } from '../../../../skills/SkillLoader.js';
import { McpManifestLoader, type ResolvedMcpServerManifestEntry } from '../../../../mcp/McpManifest.js';
import {
  ZavorthPlatformCatalogSourceService,
  type ZavorthPlatformCatalogEntry,
} from '../../../../services/ZavorthPlatformCatalogSourceService.js';
import { ZavorthPluginRegistryService } from '../../../../services/ZavorthPluginRegistryService.js';
import { PluginStateService } from '../../../../services/PluginStateService.js';
import { SkillSourceRegistryService } from '../../../../services/SkillSourceRegistryService.js';
import { ZavorthLearningPlaneService } from '../../../../services/ZavorthLearningPlaneService.js';
import {
  buildPlatformRegistryFeaturedCollectionIds,
  buildPlatformRegistryFeaturedIds,
  buildPlatformRegistryFeaturedRecipeIds,
} from './ZavorthPlatformRegistryEntryHelpers.js';
import {
  buildPlatformRegistryStatusNarrative,
  buildPlatformRegistrySummary,
  buildPlatformRegistrySummaryNarrative,
} from './ZavorthPlatformRegistrySummaryBuilders.js';
import { ZavorthPlatformRegistryCollectionRecipeMapper } from './ZavorthPlatformRegistryCollectionRecipeMappers.js';
import { ZavorthPlatformRegistryEntryMapper } from './ZavorthPlatformRegistryEntryMappers.js';
import {
  normalizePlatformValue,
  resolvePlatformSelectedCollection,
  resolvePlatformSelectedEntry,
  resolvePlatformSelectedRecipe,
} from './ZavorthPlatformRegistrySnapshotBuilderSupport.js';
import type {
  ZavorthPlatformRegistrySnapshotBuilderRuntime as SnapshotBuilderRuntime,
  PlatformRegistryCatalogState,
  PlatformRegistryResolvedGraph,
} from './ZavorthPlatformRegistrySnapshotBuilderTypes.js';
import type {
  ZavorthPlatformRegistryEntry,
  ZavorthPlatformRegistrySnapshot,
  ZavorthPlatformRegistryStatusSummarySnapshot,
  ZavorthPlatformRegistrySummarySnapshot,
} from '../../../../services/ZavorthPlatformRegistryService.js';

export type { ZavorthPlatformRegistrySnapshotBuilderRuntime } from './ZavorthPlatformRegistrySnapshotBuilderTypes.js';

export class ZavorthPlatformRegistrySnapshotBuilderService {
  private readonly now: () => Date;
  private readonly pluginRegistry: Pick<ZavorthPluginRegistryService, 'buildSnapshot' | 'buildStatusSummary'>;
  private readonly catalogSource: {
    listEntries: Pick<ZavorthPlatformCatalogSourceService, 'listEntries'>['listEntries'];
    listCollections: Pick<ZavorthPlatformCatalogSourceService, 'listCollections'>['listCollections'];
    listRecipes: Pick<ZavorthPlatformCatalogSourceService, 'listRecipes'>['listRecipes'];
    readSyncStatus: Pick<ZavorthPlatformCatalogSourceService, 'readSyncStatus'>['readSyncStatus'];
  };
  private readonly skillLoader: Pick<SkillLoader, 'loadAll'>;
  private readonly skillSourceRegistry: Pick<SkillSourceRegistryService, 'listSearchSources'>;
  private readonly mcpManifestLoader: Pick<McpManifestLoader, 'load'>;
  private readonly learningPlane: Pick<ZavorthLearningPlaneService, 'buildSnapshot'> | null;
  private readonly entryMapper: ZavorthPlatformRegistryEntryMapper;
  private readonly collectionRecipeMapper: ZavorthPlatformRegistryCollectionRecipeMapper;

  constructor(runtime: SnapshotBuilderRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.pluginRegistry = runtime.pluginRegistryService || new ZavorthPluginRegistryService();
    const catalogSource = runtime.catalogSourceService || new ZavorthPlatformCatalogSourceService();
    this.catalogSource = {
      listEntries: catalogSource.listEntries.bind(catalogSource),
      listCollections: typeof catalogSource.listCollections === 'function'
        ? catalogSource.listCollections.bind(catalogSource)
        : () => [],
      listRecipes: typeof catalogSource.listRecipes === 'function'
        ? catalogSource.listRecipes.bind(catalogSource)
        : () => [],
      readSyncStatus: typeof catalogSource.readSyncStatus === 'function'
        ? catalogSource.readSyncStatus.bind(catalogSource)
        : () => ({
          enabled: false,
          status: 'disabled',
          remoteUrl: null,
          sourceTrusted: false,
          contentSha256: null,
          expectedSha256: null,
          checkedAt: null,
          syncedAt: null,
          stale: false,
          ageMs: null,
          maxAgeMs: 0,
          entryCount: 0,
          collectionCount: 0,
          recipeCount: 0,
          error: null,
          cacheFile: '',
          statusFile: '',
          command: 'zavorth platform sync',
          summary: 'Registry remoto desabilitado.',
        }),
    };
    this.skillLoader = runtime.skillLoader || new SkillLoader();
    this.skillSourceRegistry = runtime.skillSourceRegistryService || new SkillSourceRegistryService();
    this.mcpManifestLoader = runtime.mcpManifestLoader || new McpManifestLoader();
    const pluginState = runtime.pluginStateService || new PluginStateService();
    this.learningPlane = runtime.learningPlaneService || null;
    this.entryMapper = new ZavorthPlatformRegistryEntryMapper(pluginState);
    this.collectionRecipeMapper = new ZavorthPlatformRegistryCollectionRecipeMapper();
  }

  public buildSnapshot(input: { selectedId?: string | null; query?: string | null } = {}): ZavorthPlatformRegistrySnapshot {
    const query = normalizePlatformValue(input.query);
    const selectedId = normalizePlatformValue(input.selectedId);
    const graph = this.buildResolvedGraph({ query, pluginQuery: query || null });
    const summary = buildPlatformRegistrySummary(graph.entries, graph.collections, graph.recipes);

    return {
      generatedAt: this.now().toISOString(),
      summary,
      catalogSync: graph.catalogSync,
      entries: graph.entries,
      collections: graph.collections,
      recipes: graph.recipes,
      selected: resolvePlatformSelectedEntry(graph.entries, graph.allEntries, selectedId, query),
      selectedCollection: resolvePlatformSelectedCollection(graph.collections, selectedId, query),
      selectedRecipe: resolvePlatformSelectedRecipe(graph.recipes, selectedId, query),
      query: query || null,
      featuredIds: buildPlatformRegistryFeaturedIds(graph.entries),
      featuredCollectionIds: buildPlatformRegistryFeaturedCollectionIds(graph.collections),
      featuredRecipeIds: buildPlatformRegistryFeaturedRecipeIds(graph.recipes),
      narrative: buildPlatformRegistrySummaryNarrative(summary),
    };
  }

  public buildSummarySnapshot(): ZavorthPlatformRegistrySummarySnapshot {
    const graph = this.buildResolvedGraph({ query: '', pluginQuery: null });
    const summary = buildPlatformRegistrySummary(graph.allEntries, graph.collections, graph.recipes);
    return {
      generatedAt: this.now().toISOString(),
      summary,
      catalogSync: graph.catalogSync,
      narrative: buildPlatformRegistrySummaryNarrative(summary),
    };
  }

  public buildStatusSummarySnapshot(): ZavorthPlatformRegistryStatusSummarySnapshot {
    return this.buildStatusSummarySnapshotInternal(false);
  }

  public buildFastStatusSummarySnapshot(): ZavorthPlatformRegistryStatusSummarySnapshot {
    return this.buildStatusSummarySnapshotInternal(true);
  }

  private buildResolvedGraph(input: { query: string; pluginQuery: string | null }): PlatformRegistryResolvedGraph {
    const catalog = this.readCatalogState();
    const observedEntries = this.buildObservedEntries(catalog.byId, input.pluginQuery);
    const discoveryEntries = this.buildDiscoveryEntries(catalog.entries, observedEntries.ids);
    const allEntries = [...observedEntries.entries, ...discoveryEntries].sort((left, right) =>
      left.label.localeCompare(right.label, 'en-US'),
    );
    const collections = this.collectionRecipeMapper.buildCollections(catalog.collections, allEntries, input.query);
    const recipes = this.collectionRecipeMapper.buildRecipes(catalog.recipes, allEntries, collections, input.query);
    return {
      catalogSync: catalog.sync,
      allEntries,
      entries: input.query
        ? allEntries.filter((entry) => entry.searchText.includes(input.query))
        : allEntries,
      collections,
      recipes,
    };
  }

  private buildStatusSummarySnapshotInternal(fastSkillDiscovery: boolean): ZavorthPlatformRegistryStatusSummarySnapshot {
    const catalog = this.readCatalogState();
    const pluginCount =
      typeof this.pluginRegistry.buildStatusSummary === 'function'
        ? this.pluginRegistry.buildStatusSummary().summary.total
        : this.pluginRegistry.buildSnapshot({ query: null }).summary.total;
    const observedSkillIds = new Set(
      fastSkillDiscovery
        ? this.safeDiscoverSkillIdsFast()
        : this.safeLoadSkills({ includeSupportFiles: false, quiet: true })
          .map((entry) => normalizePlatformValue(`skill:${entry.name}`))
          .filter(Boolean),
    );
    const observedMcpIds = new Set(
      this.safeLoadMcpEntries()
        .map((entry) => normalizePlatformValue(`mcp:${entry.id}`))
        .filter(Boolean),
    );
    const discoverySkillCount = catalog.entries
      .filter((entry) => entry.kind === 'skill')
      .filter((entry) => !observedSkillIds.has(normalizePlatformValue(entry.id)))
      .length;
    const discoveryMcpCount = catalog.entries
      .filter((entry) => entry.kind === 'mcp')
      .filter((entry) => !observedMcpIds.has(normalizePlatformValue(entry.id)))
      .length;
    const summary = {
      total: pluginCount + observedSkillIds.size + observedMcpIds.size + discoverySkillCount + discoveryMcpCount,
      plugins: pluginCount,
      skills: observedSkillIds.size + discoverySkillCount,
      mcps: observedMcpIds.size + discoveryMcpCount,
      collections: catalog.collections.length,
      recipes: catalog.recipes.length,
    };

    return {
      generatedAt: this.now().toISOString(),
      summary,
      catalogSync: catalog.sync,
      narrative: buildPlatformRegistryStatusNarrative(summary),
    };
  }

  private readCatalogState(): PlatformRegistryCatalogState {
    const entries = this.catalogSource.listEntries();
    return {
      entries,
      collections: this.catalogSource.listCollections(),
      recipes: this.catalogSource.listRecipes(),
      sync: this.catalogSource.readSyncStatus(),
      byId: new Map(
        entries
          .map((entry) => [normalizePlatformValue(entry.id), entry] as const)
          .filter(([id]) => Boolean(id)),
      ),
    };
  }

  private buildObservedEntries(
    catalogById: Map<string, ZavorthPlatformCatalogEntry>,
    pluginQuery: string | null,
  ): { entries: ZavorthPlatformRegistryEntry[]; ids: Set<string> } {
    const observedEntries = [
      ...this.pluginRegistry.buildSnapshot({ query: pluginQuery }).entries.map((entry) => this.entryMapper.fromPlugin(entry)),
      ...this.safeLoadSkills({ includeSupportFiles: false, quiet: true }).map((entry) => this.entryMapper.fromSkill(entry)),
      ...this.safeLoadMcpEntries().map((entry) => this.entryMapper.fromMcp(entry)),
      ...(this.learningPlane
        ? this.learningPlane.buildSnapshot().candidates.map((entry) => this.entryMapper.fromLearningCandidate(entry))
        : []),
    ];
    const ids = new Set(observedEntries.map((entry) => normalizePlatformValue(entry.id)));
    return {
      entries: observedEntries.map((entry) =>
        this.entryMapper.applyCatalogOverlay(entry, catalogById.get(normalizePlatformValue(entry.id)) || null),
      ),
      ids,
    };
  }

  private buildDiscoveryEntries(
    catalogEntries: ZavorthPlatformCatalogEntry[],
    observedIds: Set<string>,
  ): ZavorthPlatformRegistryEntry[] {
    return catalogEntries
      .filter((entry) => entry.kind !== 'plugin')
      .filter((entry) => !observedIds.has(normalizePlatformValue(entry.id)))
      .map((entry) => this.entryMapper.fromCatalogDiscovery(entry));
  }

  private safeLoadSkills(options?: Parameters<SkillLoader['loadAll']>[0]): SkillMetadata[] {
    try {
      return this.skillLoader.loadAll(options);
    } catch {
      return [];
    }
  }

  private safeLoadMcpEntries(): ResolvedMcpServerManifestEntry[] {
    try {
      return this.mcpManifestLoader.load();
    } catch {
      return [];
    }
  }

  private safeDiscoverSkillIdsFast(): string[] {
    const ids = new Set<string>();

    try {
      for (const source of this.skillSourceRegistry.listSearchSources()) {
        if (!fs.existsSync(source.absolutePath)) {
          continue;
        }

        const entries = fs.readdirSync(source.absolutePath, { withFileTypes: true });
        for (const entry of entries) {
          if (!entry.isDirectory()) {
            continue;
          }
          if (!fs.existsSync(path.join(source.absolutePath, entry.name, 'SKILL.md'))) {
            continue;
          }
          ids.add(normalizePlatformValue(`skill:${entry.name}`));
        }
      }
    } catch {
      return [];
    }

    return Array.from(ids.values());
  }
}
