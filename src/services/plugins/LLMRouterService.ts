export interface ModelProfile {
  id: string;
  provider: string;
  model: string;
  capabilities: string[];
  cost_per_1k_input: number;
  cost_per_1k_output: number;
  max_context_tokens: number;
  supports_streaming: boolean;
  supports_vision: boolean;
  supports_function_calling: boolean;
  reasoning_effort: 'low' | 'medium' | 'high';
  latency_tier: 'fast' | 'medium' | 'slow';
  quality_tier: 'basic' | 'standard' | 'premium' | 'frontier';
}

export interface TaskRoutingRule {
  task_pattern: string;
  preferred_model: string;
  fallback_models: string[];
  max_tokens: number;
  temperature: number;
  reasoning_effort: 'low' | 'medium' | 'high';
  cost_budget_per_call: number;
}

export interface RoutingDecision {
  provider: string;
  model: string;
  max_tokens: number;
  temperature: number;
  reasoning_effort: string;
  estimated_cost: number;
  reason: string;
  fallback_chain: string[];
}

export class LLMRouterService {
  private modelProfiles: Map<string, ModelProfile> = new Map();
  private routingRules: Map<string, TaskRoutingRule> = new Map();
  private usageStats: Map<string, { calls: number; tokens: number; cost: number; errors: number }> = new Map();
  private costBudgetDaily: number;
  private costUsedToday: number = 0;

  constructor(options?: { costBudgetDaily?: number }) {
    this.costBudgetDaily = options?.costBudgetDaily || 10.0;
    this.initDefaultProfiles();
    this.initDefaultRoutingRules();
  }

  private initDefaultProfiles(): void {
    const profiles: ModelProfile[] = [
      { id: 'gpt-5.2', provider: 'openai', model: 'gpt-5.2', capabilities: ['chat', 'code', 'reasoning', 'vision'], cost_per_1k_input: 0.01, cost_per_1k_output: 0.03, max_context_tokens: 128000, supports_streaming: true, supports_vision: true, supports_function_calling: true, reasoning_effort: 'high', latency_tier: 'medium', quality_tier: 'frontier' },
      { id: 'gpt-5.2-mini', provider: 'openai', model: 'gpt-5.2-mini', capabilities: ['chat', 'code', 'reasoning'], cost_per_1k_input: 0.001, cost_per_1k_output: 0.004, max_context_tokens: 128000, supports_streaming: true, supports_vision: false, supports_function_calling: true, reasoning_effort: 'medium', latency_tier: 'fast', quality_tier: 'standard' },
      { id: 'claude-4', provider: 'anthropic', model: 'claude-4', capabilities: ['chat', 'code', 'reasoning', 'vision'], cost_per_1k_input: 0.015, cost_per_1k_output: 0.075, max_context_tokens: 200000, supports_streaming: true, supports_vision: true, supports_function_calling: true, reasoning_effort: 'high', latency_tier: 'medium', quality_tier: 'frontier' },
      { id: 'claude-4-sonnet', provider: 'anthropic', model: 'claude-4-sonnet', capabilities: ['chat', 'code', 'reasoning', 'vision'], cost_per_1k_input: 0.003, cost_per_1k_output: 0.015, max_context_tokens: 200000, supports_streaming: true, supports_vision: true, supports_function_calling: true, reasoning_effort: 'medium', latency_tier: 'fast', quality_tier: 'premium' },
      { id: 'gemini-2.5-pro', provider: 'google', model: 'gemini-2.5-pro', capabilities: ['chat', 'code', 'reasoning', 'vision', 'audio'], cost_per_1k_input: 0.00125, cost_per_1k_output: 0.005, max_context_tokens: 1000000, supports_streaming: true, supports_vision: true, supports_function_calling: true, reasoning_effort: 'high', latency_tier: 'medium', quality_tier: 'premium' },
      { id: 'gemini-2.5-flash', provider: 'google', model: 'gemini-2.5-flash', capabilities: ['chat', 'code', 'vision'], cost_per_1k_input: 0.000075, cost_per_1k_output: 0.0003, max_context_tokens: 1000000, supports_streaming: true, supports_vision: true, supports_function_calling: true, reasoning_effort: 'low', latency_tier: 'fast', quality_tier: 'standard' },
      { id: 'deepseek-v3', provider: 'deepseek', model: 'deepseek-chat', capabilities: ['chat', 'code', 'reasoning'], cost_per_1k_input: 0.00014, cost_per_1k_output: 0.00028, max_context_tokens: 64000, supports_streaming: true, supports_vision: false, supports_function_calling: true, reasoning_effort: 'medium', latency_tier: 'fast', quality_tier: 'standard' },
      { id: 'qwen-3-235b', provider: 'qwen', model: 'qwen-3-235b', capabilities: ['chat', 'code', 'reasoning'], cost_per_1k_input: 0.0005, cost_per_1k_output: 0.001, max_context_tokens: 131072, supports_streaming: true, supports_vision: false, supports_function_calling: true, reasoning_effort: 'high', latency_tier: 'medium', quality_tier: 'premium' },
      { id: 'llama-3.3-70b', provider: 'groq', model: 'llama-3.3-70b-versatile', capabilities: ['chat', 'code'], cost_per_1k_input: 0.00005, cost_per_1k_output: 0.00008, max_context_tokens: 131072, supports_streaming: true, supports_vision: false, supports_function_calling: true, reasoning_effort: 'low', latency_tier: 'fast', quality_tier: 'basic' },
      { id: 'mistral-large', provider: 'mistral', model: 'mistral-large-latest', capabilities: ['chat', 'code', 'reasoning'], cost_per_1k_input: 0.002, cost_per_1k_output: 0.006, max_context_tokens: 128000, supports_streaming: true, supports_vision: false, supports_function_calling: true, reasoning_effort: 'medium', latency_tier: 'medium', quality_tier: 'premium' },
    ];

    for (const p of profiles) this.modelProfiles.set(p.id, p);
  }

