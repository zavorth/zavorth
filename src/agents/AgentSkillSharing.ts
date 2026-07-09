import fs from 'fs';
import path from 'path';
import { logger } from '../logger.js';

export type SharedSkill = {
  id: string;
  name: string;
  description: string;
  sourceAgentId: string;
  category: string;
  version: string;
  content: string;
  parameters: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  usageCount: number;
  successRate: number;
  avgDurationMs: number;
  tags: string[];
};

export type SkillShareConfig = {
  maxSkills?: number;
  requireApproval?: boolean;
  allowedCategories?: string[];
};

export type SkillShareRuntime = {
  now?: () => Date;
  dataDir?: string;
  config?: SkillShareConfig;
  logger?: typeof logger;
};

const DEFAULT_CONFIG: Required<SkillShareConfig> = {
  maxSkills: 200,
  requireApproval: true,
  allowedCategories: ['development', 'analysis', 'review', 'testing', 'documentation', 'automation'],
};

export class AgentSkillSharing {
  private readonly now: () => Date;
  private readonly dataDir: string;
  private readonly skillsFile: string;
  private readonly config: Required<SkillShareConfig>;
  private readonly log: typeof logger;

  constructor(runtime: SkillShareRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.dataDir = runtime.dataDir || path.join(process.cwd(), 'data', 'runtime', 'shared-skills');
    this.skillsFile = path.join(this.dataDir, 'skills.json');
    this.config = { ...DEFAULT_CONFIG, ...runtime.config };
    this.log = runtime.logger || logger;
  }

  public share(skill: Omit<SharedSkill, 'id' | 'createdAt' | 'updatedAt' | 'usageCount' | 'successRate' | 'avgDurationMs'>): SharedSkill {
    if (this.config.allowedCategories.length > 0 && !this.config.allowedCategories.includes(skill.category)) {
      throw new Error(`Category "${skill.category}" is not allowed. Allowed: ${this.config.allowedCategories.join(', ')}`);
    }

    const existing = this.readSkills();
    if (existing.length >= this.config.maxSkills) {
      throw new Error(`Skill store is full (${this.config.maxSkills} skills)`);
    }

    const fullSkill: SharedSkill = {
      ...skill,
      id: `${skill.sourceAgentId}-${skill.name}-${Date.now()}`,
      createdAt: this.now().toISOString(),
      updatedAt: this.now().toISOString(),
      usageCount: 0,
      successRate: 0,
      avgDurationMs: 0,
    };

    const skills = this.readSkills();
    skills.push(fullSkill);
    this.writeSkills(skills);

    this.log.info(`[SkillSharing] Shared skill "${skill.name}" from ${skill.sourceAgentId}`);
    return fullSkill;
  }

  public find(skillName: string, agentId?: string): SharedSkill | null {
    const skills = this.readSkills();
    return skills.find((s) => {
      if (s.name !== skillName) return false;
      if (agentId && s.sourceAgentId !== agentId) return false;
      return true;
    }) || null;
  }

  public list(options?: { category?: string; agentId?: string; tags?: string[] }): SharedSkill[] {
    const skills = this.readSkills();
    return skills.filter((s) => {
      if (options?.category && s.category !== options.category) return false;
      if (options?.agentId && s.sourceAgentId !== options.agentId) return false;
      if (options?.tags && options.tags.length > 0) {
        const hasTag = options.tags.some((tag) => s.tags.includes(tag));
        if (!hasTag) return false;
      }
      return true;
    });
  }

  public recordUsage(skillId: string, success: boolean, durationMs: number): void {
    const skills = this.readSkills();
    const skill = skills.find((s) => s.id === skillId);

    if (!skill) return;

    skill.usageCount++;
    skill.avgDurationMs = Math.round(
      (skill.avgDurationMs * (skill.usageCount - 1) + durationMs) / skill.usageCount,
    );
    skill.successRate = success
      ? (skill.successRate * (skill.usageCount - 1) + 1) / skill.usageCount
      : (skill.successRate * (skill.usageCount - 1)) / skill.usageCount;
    skill.updatedAt = this.now().toISOString();

    this.writeSkills(skills);
  }

  public remove(skillId: string): boolean {
    const skills = this.readSkills();
    const index = skills.findIndex((s) => s.id === skillId);

    if (index < 0) return false;

    skills.splice(index, 1);
    this.writeSkills(skills);
    return true;
  }

  public getStats(): { total: number; byCategory: Record<string, number>; byAgent: Record<string, number> } {
    const skills = this.readSkills();
    const byCategory: Record<string, number> = {};
    const byAgent: Record<string, number> = {};

    for (const skill of skills) {
      byCategory[skill.category] = (byCategory[skill.category] || 0) + 1;
      byAgent[skill.sourceAgentId] = (byAgent[skill.sourceAgentId] || 0) + 1;
    }

    return { total: skills.length, byCategory, byAgent };
  }

  public formatSkillList(skills: SharedSkill[]): string {
    const lines: string[] = [];
    lines.push('Shared Skills');
    lines.push(`${'═'.repeat(60)}`);

    if (skills.length === 0) {
      lines.push('No skills shared yet.');
      return lines.join('\n');
    }

    const byCategory = new Map<string, SharedSkill[]>();
    for (const skill of skills) {
      if (!byCategory.has(skill.category)) byCategory.set(skill.category, []);
      byCategory.get(skill.category)!.push(skill);
    }

    for (const [category, categorySkills] of byCategory) {
      lines.push(`\n${category}:`);
      lines.push(`${'─'.repeat(60)}`);
      for (const skill of categorySkills) {
        lines.push(`  ${skill.name} (${skill.sourceAgentId})`);
        lines.push(`    ${skill.description}`);
        lines.push(`    Used: ${skill.usageCount}x | Success: ${(skill.successRate * 100).toFixed(0)}% | Avg: ${skill.avgDurationMs}ms`);
      }
    }

    return lines.join('\n');
  }

  private readSkills(): SharedSkill[] {
    try {
      if (!fs.existsSync(this.skillsFile)) return [];
      return JSON.parse(fs.readFileSync(this.skillsFile, 'utf-8')) as SharedSkill[];
    } catch (error: any) { const err = error; const e = error; logger.warn('[Agent Skill Sharing] JSON parse failed', error); return []; }
  }

  private writeSkills(skills: SharedSkill[]): void {
    fs.mkdirSync(path.dirname(this.skillsFile), { recursive: true });
    fs.writeFileSync(this.skillsFile, JSON.stringify(skills, null, 2), 'utf-8');
  }
}
