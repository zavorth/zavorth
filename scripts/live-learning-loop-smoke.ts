/**
 * Smoke: experience skill learning loop (create → improve → list → promote).
 *
 *   npx tsx scripts/live-learning-loop-smoke.ts
 *
 * Does not call live LLM unless ZAVORTH_SKILL_LEARN_LLM_COMPACT=1 and keys exist.
 * Exit 0 on success.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  ExperienceSkillLearningLoopService,
  isExperienceSkillLearningLoopEnabled,
} from '../src/services/ExperienceSkillLearningLoopService.js';

async function main(): Promise<void> {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-learn-smoke-'));
  console.log('=== live-learning-loop-smoke ===');
  console.log('temp root:', root);
  console.log('loop enabled:', isExperienceSkillLearningLoopEnabled());

  if (!isExperienceSkillLearningLoopEnabled()) {
    console.log('PASS (skipped): ZAVORTH_SKILL_LEARN_LOOP is disabled');
    fs.rmSync(root, { recursive: true, force: true });
    process.exit(0);
  }

  const loop = new ExperienceSkillLearningLoopService({ projectRoot: root });
  const userId = `smoke-${Date.now()}`;
  const tools = ['web_search', 'read_file', 'list_dir', 'get_datetime', 'web_search'];
  const goal = 'Research release checklist and list repository files carefully';

  const created = await loop.processTurn({
    userId,
    surface: 'cli',
    userMessage: goal,
    assistantText: 'Checklist found; files listed.',
    toolsCalled: tools,
    minToolCalls: 5,
    llmCompact: false,
  });
  if (!created.triggered || !created.skillDraftId) {
    console.error('FAIL: expected skill draft creation', created);
    process.exit(2);
  }
  console.log('created:', created.skillDraftId, created.reason);

  const improved = await loop.processTurn({
    userId,
    surface: 'cli',
    userMessage: goal,
    assistantText: 'Added discovery pass.',
    toolsCalled: [...tools, 'capability_discovery'],
    minToolCalls: 5,
    llmCompact: false,
  });
  if (!improved.triggered || !improved.improved) {
    console.error('FAIL: expected improve on reuse', improved);
    process.exit(3);
  }
  console.log('improved:', improved.reason);

  const listed = loop.listDrafts(userId, 10);
  if (listed.length < 1 || !listed[0].tools.includes('capability_discovery')) {
    console.error('FAIL: list missing improved tools', listed);
    process.exit(4);
  }
  console.log('list:', listed.map((d) => `${d.id} uses=${d.useCount} rev=${d.revisions}`).join('; '));

  const inject = loop.formatInjectBlock(userId, 3, { userMessage: goal, fullProcedureTopK: 2 });
  if (!/Learned workflow drafts/i.test(inject)) {
    console.error('FAIL: inject block empty');
    process.exit(5);
  }
  if (!/Procedure \(runtime recall\)/i.test(inject) && !/Prefer tools/i.test(inject)) {
    console.error('FAIL: inject missing procedure for similar goal', inject.slice(0, 500));
    process.exit(5);
  }
  console.log('inject: ok (similar goal includes procedure)');

  const promoted = loop.promote(userId, String(created.skillDraftId));
  if (!promoted.ok || !promoted.promotedPath || !fs.existsSync(promoted.promotedPath)) {
    console.error('FAIL: promote', promoted);
    process.exit(6);
  }
  console.log('promoted:', promoted.promotedPath);
  if (promoted.runtimeSkillPath) {
    const manifestPath = path.join(promoted.runtimeSkillPath, 'manifest.json');
    if (!fs.existsSync(manifestPath)) {
      console.error('FAIL: missing manifest.json after promote');
      process.exit(6);
    }
    console.log('manifest: ok');
  }

  const run = loop.runSkill(userId, String(created.skillDraftId));
  if (!run.ok || !/Governed procedure only/i.test(run.text)) {
    console.error('FAIL: runSkill', run);
    process.exit(8);
  }
  console.log('runSkill: ok');

  const status = loop.buildStatusSnapshot(userId);
  if (!status.metrics?.weekKey || status.metrics.draftsCreated < 1) {
    console.error('FAIL: weekly metrics', status.metrics);
    process.exit(9);
  }
  console.log('weekly metrics:', status.metrics);

  // Disabled flag must short-circuit
  process.env.ZAVORTH_SKILL_LEARN_LOOP = '0';
  const disabled = await loop.processTurn({
    userId,
    userMessage: goal,
    assistantText: 'x',
    toolsCalled: tools,
    minToolCalls: 5,
  });
  if (disabled.reason !== 'learning_loop_disabled') {
    console.error('FAIL: expected learning_loop_disabled', disabled);
    process.exit(7);
  }
  delete process.env.ZAVORTH_SKILL_LEARN_LOOP;

  fs.rmSync(root, { recursive: true, force: true });
  console.log('PASS: experience skill learning loop smoke ok');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
