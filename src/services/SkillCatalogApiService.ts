import { SkillCatalogService } from '../skills/SkillCatalogService.js';
import type {
  SkillCatalogEntry,
  SkillCatalogSnapshot,
} from '../skills/SkillCatalogContract.js';
import {
  SkillRecipeService,
  type SkillCatalogRecommendation,
  type SkillRecipeSnapshot,
} from './SkillRecipeService.js';
import {
  UniversalSkillBridgeRegistryService,
} from './UniversalSkillBridgeRegistryService.js';


import type {
  ZavorthUniversalSkillBridgeRegistrySnapshot,
} from '../contracts/ZavorthUniversalSkillBridgeRegistryContract.js';

export type SkillCatalogApiQuery = {
  selectedId?: string | null;
  recipeId?: string | null;
  query?: string | null;
  recommendFor?: string | null;
};

export type SkillCatalogApiSnapshot = {
  generatedAt: string;
  query: string | null;
  recommendFor: string | null;
  summary: SkillCatalogSnapshot['summary'] & {
    visible: number;
    recipes: number;
    readyRecipes: number;
    recommendations: number;
    bridgeReady: number;
    bridgeBlocked: number;
    bridgeApprovalRequired: number;
  };
  entries: SkillCatalogEntry[];
  recipes: SkillRecipeSnapshot[];
  selected: SkillCatalogEntry | null;
  selectedRecipe: SkillRecipeSnapshot | null;
  recommendations: SkillCatalogRecommendation[];
  bridge: ZavorthUniversalSkillBridgeRegistrySnapshot;
  narrative: {
    headline: string;
    operatorSummary: string;
  };
};

type SkillCatalogApiRuntime = {
  now?: () => Date;
  skillCatalogService?: Pick<SkillCatalogService, 'buildSnapshot'>;
  skillRecipeService?: Pick<SkillRecipeService, 'buildRecipes' | 'buildRecommendations'>;
  skillBridgeRegistryService?: Pick<UniversalSkillBridgeRegistryService, 'buildProjection'>;
};

export class SkillCatalogApiService {
  private readonly now: () => Date;
  private readonly skillCatalogService: Pick<SkillCatalogService, 'buildSnapshot'>;
  private readonly skillRecipeService: Pick<SkillRecipeService, 'buildRecipes' | 'buildRecommendations'>;
  private readonly skillBridgeRegistryService: Pick<UniversalSkillBridgeRegistryService, 'buildProjection'>;

  constructor(runtime: SkillCatalogApiRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.skillCatalogService = runtime.skillCatalogService || new SkillCatalogService();
    this.skillRecipeService = runtime.skillRecipeService || new SkillRecipeService();
    this.skillBridgeRegistryService = runtime.skillBridgeRegistryService || new UniversalSkillBridgeRegistryService({
      skillCatalogService: {
        listEntries: () => this.skillCatalogService.buildSnapshot().entries,
      },
    });
  }

  public buildSnapshot(input: SkillCatalogApiQuery = {}): SkillCatalogApiSnapshot {
    const base = this.skillCatalogService.buildSnapshot();
    const query = this.normalizeValue(input.query);
    const recommendFor = this.normalizeValue(input.recommendFor);
    const selected = this.resolveSelectedEntry(base.entries, input.selectedId || input.query || null);
    const recipes = this.skillRecipeService.buildRecipes(base.entries);
    const selectedRecipe = this.resolveSelectedRecipe(recipes, input.recipeId || input.query || null);
    const visibleEntries = this.filterEntries(base.entries, query, selected);
    const visibleRecipes = this.filterRecipes(recipes, query, selectedRecipe);
    const bridge = this.skillBridgeRegistryService.buildProjection({
      selectedId: selected?.name || input.selectedId || null,
      query,
      channel: 'catalog',
    });
    const recommendations = this.skillRecipeService.buildRecommendations({
      entries: base.entries,
      recipes,
      query: recommendFor || query,
      selectedEntry: selected,
      selectedRecipe,
    });

    return {
      generatedAt: this.now().toISOString(),
      query: query || null,
      recommendFor: recommendFor || null,
      summary: {
        ...base.summary,
        visible: visibleEntries.length,
        recipes: recipes.length,
        readyRecipes: recipes.filter((recipe) => recipe.ready).length,
        recommendations: recommendations.length,
        bridgeReady: bridge.summary.ready,
        bridgeBlocked: bridge.summary.blocked,
        bridgeApprovalRequired: bridge.summary.approvalRequired,
      },
      entries: visibleEntries,
      recipes: visibleRecipes,
      selected,
      selectedRecipe,
      recommendations,
      bridge,
      narrative: {
        headline: 'Skill plane do Zavorth',
        operatorSummary: `${visibleEntries.length}/${base.summary.total} skill(s) visiveis, `
          + `${recipes.filter((recipe) => recipe.ready).length}/${recipes.length} recipe(s) prontas e `
          + `${recommendations.length} recomendacao(oes) gerada(s). Bridge: `
          + `${bridge.summary.ready} ready, ${bridge.summary.approvalRequired} approval, ${bridge.summary.blocked} blocked.`,
      },
    };
  }

