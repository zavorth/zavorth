import crypto from 'node:crypto';
import path from 'node:path';
import type { ToolDefinition } from '../providers/ILlmProvider.js';
import {
  type UserModelFact,
  type UserModelFactKind,
  userModelFactKindSchema,
} from '../contracts/user-model/UserModelFactContract.js';
import { UserModelConfidenceEngine } from '../services/user-model/UserModelConfidenceEngine.js';
import { UserModelFactStore } from '../services/user-model/UserModelFactStore.js';
import { BaseTool } from './BaseTool.js';

export type RememberFactToolOptions = {
  factStore?: UserModelFactStore;
  confidenceEngine?: UserModelConfidenceEngine;
  projectRoot?: string | null;
  now?: () => Date;
};

export class RememberFactTool extends BaseTool {
  public readonly name = 'remember_fact';

  public readonly description =
    'Explicitly remember a durable user preference, rule, schedule constraint, expertise, or procedural lesson. ' +
    'Persists across restarts and automatically updates the agent memory context.';

  public readonly parameters: ToolDefinition['parameters'] = {
    type: 'object',
    properties: {
      fact: {
        type: 'string',
        description: 'The declarative fact, preference, rule, or procedural lesson to store.',
      },
      category: {
        type: 'string',
        description: 'Short category slug (e.g. language, coding_style, schedule, tool_execution).',
      },
      kind: {
        type: 'string',
        description: 'Category of the fact: preference, expertise, schedule, opinion, decision, behavior, or skill-lesson.',
        enum: [
          'preference',
          'behavior',
          'expertise',
          'schedule',
          'decision',
          'opinion',
          'skill-lesson',
        ],
      },
      superseded_fact_id: {
        type: 'string',
        description: 'Optional ID of a previous fact this new fact contradicts or supersedes.',
      },
      confidence: {
        type: 'number',
        description: 'Confidence score between 0.0 and 1.0 (default 1.0 for explicit user facts).',
      },
      target_tools: {
        type: 'array',
        items: { type: 'string' },
        description: 'Optional list of specific tool names this procedural rule or preference applies to.',
      },
    },
    required: ['fact', 'category'],
  };

  private readonly factStore: UserModelFactStore;
  private readonly confidenceEngine: UserModelConfidenceEngine;
  private readonly now: () => Date;

  public constructor(options?: RememberFactToolOptions) {
    super();
    const projectRoot = options?.projectRoot || process.cwd();
    this.factStore =
      options?.factStore ||
      new UserModelFactStore({
        dataDir: path.join(projectRoot, 'data', 'runtime', 'user-model'),
      });
    this.confidenceEngine = options?.confidenceEngine || new UserModelConfidenceEngine();
    this.now = options?.now || (() => new Date());
  }

  public async execute(args: Record<string, unknown>): Promise<string> {
    const rawFact = String(args.fact || '').trim();
    const rawCategory = String(args.category || '').trim();
    const rawKind = String(args.kind || 'preference').trim();
    const supersededFactId = args.superseded_fact_id ? String(args.superseded_fact_id).trim() : null;
    const confidenceInput = typeof args.confidence === 'number' ? args.confidence : 1.0;
    const targetTools = Array.isArray(args.target_tools)
      ? (args.target_tools as unknown[])
          .map((t) => String(t || '').trim())
          .filter(Boolean)
      : [];

    if (!rawFact) {
      return JSON.stringify({ success: false, error: 'Missing required argument: fact' });
    }
    if (!rawCategory) {
      return JSON.stringify({ success: false, error: 'Missing required argument: category' });
    }

    const kindValidation = userModelFactKindSchema.safeParse(rawKind);
    const kind: UserModelFactKind = kindValidation.success ? kindValidation.data : 'preference';

    const normalizedCategory = rawCategory.toLowerCase().replaceAll(' ', '_');
    const timestamp = this.now().toISOString();
    const newFactId = `fact-${crypto.randomUUID()}`;
    const userId = 'local-user';

    await this.factStore.initialize();

    if (supersededFactId) {
      const existing = await this.factStore.getFactById(supersededFactId);
      if (existing && existing.status !== 'superseded') {
        const superseded = this.confidenceEngine.supersedeFact(existing, newFactId);
        await this.factStore.saveFact(superseded);
        await this.factStore.recordLifecycleEvent({
          id: `event-${crypto.randomUUID()}`,
          factId: existing.id,
          userId,
          eventType: 'superseded',
          timestamp,
          details: { supersededBy: newFactId },
        });
      }
    }

    const confidence = Math.max(0.7, Math.min(1.0, confidenceInput));
    const newFact: UserModelFact = {
      id: newFactId,
      userId,
      content: rawFact,
      kind,
      category: normalizedCategory,
      status: 'active',
      version: 1,
      confidence,
      targetTools,
      evidence: [
        {
          citation: 'Explicitly remembered via remember_fact tool',
          timestamp,
        },
      ],
      source: 'explicit',
      language: 'en',
      surface: null,
      lastObservedAt: timestamp,
      occurrences: 1,
    };

    await this.factStore.saveFact(newFact);
    await this.factStore.recordLifecycleEvent({
      id: `event-${crypto.randomUUID()}`,
      factId: newFactId,
      userId,
      eventType: 'created',
      timestamp,
    });

    return JSON.stringify({
      success: true,
      factId: newFactId,
      message: `Successfully remembered: "${rawFact}"`,
      category: normalizedCategory,
      kind,
      confidence,
      targetTools,
    });
  }
}
