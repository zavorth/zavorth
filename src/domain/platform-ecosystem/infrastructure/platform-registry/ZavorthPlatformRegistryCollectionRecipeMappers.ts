import type {
  ZavorthPlatformCatalogCollection,
  ZavorthPlatformCatalogRecipe,
} from '../../../../services/ZavorthPlatformCatalogSourceService.js';
import type {
  ZavorthPlatformRegistryCollection,
  ZavorthPlatformRegistryEntry,
  ZavorthPlatformRegistryRecipe,
} from '../../../../services/ZavorthPlatformRegistryService.js';
import {
  buildPlatformCollectionActions,
  buildPlatformRecipeActions,
  normalizePlatformSearchText,
  normalizePlatformValue,
} from './ZavorthPlatformRegistrySnapshotBuilderSupport.js';

export class ZavorthPlatformRegistryCollectionRecipeMapper {
  public buildCollections(
    collections: ZavorthPlatformCatalogCollection[],
    entries: ZavorthPlatformRegistryEntry[],
    query: string,
  ): ZavorthPlatformRegistryCollection[] {
    const entryById = new Map(
      entries.map((entry) => [normalizePlatformValue(entry.id), entry] as const),
    );
    const resolved = collections
      .map((collection) => this.fromCatalogCollection(collection, entryById))
      .sort((left, right) => left.label.localeCompare(right.label, 'en-US'));

    return query
      ? resolved.filter((collection) => collection.searchText.includes(query))
      : resolved;
  }

  public buildRecipes(
    recipes: ZavorthPlatformCatalogRecipe[],
    entries: ZavorthPlatformRegistryEntry[],
    collections: ZavorthPlatformRegistryCollection[],
    query: string,
  ): ZavorthPlatformRegistryRecipe[] {
    const entryById = new Map(entries.map((entry) => [normalizePlatformValue(entry.id), entry] as const));
    const collectionById = new Map(collections.map((entry) => [normalizePlatformValue(entry.id), entry] as const));
    const resolved = recipes
      .map((recipe) => this.fromCatalogRecipe(recipe, entryById, collectionById))
      .sort((left, right) => left.label.localeCompare(right.label, 'en-US'));
    return query
      ? resolved.filter((recipe) => recipe.searchText.includes(query))
      : resolved;
  }

  private fromCatalogCollection(
    collection: ZavorthPlatformCatalogCollection,
    entryById: Map<string, ZavorthPlatformRegistryEntry>,
  ): ZavorthPlatformRegistryCollection {
    const items = collection.entryIds
      .map((entryId) => entryById.get(normalizePlatformValue(entryId)) || null)
      .filter((entry): entry is ZavorthPlatformRegistryEntry => Boolean(entry))
      .map((entry) => ({
        id: entry.id,
        label: entry.label,
        kind: entry.kind,
        readiness: entry.readiness,
        installState: entry.installState,
        discoveryOnly: entry.discoveryOnly,
      }));
    const missingCount = Math.max(0, collection.entryIds.length - items.length);
    return {
      id: collection.id,
      label: collection.label,
      source: collection.source,
      summary: collection.summary,
      actionHint: collection.actionHint,
      featured: collection.featured === true,
      itemCount: items.length,
      readyCount: items.filter((item) => item.readiness === 'ready').length,
      adoptedCount: items.filter((item) => ['installed', 'workspace', 'enabled'].includes(item.installState)).length,
      missingCount,
      kinds: Array.from(new Set(items.map((item) => item.kind))),
      tags: [...collection.tags],
      capabilities: [...collection.capabilities],
      details: [
        ...collection.details,
        `${items.length} item(ns) resolvido(s) no plane atual.`,
        ...(missingCount > 0 ? [`${missingCount} referencia(s) ainda nao visivel(is) neste runtime.`] : []),
      ],
      entryIds: [...collection.entryIds],
      searchText: normalizePlatformSearchText([
        collection.searchText,
        ...items.map((item) => item.id),
        ...items.map((item) => item.label),
      ]),
      actions: buildPlatformCollectionActions(collection.id, collection.actionHint, items, missingCount),
      items,
    };
  }

  private fromCatalogRecipe(
    recipe: ZavorthPlatformCatalogRecipe,
    entryById: Map<string, ZavorthPlatformRegistryEntry>,
    collectionById: Map<string, ZavorthPlatformRegistryCollection>,
  ): ZavorthPlatformRegistryRecipe {
    const targets: ZavorthPlatformRegistryRecipe['targets'] = [];
    for (const targetId of recipe.targetIds) {
      const normalizedId = normalizePlatformValue(targetId);
      const entry = entryById.get(normalizedId);
      if (entry) {
        targets.push({
          id: entry.id,
          label: entry.label,
          kind: entry.kind,
          readiness: entry.readiness,
          installState: entry.installState,
        });
        continue;
      }

      const collection = collectionById.get(normalizedId);
      if (collection) {
        targets.push({
          id: collection.id,
          label: collection.label,
          kind: 'collection',
          readiness: collection.readyCount > 0 ? 'ready' : collection.itemCount > 0 ? 'partial' : 'catalog',
          installState: collection.adoptedCount > 0 ? 'installed' : 'available',
        });
      }
    }
    const missingCount = Math.max(0, recipe.targetIds.length - targets.length);
    return {
      id: recipe.id,
      label: recipe.label,
      source: recipe.source,
      summary: recipe.summary,
      actionHint: recipe.actionHint,
      featured: recipe.featured === true,
      itemCount: targets.length,
      readyCount: targets.filter((target) => target.readiness === 'ready').length,
      adoptedCount: targets.filter((target) => ['installed', 'workspace', 'enabled'].includes(target.installState)).length,
      missingCount,
      tags: [...recipe.tags],
      details: [
        ...recipe.details,
        `${targets.length} alvo(s) resolvido(s) no plane atual.`,
        ...(missingCount > 0 ? [`${missingCount} alvo(s) ainda nao visivel(is) no runtime.`] : []),
      ],
      steps: [...recipe.steps],
      targetIds: [...recipe.targetIds],
      searchText: normalizePlatformSearchText([
        recipe.searchText,
        ...targets.map((target) => target.id),
        ...targets.map((target) => target.label),
      ]),
      actions: buildPlatformRecipeActions(recipe.id, recipe.actionHint, targets, missingCount),
      targets,
    };
  }
}
