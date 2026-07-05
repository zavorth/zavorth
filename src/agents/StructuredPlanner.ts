import { v4 as uuidv4 } from 'uuid';
import { config } from '../config/index.js';
import { Plan } from '../contracts/PlanContract.js';
import { Task } from '../contracts/TaskContract.js';
import { ProviderFactory } from '../providers/ProviderFactory.js';
import {
  ExecutionIntentClassifierService,
  type ExecutionIntentClassification,
} from '../services/ExecutionIntentClassifierService.js';
import {
  ProviderStrategyService,
  type ProviderStrategyDecision,
} from '../services/ProviderStrategyService.js';
import { logger } from '../logger.js';
import {
SkillRoutingService,
  type SkillRoutingDecision,
} from '../services/SkillRoutingService.js';

export type PlannerDecisionTrace = {
  intent: ExecutionIntentClassification;
  provider: ProviderStrategyDecision;
  skills: SkillRoutingDecision;
  attemptedProviders: string[];
};

export type PlannerResult = {
  plan: Plan;
  providerUsed: string;
  fallbackUsed: boolean;
  decisionTrace: PlannerDecisionTrace;
};

export class StructuredPlanner {
  private readonly intentClassifier: ExecutionIntentClassifierService;
  private readonly providerStrategyService: ProviderStrategyService;
  private readonly skillRoutingService: SkillRoutingService;

  constructor() {
    this.intentClassifier = new ExecutionIntentClassifierService();
    this.providerStrategyService = new ProviderStrategyService();
    this.skillRoutingService = new SkillRoutingService();
  }

  public async generatePlan(task: Task, prompt: string): Promise<PlannerResult> {
    const taskGoal = String(task.normalized_message || task.raw_message || '').trim() || prompt;
    const intentDecision = this.intentClassifier.classify({
      text: taskGoal,
      commandType: task.command_type,
      intent: task.intent,
      executor: task.executor_used,
      modeHint: 'planner',
    });
    const providerDecision = this.providerStrategyService.resolve({
      taskKind: intentDecision.taskKind,
      taskSubtype: intentDecision.taskSubtype,
      configuredProviderName: config.llmProvider || 'gemini',
      isProviderUsable: (name) => this.isProviderAvailable(name),
      workspaceMemory: task.metadata?.workspaceOperationalMemory,
    });
    const skillDecision = this.skillRoutingService.recommend({
      taskGoal,
      taskKind: intentDecision.taskKind,
      taskSubtype: intentDecision.taskSubtype,
      modeHint: 'planner',
    });
    const providerChain = [
      providerDecision.providerName,
      ...providerDecision.fallbackOrder.filter((provider) => provider !== providerDecision.providerName),
    ];
    const decisionTrace: PlannerDecisionTrace = {
      intent: intentDecision,
      provider: providerDecision,
      skills: skillDecision,
      attemptedProviders: [],
    };

    let lastError: Error | null = null;

    for (const providerName of providerChain) {
      if (!this.isProviderAvailable(providerName)) {
        continue;
      }

      try {
        decisionTrace.attemptedProviders.push(providerName);
        const provider = ProviderFactory.create(providerName);
        const response = await provider.chat(this.buildPlannerMessages(prompt, decisionTrace), undefined, {
          modelName:
            providerName === providerDecision.providerName
              ? providerDecision.modelName
              : undefined,
        });

        const cleaned = this.extractJson(response.content || '');
        if (!cleaned) {
          throw new Error(`Provider ${providerName} returned a response without valid JSON.`);
        }

        return {
          plan: this.toPlan(task, cleaned, decisionTrace, providerName),
          providerUsed: providerName,
          fallbackUsed: providerName !== providerDecision.providerName,
          decisionTrace,
        };
      } catch (error) {
    logger.warn('[Structured Planner] validation failed', error);
    lastError = error instanceof Error ? error : new Error(String(error));
  }
    }

    throw lastError || new Error('No available provider could generate a valid plan.');
  }

