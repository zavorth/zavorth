import { SkillLoader, SkillMetadata } from './SkillLoader.js';

export interface ActiveSkill {
  metadata: SkillMetadata;
  role: 'primary' | 'support';
}

/**
 * SkillExecutor - monta o contexto das skills ativas.
 */
export class SkillExecutor {
  private loader: SkillLoader;

  constructor(loader: SkillLoader) {
    this.loader = loader;
  }

  public getSkillPrompt(skillName: string, skills: SkillMetadata[]): string {
    const skill = skills.find((item) => item.name === skillName);

    if (!skill) {
      console.warn(`Skill "${skillName}" nao encontrada.`);
      return '';
    }

    const content = this.loader.getSkillContent(skill.dirPath);

    if (!content) {
      console.warn(`Conteudo vazio para skill "${skillName}".`);
      return '';
    }

    console.log(`Skill "${skillName}" carregada (${content.length} chars)`);
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
        console.warn(`Conteudo vazio para skill "${activeSkill.metadata.name}".`);
        continue;
      }

      const label = activeSkill.role === 'primary' ? 'SKILL PRIMARIA' : 'SKILL DE APOIO';
      sections.push(`### ${label}: ${activeSkill.metadata.name}\n${content}`);
    }

    if (sections.length === 0) {
      return '';
    }

    console.log(`Skills injetadas: ${activeSkills.map((skill) => skill.metadata.name).join(', ')}`);
    return sections.join('\n\n');
  }
}
