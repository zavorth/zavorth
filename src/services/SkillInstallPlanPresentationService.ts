import type { SkillCatalogEntry } from '../skills/SkillCatalogContract.js';
import {
  type SkillCatalogApiQuery,
} from './SkillCatalogApiService.js';
import {
  SkillLibraryPresentationService,
  type SkillLibraryAction,
  type SkillLibraryPresentationSnapshot,
  type SkillLibraryVendorCard,
} from './SkillLibraryPresentationService.js';
import type {
  SkillCatalogRecommendation,
  SkillRecipeSnapshot,
} from './SkillRecipeService.js';

export type SkillInstallPlanStep = {
  id: string;
  label: string;
  detail: string;
  command: string | null;
  optional: boolean;
};

export type SkillInstallPlanFocus =
  | {
    kind: 'library';
    id: null;
    label: string;
    summary: string;
  }
  | {
    kind: 'skill';
    id: string;
    label: string;
    summary: string;
  }
  | {
    kind: 'recipe';
    id: string;
    label: string;
    summary: string;
  };

export type SkillInstallPlanSnapshot = {
  generatedAt: string;
  focus: SkillInstallPlanFocus;
  skill: SkillCatalogEntry | null;
  recipe: SkillRecipeSnapshot | null;
  relatedSkills: SkillCatalogEntry[];
  relatedRecipes: SkillRecipeSnapshot[];
  recommendations: SkillCatalogRecommendation[];
  vendors: SkillLibraryVendorCard[];
  actions: SkillLibraryAction[];
  steps: SkillInstallPlanStep[];
  mcp: SkillLibraryPresentationSnapshot['mcp']['summary'];
  narrative: {
    headline: string;
    operatorSummary: string;
    caution: string | null;
  };
};

type SkillInstallPlanPresentationRuntime = {
  now?: () => Date;
  skillLibraryPresentationService?: Pick<SkillLibraryPresentationService, 'buildSnapshot'>;
};

export class SkillInstallPlanPresentationService {
  private readonly now: () => Date;
  private readonly skillLibraryPresentationService: Pick<SkillLibraryPresentationService, 'buildSnapshot'>;

  constructor(runtime: SkillInstallPlanPresentationRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.skillLibraryPresentationService =
      runtime.skillLibraryPresentationService || new SkillLibraryPresentationService();
  }

  public buildSnapshot(input: SkillCatalogApiQuery = {}): SkillInstallPlanSnapshot {
    const library = this.skillLibraryPresentationService.buildSnapshot(input);
    const skill = this.resolveSkill(library);
    const recipe = this.resolveRecipe(library, skill);
    const relatedSkills = this.resolveRelatedSkills(library, recipe, skill);
    const relatedRecipes = this.resolveRelatedRecipes(library, skill, recipe);
    const focus = this.resolveFocus(library, skill, recipe);
    const steps = this.buildSteps(focus, skill, recipe, relatedSkills, relatedRecipes, library.vendors);
    const caution = this.resolveCaution(skill, library.vendors);

    return {
      generatedAt: this.now().toISOString(),
      focus,
      skill,
      recipe,
      relatedSkills,
      relatedRecipes,
      recommendations: library.catalog.recommendations,
      vendors: library.vendors,
      actions: library.actions,
      steps,
      mcp: library.mcp.summary,
      narrative: {
        headline: `Plano operacional: ${focus.label}`,
        operatorSummary: this.buildOperatorSummary(focus, relatedSkills, relatedRecipes, library.vendors),
        caution,
      },
    };
  }

  public renderReport(input: SkillCatalogApiQuery = {}): string {
    const snapshot = this.buildSnapshot(input);
    const lines = [
      'Plano de instalacao de skills',
      '',
      snapshot.narrative.headline,
      snapshot.narrative.operatorSummary,
    ];

    if (snapshot.narrative.caution) {
      lines.push(`Cautela: ${snapshot.narrative.caution}`);
    }

    lines.push(
      '',
      `MCP previsto: ${snapshot.mcp.tools} tool(s) | ${snapshot.mcp.resources} resource(s).`,
    );

    if (snapshot.skill) {
      lines.push(
        '',
        `Skill em foco: ${snapshot.skill.name}`,
        snapshot.skill.description,
        `Fonte: ${snapshot.skill.sourceLabel || snapshot.skill.sourceId || 'local'} | trust: ${snapshot.skill.sourceTrust || 'n/d'} | licenca: ${snapshot.skill.license || 'n/d'}.`,
      );
    }

    if (snapshot.recipe) {
      lines.push(
        '',
        `Recipe em foco: ${snapshot.recipe.label}`,
        snapshot.recipe.summary,
        snapshot.recipe.ready
          ? 'Status: pronta para uso.'
          : `Status: pendente, faltam ${snapshot.recipe.missingSkillIds.join(', ')}.`,
      );
    }

    if (snapshot.relatedSkills.length > 0) {
      lines.push('', 'Skills relacionadas:');
      for (const skill of snapshot.relatedSkills.slice(0, 5)) {
        lines.push(`- ${skill.name}: ${skill.description}`);
      }
    }

    if (snapshot.steps.length > 0) {
      lines.push('', 'Passos do plano:');
      for (const step of snapshot.steps) {
        lines.push(
          `- ${step.label}: ${step.detail}${step.command ? ` | ${step.command}` : ''}${step.optional ? ' | opcional' : ''}`,
        );
      }
    }

    if (snapshot.vendors.length > 0) {
      lines.push('', 'Vendors observados:');
      for (const vendor of snapshot.vendors.slice(0, 3)) {
        lines.push(`- ${vendor.displayName}: ${vendor.summary}`);
      }
    }

    if (snapshot.actions.length > 0) {
      lines.push('', 'Atalhos sugeridos:');
      for (const action of snapshot.actions.slice(0, 5)) {
        lines.push(`- ${action.label}: ${action.command}`);
      }
    }

    return lines.join('\n');
  }

