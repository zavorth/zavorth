#!/usr/bin/env tsx
import { ZavorthToolOrchestrationVerificationService } from '../src/services/ZavorthToolOrchestrationVerificationService.js';
import type {
  ZavorthToolOrchestrationVerificationInput,
  ZavorthToolVerificationEvidence,
} from '../src/contracts/ZavorthToolOrchestrationVerificationContract.js';
import type { ZavorthContextRecoveryMemoryFact } from '../src/contracts/ZavorthContextRecoveryAssimilationContract.js';

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
  failureAttempt: number | null;
  availableSurfaces: ZavorthToolOrchestrationVerificationInput['availableSurfaces'];
  approvalId: string | null;
  ownerConfirmed: boolean;
  verificationEvidence: ZavorthToolVerificationEvidence[];
  completedChecks: string[];
};

const args = parseArgs(process.argv.slice(2));
const service = new ZavorthToolOrchestrationVerificationService();
const snapshot = service.buildSnapshot({
  text: args.text || 'planeje a rota safe',
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
      attempt: args.failureAttempt,
    }
    : null,
  availableSurfaces: args.availableSurfaces,
  approvalId: args.approvalId,
  ownerConfirmed: args.ownerConfirmed,
  verificationEvidence: args.verificationEvidence,
  completedChecks: args.completedChecks,
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
    failureAttempt: null,
    availableSurfaces: null,
    approvalId: null,
    ownerConfirmed: false,
    verificationEvidence: [],
    completedChecks: [],
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
    else if (arg === '--failure-attempt') out.failureAttempt = Number(argv[++index]) || null;
    else if (arg.startsWith('--failure-attempt=')) out.failureAttempt = Number(arg.slice('--failure-attempt='.length)) || null;
    else if (arg === '--surfaces') out.availableSurfaces = parseSurfaces(argv[++index]);
    else if (arg.startsWith('--surfaces=')) out.availableSurfaces = parseSurfaces(arg.slice('--surfaces='.length));
    else if (arg === '--approval') out.approvalId = String(argv[++index] || '') || null;
    else if (arg.startsWith('--approval=')) out.approvalId = arg.slice('--approval='.length) || null;
    else if (arg === '--owner-confirmed') out.ownerConfirmed = true;
    else if (arg === '--evidence') out.verificationEvidence.push(parseEvidence(argv[++index]));
    else if (arg.startsWith('--evidence=')) out.verificationEvidence.push(parseEvidence(arg.slice('--evidence='.length)));
    else if (arg === '--check') out.completedChecks.push(String(argv[++index] || '').trim());
    else if (arg.startsWith('--check=')) out.completedChecks.push(arg.slice('--check='.length).trim());
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

function parseEvidence(value: unknown): ZavorthToolVerificationEvidence {
  const raw = String(value || '');
  const parts = raw.split('|');
  return {
    routeKind: parts[0]?.trim() as ZavorthToolVerificationEvidence['routeKind'] || null,
    source: parts[1]?.trim() || 'cli',
    summary: parts[2]?.trim() || raw,
    trusted: parts[3] ? parts[3].trim() !== 'false' : true,
  };
}

function parseSurfaces(value: unknown): ZavorthToolOrchestrationVerificationInput['availableSurfaces'] {
  const allowed = new Set(['files', 'web', 'browser', 'computer', 'android', 'skills', 'subagents']);
  const items = String(value || '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter((item) => allowed.has(item));
  return items as ZavorthToolOrchestrationVerificationInput['availableSurfaces'];
}
