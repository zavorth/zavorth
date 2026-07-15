/**
 * Slash-command handlers for /learn, /learn-skill, /model, /strong, /export, /consensus.
 * Works on any shared surface (Telegram, WhatsApp, Discord, web, desktop, Control, CLI).
 */

import type { IMessageContext } from '../../../../contracts/IMessageBroker.js';
import { SessionModelRouteService } from '../../../../services/SessionModelRouteService.js';
import { ZavorthSessionTranscriptExportService } from '../../../../services/ZavorthSessionTranscriptExportService.js';
import { ZavorthLearnSkillService } from '../../../../services/ZavorthLearnSkillService.js';
import { invokeConsensusSurface, formatConsensusHelp } from '../../../../services/ConsensusSurface.js';
import { LlmRoleSurfaceCommands } from '../../../../services/llm/LlmRoleSurfaceCommands.js';
import { LlmRuntimeService } from '../../../../services/llm/LlmRuntimeService.js';
import { ProviderControlPlaneService } from '../../../../services/ProviderControlPlaneService.js';
import { ExperienceSkillLearningLoopService } from '../../../../services/ExperienceSkillLearningLoopService.js';
import {
  AboutYouService,
  buildLearnedKnowledgeAdvanced,
  buildLearnedKnowledgeStory,
  formatConversationRecallLines,
  formatKnowledgeFactsLines,
  formatKnowledgeHomeReport,
  LearnedKnowledgePlaneService,
  previewKnowledgeConsolidate,
  queryKnowledgeFacts,
  recallConversations,
} from '../../../../services/learned-knowledge/index.js';
import { config } from '../../../../config/index.js';
import { errorMessage } from '../../../../utils/errorLike.js';
import { tService } from '../../../../i18n/services.js';

export class SharedSurfaceSlashEnhancementCommandPack {
  private readonly roleCommands = new LlmRoleSurfaceCommands();
  private readonly llmRuntime = new LlmRuntimeService();
  private readonly providerControlPlane = new ProviderControlPlaneService();
  private readonly experienceSkills = new ExperienceSkillLearningLoopService();

  public async maybeHandle(ctx: IMessageContext, commandType: string, args: string): Promise<boolean> {
    const type = String(commandType || '')
      .trim()
      .toLowerCase();
    if (type === '/knowledge' || type === '/lk' || type === '/learned-knowledge') {
      await this.handleKnowledge(ctx, args);
      return true;
    }
    if (type === '/learn' || type === '/learning-loop' || type === '/learningloop') {
      await this.handleLearnLoop(ctx, args);
      return true;
    }
    if (type === '/learn-skill' || type === '/learnskill') {
      await this.handleLearnSkill(ctx, args);
      return true;
    }
    if (type === '/model') {
      await this.handleModel(ctx, args);
      return true;
    }
    if (type === '/strong') {
      await this.handleStrong(ctx, args);
      return true;
    }
    if (type === '/export') {
      await this.handleExport(ctx, args);
      return true;
    }
    if (type === '/consensus' || type === '/deliberate' || type === '/moa') {
      await this.handleConsensus(ctx, args);
      return true;
    }
    return false;
  }

