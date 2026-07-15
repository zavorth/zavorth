/**
 * CLI: zavorth learn | zavorth learning-loop
 * Experience skill learning loop (multi-tool workflow drafts).
 */

import {
  ExperienceSkillLearningLoopService,
  isExperienceSkillLearningLoopEnabled,
  type ExperienceSkillLearningStatusSnapshot,
} from '../services/ExperienceSkillLearningLoopService.js';

function printHelp(): void {
  console.log(
    [
      '=== Zavorth learning loop (skill drafts) ===',
      '',
      'Multi-tool successful turns create reviewable skill drafts (light plane).',
      'Drafts stay local until you promote. Never auto-installs to SkillLoader.',
      'Reuse improves drafts. Optional LLM procedure compact: ZAVORTH_SKILL_LEARN_LLM_COMPACT=1',
      'Disable entirely: ZAVORTH_SKILL_LEARN_LOOP=0',
      '',
      '/learn = skill drafts · /learning = candidates',
      'Candidates plane: zavorth learning · /learning list · /learning approve 1',
      '',
      'Usage:',
      '  zavorth learn                     (home: status + last drafts + tip)',
      '  zavorth learning-loop status [--user <id>] [--json]',
      '  zavorth learning-loop list [--user <id>]',
      '  zavorth learning-loop search <query> [--user <id>]',
      '  zavorth learning-loop show 1 [--user <id>]',
      '  zavorth learning-loop run 1 [--user <id>]',
      '  zavorth learning-loop promote 1 [--user <id>]',
      '  zavorth learning-loop promote 1 --dry-run',
      '  zavorth learning-loop promote 1 --kind skill|plugin|both',
      '  zavorth learning-loop forget 1 [--user <id>]',
      '',
      'Numbers come from `list` (same order as ordinal resolve). Prefer ordinals (1), not long ids.',
      'Promote (skill): SkillIR pack under skills/ + SkillLoader under .agents/skills + audit.',
      'Promote --kind plugin: Plugin OS scaffold under plugins/promoted/ (never auto-enable).',
      'Promote --kind both: skill pack + plugin scaffold; receipt links draft → skill → plugin.',
      'promote --dry-run previews destinations + SKILL.md content without writing.',
      'search ranks local drafts by title/tools/body tokens (cross-draft, user-scoped).',
      'run shows governed procedure only (does not execute tools).',
      'Forget removes the draft only (not promoted-skills or .agents/skills).',
      '',
      'This is the experience-skill-drafts plane (light). Not the /learning candidates plane.',
      '',
      'Chat: /learn list | /learn search <query> | /learn show 1 | /learn run 1 | /learn promote 1 [--dry-run] | /learn forget 1',
      'Smoke: npx tsx scripts/live-learning-loop-smoke.ts',
      'Env: ZAVORTH_SKILL_LEARN_MIN_TOOLS (default 5)',
      'Env: ZAVORTH_SKILL_LEARN_NUDGE_COOLDOWN_MS (default 900000 = 15 min)',
    ].join('\n'),
  );
}

function readUser(args: string[]): string {
  const idx = args.indexOf('--user');
  if (idx >= 0) return String(args[idx + 1] || '').trim() || process.env.USER || process.env.USERNAME || 'local-user';
  return process.env.USER || process.env.USERNAME || 'local-user';
}

function hasDryRunFlag(args: string[]): boolean {
  return args.some((a) => a === '--dry-run' || a === '--dryRun');
}

function readPromoteKind(args: string[]): string {
  const idx = args.findIndex((a) => a === '--kind' || a === '--as');
  if (idx >= 0) return String(args[idx + 1] || '').trim() || 'skill';
  if (args.includes('--plugin')) return 'plugin';
  if (args.includes('--both')) return 'both';
  return 'skill';
}

function formatCooldown(ms: number): string {
  if (ms <= 0) return 'off (0ms)';
  if (ms % 60000 === 0) return `${ms / 60000} min (${ms}ms)`;
  if (ms % 1000 === 0) return `${ms / 1000}s (${ms}ms)`;
  return `${ms}ms`;
}

function shortDraftId(id: string): string {
  return String(id || '').slice(0, 8);
}

function draftRefError(action: string, ref: string, serviceText: string): string {
  const raw = String(ref || '').trim();
  if (/^#?\d{1,2}$/.test(raw)) {
    return `No draft at that number. Run list, then ${action} 1.`;
  }
  if (raw.length > 8) {
    return `Use ${action} 1 (from list), not a long id.`;
  }
  return serviceText || `Use ${action} 1 (from list), not a long id.`;
}

