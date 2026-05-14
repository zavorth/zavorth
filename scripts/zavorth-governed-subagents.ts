#!/usr/bin/env tsx
import { ZavorthGovernedSubagentService } from '../src/services/ZavorthGovernedSubagentService.js';

type Args = {
  json: boolean;
  presetId: string | null;
  task: string | null;
  roleIds: string[];
  prepare: boolean;
  maxRoles: number | null;
  securityProfile: string | null;
};

const args = parseArgs(process.argv.slice(2));
const service = new ZavorthGovernedSubagentService();
const snapshot = service.buildSnapshot({
  presetId: args.presetId,
  task: args.task,
  roleIds: args.roleIds,
  prepare: args.prepare,
  maxRoles: args.maxRoles,
  securityProfile: args.securityProfile,
});

if (args.json) {
  console.log(JSON.stringify(snapshot, null, 2));
} else {
  console.log(service.formatSnapshotText(snapshot));
}

if (snapshot.status === 'blocked') {
  process.exitCode = 1;
}

function parseArgs(argv: string[]): Args {
  const out: Args = {
    json: false,
    presetId: null,
    task: null,
    roleIds: [],
    prepare: true,
    maxRoles: null,
    securityProfile: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index] || '';
    if (arg === '--json') {
      out.json = true;
      continue;
    }
    if (arg === '--prepare') {
      out.prepare = true;
      continue;
    }
    if (arg === '--catalog-only') {
      out.prepare = false;
      continue;
    }
    if (arg === '--preset') {
      out.presetId = argv[index + 1] || null;
      index += 1;
      continue;
    }
    if (arg.startsWith('--preset=')) {
      out.presetId = arg.slice('--preset='.length);
      continue;
    }
    if (arg === '--task') {
      out.task = argv[index + 1] || null;
      index += 1;
      continue;
    }
    if (arg.startsWith('--task=')) {
      out.task = arg.slice('--task='.length);
      continue;
    }
    if (arg === '--role' || arg === '--roles') {
      out.roleIds.push(...splitCsv(argv[index + 1] || ''));
      index += 1;
      continue;
    }
    if (arg.startsWith('--role=')) {
      out.roleIds.push(...splitCsv(arg.slice('--role='.length)));
      continue;
    }
    if (arg.startsWith('--roles=')) {
      out.roleIds.push(...splitCsv(arg.slice('--roles='.length)));
      continue;
    }
    if (arg === '--max-roles') {
      out.maxRoles = Number(argv[index + 1] || 0);
      index += 1;
      continue;
    }
    if (arg.startsWith('--max-roles=')) {
      out.maxRoles = Number(arg.slice('--max-roles='.length));
      continue;
    }
    if (arg === '--security-profile') {
      out.securityProfile = argv[index + 1] || null;
      index += 1;
      continue;
    }
    if (arg.startsWith('--security-profile=')) {
      out.securityProfile = arg.slice('--security-profile='.length);
    }
  }

  return out;
}

function splitCsv(value: string): string[] {
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}