  private async handleKnowledge(ctx: IMessageContext, args: string): Promise<void> {
    const userId = String(ctx.userId || '').trim() || 'shared-surface';
    const tokens = String(args || '')
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    const verb = String(tokens[0] || 'status').toLowerCase();
    const rest = tokens.slice(1);
    const projectRoot = process.cwd();

    if (verb === 'help' || verb === '-h' || verb === '--help') {
      await ctx.reply(
        [
          '📚 Learned knowledge',
          'What Zavorth remembers — without free-text keyword tricks.',
          '',
          '/knowledge              home report (pretty)',
          '/knowledge story        this week’s events',
          '/knowledge advanced     vault + dream preview',
          '/knowledge pack <q>     multi-pillar pack',
          '/knowledge recall <q>   past chat',
          '/knowledge facts <q>    project wiki',
          '/knowledge about        profile facts',
          '/knowledge workflows    skill drafts (/learn list · /learn promote 1)',
          '/knowledge consolidate  dream PREVIEW only',
          '',
          '/learn = skill drafts · /learning = candidates',
          'CLI: zavorth knowledge status',
        ].join('\n'),
      );
      return;
    }

    // Default /knowledge and explicit status verbs → pretty home card.
    if (!tokens.length || verb === 'status' || verb === 'home' || verb === 'hub' || verb === 'report') {
      await ctx.reply(
        formatKnowledgeHomeReport({
          userId,
          projectRoot,
          maxEvents: 6,
          maxChars: 3500,
        }),
      );
      return;
    }

    if (verb === 'story' || verb === 'week' || verb === 'this-week' || verb === 'timeline') {
      const story = buildLearnedKnowledgeStory({
        userId,
        projectRoot,
        windowDays: 7,
        limit: 12,
      });
      await ctx.reply(
        [
          '📅 This week',
          story.summary,
          '',
          ...(story.events.length
            ? story.events.slice(0, 10).map((e) => {
                const when = e.at.slice(0, 10);
                const snip = e.snippet ? `\n   ${e.snippet.slice(0, 100)}` : '';
                return `• [${e.pillar}] ${when}  ${e.title}${snip}`;
              })
            : ['(no events in this window)']),
          '',
          'More: /knowledge  ·  /knowledge advanced',
        ]
          .join('\n')
          .slice(0, 3500),
      );
      return;
    }

    if (verb === 'advanced' || verb === 'adv' || verb === 'file-index' || verb === 'vault') {
      const advanced = buildLearnedKnowledgeAdvanced({ projectRoot });
      await ctx.reply(
        [
          '🔧 Knowledge → Advanced',
          '',
          'File index',
          `  ${advanced.fileIndex.available ? '✓ ready' : '○ setup'}  ${advanced.fileIndex.summary}`,
          advanced.fileIndex.vaultPath ? `  path: ${advanced.fileIndex.vaultPath}` : '',
          '',
          'Dream cycle (preview only — never silent promote)',
          `  ${advanced.dreamCycle.summary}`,
          advanced.dreamCycle.lastRunAt
            ? `  last: ${advanced.dreamCycle.lastRunAt.slice(0, 16)} · candidates=${advanced.dreamCycle.lastCandidateCount ?? 0}`
            : '  last: never',
          `  ${advanced.dreamCycle.nextEligibleHint}`,
          '',
          advanced.preferenceSpineNote,
          '',
          'Run preview: /knowledge consolidate',
        ]
          .filter(Boolean)
          .join('\n')
          .slice(0, 3500),
      );
      return;
    }

    if (verb === 'pack' || verb === 'compose') {
      const query = rest.join(' ').trim();
      const pack = new LearnedKnowledgePlaneService({ projectRoot }).buildPack({
        userId,
        userMessage: query || null,
        surface: String(ctx.channel || 'shared-surface'),
        projectRoot,
      });
      await ctx.reply(
        [
          '📦 Learned knowledge pack',
          `hits=${pack.hits.length} · ~${pack.budget.estimatedTokens}/${pack.budget.tokenBudget} tokens`,
          `pillars queried: ${pack.pillarsQueried.join(', ')} (equal weight · store scores only)`,
          '',
          ...pack.hits.slice(0, 8).map((h) => `• [${h.pillar}] ${h.title}`),
          pack.injectBlock ? `\n${pack.injectBlock.slice(0, 1800)}` : '(no inject body — stores empty or budget zero)',
        ]
          .filter(Boolean)
          .join('\n')
          .slice(0, 3500),
      );
      return;
    }

    if (verb === 'recall' || verb === 'chat') {
      const query = rest.join(' ').trim();
      if (!query) {
        await ctx.reply('Usage: /knowledge recall <query>');
        return;
      }
      const snap = recallConversations({ query, projectRoot, limit: 8 });
      await ctx.reply(formatConversationRecallLines(snap).join('\n').slice(0, 3500));
      return;
    }

    if (verb === 'facts' || verb === 'fact' || verb === 'wiki') {
      const query = rest.join(' ').trim();
      if (!query) {
        await ctx.reply('Usage: /knowledge facts <query>');
        return;
      }
      try {
        const result = queryKnowledgeFacts({ query, projectRoot, topK: 6 });
        await ctx.reply(formatKnowledgeFactsLines(result).join('\n').slice(0, 3500));
      } catch (error: unknown) {
        await ctx.reply(errorMessage(error) || 'Knowledge facts query failed.');
      }
      return;
    }

    if (verb === 'about' || verb === 'profile' || verb === 'me') {
      const about = new AboutYouService({ projectRoot });
      const snap = about.buildSnapshot(userId);
      await ctx.reply(about.formatStatusLines(snap).join('\n').slice(0, 3500));
      return;
    }

    if (verb === 'workflows' || verb === 'learn') {
      await this.handleLearnLoop(ctx, rest.join(' ') || 'status');
      return;
    }

    if (verb === 'consolidate' || verb === 'dream') {
      const preview = previewKnowledgeConsolidate({ projectRoot });
      await ctx.reply(
        [
          'Knowledge consolidate — PREVIEW ONLY',
          preview.dream.summary,
          `Blockers: ${preview.promotionGate.blockers.join(', ')}`,
          ...preview.nextSteps.slice(0, 4).map((s) => `• ${s}`),
        ]
          .join('\n')
          .slice(0, 3500),
      );
      return;
    }

    await ctx.reply('Unknown /knowledge verb. Try /knowledge help');
  }

