#!/usr/bin/env node

import { ZavorthSkillCuratorLiveLoopService } from '../src/services/ZavorthSkillCuratorLiveLoopService.js';

const args = process.argv.slice(2);
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
}

if (args.includes('--require-pass') && snapshot.status === 'blocked') {
  process.exitCode = 1;
}
if (args.includes('--apply') && !snapshot.apply.applied) {
  process.exitCode = 1;
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
