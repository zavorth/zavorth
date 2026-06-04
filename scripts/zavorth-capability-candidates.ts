import fs from 'node:fs';
import path from 'node:path';

import type { ZavorthInnovationRadarSnapshot } from '../src/contracts/ZavorthInnovationRadarContract.js';
import {
  type ZavorthCapabilityCandidateStatus,
} from '../src/contracts/ZavorthCapabilityCandidateRegistryContract.js';
import { ZavorthCapabilityCandidateRegistryService } from '../src/services/ZavorthCapabilityCandidateRegistryService.js';
import { ZavorthHomePathService } from '../src/services/ZavorthHomePathService.js';

const args = process.argv.slice(2);
const json = args.includes('--json');
const list = args.includes('--list') || (!args.includes('--register') && !hasValue('--transition'));
const register = args.includes('--register');
const allNew = args.includes('--all-new');
const actor = valueFor('--actor') || 'operator';
const candidateIds = valuesFor('--candidate');
const transitionSpecs = valuesFor('--transition');

void main().catch((error) => {
  process.stderr.write(`[capability-candidates] ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});

async function main(): Promise<void> {
  const service = new ZavorthCapabilityCandidateRegistryService();
  let snapshot = service.snapshot();

  if (register) {
    const radar = readRadarSnapshot(valueFor('--from-radar'));
    snapshot = service.register({
      radar,
      candidateIds,
      allNew,
      actor,
    });
  }

  for (const spec of transitionSpecs) {
    const [candidateId, to] = parseTransition(spec);
    snapshot = service.transition({ candidateId, to, actor });
  }

  if (list || register || transitionSpecs.length > 0) {
    if (json) {
      process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
    } else {
      process.stdout.write(`${service.renderText(snapshot)}\n`);
    }
  }
}

function readRadarSnapshot(fileArg: string | null): ZavorthInnovationRadarSnapshot {
  const filePath = fileArg ? path.resolve(fileArg) : defaultRadarFile();
  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as ZavorthInnovationRadarSnapshot;
  if (parsed.surface !== 'innovation-radar') {
    throw new Error('Input file is not an Innovation Radar snapshot.');
  }
  return parsed;
}

function defaultRadarFile(): string {
  const paths = new ZavorthHomePathService({ projectRoot: process.cwd(), env: process.env }).resolvePaths();
  return path.join(paths.runtimeDir, 'innovation-radar-last.json');
}

function parseTransition(spec: string): [string, ZavorthCapabilityCandidateStatus] {
  const separator = spec.lastIndexOf(':');
  const candidateId = separator > 0 ? spec.slice(0, separator) : '';
  const rawStatus = separator > 0 ? spec.slice(separator + 1) : '';
  const to = rawStatus as ZavorthCapabilityCandidateStatus;
  if (!candidateId || !['observed', 'reviewed', 'prototype_ready', 'archived'].includes(to)) {
    throw new Error('Use --transition <candidate-id>:reviewed|prototype_ready|archived|observed.');
  }
  return [candidateId, to];
}

function valuesFor(flag: string): string[] {
  const values: string[] = [];
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === flag && args[index + 1]) {
      values.push(args[index + 1]);
      index += 1;
      continue;
    }
    if (arg.startsWith(`${flag}=`)) {
      values.push(arg.slice(flag.length + 1));
    }
  }
  return values;
}

function valueFor(flag: string): string | null {
  return valuesFor(flag)[0] || null;
}

function hasValue(flag: string): boolean {
  return valuesFor(flag).length > 0;
}
