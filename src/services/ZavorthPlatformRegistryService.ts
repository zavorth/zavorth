import type { ZavorthPlatformCatalogSyncStatus } from './ZavorthPlatformCatalogSyncService.js';
import {
  ZavorthPlatformRegistrySnapshotBuilderService,
  type ZavorthPlatformRegistrySnapshotBuilderRuntime,
} from '../domain/platform-ecosystem/infrastructure/platform-registry/ZavorthPlatformRegistrySnapshotBuilderService.js';

type ZavorthPlatformRegistryRuntime = ZavorthPlatformRegistrySnapshotBuilderRuntime;

export type ZavorthPlatformRegistryEntry = {
  id: string;
  label: string;
  kind: 'plugin' | 'skill' | 'mcp';
  source: string;
  origin: 'official' | 'trusted-third-party' | 'learned-local' | 'quarantined';
  readiness: 'ready' | 'partial' | 'planned' | 'disabled';
  trust: 'trusted' | 'review' | 'planned';
  trustState: 'trusted' | 'review' | 'planned' | 'quarantined';
  signatureState: 'verified' | 'catalog-verified' | 'workspace' | 'unsigned' | 'none';
  reviewState: 'not-required' | 'pending' | 'approved' | 'rejected';
  installState: 'installed' | 'available' | 'workspace' | 'enabled' | 'disabled';
  runtimePermissionProfile: 'native-runtime' | 'workspace-skill' | 'mcp-exec' | 'learned-review' | 'catalog-discovery';
  promotedFromLearning: boolean;
  registrySource: string | null;
  provenance: {
    sourceLocator: string | null;
    sourceDigest: string | null;
    sourceTrusted: boolean | null;
  };
  featured: boolean;
  discoveryOnly: boolean;
  summary: string;
  actionHint: string;
  tags: string[];
  capabilities: string[];
  details: string[];
  searchText: string;
  actions: ZavorthPlatformRegistryAction[];
};

export type ZavorthPlatformRegistryAction = {
  id: string;
  label: string;
  kind: 'inspect' | 'open' | 'doctor' | 'trust' | 'review' | 'install' | 'update' | 'remove';
  command: string | null;
};

export type ZavorthPlatformRegistryCollection = {
  id: string;
  label: string;
  source: string;
  summary: string;
  actionHint: string;
  featured: boolean;
  itemCount: number;
  readyCount: number;
  adoptedCount: number;
  missingCount: number;
  kinds: Array<'plugin' | 'skill' | 'mcp'>;
  tags: string[];
  capabilities: string[];
  details: string[];
  entryIds: string[];
  searchText: string;
  actions: ZavorthPlatformRegistryAction[];
  items: Array<{
    id: string;
    label: string;
    kind: 'plugin' | 'skill' | 'mcp';
    readiness: ZavorthPlatformRegistryEntry['readiness'];
    installState: ZavorthPlatformRegistryEntry['installState'];
    discoveryOnly: boolean;
  }>;
};

export type ZavorthPlatformRegistryRecipe = {
  id: string;
  label: string;
  source: string;
  summary: string;
  actionHint: string;
  featured: boolean;
  itemCount: number;
  readyCount: number;
  adoptedCount: number;
  missingCount: number;
  tags: string[];
  details: string[];
  steps: string[];
  targetIds: string[];
  searchText: string;
  actions: ZavorthPlatformRegistryAction[];
  targets: Array<{
    id: string;
    label: string;
    kind: 'plugin' | 'skill' | 'mcp' | 'collection';
    readiness: ZavorthPlatformRegistryEntry['readiness'] | 'catalog';
    installState: ZavorthPlatformRegistryEntry['installState'] | 'available';
  }>;
};

export type ZavorthPlatformRegistryCatalogSync = ZavorthPlatformCatalogSyncStatus;

