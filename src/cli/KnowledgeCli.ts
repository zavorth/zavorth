/**
 * CLI: zavorth knowledge …
 * Learned Knowledge Plane product entry (Phases 0–3).
 */

import {
  AboutYouService,
  buildLearnedKnowledgeAdvanced,
  buildLearnedKnowledgeStory,
  formatConversationRecallLines,
  formatKnowledgeFactsLines,
  formatKnowledgeHomeReport,
  isLearnedKnowledgeEnabled,
  previewKnowledgeConsolidate,
  queryKnowledgeFacts,
  recallConversations,
  resolveLearnedKnowledgeFlags,
  LearnedKnowledgePlaneService,
} from '../services/learned-knowledge/index.js';
import { isExperienceSkillLearningLoopEnabled } from '../services/ExperienceSkillLearningLoopService.js';

function printHelp(): void {
  console.log(
    [
      '=== Zavorth knowledge (Learned Knowledge Plane) ===',
      '',
      'Pillars: Workflows · Conversation recall · About you · Knowledge (Mnemos)',
      '',
      'Usage:',
      '  zavorth knowledge status',
      '  zavorth knowledge story [--days N]        (cross-pillar week timeline)',
      '  zavorth knowledge advanced | file-index   (vault + dream preview surface)',
      '  zavorth knowledge recall <query>          (conversation continuum)',
      '  zavorth knowledge recall chat <query>     (same)',
      '  zavorth knowledge facts <query>           (Mnemos wiki / project knowledge)',
      '  zavorth knowledge pack <query>            (ranked multi-pillar pack + inject)',
      '  zavorth knowledge consolidate             (dream+promotion PREVIEW only)',
      '  zavorth knowledge about                   (operator profile snapshot)',
      '  zavorth knowledge about propose k=v',
      '  zavorth knowledge about approve <id>',
      '  zavorth knowledge about reject <id>',
      '  zavorth knowledge about forget <id|key>',
      '  zavorth knowledge about export',
      '  zavorth knowledge about propose-learning  (drafts from workflow stats)',
      '  zavorth knowledge forget about <id>       (operator fact only)',
      '  zavorth knowledge forget workflows <id>   (skill draft only)',
      '  zavorth knowledge tenant                  (isolation path matrix)',
      '  zavorth knowledge workflows …             (delegates to zavorth learn)',
      '  zavorth knowledge glossary                (pillar names)',
      '',
      'Env:',
      '  ZAVORTH_LEARNED_KNOWLEDGE=0|1     master product switch (default on)',
      '  ZAVORTH_CONTINUUM_CAPTURE=0|1     capture chat turns (default on)',
      '  ZAVORTH_USER_MODEL=0|1           About-you prompt inject (default off)',
      '  ZAVORTH_LEARNED_KNOWLEDGE_INJECT_TOKENS   pack budget',
      '',
      'Free-text purity: pack always queries all pillars; rank is store scores only.',
      'Preference / spine learning is a separate plane (not this CLI).',
      '',
      'Docs: docs/product/learned-knowledge-plane.md',
      'Tools: conversation_recall · knowledge_recall · use_learned_skill',
      'Advanced: plan_mnemos_scope / enable_mnemos · npm run mnemos:dream-cycle',
    ].join('\n'),
  );
}

function printGlossary(): void {
  console.log(
    [
      'Zavorth Learned Knowledge — glossary',
      '',
      'Workflows           Multi-tool skill drafts you promote (experience skill loop).',
      'Conversation recall Prior chat turns in the local session continuum.',
      'About you           Operator profile: USER.md + dialectic + approved facts (inject opt-in).',
      'Knowledge           Project facts via Mnemos wiki OS (+ optional file index).',
      '',
      'See docs/product/learned-knowledge-plane.md',
    ].join('\n'),
  );
}

