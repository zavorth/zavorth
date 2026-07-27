/**
 * Experience skill learning loop (Zavorth) - public service entry.
 * Implementation is split under `./experience-skill-learning/` for size;
 * public imports remain `../services/ExperienceSkillLearningLoopService`.
 */

import crypto from 'node:crypto';
import type { ILlmProvider } from '../providers/ILlmProvider.js';
import { ExperienceSkillLearningMutationOperations } from './experience-skill-learning/ExperienceSkillLearningMutationOperations.js';
import {
  cleanUserId,
  emptyResult,
  isExperienceSkillLearningLoopEnabled,
  PREFERENCE_ONLY,
  redact,
  resolveMinTools,
  skillLearnLlmCompactEnabled,
  slugify,
  TRIVIAL_GOAL,
  type ExperienceSkillLearningResult,
  type ExperienceSkillLearningTurnInput,
} from './experience-skill-learning/ExperienceSkillLearningModel.js';

export * from './experience-skill-learning/ExperienceSkillLearningModel.js';

export class ExperienceSkillLearningLoopService extends ExperienceSkillLearningMutationOperations {
  public async processTurn(input: ExperienceSkillLearningTurnInput): Promise<ExperienceSkillLearningResult> {
    const tools = Array.from(new Set((input.toolsCalled || []).map((t) => String(t || '').trim()).filter(Boolean)));
    if (!isExperienceSkillLearningLoopEnabled()) {
      return emptyResult('learning_loop_disabled', tools);
    }
    const failures = Array.from(new Set((input.toolFailures || []).map((t) => String(t || '').trim()).filter(Boolean)));
    const count = Math.max(tools.length, Number(input.toolCallCount || 0) || 0, (input.toolsCalled || []).length);
    const minTools = resolveMinTools(input.minToolCalls);
    const outcome = input.outcome || 'success';
    const userMessage = redact(input.userMessage);

    // Failed turns: never create/improve drafts, but demote similar existing skills.
    if (outcome !== 'success' || failures.length > 0) {
      if (userMessage) {
        const failReason =
          outcome !== 'success' ? `outcome_${outcome}` : `tool_failures:${failures.slice(0, 6).join(',')}`;
        this.recordSimilarDraftFailure(input.userId, userMessage, tools, failReason);
      }
      if (outcome !== 'success') {
        return emptyResult('turn_not_successful', tools);
      }
      return emptyResult('tool_failures_present', tools);
    }

    if (count < minTools) {
      return emptyResult(`below_threshold_${count}_lt_${minTools}`, tools);
    }

    const assistantText = redact(input.assistantText).slice(0, 2000);
    if (!userMessage) {
      return emptyResult('empty_user_message', tools);
    }
    if (PREFERENCE_ONLY.test(userMessage) || TRIVIAL_GOAL.test(userMessage.replace(/\s+/g, ' '))) {
      return emptyResult('quality_gate_trivial_goal', tools);
    }
    if (tools.length < 2) {
      return emptyResult('quality_gate_insufficient_tool_diversity', tools);
    }

    // Goal-centric fingerprint so reuse with extra tools improves the same draft.
    const fingerprint = crypto
      .createHash('sha256')
      .update(`${cleanUserId(input.userId)}|${slugify(userMessage)}`)
      .digest('hex')
      .slice(0, 16);

    const wantCompact = skillLearnLlmCompactEnabled(input.llmCompact);
    const existing = this.findSimilarDraft(input.userId, fingerprint, userMessage, tools);
    if (existing) {
      const improved = this.reinforceDraft(existing.path, {
        tools,
        assistantText,
        userMessage,
        sessionId: input.sessionId,
        surface: input.surface,
      });
      let llmCompacted = false;
      // Compact when improved, or every 3rd use after revision activity.
      const metaAfter = this.readMeta(existing.path);
      const shouldCompact =
        wantCompact &&
        (improved || (Number(metaAfter?.useCount || 0) > 0 && Number(metaAfter?.useCount || 0) % 3 === 0));
      if (shouldCompact) {
        llmCompacted = await this.runCompactProcedure(existing.path, {
          userMessage,
          tools: metaAfter?.tools || tools,
          assistantText,
          compactLlm: input.compactLlm || null,
        });
      }
      const meta = this.readMeta(existing.path);
      const id = meta?.id || existing.id;
      const title = meta?.title || existing.title;
      const useCount = Number(meta?.useCount || existing.useCount || 1);
      let reason = llmCompacted
        ? improved ? 'existing_skill_improved_compacted'
          : 'existing_skill_reinforced_compacted'
        : improved ? 'existing_skill_improved'
          : 'existing_skill_reinforced';
      const userNudge = this.applyNudgeRateLimit(
        input.userId,
        this.buildUserNudge({
          kind: improved ? 'improved' : 'reuse',
          title,
          id,
          tools,
          useCount,
          llmCompacted,
        }),
      );
      if (!userNudge) {
        reason = `${reason}_nudge_suppressed`;
      }
      this.recordActivity(input.userId, {
        reason,
        skillTitle: title,
        skillId: id,
        surface: input.surface,
        nudged: Boolean(userNudge),
      });
      this.emitLearningTelemetry(improved ? 'learning.skill_improved' : 'learning.skill_reinforced', {
        reason,
        useCount,
        toolCount: tools.length,
        revised: improved,
        llmCompacted,
        surface: String(input.surface || 'unknown'),
      });
      return {
        triggered: true,
        reason,
        skillDraftId: id,
        skillTitle: title,
        skillPath: existing.path,
        userNudge,
        toolsRecorded: tools,
        improved: improved || llmCompacted,
        llmCompacted,
      };
    }

    const created = this.createDraft({
      fingerprint,
      userId: input.userId,
      sessionId: input.sessionId,
      surface: input.surface,
      userMessage,
      assistantText,
      tools,
    });
    if (wantCompact && created.skillPath) {
      const llmCompacted = await this.runCompactProcedure(created.skillPath, {
        userMessage,
        tools,
        assistantText,
        compactLlm: input.compactLlm || null,
      });
      if (llmCompacted) {
        created.llmCompacted = true;
        created.reason = 'skill_draft_created_compacted';
        created.userNudge = this.buildUserNudge({
          kind: 'created',
          title: created.skillTitle || '',
          id: created.skillDraftId || '',
          tools,
          useCount: 1,
          llmCompacted: true,
        });
      }
    }
    const createdNudge = this.applyNudgeRateLimit(input.userId, created.userNudge);
    if (!createdNudge && created.userNudge) {
      created.reason = `${created.reason}_nudge_suppressed`;
    }
    created.userNudge = createdNudge;
    this.recordActivity(input.userId, {
      reason: created.reason,
      skillTitle: created.skillTitle,
      skillId: created.skillDraftId,
      surface: input.surface,
      nudged: Boolean(created.userNudge),
    });
    this.emitLearningTelemetry('learning.skill_drafted', {
      reason: created.reason,
      toolCount: tools.length,
      llmCompacted: created.llmCompacted,
      surface: String(input.surface || 'unknown'),
    });
    return created;
  }

  /**
   * When compactLlm is injected (tests): await compaction so results are deterministic.
   * Production hot path without injected LLM: fire-and-forget so chat reply is not blocked.
   * Async path reports llmCompacted=false (scheduled, not completed on this turn).
   */
  private async runCompactProcedure(
    dir: string,
    input: {
      userMessage: string;
      tools: string[];
      assistantText: string;
      compactLlm?: Pick<ILlmProvider, 'chat'> | null;
    },
  ): Promise<boolean> {
    const compactArgs = {
      userMessage: input.userMessage,
      tools: input.tools,
      assistantText: input.assistantText,
      llm: input.compactLlm || null,
    };
    if (input.compactLlm) {
      return this.compactProcedureSection(dir, compactArgs);
    }
    void this.compactProcedureSection(dir, compactArgs).catch(() => {});
    return false;
  }
}
