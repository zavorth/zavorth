import crypto from 'node:crypto';
import path from 'node:path';
import {
  type UserModelConfig,
  resolveUserModelConfig,
} from '../../contracts/user-model/UserModelConfigContract.js';
import type { UserModelFact } from '../../contracts/user-model/UserModelFactContract.js';
import {
  type BridgeCandidateAssessment,
  type ScopedToolGuidance,
} from '../../contracts/user-model/UserModelMnemosBridgeContract.js';
import type {
  ZavorthMnemosProceduralMemorySnapshot,
  ZavorthMnemosProceduralRisk,
  ZavorthMnemosProceduralRuleKind,
} from '../../contracts/memory/ZavorthMnemosProceduralMemoryContract.js';
import { ZavorthMnemosProceduralMemoryService } from '../ZavorthMnemosProceduralMemoryService.js';
import { UserModelConfidenceEngine } from './UserModelConfidenceEngine.js';
import type { UserModelFactStore } from './UserModelFactStore.js';
import { logger } from '../../logger.js';

export type UserModelMnemosBridgeDeps = {
  factStore: UserModelFactStore;
  proceduralMemory?: ZavorthMnemosProceduralMemoryService;
  confidenceEngine?: UserModelConfidenceEngine;
  config?: UserModelConfig;
  now?: () => Date;
  projectRoot?: string;
};

export class UserModelMnemosProceduralBridgeService {
  private readonly factStore: UserModelFactStore;
  private readonly proceduralMemory: ZavorthMnemosProceduralMemoryService;
  private readonly confidenceEngine: UserModelConfidenceEngine;
  private readonly config: UserModelConfig;
  private readonly now: () => Date;

  public constructor(deps: UserModelMnemosBridgeDeps) {
    this.factStore = deps.factStore;
    this.config = deps.config || resolveUserModelConfig();
    this.confidenceEngine = deps.confidenceEngine || new UserModelConfidenceEngine({ config: this.config });
    this.now = deps.now || (() => new Date());
    this.proceduralMemory =
      deps.proceduralMemory ||
      new ZavorthMnemosProceduralMemoryService({
        projectRoot: deps.projectRoot || path.resolve(process.cwd()),
        now: this.now,
      });
  }

  public assessFact(fact: UserModelFact): BridgeCandidateAssessment {
    const isUnpromotedActive = fact.status === 'active' && !fact.proceduralPointer;
    const isOperationalKind =
      fact.kind === 'skill-lesson' ||
      fact.kind === 'decision' ||
      (Array.isArray(fact.targetTools) && fact.targetTools.length > 0);

    const decayedConfidence = this.confidenceEngine.calculateDecayedConfidence(fact, this.now());
    const meetsThreshold = decayedConfidence >= this.config.proceduralPromotionThreshold;

    const reasons: string[] = [];
    if (!isUnpromotedActive) reasons.push('Fact is not active or is already promoted');
    if (!isOperationalKind) reasons.push(`Kind "${fact.kind}" is not an operational lesson`);
    if (!meetsThreshold) {
      reasons.push(
        `Confidence ${decayedConfidence.toFixed(2)} is below promotion threshold ${this.config.proceduralPromotionThreshold.toFixed(2)}`,
      );
    }

    const isCandidate = isUnpromotedActive && isOperationalKind && meetsThreshold;

    const categoryWords = fact.category
      .toLowerCase()
      .replaceAll('-', ' ')
      .replaceAll('_', ' ')
      .split(' ')
      .map((word) => word.trim())
      .filter((word) => word.length >= 2);

    const scopes = Array.from(new Set([...(fact.targetTools || []), ...categoryWords]));

    let targetKind: ZavorthMnemosProceduralRuleKind = 'workflow-preference';
    let risk: ZavorthMnemosProceduralRisk = 'medium';

    const normalizedLower = fact.content.toLowerCase();
    if (
      fact.category.includes('security') ||
      fact.category.includes('safety') ||
      normalizedLower.includes('never bypass') ||
      normalizedLower.includes('forbidden')
    ) {
      targetKind = 'safety-boundary';
      risk = 'high';
    } else if (
      fact.category.includes('approval') ||
      normalizedLower.includes('ask before') ||
      normalizedLower.includes('require approval')
    ) {
      targetKind = 'approval-policy';
      risk = 'medium';
    } else if (fact.kind === 'skill-lesson') {
      targetKind = 'general-procedure';
      risk = 'low';
    }

    return {
      factId: fact.id,
      isCandidate,
      reasons: isCandidate ? ['Qualified operational lesson meeting confidence threshold'] : reasons,
      targetKind,
      scopes: scopes.length > 0 ? scopes : ['general'],
      risk,
      confidence: decayedConfidence,
    };
  }

