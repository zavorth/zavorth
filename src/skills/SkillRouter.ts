import { ILlmProvider, ChatMessage } from '../providers/ILlmProvider.js';
import { SkillMetadata } from './SkillLoader.js';

export interface SkillSelection {
  primarySkillName: string | null;
  supportSkillName: string | null;
}

type RoutingConfidence = 'medium' | 'high';

type KeywordRule = {
  skillName: string;
  weight: number;
  patterns: string[];
};

interface HeuristicSelection extends SkillSelection {
  confidence: RoutingConfidence;
  reason: string;
}

const EXPLICIT_SKILL_ALIASES: Record<string, string[]> = {
  'zavorth-maestro': ['zavorth maestro', 'modo maestro', 'maestro'],
  'super-agente-universitario': ['super agente universitario', 'agente universitario'],
  'discover-research': ['discover research'],
  'requirements-analysis': ['requirements analysis'],
  'system-design': ['system design'],
};

const HEURISTIC_RULES: KeywordRule[] = [
  {
    skillName: 'zavorth-maestro',
    weight: 3,
    patterns: [
      'coordene',
      'orquestre',
      'workflow',
      'pipeline',
      'em etapas',
      'em fases',
      'varias etapas',
      'varias entregas',
      'varios entregaveis',
      'plano de execucao',
      'combine as skills',
      'organize este projeto em fases',
    ],
  },
  {
    skillName: 'debugging',
    weight: 3,
    patterns: [
      'bug',
      'erro',
      'falha',
      'stack trace',
      'exception',
      'excecao',
      'crash',
      'travou',
      'quebrou',
      'quebrado',
      'nao funciona',
      'nao esta funcionando',
      'debugging',
      'debug',
      'depuracao',
      'teste quebrado',
      'teste falhou',
      'causa raiz',
    ],
  },
  {
    skillName: 'requirements-analysis',
    weight: 2,
    patterns: [
      'requisito',
      'requisitos',
      'especificacao',
      'escopo',
      'criterio de aceite',
      'criterios de aceite',
      'user story',
      'user stories',
      'historia de usuario',
      'mvp',
      'briefing',
      'backlog',
      'caso de uso',
      'funcional',
      'nao funcional',
      'ideia vaga',
    ],
  },
  {
    skillName: 'system-design',
    weight: 2,
    patterns: [
      'arquitetura',
      'desenho de sistema',
      'desenhar o sistema',
      'componentes',
      'integracao',
      'integracoes',
      'fluxo de dados',
      'escalabilidade',
      'latencia',
      'fila',
      'filas',
      'banco de dados',
      'api',
      'apis',
      'microsservico',
      'microsservicos',
      'monolito',
      'trade off',
      'trade offs',
      'arquitetar',
    ],
  },
  {
    skillName: 'discover-research',
    weight: 2,
    patterns: [
      'pesquisa',
      'pesquisar',
      'revisao de literatura',
      'referencial teorico',
      'bibliografia',
      'fontes academicas',
      'artigos cientificos',
      'paper',
      'papers',
      'metodologia',
      'estado da arte',
      'evidencias',
      'sintese academica',
      'mapa de literatura',
      'literatura cientifica',
    ],
  },
  {
    skillName: 'super-agente-universitario',
    weight: 2,
    patterns: [
      'universidade',
      'universitario',
      'faculdade',
      'disciplina',
      'professor',
      'atividade',
      'tcc',
      'prova',
      'simulado',
      'aula',
      'seminario',
      'artigo academico',
      'estudar',
      'questoes de prova',
      'plano de estudo',
    ],
  },
];

const STUDY_FOCUS_PATTERNS = [
  'estudar',
  'prova',
  'simulado',
  'atividade',
  'plano de estudo',
  'questoes de prova',
  'explicar a materia',
  'resumo para estudar',
];

const RESEARCH_FOCUS_PATTERNS = [
  'pesquisa',
  'revisao de literatura',
  'referencial teorico',
  'metodologia',
  'estado da arte',
  'bibliografia',
  'artigos cientificos',
  'paper',
  'papers',
];

