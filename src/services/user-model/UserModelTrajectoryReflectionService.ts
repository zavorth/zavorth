import crypto from 'node:crypto';
import { z } from 'zod';
import {
  type UserModelFact,
  userModelFactKindSchema,
} from '../../contracts/user-model/UserModelFactContract.js';
import { logger } from '../../logger.js';
import { ZavorthLlmRuntimeService } from '../ZavorthLlmRuntimeService.js';
import { ZavorthJsonSchemaRepairService } from '../llm/repair/ZavorthJsonSchemaRepairService.js';
import type { ProductSurfaceToolExecution, ProductSurfaceTurnInput } from '../ZavorthProductSurfaceRuntimeService.js';
import { UserModelConfidenceEngine } from './UserModelConfidenceEngine.js';
import type { UserModelFactStore } from './UserModelFactStore.js';

export const trajectoryExtractedFactSchema = z.object({
  content: z.string().min(1),
  kind: userModelFactKindSchema,
  category: z.string().min(1),
  targetTools: z.array(z.string()).default([]),
  citation: z.string().min(1),
  confidenceScore: z.number().min(0).max(1).default(0.7),
});

export const trajectoryExtractionSchema = z.object({
  facts: z.array(trajectoryExtractedFactSchema).default([]),
  contradictions: z.array(
    z.object({
      supersededFactId: z.string().optional(),
      contradictedSummary: z.string().min(1),
    }),
  ).default([]),
});

export type TrajectoryExtractionResult = z.infer<typeof trajectoryExtractionSchema>;

export type LlmInferencePort = {
  synthesize(systemPrompt: string, userContent: string): Promise<{ content: string }>;
};

export type TrajectoryReflectionDeps = {
  factStore: UserModelFactStore;
  confidenceEngine?: UserModelConfidenceEngine;
  llmInference?: LlmInferencePort;
  repairService?: ZavorthJsonSchemaRepairService;
  now?: () => Date;
};

export class UserModelTrajectoryReflectionService {
  private readonly factStore: UserModelFactStore;
  private readonly confidenceEngine: UserModelConfidenceEngine;
  private readonly llmInference: LlmInferencePort;
  private readonly repairService: ZavorthJsonSchemaRepairService;
  private readonly now: () => Date;

  public constructor(deps: TrajectoryReflectionDeps) {
    this.factStore = deps.factStore;
    this.confidenceEngine = deps.confidenceEngine || new UserModelConfidenceEngine();
    this.llmInference = deps.llmInference || new ZavorthLlmRuntimeService();
    this.repairService = deps.repairService || new ZavorthJsonSchemaRepairService();
    this.now = deps.now || (() => new Date());
  }

