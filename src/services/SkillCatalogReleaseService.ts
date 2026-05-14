import {
  SkillCatalogApiService,
  type SkillCatalogApiSnapshot,
} from './SkillCatalogApiService.js';
import {
  SkillMcpSidecarService,
  type SkillMcpSidecarSnapshot,
} from './SkillMcpSidecarService.js';

export type SkillCatalogReleaseSnapshot = {
  generatedAt: string;
  catalog: SkillCatalogApiSnapshot;
  mcp: SkillMcpSidecarSnapshot;
  summary: {
    importedSkills: number;
    localSkills: number;
    recipes: number;
    readyRecipes: number;
    recommendations: number;
    reviewRequiredSkills: number;
    blockedSkills: number;
    mcpResources: number;
  };
  narrative: {
    headline: string;
    operatorSummary: string;
  };
};

type SkillCatalogReleaseRuntime = {
  now?: () => Date;
  skillCatalogApiService?: Pick<SkillCatalogApiService, 'buildSnapshot' | 'renderReport'>;
  skillMcpSidecarService?: Pick<SkillMcpSidecarService, 'buildSnapshot' | 'renderReport'>;
};

export class SkillCatalogReleaseService {
  private readonly now: () => Date;
  private readonly skillCatalogApiService: Pick<SkillCatalogApiService, 'buildSnapshot' | 'renderReport'>;
  private readonly skillMcpSidecarService: Pick<SkillMcpSidecarService, 'buildSnapshot' | 'renderReport'>;

  constructor(runtime: SkillCatalogReleaseRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.skillCatalogApiService = runtime.skillCatalogApiService || new SkillCatalogApiService();
    this.skillMcpSidecarService = runtime.skillMcpSidecarService || new SkillMcpSidecarService();
  }

  public buildSnapshot(): SkillCatalogReleaseSnapshot {
    const catalog = this.skillCatalogApiService.buildSnapshot();
    const mcp = this.skillMcpSidecarService.buildSnapshot();
    const reviewRequiredSkills = catalog.entries.filter((entry) =>
      entry.risk?.reviewRequired || entry.licensePolicy?.reviewRequired).length;
    const blockedSkills = catalog.entries.filter((entry) => entry.risk?.level === 'blocked').length;

    return {
      generatedAt: this.now().toISOString(),
      catalog,
      mcp,
      summary: {
        importedSkills: catalog.summary.imported,
        localSkills: catalog.summary.local,
        recipes: catalog.summary.recipes,
        readyRecipes: catalog.summary.readyRecipes,
        recommendations: catalog.summary.recommendations,
        reviewRequiredSkills,
        blockedSkills,
        mcpResources: mcp.summary.resources,
      },
      narrative: {
        headline: 'Release snapshot do skill plane do Zavorth',
        operatorSummary: `${catalog.summary.imported} skill(s) importadas, ${catalog.summary.readyRecipes}/${catalog.summary.recipes} recipe(s) prontas, `
          + `${reviewRequiredSkills} skill(s) em revisao e ${mcp.summary.resources} resource(s) MCP publicados.`,
      },
    };
  }

  public renderMarkdown(): string {
    const snapshot = this.buildSnapshot();
    const lines = [
      '# Zavorth Skill Catalog Release',
      '',
      `Generated at: ${snapshot.generatedAt}`,
      '',
      snapshot.narrative.headline,
      snapshot.narrative.operatorSummary,
      '',
      '## Summary',
      '',
      `- Imported skills: ${snapshot.summary.importedSkills}`,
      `- Local skills: ${snapshot.summary.localSkills}`,
      `- Recipes: ${snapshot.summary.readyRecipes}/${snapshot.summary.recipes} ready`,
      `- Recommendations: ${snapshot.summary.recommendations}`,
      `- Review required skills: ${snapshot.summary.reviewRequiredSkills}`,
      `- Blocked skills: ${snapshot.summary.blockedSkills}`,
      `- MCP resources: ${snapshot.summary.mcpResources}`,
      '',
      '## Catalog Report',
      '',
      this.skillCatalogApiService.renderReport(),
      '',
      '## MCP Report',
      '',
      this.skillMcpSidecarService.renderReport(),
    ];

    return lines.join('\n');
  }
}