  public renderReport(input: SkillCatalogApiQuery = {}): string {
    const snapshot = this.buildSnapshot(input);
    const lines = [
      'Skill plane do Zavorth',
      '',
      snapshot.narrative.headline,
      snapshot.narrative.operatorSummary,
      '',
      `Skills: ${snapshot.summary.total} total | visiveis: ${snapshot.summary.visible} | importadas: ${snapshot.summary.imported} | locais: ${snapshot.summary.local}.`,
      `Recipes: ${snapshot.summary.readyRecipes}/${snapshot.summary.recipes} prontas.`,
      `Trust: ${snapshot.summary.trusted} trusted | ${snapshot.summary.review} review | ${snapshot.summary.blocked} blocked.`,
      `Bridge: ${snapshot.summary.bridgeReady} ready | ${snapshot.summary.bridgeApprovalRequired} approval | ${snapshot.summary.bridgeBlocked} blocked.`,
    ];

    if (snapshot.query) {
      lines.push(`Filtro atual: ${snapshot.query}.`);
    }
    if (snapshot.recommendFor) {
      lines.push(`Recomendacoes para: ${snapshot.recommendFor}.`);
    }

    if (snapshot.selected) {
      const selected = snapshot.selected;
      lines.push(
        '',
        `Em foco: ${selected.name}`,
        selected.description,
        `Fonte: ${selected.sourceLabel || selected.sourceId || 'local'} | trust: ${selected.sourceTrust || 'n/d'} | licenca: ${selected.license || 'n/d'}.`,
        `Bundle tags: ${selected.bundleTags.length > 0 ? selected.bundleTags.join(', ') : 'nenhuma'}.`,
        `Support files: ${selected.supportFileCount}.`,
      );
      if (selected.provenance?.upstreamRepository) {
        lines.push(`Upstream: ${selected.provenance.upstreamRepository}.`);
      }
      if (snapshot.bridge.selected) {
        lines.push(`Bridge action: ${snapshot.bridge.selected.actions.find((action) => action.kind === 'dry-run')?.command || snapshot.bridge.selected.actions[0]?.command || 'n/d'}.`);
      }
    }

    if (snapshot.selectedRecipe) {
      const recipe = snapshot.selectedRecipe;
      lines.push(
        '',
        `Recipe: ${recipe.label}`,
        recipe.summary,
        `Skills: ${recipe.skillLabels.join(', ') || recipe.skillIds.join(', ')}.`,
        recipe.ready
          ? 'Status: pronta para uso.'
          : `Status: pendente, faltam ${recipe.missingSkillIds.join(', ')}.`,
        'Passos:',
        ...recipe.steps.slice(0, 4).map((step) => `- ${step}`),
      );
    }

    if (!snapshot.selected && snapshot.entries.length > 0) {
      lines.push('', 'Skills em destaque:');
      for (const entry of snapshot.entries.slice(0, 6)) {
        lines.push(`- ${entry.name}: ${entry.description}`);
      }
    }

    if (!snapshot.selectedRecipe && snapshot.recipes.length > 0) {
      lines.push('', 'Recipes em destaque:');
      for (const recipe of snapshot.recipes.slice(0, 4)) {
        lines.push(`- ${recipe.label}: ${recipe.summary}`);
      }
    }

    if (snapshot.recommendations.length > 0) {
      lines.push('', 'Recomendacoes:');
      for (const recommendation of snapshot.recommendations.slice(0, 5)) {
        lines.push(`- ${recommendation.label}: ${recommendation.reason}`);
      }
    }

    return lines.join('\n');
  }

  private filterEntries(
    entries: SkillCatalogEntry[],
    query: string,
    selected: SkillCatalogEntry | null,
  ): SkillCatalogEntry[] {
    if (!query) {
      return entries;
    }

    return entries.filter((entry) =>
      entry.id === selected?.id || entry.searchText.includes(query));
  }

  private filterRecipes(
    recipes: SkillRecipeSnapshot[],
    query: string,
    selectedRecipe: SkillRecipeSnapshot | null,
  ): SkillRecipeSnapshot[] {
    if (!query) {
      return recipes;
    }

    return recipes.filter((recipe) =>
      recipe.id === selectedRecipe?.id || recipe.searchText.includes(query));
  }

  private resolveSelectedEntry(
    entries: SkillCatalogEntry[],
    candidate: string | null | undefined,
  ): SkillCatalogEntry | null {
    const normalized = this.normalizeValue(candidate);
    if (!normalized) {
      return null;
    }

    return entries.find((entry) =>
      [
        entry.id,
        entry.name,
        entry.sourceId ? `${entry.sourceId}/${entry.name}` : '',
      ].some((value) => this.normalizeValue(value) === normalized)) || null;
  }

  private resolveSelectedRecipe(
    recipes: SkillRecipeSnapshot[],
    candidate: string | null | undefined,
  ): SkillRecipeSnapshot | null {
    const normalized = this.normalizeValue(candidate);
    if (!normalized) {
      return null;
    }

    return recipes.find((recipe) =>
      [recipe.id, recipe.label].some((value) => this.normalizeValue(value) === normalized)) || null;
  }

  private normalizeValue(value: string | null | undefined): string {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase();
  }
}
