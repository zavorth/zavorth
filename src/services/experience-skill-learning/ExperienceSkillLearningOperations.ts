import fs from 'node:fs';
import path from 'node:path';
import type { ChatMessage, ILlmProvider } from '../../providers/ILlmProvider.js';
import { ExperienceSkillLearningCore } from './ExperienceSkillLearningCore.js';
import {
  computeReuseScore,
  redact,
  slugify,
  type ExperienceSkillDraftSummary,
  type ExperienceSkillPromoteKind,
  type ExperienceSkillPromotePreview,
  type ExperienceSkillPromoteResult,
} from './ExperienceSkillLearningModel.js';
import {
  SkillPromoteService,
  normalizePromoteKind,
} from '../SkillPromoteService.js';

export class ExperienceSkillLearningOperations extends ExperienceSkillLearningCore {
  /**
   * Optional LLM rewrite of the ## Procedure section into a short reusable checklist.
   * Opt-in only; failures leave the draft unchanged. Output is secret-scrubbed.
   */
  public async compactProcedureSection(
    dir: string,
    input: {
      userMessage: string;
      tools: string[];
      assistantText: string;
      llm?: Pick<ILlmProvider, 'chat'> | null;
    },
  ): Promise<boolean> {
    const skillPath = path.join(dir, 'SKILL.md');
    if (!fs.existsSync(skillPath)) return false;
    let skillMd = fs.readFileSync(skillPath, 'utf8');
    const match = skillMd.match(/## Procedure \(observed\)([\s\S]*?)(?=\n## |$)/);
    if (!match) return false;

    let llm = input.llm || null;
    if (!llm) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { LlmRuntimeService } = require('../llm/LlmRuntimeService.js') as typeof import('../llm/LlmRuntimeService.js');
        const runtime = new LlmRuntimeService();
        llm = {
          chat: async (messages: ChatMessage[]) => {
            const result = await runtime.chatDetailed(messages as any);
            return result.response;
          },
        };
      } catch {
        return false;
      }
    }

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: [
          'You compact multi-tool workflow notes into a reusable procedure.',
          'Return ONLY a short markdown checklist (4-8 steps), no title, no secrets.',
          'Reference tool names from the provided list. Keep English.',
        ].join(' '),
      },
      {
        role: 'user',
        content: [
          `Goal: ${input.userMessage.slice(0, 400)}`,
          `Tools: ${input.tools.join(', ')}`,
          `Current procedure:\n${match[1].trim().slice(0, 1500)}`,
          `Outcome note: ${input.assistantText.slice(0, 400)}`,
        ].join('\n\n'),
      },
    ];

    try {
      const response = await llm.chat(messages);
      const compacted = redact(String(response?.content || ''))
        .replace(/^```[\w]*\n?|```$/g, '')
        .trim()
        .slice(0, 2000);
      if (compacted.length < 40) return false;
      const section = [
        '## Procedure (observed)',
        '',
        compacted,
        '',
        '_Procedure compacted by learning loop for reuse._',
        '',
      ].join('\n');
      skillMd = skillMd.replace(/## Procedure \(observed\)[\s\S]*?(?=\n## |$)/, section);
      this.atomicWrite(skillPath, skillMd.endsWith('\n') ? skillMd : `${skillMd}\n`);

      const meta = this.readMeta(dir);
      if (meta) {
        meta.updatedAt = this.now().toISOString();
        meta.revisions = Number(meta.revisions || 0) + 1;
        this.atomicWrite(path.join(dir, 'skill.meta.json'), `${JSON.stringify(meta, null, 2)}\n`);
      }
      return true;
    } catch {
      return false;
    }
  }

  public showDraft(userId: string | null | undefined, id: string): { ok: boolean; text: string } {
    const draft = this.findDraftByExactId(userId, id);
    if (!draft) return { ok: false, text: `Skill draft not found: ${id}` };
    const skillPath = path.join(draft.path, 'SKILL.md');
    const body = fs.existsSync(skillPath) ? fs.readFileSync(skillPath, 'utf8') : '(missing SKILL.md)';
    // Scrub secrets on display (defense-in-depth if anything slipped past store-time redact).
    return { ok: true, text: redact(body) };
  }

  /**
   * Governed procedure surface: show full Procedure for a draft by exact id.
   * Does not execute tools. Updates lastUsedAt only (manual recall).
   */
  public runSkill(userId: string | null | undefined, id: string): { ok: boolean; text: string } {
    const draft = this.findDraftByExactId(userId, id);
    if (!draft) return { ok: false, text: `Skill draft not found: ${id}` };

    const skillPath = path.join(draft.path, 'SKILL.md');
    const skillMd = fs.existsSync(skillPath) ? fs.readFileSync(skillPath, 'utf8') : '';
    let procedure = this.extractProcedureSection(skillMd);
    if (!procedure) {
      // Fall back to truncated full SKILL.md
      procedure = skillMd.trim().slice(0, 2500) || '(no procedure recorded)';
    }
    procedure = redact(procedure);

    // Touch lastUsedAt only - do not bump useCount on manual governed run.
    try {
      const meta = this.readMeta(draft.path);
      if (meta) {
        meta.lastUsedAt = this.now().toISOString();
        this.atomicWrite(path.join(draft.path, 'skill.meta.json'), `${JSON.stringify(meta, null, 2)}\n`);
      }
    } catch {
      // optional
    }

    this.emitLearningTelemetry('learning.skill_run_manual', {
      reason: 'skill_run_manual',
      toolCount: draft.tools.length,
      surface: draft.surface || 'cli',
    });

    const text = [
      `Governed procedure: ${draft.title}`,
      `id: ${draft.id}`,
      'Governed procedure only - does not execute tools. Follow with user approval.',
      '',
      '## Procedure',
      '',
      procedure,
      '',
      `Tools: ${draft.tools.slice(0, 12).join(', ') || 'n/a'}`,
      `uses=${draft.useCount} score=${computeReuseScore(draft, this.now().getTime()).toFixed(1)}`,
    ].join('\n');

    return { ok: true, text };
  }

  /**
   * Preview promote destinations + SkillLoader SKILL.md content without writing.
   * Exact draft id only. Same paths as promote; never mkdir/write.
   */
  public previewPromote(
    userId: string | null | undefined,
    id: string,
    options?: { kind?: ExperienceSkillPromoteKind | string },
  ): ExperienceSkillPromotePreview {
    const draft = this.findDraftByExactId(userId, id);
    if (!draft) {
      return { ok: false, text: `Skill draft not found: ${id}`, dryRun: true };
    }

    const kind = normalizePromoteKind(options?.kind);
    const paths = this.resolvePromotePaths(userId, draft);
    const promoted = new SkillPromoteService().promote({
      projectRoot: this.projectRoot,
      userId,
      draft,
      kind,
      dryRun: true,
      skillName: paths.skillName,
      now: this.now,
    });
    const skillMdPreview = promoted.skillMdPreview || this.truncateSkillMdPreview(
      this.buildPromoteSkillLoaderBody(draft, paths.skillName),
    );

    const text = [
      promoted.text,
      `Would write audit copy: ${paths.auditDest}`,
    ].join('\n');

    return {
      ok: true,
      text,
      draftId: draft.id,
      title: draft.title,
      auditDest: paths.auditDest,
      runtimeSkillPath: paths.runtimeSkillPath,
      skillName: paths.skillName,
      skillMdPreview,
      dryRun: true,
      kind,
      skillPath: promoted.skillPath || undefined,
      pluginId: promoted.pluginId || undefined,
      pluginPath: promoted.pluginPath || undefined,
    };
  }

  /**
   * Promote a draft: audit copy under promoted-skills, then SkillIR pack under skills/
   * + SkillLoader under .agents/skills (kind=skill|both), and/or Plugin OS scaffold
   * under plugins/promoted/ (kind=plugin|both). Receipt links draftId → skillId → pluginId.
   * Never auto-promotes — only explicit promote / CLI / slash.
   * Pass `{ dryRun: true }` for a side-effect-free preview (same as previewPromote).
   */
  public promote(
    userId: string | null | undefined,
    id: string,
    options?: { dryRun?: boolean; kind?: ExperienceSkillPromoteKind | string },
  ): ExperienceSkillPromoteResult {
    const kind = normalizePromoteKind(options?.kind);
    if (options?.dryRun) {
      const preview = this.previewPromote(userId, id, { kind });
      return {
        ok: preview.ok,
        text: preview.text,
        draftId: preview.draftId,
        title: preview.title,
        auditDest: preview.auditDest,
        runtimeSkillPath: preview.runtimeSkillPath,
        skillName: preview.skillName,
        skillMdPreview: preview.skillMdPreview,
        dryRun: true,
        loaderReady: false,
        kind,
        skillPath: preview.skillPath,
        pluginId: preview.pluginId,
        pluginPath: preview.pluginPath,
        autoPromote: false,
      };
    }

    const draft = this.findDraftByExactId(userId, id);
    if (!draft) return { ok: false, text: `Skill draft not found: ${id}`, autoPromote: false };

    const promotedAt = this.now().toISOString();
    const paths = this.resolvePromotePaths(userId, draft);
    const destRoot = paths.auditDest;
    const skillName = paths.skillName;

    // Audit copy always (draft provenance), regardless of kind.
    fs.mkdirSync(destRoot, { recursive: true });
    for (const file of ['SKILL.md', 'skill.meta.json']) {
      const src = path.join(draft.path, file);
      if (!fs.existsSync(src)) continue;
      if (file === 'SKILL.md') {
        this.atomicWrite(path.join(destRoot, file), redact(fs.readFileSync(src, 'utf8')));
      } else {
        fs.copyFileSync(src, path.join(destRoot, file));
      }
    }
    this.atomicWrite(
      path.join(destRoot, 'promoted.meta.json'),
      `${JSON.stringify({
        promotedAt,
        from: draft.id,
        title: draft.title,
        kind,
        autoPromote: false,
      }, null, 2)}\n`,
    );

    const promoted = new SkillPromoteService().promote({
      projectRoot: this.projectRoot,
      userId,
      draft,
      kind,
      dryRun: false,
      skillName,
      now: this.now,
    });

    const loaderReady = promoted.loaderReady === true;
    if (loaderReady && promoted.skillId) {
      this.upsertPromotedCatalog(userId, {
        id: draft.id,
        skillName: promoted.skillId,
        title: draft.title,
        runtimePath: promoted.agentsSkillPath || paths.runtimeSkillPath,
        promotedAt,
      });
    }

    this.recordWeeklyMetric(userId, 'promotes');

    this.emitLearningTelemetry('learning.skill_reinforced', {
      reason: promoted.ok
        ? (kind === 'plugin' ? 'promoted_plugin' : loaderReady ? 'promoted_with_skill_loader' : 'promoted_partial')
        : 'promoted_audit_only',
      toolCount: draft.tools.length,
      surface: draft.surface || 'cli',
    });

    const textParts = [
      promoted.text,
      `Audit copy: ${destRoot}`,
    ];
    if (loaderReady) {
      textParts.push(
        'Available to SkillLoader via .agents/skills and local search under skills/.',
      );
    }

    return {
      // Audit is always written when draft exists (legacy contract); loaderReady/pluginReady show pack success.
      ok: true,
      text: textParts.join('\n'),
      promotedPath: destRoot,
      runtimeSkillPath: loaderReady ? (promoted.agentsSkillPath || undefined) : undefined,
      skillName: kind !== 'plugin' ? skillName : promoted.pluginId || skillName,
      loaderReady,
      draftId: draft.id,
      title: draft.title,
      auditDest: destRoot,
      dryRun: false,
      kind,
      skillPath: promoted.skillPath || undefined,
      pluginId: promoted.pluginId || undefined,
      pluginPath: promoted.pluginPath || undefined,
      pluginReady: promoted.pluginReady,
      skillIrDigest: promoted.skillIrDigest,
      receiptPath: promoted.receiptPath,
      skillId: promoted.skillId,
      autoPromote: false,
    };
  }

  private upsertPromotedCatalog(
    userId: string | null | undefined,
    entry: { id: string; skillName: string; title: string; runtimePath: string; promotedAt: string },
  ): void {
    try {
      const file = path.join(this.userLearningRoot(userId), 'promoted-catalog.json');
      fs.mkdirSync(path.dirname(file), { recursive: true });
      let list: Array<{ id: string; skillName: string; title: string; runtimePath: string; promotedAt: string }> = [];
      if (fs.existsSync(file)) {
        try {
          const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
          if (Array.isArray(raw)) list = raw as typeof list;
        } catch {
          list = [];
        }
      }
      const idx = list.findIndex((e) => e.skillName === entry.skillName);
      if (idx >= 0) list[idx] = entry;
      else list.push(entry);
      this.atomicWrite(file, `${JSON.stringify(list, null, 2)}\n`);
    } catch {
      // optional discovery index
    }
  }

  /** Compute promote destinations without creating directories or writing files. */
  private resolvePromotePaths(
    userId: string | null | undefined,
    draft: ExperienceSkillDraftSummary,
  ): { auditDest: string; skillName: string; runtimeSkillPath: string } {
    const auditDest = path.join(
      this.promotedRoot(userId),
      `${slugify(draft.title)}-${draft.id.slice(-8)}`,
    );
    const skillName = `exp-${slugify(draft.title)}-${draft.id.slice(-8)}`;
    const runtimeSkillPath = path.join(this.projectRoot, '.agents', 'skills', skillName);
    return { auditDest, skillName, runtimeSkillPath };
  }

  /** Build the SkillLoader SKILL.md that promote would write (no I/O beyond reading draft). */
  private buildPromoteSkillLoaderBody(
    draft: ExperienceSkillDraftSummary,
    skillName: string,
  ): string {
    const srcSkill = path.join(draft.path, 'SKILL.md');
    const body = fs.existsSync(srcSkill)
      ? redact(fs.readFileSync(srcSkill, 'utf8'))
      : `# ${draft.title}\n\n> Promoted experience skill draft.\n`;
    const description = redact(String(draft.title || 'Promoted experience skill')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 200) || 'Promoted experience skill');
    return this.buildSkillLoaderMarkdown(skillName, description, body);
  }

  /** First ~40 lines or 2k chars of SKILL.md content for dry-run previews. */
  private truncateSkillMdPreview(skillMd: string): string {
    const maxChars = 2000;
    const maxLines = 40;
    const lines = String(skillMd || '').split(/\r?\n/);
    let preview = lines.slice(0, maxLines).join('\n');
    let truncated = lines.length > maxLines;
    if (preview.length > maxChars) {
      preview = preview.slice(0, maxChars);
      truncated = true;
    }
    return truncated ? `${preview}\n...` : preview;
  }

  /**
   * Remove a draft by exact id only. Never deletes promoted-skills or .agents/skills.
   */
  public forget(userId: string | null | undefined, id: string): {
    ok: boolean;
    text: string;
    removedPath?: string;
  } {
    const draft = this.findDraftByExactId(userId, id);
    if (!draft) return { ok: false, text: `Skill draft not found: ${id}` };

    const draftsRootResolved = path.resolve(this.draftsRoot(userId));
    const target = path.resolve(draft.path);
    if (!this.isPathInsideRoot(target, draftsRootResolved)) {
      return {
        ok: false,
        text: `Refusing to remove path outside drafts root for id: ${id}`,
      };
    }

    try {
      if (!fs.existsSync(target) || !fs.statSync(target).isDirectory()) {
        return { ok: false, text: `Skill draft not found: ${id}` };
      }
      fs.rmSync(target, { recursive: true, force: true });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error || 'remove failed');
      return { ok: false, text: `Failed to forget skill draft ${id}: ${msg}` };
    }

    this.emitLearningTelemetry('learning.skill_reinforced', {
      reason: 'forgotten',
      toolCount: draft.tools.length,
      surface: draft.surface || 'cli',
    });

    return {
      ok: true,
      text: [
        `Forgot skill draft "${draft.title}" (${draft.id}).`,
        `Removed: ${target}`,
        'Draft only - promoted-skills and .agents/skills were not modified.',
      ].join('\n'),
      removedPath: target,
    };
  }

  /** Ensure SKILL.md has a single YAML frontmatter block with name + description (SkillLoader). */
  private buildSkillLoaderMarkdown(skillName: string, description: string, body: string): string {
    let content = String(body || '');
    if (/^---\s*\r?\n[\s\S]*?\r?\n---\s*\r?\n?/.test(content)) {
      content = content.replace(/^---\s*\r?\n[\s\S]*?\r?\n---\s*\r?\n?/, '');
    }
    const safeName = String(skillName || 'skill').replace(/[^\w.-]+/g, '-').slice(0, 80) || 'skill';
    const safeDesc = String(description || 'Promoted experience skill')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 200)
      .replace(/"/g, "'");
    return [
      '---',
      `name: ${safeName}`,
      `description: ${safeDesc}`,
      '---',
      '',
      content.replace(/^\uFEFF/, '').trimStart(),
    ].join('\n');
  }

  /**
   * Exact draft lookup only: meta id, draft id, or directory basename.
   * Rejects empty ids, `..`, and path separators. Never uses path.includes.
   */
  private isSafeDraftLookupId(id: string): boolean {
    const raw = String(id || '').trim();
    if (!raw) return false;
    if (raw === '.' || raw === '..') return false;
    if (raw.includes('..')) return false;
    if (raw.includes('/') || raw.includes('\\') || raw.includes(path.sep)) return false;
    // Reject null bytes / control chars that can confuse path APIs.
  // eslint-disable-next-line no-control-regex
    if (/[\0-\x1f\x7f]/.test(raw)) return false;
    return true;
  }

  /**
   * Resolve a user-facing draft ref to a draft summary.
   * - 1-based ordinal (`1`, `#2`) maps to listDrafts(userId, 40) in the same default sort as /learn list
   * - Otherwise exact meta id or draft directory basename
   */
  public resolveDraftRef(
    userId: string | null | undefined,
    ref: string,
  ): ExperienceSkillDraftSummary | null {
    return this.findDraftByExactId(userId, ref);
  }

  private findDraftByExactId(
    userId: string | null | undefined,
    id: string,
  ): ExperienceSkillDraftSummary | null {
    if (!this.isSafeDraftLookupId(id)) return null;
    const needle = String(id).trim();

    // Ordinal from /learn list order (default listDrafts sort = reuse score, then updatedAt).
    // Cap at 40 so short numbers never collide with full draft ids.
    const ordinalMatch = needle.match(/^#?(\d{1,2})$/);
    if (ordinalMatch) {
      const n = Number(ordinalMatch[1]);
      if (!Number.isFinite(n) || n < 1) return null;
      const listed = this.listDrafts(userId, 40);
      return listed[n - 1] || null;
    }

    // Scan all drafts (not score-capped top-N) so promote/forget/runSkill never miss by limit.
    const drafts = this.listDrafts(userId, Number.MAX_SAFE_INTEGER, { sortBy: 'updatedAt' });
    return drafts.find((d) => (
      d.id === needle
      || path.basename(d.path) === needle
    )) || null;
  }

  /**
   * On a failed multi-tool turn with a goal that matches an existing draft,
   * bump failureCount so successRate (and reuse score) drop for that skill.
   * No-op when no similar draft exists. Does not create drafts or bump useCount/successCount.
   */
}
