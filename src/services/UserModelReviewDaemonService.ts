import fs from 'fs';
import path from 'path';

import { UserModelTurnCaptureService, type CapturedTurn } from './UserModelTurnCaptureService.js';
import { UserModelDialecticReasoningService, type DialecticSynthesis } from './UserModelDialecticReasoningService.js';
import { UserModelDialecticService, type DialecticQuestionCategory } from './UserModelDialecticService.js';
import { ZavorthLlmRuntimeService } from './ZavorthLlmRuntimeService.js';
import { logger } from '../logger.js';

export type ReviewDaemonConfig = {
  enabled: boolean;
  intervalMs: number;
  minTurnsForReview: number;
  maxReviewAge: number;
  enableLlmReasoning: boolean;
  llmProvider?: string;
  llmModel?: string;
  llmMaxPasses: number;
};

export type ReviewDaemonStatus = {
  running: boolean;
  lastReviewAt: string | null;
  nextReviewAt: string | null;
  totalReviews: number;
  turnsSinceLastReview: number;
  currentSynthesis: DialecticSynthesis | null;
  lastLlmReviewAt: string | null;
  totalLlmReviews: number;
};

export type ReviewDaemonRuntime = {
  homeRoot?: string;
  now?: () => Date;
  config?: Partial<ReviewDaemonConfig>;
  turnCapture?: UserModelTurnCaptureService;
  dialecticReasoning?: UserModelDialecticReasoningService;
  dialectic?: UserModelDialecticService;
  llmService?: ZavorthLlmRuntimeService;
};

const DEFAULT_CONFIG: ReviewDaemonConfig = {
  enabled: true,
  intervalMs: 300000,
  minTurnsForReview: 5,
  maxReviewAge: 86400000,
  enableLlmReasoning: false,
  llmMaxPasses: 3,
};

const STATUS_FILE = 'data/runtime/user-model-review-daemon.json';

export class UserModelReviewDaemonService {
  private readonly homeRoot: string;
  private readonly now: () => Date;
  private readonly config: ReviewDaemonConfig;
  private readonly turnCapture: UserModelTurnCaptureService;
  private readonly dialecticReasoning: UserModelDialecticReasoningService;
  private readonly dialectic: UserModelDialecticService;
  private readonly llmService: ZavorthLlmRuntimeService | null;
  private status: ReviewDaemonStatus;
  private intervalHandle: ReturnType<typeof setInterval> | null = null;

  constructor(runtime: ReviewDaemonRuntime = {}) {
    this.homeRoot = runtime.homeRoot || process.cwd();
    this.now = runtime.now || (() => new Date());
    this.config = { ...DEFAULT_CONFIG, ...runtime.config };
    this.turnCapture = runtime.turnCapture || new UserModelTurnCaptureService({ homeRoot: this.homeRoot, now: this.now });
    this.llmService = runtime.llmService || (this.config.enableLlmReasoning
      ? new ZavorthLlmRuntimeService(this.config.llmProvider)
      : null);

    this.dialecticReasoning = runtime.dialecticReasoning || new UserModelDialecticReasoningService({
      homeRoot: this.homeRoot,
      now: this.now,
      llmService: this.llmService || undefined,
      config: {
        depth: this.config.enableLlmReasoning ? 4 : 2,
        llmProvider: this.config.llmProvider,
        llmModel: this.config.llmModel,
        llmMaxPasses: this.config.llmMaxPasses,
      },
    });

    this.dialectic = runtime.dialectic || new UserModelDialecticService({ homeRoot: this.homeRoot, now: this.now });
    this.status = this.loadStatus();
  }

  start(): void {
    if (!this.config.enabled) return;
    if (this.intervalHandle) return;

    this.status.running = true;
    this.updateNextReviewAt();
    this.saveStatus();

    this.intervalHandle = setInterval(() => {
      this.runReviewCycle().catch((err) => {
        logger.error('[ReviewDaemon] Review cycle failed:', err);
      });
    }, this.config.intervalMs);
  }

  stop(): void {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
    this.status.running = false;
    this.saveStatus();
  }