export type ZavorthPlatformRegistrySnapshot = {
  generatedAt: string;
  summary: {
    total: number;
    plugins: number;
    skills: number;
    mcps: number;
    ready: number;
    partial: number;
    planned: number;
    disabled: number;
    trusted: number;
    enabled: number;
    catalogBacked: number;
    discoveryOnly: number;
    featured: number;
    official: number;
    trustedThirdParty: number;
    learnedLocal: number;
    quarantined: number;
    reviewPending: number;
    collections: number;
    featuredCollections: number;
    recipes: number;
    featuredRecipes: number;
  };
  catalogSync: ZavorthPlatformRegistryCatalogSync;
  entries: ZavorthPlatformRegistryEntry[];
  collections: ZavorthPlatformRegistryCollection[];
  recipes: ZavorthPlatformRegistryRecipe[];
  selected: ZavorthPlatformRegistryEntry | null;
  selectedCollection: ZavorthPlatformRegistryCollection | null;
  selectedRecipe: ZavorthPlatformRegistryRecipe | null;
  query: string | null;
  featuredIds: string[];
  featuredCollectionIds: string[];
  featuredRecipeIds: string[];
  narrative: {
    headline: string;
    operatorSummary: string;
  };
};

export type ZavorthPlatformRegistrySummarySnapshot = {
  generatedAt: string;
  summary: ZavorthPlatformRegistrySnapshot['summary'];
  catalogSync: ZavorthPlatformRegistryCatalogSync;
  narrative: ZavorthPlatformRegistrySnapshot['narrative'];
};

export type ZavorthPlatformRegistryStatusSummarySnapshot = {
  generatedAt: string;
  summary: {
    total: number;
    plugins: number;
    skills: number;
    mcps: number;
    collections: number;
    recipes: number;
  };
  catalogSync: ZavorthPlatformRegistryCatalogSync;
  narrative: ZavorthPlatformRegistrySnapshot['narrative'];
};

export class ZavorthPlatformRegistryService {
  private readonly snapshotBuilder: ZavorthPlatformRegistrySnapshotBuilderService;

  constructor(runtime: ZavorthPlatformRegistryRuntime = {}) {
    this.snapshotBuilder = new ZavorthPlatformRegistrySnapshotBuilderService(runtime);
  }

  public buildSnapshot(input: { selectedId?: string | null; query?: string | null } = {}): ZavorthPlatformRegistrySnapshot {
    return this.snapshotBuilder.buildSnapshot(input);
  }

  public buildSummarySnapshot(): ZavorthPlatformRegistrySummarySnapshot {
    return this.snapshotBuilder.buildSummarySnapshot();
  }

  public buildStatusSummarySnapshot(): ZavorthPlatformRegistryStatusSummarySnapshot {
    return this.snapshotBuilder.buildStatusSummarySnapshot();
  }

  public buildFastStatusSummarySnapshot(): ZavorthPlatformRegistryStatusSummarySnapshot {
    return this.snapshotBuilder.buildFastStatusSummarySnapshot();
  }

