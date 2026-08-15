export type ReasoningEffort = 'low' | 'medium' | 'high';

export interface ReasoningConfig {
  effort: ReasoningEffort;
  max_tokens: number;
  temperature: number;
  top_p: number;
  chain_of_thought: boolean;
  self_reflection: boolean;
  step_by_step: boolean;
  timeout_ms: number;
}

export interface TaskReasoningProfile {
  task_type: string;
  description: string;
  default_effort: ReasoningEffort;
  config: ReasoningConfig;
  examples: string[];
}

export class ReasoningEffortService {
  private profiles: Map<string, TaskReasoningProfile> = new Map();
  private globalEffort: ReasoningEffort = 'medium';
  private overrides: Map<string, ReasoningEffort> = new Map();

  constructor() {
    this.initProfiles();
  }

  private initProfiles(): void {
    const profiles: TaskReasoningProfile[] = [
      {
        task_type: 'chat',
        description: 'General conversation',
        default_effort: 'low',
        config: { effort: 'low', max_tokens: 2048, temperature: 0.7, top_p: 0.9, chain_of_thought: false, self_reflection: false, step_by_step: false, timeout_ms: 30000 },
        examples: ['Hello', 'How are you...', 'Tell me a joke'],
      },
      {
        task_type: 'code_generation',
        description: 'Writing code from requirements',
        default_effort: 'high',
        config: { effort: 'high', max_tokens: 8192, temperature: 0.3, top_p: 0.95, chain_of_thought: true, self_reflection: true, step_by_step: true, timeout_ms: 120000 },
        examples: ['Write a REST API', 'Create a React component', 'Implement a sorting algorithm'],
      },
      {
        task_type: 'code_review',
        description: 'Reviewing existing code',
        default_effort: 'medium',
        config: { effort: 'medium', max_tokens: 4096, temperature: 0.2, top_p: 0.9, chain_of_thought: true, self_reflection: false, step_by_step: true, timeout_ms: 60000 },
        examples: ['Review this PR', 'Check for bugs', 'Audit security'],
      },
      {
        task_type: 'reasoning',
        description: 'Complex logical reasoning',
        default_effort: 'high',
        config: { effort: 'high', max_tokens: 8192, temperature: 0.1, top_p: 0.95, chain_of_thought: true, self_reflection: true, step_by_step: true, timeout_ms: 120000 },
        examples: ['Prove this theorem', 'Analyze this argument', 'Solve this puzzle'],
      },
      {
        task_type: 'summarization',
        description: 'Summarizing content',
        default_effort: 'low',
        config: { effort: 'low', max_tokens: 2048, temperature: 0.3, top_p: 0.9, chain_of_thought: false, self_reflection: false, step_by_step: false, timeout_ms: 30000 },
        examples: ['Summarize this article', 'TLDR this', 'Brief overview'],
      },
      {
        task_type: 'research',
        description: 'Deep research and analysis',
        default_effort: 'high',
        config: { effort: 'high', max_tokens: 16384, temperature: 0.5, top_p: 0.95, chain_of_thought: true, self_reflection: true, step_by_step: true, timeout_ms: 180000 },
        examples: ['Research this topic', 'Compare these options', 'Investigate this issue'],
      },
      {
        task_type: 'data_analysis',
        description: 'Analyzing data and generating insights',
        default_effort: 'medium',
        config: { effort: 'medium', max_tokens: 8192, temperature: 0.2, top_p: 0.9, chain_of_thought: true, self_reflection: false, step_by_step: true, timeout_ms: 60000 },
        examples: ['Analyze this CSV', 'Find patterns in this data', 'Generate a report'],
      },
      {
        task_type: 'tool_planning',
        description: 'Planning which tools to use',
        default_effort: 'medium',
        config: { effort: 'medium', max_tokens: 2048, temperature: 0.1, top_p: 0.9, chain_of_thought: true, self_reflection: false, step_by_step: true, timeout_ms: 15000 },
        examples: ['What tools should I use...', 'Plan this workflow', 'How to approach this task'],
      },
      {
        task_type: 'fast_answer',
        description: 'Quick factual answers',
        default_effort: 'low',
        config: { effort: 'low', max_tokens: 512, temperature: 0.3, top_p: 0.9, chain_of_thought: false, self_reflection: false, step_by_step: false, timeout_ms: 10000 },
        examples: ['What time is it...', 'What is 2+2...', 'Quick question'],
      },
      {
        task_type: 'creative_writing',
        description: 'Creative and imaginative writing',
        default_effort: 'medium',
        config: { effort: 'medium', max_tokens: 16384, temperature: 0.9, top_p: 0.95, chain_of_thought: false, self_reflection: false, step_by_step: false, timeout_ms: 120000 },
        examples: ['Write a story', 'Create a poem', 'Blog post'],
      },
    ];

    for (const p of profiles) this.profiles.set(p.task_type, p);
  }

  public getConfig(taskType: string): ReasoningConfig {
    const override = this.overrides.get(taskType);
    if (override) {
      const profile = this.profiles.get(taskType);
      if (profile) return { ...profile.config, effort: override };
    }

    const profile = this.profiles.get(taskType);
    if (profile) return profile.config;

    return this.getDefaultConfig(this.globalEffort);
  }

  public setGlobalEffort(effort: ReasoningEffort): void {
    this.globalEffort = effort;
  }

  public setTaskEffort(taskType: string, effort: ReasoningEffort): void {
    this.overrides.set(taskType, effort);
  }

  public setOverride(taskType: string, effort: ReasoningEffort): void {
    this.setTaskEffort(taskType, effort);
  }

  public getEffortDescription(effort: ReasoningEffort): string {
    switch (effort) {
      case 'low': return 'Fast, concise responses. No chain-of-thought. Good for simple tasks.';
      case 'medium': return 'Balanced speed and quality. Some reasoning visible. Good for most tasks.';
      case 'high': return 'Deep reasoning with chain-of-thought, self-reflection, and step-by-step. Slower but higher quality.';
    }
  }

  public suggestEffort(taskDescription: string): ReasoningEffort {
    return this.globalEffort;
  }

  public listProfiles(): string {
    const lines: string[] = ['Reasoning Profiles:'];
    for (const [type, p] of this.profiles) {
      const override = this.overrides.get(type);
      const effort = override || p.default_effort;
      lines.push(`  ${type}: ${effort} - ${p.description}`);
      lines.push(`    tokens:${p.config.max_tokens} temp:${p.config.temperature} cot:${p.config.chain_of_thought} reflection:${p.config.self_reflection}`);
    }
    return lines.join('\n');
  }

  public getStats(): string {
    return [
      'Reasoning effort statistics:',
      `  Profiles: ${this.profiles.size}`,
      `  Global effort: ${this.globalEffort}`,
      `  Overrides: ${this.overrides.size}`,
    ].join('\n');
  }

  private getDefaultConfig(effort: ReasoningEffort): ReasoningConfig {
    switch (effort) {
      case 'low':
        return { effort: 'low', max_tokens: 2048, temperature: 0.7, top_p: 0.9, chain_of_thought: false, self_reflection: false, step_by_step: false, timeout_ms: 30000 };
      case 'medium':
        return { effort: 'medium', max_tokens: 4096, temperature: 0.5, top_p: 0.95, chain_of_thought: true, self_reflection: false, step_by_step: true, timeout_ms: 60000 };
      case 'high':
        return { effort: 'high', max_tokens: 8192, temperature: 0.2, top_p: 0.95, chain_of_thought: true, self_reflection: true, step_by_step: true, timeout_ms: 120000 };
    }
  }
}