  private initDefaultRoutingRules(): void {
    const rules: TaskRoutingRule[] = [
      { task_pattern: 'chat', preferred_model: 'gpt-5.2-mini', fallback_models: ['claude-4-sonnet', 'gemini-2.5-flash'], max_tokens: 4096, temperature: 0.7, reasoning_effort: 'low', cost_budget_per_call: 0.01 },
      { task_pattern: 'code_generation', preferred_model: 'claude-4', fallback_models: ['gpt-5.2', 'qwen-3-235b'], max_tokens: 8192, temperature: 0.3, reasoning_effort: 'high', cost_budget_per_call: 0.10 },
      { task_pattern: 'code_review', preferred_model: 'claude-4-sonnet', fallback_models: ['gpt-5.2-mini', 'deepseek-v3'], max_tokens: 4096, temperature: 0.2, reasoning_effort: 'medium', cost_budget_per_call: 0.05 },
      { task_pattern: 'reasoning', preferred_model: 'gpt-5.2', fallback_models: ['claude-4', 'gemini-2.5-pro'], max_tokens: 8192, temperature: 0.1, reasoning_effort: 'high', cost_budget_per_call: 0.15 },
      { task_pattern: 'summarization', preferred_model: 'gemini-2.5-flash', fallback_models: ['gpt-5.2-mini', 'llama-3.3-70b'], max_tokens: 2048, temperature: 0.3, reasoning_effort: 'low', cost_budget_per_call: 0.005 },
      { task_pattern: 'translation', preferred_model: 'gpt-5.2-mini', fallback_models: ['claude-4-sonnet', 'gemini-2.5-flash'], max_tokens: 4096, temperature: 0.3, reasoning_effort: 'low', cost_budget_per_call: 0.01 },
      { task_pattern: 'research', preferred_model: 'gemini-2.5-pro', fallback_models: ['claude-4', 'gpt-5.2'], max_tokens: 16384, temperature: 0.5, reasoning_effort: 'high', cost_budget_per_call: 0.20 },
      { task_pattern: 'data_analysis', preferred_model: 'claude-4-sonnet', fallback_models: ['gpt-5.2-mini', 'deepseek-v3'], max_tokens: 8192, temperature: 0.2, reasoning_effort: 'medium', cost_budget_per_call: 0.05 },
      { task_pattern: 'creative_writing', preferred_model: 'claude-4', fallback_models: ['gpt-5.2', 'mistral-large'], max_tokens: 16384, temperature: 0.9, reasoning_effort: 'medium', cost_budget_per_call: 0.10 },
      { task_pattern: 'tool_planning', preferred_model: 'claude-4-sonnet', fallback_models: ['gpt-5.2-mini', 'gemini-2.5-flash'], max_tokens: 2048, temperature: 0.1, reasoning_effort: 'medium', cost_budget_per_call: 0.03 },
      { task_pattern: 'embedding', preferred_model: 'gemini-2.5-flash', fallback_models: ['llama-3.3-70b'], max_tokens: 0, temperature: 0, reasoning_effort: 'low', cost_budget_per_call: 0.001 },
      { task_pattern: 'vision', preferred_model: 'gpt-5.2', fallback_models: ['claude-4', 'gemini-2.5-pro'], max_tokens: 4096, temperature: 0.5, reasoning_effort: 'medium', cost_budget_per_call: 0.05 },
      { task_pattern: 'audio', preferred_model: 'gemini-2.5-pro', fallback_models: ['gpt-5.2'], max_tokens: 4096, temperature: 0.5, reasoning_effort: 'medium', cost_budget_per_call: 0.05 },
      { task_pattern: 'fast_answer', preferred_model: 'llama-3.3-70b', fallback_models: ['gemini-2.5-flash', 'deepseek-v3'], max_tokens: 1024, temperature: 0.5, reasoning_effort: 'low', cost_budget_per_call: 0.001 },
    ];

    for (const r of rules) this.routingRules.set(r.task_pattern, r);
  }