  private async handleLearnLoop(ctx: IMessageContext, args: string): Promise<void> {
    const userId = String(ctx.userId || '').trim() || 'shared-surface';
    const tokens = String(args || '')
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    const verb = String(tokens[0] || 'status').toLowerCase();
    const rest = tokens.slice(1);

    if (verb === 'help' || verb === '-h' || verb === '--help') {
      await ctx.reply(
        [
          'Experience skill learning loop — multi-tool workflow skill drafts.',
          'Drafts stay local until you promote. Never auto-installs to SkillLoader.',
          '',
          '/learn = skill drafts · /learning = candidates',
          'Use /learning for learning-plane candidates (approve/reject/promote/forget).',
          '',
          '/learn · /learn status',
          '/learn list',
          '/learn search <query>',
          '/learn show 1',
          '/learn run 1',
          '/learn promote 1',
          '/learn promote 1 --dry-run',
          '/learn promote-preview 1',
          '/learn forget 1',
          '',
          'Numbers come from /learn list (or search). Prefer ordinals (1), not long ids.',
          'Promote installs a SkillLoader skill under .agents/skills (explicit only).',
          'promote --dry-run previews destinations + SKILL.md without writing.',
          '/learn search ranks local drafts by title/tools/body (user-scoped).',
          '/learn run 1 shows governed procedure only (does not execute tools).',
          'Forget removes the draft only (not promoted or runtime skills).',
          '',
          'CLI: zavorth learn',
        ].join('\n'),
      );
      return;
    }

    if (verb === 'list') {
      // Same default sort as ordinal resolve (listDrafts score, then updatedAt).
      const drafts = this.experienceSkills.listDrafts(userId, 20);
      if (drafts.length === 0) {
        await ctx.reply('No experience skill drafts yet. Complete a multi-tool task first.');
        return;
      }
      const body = drafts
        .map((d, i) => {
          const shortId = String(d.id || '').slice(0, 8);
          return `${i + 1}. ${d.title}\n   uses=${d.useCount} rev=${d.revisions || 0}${shortId ? ` · ${shortId}` : ''}`;
        })
        .join('\n');
      await ctx.reply(
        [
          'Skill drafts (experience loop)',
          '/learn = skill drafts · /learning = candidates',
          '',
          body,
          '',
          'Tip: /learn promote 1 · /learn forget 1 · /learn show 1',
        ].join('\n'),
      );
      return;
    }

    if (verb === 'search') {
      const query = rest.join(' ').trim();
      const hits = this.experienceSkills.searchDrafts(userId, query, 15);
      if (hits.length === 0) {
        await ctx.reply(
          query
            ? `No experience skill drafts matching "${query}".`
            : 'No experience skill drafts yet. Complete a multi-tool task first.',
        );
        return;
      }
      const body = hits
        .map((d, i) => {
          const shortId = String(d.id || '').slice(0, 8);
          const snip = d.snippet ? `\n   ${d.snippet}` : '';
          return `${i + 1}. ${d.title}\n   uses=${d.useCount} rev=${d.revisions || 0}${shortId ? ` · ${shortId}` : ''}${snip}`;
        })
        .join('\n');
      await ctx.reply(
        [
          query ? `Search results for "${query}" (${hits.length}):` : `Skill drafts (${hits.length}):`,
          '/learn = skill drafts · /learning = candidates',
          '',
          body,
          '',
          'Tip: /learn promote 1 · /learn forget 1 · /learn show 1',
        ]
          .join('\n')
          .slice(0, 3500),
      );
      return;
    }

    if (verb === 'show') {
      const id = rest.join(' ').trim();
      if (!id) {
        await ctx.reply('Usage: /learn show 1  (from /learn list)');
        return;
      }
      const shown = this.experienceSkills.showDraft(userId, id);
      if (!shown.ok) {
        await ctx.reply(this.learnDraftRefError('show', id, shown.text));
        return;
      }
      await ctx.reply(shown.text.slice(0, 3500));
      return;
    }

    if (verb === 'run') {
      const id = rest.join(' ').trim();
      if (!id) {
        await ctx.reply('Usage: /learn run 1  (from /learn list)');
        return;
      }
      const result = this.experienceSkills.runSkill(userId, id);
      if (!result.ok) {
        await ctx.reply(this.learnDraftRefError('run', id, result.text));
        return;
      }
      await ctx.reply(result.text.slice(0, 3500));
      return;
    }

    if (verb === 'promote' || verb === 'promote-preview') {
      const dryRun =
        verb === 'promote-preview' ||
        rest.some((t) => t === '--dry-run' || t === '--dryRun') ||
        String(rest[0] || '').toLowerCase() === 'preview';
      const id = rest
        .filter((t) => t !== '--dry-run' && t !== '--dryRun' && String(t).toLowerCase() !== 'preview')
        .join(' ')
        .trim();
      if (!id) {
        await ctx.reply('Usage: /learn promote 1 [--dry-run]  or  /learn promote-preview 1');
        return;
      }
      const result = dryRun
        ? this.experienceSkills.promote(userId, id, { dryRun: true })
        : this.experienceSkills.promote(userId, id);
      if (!result.ok) {
        await ctx.reply(this.learnDraftRefError('promote', id, result.text));
        return;
      }
      const lines = [result.text.slice(0, 3500)];
      if (result.ok && result.skillName && !result.dryRun) {
        lines.push(`Skill name: \`${result.skillName}\``);
      }
      if (result.ok && result.runtimeSkillPath && !result.dryRun) {
        lines.push(`Runtime: ${result.runtimeSkillPath}`);
      }
      await ctx.reply(lines.join('\n'));
      return;
    }

    if (verb === 'forget') {
      const id = rest.join(' ').trim();
      if (!id) {
        await ctx.reply('Usage: /learn forget 1  (from /learn list)');
        return;
      }
      const result = this.experienceSkills.forget(userId, id);
      if (!result.ok) {
        await ctx.reply(this.learnDraftRefError('forget', id, result.text));
        return;
      }
      await ctx.reply(result.text);
      return;
    }

    // status / home
    const status = this.experienceSkills.buildStatusSnapshot(userId);
    const cooldownLabel =
      status.nudgeCooldownMs <= 0
        ? 'off'
        : status.nudgeCooldownMs % 60000 === 0
          ? `${status.nudgeCooldownMs / 60000} min`
          : `${status.nudgeCooldownMs}ms`;
    const m = status.metrics;
    const lines = [
      status.oneLiner,
      status.planeNote,
      '',
      `Plane: ${status.plane} (experience skill drafts)`,
      `Badge: ${status.badge}`,
      `Drafts: ${status.drafts} · improved: ${status.improved} · promoted: ${status.promoted}`,
      `Weekly metrics (${m.weekKey}): drafts=${m.draftsCreated} · promotes=${m.promotes} · reuses=${m.reuses}`,
      `Nudge cooldown: ${cooldownLabel}`,
      status.topTools.length
        ? `Top tools: ${status.topTools
            .slice(0, 5)
            .map((t) => `${t.tool}(${t.count})`)
            .join(', ')}`
        : null,
      status.lastTriggerAt
        ? `Last trigger: ${status.lastTriggerAt}${status.lastTriggerReason ? ` (${status.lastTriggerReason})` : ''}`
        : 'Last trigger: (none)',
    ].filter(Boolean) as string[];
    if (status.latest.length === 0) {
      lines.push('Latest: (none yet)');
    } else {
      lines.push('Latest:');
      for (const [i, d] of status.latest.slice(0, 3).entries()) {
        const shortId = String(d.id || '').slice(0, 8);
        lines.push(`${i + 1}. ${d.title}${shortId ? ` · ${shortId}` : ''} uses=${d.useCount}`);
      }
    }
    lines.push(
      '',
      '/learn = skill drafts · /learning = candidates',
      'Try: /learn list · /learn show 1 · /learn promote 1 · /learn forget 1',
    );
    await ctx.reply(lines.join('\n'));
  }