  public renderCatalogReport(input: { selectedId?: string | null; query?: string | null } = {}): string {
    const snapshot = this.buildSnapshot(input);
    const hasFocusedSelection = Boolean(
      this.normalizeValue(input.selectedId) || this.normalizeValue(input.query),
    );
    const lines = [
      'Platform plane do Zavorth',
      '',
      snapshot.narrative.headline,
      snapshot.narrative.operatorSummary,
      '',
      `Total: ${snapshot.summary.total} | plugins: ${snapshot.summary.plugins} | skills: ${snapshot.summary.skills} | MCPs: ${snapshot.summary.mcps}.`,
      `Colecoes: ${snapshot.summary.collections} | featured: ${snapshot.summary.featuredCollections}.`,
      `Recipes: ${snapshot.summary.recipes} | featured: ${snapshot.summary.featuredRecipes}.`,
      `Sync do catalogo: ${snapshot.catalogSync.summary}`,
    ];

    if (snapshot.selectedCollection && hasFocusedSelection) {
      lines.push(
        '',
        snapshot.selectedCollection.label,
        '',
        snapshot.selectedCollection.summary,
        `Itens: ${snapshot.selectedCollection.itemCount} | prontos: ${snapshot.selectedCollection.readyCount} | adotados: ${snapshot.selectedCollection.adoptedCount}.`,
        `Proximo passo: ${snapshot.selectedCollection.actionHint || 'n/d'}`,
      );
      if (snapshot.selectedCollection.items.length > 0) {
        lines.push(
          '',
          'Itens da colecao:',
          ...snapshot.selectedCollection.items.slice(0, 6).map((item) =>
            `- ${item.label} [${item.kind}] ${item.readiness}/${item.installState}`),
        );
      }
      if (snapshot.selectedCollection.details.length > 0) {
        lines.push('', 'Detalhes:', ...snapshot.selectedCollection.details.slice(0, 4).map((detail) => `- ${detail}`));
      }
      return lines.join('\n');
    }

    if (snapshot.selectedRecipe && hasFocusedSelection) {
      lines.push(
        '',
        snapshot.selectedRecipe.label,
        '',
        snapshot.selectedRecipe.summary,
        `Alvos: ${snapshot.selectedRecipe.itemCount} | prontos: ${snapshot.selectedRecipe.readyCount} | adotados: ${snapshot.selectedRecipe.adoptedCount}.`,
        `Proximo passo: ${snapshot.selectedRecipe.actionHint || 'n/d'}`,
      );
      if (snapshot.selectedRecipe.steps.length > 0) {
        lines.push('', 'Passos sugeridos:', ...snapshot.selectedRecipe.steps.slice(0, 4).map((step) => `- ${step}`));
      }
      if (snapshot.selectedRecipe.targets.length > 0) {
        lines.push(
          '',
          'Alvos resolvidos:',
          ...snapshot.selectedRecipe.targets.slice(0, 6).map((target) =>
            `- ${target.label} [${target.kind}] ${target.readiness}/${target.installState}`),
        );
      }
      return lines.join('\n');
    }

    if (snapshot.selected && hasFocusedSelection) {
      lines.push(
        '',
        snapshot.selected.label,
        '',
        snapshot.selected.summary,
        `Kind: ${snapshot.selected.kind}`,
        `Origin: ${snapshot.selected.origin}`,
        `Readiness: ${snapshot.selected.readiness}`,
        `Trust: ${snapshot.selected.trust}`,
        `Trust state: ${snapshot.selected.trustState}`,
        `Review: ${snapshot.selected.reviewState}`,
        `Signature: ${snapshot.selected.signatureState}`,
        `Install: ${snapshot.selected.installState}`,
        `Permissions: ${snapshot.selected.runtimePermissionProfile}`,
        `Proximo passo: ${snapshot.selected.actionHint}`,
      );
      if (snapshot.selected.details.length > 0) {
        lines.push('', 'Detalhes:', ...snapshot.selected.details.slice(0, 5).map((detail) => `- ${detail}`));
      }
      return lines.join('\n');
    }

    if (snapshot.collections.length > 0) {
      lines.push('', 'Colecoes em destaque:');
      for (const collection of snapshot.collections.slice(0, 4)) {
        lines.push(`- ${collection.label}: ${collection.summary}`);
      }
    }

    if (snapshot.recipes.length > 0) {
      lines.push('', 'Recipes em destaque:');
      for (const recipe of snapshot.recipes.slice(0, 3)) {
        lines.push(`- ${recipe.label}: ${recipe.summary}`);
      }
    }

    lines.push('', 'Itens em destaque:');
    for (const entry of snapshot.entries.slice(0, 8)) {
      lines.push(`- ${entry.label} [${entry.kind}] - ${entry.summary}`);
    }
    lines.push('', 'Use /platform <id|filtro|collection:id> para aprofundar um item do plane.');
    return lines.join('\n');
  }

  private normalizeValue(value: string | null | undefined): string {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase();
  }
}