function renderStatus(snap: ExperienceSkillLearningStatusSnapshot): string {
  const topTools = snap.topTools.length ? snap.topTools.map((t) => `${t.tool}(${t.count})`).join(', ') : '(none)';
  const m = snap.metrics || { weekKey: '—', draftsCreated: 0, promotes: 0, reuses: 0 };
  const lines = [
    'Zavorth learning loop',
    '',
    snap.oneLiner,
    snap.planeNote || 'Light loop: multi-tool drafts you promote. Not the preference/spine learning plane.',
    '',
    `User: ${snap.userId}`,
    `Plane: ${snap.plane || 'experience-skill-drafts'} (experience skill drafts)`,
    `Enabled: ${snap.enabled ? 'yes' : 'no (ZAVORTH_SKILL_LEARN_LOOP=0)'}`,
    `Badge: ${snap.badge}`,
    `Drafts: ${snap.drafts} · improved: ${snap.improved} · promoted: ${snap.promoted}`,
    `Weekly metrics (${m.weekKey}): drafts=${m.draftsCreated} · promotes=${m.promotes} · reuses=${m.reuses}`,
    `Top tools: ${topTools}`,
    `Last trigger: ${snap.lastTriggerAt || '(none)'} ${snap.lastTriggerReason ? `(${snap.lastTriggerReason})` : ''}`,
    snap.lastSkillTitle ? `Last skill: ${snap.lastSkillTitle}` : null,
    `Min tools: ${process.env.ZAVORTH_SKILL_LEARN_MIN_TOOLS || process.env.ZAVORTH_LEARNING_LOOP_MIN_TOOLS || 5}`,
    `Nudge cooldown: ${formatCooldown(snap.nudgeCooldownMs ?? 15 * 60 * 1000)} (ZAVORTH_SKILL_LEARN_NUDGE_COOLDOWN_MS)`,
    `LLM compact: ${/^(1|true|yes|on)$/i.test(String(process.env.ZAVORTH_SKILL_LEARN_LLM_COMPACT || '')) ? 'on' : 'off'}`,
    '',
  ].filter(Boolean) as string[];

  if (snap.latest.length === 0) {
    lines.push('Latest: (none yet — complete a multi-tool chat task)');
  } else {
    lines.push('Latest drafts:');
    for (const [i, d] of snap.latest.entries()) {
      const shortId = shortDraftId(d.id);
      lines.push(`  ${i + 1}. ${d.title}${shortId ? ` · ${shortId}` : ''} uses=${d.useCount} rev=${d.revisions}`);
    }
  }
  lines.push(
    '',
    'Tip: list · search <query> · show 1 · run 1 · promote 1 --dry-run · promote 1 · forget 1',
    'Docs: docs/product/experience-skill-learning-loop.md',
  );
  return lines.join('\n');
}

