import fs from 'fs';
import path from 'path';

import { UserModelTurnCaptureService, type CapturedTurn } from './UserModelTurnCaptureService.js';
import { UserModelDialecticReasoningService, type DialecticSynthesis } from './UserModelDialecticReasoningService.js';
import { UserModelDialecticService } from './UserModelDialecticService.js';

export type ReviewDaemonConfig = {
  enabled: boolean;
  intervalMs: number;
  minTurnsForReview: number;
  maxReviewAge: number;
};

export type ReviewDaemonStatus = {
  running: boolean;
  lastReviewAt: string | null;
  nextReviewAt: string | null;
  totalReviews: number;
  turnsSinceLastReview: number;
  currentSynthesis: DialecticSynthesis | null;
};

export type ReviewDaemonRuntime = {
  homeRoot?: string;
  now?: () => Date;
  config?: Partial<ReviewDaemonConfig>;
  turnCapture?: UserModelTurnCaptureService;
  dialecticReasoning?: UserModelDialecticReasoningService;
  dialectic?: UserModelDialecticService;
};

const DEFAULT_CONFIG: ReviewDaemonConfig = {
  enabled: true,
  intervalMs: 300000,
  minTurnsForReview: 5,
  maxReviewAge: 86400000,
};

const STATUS_FILE = 'data/runtime/user-model-review-daemon.json';

export class UserModelReviewDaemonService {
  private readonly homeRoot: string;
  private readonly now: () => Date;
  private readonly config: ReviewDaemonConfig;
  private readonly turnCapture: UserModelTurnCaptureService;
  private readonly dialecticReasoning: UserModelDialecticReasoningService;
  private readonly dialectic: UserModelDialecticService;
  private status: ReviewDaemonStatus;
  private intervalHandle: ReturnType<typeof setInterval> | null = null;

  constructor(runtime: ReviewDaemonRuntime = {}) {
    this.homeRoot = runtime.homeRoot || process.cwd();
    this.now = runtime.now || (() => new Date());
    this.config = { ...DEFAULT_CONFIG, ...runtime.config };
    this.turnCapture = runtime.turnCapture || new UserModelTurnCaptureService({ homeRoot: this.homeRoot, now: this.now });
    this.dialecticReasoning = runtime.dialecticReasoning || new UserModelDialecticReasoningService({ homeRoot: this.homeRoot, now: this.now });
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
        console.error('[ReviewDaemon] Review cycle failed:', err);
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

    const synthesis = this.dialecticReasoning.synthesize(conversations, {
      userId: turns[0]?.userId || undefined,
      sessionId: turns[0]?.sessionId || undefined,
    });

    for (const insight of synthesis.insights) {
      if (insight.confidence >= 0.5 && insight.category !== 'inquiry') {
        this.dialectic.recordAnswer(insight.category, insight.observation);
      }
    }

    this.status.lastReviewAt = this.now().toISOString();
    this.status.totalReviews++;
    this.status.turnsSinceLastReview = 0;
    this.status.currentSynthesis = synthesis;
    this.updateNextReviewAt();
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
      } catch {
        // ignore
      }
    }
    return {
      running: false,
      lastReviewAt: null,
      nextReviewAt: null,
      totalReviews: 0,
      turnsSinceLastReview: 0,
      currentSynthesis: null,
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
