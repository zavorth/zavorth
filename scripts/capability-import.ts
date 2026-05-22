import fs from 'node:fs';
import path from 'node:path';
import { ZavorthCapabilityImportApiService } from '../src/services/ZavorthCapabilityImportApiService.js';

const args = process.argv.slice(2);
const asJson = args.includes('--json');
const sample = args.includes('--sample');
const filePath = readOption('--file');
const sourceLabel = readOption('--source-label');
const includeItems = !args.includes('--no-items');
const api = new ZavorthCapabilityImportApiService();

if (sample) {
  write({
    packId: 'team-ops-pack',
    label: 'Team Ops Pack',
    summary: 'Example imported capability pack normalized by Zavorth.',
    items: [
      {
        id: 'zavorth-pulse',
        kind: 'skill',
        label: 'Zavorth Pulse',
        summary: 'Prepare a governed operational pulse.',
        tags: ['ops', 'pulse'],
        governance: {
          risk: 'medium',
          requiresApproval: true,
        },
      },
    ],
  });
} else {
  const rawJson = filePath ? readCanonicalFile(filePath) : readOption('--raw-json');
  const snapshot = api.buildSnapshot({
    rawJson,
    sourceLabel,
    includeItems,
  });
  write(snapshot);
}

function write(value: unknown): void {
  if (asJson || sample) {
    console.log(JSON.stringify(value, null, 2));
    return;
  }
  console.log(api.renderReport({
    rawJson: filePath ? readCanonicalFile(filePath) : readOption('--raw-json'),
    sourceLabel,
    includeItems,
  }));
}

function readCanonicalFile(inputPath: string): string {
  const root = process.cwd();
  const absolute = path.resolve(root, inputPath);
  const relative = path.relative(root, absolute);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('Capability Importer only reads manifest files inside the Zavorth root.');
  }
  return fs.readFileSync(absolute, 'utf8');
}

function readOption(name: string): string | null {
  const index = args.indexOf(name);
  if (index < 0) {
    return null;
  }
  const value = args[index + 1];
  if (!value || value.startsWith('--')) {
    return null;
  }
  return value;
}
