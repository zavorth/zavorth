import { logger } from '../logger.js';
import { z } from 'zod';
import type { ZavorthEchoOrchestrator } from '../tool-runtime/orchestrator/ZavorthEchoOrchestrator.js';
import type { ToolCategory } from '../tool-runtime/types/IZavorthTool.js';
import { ZavorthProactivePermissionService } from './ZavorthProactivePermissionService.js';
import { HybridMemoryService } from './HybridMemoryService.js';
import { LlmRuntimeService } from './llm/LlmRuntimeService.js';
import { EchoExecutionBoundaryService } from '../domain/execution/infrastructure/ExecutionBoundaryService.js';
import { EchoPendingExecutionStoreService } from '../domain/execution/infrastructure/EchoPendingExecutionStoreService.js';

import type { ChatMessage } from '../providers/ILlmProvider.js';
import type { EchoExecutionEntry } from '../tool-runtime/types/EchoTypes.js';
import { errorMessage } from '../utils/errorLike.js';
type RecentExecutionLike = Pick<EchoExecutionEntry, 'prompt' | 'status' | 'toolCalls' | 'runContext' | 'metadata'>;

type ProactiveHistoryRuntime =
  | { getHistory: (limit?: number) => RecentExecutionLike[] }
  | { list: (limit?: number) => RecentExecutionLike[] };

type ProactiveInferenceRuntime = {
  history?: ProactiveHistoryRuntime | null;
  memory?: Pick<HybridMemoryService, 'previewRecall'> | null;
  llm?: Pick<LlmRuntimeService, 'chat'> | null;
  executionBoundary?: EchoExecutionBoundaryService | null;
  pendingExecutionStore?: EchoPendingExecutionStoreService | null;
  now?: () => Date;
};

export type ProactiveInferenceCycleResult = {
  ok: boolean;
  skipped?: 'no_recent_execution' | 'no_action' | 'invalid_payload' | 'blocked';
  permissionId?: string | null;
  actionName?: string | null;
  reason?: string | null;
  correlation?: Record<string, unknown> | null;
  warnings?: string[];
};

export const ProactiveInferenceSchema = z.object({
  suggestAction: z.boolean().describe('set true when houver uma action proactive real para approve agora.'),
  actionName: z.string().optional().describe('Nome da tool ou capability Echo.'),
  actionArgs: z.record(z.string(), z.unknown()).optional().describe('Args estruturados da tool when o schema for claro.'),
  resource: z.string().optional().describe('Short resource description, used as fallback when there are no args.'),
  category: z.enum(['OS', 'IOT', 'WEB', 'INTERNAL']).optional().describe('Categoria esperada da capability.'),
  reason: z.string().optional().describe('Justificactive objetiva do insight proactive.'),
});

/**
 * Runs the proactive "The Mind" loop on top of hybrid memory and the canonical
 * execution boundary. The output is always a pending approval, never an
 * immediate side effect.
 */
export class ProactiveInferencePlaneService {
  private readonly history: ProactiveHistoryRuntime | null;
  private readonly permissionService: ZavorthProactivePermissionService;
  private readonly memory: Pick<HybridMemoryService, 'previewRecall'>;
  private readonly llm: Pick<LlmRuntimeService, 'chat'>;
  private readonly executionBoundary: EchoExecutionBoundaryService;
  private readonly pendingExecutions: EchoPendingExecutionStoreService;
  private readonly orchestrator: Pick<ZavorthEchoOrchestrator, 'getExecutionLog' | 'getToolByName'> | null;
  private readonly now: () => Date;

  constructor(
    orchestrator: Pick<ZavorthEchoOrchestrator, 'getExecutionLog' | 'getToolByName'> | null,
    permissionService: ZavorthProactivePermissionService,
    runtime: ProactiveInferenceRuntime = {},
  ) {
    this.orchestrator = orchestrator || null;
    this.permissionService = permissionService;
    this.history = runtime.history || null;
    this.memory = runtime.memory || new HybridMemoryService();
    this.llm = runtime.llm || new LlmRuntimeService();
    this.executionBoundary = runtime.executionBoundary || new EchoExecutionBoundaryService();
    this.pendingExecutions = runtime.pendingExecutionStore || new EchoPendingExecutionStoreService();
    this.now = runtime.now || (() => new Date());
  }

