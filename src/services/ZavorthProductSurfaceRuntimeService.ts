import path from 'node:path';
import { logger } from '../logger.js';
import { resolveLearningRuntimePolicy } from './ZavorthLearningRuntimePolicy.js';
import { ZavorthLearningRuntimeHubService } from './ZavorthLearningRuntimeHubService.js';
import { ZavorthNativeAutonomySpineService } from './ZavorthNativeAutonomySpineService.js';
import { ZavorthHumanSuperpowersService } from './ZavorthHumanSuperpowersService.js';
import { ZavorthHumanReachService } from './ZavorthHumanReachService.js';
import { canActorWriteLearning } from './ZavorthLearningWriteAuth.js';
import { migrateLegacyLearningPreferencesToKnownUsers } from './ZavorthLearningLegacyMigration.js';
import { UserModelFactStore } from './user-model/UserModelFactStore.js';
import { UserModelTrajectoryReflectionService } from './user-model/UserModelTrajectoryReflectionService.js';
import { UserModelMnemosProceduralBridgeService } from './user-model/UserModelMnemosProceduralBridgeService.js';

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

export type ProductSurfaceToolExecution = {
  toolName: string;
  status: 'success' | 'error';
  errorSnippet?: string;
  paramsSummary?: string;
};

export type ProductSurfaceTurnInput = {
  userId?: string | null;
  surface?: ProductSurfaceId | null;
  userMessage: string;
  assistantText: string;
  toolCallCount?: number;
  toolExecutions?: ProductSurfaceToolExecution[];
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
      } catch { /* intentionally ignored */ }
    }
    if (includeSuperpowers) {
      try {
        const includeLearned = input.includeLearnedInSuperpowers === true;
        const block = new ZavorthHumanSuperpowersService({
          projectRoot: this.projectRoot,
          userId,
        }).formatPromptBlock(undefined, { includeLearned });
        if (block) blocks.push(block);
      } catch { /* intentionally ignored */ }
    }
    if (includeReach) {
      try {
        const block = new ZavorthHumanReachService({
          projectRoot: this.projectRoot,
        }).formatPromptBlock();
        if (block) blocks.push(block);
      } catch { /* intentionally ignored */ }
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

    const toolExecutions = input.toolExecutions || [];
    const toolCallCount = Math.max(toolExecutions.length, Number(input.toolCallCount || 0) || 0);
    const policy = resolveLearningRuntimePolicy({ projectRoot: this.projectRoot, userId });

    const toolReceipts = toolExecutions.length > 0
      ? toolExecutions.map((exec, index) => ({
        id: `tool-${index + 1}`,
        kind: 'tool',
        status: exec.status === 'error' ? 'failed' : 'done',
        summary: exec.toolName,
      }))
      : toolCallCount > 0
      ? Array.from({ length: Math.min(toolCallCount, 8) }, (_, index) => ({
        id: `tool-${index + 1}`,
        kind: 'tool',
        status: 'done',
        summary: 'tool',
      }))
      : [];

    try {
      const factStore = new UserModelFactStore({
        dataDir: path.join(this.projectRoot, 'data', 'runtime', 'user-model'),
      });
      const reflection = new UserModelTrajectoryReflectionService({ factStore });
      void reflection
        .processTurn(input)
        .then(async () => {
          try {
            const bridge = new UserModelMnemosProceduralBridgeService({
              factStore,
              projectRoot: this.projectRoot,
            });
            const facts = await factStore.listFactsByUserId(userId);
            const pendingLifecycle = facts.filter(
              (f) => f.proceduralPointer && (f.status === 'superseded' || f.status === 'retracted'),
            );
            for (const fact of pendingLifecycle) {
              await bridge.syncLifecycle(fact);
            }
            const unpromotedFacts = facts.filter(
              (f) => f.status === 'active' && !f.proceduralPointer,
            );
            const candidates = await bridge.evaluateNewFacts(unpromotedFacts);
            for (const candidate of candidates) {
              const snapshot = await bridge.proposePromotion(candidate.factId);
              if (snapshot && snapshot.status === 'ready' && snapshot.rule) {
                logger.info('Procedural promotion draft persisted for operator approval', {
                  factId: candidate.factId,
                  ruleId: snapshot.rule.id,
                  kind: snapshot.rule.kind,
                  risk: snapshot.rule.risk,
                });
              }
            }
          } catch (bridgeErr: unknown) {
            logger.warn('UserModelMnemosProceduralBridgeService evaluation failed in background', {
              error: bridgeErr instanceof Error ? bridgeErr.message : String(bridgeErr),
            });
          }
        })
        .catch((err: unknown) => {
          logger.warn('UserModelTrajectoryReflectionService failed in background', {
            error: err instanceof Error ? err.message : String(err),
          });
        });
    } catch (err: unknown) {
      logger.warn('Failed to initiate UserModelTrajectoryReflectionService', {
        error: err instanceof Error ? err.message : String(err),
      });
    }

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
          toolReceipts,
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