  public async proposePromotion(factId: string): Promise<ZavorthMnemosProceduralMemorySnapshot | null> {
    const fact = await this.factStore.getFactById(factId);
    if (!fact) {
      return null;
    }

    const assessment = this.assessFact(fact);
    if (!assessment.isCandidate) {
      logger.info('Fact evaluated as not eligible for procedural promotion', {
        factId,
        reasons: assessment.reasons,
      });
      return null;
    }

    return this.proceduralMemory.preview({
      text: fact.content,
      scope: assessment.scopes,
    });
  }

  public async promoteWithApproval(
    factId: string,
    approvalId: string,
  ): Promise<ZavorthMnemosProceduralMemorySnapshot | null> {
    if (!approvalId || !approvalId.trim()) {
      throw new Error('Approval ID is required for procedural promotion');
    }

    const fact = await this.factStore.getFactById(factId);
    if (!fact) {
      return null;
    }

    const assessment = this.assessFact(fact);
    if (!assessment.isCandidate) {
      throw new Error(`Fact ${factId} is not a valid candidate for procedural promotion: ${assessment.reasons.join(', ')}`);
    }

    const snapshot = this.proceduralMemory.apply({
      text: fact.content,
      scope: assessment.scopes,
      approvalId,
    });

    if (snapshot.status === 'ready' && snapshot.rule) {
      const promotedFact: UserModelFact = {
        ...fact,
        proceduralPointer: {
          ruleId: snapshot.rule.id,
          promotedAt: this.now().toISOString(),
        },
      };

      await this.factStore.saveFact(promotedFact);
      await this.factStore.recordLifecycleEvent({
        id: `event-${crypto.randomUUID()}`,
        factId: fact.id,
        userId: fact.userId,
        eventType: 'promoted_procedural',
        timestamp: this.now().toISOString(),
        details: {
          ruleId: snapshot.rule.id,
          approvalId,
          scope: assessment.scopes.join(','),
        },
      });
    }

    return snapshot;
  }

  public async getScopedGuidanceForTool(toolName: string, category?: string): Promise<string[]> {
    try {
      const cleanToolName = toolName.trim();
      if (!cleanToolName) {
        return [];
      }

      const toolSnapshot = this.proceduralMemory.query({ query: cleanToolName, limit: 5 });
      const statements = new Set<string>();

      for (const rule of toolSnapshot.rules) {
        statements.add(rule.statement);
      }

      if (category && category.trim()) {
        const catSnapshot = this.proceduralMemory.query({ query: category.trim(), limit: 5 });
        for (const rule of catSnapshot.rules) {
          statements.add(rule.statement);
        }
      }

      return Array.from(statements);
    } catch (err: unknown) {
      logger.warn('Failed to retrieve scoped procedural guidance, proceeding without it (fail-open)', {
        toolName,
        error: err instanceof Error ? err.message : String(err),
      });
      return [];
    }
  }

  public async getScopedGuidanceStructured(toolName: string): Promise<ScopedToolGuidance> {
    try {
      const cleanToolName = toolName.trim();
      if (!cleanToolName) {
        return { toolName, rules: [] };
      }

      const snapshot = this.proceduralMemory.query({ query: cleanToolName, limit: 10 });
      return {
        toolName: cleanToolName,
        rules: snapshot.rules.map((rule) => ({
          id: rule.id,
          statement: rule.statement,
          kind: rule.kind,
          risk: rule.risk,
        })),
      };
    } catch (err: unknown) {
      logger.warn('Failed to query structured procedural guidance (fail-open)', {
        toolName,
        error: err instanceof Error ? err.message : String(err),
      });
      return { toolName, rules: [] };
    }
  }

  public async syncLifecycle(fact: UserModelFact): Promise<void> {
    if (!fact.proceduralPointer) {
      return;
    }

    if (fact.status === 'superseded' || fact.status === 'retracted') {
      try {
        this.proceduralMemory.revoke({
          id: fact.proceduralPointer.ruleId,
          approvalId: 'auto-sync-lifecycle',
          reason: `Source fact was ${fact.status} in user model fact store`,
        });
      } catch (err: unknown) {
        logger.warn('Failed to revoke procedural rule during fact lifecycle sync', {
          factId: fact.id,
          ruleId: fact.proceduralPointer.ruleId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  public async evaluateNewFacts(facts: UserModelFact[]): Promise<BridgeCandidateAssessment[]> {
    const candidates: BridgeCandidateAssessment[] = [];
    for (const fact of facts) {
      const assessment = this.assessFact(fact);
      if (assessment.isCandidate) {
        candidates.push(assessment);
      }
    }
    return candidates;
  }
}
