import { logger } from '../logger.js';
import { ILlmProvider, ChatMessage } from '../providers/ILlmProvider.js';
import { SkillMetadata } from './SkillLoader.js';

export interface SkillSelection {
  primarySkillName: string | null;
  supportSkillName: string | null;
}

interface ExplicitSelection extends SkillSelection {
  reason: string;
}

const EXPLICIT_SKILL_ALIASES: Record<string, string[]> = {
  'zavorth-maestro': ['zavorth maestro', 'maestro mode', 'maestro'],
  'discover-research': ['discover research'],
  'requirements-analysis': ['requirements analysis'],
  'system-design': ['system design'],
};

/**
 * SkillRouter — free-text skill choice is model-owned (LLM only).
 * Explicit skill ids/aliases may short-circuit. No keyword soft-rank layer.
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
      db.run(
        `
        INSERT INTO zavorth_skills_telemetry (skill_id, use_count, last_executed_at, status, pinned)
        VALUES (?, 1, datetime('now'), 'active', 0)
        ON CONFLICT(skill_id) DO UPDATE SET
          use_count = use_count + 1,
          last_executed_at = datetime('now')
      `,
        [skillId],
      );
    } catch (error: unknown) {
      logger.warn(`[SkillRouter] Failed to record telemetry for skill ${skillId}:`, error);
    }
  }

  public async routeSelection(userMessage: string, skills: SkillMetadata[]): Promise<SkillSelection> {
    if (skills.length === 0) {
      return { primarySkillName: null, supportSkillName: null };
    }

    const explicitSelection = this.routeWithExplicitSkillIds(userMessage, skills);
    if (explicitSelection) {
      logger.info(`[SkillRouter] Explicit skill request: ${explicitSelection.reason}`);
      return {
        primarySkillName: explicitSelection.primarySkillName,
        supportSkillName: explicitSelection.supportSkillName,
      };
    }

    const llmSelection = await this.routeWithLlm(userMessage, skills);
    const normalized = this.normalizeSelection(llmSelection, skills);
    logger.info(
      `Selected skills: primary=${normalized.primarySkillName || 'none'}, support=${normalized.supportSkillName || 'none'}`,
    );
    return normalized;
  }

  private async routeWithLlm(userMessage: string, skills: SkillMetadata[]): Promise<SkillSelection> {
    const skillsList = skills.map((skill) => `- "${skill.name}": ${skill.description}`).join('\n');

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
    } catch (error: unknown) {
      logger.warn(`routeSelection error: ${error}. Free-text selection stays empty without model output.`);
      return { primarySkillName: null, supportSkillName: null };
    }
  }

  /** Explicit skill ids/aliases only — free-text phrases must not short-circuit the LLM. */
  private routeWithExplicitSkillIds(userMessage: string, skills: SkillMetadata[]): ExplicitSelection | null {
    const normalizedMessage = this.normalizeText(userMessage);
    const explicitMentions = this.findExplicitSkillMentions(normalizedMessage, skills);
    if (explicitMentions.length === 0) {
      return null;
    }
    return {
      primarySkillName: explicitMentions[0] ?? null,
      supportSkillName: explicitMentions[1] ?? null,
      reason: `explicit skill request (${explicitMentions.join(', ')})`,
    };
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

        return bestIndex === Number.POSITIVE_INFINITY ? null : { skillName: skill.name, index: bestIndex };
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

  private normalizeSelection(
    parsed: {
      primarySkillName?: string | null;
      supportSkillName?: string | null;
      skillName?: string | null;
      skillNames?: Array<string | null>;
    },
    skills: SkillMetadata[],
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
