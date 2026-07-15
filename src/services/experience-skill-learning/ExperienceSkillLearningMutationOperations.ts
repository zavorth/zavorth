import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { ChatMessage, ILlmProvider } from '../../providers/ILlmProvider.js';
import { ExperienceSkillLearningOperations } from './ExperienceSkillLearningOperations.js';
import { cleanUserId, commonPrefixLength, redact, SIMILAR_GOAL_SLUG_CHARS, SIMILAR_TOOL_JACCARD, slugify, titleFromGoal, type DraftMeta, type ExperienceSkillDraftSummary, type ExperienceSkillLearningResult } from './ExperienceSkillLearningModel.js';

export class ExperienceSkillLearningMutationOperations extends ExperienceSkillLearningOperations {
  public recordSimilarDraftFailure(
    userId: string | null | undefined,
    userMessage: string,
    tools: string[],
    reason?: string,
  ): boolean {
    const msg = redact(userMessage);
    if (!msg) return false;
    const normalizedTools = Array.from(new Set(
      (tools || []).map((t) => String(t || '').trim()).filter(Boolean),
    ));
    const fingerprint = crypto
      .createHash('sha256')
      .update(`${cleanUserId(userId)}|${slugify(msg)}`)
      .digest('hex')
      .slice(0, 16);
    const existing = this.findSimilarDraft(userId, fingerprint, msg, normalizedTools);
    if (!existing) return false;

    const meta = this.readMeta(existing.path);
    if (!meta) return false;

    const at = this.now().toISOString();
    meta.failureCount = Number(meta.failureCount || 0) + 1;
    meta.lastUsedAt = at;
    meta.updatedAt = at;
    this.atomicWrite(
      path.join(existing.path, 'skill.meta.json'),
      `${JSON.stringify(meta, null, 2)}\n`,
    );

    this.emitLearningTelemetry('learning.skill_reinforced', {
      reason: 'similar_draft_failure',
      useCount: Number(meta.useCount || 0) || 0,
      toolCount: normalizedTools.length,
      revised: false,
      llmCompacted: false,
      surface: String(meta.surface || 'unknown'),
      failureCount: Number(meta.failureCount || 0) || 0,
      failReason: String(reason || 'unspecified').slice(0, 120),
    });
    return true;
  }

  protected findSimilarDraft(
    userId: string | null | undefined,
    fingerprint: string,
    userMessage: string,
    tools: string[],
  ): ExperienceSkillDraftSummary | null {
    const drafts = this.listDrafts(userId, 80);
    // Exact fingerprint (or id suffix containing it) = same skill only.
    const byFp = drafts.find((d) => d.fingerprint === fingerprint || d.id.includes(fingerprint));
    if (byFp) return byFp;

    // Soft match: high tool Jaccard AND strong goal slug alignment.
    // Do not merge unrelated goals that only share tools.
    const goalSlug = slugify(userMessage);
    if (!goalSlug || goalSlug === 'skill') return null;

    const toolSet = new Set(tools);
    let best: ExperienceSkillDraftSummary | null = null;
    let bestScore = 0;
    for (const d of drafts) {
      const titleSlug = slugify(d.title);
      if (!titleSlug || titleSlug === 'skill') continue;

      const prefixShared = commonPrefixLength(goalSlug, titleSlug);
      const first24Equal = goalSlug.length >= SIMILAR_GOAL_SLUG_CHARS
        && titleSlug.length >= SIMILAR_GOAL_SLUG_CHARS
        && goalSlug.slice(0, SIMILAR_GOAL_SLUG_CHARS) === titleSlug.slice(0, SIMILAR_GOAL_SLUG_CHARS);
      const goalHit = first24Equal
        || prefixShared >= SIMILAR_GOAL_SLUG_CHARS
        || (goalSlug.length >= SIMILAR_GOAL_SLUG_CHARS
          && titleSlug.includes(goalSlug.slice(0, SIMILAR_GOAL_SLUG_CHARS)))
        || (titleSlug.length >= SIMILAR_GOAL_SLUG_CHARS
          && goalSlug.includes(titleSlug.slice(0, SIMILAR_GOAL_SLUG_CHARS)));
      if (!goalHit) continue;

      const overlap = d.tools.filter((t) => toolSet.has(t)).length;
      const union = new Set([...d.tools, ...tools]).size || 1;
      const jaccard = overlap / union;
      if (jaccard < SIMILAR_TOOL_JACCARD) continue;

      const score = 0.5 + jaccard * 0.5;
      if (score > bestScore) {
        best = d;
        bestScore = score;
      }
    }
    return best;
  }

