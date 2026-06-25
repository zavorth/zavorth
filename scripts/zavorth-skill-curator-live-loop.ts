#!/usr/bin/env node

import { ZavorthSkillCuratorLiveLoopService } from '@zavorth/skills/ZavorthSkillCuratorLiveLoopService.js';
import { SkillCuratorPlaneService } from '../src/skills/SkillCuratorPlaneService.js';

const args = process.argv.slice(2);
const planeCommands = new Set(['status', 'run', 'pause', 'resume', 'pin', 'unpin', 'restore']);

void main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});

async function main(): Promise<void> {
  if (planeCommands.has(String(args[0] || '').toLowerCase())) {
    await runCuratorPlane(args);
    return;
  }

  const service = new ZavorthSkillCuratorLiveLoopService();
  const snapshot = service.buildSnapshot({
    apply: args.includes('--apply'),
    approvalId: readFlag(args, 'approval-id'),
    usePersistentApproval: args.includes('--use-persistent-approval') || args.includes('--auto-approve-if-policy'),
    includeImported: !args.includes('--no-imported'),
    includeWorkspace: !args.includes('--no-workspace'),
    maxSkills: Number(readFlag(args, 'max-skills') || 0) || undefined,
    proposalIds: readRepeatedFlag(args, 'proposal'),
    applySafeMetadata: args.includes('--apply-safe-metadata'),
  });

  if (args.includes('--json')) {
    process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
  } else {
    process.stdout.write(service.renderText(snapshot));
    process.stdout.write('\nLifecycle plane: use `zavorth skill-curator status` or `zavorth skills curator status`.\n');
  }

  if (args.includes('--require-pass') && snapshot.status === 'blocked') {
    process.exitCode = 1;
  }
  if (args.includes('--apply') && !snapshot.apply.applied) {
    process.exitCode = 1;
  }
}

async function runCuratorPlane(argv: string[]): Promise<void> {
  const command = String(argv[0] || 'status').toLowerCase();
  const service = new SkillCuratorPlaneService();

  if (command === 'status') {
    const status = await service.status();
    printPlaneResult(argv, status, [
      `Zavorth skill curator plane`,
      `State: ${status.enabled ? 'enabled' : 'disabled'}${status.paused ? ' / paused' : ''}`,
      `Managed: ${status.stats.managed} | stale: ${status.stats.stale} | archived: ${status.stats.archived} | pinned: ${status.stats.pinned}`,
      `Last run: ${status.lastRunAt || 'never'}`,
      `Next run: ${status.nextRunAt || 'not scheduled yet'}`,
      `Report: ${status.lastReportPath || 'none'}`,
    ]);
    return;
  }

  if (command === 'run') {
    const report = await service.runCuratorReview({
      dryRun: argv.includes('--dry-run'),
      llmReview: argv.includes('--llm-review') || argv.includes('--ai-review'),
      reason: argv.includes('--dry-run') ? 'cli-dry-run' : 'cli-run',
      triggeredBy: 'cli:skill-curator',
    });
    printPlaneResult(argv, report, [
      report.summary,
      `Transitions: ${report.transitions.length}`,
      `Consolidation candidates: ${report.auxiliaryReview.consolidationCandidates.length}`,
      `LLM review: ${report.llmReview.status}`,
      report.dryRun ? 'Dry-run only.' : 'Applied safe lifecycle transitions.',
    ]);
    return;
  }

  if (command === 'pause') {
    const state = await service.pause();
    printPlaneResult(argv, state, ['Curator plane paused.']);
    return;
  }

  if (command === 'resume') {
    const state = await service.resume();
    printPlaneResult(argv, state, ['Curator plane resumed.']);
    return;
  }

  const skillId = String(argv[1] || readFlag(argv, 'id') || '').trim();
  if (!skillId) {
    process.stderr.write(`Missing skill id for ${command}.\n`);
    process.exitCode = 1;
    return;
  }

  if (command === 'pin' || command === 'unpin') {
    await service.togglePin(skillId, command === 'pin');
    printPlaneResult(argv, { skillId, pinned: command === 'pin' }, [`${command === 'pin' ? 'Pinned' : 'Unpinned'} ${skillId}.`]);
    return;
  }

  if (command === 'restore') {
    await service.restoreSkill(skillId);
    printPlaneResult(argv, { skillId }, [`Restored ${skillId}.`]);
  }
}

function printPlaneResult(argv: string[], data: unknown, lines: string[]): void {
  if (argv.includes('--json')) {
    process.stdout.write(`${JSON.stringify(data, null, 2)}\n`);
    return;
  }
  process.stdout.write(`${lines.join('\n')}\n`);
}

function readFlag(argv: string[], name: string): string | null {
  const prefix = `--${name}=`;
  const inline = argv.find((arg) => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = argv.indexOf(`--${name}`);
  return index >= 0 && argv[index + 1] ? argv[index + 1] : null;
}

function readRepeatedFlag(argv: string[], name: string): string[] {
  const values: string[] = [];
  const prefix = `--${name}=`;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg.startsWith(prefix)) {
      values.push(arg.slice(prefix.length));
      continue;
    }
    if (arg === `--${name}` && argv[index + 1]) {
      values.push(argv[index + 1]);
      index += 1;
    }
  }
  return values;
}
