#!/usr/bin/env tsx
import { ZavorthAgentCapabilityAssimilationService } from '../src/services/ZavorthAgentCapabilityAssimilationService.js';
import type {
  ZavorthAgentCapabilityAssimilationCategory,
  ZavorthAgentCapabilityAssimilationStatus,
} from '../src/contracts/ZavorthAgentCapabilityAssimilationContract.js';

type Args = {
  json: boolean;
  category: ZavorthAgentCapabilityAssimilationCategory | null;
  status: ZavorthAgentCapabilityAssimilationStatus | null;
};

const args = parseArgs(process.argv.slice(2));
const service = new ZavorthAgentCapabilityAssimilationService();
const snapshot = service.buildSnapshot();
const filtered = {
  ...snapshot,
  matrix: snapshot.matrix.filter((item) =>
    (!args.category || item.category === args.category)
    && (!args.status || item.status === args.status)),
};

if (args.json) {
  console.log(JSON.stringify(filtered, null, 2));
} else {
  console.log(service.formatSnapshotText(filtered));
}

if (snapshot.status === 'blocked') {
  process.exitCode = 1;
}

function parseArgs(argv: string[]): Args {
  const out: Args = {
    json: false,
    category: null,
    status: null,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index] || '';
    if (arg === '--json') out.json = true;
    else if (arg === '--category') out.category = normalizeCategory(argv[++index]);
    else if (arg.startsWith('--category=')) out.category = normalizeCategory(arg.slice('--category='.length));
    else if (arg === '--status') out.status = normalizeStatus(argv[++index]);
    else if (arg.startsWith('--status=')) out.status = normalizeStatus(arg.slice('--status='.length));
  }
  return out;
}

function normalizeCategory(value: unknown): ZavorthAgentCapabilityAssimilationCategory | null {
  const normalized = String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_');
  return [
    'planning',
    'tool_orchestration',
    'subagents',
    'skills',
    'browser_device_computer',
    'memory_context',
    'error_recovery',
    'cross_surface_ux',
    'security_governance',
  ].includes(normalized)
    ? normalized as ZavorthAgentCapabilityAssimilationCategory
    : null;
}

function normalizeStatus(value: unknown): ZavorthAgentCapabilityAssimilationStatus | null {
  const normalized = String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return ['assimilated', 'partial', 'planned', 'rejected'].includes(normalized)
    ? normalized as ZavorthAgentCapabilityAssimilationStatus
    : null;
}