  private resolveSkill(library: SkillLibraryPresentationSnapshot): SkillCatalogEntry | null {
    if (library.catalog.selected) {
      return library.catalog.selected;
    }

    const recommendation = library.catalog.recommendations.find((entry) => entry.kind === 'skill');
    if (!recommendation) {
      return null;
    }

    return library.catalog.entries.find((entry) => entry.name === recommendation.label) || null;
  }

  private resolveRecipe(
    library: SkillLibraryPresentationSnapshot,
    skill: SkillCatalogEntry | null,
  ): SkillRecipeSnapshot | null {
    if (library.catalog.selectedRecipe) {
      return library.catalog.selectedRecipe;
    }

    const recipeRecommendation = library.catalog.recommendations.find((entry) => entry.kind === 'recipe');
    if (recipeRecommendation) {
      const recommendedRecipe = library.catalog.recipes.find((entry) => entry.id === recipeRecommendation.id);
      if (recommendedRecipe) {
        return recommendedRecipe;
      }
    }

    if (!skill) {
      return null;
    }

    return library.catalog.recipes.find((recipe) =>
      recipe.skillIds.some((skillId) => this.normalizeValue(skillId) === this.normalizeValue(skill.name))) || null;
  }

  private resolveRelatedSkills(
    library: SkillLibraryPresentationSnapshot,
    recipe: SkillRecipeSnapshot | null,
    skill: SkillCatalogEntry | null,
  ): SkillCatalogEntry[] {
    if (recipe) {
      return library.catalog.entries.filter((entry) =>
        recipe.skillIds.some((skillId) => this.normalizeValue(skillId) === this.normalizeValue(entry.name)));
    }

    return skill ? [skill] : library.catalog.entries.slice(0, 4);
  }

  private resolveRelatedRecipes(
    library: SkillLibraryPresentationSnapshot,
    skill: SkillCatalogEntry | null,
    recipe: SkillRecipeSnapshot | null,
  ): SkillRecipeSnapshot[] {
    if (recipe) {
      return [recipe];
    }

    if (!skill) {
      return library.catalog.recipes.slice(0, 3);
    }

    return library.catalog.recipes.filter((entry) =>
      entry.skillIds.some((skillId) => this.normalizeValue(skillId) === this.normalizeValue(skill.name)));
  }

  private resolveFocus(
    library: SkillLibraryPresentationSnapshot,
    skill: SkillCatalogEntry | null,
    recipe: SkillRecipeSnapshot | null,
  ): SkillInstallPlanFocus {
    if (recipe) {
      return {
        kind: 'recipe',
        id: recipe.id,
        label: recipe.label,
        summary: recipe.summary,
      };
    }

    if (skill) {
      return {
        kind: 'skill',
        id: skill.id,
        label: skill.name,
        summary: skill.description,
      };
    }

    return {
      kind: 'library',
      id: null,
      label: 'Biblioteca de skills',
      summary: library.narrative.operatorSummary,
    };
  }

