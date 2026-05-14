import type { SkillCatalogEntry } from '../skills/SkillCatalogContract.js';

export type SkillRecipeSnapshot = {
  id: string;
  label: string;
  summary: string;
  rationale: string;
  actionHint: string;
  tags: string[];
  recommendedFor: string[];
  skillIds: string[];
  skillLabels: string[];
  missingSkillIds: string[];
  ready: boolean;
  steps: string[];
  searchText: string;
};

export type SkillCatalogRecommendation = {
  id: string;
  kind: 'skill' | 'recipe';
  label: string;
  reason: string;
  score: number;
};

type SkillRecipeDefinition = {
  id: string;
  label: string;
  summary: string;
  rationale: string;
  actionHint: string;
  tags: string[];
  recommendedFor: string[];
  skillIds: string[];
  steps: string[];
};

const DEFAULT_RECIPES: SkillRecipeDefinition[] = [
  {
    id: 'spec-driven-delivery',
    label: 'Entrega guiada por spec',
    summary: 'Combina descoberta, desenho tecnico e execucao guiada por especificacao.',
    rationale: 'Boa para evoluir features com menos drift entre ideia, desenho tecnico e implementacao.',
    actionHint: 'Use para fases de discovery, design e implementacao coordenadas.',
    tags: ['spec', 'design', 'delivery'],
    recommendedFor: ['spec', 'arquitetura', 'feature', 'roadmap', 'implementacao', 'design doc'],
    skillIds: ['tlc-spec-driven', 'technical-design-doc-creator', 'skill-architect'],
    steps: [
      'Comece com `tlc-spec-driven` para alinhar problema, contexto e criterios de aceite.',
      'Passe para `technical-design-doc-creator` para materializar o desenho tecnico.',
      'Feche com `skill-architect` para consolidar composicao e rollout da skill ou feature.',
    ],
  },
  {
    id: 'security-hardening',
    label: 'Hardening e auditoria de seguranca',
    summary: 'Une modelagem de ameacas, auditoria web e inspecao de runtime para endurecer uma entrega.',
    rationale: 'Ideal para antes de publicar uma interface, runtime remoto ou integracao nova.',
    actionHint: 'Use antes de abrir superficies publicas ou integrar ferramentas de terceiros.',
    tags: ['security', 'threat-model', 'web-audit'],
    recommendedFor: ['seguranca', 'harden', 'ameaÃ§a', 'threat', 'publicar', 'release', 'audit'],
    skillIds: ['security-threat-model', 'web-quality-audit', 'chrome-devtools'],
    steps: [
      'Modele riscos e trust boundaries com `security-threat-model`.',
      'Valide a superficie web com `web-quality-audit`.',
      'Use `chrome-devtools` para reproduzir fluxos e confirmar correcoes no browser.',
    ],
  },
  {
    id: 'codebase-navigation',
    label: 'Navegacao e depuracao rapida',
    summary: 'Acelera leitura de codebase, mapeamento de fluxos e reproducoes no navegador.',
    rationale: 'Bom para onboarding tecnico e para entender mudancas upstream antes de sincronizar.',
    actionHint: 'Use quando o gargalo principal for orientacao, nao implementacao.',
    tags: ['navigation', 'debugging', 'inspection'],
    recommendedFor: ['navegar', 'onboarding', 'mapear', 'debug', 'inspecao', 'revisao'],
    skillIds: ['codenavi', 'chrome-devtools'],
    steps: [
      'Mapeie os pontos de entrada e ownership com `codenavi`.',
      'Reproduza ou valide comportamentos com `chrome-devtools`.',
    ],
  },
];

export type SkillRecipeServiceRuntime = {
  definitions?: SkillRecipeDefinition[];
};

export class SkillRecipeService {
  private readonly definitions: SkillRecipeDefinition[];

  constructor(runtime: SkillRecipeServiceRuntime = {}) {
    this.definitions = Array.isArray(runtime.definitions) && runtime.definitions.length > 0
      ? runtime.definitions.slice()
      : DEFAULT_RECIPES.slice();
  }