  /** Prefer ordinal UX when a long draft id fails; keep service text for short/ordinal misses. */
  private learnDraftRefError(action: 'show' | 'run' | 'promote' | 'forget', ref: string, serviceText: string): string {
    const raw = String(ref || '').trim();
    if (/^#?\d{1,2}$/.test(raw)) {
      return `No draft at that number. Run /learn list, then /learn ${action} 1.`;
    }
    // Long / non-ordinal refs: steer operators to numbered list instead of pasting ids.
    if (raw.length > 8) {
      return `Use /learn ${action} 1 (from /learn list), not a long id.`;
    }
    return serviceText || `Use /learn ${action} 1 (from /learn list), not a long id.`;
  }

  private async handleConsensus(ctx: IMessageContext, args: string): Promise<void> {
    const raw = String(args || '').trim();
    if (raw === 'help' || raw === '-h' || raw === '--help') {
      await ctx.reply(formatConsensusHelp());
      return;
    }

    try {
      const tokens = raw ? tokenizeSlashArgs(raw) : [];
      const sessionId = this.resolveSessionId(ctx);
      const result = await invokeConsensusSurface({
        tokens,
        sessionId,
        projectRoot: process.cwd(),
      });
      await ctx.reply(result.text);
    } catch (error: unknown) {
      await ctx.reply(errorMessage(error, tService('slash.consensus_failed')));
    }
  }