export async function runKnowledgeCli(rawArgs: string[] = []): Promise<number> {
  if (rawArgs.includes('--help') || rawArgs.includes('-h')) {
    printHelp();
    return 0;
  }

  if (!isLearnedKnowledgeEnabled()) {
    console.log('Learned Knowledge plane is disabled (ZAVORTH_LEARNED_KNOWLEDGE=0).');
    return 0;
  }

  const wantJson = rawArgs.includes('--json');
  const positional = rawArgs.filter((a, i) => {
    if (a === '--json' || a === '--limit' || a === '--top-k' || a === '--budget' || a === '--days') return false;
    if (
      rawArgs[i - 1] === '--limit' ||
      rawArgs[i - 1] === '--top-k' ||
      rawArgs[i - 1] === '--budget' ||
      rawArgs[i - 1] === '--days'
    ) {
      return false;
    }
    return !a.startsWith('--');
  });
  const cmd = String(positional[0] || 'status').toLowerCase();
  const rest = positional.slice(1);
  const limitIdx = rawArgs.indexOf('--limit');
  const topKIdx = rawArgs.indexOf('--top-k');
  const budgetIdx = rawArgs.indexOf('--budget');
  const daysIdx = rawArgs.indexOf('--days');
  const limit = limitIdx >= 0 ? Number(rawArgs[limitIdx + 1] || 8) : 8;
  const topK = topKIdx >= 0 ? Number(rawArgs[topKIdx + 1] || 6) : 6;
  const budget = budgetIdx >= 0 ? Number(rawArgs[budgetIdx + 1] || 1800) : 1800;
  const windowDays = daysIdx >= 0 ? Number(rawArgs[daysIdx + 1] || 7) : 7;
  const projectRoot = process.cwd();
  const flags = resolveLearnedKnowledgeFlags();

  if (cmd === 'help') {
    printHelp();
    return 0;
  }

  if (cmd === 'glossary' || cmd === 'pillars') {
    printGlossary();
    return 0;
  }

  if (cmd === 'status' || cmd === 'home' || cmd === 'hub' || cmd === '') {
    const { buildLearnedKnowledgeHub } = await import('../services/learned-knowledge/LearnedKnowledgeHub.js');
    const userId = process.env.USER || process.env.USERNAME || 'local-user';
    const hub = buildLearnedKnowledgeHub({ userId, projectRoot });
    if (wantJson) {
      console.log(
        JSON.stringify(
          {
            ...hub,
            flags,
            workflowsEnabled: isExperienceSkillLearningLoopEnabled(),
          },
          null,
          2,
        ),
      );
    } else {
      console.log(
        formatKnowledgeHomeReport({
          userId,
          projectRoot,
          maxEvents: 8,
          maxChars: 8000,
        }),
      );
      console.log('');
      console.log(`Pack inject budget: ${flags.injectTokenBudget} tokens · Docs: ${hub.docs}`);
    }
    return 0;
  }

  if (cmd === 'story' || cmd === 'timeline' || cmd === 'week') {
    const userId = process.env.USER || process.env.USERNAME || 'local-user';
    const story = buildLearnedKnowledgeStory({
      userId,
      projectRoot,
      windowDays,
      limit: limitIdx >= 0 ? limit : 24,
    });
    if (wantJson) {
      console.log(JSON.stringify(story, null, 2));
    } else {
      console.log(
        [
          'Learned knowledge story',
          story.summary,
          `User: ${story.userId} · window: ${story.windowDays}d · events: ${story.events.length}`,
          `Generated: ${story.generatedAt}`,
          '',
          ...(story.events.length
            ? story.events.map((e) => `• [${e.pillar}] ${e.at.slice(0, 10)} · ${e.title}\n  ${e.snippet}`)
            : ['(no events in this window)']),
          '',
          'CLI: zavorth knowledge story --days 7',
        ].join('\n'),
      );
    }
    return 0;
  }

  if (cmd === 'advanced' || cmd === 'file-index' || cmd === 'fileindex' || cmd === 'vault') {
    const advanced = buildLearnedKnowledgeAdvanced({ projectRoot });
    if (wantJson) {
      console.log(JSON.stringify({ ok: true, ...advanced }, null, 2));
    } else {
      console.log(
        [
          'Advanced Knowledge',
          '',
          'File index (Mnemos vault)',
          `  available: ${advanced.fileIndex.available ? 'yes' : 'no'}`,
          `  vault: ${advanced.fileIndex.vaultPath || '(none)'}`,
          `  files: ${advanced.fileIndex.fileCount ?? 'n/a'} · dirs: ${advanced.fileIndex.directoryCount ?? 'n/a'}` +
            (advanced.fileIndex.truncatedScan ? ' · scan capped' : ''),
          `  lastModified: ${advanced.fileIndex.lastModifiedAt || 'n/a'}`,
          `  consent: ${advanced.fileIndex.dockerConsentPath}`,
          `  ${advanced.fileIndex.summary}`,
          `  hint: ${advanced.fileIndex.setupHint}`,
          `  cli: ${advanced.fileIndex.cli}`,
          '',
          'Dream cycle',
          `  available: ${advanced.dreamCycle.available ? 'yes' : 'no'} · previewOnly=${advanced.dreamCycle.previewOnly}`,
          `  lastRun: ${advanced.dreamCycle.lastRunAt || 'never'}` +
            (advanced.dreamCycle.lastStatus ? ` · status=${advanced.dreamCycle.lastStatus}` : '') +
            (typeof advanced.dreamCycle.lastCandidateCount === 'number' ? ` · candidates=${advanced.dreamCycle.lastCandidateCount}`
              : ''),
          `  ${advanced.dreamCycle.summary}`,
          `  cadence: ${advanced.dreamCycle.nextEligibleHint}`,
          `  cli: ${advanced.dreamCycle.cli}`,
          `  slash: ${advanced.dreamCycle.slash}`,
          `  scheduler: ${advanced.dreamCycle.schedulerCli}`,
          '',
          advanced.preferenceSpineNote,
        ].join('\n'),
      );
    }
    return 0;
  }

  if (cmd === 'about' || cmd === 'profile' || cmd === 'me') {
    const userId = process.env.USER || process.env.USERNAME || 'local-user';
    const about = new AboutYouService({ projectRoot });
    const sub = String(rest[0] || 'status').toLowerCase();
    const arg = rest.slice(1).join(' ').trim();

    if (sub === 'status' || sub === 'show' || sub === 'list' || !rest.length) {
      const snap = about.buildSnapshot(userId);
      if (wantJson) {
        console.log(JSON.stringify({ ok: true, ...snap }, null, 2));
      } else {
        console.log(about.formatStatusLines(snap).join('\n'));
      }
      return 0;
    }
    if (sub === 'propose') {
      const body = arg || String(rest.slice(1).join(' '));
      const eq = body.indexOf('=');
      if (eq <= 0) {
        console.error('Usage: zavorth knowledge about propose <key>=<value>');
        return 1;
      }
      const result = about.propose(userId, {
        key: body.slice(0, eq).trim(),
        value: body.slice(eq + 1).trim(),
      });
      console.log(result.text);
      return result.ok ? 0 : 1;
    }
    if (sub === 'approve') {
      if (!arg) {
        console.error('Usage: zavorth knowledge about approve <draft-id>');
        return 1;
      }
      const result = about.approve(userId, arg);
      console.log(result.text);
      return result.ok ? 0 : 1;
    }
    if (sub === 'reject') {
      if (!arg) {
        console.error('Usage: zavorth knowledge about reject <draft-id>');
        return 1;
      }
      const result = about.reject(userId, arg);
      console.log(result.text);
      return result.ok ? 0 : 1;
    }
    if (sub === 'forget' || sub === 'delete') {
      if (!arg) {
        console.error('Usage: zavorth knowledge about forget <id|key>');
        return 1;
      }
      const result = about.forget(userId, arg);
      console.log(result.text);
      return result.ok ? 0 : 1;
    }
    if (sub === 'export') {
      const result = about.exportProfile(userId);
      console.log(result.text);
      return result.ok ? 0 : 1;
    }
    if (sub === 'propose-learning' || sub === 'from-learning') {
      const result = about.proposeFromLearning(userId);
      console.log(result.text);
      return result.ok ? 0 : 1;
    }
    console.error('Usage: zavorth knowledge about [status|propose|approve|reject|forget|export|propose-learning]');
    return 1;
  }

  if (cmd === 'recall' || cmd === 'chat' || cmd === 'sessions') {
    let queryParts = rest;
    if (String(rest[0] || '').toLowerCase() === 'chat') {
      queryParts = rest.slice(1);
    }
    const query = queryParts.join(' ').trim();
    if (!query && !rawArgs.includes('--browse')) {
      console.error('Usage: zavorth knowledge recall <query>  |  --browse');
      return 1;
    }
    const snap = recallConversations({
      query: rawArgs.includes('--browse') ? null : query,
      limit,
      projectRoot,
    });
    if (wantJson) {
      console.log(JSON.stringify({ ok: true, ...snap }, null, 2));
    } else {
      console.log(formatConversationRecallLines(snap).join('\n'));
    }
    return 0;
  }

  if (cmd === 'forget') {
    const { forgetLearnedKnowledge } = await import('../services/learned-knowledge/LearnedKnowledgeSafety.js');
    const pillar = String(rest[0] || '').trim();
    const id = rest.slice(1).join(' ').trim();
    const userId = process.env.USER || process.env.USERNAME || 'local-user';
    const result = forgetLearnedKnowledge({
      pillar,
      id,
      userId,
      projectRoot,
    });
    console.log(result.text);
    return result.ok ? 0 : 1;
  }

  if (cmd === 'tenant' || cmd === 'isolation') {
    const { resolveTenantPathMatrix, assertTenantPathsSafe, tenantStoreExists } = await import(
      '../services/learned-knowledge/LearnedKnowledgeSafety.js'
    );
    const userId = process.env.USER || process.env.USERNAME || 'local-user';
    const matrix = resolveTenantPathMatrix({ userId, projectRoot });
    const check = assertTenantPathsSafe(matrix);
    const exists = tenantStoreExists(matrix);
    if (wantJson) {
      console.log(JSON.stringify({ ok: check.ok, matrix, check, exists }, null, 2));
    } else {
      console.log(
        [
          'Learned knowledge — tenant path matrix',
          `userId: ${matrix.userId}`,
          `projectRoot: ${matrix.projectRoot}`,
          '',
          `workflowsDrafts: ${matrix.paths.workflowsDrafts} (${exists.workflowsDrafts ? 'exists' : 'missing'})`,
          `aboutYou:        ${matrix.paths.aboutYou} (${exists.aboutYou ? 'exists' : 'missing'})`,
          `continuumStore:  ${matrix.paths.continuumStore} (${exists.continuumStore ? 'exists' : 'missing'})`,
          `knowledgeWiki:   ${matrix.paths.knowledgeWiki} (${exists.knowledgeWiki ? 'exists' : 'missing'})`,
          '',
          `isolation ok: ${check.ok}`,
          ...(check.issues.length ? check.issues.map((i) => `  ! ${i}`) : ['  (no issues)']),
          '',
          'Note: continuum + wiki are workspace-scoped; workflows/about-you are per-user.',
        ].join('\n'),
      );
    }
    return check.ok ? 0 : 1;
  }

  if (cmd === 'pack' || cmd === 'compose' || cmd === 'inject') {
    const query = rest.join(' ').trim();
    const userId = process.env.USER || process.env.USERNAME || 'local-user';
    const pack = new LearnedKnowledgePlaneService({ projectRoot }).buildPack({
      userId,
      userMessage: query || null,
      surface: 'cli',
      projectRoot,
      tokenBudget: budget || flags.injectTokenBudget,
    });
    if (wantJson) {
      console.log(JSON.stringify({ ok: true, ...pack }, null, 2));
    } else {
      console.log(
        [
          'Learned knowledge pack',
          `User: ${pack.userId}`,
          `Pillars queried (equal weight, no keyword routing): ${pack.pillarsQueried.join(', ') || '(none)'}`,
          `Hits: ${pack.hits.length} · ranked by store relevance only`,
          `Budget: ~${pack.budget.estimatedTokens}/${pack.budget.tokenBudget} tokens · truncated=${pack.budget.truncated}`,
          '',
          ...pack.hits
            .slice(0, 12)
            .map((h) => `• [${h.pillar}] ${h.title} score=${h.score.toFixed(1)}\n  ${h.snippet.slice(0, 160)}`),
          '',
          pack.injectBlock ? `--- inject ---\n${pack.injectBlock}` : '(no inject block — empty pack or plane disabled)',
        ].join('\n'),
      );
    }
    return 0;
  }

  if (cmd === 'facts' || cmd === 'fact' || cmd === 'wiki' || cmd === 'mnemos') {
    const query = rest.join(' ').trim();
    if (!query) {
      console.error('Usage: zavorth knowledge facts <query>');
      return 1;
    }
    try {
      const result = queryKnowledgeFacts({
        query,
        topK,
        contextTokenBudget: budget,
        projectRoot,
      });
      if (wantJson) {
        console.log(JSON.stringify({ ok: true, ...result }, null, 2));
      } else {
        console.log(formatKnowledgeFactsLines(result).join('\n'));
      }
      return 0;
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error || 'facts query failed');
      console.error(msg);
      console.error('Hint: ensure .zavorth/wiki exists (mnemos ingest) or use recall for chat history.');
      return 1;
    }
  }

  if (cmd === 'consolidate' || cmd === 'dream' || cmd === 'promote-preview') {
    const preview = previewKnowledgeConsolidate({
      projectRoot,
      sessionSummary: rest.join(' ').trim() || null,
    });
    if (wantJson) {
      console.log(JSON.stringify({ ok: true, ...preview }, null, 2));
    } else {
      console.log(
        [
          'Knowledge consolidate — PREVIEW ONLY (no durable write)',
          `Generated: ${preview.generatedAt}`,
          `Dream: ${preview.dream.summary}`,
          `Candidates: ${preview.dream.candidateCount} · quarantine: ${preview.dream.quarantineCount} · actions: ${preview.dream.actionCount}`,
          `Promotion gate: canApply=${preview.promotionGate.canApply} · blockers=${preview.promotionGate.blockers.join(', ')}`,
          preview.promotionGate.note,
          '',
          'Next steps:',
          ...preview.nextSteps.map((s) => ` ? ${s}`),
        ].join('\n'),
      );
    }
    return 0;
  }

  if (cmd === 'workflows' || cmd === 'learn') {
    const { runLearningLoopCli } = await import('./LearningLoopCli.js');
    return runLearningLoopCli(rest.length ? rest : ['home']);
  }

  printHelp();
  return 1;
}