  private buildPlannerMessages(prompt: string, trace: PlannerDecisionTrace): Array<{ role: 'system' | 'user'; content: string }> {
    const systemLines = [
      'Planner operational decision:',
      `- Route: ${trace.intent.executionRoute}.`,
      `- Inferred type/subtype: ${trace.intent.taskKind}/${trace.intent.taskSubtype}.`,
      `- Preferred provider: ${trace.provider.providerName}${trace.provider.modelName ? `/${trace.provider.modelName}` : ''}.`,
      `- Provider strategy source: ${trace.provider.selectionSource}.`,
      trace.skills.primarySkill
        ? `- Skill sugerida: @${trace.skills.primarySkill.name} (${trace.skills.primarySkill.description}).`
        : '- Nenhuma skill teve aderencia alta o suficiente para guiar o plano.',
      ...(trace.skills.supportingSkills.length > 0
        ? [`- Skills de apoio: ${trace.skills.supportingSkills.map((entry) => `@${entry.name}`).join(', ')}.`]
        : []),
      '- Use esses sinais como contexto de orquestracao antes de montar o JSON final.',
    ];

    return [
      {
        role: 'system',
        content: systemLines.join('\n'),
      },
      {
        role: 'user',
        content: prompt,
      },
    ];
  }

  private toPlan(
    task: Task,
    cleaned: Record<string, any>,
    trace: PlannerDecisionTrace,
    providerUsed: string,
  ): Plan {
    return {
      plan_id: uuidv4(),
      task_id: task.task_id,
      objective: cleaned.objective || 'Task execution through Zavorth',
      context: cleaned.context || 'Context inferred by the planner',
      assumptions: Array.isArray(cleaned.assumptions) ? cleaned.assumptions : [],
      executor_recommendation: cleaned.executor_recommendation || 'local_executor',
      workspace_recommendation: cleaned.workspace_recommendation || null,
      risk_level: typeof cleaned.risk_level === 'number' ? cleaned.risk_level : 1,
      requires_approval:
        typeof cleaned.requires_approval === 'boolean'
          ? cleaned.requires_approval
          : (typeof cleaned.risk_level === 'number' ? cleaned.risk_level : 1) >= 2,
      steps: Array.isArray(cleaned.steps) ? cleaned.steps : [],
      validation_steps: Array.isArray(cleaned.validation_steps) ? cleaned.validation_steps : [],
      success_condition: cleaned.success_condition || 'Instrucoes executadas com sucesso',
      rollback_condition: cleaned.rollback_condition || 'Nenhuma condicao de rollback definida',
      notes: this.buildDecisionNotes(Array.isArray(cleaned.notes) ? cleaned.notes : [], trace, providerUsed),
    };
  }

  private buildDecisionNotes(existingNotes: string[], trace: PlannerDecisionTrace, providerUsed: string): string[] {
    return this.uniqueStrings([
      ...existingNotes,
      `decision.route=${trace.intent.executionRoute}`,
      `decision.task_profile=${trace.intent.taskKind}/${trace.intent.taskSubtype}`,
      `decision.provider=${trace.provider.providerName}${trace.provider.modelName ? `/${trace.provider.modelName}` : ''}`,
      `decision.provider_used=${providerUsed}`,
      `decision.provider_source=${trace.provider.selectionSource}`,
      ...(trace.skills.primarySkill ? [`decision.primary_skill=@${trace.skills.primarySkill.name}`] : []),
      ...(trace.skills.supportingSkills.length > 0
        ? [`decision.supporting_skills=${trace.skills.supportingSkills.map((entry) => `@${entry.name}`).join(',')}`]
        : []),
    ]);
  }

  private extractJson(text: string): Record<string, any> | null {
    try {
      const cleanText = text.replace(/```json/gi, '').replace(/```/g, '').trim();
      const match = cleanText.match(/\{[\s\S]*\}/);
      if (match) {
        return JSON.parse(match[0]);
      }
      return JSON.parse(cleanText);
    } catch (error) { logger.warn('[Structured Planner] JSON parse failed', error); return null; }
  }

  private isProviderAvailable(name: string): boolean {
    switch (name) {
      case 'AIGateway':
        return !!config.AIGatewayBaseUrl;
      case 'gemini':
        return !!(config.geminiApiKey || config.geminiApiKeys.length > 0);
      case 'deepseek':
        return !!config.deepseekApiKey;
      case 'openai':
        return !!config.openaiApiKey;
      case 'minimax':
        return !!config.minimaxApiKey;
      case 'openrouter':
        return !!config.openRouterApiKey;
      case 'qwen':
      case 'puter':
        return !!config.puterAuthToken;
      case 'opencode':
        return !!config.openCodeApiKey;
      default:
        return false;
    }
  }

  private uniqueStrings(values: string[]): string[] {
    const normalized = new Set<string>();
    const unique: string[] = [];

    for (const value of values) {
      const current = String(value || '').trim();
      if (!current || normalized.has(current)) {
        continue;
      }
      normalized.add(current);
      unique.push(current);
    }

    return unique;
  }
}