  public route(taskType: string, options?: {
    required_capabilities?: string[];
    max_cost?: number;
    prefer_speed?: boolean;
    prefer_quality?: boolean;
    exclude_providers?: string[];
    context_tokens_needed?: number;
  }): RoutingDecision {
    const rule = this.routingRules.get(taskType) || this.routingRules.get('chat')!;
    const excludeSet = new Set(options?.exclude_providers || []);

    let candidates = [rule.preferred_model, ...rule.fallback_models]
      .filter((id) => {
        const profile = this.modelProfiles.get(id);
        if (!profile) return false;
        if (excludeSet.has(profile.provider)) return false;
        if (options?.required_capabilities) {
          for (const cap of options.required_capabilities) {
            if (!profile.capabilities.includes(cap)) return false;
          }
        }
        if (options?.context_tokens_needed && profile.max_context_tokens < options.context_tokens_needed) return false;
        return true;
      });

    if (options?.prefer_speed) {
      candidates.sort((a, b) => {
        const pa = this.modelProfiles.get(a)!;
        const pb = this.modelProfiles.get(b)!;
        const order: Record<string, number> = { fast: 0, medium: 1, slow: 2 };
        return (order[pa.latency_tier] || 1) - (order[pb.latency_tier] || 1);
      });
    } else if (options?.prefer_quality) {
      candidates.sort((a, b) => {
        const pa = this.modelProfiles.get(a)!;
        const pb = this.modelProfiles.get(b)!;
        const order: Record<string, number> = { frontier: 0, premium: 1, standard: 2, basic: 3 };
        return (order[pa.quality_tier] || 2) - (order[pb.quality_tier] || 2);
      });
    }

    const selected = candidates[0] || rule.preferred_model;
    const profile = this.modelProfiles.get(selected)!;
    const estimatedCost = (rule.max_tokens / 1000) * profile.cost_per_1k_output;

    const stats = this.usageStats.get(selected) || { calls: 0, tokens: 0, cost: 0, errors: 0 };
    stats.calls++;
    stats.tokens += rule.max_tokens;
    stats.cost += estimatedCost;
    this.usageStats.set(selected, stats);
    this.costUsedToday += estimatedCost;

    return {
      provider: profile.provider,
      model: profile.model,
      max_tokens: rule.max_tokens,
      temperature: rule.temperature,
      reasoning_effort: rule.reasoning_effort,
      estimated_cost: estimatedCost,
      reason: `Task "${taskType}" routed to ${profile.model} (${profile.quality_tier}, ${profile.latency_tier} latency)`,
      fallback_chain: candidates.slice(1),
    };
  }

