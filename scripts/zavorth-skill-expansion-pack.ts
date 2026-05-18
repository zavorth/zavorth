#!/usr/bin/env node

import path from 'node:path';

import { ZavorthSkillExpansionPackService } from '../src/services/ZavorthSkillExpansionPackService.js';

type CliOptions = {
  sourceRoot: string | null;
  targetRoot: string | null;
  apply: boolean;
  approvalId: string | null;
  includeCore: boolean;
  includeOptional: boolean;
  overwrite: boolean;
  maxCandidates: number | null;
  json: boolean;
  requirePass: boolean;
  strict: boolean;
};

const options = parseArgs(process.argv.slice(2));
const service = new ZavorthSkillExpansionPackService();
const snapshot = service.buildSnapshot({
  sourceRoot: options.sourceRoot,
  targetRoot: options.targetRoot,
  apply: options.apply,
  approvalId: options.approvalId,
  includeCore: options.includeCore,
  includeOptional: options.includeOptional,
  overwrite: options.overwrite,
  maxCandidates: options.maxCandidates,
});

if (options.json) {
  process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
} else {
  process.stdout.write(service.renderText(snapshot));
}

if (options.apply && !snapshot.apply.applied) {
  process.exitCode = 1;
} else if (options.strict && !['ready', 'applied'].includes(snapshot.status)) {
  process.exitCode = 1;
} else if (options.requirePass && snapshot.status === 'blocked') {
  process.exitCode = 1;
}

function parseArgs(argv: string[]): CliOptions {
  const out: CliOptions = {
    sourceRoot: null,
    targetRoot: null,
    apply: false,
    approvalId: null,
    includeCore: true,
    includeOptional: true,
    overwrite: false,
    maxCandidates: null,
    json: false,
    requirePass: false,
    strict: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index] || '';
    if (arg === '--source' || arg === '--source-root') out.sourceRoot = resolveArg(argv[++index]);
    else if (arg.startsWith('--source=')) out.sourceRoot = path.resolve(arg.slice('--source='.length));
    else if (arg.startsWith('--source-root=')) out.sourceRoot = path.resolve(arg.slice('--source-root='.length));
    else if (arg === '--target-root' || arg === '--target') out.targetRoot = resolveArg(argv[++index]);
    else if (arg.startsWith('--target-root=')) out.targetRoot = path.resolve(arg.slice('--target-root='.length));
    else if (arg.startsWith('--target=')) out.targetRoot = path.resolve(arg.slice('--target='.length));
    else if (arg === '--approval-id') out.approvalId = String(argv[++index] || '').trim() || null;
    else if (arg.startsWith('--approval-id=')) out.approvalId = arg.slice('--approval-id='.length).trim() || null;
    else if (arg === '--max-candidates') out.maxCandidates = positiveNumber(argv[++index]);
    else if (arg.startsWith('--max-candidates=')) out.maxCandidates = positiveNumber(arg.slice('--max-candidates='.length));
    else if (arg === '--apply') out.apply = true;
    else if (arg === '--overwrite') out.overwrite = true;
    else if (arg === '--no-core') out.includeCore = false;
    else if (arg === '--no-optional') out.includeOptional = false;
    else if (arg === '--json') out.json = true;
    else if (arg === '--require-pass') out.requirePass = true;
    else if (arg === '--strict') out.strict = true;
  }

  return out;
}

function resolveArg(value: string | undefined): string | null {
  const text = String(value || '').trim();
  return text ? path.resolve(text) : null;
}

function positiveNumber(value: string | undefined): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}