  private async handleLearnSkill(ctx: IMessageContext, args: string): Promise<void> {
    const parsed = parseLearnSkillArgs(args);
    if (!parsed.source) {
      await ctx.reply(
        [
          tService('slash.learn_skill_usage_title'),
          '',
          `${tService('slash.usage')}:`,
          '  /learn-skill <url|path|notes>                 (natural preview)',
          '  /learn-skill <source> --apply --consent       (apply with consent)',
          '  /learn-skill apply <source> --consent',
          '  /learn-skill <source> --apply --approval-id <id>',
          '  /learn-skill <url> --confirm-live-network',
          '',
          'Preview is the default. Apply requires --consent/--yes or --approval-id.',
        ].join('\n'),
      );
      return;
    }

    try {
      const service = new ZavorthLearnSkillService({ projectRoot: process.cwd() });
      const snap = await service.learn({
        source: parsed.source,
        apply: parsed.apply,
        consent: parsed.consent || Boolean(parsed.approvalId),
        approvalId: parsed.approvalId,
        confirmLiveNetwork: parsed.confirmLiveNetwork,
        allowExecutable: parsed.allowExecutable,
        allowAllCandidates: parsed.allowAll,
        label: parsed.source.slice(0, 80),
      });
      const lines = [
        snap.narrative.headline,
        snap.narrative.operatorSummary,
        '',
        `${tService('slash.status')}: ${snap.status}`,
        `${tService('slash.source_kind')}: ${snap.sourceKind}`,
        `${tService('slash.apply_requested')}: ${snap.applyRequested} | consent: ${snap.consentGranted}`,
        `${tService('slash.candidates')}: ${snap.fabric.summary.candidates}`,
        `${tService('slash.materialized')}: ${snap.fabric.summary.materialized}`,
        `${tService('slash.quarantine')}: ${snap.fabric.quarantineRoot}`,
        '',
        `${tService('slash.next')}: ${snap.narrative.nextStep}`,
      ];
      if (snap.status === 'preview' || snap.status === 'approval-required') {
        lines.push(`${tService('slash.apply')}: /learn-skill ${parsed.source} --apply --consent`);
      }
      await ctx.reply(lines.join('\n'));
    } catch (error: unknown) {
      await ctx.reply(errorMessage(error, tService('slash.learn_skill_failed')));
    }
  }

