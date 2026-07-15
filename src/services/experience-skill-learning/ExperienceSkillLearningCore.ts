import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { tService } from '../../i18n/services.js';
import { logger } from '../../logger.js';
import { buildSearchSnippet, readDraftSkillBodyRedacted } from './ExperienceSkillLearningSearchUtils.js';
import {
  cleanUserId,
  computeReuseScore,
  computeSuccessRate,
  goalSimilarity,
  isExperienceSkillLearningLoopEnabled,
  redact,
  resolveNudgeCooldownMs,
  getIsoWeekKey,
  GOAL_SIMILARITY_MATCH_MIN,
  slugify,
  textMatchesToken,
  tokenizeSearchQuery,
  type DraftMeta,
  type ExperienceSkillDraftSearchHit,
  type ExperienceSkillDraftSummary,
  type ExperienceSkillLearningStatusSnapshot,
  type ExperienceSkillWeeklyMetrics,
  type UserLearningProfile,
  type WeeklyMetricKey,
} from './ExperienceSkillLearningModel.js';

export class ExperienceSkillLearningCore {
  protected readonly projectRoot: string;
  protected readonly now: () => Date;

  public constructor(options?: { projectRoot?: string | null; now?: () => Date }) {
    this.projectRoot = path.resolve(String(options?.projectRoot || process.cwd()));
    this.now = options?.now || (() => new Date());
  }

  public draftsRoot(userId?: string | null): string {
    return path.join(
      this.projectRoot,
      'data',
      'runtime',
      'learning',
      'users',
      cleanUserId(userId),
      'experience-skill-drafts',
    );
  }

  public userLearningRoot(userId?: string | null): string {
    return path.join(
      this.projectRoot,
      'data',
      'runtime',
      'learning',
      'users',
      cleanUserId(userId),
    );
  }

  public promotedRoot(userId?: string | null): string {
    return path.join(this.userLearningRoot(userId), 'promoted-skills');
  }

  public listPromoted(userId?: string | null, limit = 50): Array<{ id: string; title: string; path: string; promotedAt: string }> {
    const root = this.promotedRoot(userId);
    if (!fs.existsSync(root)) return [];
    const out: Array<{ id: string; title: string; path: string; promotedAt: string }> = [];
    for (const name of fs.readdirSync(root)) {
      const dir = path.join(root, name);
      try {
        if (!fs.statSync(dir).isDirectory()) continue;
        const promoPath = path.join(dir, 'promoted.meta.json');
        const metaPath = path.join(dir, 'skill.meta.json');
        let title = name;
        let id = name;
        let promotedAt = '';
        if (fs.existsSync(promoPath)) {
          const promo = JSON.parse(fs.readFileSync(promoPath, 'utf8')) as { from?: string; title?: string; promotedAt?: string };
          id = promo.from || id;
          title = promo.title || title;
          promotedAt = promo.promotedAt || '';
        } else if (fs.existsSync(metaPath)) {
          const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8')) as { id?: string; title?: string };
          id = meta.id || id;
          title = meta.title || title;
        }
        out.push({ id, title, path: dir, promotedAt });
      } catch {
        // skip
      }
    }
    return out
      .sort((a, b) => String(b.promotedAt).localeCompare(String(a.promotedAt)))
      .slice(0, Math.max(1, limit));
  }