/**
 * SkillRouter - combina heuristicas deterministicas com fallback ao LLM.
 * Casos obvios sao resolvidos localmente para ficar mais rapido e previsivel.
 */
export class SkillRouter {
  private provider: ILlmProvider;

  constructor(provider: ILlmProvider) {
    this.provider = provider;
  }

  public async route(userMessage: string, skills: SkillMetadata[]): Promise<string | null> {
    const selection = await this.routeSelection(userMessage, skills);
    return selection.primarySkillName;
  }

  public async routeSelection(userMessage: string, skills: SkillMetadata[]): Promise<SkillSelection> {
    if (skills.length === 0) {
      return { primarySkillName: null, supportSkillName: null };
    }

    const heuristicSelection = this.routeWithHeuristics(userMessage, skills);
    if (heuristicSelection?.confidence === 'high') {
      console.log(`[SkillRouter] Heuristica forte: ${heuristicSelection.reason}`);
      return {
        primarySkillName: heuristicSelection.primarySkillName,
        supportSkillName: heuristicSelection.supportSkillName,
      };
    }

    const llmSelection = await this.routeWithLlm(userMessage, skills);
    const mergedSelection = this.mergeSelections(heuristicSelection, llmSelection, skills);

    if (!llmSelection.primarySkillName && heuristicSelection) {
      console.log(`[SkillRouter] Fallback heuristico: ${heuristicSelection.reason}`);
    }

    console.log(
      `Skills selecionadas: principal=${mergedSelection.primarySkillName || 'nenhuma'}, apoio=${mergedSelection.supportSkillName || 'nenhuma'}`
    );
    return mergedSelection;
  }

  private async routeWithLlm(userMessage: string, skills: SkillMetadata[]): Promise<SkillSelection> {
    const skillsList = skills
      .map((skill) => `- "${skill.name}": ${skill.description}`)
      .join('\n');

    const routerPrompt = `Voce e um roteador de intencoes. Sua UNICA funcao e analisar a mensagem do usuario e decidir qual habilidade principal deve liderar a resposta e se uma skill de apoio adicional melhoraria o resultado.\n\nSkills disponiveis:\n${skillsList}\n\nREGRAS:\n1. Responda APENAS com um JSON valido no formato: {"primarySkillName": "nome-da-skill-ou-null", "supportSkillName": "nome-da-skill-ou-null"}\n2. Escolha no maximo uma skill principal e uma skill de apoio.\n3. Use a skill de apoio APENAS quando ela melhorar materialmente a qualidade da resposta.\n4. Nunca repita a mesma skill nos dois campos.\n5. Se a mensagem for uma conversa casual que nenhuma skill cobre, retorne ambos os campos como null.\n6. Se o usuario pedir explicitamente um modo ou skill, honre isso quando fizer sentido.\n7. Dica de prioridade: bugs e erros tendem a usar debugging; pedidos de requisitos tendem a usar requirements-analysis; arquitetura tende a usar system-design; pesquisa academica tende a usar discover-research; demandas universitarias tendem a usar super-agente-universitario; orquestracao multi-etapas tende a usar zavorth-maestro.\n8. Nao adicione texto antes ou depois do JSON.`;

    const messages: ChatMessage[] = [
      { role: 'system', content: routerPrompt },
      { role: 'user', content: userMessage },
    ];

    try {
      const response = await this.provider.chat(messages);

      if (!response.content) {
        return { primarySkillName: null, supportSkillName: null };
      }

      const jsonMatch = response.content.match(/\{[\s\S]*?\}/);
      if (!jsonMatch) {
        console.warn('Resposta do LLM nao contem JSON valido para routeSelection.');
        return { primarySkillName: null, supportSkillName: null };
      }

      const parsed = JSON.parse(jsonMatch[0]) as {
        primarySkillName?: string | null;
        supportSkillName?: string | null;
        skillName?: string | null;
        skillNames?: Array<string | null>;
      };

      return this.normalizeSelection(parsed, skills);
    } catch (error) {
      console.warn(`Erro no routeSelection: ${error}. Fallback para heuristica ou modo livre.`);
      return { primarySkillName: null, supportSkillName: null };
    }
  }

