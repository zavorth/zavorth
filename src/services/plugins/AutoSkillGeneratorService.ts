import fs from 'fs';
import path from 'path';

export interface WorkflowPattern {
  id: string;
  pattern: string;
  steps: string[];
  tools_used: string[];
  frequency: number;
  first_seen: string;
  last_seen: string;
  avg_duration_ms: number;
  success_rate: number;
  user_approvals: number;
}

export interface GeneratedSkill {
  id: string;
  name: string;
  description: string;
  category: string;
  pattern_id: string;
  skill_content: string;
  confidence: number;
  status: 'draft' | 'review' | 'approved' | 'rejected' | 'active';
  created_at: string;
  usage_count: number;
  quality_score: number;
}

export class AutoSkillGeneratorService {
  private readonly storageDir: string;
  private patterns: Map<string, WorkflowPattern> = new Map();
  private generatedSkills: Map<string, GeneratedSkill> = new Map();
  private readonly minFrequency = 3;
  private readonly minSuccessRate = 0.7;

  constructor(options?: { storageDir?: string }) {
    this.storageDir = options?.storageDir || path.join(process.cwd(), 'data', 'runtime', 'auto-skill');
    if (!fs.existsSync(this.storageDir)) fs.mkdirSync(this.storageDir, { recursive: true });
    this.loadData();
  }

  private loadData(): void {
    try {
      const p = path.join(this.storageDir, 'patterns.json');
      if (fs.existsSync(p)) this.patterns = new Map(Object.entries(JSON.parse(fs.readFileSync(p, 'utf-8'))));
    } catch { /* ignore */ }
    try {
      const s = path.join(this.storageDir, 'skills.json');
      if (fs.existsSync(s)) this.generatedSkills = new Map(Object.entries(JSON.parse(fs.readFileSync(s, 'utf-8'))));
    } catch { /* ignore */ }
  }

  private saveData(): void {
    fs.writeFileSync(path.join(this.storageDir, 'patterns.json'), JSON.stringify(Object.fromEntries(this.patterns), null, 2), 'utf-8');
    fs.writeFileSync(path.join(this.storageDir, 'skills.json'), JSON.stringify(Object.fromEntries(this.generatedSkills), null, 2), 'utf-8');
  }

