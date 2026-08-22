import * as fs from 'node:fs';
import * as path from 'node:path';

export type SkillLifecycleStatus = 'active' | 'stale' | 'archived';

export interface SkillUsageMetadata {
  readonly skillId: string;
  readonly name: string;
  readonly status: SkillLifecycleStatus;
  readonly lastUsedTimestamp: number;
  readonly totalInvocations: number;
  readonly skillPath: string;
}

export interface SkillLifecycleAuditReport {
  readonly timestamp: number;
  readonly totalSkills: number;
  readonly activeCount: number;
  readonly staleCount: number;
  readonly archivedCount: number;
  readonly transitions: readonly { skillId: string; from: SkillLifecycleStatus; to: SkillLifecycleStatus }[];
}

export interface SkillSynthesisInput {
  readonly skillName: string;
  readonly description: string;
  readonly promptInstructions: string;
  readonly allowedTools?: readonly string[];
}

export interface DraftSkillResult {
  readonly success: boolean;
  readonly skillId: string;
  readonly skillDirectory: string;
  readonly skillManifestPath: string;
  readonly error?: string;
}

export class SkillLifecycleCuratorService {
  private readonly usageRegistry = new Map<string, SkillUsageMetadata>();
  private readonly projectRoot: string;

  constructor(options: { projectRoot?: string } = {}) {
    this.projectRoot = options.projectRoot || process.cwd();
  }

  public recordUsage(skillId: string, skillPath = ''): void {
    const existing = this.usageRegistry.get(skillId);
    const now = Date.now();

    this.usageRegistry.set(skillId, {
      skillId,
      name: existing?.name || skillId,
      status: 'active',
      lastUsedTimestamp: now,
      totalInvocations: (existing?.totalInvocations || 0) + 1,
      skillPath: skillPath || existing?.skillPath || '',
    });
  }

  public auditSkillLifecycles(customSkillsDir?: string): SkillLifecycleAuditReport {
    customSkillsDir || path.join(this.projectRoot, '.zavorth', 'skills');
    const now = Date.now();
    const STALE_THRESHOLD_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
    const ARCHIVE_THRESHOLD_MS = 90 * 24 * 60 * 60 * 1000; // 90 days

    const transitions: { skillId: string; from: SkillLifecycleStatus; to: SkillLifecycleStatus }[] = [];
    let activeCount = 0;
    let staleCount = 0;
    let archivedCount = 0;

    for (const [id, meta] of this.usageRegistry.entries()) {
      const elapsed = now - meta.lastUsedTimestamp;
      let newStatus: SkillLifecycleStatus = meta.status;

      if (elapsed > ARCHIVE_THRESHOLD_MS) {
        newStatus = 'archived';
      } else if (elapsed > STALE_THRESHOLD_MS) {
        newStatus = 'stale';
      } else {
        newStatus = 'active';
      }

      if (newStatus !== meta.status) {
        transitions.push({ skillId: id, from: meta.status, to: newStatus });
        this.usageRegistry.set(id, { ...meta, status: newStatus });
      }

      if (newStatus === 'active') activeCount++;
      else if (newStatus === 'stale') staleCount++;
      else if (newStatus === 'archived') archivedCount++;
    }

    return {
      timestamp: now,
      totalSkills: this.usageRegistry.size,
      activeCount,
      staleCount,
      archivedCount,
      transitions,
    };
  }

  public synthesizeDraftSkill(input: SkillSynthesisInput, outputDir?: string): DraftSkillResult {
    const baseDir = outputDir || path.join(this.projectRoot, '.zavorth', 'skills');
    const safeName = input.skillName.toLowerCase().replace(/[^a-z0-9_-]+/g, '-');
    const skillDirectory = path.join(baseDir, safeName);
    const skillManifestPath = path.join(skillDirectory, 'SKILL.md');

    try {
      if (!fs.existsSync(skillDirectory)) {
        fs.mkdirSync(skillDirectory, { recursive: true });
      }

      const toolsList = input.allowedTools && input.allowedTools.length > 0
        ? input.allowedTools.map((t) => `  - ${t}`).join('\n')
        : '  - read_file\n  - write_to_file\n  - run_command';

      const markdownContent = [
        '---',
        `name: ${safeName}`,
        `description: ${input.description}`,
        'tools:',
        toolsList,
        '---',
        '',
        `# Skill: ${input.skillName}`,
        '',
        input.description,
        '',
        '## Instructions',
        '',
        input.promptInstructions,
        '',
      ].join('\n');

      fs.writeFileSync(skillManifestPath, markdownContent, 'utf8');

      this.recordUsage(safeName, skillDirectory);

      return {
        success: true,
        skillId: safeName,
        skillDirectory,
        skillManifestPath,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        skillId: safeName,
        skillDirectory,
        skillManifestPath,
        error: `Failed to synthesize draft skill: ${message}`,
      };
    }
  }
}