  private routeWithHeuristics(userMessage: string, skills: SkillMetadata[]): HeuristicSelection | null {
    const normalizedMessage = this.normalizeText(userMessage);
    const explicitMentions = this.findExplicitSkillMentions(normalizedMessage, skills);

    if (explicitMentions.length > 0) {
      return {
        primarySkillName: explicitMentions[0] ?? null,
        supportSkillName: explicitMentions[1] ?? null,
        confidence: 'high',
        reason: `pedido explicito de skill (${explicitMentions.join(', ')})`,
      };
    }

    const scores = this.scoreSkills(normalizedMessage, skills);
    const primarySkillName = this.choosePrimarySkill(normalizedMessage, scores);
    if (!primarySkillName) {
      return null;
    }

    const supportSkillName = this.chooseSupportSkill(normalizedMessage, primarySkillName, scores);
    const primaryScore = this.getScore(scores, primarySkillName);
    const supportScore = supportSkillName ? this.getScore(scores, supportSkillName) : 0;
    const secondScore = this.getSecondHighestScore(scores, primarySkillName, supportSkillName);
    const confidence = this.getHeuristicConfidence(primarySkillName, primaryScore, supportScore, secondScore);

    if (!confidence) {
      return null;
    }

    return {
      primarySkillName,
      supportSkillName,
      confidence,
      reason: `intencao dominante (${primarySkillName}:${primaryScore}${supportSkillName ? `, ${supportSkillName}:${supportScore}` : ''})`,
    };
  }

  private mergeSelections(
    heuristicSelection: HeuristicSelection | null,
    llmSelection: SkillSelection,
    skills: SkillMetadata[]
  ): SkillSelection {
    if (!heuristicSelection) {
      return llmSelection;
    }

    const mergedSelection: SkillSelection = {
      primarySkillName: llmSelection.primarySkillName,
      supportSkillName: llmSelection.supportSkillName,
    };

    if (!mergedSelection.primarySkillName) {
      mergedSelection.primarySkillName = heuristicSelection.primarySkillName;
      mergedSelection.supportSkillName = heuristicSelection.supportSkillName;
      return this.normalizeSelection(mergedSelection, skills);
    }

    if (
      mergedSelection.primarySkillName === heuristicSelection.primarySkillName &&
      !mergedSelection.supportSkillName &&
      heuristicSelection.supportSkillName
    ) {
      mergedSelection.supportSkillName = heuristicSelection.supportSkillName;
    }

    return this.normalizeSelection(mergedSelection, skills);
  }

  private findExplicitSkillMentions(normalizedMessage: string, skills: SkillMetadata[]): string[] {
    const mentions = skills
      .map((skill) => {
        const aliases = this.getExplicitAliases(skill.name);
        let bestIndex = Number.POSITIVE_INFINITY;

        for (const alias of aliases) {
          const normalizedAlias = this.normalizePhrase(alias);
          const index = normalizedMessage.indexOf(` ${normalizedAlias} `);
          if (index !== -1 && index < bestIndex) {
            bestIndex = index;
          }
        }

        return bestIndex === Number.POSITIVE_INFINITY
          ? null
          : { skillName: skill.name, index: bestIndex };
      })
      .filter((item): item is { skillName: string; index: number } => item !== null)
      .sort((a, b) => a.index - b.index);

    return Array.from(new Set(mentions.map((item) => item.skillName)));
  }

  private getExplicitAliases(skillName: string): string[] {
    const aliases = new Set<string>();
    aliases.add(skillName);
    aliases.add(skillName.replace(/-/g, ' '));

    for (const alias of EXPLICIT_SKILL_ALIASES[skillName] ?? []) {
      aliases.add(alias);
    }

    return Array.from(aliases);
  }