  public buildRecipes(entries: SkillCatalogEntry[]): SkillRecipeSnapshot[] {
    const entryMap = new Map(entries.map((entry) => [this.normalizeValue(entry.name), entry] as const));

    return this.definitions
      .map((definition) => {
        const resolvedEntries = definition.skillIds
          .map((skillId) => entryMap.get(this.normalizeValue(skillId)) || null)
          .filter((entry): entry is SkillCatalogEntry => Boolean(entry));
        const missingSkillIds = definition.skillIds.filter((skillId) =>
          !resolvedEntries.some((entry) => this.normalizeValue(entry.name) === this.normalizeValue(skillId)));
        const skillLabels = resolvedEntries.map((entry) => entry.name);

        return {
          id: definition.id,
          label: definition.label,
          summary: definition.summary,
          rationale: definition.rationale,
          actionHint: definition.actionHint,
          tags: definition.tags.slice(),
          recommendedFor: definition.recommendedFor.slice(),
          skillIds: definition.skillIds.slice(),
          skillLabels,
          missingSkillIds,
          ready: missingSkillIds.length === 0,
          steps: definition.steps.slice(),
          searchText: this.normalizeSearchText([
            definition.id,
            definition.label,
            definition.summary,
            definition.rationale,
            ...definition.tags,
            ...definition.recommendedFor,
            ...definition.skillIds,
            ...skillLabels,
          ]),
        } satisfies SkillRecipeSnapshot;
      })
      .sort((left, right) => left.label.localeCompare(right.label, 'en-US'));
  }

  public buildRecommendations(input: {
    entries: SkillCatalogEntry[];
    recipes: SkillRecipeSnapshot[];
    query?: string | null;
    selectedEntry?: SkillCatalogEntry | null;
    selectedRecipe?: SkillRecipeSnapshot | null;
  }): SkillCatalogRecommendation[] {
    const query = this.normalizeValue(input.query);
    const tokens = this.tokenize(query);
    const recommendations: SkillCatalogRecommendation[] = [];

    const addRecommendation = (recommendation: SkillCatalogRecommendation) => {
      if (!recommendations.some((entry) => entry.kind === recommendation.kind && entry.id === recommendation.id)) {
        recommendations.push(recommendation);
      }
    };

    for (const recipe of input.recipes) {
      let score = recipe.ready ? 1 : 0.4;
      if (input.selectedEntry && recipe.skillIds.some((skillId) =>
        this.normalizeValue(skillId) === this.normalizeValue(input.selectedEntry?.name))) {
        score += 3;
      }
      if (input.selectedRecipe && recipe.id === input.selectedRecipe.id) {
        score += 4;
      }
      score += this.computeTokenScore(tokens, recipe.searchText);

      if (tokens.length === 0 && !input.selectedEntry && !input.selectedRecipe) {
        score += recipe.ready ? 1.2 : 0;
      }

      if (score > 0.9) {
        addRecommendation({
          id: recipe.id,
          kind: 'recipe',
          label: recipe.label,
          reason: recipe.ready
            ? `Recipe pronta com ${recipe.skillLabels.length} skill(s) ja disponiveis.`
            : `Recipe relevante, mas ainda faltam ${recipe.missingSkillIds.length} skill(s).`,
          score,
        });
      }
    }

    for (const entry of input.entries) {
      let score = this.computeTokenScore(tokens, entry.searchText);
      if (input.selectedEntry && entry.id === input.selectedEntry.id) {
        score += 4;
      }
      if (input.selectedRecipe && input.selectedRecipe.skillIds.some((skillId) =>
        this.normalizeValue(skillId) === this.normalizeValue(entry.name))) {
        score += 2.5;
      }
      if (tokens.length === 0 && entry.imported) {
        score += 0.8;
      }

      if (score > 0.5) {
        addRecommendation({
          id: entry.id,
          kind: 'skill',
          label: entry.name,
          reason: entry.imported
            ? `Skill curada de fonte ${entry.sourceLabel || entry.sourceId || 'importada'}.`
            : 'Skill local disponivel no runtime atual.',
          score,
        });
      }
    }

    return recommendations
      .sort((left, right) => {
        if (right.score !== left.score) {
          return right.score - left.score;
        }
        return left.label.localeCompare(right.label, 'en-US');
      })
      .slice(0, 8);
  }

  private computeTokenScore(tokens: string[], haystack: string): number {
    if (tokens.length === 0) {
      return 0;
    }

    return tokens.reduce((score, token) => score + (haystack.includes(token) ? 1 : 0), 0);
  }

  private tokenize(value: string): string[] {
    return this.normalizeValue(value)
      .split(/\s+/)
      .map((token) => token.trim())
      .filter(Boolean);
  }

  private normalizeSearchText(values: string[]): string {
    return values
      .map((value) => this.normalizeValue(value))
      .filter(Boolean)
      .join(' ');
  }

  private normalizeValue(value: string | null | undefined): string {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase();
  }
}
