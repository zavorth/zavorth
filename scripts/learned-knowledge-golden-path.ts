/**
 * Package B — Learned Knowledge Plane golden path (hermetic, no network).
 *
 * Proves in ~1–2 minutes (not 10 of wall-clock tooling):
 *   multi-tool turn → Workflow draft
 *   → continuum capture
 *   → About-you draft
 *   → pack inject (equal pillars, store scores)
 *   → story timeline events
 *   → hub (storyPreview.events + advanced)
 *   → dream consolidate preview (last-run receipt)
 *   → forget workflow draft
 *   → free-text purity / no keyword intent
 *
 *   npm run knowledge:golden-path
 *   npx tsx scripts/learned-knowledge-golden-path.ts [--json] [--keep]
 *
 * Exit 0 on success. Uses OS temp dir (deleted unless --keep).
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  AboutYouService,
  buildLearnedKnowledgeAdvanced,
  buildLearnedKnowledgeHub,
  buildLearnedKnowledgeStory,
  captureConversationTurn,
  equalPillarWeights,
  forgetLearnedKnowledge,
  LearnedKnowledgePlaneService,
  previewKnowledgeConsolidate,
  readDreamLastPreview,
  resetConversationContinuumCache,
  scoreLearnedKnowledgeIntent,
  wrapUntrustedLearnedKnowledge,
} from '../src/services/learned-knowledge/index.js';
import { ExperienceSkillLearningLoopService } from '../src/services/ExperienceSkillLearningLoopService.js';
import { UserExperienceIntentRouter } from '../src/services/UserExperienceIntentRouter.js';

type Step = { name: string; ok: boolean; detail: string; ms: number };

const wantJson = process.argv.includes('--json');
const keep = process.argv.includes('--keep');
const steps: Step[] = [];
const startedAt = Date.now();

function record(name: string, ok: boolean, detail: string, t0: number): void {
  const ms = Date.now() - t0;
  steps.push({ name, ok, detail, ms });
  if (!wantJson) {
    console.log(`${ok ? '[pass]' : '[fail]'} ${name}${detail ? ` — ${detail}` : ''} (${ms}ms)`);
  }
}

function fail(name: string, detail: string, t0: number, root?: string): never {
  record(name, false, detail, t0);
  finish(1, root);
  throw new Error('unreachable');
}

function finish(code: number, root?: string): void {
  const durationMs = Date.now() - startedAt;
  const ok = code === 0 && steps.every((s) => s.ok);
  const report = {
    ok,
    plane: 'learned-knowledge',
    package: 'B',
    hermetic: true,
    network: false,
    claimsLiveIntelligence: false,
    durationMs,
    // Never persist absolute temp paths in the last-run report (host leak).
    root: keep && root ? root : root ? '(ephemeral-temp)' : null,
    steps,
    nextManual: [
      'zavorth knowledge status',
      'zavorth knowledge story',
      'zavorth knowledge advanced',
      'Control/Desktop: Learned knowledge hub (This week + Advanced)',
    ],
    docs: [
      'docs/product/learned-knowledge-first-use.md',
      'docs/product/learned-knowledge-plane.md',
      'docs/product/demo-scripts.md#script-d--learned-knowledge-10-minutes',
    ],
  };

  if (wantJson) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log('');
    console.log(ok ? 'Learned Knowledge golden path: PASS' : 'Learned Knowledge golden path: FAIL');
    console.log(`Duration: ${durationMs}ms · steps: ${steps.filter((s) => s.ok).length}/${steps.length}`);
    if (ok) {
      console.log('Docs: docs/product/learned-knowledge-first-use.md');
      console.log('Manual demo: docs/product/demo-scripts.md (Script D)');
    }
  }

  if (root && !keep) {
    try {
      fs.rmSync(root, { recursive: true, force: true });
    } catch {
      // ignore cleanup
    }
  } else if (root && keep && !wantJson) {
    console.log('Kept temp root:', root);
  }

  // Best-effort last report under .zavorth when repo is writable
  try {
    const reportDir = path.join(process.cwd(), '.zavorth');
    if (fs.existsSync(reportDir) || fs.existsSync(path.join(process.cwd(), 'package.json'))) {
      fs.mkdirSync(reportDir, { recursive: true });
      fs.writeFileSync(
        path.join(reportDir, 'learned-knowledge-golden-path-last.json'),
        `${JSON.stringify(report, null, 2)}\n`,
        'utf8',
      );
    }
  } catch {
    // optional
  }

  process.exit(ok ? 0 : 1);
}

async function main(): Promise<void> {
  if (!wantJson) {
    console.log('=== Learned Knowledge golden path (Package B, hermetic) ===');
  }

  // Isolated env for hermetic run
  process.env.ZAVORTH_LEARNED_KNOWLEDGE = '1';
  process.env.ZAVORTH_CONTINUUM_CAPTURE = '1';
  process.env.ZAVORTH_USER_MODEL = '1';
  process.env.ZAVORTH_SKILL_LEARN_LOOP = '1';
  process.env.ZAVORTH_SKILL_LEARN_MIN_TOOLS = '3';
  process.env.ZAVORTH_SKILL_LEARN_LLM_COMPACT = '0';

  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-lk-golden-'));
  const runtimeDir = path.join(root, 'data', 'runtime');
  fs.mkdirSync(runtimeDir, { recursive: true });
  resetConversationContinuumCache();

  const userId = 'golden-path-user';
  const goal = 'How do I run the release checklist and list repository files step by step...';

  // --- 1. Workflow draft from multi-tool success ---
  let t0 = Date.now();
  const loop = new ExperienceSkillLearningLoopService({ projectRoot: root });
  const turn = await loop.processTurn({
    userId,
    userMessage: goal,
    assistantText: 'Completed multi-tool release checklist walkthrough.',
    toolsCalled: ['read_file', 'list_directory', 'run_command', 'search_code'],
    toolCallCount: 4,
    outcome: 'success',
    surface: 'cli',
    minToolCalls: 3,
    llmCompact: false,
  });
  if (!turn.triggered || !turn.skillDraftId) {
    fail('workflow-draft', `expected draft; got ${JSON.stringify(turn)}`, t0, root);
  }
  const draftId = String(turn.skillDraftId);
  record('workflow-draft', true, `id=${draftId}`, t0);

  // --- 2. Conversation continuum capture ---
  t0 = Date.now();
  captureConversationTurn({
    userMessage: 'Discussed staging provider mesh checklist for this release',
    assistantMessage: 'Use the mesh checklist and verify keys carefully.',
    sessionId: 'golden-sess-1',
    userId,
    surface: 'cli',
    projectRoot: root,
    runtimeDir,
    source: 'golden-path',
  });
  record('continuum-capture', true, 'session golden-sess-1', t0);

  // --- 3. About you draft ---
  t0 = Date.now();
  const about = new AboutYouService({ projectRoot: root });
  const proposed = about.propose(userId, {
    key: 'preferred_style',
    value: 'short-technical',
    confidence: 0.8,
  });
  if (!proposed.ok) {
    fail('about-you-propose', proposed.text, t0, root);
  }
  record('about-you-propose', true, proposed.draft?.id || 'draft-ok', t0);

  // --- 4. Wiki index (knowledge pillar ready) ---
  t0 = Date.now();
  const wikiDir = path.join(root, '.zavorth', 'wiki');
  fs.mkdirSync(wikiDir, { recursive: true });
  fs.writeFileSync(
    path.join(wikiDir, 'index.json'),
    JSON.stringify(
      {
        pages: [
          {
            id: 'release-checklist',
            title: 'Release checklist',
            path: 'pages/release-checklist.md',
            updatedAt: new Date().toISOString(),
          },
        ],
        edges: [],
      },
      null,
      2,
    ),
    'utf8',
  );
  record('wiki-index', true, '.zavorth/wiki/index.json', t0);

  // --- 5. Pack inject (equal pillars + store rank) ---
  t0 = Date.now();
  const plane = new LearnedKnowledgePlaneService({ projectRoot: root });
  const pack = plane.buildPack({
    userId,
    userMessage: goal,
    projectRoot: root,
    runtimeDir,
    tokenBudget: 1500,
  });
  if (pack.safety.noKeywordIntentRouting !== true) {
    fail('pack-inject', 'missing noKeywordIntentRouting', t0, root);
  }
  if (pack.pillarsQueried.length < 4) {
    fail('pack-inject', `expected 4 pillars, got ${pack.pillarsQueried.join(',')}`, t0, root);
  }
  const weights = equalPillarWeights();
  const scored = scoreLearnedKnowledgeIntent('what did we discuss about providers last time...');
  if (JSON.stringify(scored) !== JSON.stringify(weights)) {
    fail('pack-inject', 'scoreLearnedKnowledgeIntent still keyword-skews pillars', t0, root);
  }
  if (pack.hits.length < 1) {
    fail('pack-inject', 'expected at least one hit from drafted knowledge', t0, root);
  }
  const inject = pack.injectBlock || '';
  if (inject && !/untrusted-learned-knowledge|Learned knowledge pack|store relevance only/i.test(inject)) {
    // still ok if empty wrap path — require wrap helper
    const wrapped = wrapUntrustedLearnedKnowledge(inject || 'sample');
    if (!/untrusted-learned-knowledge/i.test(wrapped)) {
      fail('pack-inject', 'untrusted wrap missing', t0, root);
    }
  }
  if (inject) {
    const wrapped = wrapUntrustedLearnedKnowledge(inject);
    if (!/untrusted-learned-knowledge/i.test(wrapped)) {
      fail('pack-inject', 'wrapUntrustedLearnedKnowledge failed', t0, root);
    }
  }
  record(
    'pack-inject',
    true,
    `hits=${pack.hits.length} pillars=${pack.pillarsQueried.length} tokens~${pack.budget.estimatedTokens}`,
    t0,
  );

  // --- 6. Story timeline ---
  t0 = Date.now();
  const story = buildLearnedKnowledgeStory({
    userId,
    projectRoot: root,
    windowDays: 7,
    limit: 24,
  });
  if (!story.ok || story.events.length < 1) {
    fail('story-timeline', `expected events, got ${story.events.length}: ${story.summary}`, t0, root);
  }
  const pillarsSeen = new Set(story.events.map((e) => e.pillar));
  if (!pillarsSeen.has('workflows') && !pillarsSeen.has('conversation') && !pillarsSeen.has('about-you')) {
    fail('story-timeline', `no expected pillars in ${[...pillarsSeen].join(',')}`, t0, root);
  }
  record('story-timeline', true, story.summary, t0);

  // --- 7. Hub Package A fields ---
  t0 = Date.now();
  const hub = buildLearnedKnowledgeHub({ userId, projectRoot: root });
  if (hub.cards.length !== 4) {
    fail('hub-snapshot', `expected 4 cards, got ${hub.cards.length}`, t0, root);
  }
  if (!hub.storyPreview?.events || hub.storyPreview.events.length < 1) {
    fail('hub-snapshot', 'storyPreview.events missing', t0, root);
  }
  if (!hub.advanced?.dreamCycle?.previewOnly) {
    fail('hub-snapshot', 'advanced.dreamCycle missing', t0, root);
  }
  record(
    'hub-snapshot',
    true,
    `storyEvents=${hub.storyPreview.eventCount} vault=${hub.advanced?.fileIndex.available ? 'yes' : 'no'}`,
    t0,
  );

  // --- 8. Dream consolidate preview + last-run receipt ---
  t0 = Date.now();
  const preview = previewKnowledgeConsolidate({
    projectRoot: root,
    sessionSummary: 'Golden path consolidate preview for release checklist',
  });
  if (preview.mode !== 'preview-only' || preview.durableMutation !== false) {
    fail('dream-preview', 'must stay preview-only', t0, root);
  }
  const last = readDreamLastPreview(root);
  if (!last || last.mode !== 'preview') {
    fail('dream-preview', 'last-run receipt not written', t0, root);
  }
  const advancedAfter = buildLearnedKnowledgeAdvanced({ projectRoot: root });
  if (!advancedAfter.dreamCycle.lastRunAt) {
    fail('dream-preview', 'advanced lastRunAt empty after consolidate', t0, root);
  }
  record(
    'dream-preview',
    true,
    `candidates=${preview.dream.candidateCount} lastRun=${advancedAfter.dreamCycle.lastRunAt}`,
    t0,
  );

  // --- 9. Forget workflow draft ---
  t0 = Date.now();
  const forgotten = forgetLearnedKnowledge({
    pillar: 'workflows',
    id: draftId,
    userId,
    projectRoot: root,
  });
  if (!forgotten.ok) {
    fail('forget-workflow', forgotten.text, t0, root);
  }
  const remaining = loop.listDrafts(userId, 20);
  if (remaining.some((d) => d.id === draftId)) {
    fail('forget-workflow', 'draft still listed after forget', t0, root);
  }
  record('forget-workflow', true, forgotten.text.slice(0, 120), t0);

  // --- 10. Free-text purity (UX router) ---
  t0 = Date.now();
  const ux = new UserExperienceIntentRouter();
  const phrases = [
    'summarize o estado e o link do PR',
    'compile uma equipe de agentes swarm',
    'promote this skill and forget the draft',
  ];
  for (const text of phrases) {
    const d = ux.decide({ text });
    if (d.kind !== 'answer' || d.confidence !== 'low' || d.explicitAction) {
      fail('free-text-purity', `keyword-routed: ${text} → ${d.kind}/${d.confidence}`, t0, root);
    }
  }
  record('free-text-purity', true, `${phrases.length} phrases model-owned`, t0);

  // --- 11. Optional vault metrics path ---
  t0 = Date.now();
  const vault = path.join(root, 'data', 'mnemos_vault');
  fs.mkdirSync(vault, { recursive: true });
  fs.writeFileSync(path.join(vault, 'demo-note.txt'), 'golden path vault note', 'utf8');
  const advancedVault = buildLearnedKnowledgeAdvanced({ projectRoot: root });
  if (!advancedVault.fileIndex.available || (advancedVault.fileIndex.fileCount ?? 0) < 1) {
    fail('vault-metrics', 'expected vault file metrics', t0, root);
  }
  if (
    String(advancedVault.fileIndex.vaultPath || '').match(/^[A-Za-z]:\\/) ||
    String(advancedVault.fileIndex.vaultPath || '').startsWith('/Users/') ||
    String(advancedVault.fileIndex.vaultPath || '').startsWith('/home/')
  ) {
    fail('vault-metrics', `absolute vault path leaked: ${advancedVault.fileIndex.vaultPath}`, t0, root);
  }
  record(
    'vault-metrics',
    true,
    `files=${advancedVault.fileIndex.fileCount} path=${advancedVault.fileIndex.vaultPath}`,
    t0,
  );

  finish(0, root);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