  public async processTurn(input: ProductSurfaceTurnInput): Promise<{ extractedCount: number }> {
    const turnId = String(input.turnId || `turn-${Date.now().toString(36)}`);
    const userId = String(input.userId || 'local-user');

    if (this.factStore.isTurnProcessed(turnId)) {
      return { extractedCount: 0 };
    }

    const userMessage = String(input.userMessage || '').trim();
    const assistantText = String(input.assistantText || '').trim();
    const toolExecutions = input.toolExecutions || [];

    if (!userMessage || userMessage.length < 5) {
      await this.factStore.markTurnProcessed(turnId);
      return { extractedCount: 0 };
    }

    const payload = this.buildAnalysisPayload(userMessage, assistantText, toolExecutions);
    const extraction = await this.extractWithRepair(payload);

    if (!extraction) {
      await this.factStore.markTurnProcessed(turnId);
      return { extractedCount: 0 };
    }

    let savedCount = 0;
    const timestamp = this.now().toISOString();
    const existingFacts = await this.factStore.listFactsByUserId(userId);
    const supersededSet = new Set<string>();
    for (const contradiction of extraction.contradictions) {
      if (!contradiction.supersededFactId) continue;
      const target = existingFacts.find((f) => f.id === contradiction.supersededFactId);
      if (target && target.status === 'active') {
        const superseded = this.confidenceEngine.supersedeFact(target, 'superseded_by_contradiction');
        await this.factStore.saveFact(superseded);
        supersededSet.add(target.id);
        target.status = 'superseded';
        await this.factStore.recordLifecycleEvent({
          id: `event-${crypto.randomUUID()}`,
          factId: target.id,
          userId,
          eventType: 'superseded',
          timestamp,
          details: { reason: contradiction.contradictedSummary },
        });
      }
    }

    for (const factData of extraction.facts) {
      try {
        const normalizedCategory = factData.category.trim().toLowerCase().replaceAll(' ', '_');
        const existing = existingFacts.find(
          (f) =>
            !supersededSet.has(f.id) &&
            f.status !== 'superseded' &&
            f.status !== 'retracted' &&
            (f.category === normalizedCategory || f.content.toLowerCase() === factData.content.toLowerCase()),
        );

        if (existing) {
          const reinforced = this.confidenceEngine.reinforceFact(existing, {
            source: 'conversation',
            evidence: {
              turnId,
              citation: factData.citation,
              timestamp,
              surface: input.surface || undefined,
            },
            timestamp,
          });

          const mergedTools = Array.from(
            new Set([...(existing.targetTools || []), ...(factData.targetTools || [])]),
          );
          const reinforcedWithTools: UserModelFact = {
            ...reinforced,
            targetTools: mergedTools,
          };

          await this.factStore.saveFact(reinforcedWithTools);
          await this.factStore.recordLifecycleEvent({
            id: `event-${crypto.randomUUID()}`,
            factId: reinforced.id,
            userId,
            eventType: 'reinforced',
            timestamp,
          });
          savedCount++;
        } else {
          const status = this.confidenceEngine.resolveFactStatus(factData.confidenceScore, [
            { citation: factData.citation, timestamp },
          ]);

          const newFact: UserModelFact = {
            id: `fact-${crypto.randomUUID()}`,
            userId,
            content: factData.content,
            kind: factData.kind,
            category: normalizedCategory,
            status,
            version: 1,
            confidence: factData.confidenceScore,
            targetTools: factData.targetTools || [],
            evidence: [
              {
                turnId,
                citation: factData.citation,
                timestamp,
                surface: input.surface || undefined,
              },
            ],
            source: 'conversation',
            language: 'en',
            surface: input.surface || null,
            lastObservedAt: timestamp,
            occurrences: 1,
          };

          await this.factStore.saveFact(newFact);
          await this.factStore.recordLifecycleEvent({
            id: `event-${crypto.randomUUID()}`,
            factId: newFact.id,
            userId,
            eventType: 'created',
            timestamp,
          });
          savedCount++;
        }
      } catch (err: unknown) {
        logger.warn('Failed to save extracted fact during reflection', {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    await this.factStore.markTurnProcessed(turnId);
    return { extractedCount: savedCount };
  }

  private buildAnalysisPayload(
    userMessage: string,
    assistantText: string,
    toolExecutions: ProductSurfaceToolExecution[],
  ): string {
    const toolsText =
      toolExecutions.length > 0
        ? toolExecutions
            .map(
              (t) =>
                `- Tool: ${t.toolName} | Status: ${t.status}${t.errorSnippet ? ` | Error: ${t.errorSnippet}` : ''}${t.paramsSummary ? ` | Params: ${t.paramsSummary}` : ''}`,
            )
            .join('\n')
        : 'None';

    return [
      `User Message: "${userMessage}"`,
      `Assistant Response: "${assistantText}"`,
      `Tool Executions:\n${toolsText}`,
    ].join('\n\n');
  }

  private async extractWithRepair(payload: string): Promise<TrajectoryExtractionResult | null> {
    const systemPrompt = [
      'You are a cognitive trajectory reflection engine for the Zavorth agent harness.',
      'Analyze the conversation turn and tool executions to extract durable lessons.',
      'Categories of interest:',
      '1. Declarative user facts/preferences: tone, language, code style, constraints, schedules, expertise.',
      '2. Procedural lessons: when a tool fails or succeeds in a specific way, parameter conventions, workarounds.',
      '3. Contradictions: when a user explicitly alters or reverses a previous preference.',
      '',
      'Return ONLY a valid JSON object matching this schema:',
      '{',
      '  "facts": [',
      '    {',
      '      "content": "Description of the fact or lesson",',
      '      "kind": "preference" | "behavior" | "expertise" | "schedule" | "decision" | "opinion" | "skill-lesson",',
      '      "category": "short_category_slug",',
      '      "targetTools": ["tool_name"],',
      '      "citation": "Exact quote or execution snippet from turn justifying this fact",',
      '      "confidenceScore": 0.0 to 1.0',
      '    }',
      '  ],',
      '  "contradictions": [',
      '    {',
      '      "supersededFactId": "optional_id_if_known",',
      '      "contradictedSummary": "explanation of contradiction"',
      '    }',
      '  ]',
      '}',
      'If nothing durable or meaningful is learned, return {"facts": [], "contradictions": []}.',
    ].join('\n');

    try {
      const response = await this.llmInference.synthesize(systemPrompt, payload);
      const repairResult = this.repairService.parseSafe<unknown>(response.content);

      if (repairResult.success && repairResult.data) {
        const validated = trajectoryExtractionSchema.safeParse(repairResult.data);
        if (validated.success) {
          return validated.data;
        }
      }

      // 1-retry repair pass
      const repairPrompt = `Your previous output could not be parsed according to the required schema. Error: ${repairResult.errorMessage || 'Invalid schema'}. Output pure valid JSON matching {"facts": [], "contradictions": []}.`;
      const retryResponse = await this.llmInference.synthesize(systemPrompt, `${payload}\n\n${repairPrompt}`);
      const retryResult = this.repairService.parseSafe<unknown>(retryResponse.content);

      if (retryResult.success && retryResult.data) {
        const validated = trajectoryExtractionSchema.safeParse(retryResult.data);
        if (validated.success) {
          return validated.data;
        }
      }

      logger.warn('Trajectory reflection extraction failed after retry', {
        errorMessage: retryResult.errorMessage,
      });
      return null;
    } catch (err: unknown) {
      logger.warn('Trajectory reflection synthesis error', {
        error: err instanceof Error ? err.message : String(err),
      });
      return null;
    }
  }
}
