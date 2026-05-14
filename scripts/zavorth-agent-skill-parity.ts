#!/usr/bin/env tsx
import { ZavorthAgentSkillParityCertificationService } from '../src/services/ZavorthAgentSkillParityCertificationService.js';

type Args = {
  json: boolean;
  sources: Array<{ sourcePath: string }>;
};

const args = parseArgs(process.argv.slice(2));
main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

async function main(): Promise<void> {
  const service = new ZavorthAgentSkillParityCertificationService();
  const snapshot = await service.buildSnapshot({
    sources: args.sources,
  });
  if (args.json) {
    console.log(JSON.stringify(snapshot, null, 2));
  } else {
    console.log(service.formatSnapshotText(snapshot));
  }
  if (snapshot.status === 'blocked') {
    process.exitCode = 1;
  }
}

function parseArgs(argv: string[]): Args {
  const out: Args = {
    json: false,
    sources: [],
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index] || '';
    if (arg === '--json') out.json = true;
    else if (arg === '--source') out.sources.push({ sourcePath: argv[++index] || '' });
    else if (arg.startsWith('--source=')) out.sources.push({ sourcePath: arg.slice('--source='.length) });
  }
  return out;
}

