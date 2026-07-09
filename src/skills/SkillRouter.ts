import { logger } from '../logger.js';
import { ILlmProvider, ChatMessage } from '../providers/ILlmProvider.js';
import { SkillMetadata } from './SkillLoader.js';export interface SkillSelection {
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
  'zavorth-maestro': ['zavorth maestro', 'maestro mode', 'maestro'],
  'discover-research': ['discover research'],
  'requirements-analysis': ['requirements analysis'],
  'system-design': ['system design'],
};

const HEURISTIC_RULES: KeywordRule[] = [
  {
    skillName: 'zavorth-maestro',
    weight: 3,
    patterns: [
      'coordinate',
      'orchestrate',
      'workflow',
      'pipeline',
      'in stages',
      'multiple stages',
      'multiple deliveries',
      'multiple deliverables',
      'execution plan',
      'combine as skills',
      'organize this project into stages',
    ],
  },
  {
    skillName: 'debugging',
    weight: 3,
    patterns: [
      'bug',
      'error',
      'failure',
      'stack trace',
      'exception',
      'crash',
      'hang',
      'broken',
      'does not work',
      'not working',
      'debugging',
      'debug',
      'broken test',
      'test failed',
      'root cause',
    ],
  },
  {
    skillName: 'requirements-analysis',
    weight: 2,
    patterns: [
      'requirement',
      'requirements',
      'specification',
      'scope',
      'acceptance criterion',
      'acceptance criteria',
      'assignment',
      'exam',
      'mock exam',
      'exam questions',
      'user story',
      'user stories',
      'mvp',
      'briefing',
      'backlog',
      'use case',
      'functional',
      'non functional',
      'vague idea',
    ],
  },
  {
    skillName: 'system-design',
    weight: 2,
    patterns: [
      'architecture',
      'system design',
      'design the system',
      'components',
      'integration',
      'integrations',
      'data flow',
      'scalability',
      'latency',
      'queue',
      'queues',
      'database',
      'api',
      'apis',
      'microservice',
      'microservices',
      'monolith',
      'trade off',
      'trade offs',
      'architect',
    ],
  },
  {
    skillName: 'discover-research',
    weight: 2,
    patterns: [
      'research',
      'literature review',
      'theoretical framework',
      'bibliography',
      'academic sources',
      'scientific articles',
      'academic article',
      'paper',
      'papers',
      'methodology',
      'state of the art',
      'evidence',
      'academic synthesis',
      'literature map',
      'scientific literature',
      'university',
      'college',
      'course',
      'professor',
      'thesis',
      'class',
      'study',
      'study plan',
      'seminar',
    ],
  },
];

const STUDY_FOCUS_PATTERNS = [
  'study',
  'exam',
  'mock exam',
  'assignment',
  'study plan',
  'exam questions',
  'explain the subject',
  'study summary',
];

/**
 * SkillRouter - combines deterministic heuristics with an LLM fallback.
 * Obvious cases are resolved locally so routing stays fast and predictable.
 */
export class SkillRouter {
  private provider: ILlmProvider;

  constructor(provider: ILlmProvider) {
    this.provider = provider;
  }

  public async route(userMessage: string, skills: SkillMetadata[]): Promise<string | null> {
    const selection = await this.routeSelection(userMessage, skills);
    if (selection.primarySkillName) {
      await this.logTelemetry(selection.primarySkillName);
    }
    if (selection.supportSkillName) {
      await this.logTelemetry(selection.supportSkillName);
    }
    return selection.primarySkillName;
  }

  private async logTelemetry(skillId: string): Promise<void> {
    try {
      const { Database } = await import('../storage/Database.js');
      const db = await Database.getInstance();
      db.run(`
        INSERT INTO zavorth_skills_telemetry (skill_id, use_count, last_executed_at, status, pinned)
        VALUES (?, 1, datetime('now'), 'active', 0)
        ON CONFLICT(skill_id) DO UPDATE SET
          use_count = use_count + 1,
          last_executed_at = datetime('now')
      `, [skillId]);
    } catch (error: unknown) {logger.warn(`[SkillRouter] Failed to record telemetry for skill ${skillId}:`, error);
    }
  }

