import fs from 'fs';
import path from 'path';

export interface ModelProfile {
  id: string;
  provider: string;
  model: string;
  cost_per_1k_input: number;
  cost_per_1k_output: number;
  latency_tier: 'fast' | 'medium' | 'slow';
  quality_tier: 'basic' | 'standard' | 'premium' | 'frontier';
  max_context: number;
  strengths: string[];
  weaknesses: string[];
}

export interface SwitchDecision {
  from_model: string;
  to_model: string;
  reason: string;
  estimated_savings: number;
  quality_impact: 'none' | 'minimal' | 'moderate' | 'significant';
}

export class LLMModelSwitcherService {
  private readonly storageDir: string;
  private models: Map<string, ModelProfile> = new Map();
  private switchHistory: SwitchDecision[] = [];
  private costBudget: number;
  private costUsed: number = 0;

  constructor(options?: { storageDir?: string; costBudget?: number }) {
    this.storageDir = options?.storageDir || path.join(process.cwd(), 'data', 'runtime', 'model-switcher');
    this.costBudget = options?.costBudget || 10.0;
    if (!fs.existsSync(this.storageDir)) fs.mkdirSync(this.storageDir, { recursive: true });
    this.initModels();
  }

  private initModels(): void {
    const models: ModelProfile[] = [
      { id: 'gpt-4o', provider: 'openai', model: 'gpt-4o', cost_per_1k_input: 0.01, cost_per_1k_output: 0.03, latency_tier: 'medium', quality_tier: 'frontier', max_context: 128000, strengths: ['reasoning', 'code', 'analysis'], weaknesses: ['cost'] },
      { id: 'gpt-4o-mini', provider: 'openai', model: 'gpt-4o-mini', cost_per_1k_input: 0.001, cost_per_1k_output: 0.004, latency_tier: 'fast', quality_tier: 'standard', max_context: 128000, strengths: ['speed', 'cost'], weaknesses: ['complex-reasoning'] },
      { id: 'claude-4', provider: 'anthropic', model: 'claude-4', cost_per_1k_input: 0.015, cost_per_1k_output: 0.075, latency_tier: 'medium', quality_tier: 'frontier', max_context: 200000, strengths: ['reasoning', 'code', 'safety'], weaknesses: ['cost'] },
      { id: 'claude-4-sonnet', provider: 'anthropic', model: 'claude-4-sonnet', cost_per_1k_input: 0.003, cost_per_1k_output: 0.015, latency_tier: 'fast', quality_tier: 'premium', max_context: 200000, strengths: ['balanced', 'code'], weaknesses: ['very-long-context'] },
      { id: 'gemini-2.5-pro', provider: 'google', model: 'gemini-2.5-pro', cost_per_1k_input: 0.00125, cost_per_1k_output: 0.005, latency_tier: 'medium', quality_tier: 'premium', max_context: 1000000, strengths: ['long-context', 'multimodal', 'cost'], weaknesses: ['instruction-following'] },
      { id: 'gemini-2.5-flash', provider: 'google', model: 'gemini-2.5-flash', cost_per_1k_input: 0.000075, cost_per_1k_output: 0.0003, latency_tier: 'fast', quality_tier: 'standard', max_context: 1000000, strengths: ['speed', 'cost', 'long-context'], weaknesses: ['complex-reasoning'] },
      { id: 'deepseek-v3', provider: 'deepseek', model: 'deepseek-chat', cost_per_1k_input: 0.00014, cost_per_1k_output: 0.00028, latency_tier: 'fast', quality_tier: 'standard', max_context: 64000, strengths: ['cost', 'code'], weaknesses: ['multimodal'] },
      { id: 'llama-3.3-70b', provider: 'groq', model: 'llama-3.3-70b-versatile', cost_per_1k_input: 0.00005, cost_per_1k_output: 0.00008, latency_tier: 'fast', quality_tier: 'basic', max_context: 131072, strengths: ['speed', 'cost'], weaknesses: ['quality'] },
    ];
    for (const m of models) this.models.set(m.id, m);
  }

  public suggestSwitch(currentModel: string, taskType: string, contextTokens: number): SwitchDecision | null {
    const current = this.models.get(currentModel);
    if (!current) return null;

    const candidates = Array.from(this.models.values()).filter((m) => {
      if (m.id === currentModel) return false;
      if (m.max_context < contextTokens) return false;
      return true;
    });

    if (taskType === 'chat' || taskType === 'summarize') {
      const cheaper = candidates.filter((m) => m.cost_per_1k_output < current.cost_per_1k_output);
      if (cheaper.length > 0) {
        const best = cheaper.sort((a, b) => a.cost_per_1k_output - b.cost_per_1k_output)[0];
        return {
          from_model: currentModel,
          to_model: best.id,
          reason: `Task "${taskType}" doesn't need frontier quality. ${best.model} is ${((1 - best.cost_per_1k_output / current.cost_per_1k_output) * 100).toFixed(0)}% cheaper.`,
          estimated_savings: current.cost_per_1k_output - best.cost_per_1k_output,
          quality_impact: best.quality_tier === 'basic' ? 'moderate' : 'minimal',
        };
      }
    }

    if (taskType === 'code_generation' || taskType === 'reasoning') {
      const better = candidates.filter((m) => m.quality_tier === 'frontier' || m.quality_tier === 'premium');
      if (better.length > 0 && current.quality_tier !== 'frontier') {
        const best = better[0];
        return {
          from_model: currentModel,
          to_model: best.id,
          reason: `Task "${taskType}" benefits from frontier quality. Switching to ${best.model}.`,
          estimated_savings: 0,
          quality_impact: 'none',
        };
      }
    }

    return null;
  }

  public recordSwitch(decision: SwitchDecision): void {
    this.switchHistory.push(decision);
    this.costUsed += decision.estimated_savings;
  }

  public getStats(): string {
    const totalSavings = this.switchHistory.reduce((sum, s) => sum + s.estimated_savings, 0);
    return [
      'Model Switcher Stats:',
      `  Models: ${this.models.size}`,
      `  Switches: ${this.switchHistory.length}`,
      `  Estimated savings: $${totalSavings.toFixed(4)}`,
      `  Budget: $${this.costUsed.toFixed(4)}/$${this.costBudget}`,
    ].join('\n');
  }

  public listModels(): string {
    const lines: string[] = ['Available Models:'];
    for (const [, m] of this.models) {
      lines.push(`  ${m.id}: ${m.provider}/${m.model} [${m.quality_tier}/${m.latency_tier}] $${m.cost_per_1k_output}/1k ctx:${m.max_context}`);
    }
    return lines.join('\n');
  }
}
