#!/usr/bin/env node

import fs from 'node:fs';
import { ZavorthAgentReviewService, type ZavorthAgentReviewTarget } from '../src/services/ZavorthAgentReviewService.js';
import type { GovernedReviewMode } from '../src/runtime/review/index.js';

type CliOptions = {
  json: boolean;
  requirePass: boolean;
  target: ZavorthAgentReviewTarget | null;
  objective: string | null;
  workspace: string | null;
  mode: GovernedReviewMode | null;
  baseRef: string | null;
  targetRef: string | null;
  prTarget: string | null;
  repo: string | null;
  diffFile: string | null;
  postComment: boolean;
  applyPatch: boolean;
  launchLiveAgents: boolean;
  approvalId: string | null;
};

function parseArgs(argv: string[]): CliOptions {
  return {
    json: argv.includes('--json'),
    requirePass: argv.includes('--require-pass') || argv.includes('--strict'),
    target: readTarget(argv),
    objective: readFlexibleStringFlag(argv, 'objective')
      || readFlexibleStringFlag(argv, 'request')
      || readFlexibleStringFlag(argv, 'prompt')
      || readPositionalText(argv)
      || null,
    workspace: readFlexibleStringFlag(argv, 'workspace') || readFlexibleStringFlag(argv, 'cwd'),
    mode: readMode(argv),
    baseRef: readFlexibleStringFlag(argv, 'base') || readFlexibleStringFlag(argv, 'base-ref'),
    targetRef: readFlexibleStringFlag(argv, 'head') || readFlexibleStringFlag(argv, 'target-ref'),
    prTarget: readFlexibleStringFlag(argv, 'pr') || readFlexibleStringFlag(argv, 'pull-request'),
    repo: readFlexibleStringFlag(argv, 'repo'),
    diffFile: readFlexibleStringFlag(argv, 'diff-file'),
    postComment: argv.includes('--post-comment'),
    applyPatch: argv.includes('--apply-patch'),
    launchLiveAgents: argv.includes('--launch-live-agents'),
    approvalId: readFlexibleStringFlag(argv, 'approval') || readFlexibleStringFlag(argv, 'approval-id'),
  };
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  if (argv.includes('--help') || argv.includes('-h')) {
    process.stdout.write([
      'Zavorth Agent Review',
      '',
      'Usage:',
      '  zavorth agent-review',
      '  zavorth agent-review --objective "review current auth changes" --json',
      '  zavorth agent-review --pr 42 --repo owner/repo',
      '  zavorth agent-review --diff-file review.patch --mode security-review',
      '',
      'Safety:',
      '  Read-only by default.',
      '  PR comments, patches and live review agents require --approval=<id>.',
      '  Without approval, the command only surfaces findings, zavorthControl lanes and receipts.',
      '',
    ].join('\n'));
    return;
  }

  const options = parseArgs(argv);
  const service = new ZavorthAgentReviewService();
  const diffText = options.diffFile ? fs.readFileSync(options.diffFile, 'utf8') : null;
  const snapshot = await service.run({
    objective: options.objective,
    workspace: options.workspace || process.cwd(),
    target: options.target,
    mode: options.mode,
    baseRef: options.baseRef,
    targetRef: options.targetRef,
    prTarget: options.prTarget,
    repo: options.repo,
    diffText,
    postComment: options.postComment,
    applyPatch: options.applyPatch,
    launchLiveAgents: options.launchLiveAgents,
    approvalId: options.approvalId,
    userId: readFlexibleStringFlag(argv, 'user-id') || 'operator',
    sessionId: readFlexibleStringFlag(argv, 'session-id') || 'agent-review',
  });

  process.stdout.write(options.json ? `${JSON.stringify(snapshot, null, 2)}\n` : service.renderText(snapshot));

  if (options.requirePass && (snapshot.status === 'blocked' || snapshot.status === 'failed')) {
    process.exitCode = 1;
  }
}

function readMode(argv: string[]): GovernedReviewMode | null {
  const raw = readFlexibleStringFlag(argv, 'mode');
  return raw === 'code-review'
    || raw === 'security-review'
    || raw === 'policy-review'
    || raw === 'regression-review'
    ? raw
    : null;
}

function readTarget(argv: string[]): ZavorthAgentReviewTarget | null {
  const raw = readFlexibleStringFlag(argv, 'target');
  return raw === 'workspace-diff' || raw === 'github-pr' || raw === 'provided' ? raw : null;
}

function readFlexibleStringFlag(argv: string[], name: string): string | null {
  const prefix = `--${name}=`;
  const inline = argv.find((arg) => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = argv.indexOf(`--${name}`);
  return index >= 0 && argv[index + 1] ? argv[index + 1] : null;
}

function readPositionalText(argv: string[]): string {
  const values: string[] = [];
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index] || '';
    if (arg.startsWith('--')) {
      if (!arg.includes('=') && argv[index + 1] && !argv[index + 1].startsWith('--')) {
        index += 1;
      }
      continue;
    }
    values.push(arg);
  }
  return values.join(' ').trim();
}

main().catch((error) => {
  console.error(`[zavorth-agent-review] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