  private roleCtx(ctx: IMessageContext) {
    return {
      userId: String(ctx.userId || '').trim() || null,
      surface: String(ctx.platform || 'shared-surface').trim() || 'shared-surface',
      isProviderUsable: (name: string) => this.llmRuntime.isProviderAvailable(name),
      defaultModelForProvider: (provider: string) => {
        const p = String(provider || '').toLowerCase();
        if (p === 'gemini') return config.geminiModel;
        if (p === 'openai') return config.openaiModel;
        if (p === 'deepseek') return config.deepseekModel;
        if (p === 'openrouter') return config.openRouterModel;
        if (p === 'xai') return config.xaiModel;
        return '';
      },
      resolveSelection: (target: string) => this.providerControlPlane.resolveSelection(target),
      usageTargets: () => this.providerControlPlane.getUsageTargets(),
    };
  }

  private async handleStrong(ctx: IMessageContext, args: string): Promise<void> {
    const raw = String(args || '')
      .trim()
      .toLowerCase();
    const enabled = !(raw === 'off' || raw === 'default' || raw === '0' || raw === 'false');
    await ctx.reply(this.roleCommands.setForceStrong(this.roleCtx(ctx), enabled));
  }

  private async handleModel(ctx: IMessageContext, args: string): Promise<void> {
    const raw = String(args || '').trim();
    const tokens = raw.split(/\s+/).filter(Boolean);
    const head = String(tokens[0] || '').toLowerCase();
    const roleCtx = this.roleCtx(ctx);

    // Dual-role LLM preferences (default/strong/background) — multi-surface.
    const roleHandled = this.roleCommands.handleModelArgs(roleCtx, raw);
    if (roleHandled.handled && roleHandled.text) {
      // When user only asked for session usage, still append role status below.
      if (head === 'usage') {
        // fall through to session ledger after roles status
      } else if (
        !raw ||
        head === 'status' ||
        head === 'show' ||
        head === 'setup' ||
        head === 'roles' ||
        head === 'default' ||
        head === 'strong' ||
        head === 'background' ||
        head === 'fallback' ||
        head === 'clear' ||
        head.startsWith('strong-on-fail')
      ) {
        if (head === 'status' || head === 'show' || !raw) {
          const sessionBlock = this.formatSessionModelStatus(ctx);
          await ctx.reply([roleHandled.text, '', sessionBlock].join('\n'));
          return;
        }
        await ctx.reply(roleHandled.text);
        return;
      }
    }

    const sessionId = this.resolveSessionId(ctx);
    const service = SessionModelRouteService.getInstance();

    if (tokens.length === 0 || head === 'status' || head === 'usage' || head === 'show') {
      await ctx.reply([this.roleCommands.formatStatus(roleCtx), '', this.formatSessionModelStatus(ctx)].join('\n'));
      return;
    }

    if (head === 'clear' && tokens[1] !== 'strong') {
      service.clearSessionModel(sessionId);
      await ctx.reply(tService('slash.session_model_cleared', { sessionId }));
      return;
    }

    const selection = this.providerControlPlane.resolveSelection(raw);
    if (selection) {
      this.providerControlPlane.applySelection(selection);
    }

    const modelName = selection?.modelName || tokens[0];
    const providerName = selection?.effectiveProviderName || tokens[1] || null;
    try {
      const ledger = service.setSessionModel({
        sessionId,
        modelName,
        providerName,
        source: 'slash',
      });
      if (providerName && modelName) {
        const { LlmRoleRoutingService } = await import('../../../../services/llm/LlmRoleRoutingService.js');
        new LlmRoleRoutingService().recordModelSwitch(
          this.roleCommands.resolveScope(roleCtx),
          String(providerName),
          String(modelName),
          roleCtx.surface,
        );
      }
      await ctx.reply(
        [
          tService('slash.session_model_updated'),
          `${tService('slash.session')}: ${sessionId}`,
          `Model: ${ledger.route?.providerName || 'any'}/${ledger.route?.modelName}`,
          tService('slash.subsequent_turns_note'),
          '',
          this.roleCommands.formatStatus(roleCtx),
        ].join('\n'),
      );
    } catch (error: unknown) {
      await ctx.reply(errorMessage(error, tService('slash.session_model_failed')));
    }
  }

