/**
 * Project Evolution Memory Service.
 * Persists and evolves project-specific engineering conventions, preferences, and architectural rules.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface MemoryRule {
  id: string;
  category: 'architecture' | 'code_style' | 'security' | 'testing' | 'general';
  rule: string;
  learnedAt: string;
  source: 'user_explicit' | 'agent_learned';
}

export class ProjectEvolutionMemoryService {
  private static rules: MemoryRule[] = [];
  private static initialized = false;

  private static getMemoryFilePath(): string {
    const localDir = path.join(process.cwd(), '.zavorth');
    if (!fs.existsSync(localDir)) {
      try {
        fs.mkdirSync(localDir, { recursive: true });
      } catch {
        return path.join(os.homedir(), '.zavorth', 'project_memory.json');
      }
    }
    return path.join(localDir, 'project_memory.json');
  }

  private static init(): void {
    if (this.initialized) return;
    this.initialized = true;

    // Load default baseline rules adhering to clean-code
    this.rules = [
      {
        id: 'mem_clean_1',
        category: 'architecture',
        rule: 'Always adhere to modular SOLID architecture and avoid monolithic files.',
        learnedAt: new Date().toISOString(),
        source: 'user_explicit',
      },
      {
        id: 'mem_clean_2',
        category: 'code_style',
        rule: 'Enforce strict TypeScript types and eliminate unnecessary comments and dead code.',
        learnedAt: new Date().toISOString(),
        source: 'user_explicit',
      },
    ];

    const filePath = this.getMemoryFilePath();
    if (fs.existsSync(filePath)) {
      try {
        const raw = fs.readFileSync(filePath, 'utf-8');
        const data: MemoryRule[] = JSON.parse(raw);
        if (Array.isArray(data) && data.length > 0) {
          this.rules = data;
        }
      } catch {
        // Fallback to baseline
      }
    }
  }

  /**
   * Adds a new learned rule to the project memory.
   */
  static addRule(category: MemoryRule['category'], ruleText: string): MemoryRule {
    this.init();
    const rule: MemoryRule = {
      id: `mem_${Date.now()}`,
      category,
      rule: ruleText.trim(),
      learnedAt: new Date().toISOString(),
      source: 'user_explicit',
    };

    this.rules.push(rule);
    this.saveToDisk();
    return rule;
  }

  /**
   * Lists all currently remembered rules.
   */
  static listRules(): MemoryRule[] {
    this.init();
    return [...this.rules];
  }

  /**
   * Generates formatted prompt context with all active learned rules.
   */
  static getSystemPromptMemoryContext(): string {
    this.init();
    if (this.rules.length === 0) return '';

    const lines: string[] = ['[Project Evolution Memory & Learned Conventions]:'];
    this.rules.forEach((r, idx) => {
      lines.push(`${idx + 1}. [${r.category.toUpperCase()}]: ${r.rule}`);
    });

    return lines.join('\n');
  }

  /**
   * Clears rules for testing or reset.
   */
  static clearRules(): void {
    this.rules = [];
    this.initialized = false;
    try {
      const filePath = this.getMemoryFilePath();
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch {
      // Ignore
    }
  }

  private static saveToDisk(): void {
    try {
      const filePath = this.getMemoryFilePath();
      fs.writeFileSync(filePath, JSON.stringify(this.rules, null, 2), 'utf-8');
    } catch {
      // Non-blocking disk write
    }
  }
}