  /**
   * Self-improve: merge new tools, append revision note, bump useCount/revisions.
   * Returns true when content actually improved (new tools or new outcome note).
   */
  protected reinforceDraft(dir: string, input: {
    tools: string[];
    assistantText: string;
    userMessage: string;
    sessionId?: string | null;
    surface?: string | null;
  }): boolean {
    const metaPath = path.join(dir, 'skill.meta.json');
    const skillPath = path.join(dir, 'SKILL.md');
    if (!fs.existsSync(metaPath)) return false;

    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8')) as DraftMeta;
    const prevTools = Array.isArray(meta.tools) ? meta.tools : [];
    const mergedTools = Array.from(new Set([...prevTools, ...input.tools]));
    const newTools = input.tools.filter((t) => !prevTools.includes(t));
    const improved = newTools.length > 0;

    const at = this.now().toISOString();
    const eventId = `turn-${at.slice(0, 19).replace(/[:T]/g, '')}`;
    meta.useCount = Number(meta.useCount || 0) + 1;
    meta.successCount = Number(meta.successCount || 0) + 1;
    meta.lastUsedAt = at;
    meta.updatedAt = at;
    meta.tools = mergedTools;
    meta.revisions = Number(meta.revisions || 0) + (improved ? 1 : 0);
    meta.eventIds = [...(meta.eventIds || []), eventId].slice(-40);
    meta.variants = [
      ...(meta.variants || []),
      {
        at,
        tools: input.tools.slice(),
        note: improved
          ? `Added tools: ${newTools.join(', ')}`
          : 'Reinforced same tool set',
      },
    ].slice(-20);

    let skillMd = fs.existsSync(skillPath) ? fs.readFileSync(skillPath, 'utf8') : '';
    if (improved) {
      // Refresh tools section
      const toolsSection = [
        '## Tools used',
        '',
        ...mergedTools.map((t) => `- \`${t}\``),
        '',
      ].join('\n');
      if (/## Tools used[\s\S]*?(?=## |$)/.test(skillMd)) {
        skillMd = skillMd.replace(/## Tools used[\s\S]*?(?=## |$)/, `${toolsSection}`);
      } else {
        skillMd = `${skillMd.trim()}\n\n${toolsSection}`;
      }
      const revisionBlock = [
        '',
        `## Revision ${meta.revisions} (${at})`,
        '',
        `- New tools observed: ${newTools.map((t) => `\`${t}\``).join(', ')}`,
        `- Outcome note: ${input.assistantText.slice(0, 400) || '(none)'}`,
        '',
      ].join('\n');
      skillMd = `${skillMd.trim()}\n${revisionBlock}`;
      // Prefer tools line in procedure
      skillMd = skillMd.replace(
        /3\. Prefer tools:.*$/m,
        `3. Prefer tools: ${mergedTools.join(', ')}.`,
      );
    }

    this.atomicWrite(metaPath, `${JSON.stringify(meta, null, 2)}\n`);
    if (improved && skillMd) {
      this.atomicWrite(skillPath, skillMd.endsWith('\n') ? skillMd : `${skillMd}\n`);
    }

    try {
      const userFromPath = dir.split(`${path.sep}users${path.sep}`)[1]?.split(path.sep)[0];
      this.recordWeeklyMetric(userFromPath || 'local-user', 'reuses');
      this.writeProvenance({
        userId: userFromPath || 'local-user',
        id: meta.id,
        title: meta.title,
        eventId,
        sessionId: input.sessionId,
        surface: input.surface,
        confidence: improved ? 0.78 : 0.72,
        keyPrefix: improved ? 'experience-skill-improved' : 'experience-skill-reinforced',
      });
    } catch {
      // optional
    }

    return improved;
  }

  protected createDraft(input: {
    fingerprint: string;
    userId?: string | null;
    sessionId?: string | null;
    surface?: string | null;
    userMessage: string;
    assistantText: string;
    tools: string[];
  }): ExperienceSkillLearningResult {
    const createdAt = this.now().toISOString();
    const title = titleFromGoal(input.userMessage, input.tools);
    const id = `skill-${input.fingerprint}`;
    const dirName = `${createdAt.slice(0, 10)}_${slugify(title)}_${input.fingerprint.slice(0, 8)}`;
    const root = this.draftsRoot(input.userId);
    const dir = path.join(root, dirName);
    fs.mkdirSync(dir, { recursive: true });
    const eventId = `create-${createdAt.slice(0, 19).replace(/[:T]/g, '')}`;

    const skillMd = [
      `# ${title}`,
      '',
      '> Experience skill draft (reviewable). Not auto-installed.',
      '',
      '## Goal',
      '',
      input.userMessage.slice(0, 500),
      '',
      '## Tools used',
      '',
      ...input.tools.map((t) => `- \`${t}\``),
      '',
      '## Procedure (observed)',
      '',
      '1. Clarify the user goal (see Goal above).',
      '2. Run the tools in a similar order when the task matches.',
      `3. Prefer tools: ${input.tools.join(', ')}.`,
      '4. Return a concise result grounded in tool evidence; never invent success.',
      '',
      '## Assistant outcome summary',
      '',
      input.assistantText.slice(0, 800) || '(empty)',
      '',
      '## Safety',
      '',
      '- No raw secrets stored (redacted).',
      `- Promote only after human review: \`zavorth learning-loop promote ${id}\`.`,
      '',
      `Created: ${createdAt}`,
      `Surface: ${String(input.surface || 'unknown')}`,
      '',
    ].join('\n');

    const meta: DraftMeta = {
      id,
      title,
      path: dir,
      tools: input.tools,
      surface: String(input.surface || 'unknown'),
      createdAt,
      updatedAt: createdAt,
      useCount: 1,
      successCount: 1,
      failureCount: 0,
      lastUsedAt: createdAt,
      revisions: 0,
      eventIds: [eventId],
      fingerprint: input.fingerprint,
      userMessagePreview: input.userMessage.slice(0, 200),
      variants: [],
    };

    this.atomicWrite(path.join(dir, 'SKILL.md'), skillMd);
    this.atomicWrite(path.join(dir, 'skill.meta.json'), `${JSON.stringify(meta, null, 2)}\n`);

    this.recordWeeklyMetric(input.userId, 'draftsCreated');

    this.writeProvenance({
      userId: cleanUserId(input.userId),
      id,
      title,
      eventId,
      sessionId: input.sessionId,
      surface: input.surface,
      confidence: 0.7,
      keyPrefix: 'experience-skill',
    });

    return {
      triggered: true,
      reason: 'skill_draft_created',
      skillDraftId: id,
      skillTitle: title,
      skillPath: dir,
      userNudge: this.buildUserNudge({
        kind: 'created',
        title,
        id,
        tools: input.tools,
        useCount: 1,
        llmCompacted: false,
      }),
      toolsRecorded: input.tools,
      improved: false,
      llmCompacted: false,
    };
  }

  protected writeProvenance(input: {
    userId?: string;
    id: string;
    title: string;
    eventId: string;
    sessionId?: string | null;
    surface?: string | null;
    confidence: number;
    keyPrefix: string;
  }): void {
    try {
      const { writeGovernedMemoryProvenance } = require('../AgentProvenanceMemoryBridge.js') as typeof import('../AgentProvenanceMemoryBridge.js');
      writeGovernedMemoryProvenance({
        userId: cleanUserId(input.userId),
        key: `${input.keyPrefix}:${input.id}`,
        value: input.title,
        category: 'learned_skill_draft',
        surface: String(input.surface || 'learning-loop'),
        sessionId: input.sessionId,
        eventId: input.eventId,
        confidence: input.confidence,
        projectRoot: this.projectRoot,
      });
    } catch {
      // optional
    }
  }

}