  public recordWorkflow(toolsUsed: string[], steps: string[], success: boolean, durationMs: number): string {
    const patternKey = toolsUsed.sort().join('→');

    let pattern = this.patterns.get(patternKey);
    if (!pattern) {
      pattern = {
        id: `pat_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        pattern: patternKey,
        steps,
        tools_used: toolsUsed,
        frequency: 0,
        first_seen: new Date().toISOString(),
        last_seen: new Date().toISOString(),
        avg_duration_ms: 0,
        success_rate: 0,
        user_approvals: 0,
      };
      this.patterns.set(patternKey, pattern);
    }

    pattern.frequency++;
    pattern.last_seen = new Date().toISOString();
    pattern.avg_duration_ms = (pattern.avg_duration_ms * (pattern.frequency - 1) + durationMs) / pattern.frequency;
    pattern.success_rate = (pattern.success_rate * (pattern.frequency - 1) + (success ? 1 : 0)) / pattern.frequency;

    this.saveData();

    if (pattern.frequency >= this.minFrequency && pattern.success_rate >= this.minSuccessRate) {
      const existing = Array.from(this.generatedSkills.values()).find((s) => s.pattern_id === pattern.id);
      if (!existing) {
        return `Pattern "${patternKey}" qualifies for skill generation (${pattern.frequency} uses, ${(pattern.success_rate * 100).toFixed(0)}% success). Run "generate" to create skill.`;
      }
    }

    return `Pattern "${patternKey}" recorded (${pattern.frequency} uses, ${(pattern.success_rate * 100).toFixed(0)}% success).`;
  }

  public generateSkill(patternId: string): string {
    const pattern = this.patterns.get(patternId) || Array.from(this.patterns.values()).find((p) => p.id === patternId);
    if (!pattern) return `Error: pattern "${patternId}" not found.`;

    if (pattern.frequency < this.minFrequency) {
      return `Error: pattern needs at least ${this.minFrequency} uses (has ${pattern.frequency}).`;
    }
    if (pattern.success_rate < this.minSuccessRate) {
      return `Error: pattern success rate too low (${(pattern.success_rate * 100).toFixed(0)}%, need ${(this.minSuccessRate * 100)}%).`;
    }

    const skillId = `auto_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const category = this.inferCategory(pattern.tools_used);
    const name = this.generateName(pattern);
    const description = this.generateDescription(pattern);
    const skillContent = this.generateSkillContent(pattern, name, description);

    const skill: GeneratedSkill = {
      id: skillId,
      name,
      description,
      category,
      pattern_id: pattern.id,
      skill_content: skillContent,
      confidence: Math.min(1, pattern.success_rate * (pattern.frequency / 10)),
      status: 'draft',
      created_at: new Date().toISOString(),
      usage_count: 0,
      quality_score: 0,
    };

    this.generatedSkills.set(skillId, skill);
    this.saveData();

    return [
      `Auto-generated skill:`,
      `  ID: ${skillId}`,
      `  Name: ${name}`,
      `  Category: ${category}`,
      `  Confidence: ${(skill.confidence * 100).toFixed(0)}%`,
      `  Pattern: ${pattern.pattern} (${pattern.frequency} uses)`,
      `  Status: draft (needs review)`,
    ].join('\n');
  }

  public approveSkill(skillId: string): string {
    const skill = this.generatedSkills.get(skillId);
    if (!skill) return `Error: skill "${skillId}" not found.`;

    skill.status = 'approved';
    this.saveData();

    const skillDir = path.join(process.cwd(), 'skill-library', 'native', skillId);
    if (!fs.existsSync(skillDir)) fs.mkdirSync(skillDir, { recursive: true });

    fs.writeFileSync(path.join(skillDir, 'SKILL.md'), skill.skill_content, 'utf-8');
    fs.writeFileSync(path.join(skillDir, 'ZAVORTH_NATIVE_SKILL.json'), JSON.stringify({
      id: skillId,
      name: skill.name,
      native: true,
      description: skill.description,
      category: skill.category,
      permissionProfileId: 'workspace-read',
      riskLevel: 'low',
      capabilityTags: ['auto-generated', skill.category],
      presets: ['developer'],
      inputContract: ['workflow'],
      outputContract: ['result'],
      noExecutionByDefault: true,
      requiresPolicyBroker: false,
      receiptsRequired: false,
    }, null, 2), 'utf-8');

    return `Skill "${skill.name}" approved and installed to skill-library/native/${skillId}/`;
  }

  public rejectSkill(skillId: string): string {
    const skill = this.generatedSkills.get(skillId);
    if (!skill) return `Error: skill "${skillId}" not found.`;
    skill.status = 'rejected';
    this.saveData();
    return `Skill "${skill.name}" rejected.`;
  }

  public listPatterns(): string {
    if (this.patterns.size === 0) return 'No workflow patterns recorded.';

    const sorted = Array.from(this.patterns.values()).sort((a, b) => b.frequency - a.frequency);
    const lines: string[] = ['Workflow Patterns:'];
    for (const p of sorted.slice(0, 20)) {
      const qualifies = p.frequency >= this.minFrequency && p.success_rate >= this.minSuccessRate ? '✅' : '⬜';
      lines.push(`  ${qualifies} ${p.id}: ${p.pattern} (${p.frequency} uses, ${(p.success_rate * 100).toFixed(0)}% success)`);
    }
    return lines.join('\n');
  }

  public listGeneratedSkills(): string {
    if (this.generatedSkills.size === 0) return 'No auto-generated skills.';

    const lines: string[] = ['Auto-Generated Skills:'];
    for (const [, s] of this.generatedSkills) {
      const status = { draft: '📝', review: '🔍', approved: '✅', rejected: '❌', active: '🟢' }[s.status];
      lines.push(`  ${status} ${s.id}: ${s.name} [${s.category}] conf:${(s.confidence * 100).toFixed(0)}%`);
    }
    return lines.join('\n');
  }

  public getStats(): string {
    const patterns = Array.from(this.patterns.values());
    const skills = Array.from(this.generatedSkills.values());
    const qualifying = patterns.filter((p) => p.frequency >= this.minFrequency && p.success_rate >= this.minSuccessRate);

    return [
      'Auto Skill Generator Stats:',
      `  Patterns: ${patterns.length}`,
      `  Qualifying patterns: ${qualifying.length}`,
      `  Generated skills: ${skills.length}`,
      `  Approved: ${skills.filter((s) => s.status === 'approved').length}`,
      `  Active: ${skills.filter((s) => s.status === 'active').length}`,
      `  Avg confidence: ${skills.length > 0 ? (skills.reduce((s, sk) => s + sk.confidence, 0) / skills.length * 100).toFixed(0) : 0}%`,
    ].join('\n');
  }

  private inferCategory(tools: string[]): string {
    const toolSet = new Set(tools.map((t) => t.toLowerCase()));
    if (toolSet.has('web_search') || toolSet.has('zavorth_firecrawl')) return 'research';
    if (toolSet.has('create_file') || toolSet.has('workspace.write')) return 'development';
    if (toolSet.has('send_email') || toolSet.has('zavorth_channel_send')) return 'communication';
    if (toolSet.has('zavorth_code_review') || toolSet.has('zavorth_code_formatter')) return 'code-quality';
    if (toolSet.has('zavorth_security_scanner') || toolSet.has('zavorth_policy_enforcer')) return 'security';
    if (toolSet.has('zavorth_kanban') || toolSet.has('zavorth_delegate')) return 'orchestration';
    return 'general';
  }

  private generateName(pattern: WorkflowPattern): string {
    const tools = pattern.tools_used.slice(0, 3).map((t) => t.replace('zavorth_', '').replace('_', ' '));
    return `Auto: ${tools.join(' + ')} workflow`;
  }

  private generateDescription(pattern: WorkflowPattern): string {
    return `Automated workflow using ${pattern.tools_used.join(', ')} (${pattern.frequency} successful uses, ${(pattern.success_rate * 100).toFixed(0)}% success rate).`;
  }

  private generateSkillContent(pattern: WorkflowPattern, name: string, description: string): string {
    return `---
name: ${name}
description: ${description.slice(0, 60)}
license: Zavorth-Internal
---

# ${name}

Use this auto-generated skill when:
- The task requires a workflow similar to: ${pattern.pattern}
- The user requests operations matching this pattern

## Operating Rules

- Follow the proven workflow: ${pattern.steps.join(' → ')}
- Use tools: ${pattern.tools_used.join(', ')}
- Expected success rate: ${(pattern.success_rate * 100).toFixed(0)}%
- Average duration: ${(pattern.avg_duration_ms / 1000).toFixed(1)}s

## Output

- Result of the automated workflow execution.
`;
  }
}
