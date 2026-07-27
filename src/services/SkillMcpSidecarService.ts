import {
  SkillCatalogApiService,
  type SkillCatalogApiQuery,
} from './SkillCatalogApiService.js';

export type SkillMcpSidecarTool = {
  id: string;
  label: string;
  summary: string;
  inputHint: string;
};

export type SkillMcpSidecarResource = {
  id: string;
  kind: 'skill' | 'recipe';
  label: string;
  summary: string;
};

export type SkillMcpSidecarSnapshot = {
  generatedAt: string;
  capability: 'skill-catalog';
  summary: {
    skills: number;
    recipes: number;
    importedSkills: number;
    recommendations: number;
    tools: number;
    resources: number;
  };
  tools: SkillMcpSidecarTool[];
  resources: SkillMcpSidecarResource[];
  selectedSkill: ReturnType<SkillCatalogApiService['buildSnapshot']>['selected'];
  selectedRecipe: ReturnType<SkillCatalogApiService['buildSnapshot']>['selectedRecipe'];
  recommendations: ReturnType<SkillCatalogApiService['buildSnapshot']>['recommendations'];
  narrative: {
    headline: string;
    operatorSummary: string;
  };
};

type SkillMcpSidecarRuntime = {
  now?: () => Date;
  skillCatalogApiService?: Pick<SkillCatalogApiService, 'buildSnapshot'>;
};

export class SkillMcpSidecarService {
  private readonly now: () => Date;
  private readonly skillCatalogApiService: Pick<SkillCatalogApiService, 'buildSnapshot'>;

  constructor(runtime: SkillMcpSidecarRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.skillCatalogApiService = runtime.skillCatalogApiService || new SkillCatalogApiService();
  }

  public buildSnapshot(input: SkillCatalogApiQuery = {}): SkillMcpSidecarSnapshot {
    const catalog = this.skillCatalogApiService.buildSnapshot(input);
    const tools: SkillMcpSidecarTool[] = [
      {
        id: 'list-skills',
        label: 'List skills',
        summary: 'Lista skills visible no catalog unificado do Zavorth.',
        inputHint: 'q=<filtro optional>',
      },
      {
        id: 'inspect-skill',
        label: 'Inspect skill',
        summary: 'Abre uma skill especifica com provenance, support files e licenca.',
        inputHint: 'id=<skill-id>',
      },
      {
        id: 'list-skill-recipes',
        label: 'List skill recipes',
        summary: 'Shows composite recipes and whether every required skill is ready.',
        inputHint: 'recipe=<recipe-id optional>',
      },
      {
        id: 'recommend-skills',
        label: 'Recommend skills',
        summary: 'Suggests skills or recipes for an informed intent.',
        inputHint: 'recommend=<objetivo ou problema>',
      },
    ];
    const resources: SkillMcpSidecarResource[] = [
      ...catalog.entries.map((entry) => ({
        id: entry.id,
        kind: 'skill' as const,
        label: entry.name,
        summary: entry.description,
      })),
      ...catalog.recipes.map((recipe) => ({
        id: `recipe:${recipe.id}`,
        kind: 'recipe' as const,
        label: recipe.label,
        summary: recipe.summary,
      })),
    ];

    return {
      generatedAt: this.now().toISOString(),
      capability: 'skill-catalog',
      summary: {
        skills: catalog.summary.visible,
        recipes: catalog.summary.recipes,
        importedSkills: catalog.summary.imported,
        recommendations: catalog.recommendations.length,
        tools: tools.length,
        resources: resources.length,
      },
      tools,
      resources,
      selectedSkill: catalog.selected,
      selectedRecipe: catalog.selectedRecipe,
      recommendations: catalog.recommendations,
      narrative: {
        headline: 'Skill MCP sidecar ready for discovery',
        operatorSummary: `${tools.length} tool(s) de catalog, ${resources.length} resource(s) mapeados e `
          + `${catalog.recommendations.length} recommendation(s) available.`,
      },
    };
  }

  public renderReport(input: SkillCatalogApiQuery = {}): string {
    const snapshot = this.buildSnapshot(input);
    const lines = [
      'Skill MCP sidecar',
      '',
      snapshot.narrative.headline,
      snapshot.narrative.operatorSummary,
      '',
      `Skills: ${snapshot.summary.skills} | recipes: ${snapshot.summary.recipes} | importadas: ${snapshot.summary.importedSkills}.`,
      `Tools MCP: ${snapshot.summary.tools} | resources: ${snapshot.summary.resources}.`,
      '',
      'Tools expostas:',
      ...snapshot.tools.map((tool) => `- ${tool.label}: ${tool.summary}`),
    ];

    if (snapshot.selectedSkill) {
      lines.push('', `Skill em foco: ${snapshot.selectedSkill.name}`, snapshot.selectedSkill.description);
    }

    if (snapshot.selectedRecipe) {
      lines.push('', `Recipe em foco: ${snapshot.selectedRecipe.label}`, snapshot.selectedRecipe.summary);
    }

    if (snapshot.recommendations.length > 0) {
      lines.push('', 'Recomendactions:');
      for (const recommendation of snapshot.recommendations.slice(0, 4)) {
        lines.push(`- ${recommendation.label}: ${recommendation.reason}`);
      }
    }

    return lines.join('\n');
  }
}