  private buildSteps(
    focus: SkillInstallPlanFocus,
    skill: SkillCatalogEntry | null,
    recipe: SkillRecipeSnapshot | null,
    relatedSkills: SkillCatalogEntry[],
    relatedRecipes: SkillRecipeSnapshot[],
    vendors: SkillLibraryVendorCard[],
  ): SkillInstallPlanStep[] {
    const steps: SkillInstallPlanStep[] = [];
    const pushStep = (step: SkillInstallPlanStep) => {
      if (!steps.some((entry) => entry.label === step.label && entry.command === step.command)) {
        steps.push(step);
      }
    };

    if (focus.kind === 'recipe' && recipe) {
      pushStep({
        id: 'recipe-open',
        label: 'Abrir recipe',
        detail: 'Confirme escopo, skills exigidas e rationale antes de rodar a composicao.',
        command: `/skills recipe ${recipe.id}`,
        optional: false,
      });
      recipe.steps.forEach((detail, index) => {
        pushStep({
          id: `recipe-step-${index + 1}`,
          label: `Etapa ${index + 1}`,
          detail,
          command: null,
          optional: false,
        });
      });
      pushStep({
        id: 'recipe-mcp',
        label: 'Checar sidecar MCP',
        detail: 'Valide se a recipe ja aparece com tools e resources no sidecar unificado.',
        command: `/skills mcp ${recipe.id}`,
        optional: true,
      });
    } else if (focus.kind === 'skill' && skill) {
      pushStep({
        id: 'skill-open',
        label: 'Inspecionar a skill',
        detail: 'Leia descricao, provenance, licenca e trust antes de plugar a skill no fluxo.',
        command: `/skills ${skill.name}`,
        optional: false,
      });
      pushStep({
        id: 'skill-support',
        label: 'Revisar arquivos de apoio',
        detail: skill.supportFileCount > 0
          ? `A skill carrega ${skill.supportFileCount} arquivo(s) de apoio; valide se todos fazem sentido para o runtime atual.`
          : 'A skill nao tem arquivos de apoio adicionais; foco principal fica no SKILL.md e na provenance.',
        command: null,
        optional: false,
      });
      if (relatedRecipes[0]) {
        pushStep({
          id: 'skill-recipe',
          label: 'Acoplar recipe sugerida',
          detail: `A recipe ${relatedRecipes[0].label} organiza esta skill em um fluxo maior.`,
          command: `/skills plan recipe ${relatedRecipes[0].id}`,
          optional: false,
        });
      }
      pushStep({
        id: 'skill-mcp',
        label: 'Validar exposicao MCP',
        detail: 'Confirme tools e resources para discovery em surfaces externas.',
        command: `/skills mcp ${skill.name}`,
        optional: true,
      });
    } else {
      pushStep({
        id: 'library-open',
        label: 'Abrir biblioteca',
        detail: 'Revise bundles, trust, sources e vendors antes de escolher uma rota.',
        command: '/skills library',
        optional: false,
      });
      if (relatedRecipes[0]) {
        pushStep({
          id: 'library-recipe',
          label: 'Comecar por uma recipe pronta',
          detail: `A recipe ${relatedRecipes[0].label} e o atalho mais objetivo para sair do catalogo e entrar em execucao.`,
          command: `/skills plan recipe ${relatedRecipes[0].id}`,
          optional: false,
        });
      }
      pushStep({
        id: 'library-mcp',
        label: 'Expor catalogo via MCP',
        detail: 'Use o sidecar MCP para discovery e handoff entre superfices.',
        command: '/skills mcp',
        optional: true,
      });
    }

    relatedSkills.slice(0, 3).forEach((entry) => {
      pushStep({
        id: `related-skill:${entry.id}`,
        label: `Validar ${entry.name}`,
        detail: `Confirme se a skill ${entry.name} esta apta para o uso atual, especialmente trust ${entry.sourceTrust || 'n/d'}.`,
        command: `/skills ${entry.name}`,
        optional: true,
      });
    });

    vendors
      .filter((vendor) => vendor.updateAvailable || !vendor.ready)
      .slice(0, 2)
      .forEach((vendor) => {
        pushStep({
          id: `vendor:${vendor.vendorId}`,
          label: `Preparar ${vendor.displayName}`,
          detail: vendor.updateAvailable
            ? 'Existe update pendente antes de depender deste vendor no fluxo.'
            : 'O vendor ainda nao esta pronto no runtime atual.',
          command: vendor.actionCommand,
          optional: true,
        });
      });

    return steps;
  }

  private buildOperatorSummary(
    focus: SkillInstallPlanFocus,
    relatedSkills: SkillCatalogEntry[],
    relatedRecipes: SkillRecipeSnapshot[],
    vendors: SkillLibraryVendorCard[],
  ): string {
    return `${focus.kind === 'library' ? 'Plano geral' : `Plano para ${focus.label}`} com `
      + `${relatedSkills.length} skill(s) relacionada(s), ${relatedRecipes.length} recipe(s) relacionada(s) `
      + `e ${vendors.filter((vendor) => vendor.ready).length}/${vendors.length} vendor(s) pronto(s).`;
  }

  private resolveCaution(
    skill: SkillCatalogEntry | null,
    vendors: SkillLibraryVendorCard[],
  ): string | null {
    if (skill?.sourceTrust === 'blocked') {
      return 'A skill em foco esta bloqueada pela policy de trust e deve permanecer fora do core.';
    }
    if (skill?.sourceTrust === 'review') {
      return 'A skill em foco ainda pede review manual de trust antes de virar dependencia rotineira.';
    }

    const restrictedVendor = vendors.find((vendor) => !vendor.licenseDecision.allowCoreCopy);
    if (restrictedVendor) {
      return `${restrictedVendor.displayName} permanece isolado por licenca; copie ideias, nao codigo, para o core do Zavorth.`;
    }

    return null;
  }

  private normalizeValue(value: string | null | undefined): string {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase();
  }
}
