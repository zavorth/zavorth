#!/usr/bin/env tsx
import { ZavorthContextRecoveryAssimilationService } from '../src/services/ZavorthContextRecoveryAssimilationService.js';
import type {
  ZavorthContextRecoveryInput,
  ZavorthContextRecoveryMemoryFact,
} from '../src/contracts/ZavorthContextRecoveryAssimilationContract.js';

type Args = {
  json: boolean;
  text: string;
  surface: string | null;
  actorId: string | null;
  sessionId: string | null;
  priorSummary: string | null;
  recentEvents: string[];
  memoryFacts: ZavorthContextRecoveryMemoryFact[];
  failureMessage: string | null;
  failureTool: string | null;
  failureCode: string | null;
  failureAttempt: number | null;
  failureRetryable: boolean | null;
  availableSurfaces: ZavorthContextRecoveryInput['availableSurfaces'];
  approvalId: string | null;
  ownerConfirmed: boolean;
};

const args = parseArgs(process.argv.slice(2));
const service = new ZavorthContextRecoveryAssimilationService();
const snapshot = service.buildSnapshot({
  text: args.text || 'continue safely',
  surface: args.surface,
  actorId: args.actorId,
  sessionId: args.sessionId,
  priorSummary: args.priorSummary,
  recentEvents: args.recentEvents,
  memoryFacts: args.memoryFacts,
  lastFailure: args.failureMessage
    ? {
      message: args.failureMessage,
      toolId: args.failureTool,
      code: args.failureCode,
      attempt: args.failureAttempt,
      retryable: args.failureRetryable,
    }
    : null,
  availableSurfaces: args.availableSurfaces,
  approvalId: args.approvalId,
  ownerConfirmed: args.ownerConfirmed,
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
    text: '',
    surface: null,
    actorId: null,
    sessionId: null,
    priorSummary: null,
    recentEvents: [],
    memoryFacts: [],
    failureMessage: null,
    failureTool: null,
    failureCode: null,
    failureAttempt: null,
    failureRetryable: null,
    availableSurfaces: null,
    approvalId: null,
    ownerConfirmed: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index] || '';
    if (arg === '--json') out.json = true;
    else if (arg === '--text') out.text = String(argv[++index] || '');
    else if (arg.startsWith('--text=')) out.text = arg.slice('--text='.length);
    else if (arg === '--surface') out.surface = String(argv[++index] || '') || null;
    else if (arg.startsWith('--surface=')) out.surface = arg.slice('--surface='.length) || null;
    else if (arg === '--actor') out.actorId = String(argv[++index] || '') || null;
    else if (arg.startsWith('--actor=')) out.actorId = arg.slice('--actor='.length) || null;
    else if (arg === '--session') out.sessionId = String(argv[++index] || '') || null;
    else if (arg.startsWith('--session=')) out.sessionId = arg.slice('--session='.length) || null;
    else if (arg === '--summary') out.priorSummary = String(argv[++index] || '') || null;
    else if (arg.startsWith('--summary=')) out.priorSummary = arg.slice('--summary='.length) || null;
    else if (arg === '--event') out.recentEvents.push(String(argv[++index] || ''));
    else if (arg.startsWith('--event=')) out.recentEvents.push(arg.slice('--event='.length));
    else if (arg === '--memory') out.memoryFacts.push(parseMemory(argv[++index]));
    else if (arg.startsWith('--memory=')) out.memoryFacts.push(parseMemory(arg.slice('--memory='.length)));
    else if (arg === '--failure') out.failureMessage = String(argv[++index] || '') || null;
    else if (arg.startsWith('--failure=')) out.failureMessage = arg.slice('--failure='.length) || null;
    else if (arg === '--failure-tool') out.failureTool = String(argv[++index] || '') || null;
    else if (arg.startsWith('--failure-tool=')) out.failureTool = arg.slice('--failure-tool='.length) || null;
    else if (arg === '--failure-code') out.failureCode = String(argv[++index] || '') || null;
    else if (arg.startsWith('--failure-code=')) out.failureCode = arg.slice('--failure-code='.length) || null;
    else if (arg === '--failure-attempt') out.failureAttempt = Number(argv[++index]) || null;
    else if (arg.startsWith('--failure-attempt=')) out.failureAttempt = Number(arg.slice('--failure-attempt='.length)) || null;
    else if (arg === '--failure-retryable') out.failureRetryable = true;
    else if (arg === '--failure-not-retryable') out.failureRetryable = false;
    else if (arg === '--surfaces') out.availableSurfaces = parseSurfaces(argv[++index]);
    else if (arg.startsWith('--surfaces=')) out.availableSurfaces = parseSurfaces(arg.slice('--surfaces='.length));
    else if (arg === '--approval') out.approvalId = String(argv[++index] || '') || null;
    else if (arg.startsWith('--approval=')) out.approvalId = arg.slice('--approval='.length) || null;
    else if (arg === '--owner-confirmed') out.ownerConfirmed = true;
  }
  return out;
}

function parseMemory(value: unknown): ZavorthContextRecoveryMemoryFact {
  const raw = String(value || '');
  const parts = raw.split('|');
  return {
    id: parts[0]?.trim() || `memory-${Date.now()}`,
    summary: parts[1]?.trim() || raw,
    source: parts[2]?.trim() || 'cli',
    confidence: parts[3] ? Number(parts[3]) : 0.7,
    layer: parts[4]?.trim() as ZavorthContextRecoveryMemoryFact['layer'] || null,
  };
}

function parseSurfaces(value: unknown): ZavorthContextRecoveryInput['availableSurfaces'] {
  const allowed = new Set(['files', 'web', 'browser', 'computer', 'android', 'skills', 'subagents']);
  const items = String(value || '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter((item) => allowed.has(item));
  return items as ZavorthContextRecoveryInput['availableSurfaces'];
}
