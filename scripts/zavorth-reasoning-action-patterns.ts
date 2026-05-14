#!/usr/bin/env tsx
import { ZavorthReasoningActionPatternService } from '../src/services/ZavorthReasoningActionPatternService.js';
import type { ZavorthReasoningActionPatternInput } from '../src/contracts/ZavorthReasoningActionPatternContract.js';

type Args = {
  json: boolean;
  text: string;
  surface: string | null;
  actorId: string | null;
  availableSurfaces: ZavorthReasoningActionPatternInput['availableSurfaces'];
  approvalId: string | null;
  ownerConfirmed: boolean;
};

const args = parseArgs(process.argv.slice(2));
const service = new ZavorthReasoningActionPatternService();
const snapshot = service.plan({
  text: args.text || 'responder com seguranca',
  surface: args.surface,
  actorId: args.actorId,
  availableSurfaces: args.availableSurfaces,
  approvalId: args.approvalId,
  ownerConfirmed: args.ownerConfirmed,
});

if (args.json) {
  console.log(JSON.stringify(snapshot, null, 2));
} else {
  console.log(service.formatPlanText(snapshot));
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
    else if (arg === '--approval') out.approvalId = String(argv[++index] || '') || null;
    else if (arg.startsWith('--approval=')) out.approvalId = arg.slice('--approval='.length) || null;
    else if (arg === '--owner-confirmed') out.ownerConfirmed = true;
    else if (arg === '--surfaces') out.availableSurfaces = parseSurfaces(argv[++index]);
    else if (arg.startsWith('--surfaces=')) out.availableSurfaces = parseSurfaces(arg.slice('--surfaces='.length));
  }
  return out;
}

function parseSurfaces(value: unknown): ZavorthReasoningActionPatternInput['availableSurfaces'] {
  const allowed = new Set(['files', 'web', 'browser', 'computer', 'android', 'skills', 'subagents']);
  const items = String(value || '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter((item) => allowed.has(item));
  return items as ZavorthReasoningActionPatternInput['availableSurfaces'];
}