  public routeForTask(taskDescription: string, options?: {
    required_capabilities?: string[];
    max_cost?: number;
    prefer_speed?: boolean;
    prefer_quality?: boolean;
  }): RoutingDecision {
    const desc = taskDescription.toLowerCase();

    if (/\b(code|program|function|class|api|endpoint|bug|debug|refactor)\b/.test(desc)) {
      if (/\b(review|check|audit|analyze)\b/.test(desc)) return this.route('code_review', options);
      return this.route('code_generation', options);
    }
    if (/\b(reason|think|analyze|logic|prove|deduce)\b/.test(desc)) return this.route('reasoning', options);
    if (/\b(summarize|summary|brief|tldr)\b/.test(desc)) return this.route('summarization', options);
    if (/\b(translate|translation)\b/.test(desc)) return this.route('translation', options);
    if (/\b(research|study|investigate|compare)\b/.test(desc)) return this.route('research', options);
    if (/\b(data|csv|analyze|statistics|chart)\b/.test(desc)) return this.route('data_analysis', options);
    if (/\b(write|story|creative|poem|blog)\b/.test(desc)) return this.route('creative_writing', options);
    if (/\b(image|photo|screenshot|visual)\b/.test(desc)) return this.route('vision', options);
    if (/\b(audio|voice|music|sound)\b/.test(desc)) return this.route('audio', options);
    if (/\b(quick|fast|simple|yes|no)\b/.test(desc)) return this.route('fast_answer', options);

    return this.route('chat', options);
  }

  public addModelProfile(profile: ModelProfile): void {
    this.modelProfiles.set(profile.id, profile);
  }

  public addRoutingRule(rule: TaskRoutingRule): void {
    this.routingRules.set(rule.task_pattern, rule);
  }

  public getUsageStats(): string {
    const lines: string[] = [
      'LLM Router Usage Stats:',
      `  Daily budget: $${this.costBudgetDaily.toFixed(2)}`,
      `  Used today: $${this.costUsedToday.toFixed(4)}`,
      `  Remaining: $${(this.costBudgetDaily - this.costUsedToday).toFixed(4)}`,
      '',
      'Per Model:',
    ];

    const sorted = Array.from(this.usageStats.entries()).sort((a, b) => b[1].cost - a[1].cost);
    for (const [model, stats] of sorted) {
      lines.push(`  ${model}: ${stats.calls} calls, ${stats.tokens} tokens, $${stats.cost.toFixed(4)}, ${stats.errors} errors`);
    }

    return lines.join('\n');
  }

  public listModels(): string {
    const lines: string[] = ['Available Models:'];
    for (const [id, p] of this.modelProfiles) {
      lines.push(`  ${id}: ${p.provider}/${p.model} [${p.quality_tier}/${p.latency_tier}] ctx:${p.max_context_tokens} $${p.cost_per_1k_input}/$${p.cost_per_1k_output}/1k`);
    }
    return lines.join('\n');
  }

  public listRoutingRules(): string {
    const lines: string[] = ['Routing Rules:'];
    for (const [pattern, rule] of this.routingRules) {
      lines.push(`  ${pattern}: ${rule.preferred_model} (fallback: ${rule.fallback_models.join(', ')}) tokens:${rule.max_tokens} temp:${rule.temperature} reasoning:${rule.reasoning_effort}`);
    }
    return lines.join('\n');
  }
}