  public buildStatusSnapshot(userId?: string | null): ExperienceSkillLearningStatusSnapshot {
    const uid = cleanUserId(userId);
    const drafts = this.listDrafts(uid, 100);
    const promoted = this.listPromoted(uid, 100);
    const improved = drafts.filter((d) => Number(d.revisions || 0) > 0).length;
    const toolCounts = new Map<string, number>();
    for (const d of drafts) {
      for (const t of d.tools) {
        toolCounts.set(t, (toolCounts.get(t) || 0) + Number(d.useCount || 1));
      }
    }
    const topTools = Array.from(toolCounts.entries())
      .map(([tool, count]) => ({ tool, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
    const activity = this.readActivity(uid);
    const metrics = this.readWeeklyMetrics(uid);
    const workflowsLearned = drafts.length;
    const badge = workflowsLearned > 0
      ? tService('learning_loop.badge_workflows', { count: workflowsLearned })
      : tService('learning_loop.badge_zero');
    return {
      userId: uid,
      enabled: isExperienceSkillLearningLoopEnabled(),
      drafts: drafts.length,
      improved,
      promoted: promoted.length,
      workflowsLearned,
      badge,
      topTools,
      lastTriggerAt: activity.lastTriggerAt,
      lastTriggerReason: activity.lastTriggerReason,
      lastSkillTitle: activity.lastSkillTitle || drafts[0]?.title || null,
      latest: drafts.slice(0, 5).map((d) => ({
        id: d.id,
        title: d.title,
        useCount: d.useCount,
        revisions: Number(d.revisions || 0),
      })),
      oneLiner: tService('learning_loop.one_liner'),
      nudgeCooldownMs: resolveNudgeCooldownMs(),
      plane: 'experience-skill-drafts',
      planeNote:
        'Light loop: multi-tool drafts you promote. Not the preference/spine learning plane.',
      metrics,
    };
  }

  /**
   * Local cross-draft search (no external service).
   * Tokenize query Ã¢â€ â€™ score unique token matches in title (boosted), tools, SKILL.md body
   * (read + redact), and fingerprint/id. Scoped to the caller's experience-skill-drafts root.
   * Empty query returns the ranked list (same as listDrafts) with short snippets.
   */
  public searchDrafts(
    userId?: string | null,
    query?: string | null,
    limit = 20,
  ): ExperienceSkillDraftSearchHit[] {
    const tokens = tokenizeSearchQuery(query);
    // Full user-scoped catalog (path-contained by listDrafts); no cross-user roots.
    const drafts = this.listDrafts(userId, Number.MAX_SAFE_INTEGER, { sortBy: 'score' });
    const cap = Math.max(1, limit);
    const nowMs = this.now().getTime();

    if (tokens.length === 0) {
      return drafts.slice(0, cap).map((d) => {
        const body = readDraftSkillBodyRedacted(d.path);
        return {
          ...d,
          title: redact(String(d.title || '')),
          snippet: buildSearchSnippet(body || d.title || d.id, tokens),
          searchScore: computeReuseScore(d, nowMs),
        };
      });
    }

    const scored: ExperienceSkillDraftSearchHit[] = [];
    for (const d of drafts) {
      const title = String(d.title || '');
      const toolsJoined = (d.tools || []).map((t) => String(t || '')).join(' ');
      const fingerprint = String(d.fingerprint || '');
      const id = String(d.id || '');
      const body = readDraftSkillBodyRedacted(d.path);

      let uniqueMatches = 0;
      let titleHits = 0;
      let toolHits = 0;
      let bodyHits = 0;
      let fpHits = 0;

      for (const token of tokens) {
        let hit = false;
        if (textMatchesToken(title, token)) {
          titleHits += 1;
          hit = true;
        }
        if (textMatchesToken(toolsJoined, token) || (d.tools || []).some((t) => textMatchesToken(t, token))) {
          toolHits += 1;
          hit = true;
        }
        if (body && textMatchesToken(body, token)) {
          bodyHits += 1;
          hit = true;
        }
        if (textMatchesToken(fingerprint, token) || textMatchesToken(id, token)) {
          fpHits += 1;
          hit = true;
        }
        if (hit) uniqueMatches += 1;
      }

      if (uniqueMatches === 0) continue;

      // FTS-like: unique token coverage primary; title matches boosted.
      const searchScore =
        uniqueMatches * 100
        + titleHits * 40
        + toolHits * 20
        + bodyHits * 8
        + fpHits * 5
        + computeReuseScore(d, nowMs) * 0.01;

      const snippetSource = [
        title,
        toolsJoined ? `tools: ${toolsJoined}` : '',
        body,
        fingerprint,
      ].filter(Boolean).join('\n');

      scored.push({
        ...d,
        title: redact(title),
        snippet: buildSearchSnippet(snippetSource, tokens),
        searchScore,
      });
    }

    scored.sort((a, b) => {
      const s = (b.searchScore || 0) - (a.searchScore || 0);
      if (s !== 0) return s;
      return String(b.updatedAt || b.createdAt).localeCompare(String(a.updatedAt || a.createdAt));
    });
    return scored.slice(0, cap);
  }

  /**
   * Light user learning profile from local drafts + activity + weekly metrics.
   * Pure stats for optional agent inject Ã¢â‚¬â€ not an external preference product.
   */
  public buildUserLearningProfile(userId?: string | null): UserLearningProfile {
    const uid = cleanUserId(userId);
    const drafts = this.listDrafts(uid, Number.MAX_SAFE_INTEGER, { sortBy: 'score' });
    const promoted = this.listPromoted(uid, 100);
    const weekMetrics = this.readWeeklyMetrics(uid);

    const toolCounts = new Map<string, number>();
    const surfaceCounts = new Map<string, number>();
    for (const d of drafts) {
      const weight = Math.max(1, Number(d.useCount || 1) || 1);
      for (const t of d.tools || []) {
        const tool = String(t || '').trim();
        if (!tool) continue;
        toolCounts.set(tool, (toolCounts.get(tool) || 0) + weight);
      }
      const surface = String(d.surface || 'unknown').trim() || 'unknown';
      surfaceCounts.set(surface, (surfaceCounts.get(surface) || 0) + weight);
    }

    const topTools = Array.from(toolCounts.entries())
      .map(([tool, count]) => ({ tool, count }))
      .sort((a, b) => b.count - a.count || a.tool.localeCompare(b.tool))
      .slice(0, 8);

    const topSurfaces = Array.from(surfaceCounts.entries())
      .map(([surface, count]) => ({ surface, count }))
      .sort((a, b) => b.count - a.count || a.surface.localeCompare(b.surface))
      .slice(0, 5);

    const preferredSkillTitles = drafts
      .slice(0, 8)
      .map((d) => redact(String(d.title || '').trim()))
      .filter(Boolean);

    const toolPart = topTools.length
      ? `Top tools: ${topTools.slice(0, 5).map((t) => `${t.tool}(${t.count})`).join(', ')}.`
      : 'No multi-tool drafts recorded yet.';
    const titlePart = preferredSkillTitles.length
      ? ` Preferred workflows: ${preferredSkillTitles.slice(0, 3).join('; ')}.`
      : '';
    const weekPart =
      ` This week (${weekMetrics.weekKey}): drafts=${weekMetrics.draftsCreated},`
      + ` promotes=${weekMetrics.promotes}, reuses=${weekMetrics.reuses}.`;
    const summary = redact(
      `User ${uid} has ${drafts.length} experience-skill draft(s) and ${promoted.length} promoted.`
      + ` ${toolPart}${titlePart}${weekPart}`,
    ).replace(/\s+/g, ' ').trim();

    return {
      userId: uid,
      topTools,
      topSurfaces,
      preferredSkillTitles,
      drafts: drafts.length,
      promoted: promoted.length,
      weekMetrics,
      summary,
    };
  }

  public listDrafts(
    userId?: string | null,
    limit = 20,
    options?: { sortBy?: 'score' | 'updatedAt' },
  ): ExperienceSkillDraftSummary[] {
    const roots = [this.draftsRoot(userId)];
    const out: ExperienceSkillDraftSummary[] = [];
    const seen = new Set<string>();
    const nowMs = this.now().getTime();
    for (const root of roots) {
      if (!fs.existsSync(root)) continue;
      const rootResolved = path.resolve(root);
      for (const name of fs.readdirSync(root)) {
        // Reject traversal-like directory names; stay inside user learning root.
        if (!name || name === '.' || name === '..' || name.includes('..')
          || name.includes('/') || name.includes('\\')) {
          continue;
        }
        const dir = path.join(root, name);
        try {
          const dirResolved = path.resolve(dir);
          if (!this.isPathInsideRoot(dirResolved, rootResolved)) continue;
          if (!fs.statSync(dirResolved).isDirectory()) continue;
          const metaPath = path.join(dirResolved, 'skill.meta.json');
          if (!fs.existsSync(metaPath)) continue;
          const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8')) as DraftMeta;
          const id = meta.id || name;
          if (seen.has(id)) continue;
          seen.add(id);
          const successCount = Number(meta.successCount || 0) || 0;
          const failureCount = Number(meta.failureCount || 0) || 0;
          out.push({
            id,
            title: meta.title || name,
            path: dirResolved,
            tools: Array.isArray(meta.tools) ? meta.tools : [],
            surface: meta.surface || 'unknown',
            createdAt: meta.createdAt || '',
            updatedAt: meta.updatedAt,
            useCount: Number(meta.useCount || 0) || 0,
            revisions: Number(meta.revisions || 0) || 0,
            eventIds: Array.isArray(meta.eventIds) ? meta.eventIds : [],
            fingerprint: meta.fingerprint,
            lastUsedAt: meta.lastUsedAt,
            successCount,
            failureCount,
            successRate: computeSuccessRate({ successCount, failureCount }),
          });
        } catch {
          // skip corrupt
        }
      }
    }
    const sortBy = options?.sortBy || 'score';
    if (sortBy === 'updatedAt') {
      return out
        .sort((a, b) => String(b.updatedAt || b.createdAt).localeCompare(String(a.updatedAt || a.createdAt)))
        .slice(0, Math.max(1, limit));
    }
    return out
      .sort((a, b) => {
        const scoreDiff = computeReuseScore(b, nowMs) - computeReuseScore(a, nowMs);
        if (scoreDiff !== 0) return scoreDiff;
        return String(b.updatedAt || b.createdAt).localeCompare(String(a.updatedAt || a.createdAt));
      })
      .slice(0, Math.max(1, limit));
  }

  /**
   * Runtime recall block for agent system context.
   * Ranked by reuse score; full Procedure only for goals similar to userMessage.
   */
  public formatInjectBlock(
    userId?: string | null,
    limit = 5,
    options?: { userMessage?: string | null; fullProcedureTopK?: number },
  ): string {
    if (!isExperienceSkillLearningLoopEnabled()) return '';
    const headroom = Math.max(40, limit * 8);
    const drafts = this.listDrafts(userId, headroom, { sortBy: 'score' });
    if (drafts.length === 0) return '';

    const ranked = this.rankDraftsForInject(drafts, options?.userMessage, options?.fullProcedureTopK ?? 2);
    const picked = ranked.slice(0, Math.max(1, limit));
    if (picked.length === 0) return '';

    const lines: string[] = [
      '## Learned workflow drafts (reviewable; not auto-installed)',
      'Ranked by reuse score. Full procedure is injected only for similar goals.',
      'Reuse these patterns when the user asks for a similar multi-step task:',
    ];

    picked.forEach((entry, i) => {
      const d = entry.draft;
      const rev = d.revisions && d.revisions > 0 ? `, rev=${d.revisions}` : '';
      const scoreLabel = entry.score.toFixed(1);
      lines.push(
        `${i + 1}. ${d.title} (tools: ${d.tools.slice(0, 6).join(', ') || 'n/a'}; uses=${d.useCount}${rev}; score=${scoreLabel})`,
      );
      if (entry.full) {
        const skillPath = path.join(d.path, 'SKILL.md');
        const skillMd = fs.existsSync(skillPath) ? fs.readFileSync(skillPath, 'utf8') : '';
        // Full procedure only; always scrub secrets before inject into agent context.
        const procedure = redact(this.extractProcedureSection(skillMd));
        if (procedure) {
          lines.push('   ### Procedure (runtime recall)');
          for (const pl of procedure.split(/\r?\n/)) {
            lines.push(pl ? `   ${pl}` : '');
          }
        }
      }
    });

    lines.push('Promote via: zavorth learning-loop promote <id>');
    lines.push('Governed surface: /learn run <id> (shows procedure; does not execute tools)');

    // Light user model when no similar-goal full procedure was injected.
    const hasSimilarGoal = picked.some((e) => e.full);
    if (!hasSimilarGoal) {
      const profileLines = this.formatProfileInjectLines(userId);
      if (profileLines) {
        lines.push(profileLines);
      }
    }

    // Defense-in-depth: titles/tools lines may also carry pasted secrets.
    return redact(lines.join('\n'));
  }

  /** Two-line light profile summary for inject (top tools). Empty when nothing useful. */
  protected formatProfileInjectLines(userId?: string | null): string {
    try {
      const profile = this.buildUserLearningProfile(userId);
      if (profile.topTools.length === 0 && profile.drafts === 0) return '';
      const tools = profile.topTools.slice(0, 5).map((t) => t.tool).join(', ') || 'n/a';
      return [
        '',
        '## Light user learning profile',
        `Top tools: ${tools}. Drafts=${profile.drafts}, promoted=${profile.promoted}.`,
        profile.preferredSkillTitles.length
          ? `Preferred: ${profile.preferredSkillTitles.slice(0, 2).join('; ')}.`
          : profile.summary.slice(0, 180),
      ].join('\n');
    } catch {
      return '';
    }
  }

  protected extractProcedureSection(skillMd: string): string {
    const match = String(skillMd || '').match(/## Procedure[^\n]*\n([\s\S]*?)(?=\n## |$)/i);
    return match ? String(match[1] || '').trim() : '';
  }

  protected rankDraftsForInject(
    drafts: ExperienceSkillDraftSummary[],
    userMessage?: string | null,
    fullProcedureTopK = 2,
  ): Array<{ draft: ExperienceSkillDraftSummary; score: number; full: boolean; goalSim: number }> {
    const nowMs = this.now().getTime();
    const msg = String(userMessage || '').trim();
    const scored = drafts.map((draft) => {
      const score = computeReuseScore(draft, nowMs);
      const goalSim = msg ? this.goalSimilarityForDraft(msg, draft) : 0;
      return { draft, score, goalSim, full: false };
    });

    // Primary: reuse score DESC, then updatedAt
    scored.sort((a, b) => {
      const scoreDiff = b.score - a.score;
      if (scoreDiff !== 0) return scoreDiff;
      return String(b.draft.updatedAt || b.draft.createdAt)
        .localeCompare(String(a.draft.updatedAt || a.draft.createdAt));
    });

    if (msg) {
      // Prefer full procedure for the top-K matching drafts by goal similarity
      // (still only among those already ranked; re-pick matching set).
      const matching = scored
        .filter((e) => e.goalSim >= GOAL_SIMILARITY_MATCH_MIN)
        .sort((a, b) => {
          const g = b.goalSim - a.goalSim;
          if (g !== 0) return g;
          return b.score - a.score;
        })
        .slice(0, Math.max(0, fullProcedureTopK));
      const fullIds = new Set(matching.map((e) => e.draft.id));
      for (const e of scored) {
        e.full = fullIds.has(e.draft.id);
      }
      // When userMessage is set, bubble matching drafts toward the front while keeping score order within bands
      scored.sort((a, b) => {
        const aMatch = a.goalSim >= GOAL_SIMILARITY_MATCH_MIN ? 1 : 0;
        const bMatch = b.goalSim >= GOAL_SIMILARITY_MATCH_MIN ? 1 : 0;
        if (aMatch !== bMatch) return bMatch - aMatch;
        if (aMatch && bMatch) {
          const g = b.goalSim - a.goalSim;
          if (g !== 0) return g;
        }
        const scoreDiff = b.score - a.score;
        if (scoreDiff !== 0) return scoreDiff;
        return String(b.draft.updatedAt || b.draft.createdAt)
          .localeCompare(String(a.draft.updatedAt || a.draft.createdAt));
      });
    }

    return scored;
  }

  /** Shared goal similarity for inject + soft-match (tool-less title/slug). */
  protected goalSimilarityForDraft(
    userMessage: string,
    draft: ExperienceSkillDraftSummary,
  ): number {
    let metaPreview = '';
    try {
      const meta = this.readMeta(draft.path);
      metaPreview = meta?.userMessagePreview || '';
    } catch {
      // optional
    }
    // Also check exact fingerprint (user-scoped) when present
    const goalSlug = slugify(userMessage);
    let sim = goalSimilarity(userMessage, {
      title: draft.title,
      fingerprint: draft.fingerprint,
      id: draft.id,
      userMessagePreview: metaPreview,
    });
    if (draft.fingerprint && goalSlug) {
      // fingerprint is sha256(userId|slug).slice(0,16) ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â compare title slug path already covered;
      // boost when draft id embeds fingerprint and message slug equals title slug closely
      if (sim < 1 && draft.id.includes(draft.fingerprint) && slugify(draft.title) === goalSlug) {
        sim = 1;
      }
    }
    return sim;
  }

  protected applyNudgeRateLimit(userId: string | null | undefined, nudge: string | null): string | null {
    if (!nudge) return null;
    const cooldownMs = resolveNudgeCooldownMs();
    if (cooldownMs <= 0) return nudge;
    const activity = this.readActivity(cleanUserId(userId));
    const last = activity.lastNudgeAt ? Date.parse(activity.lastNudgeAt) : NaN;
    if (Number.isFinite(last) && (this.now().getTime() - last) < cooldownMs) {
      return null;
    }
    return nudge;
  }

  public buildUserNudge(input: {
    kind: 'created' | 'improved' | 'reuse';
    title: string;
    id: string;
    tools: string[];
    useCount: number;
    llmCompacted?: boolean;
  }): string {
    const title = input.title || 'workflow';
    const id = input.id || '';
    const tools = input.tools.slice(0, 10).join('`, `');
    const head = input.kind === 'created'
      ? tService('learning_loop.nudge_created')
      : input.kind === 'improved'
        ? tService('learning_loop.nudge_improved', { title })
        : tService('learning_loop.nudge_reuse', { title, count: input.useCount });
    return [
      '',
      '---',
      head,
      input.kind === 'created' ? `- Title: _${title}_` : null,
      input.kind === 'created' ? `- Id: \`${id}\`` : null,
      tService('learning_loop.nudge_tools', { tools }),
      input.llmCompacted ? tService('learning_loop.nudge_compacted') : null,
      tService('learning_loop.nudge_review', { id }),
      input.kind === 'created' ? tService('learning_loop.nudge_promote', { id }) : null,
    ].filter(Boolean).join('\n');
  }

  protected emitLearningTelemetry(
    event:
      | 'learning.skill_drafted'
      | 'learning.skill_reinforced'
      | 'learning.skill_improved'
      | 'learning.skill_run_manual',
    payload: Record<string, string | number | boolean | null | undefined>,
  ): void {
    try {
      // No PII: only counts, reason codes, surface ids.
      logger.info(`[learning-loop] ${event} ${JSON.stringify(payload)}`);
    } catch {
      // optional
    }
  }

  protected recordActivity(userId: string | null | undefined, input: {
    reason: string;
    skillTitle?: string | null;
    skillId?: string | null;
    surface?: string | null;
    /** When true, update lastNudgeAt (nudge was shown to the user). */
    nudged?: boolean;
  }): void {
    try {
      const uid = cleanUserId(userId);
      // Field-level merge so concurrent weekly metric writes are not wiped.
      this.mergeWriteActivity(uid, {
        lastTriggerAt: this.now().toISOString(),
        lastTriggerReason: input.reason,
        lastSkillTitle: input.skillTitle || null,
        lastSkillId: input.skillId || null,
        lastSurface: input.surface || null,
        lastNudgeAt: input.nudged ? this.now().toISOString() : undefined,
      });
    } catch {
      // optional
    }
  }

  /**
   * Read-merge-write for learning-activity.json.
   * Re-reads immediately before write so weekly counters and nudge timestamps
   * from concurrent recordWeeklyMetric / recordActivity callers are preserved.
   * undefined patch fields keep the latest on-disk value.
   */
  protected mergeWriteActivity(
    userId: string,
    patch: {
      lastTriggerAt?: string | null;
      lastTriggerReason?: string | null;
      lastSkillTitle?: string | null;
      lastSkillId?: string | null;
      lastSurface?: string | null;
      lastNudgeAt?: string | null;
      weekly?: ExperienceSkillWeeklyMetrics;
    },
  ): void {
    const uid = cleanUserId(userId);
    const file = path.join(this.userLearningRoot(uid), 'learning-activity.json');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const prev = this.readActivity(uid);
    // Second read reduces lost-update window against parallel metric writers.
    const latest = this.readActivity(uid);
    const base = {
      lastTriggerAt: latest.lastTriggerAt ?? prev.lastTriggerAt,
      lastTriggerReason: latest.lastTriggerReason ?? prev.lastTriggerReason,
      lastSkillTitle: latest.lastSkillTitle ?? prev.lastSkillTitle,
      lastSkillId: (latest as { lastSkillId?: string | null }).lastSkillId
        ?? (prev as { lastSkillId?: string | null }).lastSkillId
        ?? null,
      lastSurface: (latest as { lastSurface?: string | null }).lastSurface
        ?? (prev as { lastSurface?: string | null }).lastSurface
        ?? null,
      lastNudgeAt: latest.lastNudgeAt ?? prev.lastNudgeAt,
      weekly: latest.weekly ?? prev.weekly,
    };
    const next = {
      lastTriggerAt: patch.lastTriggerAt !== undefined ? patch.lastTriggerAt : base.lastTriggerAt,
      lastTriggerReason: patch.lastTriggerReason !== undefined ? patch.lastTriggerReason : base.lastTriggerReason,
      lastSkillTitle: patch.lastSkillTitle !== undefined ? patch.lastSkillTitle : base.lastSkillTitle,
      lastSkillId: patch.lastSkillId !== undefined ? patch.lastSkillId : base.lastSkillId,
      lastSurface: patch.lastSurface !== undefined ? patch.lastSurface : base.lastSurface,
      lastNudgeAt: patch.lastNudgeAt !== undefined ? patch.lastNudgeAt : base.lastNudgeAt,
      weekly: patch.weekly !== undefined ? patch.weekly : base.weekly,
    };
    this.atomicWrite(file, `${JSON.stringify(next, null, 2)}\n`);
  }

  protected readActivity(userId: string): {
    lastTriggerAt: string | null;
    lastTriggerReason: string | null;
    lastSkillTitle: string | null;
    lastNudgeAt: string | null;
    weekly?: ExperienceSkillWeeklyMetrics;
  } {
    try {
      const file = path.join(this.userLearningRoot(userId), 'learning-activity.json');
      if (!fs.existsSync(file)) {
        return { lastTriggerAt: null, lastTriggerReason: null, lastSkillTitle: null, lastNudgeAt: null };
      }
      const raw = JSON.parse(fs.readFileSync(file, 'utf8')) as {
        lastTriggerAt?: string;
        lastTriggerReason?: string;
        lastSkillTitle?: string;
        lastNudgeAt?: string;
        weekly?: ExperienceSkillWeeklyMetrics;
      };
      return {
        lastTriggerAt: raw.lastTriggerAt || null,
        lastTriggerReason: raw.lastTriggerReason || null,
        lastSkillTitle: raw.lastSkillTitle || null,
        lastNudgeAt: raw.lastNudgeAt || null,
        weekly: raw.weekly,
      };
    } catch {
      return { lastTriggerAt: null, lastTriggerReason: null, lastSkillTitle: null, lastNudgeAt: null };
    }
  }

  public readWeeklyMetrics(userId?: string | null): ExperienceSkillWeeklyMetrics {
    const uid = cleanUserId(userId);
    const weekKey = getIsoWeekKey(this.now());
    try {
      const activity = this.readActivity(uid);
      if (activity.weekly && activity.weekly.weekKey === weekKey) {
        return {
          weekKey,
          draftsCreated: Number(activity.weekly.draftsCreated || 0) || 0,
          promotes: Number(activity.weekly.promotes || 0) || 0,
          reuses: Number(activity.weekly.reuses || 0) || 0,
        };
      }
      // Also check adjacent metrics file
      const metricsFile = path.join(this.userLearningRoot(uid), 'weekly-metrics.json');
      if (fs.existsSync(metricsFile)) {
        const raw = JSON.parse(fs.readFileSync(metricsFile, 'utf8')) as ExperienceSkillWeeklyMetrics;
        if (raw.weekKey === weekKey) {
          return {
            weekKey,
            draftsCreated: Number(raw.draftsCreated || 0) || 0,
            promotes: Number(raw.promotes || 0) || 0,
            reuses: Number(raw.reuses || 0) || 0,
          };
        }
      }
    } catch {
      // fall through
    }
    return { weekKey, draftsCreated: 0, promotes: 0, reuses: 0 };
  }

  public recordWeeklyMetric(userId: string | null | undefined, key: WeeklyMetricKey): void {
    try {
      const uid = cleanUserId(userId);
      const weekKey = getIsoWeekKey(this.now());
      const current = this.readWeeklyMetrics(uid);
      const next: ExperienceSkillWeeklyMetrics = {
        weekKey,
        draftsCreated: current.weekKey === weekKey ? current.draftsCreated : 0,
        promotes: current.weekKey === weekKey ? current.promotes : 0,
        reuses: current.weekKey === weekKey ? current.reuses : 0,
      };
      next[key] = (Number(next[key] || 0) || 0) + 1;

      const metricsFile = path.join(this.userLearningRoot(uid), 'weekly-metrics.json');
      fs.mkdirSync(path.dirname(metricsFile), { recursive: true });
      this.atomicWrite(metricsFile, `${JSON.stringify(next, null, 2)}\n`);

      // Mirror weekly into activity via merge write (preserves lastTrigger / lastNudgeAt).
      this.mergeWriteActivity(uid, { weekly: next });
    } catch {
      // optional
    }
  }

  /**
   * Optional LLM rewrite of the ## Procedure section into a short reusable checklist.
   * Opt-in only; failures leave the draft unchanged.
   */
  protected readMeta(dir: string): DraftMeta | null {
    try {
      return JSON.parse(fs.readFileSync(path.join(dir, 'skill.meta.json'), 'utf8')) as DraftMeta;
    } catch {
      return null;
    }
  }

  protected atomicWrite(file: string, content: string): void {
    const temporary = `${file}.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`;
    fs.writeFileSync(temporary, content, { encoding: 'utf8', mode: 0o600 });
    fs.renameSync(temporary, file);
  }

  /** True when resolvedPath is the root or a path strictly under root (containment). */
  protected isPathInsideRoot(resolvedPath: string, resolvedRoot: string): boolean {
    const root = path.resolve(resolvedRoot);
    const target = path.resolve(resolvedPath);
    if (target === root) return true;
    const prefix = root.endsWith(path.sep) ? root : `${root}${path.sep}`;
    return target.startsWith(prefix);
  }
}