  private scoreSkills(normalizedMessage: string, skills: SkillMetadata[]): Map<string, number> {
    const availableSkillNames = new Set(skills.map((skill) => skill.name));
    const scores = new Map<string, number>();

    for (const skill of skills) {
      scores.set(skill.name, 0);
    }

    for (const rule of HEURISTIC_RULES) {
      if (!availableSkillNames.has(rule.skillName)) {
        continue;
      }

      let matches = 0;
      for (const pattern of rule.patterns) {
        if (this.containsPhrase(normalizedMessage, pattern)) {
          matches += 1;
        }
      }

      if (matches > 0) {
        scores.set(rule.skillName, (scores.get(rule.skillName) ?? 0) + matches * rule.weight);
      }
    }

    return scores;
  }

  private choosePrimarySkill(normalizedMessage: string, scores: Map<string, number>): string | null {
    const orchestrationScore = this.getScore(scores, 'zavorth-maestro');
    const debuggingScore = this.getScore(scores, 'debugging');
    const requirementsScore = this.getScore(scores, 'requirements-analysis');
    const designScore = this.getScore(scores, 'system-design');
    const researchScore = this.getScore(scores, 'discover-research');
    const universityScore = this.getScore(scores, 'super-agente-universitario');

    if (orchestrationScore >= 4 && this.getTopDomainScore(scores, 'zavorth-maestro') >= 2) {
      return 'zavorth-maestro';
    }

    if (debuggingScore >= 4 && designScore >= 2) {
      return 'debugging';
    }

    if (requirementsScore >= 3 && designScore >= 3) {
      return requirementsScore >= designScore ? 'requirements-analysis' : 'system-design';
    }

    if (researchScore >= 3 && universityScore >= 3) {
      return this.hasAnyPattern(normalizedMessage, STUDY_FOCUS_PATTERNS)
        ? 'super-agente-universitario'
        : 'discover-research';
    }

    const sortedScores = Array.from(scores.entries())
      .filter(([skillName]) => skillName !== 'general')
      .sort((a, b) => b[1] - a[1]);

    if (sortedScores.length === 0 || sortedScores[0][1] < 3) {
      return null;
    }

    return sortedScores[0][0];
  }

  private chooseSupportSkill(
    normalizedMessage: string,
    primarySkillName: string,
    scores: Map<string, number>
  ): string | null {
    switch (primarySkillName) {
      case 'zavorth-maestro':
        return this.pickBestScoredSkill(scores, [
          'discover-research',
          'requirements-analysis',
          'debugging',
          'system-design',
          'super-agente-universitario',
        ]);
      case 'debugging':
        return this.getScore(scores, 'system-design') >= 2 ? 'system-design' : null;
      case 'requirements-analysis':
        if (this.getScore(scores, 'system-design') >= 2) {
          return 'system-design';
        }
        return this.getScore(scores, 'super-agente-universitario') >= 2
          ? 'super-agente-universitario'
          : null;
      case 'system-design':
        if (this.getScore(scores, 'requirements-analysis') >= 2) {
          return 'requirements-analysis';
        }
        return this.getScore(scores, 'debugging') >= 2 ? 'debugging' : null;
      case 'discover-research':
        return this.getScore(scores, 'super-agente-universitario') >= 2
          ? 'super-agente-universitario'
          : null;
      case 'super-agente-universitario':
        if (this.hasAnyPattern(normalizedMessage, RESEARCH_FOCUS_PATTERNS) && this.getScore(scores, 'discover-research') >= 2) {
          return 'discover-research';
        }
        if (this.getScore(scores, 'requirements-analysis') >= 2) {
          return 'requirements-analysis';
        }
        return this.getScore(scores, 'system-design') >= 2 ? 'system-design' : null;
      default:
        return null;
    }
  }

