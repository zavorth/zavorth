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
        headline: `Operational plan: ${focus.label}`,
        operatorSummary: this.buildOperatorSummary(focus, relatedSkills, relatedRecipes, library.vendors),
        caution,
      },
    };
  }

  public renderReport(input: SkillCatalogApiQuery = {}): string {
    const snapshot = this.buildSnapshot(input);
    const lines = [
      'Skill installation plan',
      '',
      snapshot.narrative.headline,
      snapshot.narrative.operatorSummary,
    ];

    if (snapshot.narrative.caution) {
      lines.push(`Caution: ${snapshot.narrative.caution}`);
    }

    lines.push(
      '',
      `Expected MCP: ${snapshot.mcp.tools} tool(s) | ${snapshot.mcp.resources} resource(s).`,
    );

    if (snapshot.skill) {
      lines.push(
        '',
        `Focused skill: ${snapshot.skill.name}`,
        snapshot.skill.description,
        `source: ${snapshot.skill.sourceLabel || snapshot.skill.sourceId || 'local'} | trust: ${snapshot.skill.sourceTrust || 'n/a'} | license: ${snapshot.skill.license || 'n/a'}.`,
      );
    }

    if (snapshot.recipe) {
      lines.push(
        '',
        `Focused recipe: ${snapshot.recipe.label}`,
        snapshot.recipe.summary,
        snapshot.recipe.ready ? 'Status: ready for usage.'
          : `Status: pending, missing ${snapshot.recipe.missingSkillIds.join(', ')}.`,
      );
    }

    if (snapshot.relatedSkills.length > 0) {
      lines.push('', 'Related skills:');
      for (const skill of snapshot.relatedSkills.slice(0, 5)) {
        lines.push(`- ${skill.name}: ${skill.description}`);
      }
    }

    if (snapshot.steps.length > 0) {
      lines.push('', 'Plan steps:');
      for (const step of snapshot.steps) {
        lines.push(
          `- ${step.label}: ${step.detail}${step.command ? ` | ${step.command}` : ''}${step.optional ? ' | optional' : ''}`,
        );
      }
    }

    if (snapshot.vendors.length > 0) {
      lines.push('', 'Observed vendors:');
      for (const vendor of snapshot.vendors.slice(0, 3)) {
        lines.push(`- ${vendor.displayName}: ${vendor.summary}`);
      }
    }

    if (snapshot.actions.length > 0) {
      lines.push('', 'Suggested shortcuts:');
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
      label: 'Skill library',
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
        label: 'Open recipe',
        detail: 'Confirm scope, required skills, and rationale before running the composition.',
        command: `/skills recipe ${recipe.id}`,
        optional: false,
      });
      recipe.steps.forEach((detail, index) => {
        pushStep({
          id: `recipe-step-${index + 1}`,
          label: `Stage ${index + 1}`,
          detail,
          command: null,
          optional: false,
        });
      });
      pushStep({
        id: 'recipe-mcp',
        label: 'Check MCP sidecar',
        detail: 'Validate that the recipe already appears with tools and resources in the unified sidecar.',
        command: `/skills mcp ${recipe.id}`,
        optional: true,
      });
    } else if (focus.kind === 'skill' && skill) {
      pushStep({
        id: 'skill-open',
        label: 'Inspect the skill',
        detail: 'Read description, provenance, license, and trust before plugging the skill into the flow.',
        command: `/skills ${skill.name}`,
        optional: false,
      });
      pushStep({
        id: 'skill-support',
        label: 'Review support files',
        detail: skill.supportFileCount > 0
          ? `The skill loads ${skill.supportFileCount} support file(s); validate that each one makes sense for the current runtime.`
          : 'The skill has no additional support files; main focus remains on SKILL.md and provenance.',
        command: null,
        optional: false,
      });
      if (relatedRecipes[0]) {
        pushStep({
          id: 'skill-recipe',
          label: 'Attach suggested recipe',
          detail: `Recipe ${relatedRecipes[0].label} organizes this skill in a larger flow.`,
          command: `/skills plan recipe ${relatedRecipes[0].id}`,
          optional: false,
        });
      }
      pushStep({
        id: 'skill-mcp',
        label: 'Validate MCP exposure',
        detail: 'Confirm tools and resources for discovery on external surfaces.',
        command: `/skills mcp ${skill.name}`,
        optional: true,
      });
    } else {
      pushStep({
        id: 'library-open',
        label: 'Open library',
        detail: 'Review bundles, trust, sources, and vendors before choosing a route.',
        command: '/skills library',
        optional: false,
      });
      if (relatedRecipes[0]) {
        pushStep({
          id: 'library-recipe',
          label: 'Start with a ready recipe',
          detail: `A recipe ${relatedRecipes[0].label} is the most direct shortcut from catalog to execution.`,
          command: `/skills plan recipe ${relatedRecipes[0].id}`,
          optional: false,
        });
      }
      pushStep({
        id: 'library-mcp',
        label: 'Expose catalog through MCP',
        detail: 'Use the MCP sidecar for discovery and handoff between surfaces.',
        command: '/skills mcp',
        optional: true,
      });
    }

    relatedSkills.slice(0, 3).forEach((entry) => {
      pushStep({
        id: `related-skill:${entry.id}`,
        label: `Validate ${entry.name}`,
        detail: `Confirm whether skill ${entry.name} is suitable for current use, especially trust ${entry.sourceTrust || 'n/a'}.`,
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
          label: `Prepare ${vendor.displayName}`,
          detail: vendor.updateAvailable ? 'There is a pending update before depending on this vendor in the flow.'
            : 'The vendor is not ready in the current runtime yet.',
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
    return `${focus.kind === 'library' ? 'General plan' : `Plan for ${focus.label}`} with `
      + `${relatedSkills.length} related skill(s), ${relatedRecipes.length} related recipe(s), `
      + `and ${vendors.filter((vendor) => vendor.ready).length}/${vendors.length} ready vendor(s).`;
  }

  private resolveCaution(
    skill: SkillCatalogEntry | null,
    vendors: SkillLibraryVendorCard[],
  ): string | null {
    if (skill?.sourceTrust === 'blocked') {
      return 'The focused skill is blocked by trust policy and must remain outside the core.';
    }
    if (skill?.sourceTrust === 'review') {
      return 'A skill in foco ainda pede review manual de trust before virar dependencia rotineira.';
    }

    const restrictedVendor = vendors.find((vendor) => !vendor.licenseDecision.allowCoreCopy);
    if (restrictedVendor) {
      return `${restrictedVendor.displayName} remains isolated by license; copy ideas, not code, into the Zavorth core.`;
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