export async function runLearningLoopCli(rawArgs: string[] = []): Promise<number> {
  if (rawArgs.includes('--help') || rawArgs.includes('-h')) {
    printHelp();
    return 0;
  }

  const wantJson = rawArgs.includes('--json');
  const dryRun = hasDryRunFlag(rawArgs);
  const positional = rawArgs.filter((a, i) => {
    if (
      a === '--user' ||
      a === '--json' ||
      a === '--dry-run' ||
      a === '--dryRun' ||
      a === '--kind' ||
      a === '--as' ||
      a === '--plugin' ||
      a === '--both'
    ) {
      return false;
    }
    if (rawArgs[i - 1] === '--user' || rawArgs[i - 1] === '--kind' || rawArgs[i - 1] === '--as') return false;
    return !a.startsWith('--');
  });
  const cmd = String(positional[0] || 'home').toLowerCase();
  const id = String(positional[1] || '').trim();
  const userId = readUser(rawArgs);
  const loop = new ExperienceSkillLearningLoopService({ projectRoot: process.cwd() });

  if (cmd === 'home' || cmd === 'status' || cmd === '') {
    const snap = loop.buildStatusSnapshot(userId);
    if (wantJson) {
      console.log(JSON.stringify({ ok: true, ...snap, loopEnabled: isExperienceSkillLearningLoopEnabled() }, null, 2));
    } else {
      console.log(renderStatus(snap));
    }
    return 0;
  }

  if (cmd === 'list') {
    // Same default sort as ordinal resolve (listDrafts score, then updatedAt).
    const drafts = loop.listDrafts(userId, 50);
    if (drafts.length === 0) {
      console.log('No experience skill drafts yet.');
      return 0;
    }
    for (const [i, d] of drafts.entries()) {
      const shortId = shortDraftId(d.id);
      console.log(
        `${i + 1}. ${d.title}\n   uses=${d.useCount} rev=${d.revisions || 0}${shortId ? ` · ${shortId}` : ''} · tools=${d.tools.join(',') || 'n/a'} · ${d.updatedAt || d.createdAt}`,
      );
    }
    console.log('');
    console.log('Tip: promote 1 · forget 1 · show 1');
    return 0;
  }

  if (cmd === 'search') {
    const query = positional.slice(1).join(' ').trim();
    const hits = loop.searchDrafts(userId, query, 20);
    if (wantJson) {
      console.log(JSON.stringify({ ok: true, query, count: hits.length, hits }, null, 2));
      return 0;
    }
    if (hits.length === 0) {
      console.log(query ? `No drafts matching "${query}".` : 'No experience skill drafts yet.');
      return 0;
    }
    console.log(query ? `Search results for "${query}" (${hits.length}):` : `Drafts (${hits.length}):`);
    for (const [i, d] of hits.entries()) {
      const shortId = shortDraftId(d.id);
      const snip = d.snippet ? `\n   ${d.snippet}` : '';
      console.log(
        `${i + 1}. ${d.title}\n   score=${Number(d.searchScore || 0).toFixed(1)}${shortId ? ` · ${shortId}` : ''} · tools=${d.tools.join(',') || 'n/a'}${snip}`,
      );
    }
    console.log('');
    console.log('Tip: promote 1 · forget 1 · show 1 (list numbers; use list for ordinals)');
    return 0;
  }

  if (cmd === 'show') {
    if (!id) {
      console.error('Usage: zavorth learning-loop show 1');
      return 1;
    }
    const shown = loop.showDraft(userId, id);
    if (!shown.ok) {
      console.error(draftRefError('show', id, shown.text));
      return 1;
    }
    console.log(shown.text);
    return 0;
  }

  if (cmd === 'run') {
    if (!id) {
      console.error('Usage: zavorth learning-loop run 1');
      return 1;
    }
    const result = loop.runSkill(userId, id);
    if (!result.ok) {
      console.error(draftRefError('run', id, result.text));
      return 1;
    }
    console.log(result.text);
    return 0;
  }

  if (cmd === 'promote' || cmd === 'promote-preview') {
    if (!id) {
      console.error('Usage: zavorth learning-loop promote 1 [--dry-run] [--kind skill|plugin|both]');
      return 1;
    }
    const wantPreview = dryRun || cmd === 'promote-preview';
    const kind = readPromoteKind(rawArgs);
    const result = wantPreview ? loop.promote(userId, id, { dryRun: true, kind }) : loop.promote(userId, id, { kind });
    if (!result.ok) {
      console.error(draftRefError('promote', id, result.text));
      return 1;
    }
    console.log(result.text);
    if (result.ok && !result.dryRun) {
      if (result.kind) console.log(`kind: ${result.kind}`);
      if (result.skillName) console.log(`skillName: ${result.skillName}`);
      if (result.skillId) console.log(`skillId: ${result.skillId}`);
      if (result.skillPath) console.log(`skillPath: ${result.skillPath}`);
      if (result.runtimeSkillPath) console.log(`runtimeSkillPath: ${result.runtimeSkillPath}`);
      if (result.pluginId) console.log(`pluginId: ${result.pluginId}`);
      if (result.pluginPath) console.log(`pluginPath: ${result.pluginPath}`);
      if (result.skillIrDigest) console.log(`skillIrDigest: ${result.skillIrDigest}`);
      if (result.receiptPath) console.log(`receiptPath: ${result.receiptPath}`);
      if (typeof result.loaderReady === 'boolean') console.log(`loaderReady: ${result.loaderReady}`);
      if (typeof result.pluginReady === 'boolean') console.log(`pluginReady: ${result.pluginReady}`);
    } else if (result.ok && result.dryRun) {
      if (result.kind) console.log(`kind: ${result.kind}`);
      if (result.skillName) console.log(`skillName: ${result.skillName}`);
      if (result.auditDest) console.log(`auditDest: ${result.auditDest}`);
      if (result.runtimeSkillPath) console.log(`runtimeSkillPath: ${result.runtimeSkillPath}`);
      if (result.pluginPath) console.log(`pluginPath: ${result.pluginPath}`);
    }
    return 0;
  }

  if (cmd === 'forget') {
    if (!id) {
      console.error('Usage: zavorth learning-loop forget 1');
      return 1;
    }
    const result = loop.forget(userId, id);
    if (!result.ok) {
      console.error(draftRefError('forget', id, result.text));
      return 1;
    }
    console.log(result.text);
    if (result.ok && result.removedPath) {
      console.log(`removedPath: ${result.removedPath}`);
    }
    return 0;
  }

  if (cmd === 'help') {
    printHelp();
    return 0;
  }

  printHelp();
  return 1;
}