  public async routeSelection(userMessage: string, skills: SkillMetadata[]): Promise<SkillSelection> {
    if (skills.length === 0) {
      return { primarySkillName: null, supportSkillName: null };
    }

    const heuristicSelection = this.routeWithHeuristics(userMessage, skills);
    if (heuristicSelection?.confidence === 'high') {
      logger.info(`[SkillRouter] Strong heuristic: ${heuristicSelection.reason}`);
      return {
        primarySkillName: heuristicSelection.primarySkillName,
        supportSkillName: heuristicSelection.supportSkillName,
      };
    }

    const llmSelection = await this.routeWithLlm(userMessage, skills);
    const mergedSelection = this.mergeSelections(heuristicSelection, llmSelection, skills);

    if (!llmSelection.primarySkillName && heuristicSelection) {
      logger.info(`[SkillRouter] Heuristic fallback: ${heuristicSelection.reason}`);
    }

    logger.info(
      `Selected skills: primary=${mergedSelection.primarySkillName || 'none'}, support=${mergedSelection.supportSkillName || 'none'}`
    );
    return mergedSelection;
  }

  private async routeWithLlm(userMessage: string, skills: SkillMetadata[]): Promise<SkillSelection> {
    const skillsList = skills
      .map((skill) => `- "${skill.name}": ${skill.description}`)
      .join('\n');

    const routerPrompt = `You are an intent router. Your ONLY function is to analyze the user message and decide which primary skill should lead the response and whether an additional support skill would improve the result.\n\nAvailable skills:\n${skillsList}\n\nRULES:\n1. Reply ONLY with valid JSON in this format: {"primarySkillName": "skill-name-or-null", "supportSkillName": "skill-name-or-null"}\n2. Choose at most one primary skill and one support skill.\n3. Use the support skill ONLY when it materially improves response quality.\n4. Never repeat the same skill in both fields.\n5. If the message is casual conversation that no skill covers, return null for both fields.\n6. If the user explicitly requests a mode or skill, honor it when it makes sense.\n7. Priority hint: bugs and errors usually use debugging; requirement, delivery, proof, and task requests usually use requirements-analysis; architecture usually uses system-design; research, study, papers, and academic literature usually use discover-research; multi-step orchestration usually uses zavorth-maestro.\n8. Do not add text before or after the JSON.`;

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
        logger.warn('LLM response does not contain valid JSON for routeSelection.');
        return { primarySkillName: null, supportSkillName: null };
      }

      const parsed = JSON.parse(jsonMatch[0]) as {
        primarySkillName?: string | null;
        supportSkillName?: string | null;
        skillName?: string | null;
        skillNames?: Array<string | null>;
      };

      return this.normalizeSelection(parsed, skills);
    } catch (error: unknown) {logger.warn(`routeSelection error: ${error}. Falling back to heuristics or free mode.`);
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
        reason: `explicit skill request (${explicitMentions.join(', ')})`,
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
      reason: `dominant intent (${primarySkillName}:${primaryScore}${supportSkillName ? `, ${supportSkillName}:${supportScore}` : ''})`,
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

    if (orchestrationScore >= 4 && this.getTopDomainScore(scores, 'zavorth-maestro') >= 2) {
      return 'zavorth-maestro';
    }

    if (debuggingScore >= 4 && designScore >= 2) {
      return 'debugging';
    }

    if (requirementsScore >= 3 && designScore >= 3) {
      return requirementsScore >= designScore ? 'requirements-analysis' : 'system-design';
    }

    if (researchScore >= 3 && requirementsScore >= 3) {
      return this.hasAnyPattern(normalizedMessage, STUDY_FOCUS_PATTERNS)
        ? 'requirements-analysis'
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
        ]);
      case 'debugging':
        return this.getScore(scores, 'system-design') >= 2 ? 'system-design' : null;
      case 'requirements-analysis':
        if (this.getScore(scores, 'system-design') >= 2) {
          return 'system-design';
        }
        return this.getScore(scores, 'discover-research') >= 2 ? 'discover-research' : null;
      case 'system-design':
        if (this.getScore(scores, 'requirements-analysis') >= 2) {
          return 'requirements-analysis';
        }
        return this.getScore(scores, 'debugging') >= 2 ? 'debugging' : null;
      case 'discover-research':
        if (this.getScore(scores, 'requirements-analysis') >= 2) {
          return 'requirements-analysis';
        }
        return null;
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
      logger.warn(`Skill "${normalizedSkillName}" was not found in the available skills.`);
      return null;
    }

    return normalizedSkillName;
  }
}