  async runReviewCycle(): Promise<DialecticSynthesis | null> {
    const turns = this.turnCapture.getRecentTurns(200);
    if (turns.length < this.config.minTurnsForReview) return null;

    const conversations = this.buildConversationPairs(turns);
    if (conversations.length < 2) return null;

    const synthesis = await this.dialecticReasoning.synthesize(conversations, {
      userId: turns[0]?.userId || undefined,
      sessionId: turns[0]?.sessionId || undefined,
    });

    for (const insight of synthesis.insights) {
      if (insight.confidence >= 0.5 && insight.category !== 'inquiry' && this.isKnownTraitCategory(insight.category)) {
        this.dialectic.recordTrait(insight.category, insight.observation);
      }
    }

    if (synthesis.llmSynthesis) {
      this.status.lastLlmReviewAt = this.now().toISOString();
      this.status.totalLlmReviews++;
    }

    this.status.lastReviewAt = this.now().toISOString();
    this.status.totalReviews++;
    this.status.turnsSinceLastReview = 0;
    this.status.currentSynthesis = synthesis;
    this.updateNextReviewAt();
    this.saveStatus();

    return synthesis;
  }

  private isKnownTraitCategory(category: string): category is DialecticQuestionCategory {
    return (
      category === 'communication_style' ||
      category === 'work_preferences' ||
      category === 'domain_expertise' ||
      category === 'tool_preferences' ||
      category === 'schedule' ||
      category === 'personality'
    );
  }

  async runLlmReview(): Promise<DialecticSynthesis | null> {
    if (!this.config.enableLlmReasoning || !this.llmService) return null;

    const turns = this.turnCapture.getRecentTurns(200);
    const conversations = this.buildConversationPairs(turns);
    if (conversations.length < 2) return null;

    const llmReasoning = new UserModelDialecticReasoningService({
      homeRoot: this.homeRoot,
      now: this.now,
      llmService: this.llmService,
      config: {
        depth: 4,
        llmProvider: this.config.llmProvider,
        llmModel: this.config.llmModel,
        llmMaxPasses: this.config.llmMaxPasses,
      },
    });

    const synthesis = await llmReasoning.synthesize(conversations, {
      userId: turns[0]?.userId || undefined,
      sessionId: turns[0]?.sessionId || undefined,
    });

    for (const insight of synthesis.insights) {
      if (insight.confidence >= 0.5 && insight.category !== 'inquiry' && this.isKnownTraitCategory(insight.category)) {
        this.dialectic.recordTrait(insight.category, insight.observation);
      }
    }

    this.status.lastLlmReviewAt = this.now().toISOString();
    this.status.totalLlmReviews++;
    this.status.lastReviewAt = this.now().toISOString();
    this.status.totalReviews++;
    this.status.currentSynthesis = synthesis;
    this.saveStatus();

    return synthesis;
  }

  getStatus(): ReviewDaemonStatus {
    return { ...this.status };
  }

  forceReview(): Promise<DialecticSynthesis | null> {
    return this.runReviewCycle();
  }

  private buildConversationPairs(turns: CapturedTurn[]): Array<{ user: string; assistant: string }> {
    const pairs: Array<{ user: string; assistant: string }> = [];
    for (let i = 0; i < turns.length - 1; i++) {
      if (turns[i].kind === 'user_message' && turns[i + 1].kind === 'assistant_response') {
        pairs.push({ user: turns[i].content, assistant: turns[i + 1].content });
      }
    }
    return pairs;
  }

  private updateNextReviewAt(): void {
    this.status.nextReviewAt = new Date(this.now().getTime() + this.config.intervalMs).toISOString();
  }

  private loadStatus(): ReviewDaemonStatus {
    const fp = this.getStatusPath();
    if (fs.existsSync(fp)) {
      try {
        return JSON.parse(fs.readFileSync(fp, 'utf-8'));
      } catch (error: unknown) {// ignore
      logger.warn('[User Model] JSON parse failed', error);
    }
    }
    return {
      running: false,
      lastReviewAt: null,
      nextReviewAt: null,
      totalReviews: 0,
      turnsSinceLastReview: 0,
      currentSynthesis: null,
      lastLlmReviewAt: null,
      totalLlmReviews: 0,
    };
  }

  private saveStatus(): void {
    const fp = this.getStatusPath();
    const dir = path.dirname(fp);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(fp, JSON.stringify(this.status, null, 2), 'utf-8');
  }

  private getStatusPath(): string {
    return path.join(this.homeRoot, STATUS_FILE);
  }
}