  private formatSessionModelStatus(ctx: IMessageContext): string {
    const sessionId = this.resolveSessionId(ctx);
    const service = SessionModelRouteService.getInstance();
    const ledger = service.getLedger(sessionId);
    const lines = [
      tService('slash.session_model_route'),
      `${tService('slash.session')}: ${sessionId}`,
      `${tService('slash.active')}: ${ledger.route ? `${ledger.route.providerName || 'any'}/${ledger.route.modelName}` : '(default runtime)'}`,
      `${tService('slash.usage_by_model')}:`,
    ];
    const keys = Object.keys(ledger.totalsByModel);
    if (keys.length === 0) {
      lines.push(`  ${tService('slash.empty')}`);
    } else {
      for (const key of keys.slice(0, 12)) {
        const row = ledger.totalsByModel[key];
        lines.push(`  - ${key}: ${row.calls} call(s), in=${row.inputTokens} out=${row.outputTokens}`);
      }
    }
    lines.push(
      `${tService('slash.usage')}: /model setup | /model default <p/m> | /model strong <p/m> | /strong on|off`,
    );
    lines.push('Session route: /model <modelName> [provider] | CLI: zavorth roles status');
    return lines.join('\n');
  }

  private async handleExport(ctx: IMessageContext, args: string): Promise<void> {
    const tokens = String(args || '')
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    const formatToken = tokens.find((t) => /^(markdown|md|html|prompt|prompt-only)$/i.test(t));
    const format = !formatToken
      ? 'markdown'
      : /html/i.test(formatToken)
        ? 'html'
        : /prompt/i.test(formatToken)
          ? 'prompt'
          : 'markdown';
    const sessionId = this.resolveSessionId(ctx);

    try {
      const service = new ZavorthSessionTranscriptExportService({ projectRoot: process.cwd() });
      const snap = service.export({
        sessionId,
        platform: String(ctx.platform || 'web'),
        chatId: String(ctx.chatId || sessionId),
        format,
        redact: true,
      });

      if (snap.status === 'empty') {
        await ctx.reply(
          [
            tService('slash.session_export'),
            '',
            tService('slash.session_export_empty', { sessionId }),
            'CLI with inline messages: zavorth session export --messages-file msgs.json --format markdown',
          ].join('\n'),
        );
        return;
      }

      const preview =
        snap.bodyPreview.length > 2800
          ? `${snap.bodyPreview.slice(0, 2800)}\n\n… (${tService('slash.preview_truncated')})`
          : snap.bodyPreview;
      await ctx.reply(
        [
          `${tService('slash.session_export')} (${snap.format}) — ${snap.status}`,
          `${tService('slash.messages')}: ${snap.messageCount} | ${tService('slash.redacted')}: ${snap.safety.secretsRedacted}`,
          '',
          preview,
          '',
          `${tService('slash.write_full_file')}: ${snap.commands.apply}`,
        ].join('\n'),
      );
    } catch (error: unknown) {
      await ctx.reply(errorMessage(error, tService('slash.session_export_failed')));
    }
  }

