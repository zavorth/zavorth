import { resolveLearningRuntimePolicy } from './ZavorthLearningRuntimePolicy.js';
import { ZavorthLearningRuntimeHubService } from './ZavorthLearningRuntimeHubService.js';
import { ZavorthNativeAutonomySpineService } from './ZavorthNativeAutonomySpineService.js';
import { ZavorthHumanSuperpowersService } from './ZavorthHumanSuperpowersService.js';
import { ZavorthHumanReachService } from './ZavorthHumanReachService.js';
import { canActorWriteLearning } from './ZavorthLearningWriteAuth.js';
import { migrateLegacyLearningPreferencesToKnownUsers } from './ZavorthLearningLegacyMigration.js';

export type ProductSurfaceId =
  | 'telegram'
  | 'discord'
  | 'web'
  | 'desktop'
  | 'cli'
  | 'experience'
  | 'agent-run'
  | 'conversational'
  | string;

export type ProductSurfaceTurnInput = {
  userId?: string | null;
  surface?: ProductSurfaceId | null;
  userMessage: string;
  assistantText: string;
  toolCallCount?: number;
  projectRoot?: string | null;
  turnId?: string | null;
  sessionId?: string | null;
  chatId?: string | null;
  /** When false, inject path is unchanged but post-turn durable write is skipped. */
  allowLearningWrite?: boolean | null;
};

export type ProductSurfaceContextInput = {
  userId?: string | null;
  projectRoot?: string | null;
  includeLearning?: boolean;
  includeSuperpowers?: boolean;
  includeReach?: boolean;
  /** Superpowers prompt omits raw learned items when learning block is already injected. */
  includeLearnedInSuperpowers?: boolean;
};

/**
 * Single product-surface adapter for learning/context inject + post-turn write.
 * All chat surfaces should call this so inject and learn behave the same.
 */
export class ZavorthProductSurfaceRuntimeService {
  private readonly projectRoot: string;
  private static legacyMigrationAttempted = new Set<string>();

  public constructor(deps: { projectRoot?: string | null } = {}) {
    this.projectRoot = String(deps.projectRoot || process.cwd());
    this.ensureLegacyLearningMigration();
  }

  private ensureLegacyLearningMigration(): void {
    if (ZavorthProductSurfaceRuntimeService.legacyMigrationAttempted.has(this.projectRoot)) {
      return;
    }
    ZavorthProductSurfaceRuntimeService.legacyMigrationAttempted.add(this.projectRoot);
    try {
      migrateLegacyLearningPreferencesToKnownUsers({ projectRoot: this.projectRoot });
    } catch {
      // best-effort; learning still works with empty per-user stores
    }
  }

  public formatInjectBlocks(input: ProductSurfaceContextInput = {}): string {
    const blocks: string[] = [];
    const includeLearning = input.includeLearning !== false;
    const includeSuperpowers = input.includeSuperpowers !== false;
    const includeReach = input.includeReach !== false;
    const userId = normalizeSurfaceUserId(input.userId);

    if (includeLearning) {
      try {
        const hub = new ZavorthLearningRuntimeHubService({
          projectRoot: this.projectRoot,
          userId,
        });
        const block = hub.formatContextBlock();
        if (block) blocks.push(block);
      } catch {
      }
    }
    if (includeSuperpowers) {
      try {
        const includeLearned = input.includeLearnedInSuperpowers === true;
        const block = new ZavorthHumanSuperpowersService({
          projectRoot: this.projectRoot,
          userId,
        }).formatPromptBlock(undefined, { includeLearned });
        if (block) blocks.push(block);
      } catch {
      }
    }
    if (includeReach) {
      try {
        const block = new ZavorthHumanReachService({
          projectRoot: this.projectRoot,
        }).formatPromptBlock();
        if (block) blocks.push(block);
      } catch {
      }
    }
    return blocks.join('\n\n');
  }

  public appendInjectBlocks(systemInstruction: string, input: ProductSurfaceContextInput = {}): string {
    const blocks = this.formatInjectBlocks(input);
    if (!blocks) return systemInstruction;
    return `${systemInstruction}\n\n${blocks}`;
  }

  public async recordSuccessfulTurn(input: ProductSurfaceTurnInput): Promise<{
    ok: boolean;
    mode: string;
    appliedPreferences: number;
    draftedSkills: number;
  }> {
    const assistantText = String(input.assistantText || '').trim();
    const userMessage = String(input.userMessage || '').trim();
    if (!assistantText || !userMessage) {
      return { ok: false, mode: 'skipped', appliedPreferences: 0, draftedSkills: 0 };
    }
    const userId = normalizeSurfaceUserId(input.userId);
    const surface = String(input.surface || 'runtime').trim() || 'runtime';
    const chatId = String(input.chatId || input.sessionId || '').trim() || null;
    if (!canActorWriteLearning({
      surface,
      userId,
      chatId,
      allowLearningWrite: input.allowLearningWrite,
    })) {
      return { ok: false, mode: 'skipped-no-write-permission', appliedPreferences: 0, draftedSkills: 0 };
    }

    const toolCallCount = Math.max(0, Number(input.toolCallCount || 0) || 0);
    const policy = resolveLearningRuntimePolicy({ projectRoot: this.projectRoot, userId });

    try {
      const spine = new ZavorthNativeAutonomySpineService({
        projectRoot: this.projectRoot,
        userId,
      });
      const snapshot = await spine.buildSnapshot({
        turn: {
          turnId: String(input.turnId || `surface-${Date.now().toString(36)}`),
          sessionId: input.sessionId || null,
          userId,
          outcome: 'success',
          userMessage,
          assistantResponse: assistantText,
          toolReceipts: toolCallCount > 0
            ? Array.from({ length: Math.min(toolCallCount, 8) }, (_, index) => ({
              id: `tool-${index + 1}`,
              kind: 'tool',
              status: 'done',
              summary: 'tool',
            }))
            : [],
          toolCallCount,
          sourceSurface: surface,
        },
      });
      return {
        ok: true,
        mode: snapshot.learningWrite?.mode || policy.mode,
        appliedPreferences: snapshot.learningWrite?.appliedPreferences || 0,
        draftedSkills: snapshot.learningWrite?.draftedSkills || 0,
      };
    } catch {
      return { ok: false, mode: policy.mode, appliedPreferences: 0, draftedSkills: 0 };
    }
  }

  public scheduleSuccessfulTurn(input: ProductSurfaceTurnInput): void {
    void this.recordSuccessfulTurn(input).catch(() => undefined);
  }
}

export function normalizeSurfaceUserId(userId: string | null | undefined): string {
  const raw = String(userId || '').trim();
  if (!raw) return 'local-user';
  const safe = raw.replace(/[^a-zA-Z0-9._@+-]+/g, '_').slice(0, 120);
  return safe || 'local-user';
}

export function getProductSurfaceRuntime(projectRoot?: string | null): ZavorthProductSurfaceRuntimeService {
  return new ZavorthProductSurfaceRuntimeService({ projectRoot: projectRoot || process.cwd() });
}
