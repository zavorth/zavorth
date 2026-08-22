import { logger } from '../logger.js';
import { SkillLoader, SkillMetadata } from './SkillLoader.js';

export interface ActiveSkill {
  metadata: SkillMetadata;
  role: 'primary' | 'support';
}

/**
 * SkillExecutor - assembles the context of active skills.
 */
export class SkillExecutor {
  private loader: SkillLoader;

  constructor(loader: SkillLoader) {
    this.loader = loader;
  }

  public getSkillPrompt(skillName: string, skills: SkillMetadata[]): string {
    const skill = skills.find((item) => item.name === skillName);

    if (!skill) {
      logger.warn(`Skill "${skillName}" not found.`);
      return '';
    }

    const content = this.loader.getSkillContent(skill.dirPath);

    if (!content) {
      logger.warn(`Empty content for skill "${skillName}".`);
      return '';
    }

    logger.info(`Skill "${skillName}" loaded (${content.length} chars)`);
    return content;
  }

  public getComposedSkillPrompt(activeSkills: ActiveSkill[]): string {
    if (activeSkills.length === 0) {
      return '';
    }

    const sections: string[] = [];

    for (const activeSkill of activeSkills) {
      const content = this.loader.buildSkillPrompt(activeSkill.metadata);

      if (!content) {
        logger.warn(`Empty content for skill "${activeSkill.metadata.name}".`);
        continue;
      }

      const label = activeSkill.role === 'primary' ? 'SKILL PRIMARIA' : 'SKILL DE APOIO';
      sections.push(`### ${label}: ${activeSkill.metadata.name}\n${content}`);
    }

    if (sections.length === 0) {
      return '';
    }

    logger.info(`Skills injetadas: ${activeSkills.map((skill) => skill.metadata.name).join(', ')}`);
    return sections.join('\n\n');
  }
}