  private resolveSessionId(ctx: IMessageContext): string {
    const sessionId = String((ctx as { sessionId?: string }).sessionId || '').trim();
    if (sessionId) return sessionId;
    const chatId = String(ctx.chatId || '').trim();
    const userId = String(ctx.userId || '').trim();
    const platform = String(ctx.platform || 'web').trim();
    return chatId || `${platform}:${userId || 'user'}`;
  }
}

function parseLearnSkillArgs(raw: string): {
  source: string;
  apply: boolean;
  consent: boolean;
  approvalId: string | null;
  confirmLiveNetwork: boolean;
  allowExecutable: boolean;
  allowAll: boolean;
} {
  const tokens = String(raw || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  let apply = false;
  let consent = false;
  let confirmLiveNetwork = false;
  let allowExecutable = false;
  let allowAll = false;
  let approvalId: string | null = null;
  const sourceParts: string[] = [];

  for (let i = 0; i < tokens.length; i += 1) {
    const t = tokens[i];
    const lower = t.toLowerCase();
    if (lower === 'apply' || lower === '--apply') {
      apply = true;
      continue;
    }
    if (lower === 'consent' || lower === '--consent' || lower === '--yes' || lower === 'yes') {
      consent = true;
      continue;
    }
    if (lower === '--confirm-live-network' || lower === 'confirm-live-network') {
      confirmLiveNetwork = true;
      continue;
    }
    if (lower === '--allow-executable' || lower === 'allow-executable') {
      allowExecutable = true;
      continue;
    }
    if (lower === '--allow-all' || lower === 'allow-all') {
      allowAll = true;
      continue;
    }
    if (lower === '--approval-id' || lower === 'approval-id') {
      approvalId = tokens[i + 1] || null;
      i += 1;
      continue;
    }
    if (lower.startsWith('--approval-id=')) {
      approvalId = t.slice('--approval-id='.length) || null;
      continue;
    }
    sourceParts.push(t);
  }

  return {
    source: sourceParts.join(' ').trim(),
    apply,
    consent,
    approvalId,
    confirmLiveNetwork,
    allowExecutable,
    allowAll,
  };
}

function tokenizeSlashArgs(raw: string): string[] {
  const text = String(raw || '').trim();
  if (!text) return [];
  const tokens: string[] = [];
  const re = /"([^"]*)"|'([^']*)'|(\S+)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    tokens.push(match[1] ?? match[2] ?? match[3] ?? '');
  }
  return tokens.filter(Boolean);
}