  public async runInferenceCycle(): Promise<ProactiveInferenceCycleResult> {
    try {
      const recentExecutions = this.readRecentExecutions(6);
      if (recentExecutions.length === 0) {
        return {
          ok: true,
          skipped: 'no_recent_execution',
        };
      }

      const sessionId = recentExecutions.find((entry) => entry.runContext?.sessionId)?.runContext?.sessionId || 'proactive';
      const memoryQuery = this.buildMemoryQuery(recentExecutions);
      const memoryRecall = await this.memory.previewRecall({
        sessionId,
        query: memoryQuery,
        limit: 6,
      });

      const systemPrompt = this.buildSystemPrompt(recentExecutions, memoryRecall.context, memoryRecall.warnings || []);
      const messages: ChatMessage[] = [{ role: 'system', content: systemPrompt }];
      const response = await this.llm.chat(messages, undefined, {
        providerName: 'ollama',
        allowFallback: false,
      });
      const payload = this.extractPayload(response.content || '');

      if (!payload.success) {
        return {
          ok: false,
          skipped: 'invalid_payload',
          warnings: ['The Mind returned um payload invalid para a inferencia proactive.'],
        };
      }

      if (!payload.data.suggestAction || !payload.data.actionName || !payload.data.reason) {
        return {
          ok: true,
          skipped: 'no_action',
        };
      }

      const actionArgs = this.normalizeActionArgs(payload.data.actionArgs, payload.data.resource);
      const category = this.resolveCategory(payload.data.category, payload.data.actionName);
      const prompt = `[Insight Proactive] ${payload.data.reason}`;
      const intent = this.executionBoundary.buildToolIntent({
        prompt,
        toolName: payload.data.actionName,
        args: actionArgs,
        category,
        sessionId,
        approved: false,
        requestedBy: 'the-mind',
        surface: 'proactive',
        metadata: {
          origin: 'proactive_inference',
          reason: payload.data.reason,
          memoryQuery,
          memoryMode: memoryRecall.mode,
          memoryWarnings: memoryRecall.warnings || [],
          memoryContext: memoryRecall.context,
        },
      });
      const decision = await this.executionBoundary.decide(intent);
      if (decision.decision === 'blocked') {
        return {
          ok: false,
          skipped: 'blocked',
          actionName: payload.data.actionName,
          reason: decision.summary,
          correlation: decision.correlation,
        };
      }

      const permission = await this.permissionService.request({
        action: payload.data.actionName,
        resource: JSON.stringify(actionArgs),
        reason: `[Insight Neural Proactive] ${payload.data.reason}`,
        metadata: {
          kind: 'intent',
          source: 'proactive_inference',
          prompt,
          toolName: payload.data.actionName,
          args: actionArgs,
          category: category || null,
          sessionId,
          correlation: {
            ...decision.correlation,
            approvalId: decision.approval.approvalId || null,
          },
          runContext: decision.runContext,
          intent,
          memory: {
            query: memoryQuery,
            mode: memoryRecall.mode,
            returned: memoryRecall.summary.returned,
            warnings: memoryRecall.warnings || [],
          },
        },
      });
      const pendingIntent = {
        ...intent,
        correlation: {
          ...decision.correlation,
          approvalId: permission.id,
        },
      };
      this.pendingExecutions.put({
        permissionId: permission.id,
        kind: 'intent',
        prompt,
        toolName: payload.data.actionName,
        args: actionArgs,
        category,
        sessionId,
        requestedAt: permission.requestedAt,
        correlation: pendingIntent.correlation || null,
        intent: pendingIntent,
        metadata: {
          requestedBy: 'the-mind',
          surface: 'proactive',
          reason: payload.data.reason,
          generatedAt: this.now().toISOString(),
        },
      });

      return {
        ok: true,
        permissionId: permission.id,
        actionName: payload.data.actionName,
        reason: payload.data.reason,
        correlation: pendingIntent.correlation || null,
        warnings: memoryRecall.warnings || [],
      };
    } catch (error: unknown) {logger.error('[ProactiveInferencePlane] Inference cycle failed.', error);
      return {
        ok: false,
        skipped: 'invalid_payload',
        warnings: [errorMessage(error, 'unknown error')],
      };
    }
  }

  private readRecentExecutions(limit: number): RecentExecutionLike[] {
    if (this.history && 'getHistory' in this.history) {
      return this.history.getHistory(limit);
    }
    if (this.history && 'list' in this.history) {
      return this.history.list(limit);
    }
    if (this.orchestrator) {
      return this.orchestrator.getExecutionLog(limit);
    }
    return [];
  }

  private buildMemoryQuery(recentExecutions: RecentExecutionLike[]): string {
    return recentExecutions
      .map((entry) => {
        const tools = entry.toolCalls.map((tool) => tool.toolName).join(', ');
        return `${entry.prompt} ${tools} ${entry.status}`;
      })
      .join(' ')
      .slice(0, 600);
  }

  private buildSystemPrompt(history: RecentExecutionLike[], memoryContext: string, warnings: string[]): string {
    const executionHistoryText = history
      .map((entry) => `- Intent: "${entry.prompt}" | Tools: [${entry.toolCalls.map((tool) => tool.toolName).join(', ')}] | Result: ${entry.status}`)
      .join('\n');
    const warningText = warnings.length > 0 ? warnings.join(' | ') : 'without alertas';
    return `You e o "The Mind", o motor preditivo do Zavorth Echo.
Your job is to suggest only the next action with the highest real value, and only when asking approval makes sense.
Respond strictly in valid JSON following the expected schema. If there is no strong action, return {"suggestAction": false}.

--- MEMORY HIBRIDA ---
${memoryContext || 'without contexto relevante recuperado.'}

--- WARNINGS ---
${warningText}

--- TIME WINDOW ---
${executionHistoryText}
`;
  }

  private extractPayload(content: string): ReturnType<typeof ProactiveInferenceSchema.safeParse> {
    const rawMatch = String(content || '').match(/\{[\s\S]*\}/);
    if (!rawMatch) {
      return ProactiveInferenceSchema.safeParse(null);
    }

    try {
      return ProactiveInferenceSchema.safeParse(JSON.parse(rawMatch[0]));
    } catch (error: unknown) {logger.warn('[Proactive Inference Plane] JSON parse failed', error);
    return ProactiveInferenceSchema.safeParse(null);
  }
  }

  private normalizeActionArgs(
    actionArgs: Record<string, unknown> | undefined,
    resource: string | undefined,
  ): Record<string, unknown> {
    if (actionArgs && typeof actionArgs === 'object' && !Array.isArray(actionArgs)) {
      return JSON.parse(JSON.stringify(actionArgs));
    }
    if (String(resource || '').trim()) {
      return {
        resource: String(resource || '').trim(),
      };
    }
    return {};
  }

  private resolveCategory(
    category: ToolCategory | undefined,
    actionName: string,
  ): ToolCategory | undefined {
    if (category) {
      return category;
    }
    return this.orchestrator?.getToolByName(actionName)?.category;
  }
}