  private pickBestScoredSkill(scores: Map<string, number>, candidates: string[]): string | null {
    const rankedCandidates = candidates
      .map((skillName) => ({ skillName, score: this.getScore(scores, skillName) }))
      .filter((candidate) => candidate.score >= 2)
      .sort((a, b) => b.score - a.score);

    return rankedCandidates[0]?.skillName ?? null;
  }

  private getHeuristicConfidence(
    primarySkillName: string,
    primaryScore: number,
    supportScore: number,
    secondScore: number
  ): RoutingConfidence | null {
    if (primaryScore >= 6) {
      return 'high';
    }

    if (primarySkillName === 'zavorth-maestro' && primaryScore >= 4 && supportScore >= 2) {
      return 'high';
    }

    if (primaryScore >= 4 && supportScore >= 2) {
      return 'high';
    }

    if (primaryScore >= 4 && primaryScore - secondScore >= 2) {
      return 'high';
    }

    if (primaryScore >= 3) {
      return 'medium';
    }

    return null;
  }

  private getTopDomainScore(scores: Map<string, number>, excludedSkillName: string): number {
    return Array.from(scores.entries())
      .filter(([skillName]) => skillName !== excludedSkillName && skillName !== 'general')
      .map(([, score]) => score)
      .sort((a, b) => b - a)[0] ?? 0;
  }

  private getSecondHighestScore(
    scores: Map<string, number>,
    primarySkillName: string,
    supportSkillName: string | null
  ): number {
    return Array.from(scores.entries())
      .filter(([skillName]) => skillName !== primarySkillName && skillName !== supportSkillName && skillName !== 'general')
      .map(([, score]) => score)
      .sort((a, b) => b - a)[0] ?? 0;
  }

  private hasAnyPattern(normalizedMessage: string, patterns: string[]): boolean {
    return patterns.some((pattern) => this.containsPhrase(normalizedMessage, pattern));
  }

  private containsPhrase(normalizedMessage: string, phrase: string): boolean {
    const normalizedPhrase = this.normalizePhrase(phrase);
    if (!normalizedPhrase) {
      return false;
    }

    return normalizedMessage.includes(` ${normalizedPhrase} `);
  }

  private normalizeText(text: string): string {
    const normalized = text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    return ` ${normalized} `;
  }

  private normalizePhrase(text: string): string {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private getScore(scores: Map<string, number>, skillName: string): number {
    return scores.get(skillName) ?? 0;
  }

  private normalizeSelection(
    parsed: {
      primarySkillName?: string | null;
      supportSkillName?: string | null;
      skillName?: string | null;
      skillNames?: Array<string | null>;
    },
    skills: SkillMetadata[]
  ): SkillSelection {
    let primarySkillName = parsed.primarySkillName ?? parsed.skillName ?? null;
    let supportSkillName = parsed.supportSkillName ?? null;

    if (Array.isArray(parsed.skillNames)) {
      primarySkillName = parsed.skillNames[0] ?? primarySkillName ?? null;
      supportSkillName = parsed.skillNames[1] ?? supportSkillName ?? null;
    }

    primarySkillName = this.validateSkillName(primarySkillName, skills);
    supportSkillName = this.validateSkillName(supportSkillName, skills);

    if (!primarySkillName && supportSkillName) {
      primarySkillName = supportSkillName;
      supportSkillName = null;
    }

    if (primarySkillName && supportSkillName && primarySkillName === supportSkillName) {
      supportSkillName = null;
    }

    return { primarySkillName, supportSkillName };
  }

  private validateSkillName(skillName: string | null | undefined, skills: SkillMetadata[]): string | null {
    if (!skillName || typeof skillName !== 'string') {
      return null;
    }

    const normalizedSkillName = skillName.trim();
    if (!normalizedSkillName) {
      return null;
    }

    const exists = skills.some((skill) => skill.name === normalizedSkillName);
    if (!exists) {
      console.warn(`Skill "${normalizedSkillName}" nao encontrada nas disponiveis.`);
      return null;
    }

    return normalizedSkillName;
  }
}
